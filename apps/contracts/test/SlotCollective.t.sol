// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SlotInit, TaxTerms, ModuleTerms, Manifest} from "../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {SlotCollective} from "../src/collectives/SlotCollective.sol";
import {SlotGovernance, IManagedSlot, Dimension} from "../src/collectives/SlotGovernance.sol";
import {SlotCollectiveFactory} from "../src/collectives/SlotCollectiveFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";
import {Wallet} from "splits-v2/utils/Wallet.sol";
import {Ownable} from "splits-v2/utils/Ownable.sol";

/// @dev Records what the manager relayed, and reverts like the real slot does
///      when the caller is not the manager.
contract MockSlot {
    address public manager;

    uint256 public taxPct;
    address public moduleAddr;
    bytes32 public settings;

    bool public hasTax;
    bool public hasModule;

    uint256 public taxCancels;
    uint256 public moduleCancels;

    error NotManager();
    error NoPendingTerms();

    constructor(address _manager) {
        manager = _manager;
    }

    uint16 public acceptedFeeBps;

    function grant(Manifest calldata expected) external onlyManager {
        acceptedFeeBps = expected.feeBps;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    /// @dev Mirrors the real slot: each term is queued only when its bit is
    ///      set, so two roles can queue independently.
    function proposeTerms(TaxTerms calldata taxTerms, ModuleTerms calldata module, uint8 mask)
        external
        onlyManager
    {
        if (mask == 0) revert NoPendingTerms();
        if (mask & 1 != 0) {
            taxPct = taxTerms.rateBps;
            hasTax = true;
        }
        if (mask & 8 != 0) {
            settings = module.settings;
            moduleAddr = module.target;
            hasModule = true;
        }
    }

    /// @dev Clears whichever of `mask` is queued, and reverts only when none
    ///      was, as the real slot does.
    function cancelTerms(uint8 mask) external onlyManager {
        bool cancelTax = mask & 1 != 0 && hasTax;
        bool cancelModule = mask & 8 != 0 && hasModule;
        if (!cancelTax && !cancelModule) revert NoPendingTerms();
        if (cancelTax) {
            hasTax = false;
            taxPct = 0;
            taxCancels++;
        }
        if (cancelModule) {
            hasModule = false;
            moduleAddr = address(0);
            moduleCancels++;
        }
    }

    function collect() external {}

    function claim(address) external {}
}

contract SlotCollectiveTest is Test {
    SlotCollective internal mgr;
    SlotCollectiveFactory internal factory;
    MockSlot internal slot;
    SplitsWarehouse internal warehouse;

    address internal admin = makeAddr("admin");
    address internal factoryAdmin = makeAddr("factoryAdmin");
    address internal taxMgr = makeAddr("taxMgr");
    address internal policyMgr = makeAddr("policyMgr");
    address internal splitMgr = makeAddr("splitMgr");
    address internal stranger = makeAddr("stranger");

    address internal payeeA = makeAddr("payeeA");
    address internal payeeB = makeAddr("payeeB");

    function setUp() public {
        warehouse = new SplitsWarehouse("Ether", "ETH");

        // Managers are proxies now, so every test below exercises the real
        // deployment path rather than a directly-constructed manager that no
        // longer resembles what ships.
        SlotCollective impl = new SlotCollective(address(warehouse));
        SlotCollectiveFactory factoryImpl = new SlotCollectiveFactory();
        factory = SlotCollectiveFactory(
            address(
                new ERC1967Proxy(
                    address(factoryImpl),
                    abi.encodeCall(
                        SlotCollectiveFactory.initialize,
                        (factoryAdmin, address(impl))
                    )
                )
            )
        );

        mgr = SlotCollective(payable(factory.createCollective(_split(), _roles())));
        slot = new MockSlot(address(mgr));
    }

    function _split() internal view returns (SplitV2Lib.Split memory s) {
        address[] memory recipients = new address[](2);
        recipients[0] = payeeA;
        recipients[1] = payeeB;

        uint256[] memory allocations = new uint256[](2);
        allocations[0] = 60;
        allocations[1] = 40;

        s = SplitV2Lib.Split({
            recipients: recipients,
            allocations: allocations,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    function _roles() internal view returns (SlotCollective.InitialRoles memory r) {
        r.admin = admin;
        r.taxManagers = _one(taxMgr);
        r.policyManagers = _one(policyMgr);
        r.splitManagers = _one(splitMgr);
    }

    function _one(address a) internal pure returns (address[] memory out) {
        out = new address[](1);
        out[0] = a;
    }

    // ── the invariant the whole design rests on ──────────────────────────────

    function test_ownerIsTheContractItself() public view {
        assertEq(mgr.owner(), address(mgr));
    }

    function test_transferOwnershipAlwaysReverts() public {
        vm.expectRevert(SlotCollective.OwnershipIsSelfBound.selector);
        vm.prank(admin);
        mgr.transferOwnership(admin);
    }

    /// @dev The reason `owner` is self-bound. If this ever passes for a human
    ///      caller, every role in this contract is decorative.
    function test_execCallsCannotBypassRoles() public {
        Wallet.Call[] memory calls = new Wallet.Call[](1);
        calls[0] = Wallet.Call({
            to: address(slot),
            value: 0,
            data: abi.encodeCall(MockSlot.proposeTerms, (TaxTerms({recipient: address(0), rateBps: uint16(9999), minRunwaySeconds: 0}), ModuleTerms({target: address(0), settings: bytes32(0)}), uint8(1)))
        });

        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(admin);
        mgr.execCalls(calls);

        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(stranger);
        mgr.execCalls(calls);

        assertEq(slot.taxPct(), 0);
    }

    // ── relays: specific role works, admin works, everyone else is out ───────

    function test_taxManagerCanRelayTax() public {
        vm.prank(taxMgr);
        mgr.proposeTax(IManagedSlot(address(slot)), 500);
        assertEq(slot.taxPct(), 500);
    }

    function test_adminCanRelayBoth() public {
        vm.startPrank(admin);
        mgr.proposeTax(IManagedSlot(address(slot)), 250);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0xCAFE), settings: bytes32(0)}));
        vm.stopPrank();

        assertEq(slot.taxPct(), 250);
        assertEq(slot.moduleAddr(), address(0xCAFE));
    }

    /// @dev Detaching is a real choice, not a missing argument — so the relay
    ///      has to be able to express it.
    function test_thePolicyManagerCanDetachTheModule() public {
        vm.prank(policyMgr);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0xCAFE), settings: bytes32(0)}));
        assertTrue(slot.hasModule());

        vm.prank(policyMgr);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0), settings: bytes32(0)}));
        assertTrue(slot.hasModule(), "still queued, now queued as a detach");
        assertEq(slot.moduleAddr(), address(0));
    }

    /// @dev Role reads are hoisted out of `expectRevert`'s arguments on purpose:
    ///      evaluating `mgr.TAX_MANAGER_ROLE()` inline would consume the prank
    ///      and the assertion would silently test the wrong caller.
    function test_rolesDoNotLeakAcrossDomains() public {
        bytes32 taxRole = mgr.TAX_MANAGER_ROLE();
        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();

        vm.prank(policyMgr);
        vm.expectRevert(_unauthorized(policyMgr, taxRole));
        mgr.proposeTax(IManagedSlot(address(slot)), 500);

        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(1), settings: bytes32(0)}));
    }

    /// @dev The gap the per-dimension cancel closed, and the reason the new
    ///      slot had to grow the same two scopes on cancel that it has on
    ///      propose: retracting your own work must not destroy anybody else's.
    function test_eachRoleCancelsItsOwnDimensionAndLeavesTheOtherStanding()
        public
    {
        vm.prank(taxMgr);
        mgr.proposeTax(IManagedSlot(address(slot)), 500);
        vm.prank(policyMgr);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0xCAFE), settings: bytes32(0)}));

        vm.prank(policyMgr);
        mgr.cancelModuleProposal(IManagedSlot(address(slot)));

        assertEq(slot.moduleCancels(), 1);
        assertEq(slot.taxCancels(), 0);
        assertTrue(slot.hasTax(), "the tax manager's proposal survived");
        assertEq(slot.taxPct(), 500);

        vm.prank(taxMgr);
        mgr.cancelTaxProposal(IManagedSlot(address(slot)));
        assertEq(slot.taxCancels(), 1);
        assertFalse(slot.hasTax());
    }

    /// @dev And the boundary holds in the cancel direction too — a tax manager
    ///      still cannot reach a policy manager's proposal.
    function test_cancelRolesDoNotLeakAcrossDomains() public {
        bytes32 taxRole = mgr.TAX_MANAGER_ROLE();
        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();

        vm.prank(policyMgr);
        vm.expectRevert(_unauthorized(policyMgr, taxRole));
        mgr.cancelTaxProposal(IManagedSlot(address(slot)));

        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.cancelModuleProposal(IManagedSlot(address(slot)));

        assertEq(slot.taxCancels(), 0);
        assertEq(slot.moduleCancels(), 0);
    }

    function test_adminCanCancelEitherDimension() public {
        vm.startPrank(admin);
        mgr.proposeTax(IManagedSlot(address(slot)), 500);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0xCAFE), settings: bytes32(0)}));
        mgr.cancelTaxProposal(IManagedSlot(address(slot)));
        mgr.cancelModuleProposal(IManagedSlot(address(slot)));
        vm.stopPrank();

        assertEq(slot.taxCancels(), 1);
        assertEq(slot.moduleCancels(), 1);
    }

    /// @dev The blanket cancel stays admin-only. It is no longer the ONLY way
    ///      to cancel, so the restriction is now policy rather than damage
    ///      control — but it is still the restriction.
    function test_cancelIsAdminOnly() public {
        bytes32 adminRole = mgr.DEFAULT_ADMIN_ROLE();

        address[] memory managers = new address[](2);
        managers[0] = taxMgr;
        managers[1] = policyMgr;

        for (uint256 i; i < managers.length; ++i) {
            vm.prank(managers[i]);
            vm.expectRevert(_unauthorized(managers[i], adminRole));
            mgr.cancelAllProposals(IManagedSlot(address(slot)));
        }

        vm.prank(admin);
        mgr.proposeTax(IManagedSlot(address(slot)), 500);
        vm.prank(admin);
        mgr.proposeModule(IManagedSlot(address(slot)), ModuleTerms({target: address(0xCAFE), settings: bytes32(0)}));
        vm.prank(admin);
        mgr.cancelAllProposals(IManagedSlot(address(slot)));
        assertEq(slot.taxCancels(), 1);
        assertEq(slot.moduleCancels(), 1);
    }

    /// @dev The blanket cancel must survive a slot with only one dimension
    ///      queued. The slot rejects a cancel for a dimension holding nothing,
    ///      so a naive both-at-once call would revert on the common case.
    function test_theBlanketCancelToleratesAHalfEmptyProposal() public {
        vm.prank(taxMgr);
        mgr.proposeTax(IManagedSlot(address(slot)), 500);

        vm.prank(admin);
        mgr.cancelAllProposals(IManagedSlot(address(slot)));

        assertEq(slot.taxCancels(), 1);
        assertEq(slot.moduleCancels(), 0, "nothing was queued to cancel");
        assertFalse(slot.hasTax());
    }

    function _unauthorized(address account, bytes32 role) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, account, role
        );
    }

    // ── split management ─────────────────────────────────────────────────────

    function test_splitManagerCanRewriteSplitViaSelfCall() public {
        SplitV2Lib.Split memory next = _split();
        next.allocations[0] = 10;
        next.allocations[1] = 90;

        bytes32 before = mgr.splitHash();

        vm.prank(splitMgr);
        mgr.setSplit(_split(), next, new address[](0));

        assertTrue(mgr.splitHash() != before);
        assertEq(mgr.splitHash(), keccak256(abi.encode(next)));
    }

    /// @notice Rewriting the split pays what is held under the old one first.
    function test_rewritingTheSplitPaysOutUnderTheOldOneFirst() public {
        vm.deal(address(mgr), 1 ether);

        address[] memory recipients = new address[](1);
        recipients[0] = payeeA;
        uint256[] memory allocations = new uint256[](1);
        allocations[0] = 100;
        SplitV2Lib.Split memory allToA = SplitV2Lib.Split({
            recipients: recipients,
            allocations: allocations,
            totalAllocation: 100,
            distributionIncentive: 0
        });

        address[] memory tokens = new address[](1);
        tokens[0] = mgr.NATIVE_TOKEN();
        vm.prank(splitMgr);
        mgr.setSplit(_split(), allToA, tokens);

        assertEq(payeeA.balance, 0.6 ether - 1, "payee A got the old share");
        assertEq(payeeB.balance, 0.4 ether - 1, "payee B was paid before being removed");
        assertEq(mgr.splitHash(), keccak256(abi.encode(allToA)));
    }

    /// @notice The split in force must be the one passed as current.
    function test_rewritingTheSplitNeedsTheCurrentSplit() public {
        vm.deal(address(mgr), 1 ether);
        SplitV2Lib.Split memory wrong = _split();
        wrong.allocations[0] = 10;
        wrong.allocations[1] = 90;
        address[] memory tokens = new address[](1);
        tokens[0] = mgr.NATIVE_TOKEN();
        vm.prank(splitMgr);
        vm.expectRevert();
        mgr.setSplit(wrong, wrong, tokens);
    }

    function test_policyManagerRelaysTheGrant() public {
        Manifest memory declared = Manifest({scopes: 4, feeBps: 100, feeRecipient: payeeA});

        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();
        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.grant(IManagedSlot(address(slot)), declared);

        vm.prank(policyMgr);
        mgr.grant(IManagedSlot(address(slot)), declared);
        assertEq(slot.acceptedFeeBps(), 100);
    }

    /// @notice A batch of different calls in one transaction.
    function test_multicallBatchesDifferentCalls() public {
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(mgr.proposeTax, (IManagedSlot(address(slot)), 500));
        calls[1] = abi.encodeCall(
            mgr.proposeModule,
            (IManagedSlot(address(slot)), ModuleTerms({target: address(0), settings: bytes32(0)}))
        );
        vm.prank(admin);
        mgr.multicall(calls);
        assertTrue(slot.hasTax());
        assertTrue(slot.hasModule());
    }

    /// @notice Each call in a batch still passes its own role check.
    function test_multicallKeepsEveryRoleCheck() public {
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(mgr.proposeTax, (IManagedSlot(address(slot)), 500));
        calls[1] = abi.encodeCall(
            mgr.proposeModule,
            (IManagedSlot(address(slot)), ModuleTerms({target: address(0), settings: bytes32(0)}))
        );
        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();
        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.multicall(calls);
        assertFalse(slot.hasTax(), "the batch reverted as a whole");
    }

    function test_inheritedUpdateSplitIsUnreachableDirectly() public {
        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(admin);
        mgr.updateSplit(_split());
    }

    function test_pauseIsSplitManagerGated() public {
        bytes32 splitRole = mgr.SPLIT_MANAGER_ROLE();

        vm.prank(stranger);
        vm.expectRevert(_unauthorized(stranger, splitRole));
        mgr.setPaused(true);

        vm.prank(splitMgr);
        mgr.setPaused(true);
        assertTrue(mgr.paused());
    }

    // ── receiving native tax ─────────────────────────────────────────────────

    /// @dev `Slot._payOrCredit` sends native tax with `call{gas: 30_000}`. If
    ///      this fails the tax silently becomes a credit needing a manual claim.
    function test_acceptsNativeWithinSlotsGasCap() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(mgr).call{value: 1 ether, gas: 30_000}("");
        assertTrue(ok);
        assertEq(address(mgr).balance, 1 ether);
    }

    function test_distributesNativeOverTheSplit() public {
        vm.deal(address(mgr), 1 ether);

        mgr.distribute(_split(), mgr.NATIVE_TOKEN(), address(this));

        // PushSplit leaves 1 wei behind as a gas optimisation.
        assertEq(payeeA.balance, 0.6 ether - 1);
        assertEq(payeeB.balance, 0.4 ether - 1);
    }

    // ── sealed ERC-1271 ──────────────────────────────────────────────────────

    /// @dev Inherited `getSigner()` returns `owner` == address(this), which would
    ///      make `SignatureChecker` recurse into this contract until out of gas.
    ///      Capped low so runaway recursion would fail the assert, not the test.
    function test_isValidSignatureReturnsFalseWithoutRecursing() public view {
        bytes4 result = mgr.isValidSignature{gas: 100_000}(keccak256("x"), hex"1234");
        assertEq(result, bytes4(0xffffffff));
    }

    // ── initializer guards ───────────────────────────────────────────────────

    function test_rejectsZeroAdmin() public {
        SlotCollective.InitialRoles memory r = _roles();
        r.admin = address(0);
        vm.expectRevert(SlotGovernance.AdminRequired.selector);
        factory.createCollective(_split(), r);
    }

    function test_rejectsSplitThatCouldNeverDistribute() public {
        SplitV2Lib.Split memory bad = _split();
        bad.allocations[0] = 0;
        bad.allocations[1] = 0;
        bad.totalAllocation = 0;

        vm.expectRevert(SlotCollective.EmptySplit.selector);
        factory.createCollective(bad, _roles());
    }

    function test_rejectsEmptyRecipients() public {
        SplitV2Lib.Split memory bad = SplitV2Lib.Split({
            recipients: new address[](0),
            allocations: new uint256[](0),
            totalAllocation: 0,
            distributionIncentive: 0
        });

        vm.expectRevert(SlotCollective.EmptySplit.selector);
        factory.createCollective(bad, _roles());
    }

    receive() external payable {}
}
