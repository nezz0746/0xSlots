// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, HookFlags, SlotContext} from "../../src/ISlotHook.sol";
import "../../src/SlotErrors.sol";

/// @dev Records the configuration it is handed, on every side.
contract Spy is ISlotHook {
    bytes32 public lastBefore;
    bytes32 public lastAfter;
    uint256 public afterCalls;

    function validateHookData(bytes32) external pure virtual {}

    function subscriptions() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
    }

    function beforeBuy(SlotContext calldata) external view virtual {}

    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata c) external {
        lastAfter = c.hookData;
        afterCalls++;
    }

    function afterSell(SlotContext calldata) external {}

    function afterRelease(SlotContext calldata c) external {
        lastAfter = c.hookData;
        afterCalls++;
    }

    function afterLiquidate(SlotContext calldata c) external {
        lastAfter = c.hookData;
        afterCalls++;
    }

    function afterSettle(SlotContext calldata) external {}
}

/// @dev Reports what the DECISION side was handed. `before` is a staticcall
///      and cannot write, so the only way out is the revert reason.
contract Loud is Spy {
    error SawConfiguration(bytes32 data);

    function beforeBuy(SlotContext calldata c) external view override {
        revert SawConfiguration(c.hookData);
    }
}

/// @dev Accepts one configuration and no other.
contract Picky is Spy {
    bytes32 public constant ONLY = bytes32("only-this");

    error WrongConfiguration();

    function validateHookData(bytes32 data) external pure override {
        if (data != ONLY) revert WrongConfiguration();
    }
}

/**
 * @notice `hookData` is the slot's storage, handed to the hook on every
 *         callback. These are the plumbing guarantees the hooks rely on.
 */
contract HookDataTest is Test {
    SlotFactory factory;
    Spy spy;

    bytes32 constant CONFIG = bytes32("seven-days");
    bytes32 constant OTHER = bytes32("thirty-days");

    address alice = makeAddr("alice");

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        spy = new Spy();
        vm.deal(alice, 100 ether);
    }

    function _slot(address hook, bytes32 data) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(0)),
            manager: address(this),
            hook: hook,
            hookData: data,
            taxBps: 500,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
    }

    function _take(Slot s, address who) internal {
        uint256 need = s.minDepositForBuy(1 ether);
        vm.prank(who);
        s.buy{value: s.quoteBuy(who, need)}(who, 1 ether, need, type(uint256).max);
    }

    // ─── it arrives, verbatim ───────────────────────────────────────────────

    function test_TheSlotStoresItAndHandsItToTheHook() public {
        Slot s = _slot(address(spy), CONFIG);
        assertEq(s.hookData(), CONFIG);

        _take(s, alice);
        assertEq(spy.lastAfter(), CONFIG, "verbatim, on the after side");
    }

    /// @dev The `before` side is a staticcall, so it proves what it saw by
    ///      refusing with it.
    function test_TheDecisionSideSeesItToo() public {
        Slot s = _slot(address(new Loud()), CONFIG);
        uint256 need = s.minDepositForBuy(1 ether);
        // Hoisted: `quoteBuy` is itself a call, and evaluating it inside the
        // value expression would consume the prank and the expectRevert.
        uint256 pay = s.quoteBuy(alice, need);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Loud.SawConfiguration.selector, CONFIG)
        );
        s.buy{value: pay}(alice, 1 ether, need, type(uint256).max);
    }

    /// @notice Two slots, one hook, two configurations — neither leaking into
    ///         the other. The reason a hook can be stateless.
    function test_TwoSlotsShareAHookAndKeepTheirOwnConfiguration() public {
        Slot a = _slot(address(spy), CONFIG);
        Slot b = _slot(address(spy), OTHER);

        _take(a, alice);
        assertEq(spy.lastAfter(), CONFIG);
        _take(b, alice);
        assertEq(spy.lastAfter(), OTHER);
        assertEq(a.hookData(), CONFIG, "unmoved by b's buy");
    }

    // ─── it cannot exist without a hook ─────────────────────────────────────

    function test_ConfigurationWithoutAHookIsRefusedAtCreation() public {
        vm.expectRevert(InvalidHook.selector);
        _slot(address(0), CONFIG);
    }

    function test_ConfigurationWithoutAHookIsRefusedAtProposal() public {
        Slot s = _slot(address(0), bytes32(0));
        vm.expectRevert(InvalidHook.selector);
        s.proposeTerms(0, address(0), CONFIG, false, true);
    }

    /// @notice Detaching takes the configuration with it. Left behind, it would
    ///         become live again the day a hook is attached without its own.
    function test_DetachingTheHookClearsTheConfiguration() public {
        Slot s = _slot(address(spy), CONFIG);
        s.proposeTerms(0, address(0), bytes32(0), false, true);
        vm.warp(block.timestamp + 1 days + 1);

        _take(s, alice); // a transition, which is where terms land
        assertEq(s.hook(), address(0));
        assertEq(s.hookData(), bytes32(0));
    }

    // ─── a hook judges its own configuration ────────────────────────────────

    function test_AHookThatRejectsTheConfigurationIsRefused() public {
        Picky picky = new Picky();
        vm.expectRevert(Picky.WrongConfiguration.selector);
        _slot(address(picky), CONFIG);

        Slot ok = _slot(address(picky), picky.ONLY());
        assertEq(ok.hookData(), picky.ONLY());
    }

    function test_TheSameJudgementAppliesToAProposal() public {
        Slot s = _slot(address(0), bytes32(0));
        Picky picky = new Picky();

        vm.expectRevert(Picky.WrongConfiguration.selector);
        s.proposeTerms(0, address(picky), CONFIG, false, true);

        s.proposeTerms(0, address(picky), picky.ONLY(), false, true);
        (, , , , , bytes32 pendingData) = s.pending();
        assertEq(pendingData, picky.ONLY());
    }

    /// @notice Cancelling clears the queued configuration along with the hook.
    function test_CancellingClearsTheQueuedConfiguration() public {
        Slot s = _slot(address(0), bytes32(0));
        s.proposeTerms(0, address(spy), CONFIG, false, true);
        s.cancelTerms(false, true);

        (, address hook, , , , bytes32 pendingData) = s.pending();
        assertEq(hook, address(0));
        assertEq(pendingData, bytes32(0));
    }

    // ─── a swap does not rewrite history ────────────────────────────────────

    /**
     * @notice The outgoing hook's end-of-tenure callback carries the
     *         configuration IT was attached with, not its successor's.
     *
     * @dev The counterpart to the cached `outgoing` address. Terms land at the
     *      transition, so by the time `afterRelease` goes out the slot's
     *      `hookData` is already the new one — and a context built from storage
     *      would tell the departing hook it had been running under a
     *      configuration it never saw, on the one callback that closes its
     *      books.
     */
    function test_TheOutgoingHookIsToldItsOwnConfiguration() public {
        Slot s = _slot(address(spy), CONFIG);
        _take(s, alice);

        Spy successor = new Spy();
        s.proposeTerms(0, address(successor), OTHER, false, true);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(alice);
        s.release();

        assertEq(s.hook(), address(successor), "the swap happened");
        assertEq(s.hookData(), OTHER);
        assertEq(spy.lastAfter(), CONFIG, "and the departing hook kept its own");
        assertEq(successor.afterCalls(), 0, "it never saw this tenure");
    }
}
