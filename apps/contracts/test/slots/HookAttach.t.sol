// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, HookTerms, HookOffer} from "../../src/types/SlotTypes.sol";
import {ISlotHook, SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../../src/libraries/HookPermissionsLib.sol";

/// @dev Records the slots it is attached to, and can be told to refuse.
contract AttachSpy is ISlotHook {
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

    function hookOffer(bytes32) external view returns (HookOffer memory o) {
        uint8 p = HookPermissionsLib.AFTER_ATTACH | HookPermissionsLib.AFTER_SETTLE;
        o.permissions = strictMode ? p | HookPermissionsLib.STRICT : p;
    }

    function validateHookConfig(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata ctx) external {
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
contract QuietHook is ISlotHook {
    uint256 public attachments;

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        o.permissions = HookPermissionsLib.AFTER_SETTLE;
    }

    function validateHookConfig(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function afterAttach(SlotContext calldata) external {
        ++attachments;
    }
}

/**
 * A hook is told when it becomes a slot's hook.
 *
 * The call exists so a hook can set up whatever it keeps per slot — a registry
 * entry, an initial state — with `msg.sender` proving which slot it is. It can
 * only ever fire where a seat is taken: at creation, and where a queued hook
 * lands. Never on an eviction.
 */
contract HookAttachTest is Test {
    SlotFactory factory;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address manager = makeAddr("manager");
    address recipient = makeAddr("recipient");

    event HookCallFailed(address indexed hook, bytes4 selector);

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _slot(address hook) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableHook: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: hook, config: bytes32(0)})
        }))));
    }

    function _buy(Slot s, address who) internal {
        uint256 dep = s.minDepositForBuy(1 ether);
        uint256 owed = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: owed}(who, 1 ether, dep, 0);
    }

    function test_AHookIsToldAtCreation() public {
        AttachSpy spy = new AttachSpy(false);
        Slot s = _slot(address(spy));

        assertEq(spy.attachments(), 1);
        assertEq(spy.lastSlot(), address(s));
        assertEq(spy.lastSender(), address(s), "the slot itself made the call");
    }

    function test_AHookThatDidNotAskIsNotTold() public {
        QuietHook quiet = new QuietHook();
        _slot(address(quiet));
        assertEq(quiet.attachments(), 0);
    }

    function test_AQueuedHookIsToldWhenItLands() public {
        Slot s = _slot(address(0));
        AttachSpy spy = new AttachSpy(false);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(spy), config: bytes32(0)}), 8);
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

    /// @notice The buyer a hook is handed is the incoming one, never the
    ///         occupant it displaced.
    function test_AHookLandingOnABuyoutSeesTheBuyer() public {
        Slot s = _slot(address(0));
        AttachSpy spy = new AttachSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(spy), config: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        _buy(s, bob);
        assertEq(spy.lastOccupant(), bob);
        assertEq(spy.lastAccount(), bob);
        assertEq(s.occupant(), bob);
    }

    function test_AnEvictionNeverAttachesSoItNeverTells() public {
        Slot s = _slot(address(0));
        AttachSpy spy = new AttachSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(spy), config: bytes32(0)}), 8);
        vm.warp(block.timestamp + 365 days);
        s.liquidate();

        assertEq(spy.attachments(), 0, "an eviction lands no terms");
        assertEq(s.hook(), address(0));
    }

    function test_AStrictHookCanRefuseTheAttachment() public {
        AttachSpy spy = new AttachSpy(true);
        spy.setRefuse(true);

        vm.expectRevert(AttachSpy.RefusedAttachment.selector);
        _slot(address(spy));
    }

    /// @notice A hook that is not `strict` cannot fail a creation with it.
    function test_ALenientRefusalIsSwallowed() public {
        AttachSpy spy = new AttachSpy(false);
        spy.setRefuse(true);

        vm.expectEmit(true, false, false, false);
        emit HookCallFailed(address(spy), ISlotHook.afterAttach.selector);
        Slot s = _slot(address(spy));

        assertEq(s.hook(), address(spy), "attached anyway");
        assertEq(spy.attachments(), 0, "it just did not record it");
    }

    /// @notice The occupant can land a queued hook themselves, and it is told.
    function test_ApplyingTermsTellsTheIncomingHook() public {
        Slot s = _slot(address(0));
        AttachSpy spy = new AttachSpy(false);
        _buy(s, alice);

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(spy), config: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        vm.prank(alice);
        s.applyTerms();
        assertEq(spy.attachments(), 1);
        assertEq(s.hook(), address(spy));
        assertEq(spy.lastOccupant(), alice, "handed the sitting occupant");
        assertEq(spy.lastPrice(), 1 ether);
    }
}
