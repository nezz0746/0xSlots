// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotModule, SlotContext, Scopes} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";

interface IFlippable { function flip() external; }

/// @dev 2 decimals, like GUSD — small units make truncation reachable.
contract Small is ERC20 {
    constructor() ERC20("S", "S") {}
    function decimals() public pure override returns (uint8) { return 2; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev Answers honestly until flipped, then stops answering.
contract FlipModule is AskModule {
    bool public broken;
    function flip() external { broken = true; }
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal view override returns (Ask memory o) {
        Scopes memory f;
        if (broken) revert("gone");
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev Honest until flipped, then answers with one word, where `fee` needs
///      two: returndata too short to decode.
///
///      Not a revert — a SUCCESS the compiler's decoder then rejects. The
///      decode sits outside `try`'s catch, which is why the read is raw.
contract ShortAnswerModule is AskModule {
    bool public broken;
    function flip() external { broken = true; }
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal view override returns (Ask memory o) {
        Scopes memory f;
        if (broken) assembly { mstore(0, 1) return(0, 32) } // 1 word, 256 wanted
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev Honest until flipped, then answers with eight all-ones words: scope
///      bits the slot does not know, which solc's decoder would reject outside
///      the catch.
contract DirtyBoolModule is AskModule {
    bool public broken;
    function flip() external { broken = true; }
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal view override returns (Ask memory o) {
        Scopes memory f;
        if (broken) {
            assembly {
                for { let i := 0 } lt(i, 8) { i := add(i, 1) } {
                    mstore(mul(i, 0x20), not(0))
                }
                return(0, 256)
            }
        }
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev Honest until flipped, then refuses every configuration. The one failure
///      mode `try` did catch — kept so the rewrite cannot silently lose it.
contract RejectingModule is AskModule {
    error No();
    bool public broken;
    function flip() external { broken = true; }

    function checkSettings(bytes calldata) external view {
        if (broken) revert No();
    }
    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev Counts the `after` callbacks it receives. The leaf of a nested tree.
contract Counter is AskModule {
    uint256 public buys;
    function checkSettings(bytes calldata) external pure {}
    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.afterBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external { buys++; }
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


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

/// @dev `transfer` moves the funds AND answers with a word that is neither 0
///      nor 1: paid, and must not be credited on top.
contract MovingWeirdTok is ERC20 {
    constructor() ERC20("M", "M") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function transfer(address to, uint256 a) public override returns (bool) {
        super.transfer(to, a);
        assembly { mstore(0, 2) return(0, 32) }
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
    uint256 constant TAX_RATE = 200;      // 2%/month

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
            currency: IERC20(currency),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(minDep)}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
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

    // ── 2. a hostile queued module must stop nothing ─────────────────────────

    /// @notice An eviction lands no terms, so a queued module cannot reach it at
    ///         all — and the buy that does land it is not blocked either.
    function test_APendingModuleReachesNeitherLiquidationNorABuy() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        FlipModule h = new FlipModule();
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), ModuleTerms({target: address(h), settings: ""}), uint16(8));

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent());
        h.flip(); // the queued module stops answering

        s.liquidate(); // must not revert
        assertTrue(s.isVacant(), "evicted despite a hostile pending module");
        assertEq(s.module(), address(0), "nothing was attached on the way out");
        assertTrue(s.hasRipeTerms(), "and the queued change is still standing");

        vm.startPrank(grinder);
        token.approve(address(s), type(uint256).max);
        s.buy(grinder, PRICE, s.minDepositForBuy(PRICE), 0); // must not revert
        vm.stopPrank();
        assertEq(s.module(), address(0), "the unreadable module was dropped, not attached");
    }

    /// @dev Shared body: seat an occupant, queue `pending`, break it, and let
    ///      the next buyer land it. Every one of these queued modules breaks the
    ///      slot in a way `try` could not catch, so the assertion is simply
    ///      that `buy` returns — a module nobody can read is attached as nothing
    ///      rather than left barring the door.
    function _buyThroughAPendingModule(address pending, bool etchAway) internal {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        // Queued while it still answers honestly — `proposeTerms` is fail-CLOSED
        // and would refuse it otherwise. The break happens afterwards, which is
        // the whole point: the apply path cannot re-verify what it accepted.
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), ModuleTerms({target: pending, settings: ""}), uint16(8));
        if (etchAway) vm.etch(pending, "");
        else IFlippable(pending).flip();

        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        token.mint(grinder, 1_000_000);
        vm.startPrank(grinder);
        token.approve(address(s), type(uint256).max);
        uint256 dep = s.minDepositForBuy(PRICE);
        s.buy(grinder, PRICE, dep, 0); // must not revert
        vm.stopPrank();

        assertEq(s.occupant(), grinder, "the buy went through");
        assertEq(s.module(), address(0), "and the module was dropped, not attached");
        assertEq(s.moduleTerms().settings, bytes(""), "its configuration went with it");
    }

    /// @notice A queued module with NO CODE cannot block a buy.
    ///
    /// @dev The `extcodesize` guard solc emits for a function returning nothing
    ///      sits BEFORE the call and outside `try`'s catch, so this reverted
    ///      straight through it. Reachable on Base today: a 7702-delegated EOA
    ///      whose delegation is revoked between `proposeTerms` and the apply.
    function test_ACodelessPendingModuleCannotBlockABuy() public {
        _buyThroughAPendingModule(address(new FlipModule()), true);
    }

    /// @notice A queued module whose answer is too short to decode cannot block
    ///         an eviction. The decode is outside the catch too.
    function test_AShortModuleAnswerCannotBlockABuy() public {
        _buyThroughAPendingModule(address(new ShortAnswerModule()), false);
    }

    /// @notice Nor one whose bools are neither 0 nor 1.
    function test_ADirtyModuleAnswerCannotBlockABuy() public {
        _buyThroughAPendingModule(address(new DirtyBoolModule()), false);
    }

    /// @notice Nor one that refuses its own configuration at apply time.
    /// @dev The one failure mode `try` DID catch. Kept so the rewrite to raw
    ///      staticcalls cannot silently lose it.
    function test_AModuleRejectingItsConfigurationCannotBlockABuy() public {
        _buyThroughAPendingModule(address(new RejectingModule()), false);
    }


    function test_AWeirdTokenReturnCannotBlockABuy() public {
        WeirdTok w = new WeirdTok(recipient);
        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(w)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(0)}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
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
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(10_000), minRunwaySeconds: 0}), ModuleTerms({target: address(0), settings: ""}), uint16(1));

        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        assertEq(s.taxRateBps(), TAX_RATE, "not applied before it ripened");
        assertFalse(s.hasRipeTerms());

        vm.warp(block.timestamp + 1 days + 1);
        assertTrue(s.hasRipeTerms(), "and it does apply once it has");
    }



    // ── 6. the offer book must survive a hostile posting ───────────────────

    function test_AnOverflowingOfferCannotBrickTheBoard() public {
        Slot s = _slot(address(token), 0);
        vm.startPrank(occ);
        token.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 5_000, 0);
        vm.stopPrank();

        OfferBook book = new OfferBook();
        vm.prank(address(0xBAD));
        book.offer(
            address(s),
            type(uint256).max,
            1,
            uint64(block.timestamp + 3650 days)
        );

        // All read paths must still answer.
        book.best(address(s));
        book.liveCount(address(s));
        book.board(address(s));
        assertEq(book.liveCount(address(s)), 0, "and it is not live");
    }

    /// @notice A token that pays and answers `2` is paid once, never also
    ///         credited — a credit on top would pay twice, out of escrow.
    function test_APayingTokenWithAnOddAnswerIsNotCreditedTwice() public {
        MovingWeirdTok w = new MovingWeirdTok();
        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(w)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(0)}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
        }))));
        w.mint(occ, 1_000_000);
        vm.startPrank(occ);
        w.approve(address(s), type(uint256).max);
        s.buy(occ, PRICE, 100, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        s.liquidate();
        assertEq(s.withdrawableOf(recipient), 0, "paid, so not credited");
        assertGt(w.balanceOf(recipient), 0, "and the recipient holds it");
    }

}
