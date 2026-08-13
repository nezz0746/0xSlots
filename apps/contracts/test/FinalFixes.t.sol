// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams, SlotInfo} from "../src/interfaces/ISlot.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";

contract FFMockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { _mint(msg.sender, 1_000_000 ether); }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Vetoes every buy. Used to prove that an unauthenticated `initializeV3`
///      would let anyone permanently end forced sale on a live slot.
contract FFDenyAllPolicy is IOccupancyPolicy {
    error Denied();
    function checkBuy(OccupancyContext calldata) external pure { revert Denied(); }
    function checkPriceUpdate(OccupancyContext calldata) external pure { revert Denied(); }
    function name() external pure returns (string memory) { return "DenyAll"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @dev USDC-shaped: transfers TO a blocked address revert. This repo already
///      ships a USDC deploy script, so this is a live-token behaviour, not a
///      hypothetical.
contract FFBlocklistERC20 is ERC20 {
    mapping(address => bool) public blocked;
    error Blocklisted(address account);

    constructor() ERC20("Block", "BLK") { _mint(msg.sender, 1_000_000 ether); }

    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setBlocked(address who, bool v) external { blocked[who] = v; }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[to]) revert Blocklisted(to);
        super._update(from, to, value);
    }
}

/// @notice Regression tests for the whole-branch security review findings.
contract FinalFixesTest is Test {
    SlotFactory factory;
    FFMockERC20 token;

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new FFMockERC20();
        token.mint(alice, 10_000 ether);
        token.mint(bob, 10_000 ether);
        vm.warp(1_000_000);
    }

    function _init() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,
            utility: address(0),
            liquidationBountyBps: 500,
            minDepositSeconds: 0,
            occupancyPolicy: address(0)
        });
    }

    function _slot() internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _init()
        ));
    }

    /// @dev Forge a pre-v4 slot. `createSlotV3` rejects a non-zero epoch now,
    ///      so the only way to reach that state is to write it directly. Slot
    ///      15 packs `occupancyPolicy` (offset 0) with `epochSeconds`
    ///      (offset 20); layout verified against the live Base Sepolia
    ///      bytecode. See NoEpochs.t.sol.
    function _epochSlot(uint64 epoch) internal returns (Slot s) {
        s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _init()));
        vm.store(
            address(s),
            bytes32(uint256(15)),
            bytes32((uint256(epoch) << 160) | uint256(uint160(s.occupancyPolicy())))
        );
        assertEq(s.epochSeconds(), epoch, "fixture: epochSeconds not written");
    }

    function _buy(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // A slot's founding terms are set once, by the factory, at creation
    // ═══════════════════════════════════════════════════════════

    /// @dev This replaces a family of tests covering a capture vector that no
    ///      longer exists. `factory` used to be set by a separate,
    ///      unauthenticated call, so a slot that had not made that call yet
    ///      could be claimed by anyone — who could then install a deny-all
    ///      policy through the factory gate and permanently end forced sale.
    ///
    ///      `initialize` now sets recipient, terms, policy and factory in the
    ///      proxy constructor, and it is the ONLY initializer. There is no
    ///      moment at which a slot exists half-configured, and no second
    ///      entry point to reach.
    function test_Initialize_IsTheOnlyInitializerAndRunsOnce() public {
        Slot s = _slot();

        assertEq(s.factory(), address(factory), "factory set at creation");

        // No second bite: OZ's initializer has already consumed version 1.
        vm.prank(attacker);
        vm.expectRevert();
        s.initialize(
            attacker,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _init(),
            attacker
        );

        assertEq(s.factory(), address(factory), "factory unchanged");
        assertEq(s.recipient(), recipient, "recipient unchanged");
    }

    /// @dev A policy is part of a slot's founding terms. An immutable slot
    ///      cannot be given one afterwards by anyone — not the attacker, not
    ///      the admin, not the factory — because no path exists to do it.
    function test_Policy_CannotBeInstalledRetroactively() public {
        Slot s = _slot(); // created with no policy, mutableUtility false
        FFDenyAllPolicy deny = new FFDenyAllPolicy();

        // No manager exists on an immutable slot, so `onlyManager` refuses
        // everyone — there is simply nobody who could install one.
        vm.prank(attacker);
        vm.expectRevert(NotManager.selector);
        s.proposePolicyUpdate(address(deny));

        assertEq(s.manager(), address(0), "no manager to authorise one");
        assertEq(s.occupancyPolicy(), address(0), "still policy-free");
        _buy(s, alice, 10 ether, 100 ether);
        assertEq(s.occupant(), alice, "forced sale intact");
    }

    /// @dev A slot whose creator chose mutability CAN gain one, through the
    ///      manager-gated path. That is the difference the flag buys.
    function test_Policy_CanBeProposedWhenMutable() public {
        FFDenyAllPolicy p = new FFDenyAllPolicy();
        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: true, manager: address(this)}),
            _init()
        ));

        s.proposePolicyUpdate(address(p));
        (address pending, bool has) = s.pendingPolicyUpdate();
        assertEq(pending, address(p));
        assertTrue(has);
    }

    /// @dev The two flags gate different promises and must not be one flag.
    ///      A slot may reasonably want a swappable ad module on occupancy terms
    ///      that are fixed forever — the common case, and the one that was
    ///      inexpressible while `proposePolicyUpdate` read `mutableUtility`.
    function test_MutableModule_DoesNotImplyMutablePolicy() public {
        FFDenyAllPolicy p = new FFDenyAllPolicy();
        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: true, mutablePolicy: false, manager: address(this)}),
            _init()
        ));

        // The module may move...
        s.proposeUtilityUpdate(address(0));

        // ...but the occupancy terms may not.
        vm.expectRevert(PolicyNotMutable.selector);
        s.proposePolicyUpdate(address(p));
        assertEq(s.occupancyPolicy(), address(0));
    }

    /// @dev And the reverse: fixed utility, negotiable occupancy.
    function test_MutablePolicy_DoesNotImplyMutableModule() public {
        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: true, manager: address(this)}),
            _init()
        ));

        vm.expectRevert(ModuleNotMutable.selector);
        s.proposeUtilityUpdate(address(0));
    }

    /// @dev `getSlotInfo` must report a slot's whole current state. It used to
    ///      omit `mutablePolicy` — the flag deciding whether occupancy terms can
    ///      change — while advertising `epochSeconds`, which nothing reads.
    function test_GetSlotInfo_ReportsMutabilityAndOmitsDeadState() public {
        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: true, manager: address(this)}),
            _init()
        ));

        SlotInfo memory info = s.getSlotInfo();
        assertTrue(info.mutablePolicy, "occupancy mutability must be reported");
        assertFalse(info.mutableUtility);
        assertFalse(info.mutableTax);
        assertEq(info.lastSettled, block.timestamp, "settlement clock reported");

        // And it stays truthful once occupied.
        _buy(s, alice, 10 ether, 100 ether);
        vm.warp(block.timestamp + 1 days);
        SlotInfo memory live = s.getSlotInfo();
        assertEq(live.occupant, alice);
        assertGt(live.taxOwed, 0);
        assertEq(live.lastSettled, live.occupiedSince, "unsettled since the buy");
    }

    /// @dev A policy passed at creation lands immediately — no second call, no
    ///      side-channel event for indexers, because `SlotDeployed` already
    ///      carries the whole init tuple.
    function test_Policy_SetAtCreation() public {
        FFDenyAllPolicy p = new FFDenyAllPolicy();
        SlotInitParams memory init = _init();
        init.occupancyPolicy = address(p);

        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            init
        ));

        assertEq(s.occupancyPolicy(), address(p));
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(FFDenyAllPolicy.Denied.selector);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // FINDING 2 — liquidate()/topUp() must gate on occupant(), not _occupant
    // ═══════════════════════════════════════════════════════════

    /// @dev Same window, the `topUp` half: anyone must be able to fund an
    ///      occupancy that has matured but not yet been written to storage.
    function test_TopUp_ResolvesMaturedTransfer() public {
        Slot s = _epochSlot(3600);

        vm.warp(3600);
        _buy(s, alice, 0, 100 ether);
        vm.warp(2 * uint256(3600) + 1);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        s.topUp(5 ether); // would revert NotOccupant against raw _occupant
        vm.stopPrank();

        assertEq(s.occupant(), alice);
        assertFalse(s.isInsolvent(), "funded, so no longer insolvent");
        assertGe(s.deposit(), 4 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // FINDING 3 — a blocked refund recipient must not brick the slot
    // ═══════════════════════════════════════════════════════════

    FFBlocklistERC20 blk;

    /// @dev Epoch written directly — see `_epochSlot`.
    function _blockSlot(uint64 epoch) internal returns (Slot s) {
        blk = new FFBlocklistERC20();
        blk.mint(alice, 10_000 ether);
        blk.mint(bob, 10_000 ether);
        s = Slot(factory.createSlot(
            recipient,
            IERC20(address(blk)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _init()));
        if (epoch != 0) {
            vm.store(
                address(s),
                bytes32(uint256(15)),
                bytes32((uint256(epoch) << 160) | uint256(uint160(s.occupancyPolicy())))
            );
        }
    }

    function _buyBlk(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        blk.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    /// @dev The escalation this branch introduced: `_materialize` pays the
    ///      outgoing occupant, and it runs inside `_settle()`, which is the
    ///      first statement of every mutating entry point. Before this branch
    ///      only `buy()` was exposed to a reverting refund; afterwards a
    ///      blocked outgoing occupant made `buy`, `release`, `selfAssess`,
    ///      `topUp`, `withdraw`, `liquidate` AND `collect` revert permanently —
    ///      locking the outgoing deposit, the incoming buyer's escrow and all
    ///      accrued tax with no way out.
    function test_BlockedOutgoingOccupant_DoesNotBrickSlot() public {
        Slot s = _blockSlot(0);

        // Alice occupies for real.
        vm.warp(3600);
        _buyBlk(s, alice, 100 ether, 100 ether);
        assertEq(s.occupant(), alice);

        // Alice is blocklisted before she is bought out, so the refund `buy()`
        // owes her cannot be pushed. Exercised on the immediate path, which is
        // the only transfer path there is now — and the one that matters, since
        // it runs on every buy rather than only at a boundary.
        blk.setBlocked(alice, true);
        vm.warp(2 * uint256(3600) + 1);

        // The buy must succeed and the slot must stay fully usable.
        _buyBlk(s, bob, 100 ether, 100 ether);
        assertEq(s.occupant(), bob, "buy landed despite the blocked refund");

        uint256 credited = s.withdrawableOf(alice);
        assertGt(credited, 100 ether, "alice's deposit + bob's price credited, not lost");

        // Every entry point still works.
        vm.prank(bob);
        s.selfAssess(150 ether);
        assertEq(s.price(), 150 ether);

        vm.startPrank(alice);
        blk.approve(address(s), type(uint256).max);
        s.topUp(1 ether);
        vm.stopPrank();

        vm.prank(bob);
        s.withdraw(1);

        vm.prank(bob);
        s.release();
        assertEq(s.occupant(), address(0), "slot released cleanly");

        // Alice was never able to claim while blocked...
        vm.expectRevert(
            abi.encodeWithSelector(FFBlocklistERC20.Blocklisted.selector, alice)
        );
        s.claim(alice);

        // ...and is made whole the moment she is unblocked.
        blk.setBlocked(alice, false);
        uint256 before = blk.balanceOf(alice);
        s.claim(alice); // permissionless caller, funds go to alice
        assertEq(blk.balanceOf(alice), before + credited, "blocked party paid in full");
        assertEq(s.withdrawableOf(alice), 0);

        vm.expectRevert(NothingToClaim.selector);
        s.claim(alice);
    }

    /// @dev Non-epoch path: a blocked outgoing occupant must not be able to
    ///      veto their own forced sale by being unpayable.
    function test_BlockedOutgoingOccupant_ImmediateBuyStillSucceeds() public {
        Slot s = _blockSlot(0);

        _buyBlk(s, alice, 100 ether, 100 ether);
        blk.setBlocked(alice, true);

        _buyBlk(s, bob, 100 ether, 120 ether);
        assertEq(s.occupant(), bob, "forced sale completed");
        assertGt(s.withdrawableOf(alice), 0, "alice credited rather than paid");
    }

    /// @dev The happy path must be unchanged — a well-behaved token still
    ///      pushes atomically and nothing lands in `withdrawableOf`.
    function test_UnblockedRefund_StillPushedAtomically() public {
        Slot s = _epochSlot(3600);

        vm.warp(3600);
        _buy(s, alice, 100 ether, 100 ether);
        vm.warp(2 * uint256(3600) + 1);
        s.collect();

        uint256 aliceBefore = token.balanceOf(alice);
        _buy(s, bob, 100 ether, 100 ether);
        vm.warp(3 * uint256(3600) + 1);
        s.collect();

        assertGt(token.balanceOf(alice), aliceBefore + 100 ether - 1 ether, "pushed, not credited");
        assertEq(s.withdrawableOf(alice), 0, "nothing left pending");
    }

    // ═══════════════════════════════════════════════════════════
    // A blocked RECIPIENT must not brick the slot either
    // ═══════════════════════════════════════════════════════════

    /// @dev The counterpart to the finding above, on the other side of the
    ///      ledger. `recipient` is chosen freely at creation and never
    ///      validated beyond being non-zero, so pointing it at a contract that
    ///      reverts on receipt — or letting a blocklisting currency freeze it —
    ///      used to break every path that flushes tax. `collect` and
    ///      `liquidate` reverted permanently, and because `release` flushes tax
    ///      too, the occupant could not even leave voluntarily: a slot its
    ///      creator could turn into a trap.
    ///
    ///      Liquidation being unconditional is this protocol's first
    ///      invariant, so the tax legs credit rather than push.
    function test_BlockedRecipient_DoesNotBrickLiquidation() public {
        Slot s = _blockSlot(0);
        _buyBlk(s, alice, 1 ether, 1000 ether);

        // Burn the deposit down to nothing, then block the recipient.
        vm.warp(block.timestamp + 400 days);
        blk.setBlocked(recipient, true);
        assertTrue(s.isInsolvent(), "fixture: occupant must be insolvent");
        assertGt(s.taxOwed(), 0, "fixture: there must be tax to flush");

        // Liquidation succeeds despite the recipient being unpayable.
        vm.prank(bob);
        s.liquidate();
        assertEq(s.occupant(), address(0), "insolvent occupant must be removable");

        // The recipient is not robbed — the tax is waiting for them.
        uint256 owedToRecipient = s.withdrawableOf(recipient);
        assertGt(owedToRecipient, 0, "tax must be credited, not lost");

        // ...and reaches them once they can receive again.
        blk.setBlocked(recipient, false);
        s.claim(recipient);
        assertEq(blk.balanceOf(recipient), owedToRecipient, "credit is claimable");
        assertEq(s.withdrawableOf(recipient), 0, "credit cleared once paid");
    }

    /// @dev The same trap reached through the voluntary exit. `release` flushes
    ///      collected tax before refunding, so a blocked recipient stopped an
    ///      occupant leaving a slot they wanted no part of.
    function test_BlockedRecipient_DoesNotTrapOccupantInRelease() public {
        Slot s = _blockSlot(0);
        _buyBlk(s, alice, 100 ether, 1000 ether);

        vm.warp(block.timestamp + 10 days);
        blk.setBlocked(recipient, true);

        vm.prank(alice);
        s.release();
        assertEq(s.occupant(), address(0), "occupant must be able to leave");
        assertGt(s.withdrawableOf(recipient), 0, "tax credited to the recipient");
    }
}
