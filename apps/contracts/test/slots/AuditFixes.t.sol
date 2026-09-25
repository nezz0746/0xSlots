// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotConstants} from "../../src/slot/SlotConstants.sol";

import {AskModule, Ask} from "../utils/AskModule.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";
import {ISlotModule, SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {QuoteAboveOffer} from "../../src/periphery/book/OfferBookErrors.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/errors/SlotErrors.sol";

/// @dev A module whose scopes and fee its author can rewrite between a
///      proposal and the day it lands.
contract FlipModule is AskModule {
    uint16 public scopeBits = ScopesLib.AFTER_SETTLE;
    uint16 public bps;
    address public to;

    function set(uint16 bps_, address to_) external {
        bps = bps_;
        to = to_;
    }

    function setScopes(uint16 scopes_) external {
        scopeBits = scopes_;
    }

    function _ask(bytes calldata) internal view override returns (Ask memory) {
        return Ask(scopeBits, bps, to);
    }

    function validateSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onInstall(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}
}

/// @dev Manager and recipient of its own slot — the shape a `SlotCollective`
///      takes — which re-enters `proposeTerms` when the slot pays it.
contract ReenteringManager {
    Slot public slot;
    bool public fired;

    function point(Slot s) external {
        slot = s;
    }

    receive() external payable {
        if (address(slot) == address(0)) return;
        TaxTerms memory t =
            TaxTerms({recipient: address(this), rateBps: 10_000, minRunwaySeconds: 0});
        ModuleTerms memory none;
        // Lands terms inside somebody else's buy if the guard is missing.
        try slot.proposeTerms(t, none, 1) {
            fired = true;
        } catch {}
    }
}

/// @notice The critical findings of the 2026-09-22 review, each as the trace
///         that used to work.
contract AuditFixesTest is Test, SlotConstants {
    SlotFactory factory;
    address manager = makeAddr("manager");
    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address author = makeAddr("author");

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        vm.warp(1_000_000);
    }

    function _slot(
        address manager_,
        address recipient_,
        uint16 rateBps,
        uint32 minRunway,
        bool mutableRecipient,
        ModuleTerms memory module
    ) internal returns (Slot) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: manager_,
                        mutableTax: true,
                        mutableRecipient: mutableRecipient,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: recipient_, rateBps: rateBps, minRunwaySeconds: minRunway
                        }),
                        moduleTerms: module
                    })
                ))
        );
    }

    function _noModule() internal pure returns (ModuleTerms memory) {
        return ModuleTerms({module: address(0), settings: ""});
    }

    // ── 1. a queued module cannot change its scopes or fee after review ────

    function test_AModuleThatMovesItsScopesOrFeeAfterReviewIsDropped() public {
        FlipModule m = new FlipModule();
        Slot s = _slot(manager, recipient, 500, 0, true, _noModule());

        // Reviewed charging nothing.
        vm.prank(manager);
        s.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0}),
            ModuleTerms({module: address(m), settings: ""}),
            8 // TERM_MODULE
        );

        // Rewritten while the proposal ripens: all of the rent, to its author,
        // and `afterCallbacksMustSucceed` on top.
        m.set(10_000, author);
        m.setScopes(ScopesLib.AFTER_SETTLE | ScopesLib.AFTER_CALLBACKS_MUST_SUCCEED);
        skip(TERMS_DELAY);
        s.applyTerms();

        assertEq(s.module(), address(0), "the module is dropped, not installed");
        assertEq(s.fee().bps, 0, "and its fee never lands");
        assertFalse(s.scopes().afterCallbacksMustSucceed, "nor the eviction veto it gave itself");
    }

    function test_AModuleThatKeepsItsScopesAndFeeStillAttaches() public {
        FlipModule m = new FlipModule();
        m.set(1_000, author);
        Slot s = _slot(manager, recipient, 500, 0, true, _noModule());

        vm.prank(manager);
        s.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0}),
            ModuleTerms({module: address(m), settings: ""}),
            8
        );
        skip(TERMS_DELAY);
        s.applyTerms();

        assertEq(s.module(), address(m), "an honest module is unaffected");
        assertEq(s.fee().bps, 1_000);
    }

    // ── 9. a fee is the recipient's business ────────────────────────────────

    function test_AFeeBearingModuleNeedsAMovableRecipient() public {
        FlipModule m = new FlipModule();
        m.set(10_000, author);
        Slot s = _slot(manager, recipient, 500, 0, false, _noModule());

        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        s.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0}),
            ModuleTerms({module: address(m), settings: ""}),
            8
        );

        // The whole fee is legal where the recipient was never promised fixed.
        Slot open = _slot(manager, recipient, 500, 0, true, _noModule());
        vm.prank(manager);
        open.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0}),
            ModuleTerms({module: address(m), settings: ""}),
            8
        );
        skip(TERMS_DELAY);
        open.applyTerms();
        assertEq(open.fee().bps, 10_000, "100% is a choice, not a bug");
    }

    function test_AFeeRiseCannotBeAcceptedOnAFixedRecipientSlot() public {
        FlipModule m = new FlipModule();
        Slot s = _slot(
            manager, recipient, 500, 0, false, ModuleTerms({module: address(m), settings: ""})
        );

        m.set(2_000, author);
        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        s.acceptFee(ModuleFee(2_000, author));
    }

    // ── 3. terms cannot land inside somebody else's buy ─────────────────────

    function test_APayoutCannotBeUsedToLandTermsWithNoDelay() public {
        ReenteringManager rm = new ReenteringManager();
        Slot s = _slot(address(rm), address(rm), 500, 0, true, _noModule());
        rm.point(s);

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        s.buy{value: 1 ether}(alice, 1 ether, 1 ether, 1 ether);

        skip(10 days);

        // The payout to the recipient re-enters `proposeTerms`.
        vm.deal(bob, 10 ether);
        vm.prank(bob);
        s.buy{value: 2 ether}(bob, 1 ether, 1 ether, 2 ether);

        assertFalse(rm.fired(), "the re-entrant proposal is refused");
        assertEq(s.taxRateBps(), 500, "so the rate bob bought under still holds");
        assertEq(s.pending().mask, 0, "and nothing was queued behind him");
    }

    // ── 4. an open window is never re-priced ───────────────────────────────

    function test_RaisingThePriceDoesNotBillThePastAtTheNewOne() public {
        Slot s = _slot(manager, recipient, 1, 0, true, _noModule());

        // A dust price accrues nothing at all: accrual floors to zero.
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        s.buy{value: 1 ether}(alice, 1, 1 ether, 1 ether);

        skip(30 days);
        assertEq(s.taxOwed(), 0, "a month at 1 wei is worth no tax");

        vm.prank(alice);
        s.selfAssess(1 ether);

        assertEq(s.taxOwed(), 0, "and the month is not re-billed at the new price");

        // From here the new price is charged, as it should be.
        skip(30 days);
        assertGt(s.taxOwed(), 0, "the new price accrues from now on");
        assertLt(s.taxOwed(), 1 ether, "one month's worth, not two");
    }
}

/// @dev A contract that answers every question the book asks a slot, and quotes
///      the bidder's whole allowance when it is time to be paid.
contract CounterfeitSlot {
    address public immutable attacker;
    address public immutable token;
    uint256 public quote;

    constructor(address attacker_, address token_, uint256 quote_) {
        attacker = attacker_;
        token = token_;
        quote = quote_;
    }

    function occupant() external view returns (address) {
        return attacker;
    }

    function price() external pure returns (uint256) {
        return 0;
    }

    function deposit() external pure returns (uint256) {
        return 0;
    }

    function currency() external view returns (address) {
        return token;
    }

    function taxOwed() external pure returns (uint256) {
        return 0;
    }

    function debtOf(address) external pure returns (uint256) {
        return 0;
    }

    function quoteBuy(address, uint256) external view returns (uint256) {
        return quote;
    }

    function minDepositToHold(uint256) external pure returns (uint256) {
        return 0;
    }

    function minDepositForBuy(uint256) external pure returns (uint256) {
        return 0;
    }

    function isOperator(address) external pure returns (bool) {
        return true;
    }

    function selfAssess(uint256) external {}

    function buy(address, uint256, uint256, uint256) external payable {
        // Spends the allowance the book just granted, then answers the fill
        // assertion with the bidder it never seated.
        IERC20(token).transferFrom(msg.sender, attacker, quote);
    }
}

/// @notice Finding 10: the book may never pull more than the offer it is filling.
contract OfferBookCeilingTest is Test, SlotConstants {
    TestToken token;
    OfferBook book;
    address bidder = makeAddr("bidder");
    address attacker = makeAddr("attacker");

    function setUp() public {
        token = new TestToken();
        book = new OfferBook();
        token.mint(bidder, 1_000_000e6);
    }

    function test_AQuoteAboveTheOfferIsRefused() public {
        CounterfeitSlot fake = new CounterfeitSlot(
            attacker,
            address(token),
            500_000e6 // far above the bid: the bidder's standing allowance
        );

        vm.startPrank(bidder);
        token.approve(address(book), type(uint256).max);
        uint256 id = book.offer(address(fake), 100e6, 5e6, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(QuoteAboveOffer.selector, 500_000e6, 105e6));
        book.acceptOffer(address(fake), id, 0);

        assertEq(token.balanceOf(bidder), 1_000_000e6, "the bidder keeps their funds");
        assertEq(token.balanceOf(attacker), 0);
    }
}

contract TestToken is ERC20 {
    constructor() ERC20("T", "T") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
