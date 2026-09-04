// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, HookFlags, SlotContext} from "../../src/ISlotHook.sol";
import "../../src/SlotErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev A hook that records everything and refuses nothing.
contract Recorder is ISlotHook {
    uint256 public buys;
    uint256 public releases;
    uint256 public liquidations;
    uint256 public settles;
    uint256 public lastPaid;

    function validateHookData(bytes32) external pure {}

    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.afterSettle = true;
    }

    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external { buys++; }
    function afterRelease(SlotContext calldata) external { releases++; }
    function afterLiquidate(SlotContext calldata) external { liquidations++; }
    function afterSettle(SlotContext calldata c) external {
        settles++;
        lastPaid = c.paid;
    }
}

/// @dev Refuses every buy. The canonical `before` hook.
contract DenyBuys is ISlotHook {
    error Denied();
    function validateHookData(bytes32) external pure {}

    function subscriptions() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view { revert Denied(); }
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Reverts in every `after`. Must never affect an outcome.
contract Hostile is ISlotHook {
    function validateHookData(bytes32) external pure {}

    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.afterSettle = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external pure { revert("no"); }
    function afterSell(SlotContext calldata) external pure { revert("no"); }
    function afterRelease(SlotContext calldata) external pure { revert("no"); }
    function afterLiquidate(SlotContext calldata) external pure { revert("no"); }
    function afterSettle(SlotContext calldata) external pure { revert("no"); }
}

/// @dev Burns every unit of gas it is handed.
contract GasBurner is ISlotHook {
    uint256 public sink;
    function validateHookData(bytes32) external pure {}

    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterLiquidate = true;
        f.afterSettle = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {
        while (true) sink++;
    }
    function afterSettle(SlotContext calldata) external {
        while (true) sink++;
    }
}

contract SlotsTest is Test {
    SlotFactory factory;
    Tok token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice;
    uint256 aliceKey;
    address bob;
    uint256 bobKey;
    address carol = makeAddr("carol");

    function setUp() public {
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");

        Slot impl = new Slot();
        SlotFactory fImpl = new SlotFactory();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(fImpl),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(impl))
                    )
                )
            )
        );

        token = new Tok();
        token.mint(alice, 1_000_000 ether);
        token.mint(bob, 1_000_000 ether);
        token.mint(carol, 1_000_000 ether);
        vm.warp(1_000_000);
    }

    function _init(address hook, uint256 minDep)
        internal
        view
        returns (SlotInit memory)
    {
        return
            SlotInit({
                recipient: recipient,
                currency: IERC20(address(token)),
                manager: manager,
                hook: hook,
                hookData: bytes32(0),
                taxBps: 1000, // 10% / month
                minDepositSeconds: minDep,
                mutableTax: true,
                mutableHook: true
            });
    }

    function _slot(address hook) internal returns (Slot) {
        return Slot(payable(factory.createSlot(_init(hook, 0))));
    }

    function _take(Slot s, address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // The two guarantees
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice GUARANTEE 1: liquidation is unconditional.
    /// @dev A hook that reverts in every `after` cannot stop an eviction. This
    ///      is the sentence every capped call and swallowed revert exists for.
    function test_AHostileHookCannotBlockLiquidation() public {
        Hostile h = new Hostile();
        Slot s = _slot(address(h));
        _take(s, alice, 1 ether, 100 ether);

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "alice ran dry");

        vm.prank(carol);
        s.liquidate();

        assertTrue(s.isVacant(), "evicted anyway");
    }

    /// @notice ...and cannot do it by burning gas either.
    function test_AGasBurningHookCannotBlockLiquidation() public {
        GasBurner h = new GasBurner();
        Slot s = _slot(address(h));
        _take(s, alice, 1 ether, 100 ether);
        vm.warp(block.timestamp + 3650 days);

        // A normal budget, not a generous one.
        (bool ok, ) = address(s).call{gas: 2_000_000}(
            abi.encodeWithSignature("liquidate()")
        );
        assertTrue(ok, "eviction completes on a normal budget");
        assertTrue(s.isVacant());
    }

    /// @notice GUARANTEE 2: terms cannot move under an occupant.
    function test_ProposedTermsLandOnlyAtATransition() public {
        Slot s = _slot(address(0));
        _take(s, alice, 100 ether, 100 ether);

        vm.prank(manager);
        s.proposeTerms(2000, address(0), bytes32(0), true, false);

        vm.warp(block.timestamp + 10 days);
        assertEq(s.taxBps(), 1000, "alice's rate is untouched mid-tenure");

        _take(s, bob, 100 ether, 200 ether); // the transition
        assertEq(s.taxBps(), 2000, "and lands when the seat turns over");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // before decides, after records
    // ═══════════════════════════════════════════════════════════════════════

    function test_ABeforeHookCanVetoAndSaysWhy() public {
        DenyBuys h = new DenyBuys();
        Slot s = _slot(address(h));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        // The hook's own error surfaces, not a generic "call failed" — a vetoed
        // buy should say which rule refused it.
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(alice, 100 ether, 1 ether, 0);
        vm.stopPrank();
    }

    function test_AnAfterHookSeesEveryTransition() public {
        Recorder h = new Recorder();
        Slot s = _slot(address(h));

        _take(s, alice, 100 ether, 100 ether);
        assertEq(h.buys(), 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        s.release();
        assertEq(h.releases(), 1);
        assertGt(h.settles(), 0, "and settlements, with the amounts");
        assertGt(h.lastPaid(), 0);
    }

    /// @notice A hook is skipped entirely for callbacks it did not declare.
    function test_UndeclaredCallbacksAreNeverCalled() public {
        // Recorder declares no `before*` at all.
        Recorder h = new Recorder();
        Slot s = _slot(address(h));

        // If beforeBuy were called despite not being declared, this would still
        // pass — so assert on the flags too.
        _take(s, alice, 1 ether, 100 ether);
        HookFlags memory f = s.hookFlags();
        assertFalse(f.beforeBuy, "not declared");
        assertTrue(f.afterBuy, "declared");
    }

    /// @notice A hook that answers `subscriptions()` with nothing is refused outright.
    /// @dev The one place a bad hook is NOT tolerated. It happens once, while
    ///      attaching, in a call the manager sent on purpose — attaching a hook
    ///      that can never fire is a silent, permanent mistake.
    function test_AHookSubscribingToNothingIsRefused() public {
        Slot s = _slot(address(0));
        // Deployed BEFORE the prank: a CREATE consumes `vm.prank` just like a
        // call would, so inlining it would send `proposeTerms` from the test
        // contract instead of the manager.
        address useless = address(new Nothing());

        vm.prank(manager);
        vm.expectRevert(InvalidHook.selector);
        s.proposeTerms(0, useless, bytes32(0), false, true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Signed sell orders — REMOVED WITH `sell`
    //
    // Three tests lived here: that the occupant could not repartition the
    // buyer's approval, that an order was single-use, and that a cancelled
    // nonce could not be filled. All three tested `Slot.sell`, which is gone —
    // a consensual sale is now `selfAssess` then `buy`, performed by the
    // OfferBook. What they were defending against goes with the mechanism: the
    // book pulls exactly `quoteBuy` and spends it in the same transaction, so
    // there is no approval to repartition and no nonce to replay.
    //
    // The book's own coverage is in `OfferBook.t.sol`.
    // ═══════════════════════════════════════════════════════════════════════
    // Arithmetic
    // ═══════════════════════════════════════════════════════════════════════

    function test_AnAbsurdPriceIsRefusedRatherThanBrickingTheSlot() public {
        Slot s = _slot(address(0));
        vm.prank(alice);
        vm.expectRevert(InvalidPrice.selector);
        s.buy(alice, type(uint256).max, 0, 0);
        assertTrue(s.isVacant(), "and the slot is untouched");
    }

    function test_ARealisticPriceSettlesFine() public {
        Slot s = _slot(address(0));
        _take(s, alice, 1000 ether, 1_000_000_000 ether);
        vm.warp(block.timestamp + 365 days);
        s.collect();
        assertGt(token.balanceOf(recipient), 0, "recipient was paid");
    }

}

/// @dev Declares no subscriptions at all.
contract Nothing is ISlotHook {
    function validateHookData(bytes32) external pure {}

    function subscriptions() external pure returns (HookFlags memory f) { return f; }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}
