// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, SlotContext, HookFlags} from "../../src/ISlotHook.sol";
import {CompositeHook} from "../../src/hooks/CompositeHook.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";

interface IFlippable { function flip() external; }

/// @dev 2 decimals, like GUSD — small units make truncation reachable.
contract Small is ERC20 {
    constructor() ERC20("S", "S") {}
    function decimals() public pure override returns (uint8) { return 2; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev Answers honestly until flipped, then stops answering.
contract FlipHook is ISlotHook {
    bool public broken;
    function flip() external { broken = true; }
    function validateHookData(bytes32) external pure {}

    function subscriptions() external view returns (HookFlags memory f) {
        if (broken) revert("gone");
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Honest until flipped, then answers `subscriptions()` with returndata too short
///      to decode.
///
///      Not a revert — a SUCCESS the compiler's decoder then rejects. The
///      decode sits outside `try`'s catch, so this used to revert
///      `_applyPending` from inside `liquidate()`.
contract ShortAnswerHook is ISlotHook {
    bool public broken;
    function flip() external { broken = true; }
    function validateHookData(bytes32) external pure {}

    function subscriptions() external view returns (HookFlags memory f) {
        if (broken) assembly { mstore(0, 1) return(0, 32) } // 1 word, 256 wanted
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Honest until flipped, then answers with eight words that are none of
///      them 0 or 1 — `validator_revert_t_bool` in the decoder, outside the catch.
contract DirtyBoolHook is ISlotHook {
    bool public broken;
    function flip() external { broken = true; }
    function validateHookData(bytes32) external pure {}

    function subscriptions() external view returns (HookFlags memory f) {
        if (broken) {
            assembly {
                for { let i := 0 } lt(i, 8) { i := add(i, 1) } {
                    mstore(mul(i, 0x20), 0xff)
                }
                return(0, 256)
            }
        }
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Honest until flipped, then refuses every configuration. The one failure
///      mode `try` did catch — kept so the rewrite cannot silently lose it.
contract RejectingHook is ISlotHook {
    error No();
    bool public broken;
    function flip() external { broken = true; }

    function validateHookData(bytes32) external view {
        if (broken) revert No();
    }
    function subscriptions() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev Counts the `after` callbacks it receives. The leaf of a nested tree.
contract Counter is ISlotHook {
    uint256 public buys;
    function validateHookData(bytes32) external pure {}
    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external { buys++; }
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev `transfer` succeeds but answers with a word that is neither 0 nor 1.
contract WeirdTok is ERC20 {
    address public trap;
    constructor(address t) ERC20("W", "W") { trap = t; }
    function mint(address to, uint256 a) external { _mint(to, a); }
    function transfer(address to, uint256 a) public override returns (bool) {
        if (to == trap) {
            assembly { mstore(0, 2) return(0, 32) }
        }
        return super.transfer(to, a);
    }
}

/**
 * @notice One test per audit finding, each written from the PoC that broke it.
 *         These are the regressions; if one fails the defect is back.
 */
contract AuditRegressionsTest is Test {
    SlotFactory factory;
    Small token;
    address occ = address(0xA11CE);
    address grinder = address(0x6009);
    address recipient = address(0xF00D);

    uint256 constant PRICE = 50_000; // 500.00 at 2dp
    uint256 constant TAX = 200;      // 2%/month

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Small();
        token.mint(occ, 10_000_000);
        token.mint(grinder, 10_000_000);
    }

    function _slot(address currency, uint256 minDep) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(currency),
            manager: address(this),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: TAX,
            minDepositSeconds: minDep,
            mutableTax: true,
            mutableHook: true
        }))));
    }

    // ── 1. tax evasion by grinding the settle clock ────────────────────────

    function test_GrindingTheSettleClockNoLongerEvadesTax() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        // Time is tracked in a local rather than re-read from
        // `block.timestamp` each iteration: solc caches TIMESTAMP within a
        // frame, so `vm.warp(block.timestamp + step)` in a loop warps to the
        // SAME instant every time and the grind silently never happens.
        uint256 step = 2_400; // inside the zero-accrual window
        uint256 t = block.timestamp;
        for (uint256 i; i < 1_080; ++i) {
            t += step;
            vm.warp(t);
            vm.prank(grinder);
            s.topUp(0);
        }

        // The clock now advances only over time actually paid for, so the
        // unpaid remainder stays owed instead of being destroyed.
        emit log_named_uint("grinding calls", 1_080);
        emit log_named_uint("collected", s.collectedTax());
        emit log_named_uint("still owed", s.taxOwed());
        assertGt(
            s.collectedTax() + s.taxOwed(),
            0,
            "a month of tax must survive being ground at"
        );
    }

    // ── 2. liquidation must be unconditional ───────────────────────────────

    function test_APendingHookCannotBlockLiquidation() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        FlipHook h = new FlipHook();
        s.proposeTerms(0, address(h), bytes32(0), false, true);

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent());
        h.flip(); // the queued hook stops answering

        s.liquidate(); // must not revert
        assertTrue(s.isVacant(), "evicted despite a hostile pending hook");
        assertEq(s.hook(), address(0), "and the hook was dropped, not attached");
    }

    /// @dev Shared body: seat an occupant, queue `pending`, run them dry, evict.
    ///      Every one of these queued hooks breaks the slot in a way `try`
    ///      could not catch, so the assertion is simply that `liquidate`
    ///      returns.
    function _evictWithPendingHook(address pending, bool etchAway) internal {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        // Queued while it still answers honestly — `proposeTerms` is fail-CLOSED
        // and would refuse it otherwise. The break happens afterwards, which is
        // the whole point: the apply path cannot re-verify what it accepted.
        s.proposeTerms(0, pending, bytes32(0), false, true);
        if (etchAway) vm.etch(pending, "");
        else IFlippable(pending).flip();

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent());

        s.liquidate(); // must not revert
        assertTrue(s.isVacant(), "eviction blocked by a pending hook");
        assertEq(s.hook(), address(0), "and the hook was dropped, not attached");
        assertEq(s.hookData(), bytes32(0), "its configuration went with it");
    }

    /// @notice A queued hook with NO CODE cannot block an eviction.
    ///
    /// @dev The `extcodesize` guard solc emits for a function returning nothing
    ///      sits BEFORE the call and outside `try`'s catch, so this reverted
    ///      straight through it. Reachable on Base today: a 7702-delegated EOA
    ///      whose delegation is revoked between `proposeTerms` and the apply.
    function test_ACodelessPendingHookCannotBlockLiquidation() public {
        _evictWithPendingHook(address(new FlipHook()), true);
    }

    /// @notice A queued hook whose answer is too short to decode cannot block
    ///         an eviction. The decode is outside the catch too.
    function test_AShortHookAnswerCannotBlockLiquidation() public {
        _evictWithPendingHook(address(new ShortAnswerHook()), false);
    }

    /// @notice Nor one whose bools are neither 0 nor 1.
    function test_ADirtyHookAnswerCannotBlockLiquidation() public {
        _evictWithPendingHook(address(new DirtyBoolHook()), false);
    }

    /// @notice Nor one that refuses its own configuration at apply time.
    /// @dev The one failure mode `try` DID catch. Kept so the rewrite to raw
    ///      staticcalls cannot silently lose it.
    function test_AHookRejectingItsConfigurationCannotBlockLiquidation() public {
        _evictWithPendingHook(address(new RejectingHook()), false);
    }

    /**
     * @notice A composite inside a composite still delivers `after` callbacks.
     *
     * @dev The stipend was the constant `CHILD_GAS = HOOK_GAS / MAX_CHILDREN`,
     *      so an inner composite — entered with one child's share rather than
     *      the slot's full stipend — met `gasleft() < CHILD_GAS + GAS_FLOOR` on
     *      its first iteration and returned. Arithmetic, not a margin: its
     *      whole subtree got nothing, on every transition, and because the
     *      inner call SUCCEEDED nothing emitted `HookCallFailed`.
     *
     *      Mutation-checked: restoring the constant fails this.
     */
    function test_ANestedCompositeStillReachesItsChildren() public {
        Counter leaf = new Counter();
        HookFlags memory f;
        f.afterBuy = true;

        address[] memory inner = new address[](1);
        inner[0] = address(leaf);
        CompositeHook mid = new CompositeHook(address(this), inner, f, "");

        address[] memory outer = new address[](1);
        outer[0] = address(mid);
        CompositeHook root = new CompositeHook(address(this), outer, f, "");

        Slot s = _slot(address(token), 0);
        s.proposeTerms(0, address(root), bytes32(0), false, true);
        vm.warp(block.timestamp + 2 days);

        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0); // the transition that applies the hook
        vm.stopPrank();
        assertEq(s.hook(), address(root), "the tree is attached");
        // The transition that attaches a hook also notifies it, so count from
        // here rather than from zero.
        uint256 before = leaf.buys();

        vm.startPrank(grinder);
        token.approve(address(s), type(uint256).max);
        s.buy(grinder, PRICE, 100, type(uint256).max);
        vm.stopPrank();

        assertEq(
            leaf.buys(),
            before + 1,
            "two composites deep, and the leaf still ran"
        );
    }

    function test_AWeirdTokenReturnCannotBlockLiquidation() public {
        WeirdTok w = new WeirdTok(recipient);
        Slot s = Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(address(w)),
            manager: address(this),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: TAX,
            minDepositSeconds: 0,
            mutableTax: true,
            mutableHook: true
        }))));
        w.mint(occ, 1_000_000);
        vm.startPrank(occ);
        w.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        s.liquidate(); // must not revert on the odd return word
        assertTrue(s.isVacant());
        assertGt(s.withdrawableOf(recipient), 0, "credited instead");
    }

    // ── 3. the runway view must not claim "never" ──────────────────────────

    function test_SecondsUntilLiquidationIsFiniteForSmallPositions() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, 100, 1_000, 0); // price x tax well under MONTH*BASIS_POINTS
        vm.stopPrank();

        uint256 runway = s.secondsUntilLiquidation();
        assertLt(runway, type(uint256).max, "must not claim never");
        vm.warp(block.timestamp + runway + 1);
        assertTrue(s.isInsolvent(), "and the answer must be true");
    }

    // ── 4. terms may not land on the buyer who is already in flight ────────

    function test_QueuedTermsCannotBindTheNextBlocksBuyer() public {
        Slot s = _slot(address(token), 0);
        s.proposeTerms(10_000, address(0), bytes32(0), true, false);

        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        assertEq(s.taxBps(), TAX, "not applied before it ripened");
        assertFalse(s.hasRipeTerms());

        vm.warp(block.timestamp + 1 days + 1);
        assertTrue(s.hasRipeTerms(), "and it does apply once it has");
    }

    // ── 5. composite children ──────────────────────────────────────────────

    function test_ACodelessChildIsRefused() public {
        address[] memory kids = new address[](1);
        kids[0] = address(0xDEAD00); // never deployed
        HookFlags memory f;
        f.beforeBuy = true;
        vm.expectRevert(CompositeHook.ChildHasNoCode.selector);
        new CompositeHook(address(this), kids, f, "");
    }

    function test_TheChildStipendFitsTheBudget() public {
        address[] memory none = new address[](0);
        HookFlags memory f;
        f.afterBuy = true;
        CompositeHook c = new CompositeHook(address(this), none, f, "");
        assertLe(
            c.CHILD_GAS() * c.MAX_CHILDREN(),
            500_000,
            "a full board must fit the stipend the slot forwards"
        );
    }

    // ── 6. the offer book must survive a hostile posting ───────────────────

    function test_AnOverflowingOfferCannotBrickTheBoard() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        OfferBook book = OfferBook(address(new ERC1967Proxy(address(new OfferBook()), abi.encodeCall(OfferBook.initialize, (address(this))))));
        vm.prank(address(0xBAD));
        book.offer(
            address(s),
            type(uint256).max,
            1,
            uint64(block.timestamp + 3650 days),
            0,
            hex"00"
        );

        // All read paths must still answer.
        book.best(address(s));
        book.liveCount(address(s));
        book.board(address(s));
        book.bestOrder(address(s));
        assertEq(book.liveCount(address(s)), 0, "and it is not live");
    }

    function test_AnUnsignedOfferIsNotLive() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        OfferBook book = OfferBook(address(new ERC1967Proxy(address(new OfferBook()), abi.encodeCall(OfferBook.initialize, (address(this))))));
        address faker = address(0xFA4E);
        token.mint(faker, 10_000_000);
        vm.startPrank(faker);
        token.approve(address(s), type(uint256).max);
        book.offer(
            address(s),
            1_000_000,
            500,
            uint64(block.timestamp + 30 days),
            0,
            hex"deadbeef"
        );
        vm.stopPrank();

        assertEq(book.liveCount(address(s)), 0, "a garbage signature is not a bid");
        (bool found, , ) = book.best(address(s));
        assertFalse(found, "and it cannot mask the real best");
    }
}
