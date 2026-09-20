// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, AppTerms, Manifest} from "../../src/types/SlotTypes.sol";
import {ISlotApp, SlotContext} from "../../src/interfaces/ISlotApp.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

/// @dev Records the slots it is attached to, and can be told to refuse.
contract InstallSpy is ISlotApp {
    error RefusedAttachment();

    bool public immutable strictMode;
    bool public refuse;
    uint256 public attachments;
    address public lastSlot;
    address public lastSender;
    address public lastOccupant;
    address public lastAccount;
    uint256 public lastPrice;
    uint256 public lastDeposit;

    constructor(bool strict_) {
        strictMode = strict_;
    }

    function setRefuse(bool v) external {
        refuse = v;
    }

    function manifest(bytes32) external view returns (Manifest memory o) {
        uint16 p = ScopesLib.ON_INSTALL |
            ScopesLib.ON_UNINSTALL |
            ScopesLib.AFTER_SETTLE;
        o.scopes = strictMode ? p | ScopesLib.STRICT : p;
    }

    function checkSettings(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    uint256 public removals;
    bytes32 public lastRemovedConfig;

    function onUninstall(SlotContext calldata ctx) external {
        if (refuse) revert RefusedAttachment();
        ++removals;
        lastRemovedConfig = ctx.appTerms.settings;
    }

    function onInstall(SlotContext calldata ctx) external {
        if (refuse) revert RefusedAttachment();
        ++attachments;
        lastSlot = ctx.slot;
        lastSender = msg.sender;
        lastOccupant = ctx.occupant;
        lastAccount = ctx.account;
        lastPrice = ctx.currentPrice;
        lastDeposit = ctx.depositAmount;
    }

}

/// @dev Asks for nothing but a harmless callback: never told about attachment.
contract QuietApp is ISlotApp {
    uint256 public attachments;

    function manifest(bytes32) external pure returns (Manifest memory o) {
        o.scopes = ScopesLib.AFTER_SETTLE;
    }

    function checkSettings(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {
        ++attachments;
    }
}

/**
 * An app is told when it becomes a slot's app.
 *
 * The call exists so an app can set up whatever it keeps per slot — a registry
 * entry, an initial state — with `msg.sender` proving which slot it is. It can
 * only ever fire where a seat is taken: at creation, and where a queued app
 * lands. Never on an eviction.
 */
contract AppInstallTest is Test {
    SlotFactory factory;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address manager = makeAddr("manager");
    address recipient = makeAddr("recipient");

    event AppCallFailed(address indexed app, bytes4 selector);

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _slot(address app) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: app, settings: bytes32(0)})
        }))));
    }

    function _buy(Slot s, address who) internal {
        uint256 dep = s.minDepositForBuy(1 ether);
        uint256 owed = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: owed}(who, 1 ether, dep, 0);
    }

    function test_AAppIsToldAtCreation() public {
        InstallSpy spy = new InstallSpy(false);
        Slot s = _slot(address(spy));

        assertEq(spy.attachments(), 1);
        assertEq(spy.lastSlot(), address(s));
        assertEq(spy.lastSender(), address(s), "the slot itself made the call");
    }

    function test_AAppThatDidNotAskIsNotTold() public {
        QuietApp quiet = new QuietApp();
        _slot(address(quiet));
        assertEq(quiet.attachments(), 0);
    }

    function test_AQueuedAppIsToldWhenItLands() public {
        Slot s = _slot(address(0));
        InstallSpy spy = new InstallSpy(false);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(spy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);
        assertEq(spy.attachments(), 0, "not while it is only queued");

        _buy(s, alice);
        assertEq(spy.attachments(), 1, "told by the buy that landed it");
        assertEq(spy.lastSlot(), address(s));
        assertEq(spy.lastOccupant(), alice, "the seat it inherits, not the one it replaced");
        assertEq(spy.lastAccount(), alice);
        assertEq(spy.lastPrice(), 1 ether);
        assertEq(spy.lastDeposit(), s.deposit());
    }

    /// @notice The buyer an app is handed is the incoming one, never the
    ///         occupant it displaced.
    function test_AAppLandingOnABuyoutSeesTheBuyer() public {
        Slot s = _slot(address(0));
        InstallSpy spy = new InstallSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(spy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        _buy(s, bob);
        assertEq(spy.lastOccupant(), bob);
        assertEq(spy.lastAccount(), bob);
        assertEq(s.occupant(), bob);
    }

    function test_AnEvictionNeverAttachesSoItNeverTells() public {
        Slot s = _slot(address(0));
        InstallSpy spy = new InstallSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(spy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + 365 days);
        s.liquidate();

        assertEq(spy.attachments(), 0, "an eviction lands no terms");
        assertEq(s.app(), address(0));
    }

    function test_AStrictAppCanRefuseTheAttachment() public {
        InstallSpy spy = new InstallSpy(true);
        spy.setRefuse(true);

        vm.expectRevert(InstallSpy.RefusedAttachment.selector);
        _slot(address(spy));
    }

    /// @notice An app that is not `strict` cannot fail a creation with it.
    function test_ALenientRefusalIsSwallowed() public {
        InstallSpy spy = new InstallSpy(false);
        spy.setRefuse(true);

        vm.expectEmit(true, false, false, false);
        emit AppCallFailed(address(spy), ISlotApp.onInstall.selector);
        Slot s = _slot(address(spy));

        assertEq(s.app(), address(spy), "attached anyway");
        assertEq(spy.attachments(), 0, "it just did not record it");
    }

    /// @notice The occupant can land a queued app themselves, and it is told.
    function test_ApplyingTermsTellsTheIncomingApp() public {
        Slot s = _slot(address(0));
        InstallSpy spy = new InstallSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(spy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        vm.prank(alice);
        s.applyTerms();
        assertEq(spy.attachments(), 1);
        assertEq(s.app(), address(spy));
        assertEq(spy.lastOccupant(), alice, "handed the sitting occupant");
        assertEq(spy.lastPrice(), 1 ether);
    }

    /// @notice The app being replaced is told, and told before the swap — so
    ///         the terms it is handed are its own.
    function test_TheOutgoingAppIsToldItIsBeingRemoved() public {
        InstallSpy going = new InstallSpy(false);
        bytes32 mine = bytes32(uint256(7));

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: address(going), settings: mine})
        }))));
        assertEq(going.removals(), 0, "not while it is still attached");

        InstallSpy coming = new InstallSpy(false);
        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(coming), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        _buy(s, alice);

        assertEq(going.removals(), 1, "told exactly once");
        assertEq(
            going.lastRemovedConfig(),
            mine,
            "and handed its OWN configuration, not its successor's"
        );
        assertEq(coming.attachments(), 1, "while the incoming app is installed");
        assertEq(s.app(), address(coming));
    }

    /// @notice An app cannot refuse its own removal, even declaring `strict`.
    ///
    /// @dev The one asymmetry with every other callback it asked for. An app
    ///      able to revert here is an app a manager can never replace, and the
    ///      slot would be stuck with it for ever.
    function test_AStrictAppCannotRefuseItsOwnRemoval() public {
        InstallSpy stubborn = new InstallSpy(true);

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: address(stubborn), settings: bytes32(0)})
        }))));

        stubborn.setRefuse(true);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(0), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        vm.expectEmit(true, false, false, false);
        emit AppCallFailed(address(stubborn), ISlotApp.onUninstall.selector);
        _buy(s, alice);

        assertEq(s.app(), address(0), "removed anyway");
        assertEq(stubborn.removals(), 0, "it just did not record it");
    }
}
