// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInfo} from "../../src/SlotViews.sol";
import {ISlotHook, HookFlags, SlotContext} from "../../src/ISlotHook.sol";

contract TT is ERC20 { constructor() ERC20("T","T"){} function mint(address t,uint256 a) external {_mint(t,a);} }

/// @dev Base for the fixtures: `strict` is a constructor argument so the same
///      behaviour can be tested under both modes without duplicating a hook.
abstract contract Modal is ISlotHook {
    bool internal immutable _strict;
    constructor(bool strict_) { _strict = strict_; }
    function validateHookData(bytes32) external pure {}
    function beforeBuy(SlotContext calldata) external view virtual {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Reverts in every `after`.
contract FailingAfter is Modal {
    error Nope();
    constructor(bool s) Modal(s) {}
    function subscriptions() external view returns (HookFlags memory f) {
        f.afterBuy = true; f.afterRelease = true; f.afterLiquidate = true;
        f.strict = _strict;
    }
    function afterBuy(SlotContext calldata) external pure { revert Nope(); }
    function afterRelease(SlotContext calldata) external pure { revert Nope(); }
    function afterLiquidate(SlotContext calldata) external pure { revert Nope(); }
}

/// @dev Accepts a buy, refuses an eviction.
contract BlocksEviction is Modal {
    error Stuck();
    constructor(bool s) Modal(s) {}
    function subscriptions() external view returns (HookFlags memory f) {
        f.afterBuy = true; f.afterLiquidate = true; f.strict = _strict;
    }
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external pure { revert Stuck(); }
}

/// @dev Writes 40 fresh storage slots in `afterBuy` — ~800k, past HOOK_GAS.
contract HungryAfter is Modal {
    mapping(uint256 => uint256) public junk;
    uint256 public runs;
    constructor(bool s) Modal(s) {}
    function subscriptions() external view returns (HookFlags memory f) {
        f.afterBuy = true; f.strict = _strict;
    }
    function afterBuy(SlotContext calldata) external {
        for (uint256 i; i < 40; ++i) junk[runs * 1000 + i] = i + 1;
        ++runs;
    }
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
}

contract StrictHooksTest is Test {
    SlotFactory factory; TT token;
    address alice = makeAddr("alice"); address bob = makeAddr("bob");

    function setUp() public {
        Slot impl = new Slot(); SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));
        token = new TT(); token.mint(alice,1e24); token.mint(bob,1e24);
        vm.warp(1_000_000);
    }

    function _slot(address hook) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: address(this), currency: IERC20(address(token)),
            manager: address(0), hook: hook, hookData: bytes32(0),
            taxBps: 1000, minDepositSeconds: 0,
            mutableTax: false, mutableHook: false
        }))));
    }

    function _buy(Slot s, address who, uint256 price, uint256 dep) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ── lenient: the default, and rule 1 holds ──────────────────────────────

    function test_ALenientHooksFailureIsSwallowed() public {
        Slot s = _slot(address(new FailingAfter(false)));
        _buy(s, alice, 1 ether, 1 ether);
        assertEq(s.occupant(), alice, "the buy stands");
    }

    function test_ALenientHookCannotBlockAnEviction() public {
        Slot s = _slot(address(new BlocksEviction(false)));
        _buy(s, alice, 100 ether, 1);
        vm.warp(block.timestamp + 365 days);
        assertTrue(s.isInsolvent(), "fixture");
        s.liquidate();
        assertTrue(s.isVacant(), "rule 1");
    }

    // ── strict: declared by the hook, and it means it ───────────────────────

    function test_AStrictHooksFailureRevertsTheBuy() public {
        Slot s = _slot(address(new FailingAfter(true)));
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(FailingAfter.Nope.selector);
        s.buy(alice, 1 ether, 1 ether, 0);
        vm.stopPrank();
        assertTrue(s.isVacant(), "nothing happened");
    }

    /// @notice A strict hook can block its slot's eviction. Stated, not found.
    /// @dev The whole cost of the flag. Rule 1 holds for every hook that did
    ///      not ask for this; a slot attaching one that did is only as evictable
    ///      as that hook. Snapshotted at attach and readable from
    ///      `SlotInfo.hookFlags`, so it is a fact about the slot, not a
    ///      surprise inside it.
    function test_AStrictHookCanBlockItsSlotsEviction() public {
        Slot s = _slot(address(new BlocksEviction(true)));
        _buy(s, alice, 100 ether, 1);
        vm.warp(block.timestamp + 365 days);
        assertTrue(s.isInsolvent(), "fixture: the escrow is spent");

        vm.expectRevert(BlocksEviction.Stuck.selector);
        s.liquidate();
        assertEq(s.occupant(), alice, "insolvent, and immovable");
    }

    /// @notice Strict removes the stipend, which is what it is FOR.
    /// @dev The ERC-721 mirror case. 40 cold SSTOREs is ~800k, past HOOK_GAS's
    ///      500k — so lenient drops the write silently and strict lands it.
    function test_StrictGivesTheAfterHookMoreThanTheStipend() public {
        HungryAfter lenient = new HungryAfter(false);
        _buy(_slot(address(lenient)), alice, 1 ether, 1 ether);
        assertEq(lenient.runs(), 0, "starved by the stipend, and swallowed");

        HungryAfter strict = new HungryAfter(true);
        _buy(_slot(address(strict)), alice, 1 ether, 1 ether);
        assertEq(strict.runs(), 1, "uncapped: the write lands");
    }

    // ── the declaration itself ──────────────────────────────────────────────

    function test_TheFlagIsSnapshottedAndPublished() public {
        Slot s = _slot(address(new FailingAfter(true)));
        SlotInfo memory i = s.getSlotInfo();
        assertTrue(i.hookFlags.strict, "a buyer can read it before committing");
        assertTrue(i.hookFlags.afterBuy, "and the callbacks alongside it");

        SlotInfo memory j = _slot(address(new FailingAfter(false))).getSlotInfo();
        assertFalse(j.hookFlags.strict, "default is off");
    }

    /// @notice A hook that flips its answer later cannot change a live slot.
    /// @dev `strict` is one more bit in the snapshotted byte, so it obeys the
    ///      same rule as every other: the slot honours what it read at attach.
    function test_TheSnapshotBeatsALaterChangeOfMind() public {
        Flipper h = new Flipper();
        Slot s = _slot(address(h));
        assertFalse(s.getSlotInfo().hookFlags.strict, "attached lenient");

        h.flip();
        assertTrue(h.subscriptions().strict, "the hook now claims strict");

        // Still swallowed: the slot obeys its snapshot, not the live answer.
        _buy(s, alice, 1 ether, 1 ether);
        assertEq(s.occupant(), alice, "a later claim cannot bind this slot");
    }
}

/// @dev Lenient until flipped, then claims strict.
contract Flipper is ISlotHook {
    error Nope();
    bool public flipped;
    function flip() external { flipped = true; }
    function validateHookData(bytes32) external pure {}
    function subscriptions() external view returns (HookFlags memory f) {
        f.afterBuy = true; f.strict = flipped;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external view { revert Nope(); }
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}
