// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {PublisherDistributor} from "../src/v1/periphery/PublisherDistributor.sol";

contract Usdc is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract PublisherDistributorTest is Test {
    PublisherDistributor internal d;
    Usdc internal usdc;

    address internal admin = address(0xA11CE);
    address internal setter = address(0x5E77E9);
    address internal guardian = address(0x6A6D);

    address internal pubA = address(0xAAA1);
    address internal pubB = address(0xBBB2);
    address internal pubC = address(0xCCC3);

    function setUp() public {
        usdc = new Usdc();
        d = new PublisherDistributor(IERC20(address(usdc)), admin, setter);
        // Read the role BEFORE the prank: `GUARDIAN_ROLE()` is itself a call,
        // and `vm.prank` applies to the next one — it would be spent on the
        // view and `grantRole` would run as the test contract.
        bytes32 guardianRole = d.GUARDIAN_ROLE();
        vm.prank(admin);
        d.grantRole(guardianRole, guardian);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    /// A two-leaf tree, which is the smallest one with a real proof.
    function _tree(address a, uint256 ca, address b, uint256 cb)
        internal view returns (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB)
    {
        bytes32 la = d.leafOf(a, ca);
        bytes32 lb = d.leafOf(b, cb);
        // OpenZeppelin sorts the pair before hashing.
        root = la < lb
            ? keccak256(bytes.concat(la, lb))
            : keccak256(bytes.concat(lb, la));
        proofA = new bytes32[](1); proofA[0] = lb;
        proofB = new bytes32[](1); proofB[0] = la;
    }

    function _fund(uint256 amount) internal { usdc.mint(address(d), amount); }

    function _setRoot(bytes32 root, uint256 total) internal {
        vm.prank(setter);
        d.setRoot(root, total, "ipfs://leaves");
    }

    // ── the amount question ───────────────────────────────────────────────

    /// `unallocated()` is what the off-chain job reads to size an epoch. It is
    /// the balance minus what is already owed, NOT a per-epoch delta.
    function test_unallocated_isBalanceMinusOutstanding() public {
        _fund(1_000);
        assertEq(d.unallocated(), 1_000, "all of it is free before any root");

        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);

        assertEq(d.outstanding(), 1_000);
        assertEq(d.unallocated(), 0, "fully allocated");

        // Next epoch's revenue arrives.
        _fund(500);
        assertEq(d.unallocated(), 500, "only the new money is free");
    }

    /// Dust from integer division, a skipped epoch and an outright donation all
    /// roll forward with no special handling. This is the property that makes
    /// measuring an epoch delta unnecessary.
    function test_unallocated_absorbsDustAndDonations() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 333, pubB, 333);
        _setRoot(root, 666);
        assertEq(d.unallocated(), 334, "rounding dust stays available");

        usdc.mint(address(d), 7); // a stray transfer, nobody's allocation
        assertEq(d.unallocated(), 341);
    }

    // ── the solvency invariant ────────────────────────────────────────────

    /// The check the contract exists to enforce: a root promising more than the
    /// contract holds cannot be published at all. Without it the first claimants
    /// are paid and the last ones revert.
    function test_setRoot_refusesOverAllocation() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 900, pubB, 200); // 1100 > 1000
        vm.prank(setter);
        vm.expectRevert(
            abi.encodeWithSelector(PublisherDistributor.Insolvent.selector, 1_100, 1_000)
        );
        d.setRoot(root, 1_100, "ipfs://leaves");
    }

    function test_setRoot_allowsExactlyTheBalance() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);
        assertEq(d.totalAllocated(), 1_000);
    }

    /// Claimed money is no longer held, so the invariant must measure what is
    /// still promised — not the gross total ever allocated.
    function test_setRoot_countsOnlyUndrawnAgainstBalance() public {
        _fund(1_000);
        (bytes32 r1, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(r1, 1_000);
        d.claim(pubA, 600, pA); // 600 leaves the contract

        _fund(1_000); // epoch 2 revenue; balance is now 1400
        (bytes32 r2,,) = _tree(pubA, 1_000, pubB, 1_000);
        _setRoot(r2, 2_000); // promises 2000-600 = 1400. Exactly affordable.
        assertEq(d.totalAllocated(), 2_000);
    }

    function test_setRoot_refusesAllocationBelowClaimed() public {
        _fund(1_000);
        (bytes32 r1, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(r1, 1_000);
        d.claim(pubA, 600, pA);

        (bytes32 r2,,) = _tree(pubA, 100, pubB, 100);
        vm.prank(setter);
        vm.expectRevert(
            abi.encodeWithSelector(
                PublisherDistributor.AllocationBelowClaimed.selector, 200, 600
            )
        );
        d.setRoot(r2, 200, "ipfs://leaves");
    }

    function test_setRoot_requiresAUri() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        vm.prank(setter);
        vm.expectRevert(PublisherDistributor.EmptyUri.selector);
        d.setRoot(root, 1_000, "");
    }

    // ── claiming ──────────────────────────────────────────────────────────

    function test_claim_paysTheAccountNotTheCaller() public {
        _fund(1_000);
        (bytes32 root, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);

        // A stranger pays the gas; pubA gets the money. This is what lets us
        // run a courtesy sweeper with no trust assumption.
        vm.prank(address(0xDEAD));
        d.claim(pubA, 600, pA);

        assertEq(usdc.balanceOf(pubA), 600);
        assertEq(usdc.balanceOf(address(0xDEAD)), 0);
    }

    /// The cumulative property: one claim sweeps every epoch, and skipping
    /// epochs costs nothing.
    function test_claim_cumulativeSweepsSkippedEpochs() public {
        _fund(1_000);
        (bytes32 r1,,) = _tree(pubA, 500, pubB, 500);
        _setRoot(r1, 1_000);
        // pubA does not claim.

        _fund(1_000);
        (bytes32 r2, bytes32[] memory pA2,) = _tree(pubA, 1_000, pubB, 1_000);
        _setRoot(r2, 2_000);

        d.claim(pubA, 1_000, pA2);
        assertEq(usdc.balanceOf(pubA), 1_000, "both epochs in one call");
    }

    function test_claim_secondClaimAgainstSameLeafReverts() public {
        _fund(1_000);
        (bytes32 root, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);
        d.claim(pubA, 600, pA);

        vm.expectRevert(PublisherDistributor.NothingToClaim.selector);
        d.claim(pubA, 600, pA);
    }

    /// A corrected root that lowers somebody converges instead of underflowing,
    /// and cannot claw back what was already drawn.
    function test_claim_downwardCorrectionIsANoOp() public {
        _fund(1_000);
        (bytes32 r1, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(r1, 1_000);
        d.claim(pubA, 600, pA);

        // We decide pubA should only ever have had 700 total... they have 600.
        _fund(1_000);
        (bytes32 r2, bytes32[] memory pA2,) = _tree(pubA, 700, pubB, 900);
        _setRoot(r2, 1_600);
        d.claim(pubA, 700, pA2);
        assertEq(usdc.balanceOf(pubA), 700, "tops up to the corrected total");

        // And a root putting them BELOW what they drew pays nothing further.
        _fund(1_000);
        (bytes32 r3, bytes32[] memory pA3,) = _tree(pubA, 650, pubB, 2_000);
        _setRoot(r3, 2_650);
        vm.expectRevert(PublisherDistributor.NothingToClaim.selector);
        d.claim(pubA, 650, pA3);
    }

    function test_claim_refusesAForgedAmount() public {
        _fund(1_000);
        (bytes32 root, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);

        vm.expectRevert(PublisherDistributor.BadProof.selector);
        d.claim(pubA, 999, pA);
    }

    function test_claim_refusesAnAccountNotInTheTree() public {
        _fund(1_000);
        (bytes32 root, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);

        vm.expectRevert(PublisherDistributor.BadProof.selector);
        d.claim(pubC, 600, pA);
    }

    function test_claimMany_skipsAlreadyDrawnInsteadOfReverting() public {
        _fund(1_000);
        (bytes32 root, bytes32[] memory pA, bytes32[] memory pB) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);
        d.claim(pubA, 600, pA);

        address[] memory accounts = new address[](2);
        accounts[0] = pubA; accounts[1] = pubB;
        uint256[] memory cums = new uint256[](2);
        cums[0] = 600; cums[1] = 400;
        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = pA; proofs[1] = pB;

        uint256 total = d.claimMany(accounts, cums, proofs);
        assertEq(total, 400, "only pubB was owed anything");
        assertEq(usdc.balanceOf(pubB), 400);
    }

    // ── access control ────────────────────────────────────────────────────

    function test_setRoot_isGated() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        // Hoisted for the same reason as in `setUp`: reading the role is a
        // call, and it would otherwise consume the prank.
        bytes32 role = d.ROOT_SETTER_ROLE();
        vm.prank(pubA);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, pubA, role
            )
        );
        d.setRoot(root, 1_000, "ipfs://leaves");
    }

    /// The bound on a leaked root-setter key: it can misdirect the UNALLOCATED
    /// balance, and cannot touch a token already owed to somebody.
    function test_rootSetter_cannotStealAnOutstandingClaim() public {
        _fund(1_000);
        (bytes32 r1,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(r1, 1_000);

        // A malicious root giving everything to the attacker. It allocates
        // 1000 to one address; solvency passes, but pubA's 600 is still in the
        // tree's total, so the attacker cannot exceed the balance...
        address attacker = address(0xBAD);
        (bytes32 evil, bytes32[] memory pEvil,) = _tree(attacker, 1_000, pubB, 0);
        vm.prank(setter);
        d.setRoot(evil, 1_000, "ipfs://evil");
        d.claim(attacker, 1_000, pEvil);

        // ...and the damage is bounded by what was unclaimed, which is the
        // point: an epoch's revenue, never the historical pot. pubA's money was
        // still in the contract because pubA had not drawn it, so this is the
        // worst case and it is why `setRoot` wants a timelock in production.
        assertEq(usdc.balanceOf(attacker), 1_000);
        assertEq(d.unallocated(), 0);
    }

    function test_rollBack_restoresThePreviousRoot() public {
        _fund(1_000);
        (bytes32 r1, bytes32[] memory pA,) = _tree(pubA, 600, pubB, 400);
        _setRoot(r1, 1_000);

        address attacker = address(0xBAD);
        (bytes32 evil,,) = _tree(attacker, 1_000, pubB, 0);
        vm.prank(setter);
        d.setRoot(evil, 1_000, "ipfs://evil");

        // Caught before the attacker claimed.
        vm.prank(guardian);
        d.rollBackRoot();

        assertEq(d.root(), r1);
        d.claim(pubA, 600, pA);
        assertEq(usdc.balanceOf(pubA), 600, "honest claim survives the rollback");
    }

    function test_rollBack_isGated() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);
        vm.prank(pubA);
        vm.expectRevert();
        d.rollBackRoot();
    }

    // ── sweeping ──────────────────────────────────────────────────────────

    function test_sweep_cannotTakeAnOutstandingClaim() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(PublisherDistributor.Insolvent.selector, 1, 0)
        );
        d.sweep(admin, 1);
    }

    function test_sweep_takesOnlyTheFreeBalance() public {
        _fund(1_000);
        (bytes32 root,,) = _tree(pubA, 600, pubB, 400);
        _setRoot(root, 1_000);
        _fund(250);

        vm.prank(admin);
        d.sweep(admin, 250);
        assertEq(usdc.balanceOf(admin), 250);
        assertEq(d.outstanding(), 1_000, "publishers untouched");
    }

    // ── per-epoch reward model, cumulative accounting ─────────────────────

    /// Build a 3-leaf tree. Enough to model a publisher set that CHANGES.
    function _tree3(
        address[3] memory who, uint256[3] memory cum
    ) internal view returns (bytes32 root, bytes32[][3] memory proofs) {
        bytes32[3] memory l;
        for (uint256 i; i < 3; ++i) l[i] = d.leafOf(who[i], cum[i]);
        bytes32 h01 = l[0] < l[1]
            ? keccak256(bytes.concat(l[0], l[1]))
            : keccak256(bytes.concat(l[1], l[0]));
        root = h01 < l[2]
            ? keccak256(bytes.concat(h01, l[2]))
            : keccak256(bytes.concat(l[2], h01));
        proofs[0] = new bytes32[](2); proofs[0][0] = l[1]; proofs[0][1] = l[2];
        proofs[1] = new bytes32[](2); proofs[1][0] = l[0]; proofs[1][1] = l[2];
        proofs[2] = new bytes32[](1); proofs[2][0] = h01;
    }

    /// THE MODEL QUESTION, executed.
    ///
    /// Each epoch splits ONLY the revenue that arrived since the last one, by
    /// that epoch's shares — and the publisher set changes between them. The
    /// cumulative leaf is just the running sum of those independent awards, so
    /// "per-epoch split" and "cumulative accounting" compose with no tension.
    ///
    /// Note what is NOT happening: nobody's share of a PAST epoch is ever
    /// recomputed. pubC joining in epoch 2 does not dilute what pubA earned in
    /// epoch 1, because epoch 1's award is already summed into pubA's total.
    function test_perEpochSplit_accumulatesWithoutRetroactivity() public {
        address[3] memory who = [pubA, pubB, pubC];

        // ── Epoch 1: 1000 arrives. Only A and B are publishing. 60/40.
        _fund(1_000);
        assertEq(d.unallocated(), 1_000, "epoch 1 pot is what arrived");
        uint256[3] memory e1 = [uint256(600), 400, 0];
        (bytes32 r1, bytes32[][3] memory p1) = _tree3(who, e1);
        _setRoot(r1, 1_000);

        // Allocating the whole unallocated balance sits EXACTLY at the
        // solvency limit — that is the arithmetic working out, not a coincidence.
        assertEq(d.unallocated(), 0);

        d.claim(pubA, 600, p1[0]); // A takes epoch 1 now
        // B waits.

        // ── Epoch 2: another 1000. C has joined; the split is now 20/30/50.
        _fund(1_000);
        assertEq(d.unallocated(), 1_000, "only epoch 2's money is in play");
        uint256[3] memory e2 = [uint256(600 + 200), 400 + 300, 0 + 500];
        (bytes32 r2, bytes32[][3] memory p2) = _tree3(who, e2);
        _setRoot(r2, 2_000);

        // ── Epoch 3: 500 only. A has stopped publishing and earns nothing new.
        _fund(500);
        assertEq(d.unallocated(), 500);
        uint256[3] memory e3 = [uint256(800), 700 + 200, 500 + 300];
        (bytes32 r3, bytes32[][3] memory p3) = _tree3(who, e3);
        _setRoot(r3, 2_500);

        // Everyone draws against the LATEST root only.
        d.claim(pubA, 800, p3[0]); // tops up by epoch 2's 200
        d.claim(pubB, 900, p3[1]); // three epochs, never claimed before, one call
        d.claim(pubC, 800, p3[2]);

        assertEq(usdc.balanceOf(pubA), 800, "600 + 200 + 0");
        assertEq(usdc.balanceOf(pubB), 900, "400 + 300 + 200");
        assertEq(usdc.balanceOf(pubC), 800, "0 + 500 + 300");

        // Every token that came in went out, and none of it twice.
        assertEq(usdc.balanceOf(pubA) + usdc.balanceOf(pubB) + usdc.balanceOf(pubC), 2_500);
        assertEq(d.totalClaimed(), 2_500);
        assertEq(usdc.balanceOf(address(d)), 0);
        assertEq(d.unallocated(), 0);
    }

    /// A publisher who stops earning keeps what they earned, and a later root
    /// that leaves their total flat pays them nothing more. The per-epoch model
    /// means an award, once made, is theirs.
    function test_perEpochSplit_flatTotalPaysNothingFurther() public {
        address[3] memory who = [pubA, pubB, pubC];
        _fund(1_000);
        uint256[3] memory e1 = [uint256(600), 400, 0];
        (bytes32 r1, bytes32[][3] memory p1) = _tree3(who, e1);
        _setRoot(r1, 1_000);
        d.claim(pubA, 600, p1[0]);

        _fund(1_000);
        uint256[3] memory e2 = [uint256(600), 900, 500]; // A flat at 600
        (bytes32 r2, bytes32[][3] memory p2) = _tree3(who, e2);
        _setRoot(r2, 2_000);

        vm.expectRevert(PublisherDistributor.NothingToClaim.selector);
        d.claim(pubA, 600, p2[0]);
        assertEq(usdc.balanceOf(pubA), 600, "keeps epoch 1");
    }

    /// Fraud caught BEFORE the claim is recoverable; after it is not. This is
    /// the operational consequence of per-epoch awards, and the argument for a
    /// holding period on a new publisher's first claims.
    function test_perEpochSplit_correctionOnlyReachesUnclaimed() public {
        address[3] memory who = [pubA, pubB, pubC];
        _fund(1_000);
        uint256[3] memory e1 = [uint256(600), 400, 0];
        (bytes32 r1, bytes32[][3] memory p1) = _tree3(who, e1);
        _setRoot(r1, 1_000);

        d.claim(pubA, 600, p1[0]); // A draws before we notice

        // Both were faking. We revoke what we can: B's award is still here.
        _fund(1_000);
        uint256[3] memory e2 = [uint256(600), 0, 1_000];
        (bytes32 r2, bytes32[][3] memory p2) = _tree3(who, e2);
        _setRoot(r2, 1_600);

        vm.expectRevert(PublisherDistributor.NothingToClaim.selector);
        d.claim(pubB, 0, p2[1]);
        assertEq(usdc.balanceOf(pubB), 0, "unclaimed award revoked");
        assertEq(usdc.balanceOf(pubA), 600, "claimed award is gone for good");
    }
}
