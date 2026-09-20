// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, AppTerms, Manifest, PendingTerms} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotApp, Scopes, SlotContext} from "../../src/interfaces/ISlotApp.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import "../../src/errors/SlotErrors.sol";

/// @dev Records the configuration it is handed, on every side.
contract Spy is ISlotApp {
    bytes32 public lastBefore;
    bytes32 public lastAfter;
    uint256 public afterCalls;

    function checkSettings(bytes32) external pure virtual {}

    function manifest(bytes32) external pure returns (Manifest memory o) {
        Scopes memory f;
        f.beforeBuy = true;
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        o.scopes = ScopesLib.pack(f);
    }

    function beforeBuy(SlotContext calldata) external view virtual {}

    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata c) external {
        lastAfter = c.appTerms.settings;
        afterCalls++;
    }


    function afterRelease(SlotContext calldata c) external {
        lastAfter = c.appTerms.settings;
        afterCalls++;
    }

    function afterLiquidate(SlotContext calldata c) external {
        lastAfter = c.appTerms.settings;
        afterCalls++;
    }

    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev Reports what the DECISION side was handed. `before` is a staticcall
///      and cannot write, so the only way out is the revert reason.
contract Loud is Spy {
    error SawConfiguration(bytes32 data);

    function beforeBuy(SlotContext calldata c) external view override {
        revert SawConfiguration(c.appTerms.settings);
    }
}

/// @dev Accepts one configuration and no other.
contract Picky is Spy {
    bytes32 public constant ONLY = bytes32("only-this");

    error WrongConfiguration();

    function checkSettings(bytes32 data) external pure override {
        if (data != ONLY) revert WrongConfiguration();
    }
}

/**
 * @notice `hookData` is the slot's storage, handed to the app on every
 *         callback. These are the plumbing guarantees the apps rely on.
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

    function _slot(address app, bytes32 data) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: address(0xF00D), rateBps: uint16(500), minRunwaySeconds: uint32(1 hours)}),
            appTerms: AppTerms({target: app, settings: data})
        }))));
    }

    function _take(Slot s, address who) internal {
        uint256 need = s.minDepositForBuy(1 ether);
        vm.prank(who);
        s.buy{value: s.quoteBuy(who, need)}(who, 1 ether, need, type(uint256).max);
    }

    // ─── it arrives, verbatim ───────────────────────────────────────────────

    function test_TheSlotStoresItAndHandsItToTheApp() public {
        Slot s = _slot(address(spy), CONFIG);
        assertEq(s.appTerms().settings, CONFIG);

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

    /// @notice Two slots, one app, two configurations — neither leaking into
    ///         the other. The reason an app can be stateless.
    function test_TwoSlotsShareAAppAndKeepTheirOwnConfiguration() public {
        Slot a = _slot(address(spy), CONFIG);
        Slot b = _slot(address(spy), OTHER);

        _take(a, alice);
        assertEq(spy.lastAfter(), CONFIG);
        _take(b, alice);
        assertEq(spy.lastAfter(), OTHER);
        assertEq(a.appTerms().settings, CONFIG, "unmoved by b's buy");
    }

    // ─── it cannot exist without an app ─────────────────────────────────────

    function test_ConfigurationWithoutAAppIsRefusedAtCreation() public {
        vm.expectRevert(InvalidApp.selector);
        _slot(address(0), CONFIG);
    }

    function test_ConfigurationWithoutAAppIsRefusedAtProposal() public {
        Slot s = _slot(address(0), bytes32(0));
        vm.expectRevert(InvalidApp.selector);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(0), settings: CONFIG}), uint8(8));
    }

    /// @notice Detaching takes the configuration with it. Left behind, it would
    ///         become live again the day an app is attached without its own.
    function test_DetachingTheAppClearsTheConfiguration() public {
        Slot s = _slot(address(spy), CONFIG);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(0), settings: bytes32(0)}), uint8(8));
        vm.warp(block.timestamp + 1 days + 1);

        _take(s, alice); // a transition, which is where terms land
        assertEq(s.app(), address(0));
        assertEq(s.appTerms().settings, bytes32(0));
    }

    // ─── an app judges its own configuration ────────────────────────────────

    function test_AAppThatRejectsTheConfigurationIsRefused() public {
        Picky picky = new Picky();
        vm.expectRevert(Picky.WrongConfiguration.selector);
        _slot(address(picky), CONFIG);

        Slot ok = _slot(address(picky), picky.ONLY());
        assertEq(ok.appTerms().settings, picky.ONLY());
    }

    function test_TheSameJudgementAppliesToAProposal() public {
        Slot s = _slot(address(0), bytes32(0));
        Picky picky = new Picky();

        vm.expectRevert(Picky.WrongConfiguration.selector);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(picky), settings: CONFIG}), uint8(8));

        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(picky), settings: picky.ONLY()}), uint8(8));
        PendingTerms memory __p1 = s.pendingTerms();
        TaxTerms memory __r1 = __p1.taxTerms;
        AppTerms memory __h1 = __p1.appTerms;
        uint8 __m1 = __p1.mask;
        uint64 __at1 = __p1.proposedAt;
        bytes32 pendingData = __h1.settings;
        assertEq(pendingData, picky.ONLY());
    }

    /// @notice Cancelling clears the queued configuration along with the app.
    function test_CancellingClearsTheQueuedConfiguration() public {
        Slot s = _slot(address(0), bytes32(0));
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(spy), settings: CONFIG}), uint8(8));
        s.cancelTerms(uint8(8));

        PendingTerms memory __p2 = s.pendingTerms();
        TaxTerms memory __r2 = __p2.taxTerms;
        AppTerms memory __h2 = __p2.appTerms;
        uint8 __m2 = __p2.mask;
        uint64 __at2 = __p2.proposedAt;
        address app = __h2.target;
        bytes32 pendingData = __h2.settings;
        assertEq(app, address(0));
        assertEq(pendingData, bytes32(0));
    }

    // ─── a swap does not rewrite history ────────────────────────────────────

    /**
     * @notice The outgoing app's end-of-tenure callback carries the
     *         configuration IT was attached with, not its successor's.
     *
     * @dev The counterpart to the cached `outgoing` address. Terms land at the
     *      transition, so by the time `afterRelease` goes out the slot's
     *      `hookData` is already the new one — and a context built from storage
     *      would tell the departing app it had been running under a
     *      configuration it never saw, on the one callback that closes its
     *      books.
     */
    function test_TheOutgoingAppIsToldItsOwnConfiguration() public {
        Slot s = _slot(address(spy), CONFIG);
        _take(s, alice);

        Spy successor = new Spy();
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), AppTerms({target: address(successor), settings: OTHER}), uint8(8));
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(alice);
        s.release();
        s.applyTerms();

        assertEq(s.app(), address(successor), "the swap happened");
        assertEq(s.appTerms().settings, OTHER);
        assertEq(spy.lastAfter(), CONFIG, "and the departing app kept its own");
        assertEq(successor.afterCalls(), 0, "it never saw this tenure");
    }
}
