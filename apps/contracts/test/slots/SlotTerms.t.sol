// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, HookTerms, HookOffer, PendingTerms} from "../../src/types/SlotTypes.sol";
import {ISlotEvents} from "../../src/interfaces/ISlotEvents.sol";
import {ISlotHook, HookPermissions, SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../../src/libraries/HookPermissionsLib.sol";
import "../../src/errors/SlotErrors.sol";

/// @dev Takes no fee, subscribes to one harmless callback.
contract AnyHook is ISlotHook {
    function hookOffer(bytes32) external view virtual returns (HookOffer memory o) {
        o.permissions = HookPermissionsLib.AFTER_SETTLE;
    }

    function validateHookConfig(bytes32) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external virtual {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata) external {}
}

/// @dev An offer its owner can change at any time, and a count of the buys it hears about.
contract OfferHook is AnyHook {
    uint8 public permissions = HookPermissionsLib.AFTER_SETTLE;
    uint16 public bps;
    address public to;
    uint256 public buys;

    constructor(uint16 bps_, address to_) {
        bps = bps_;
        to = to_;
    }

    function set(uint16 bps_, address to_) external {
        bps = bps_;
        to = to_;
    }

    function setPermissions(uint8 flags_) external {
        permissions = flags_;
    }

    function hookOffer(bytes32) external view override returns (HookOffer memory) {
        return HookOffer(permissions, bps, to);
    }

    function afterBuy(SlotContext calldata) external override {
        ++buys;
    }
}

/// @notice Terms queue per mutable term and land at transitions; hooks declare
///         an offer the slot keeps a copy of until its manager accepts another.
contract SlotTermsTest is Test {
    event HookPermissionsDropped(address indexed hook, uint8 permissions);

    uint8 constant TAX_RATE = 1;
    uint8 constant RECIPIENT = 2;
    uint8 constant MIN_RUNWAY = 4;
    uint8 constant HOOK = 8;
    uint8 constant HOOK_PERMISSIONS = 16;
    uint8 constant SETTLE = HookPermissionsLib.AFTER_SETTLE;
    uint8 constant SETTLE_AND_BUY = HookPermissionsLib.AFTER_SETTLE | HookPermissionsLib.AFTER_BUY;

    SlotFactory factory;
    Slot slot;
    address manager = makeAddr("manager");
    address recipient = makeAddr("recipient");
    address next = makeAddr("next");
    address buyer = makeAddr("buyer");
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
        slot = _slot(true, true, true, _noHook());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _noHook() internal pure returns (HookTerms memory) {
        return HookTerms({target: address(0), config: bytes32(0)});
    }

    function _taxTerms() internal view returns (TaxTerms memory) {
        return TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 hours});
    }

    function _init(bool tax, bool rec, bool hook, HookTerms memory h) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(0)),
            manager: (tax || rec || hook) ? manager : address(0),
            mutableTax: tax,
            mutableRecipient: rec,
            mutableHook: hook,
            taxTerms: _taxTerms(),
            hookTerms: h
        });
    }

    function _slot(bool tax, bool rec, bool hook, HookTerms memory h) internal returns (Slot) {
        return Slot(payable(factory.createSlot(_init(tax, rec, hook, h))));
    }

    function _propose(Slot s, TaxTerms memory taxTerms, HookTerms memory hook, uint8 mask) internal {
        vm.prank(manager);
        s.proposeTerms(taxTerms, hook, mask);
    }

    function _buy(Slot s) internal {
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        s.buy{value: 1 ether}(buyer, 1 ether, 1 ether, 1 ether);
    }

    function _release(Slot s) internal {
        vm.prank(buyer);
        s.release();
    }

    /// @dev Exits no longer carry terms: the seat is given up, then whoever
    ///      wants to lands the queue on the empty slot.
    function _releaseAndApply(Slot s) internal {
        _release(s);
        s.applyTerms();
    }

    // ── mutability ──────────────────────────────────────────────────────────

    function test_EachTermMovesOnlyIfMutable() public {
        Slot taxOnly = _slot(true, false, false, _noHook());
        TaxTerms memory taxTerms = TaxTerms({recipient: next, rateBps: 700, minRunwaySeconds: 2 hours});

        _propose(taxOnly, taxTerms, _noHook(), TAX_RATE | MIN_RUNWAY);

        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        taxOnly.proposeTerms(taxTerms, _noHook(), RECIPIENT);

        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        taxOnly.proposeTerms(taxTerms, _noHook(), HOOK);

        Slot recipientOnly = _slot(false, true, false, _noHook());
        _propose(recipientOnly, taxTerms, _noHook(), RECIPIENT);
        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        recipientOnly.proposeTerms(taxTerms, _noHook(), TAX_RATE);
    }

    function test_AManagerIsRequiredExactlyWhenSomethingIsMutable() public {
        SlotInit memory i = _init(true, false, false, _noHook());
        i.manager = address(0);
        vm.expectRevert(InvalidManager.selector);
        factory.createSlot(i);

        SlotInit memory j = _init(false, false, false, _noHook());
        j.manager = manager;
        vm.expectRevert(InvalidManager.selector);
        factory.createSlot(j);
    }

    // ── queueing ────────────────────────────────────────────────────────────

    function test_ProposalQueuesOnlyTheMaskedFields() public {
        TaxTerms memory taxTerms = TaxTerms({recipient: next, rateBps: 900, minRunwaySeconds: 2 days});
        _propose(slot, taxTerms, _noHook(), RECIPIENT);

        assertEq(slot.recipient(), recipient, "nothing moves on proposal");
        PendingTerms memory __p1 = slot.pendingTerms();
        TaxTerms memory queued = __p1.taxTerms;
        uint8 mask = __p1.mask;
        assertEq(mask, RECIPIENT);
        assertEq(queued.recipient, next);
        assertEq(queued.rateBps, 0, "an unmasked field is not queued");
    }

    function test_ProposalsAccumulateAcrossTerms() public {
        _propose(slot, TaxTerms({recipient: address(0), rateBps: 900, minRunwaySeconds: 0}), _noHook(), TAX_RATE);
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noHook(), RECIPIENT);

        PendingTerms memory __p2 = slot.pendingTerms();
        TaxTerms memory queued = __p2.taxTerms;
        uint8 mask = __p2.mask;
        assertEq(mask, TAX_RATE | RECIPIENT);
        assertEq(queued.rateBps, 900, "the tax survived the recipient proposal");
        assertEq(queued.recipient, next);
    }

    function test_EmptyAndUnknownMasksAreRefused() public {
        vm.startPrank(manager);
        vm.expectRevert(NothingProposed.selector);
        slot.proposeTerms(_taxTerms(), _noHook(), 0);
        vm.expectRevert(UnknownTerms.selector);
        slot.proposeTerms(_taxTerms(), _noHook(), 32);
        vm.expectRevert(UnknownTerms.selector);
        slot.proposeTerms(_taxTerms(), _noHook(), HOOK_PERMISSIONS);
        vm.stopPrank();
    }

    function test_OnlyTheMaskedFieldsAreValidated() public {
        TaxTerms memory taxTerms = TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0});
        _propose(slot, taxTerms, _noHook(), MIN_RUNWAY);

        vm.prank(manager);
        vm.expectRevert(InvalidRecipient.selector);
        slot.proposeTerms(taxTerms, _noHook(), RECIPIENT);

        vm.prank(manager);
        vm.expectRevert(InvalidTax.selector);
        slot.proposeTerms(taxTerms, _noHook(), TAX_RATE);
    }

    function test_OnlyTheManagerProposes() public {
        vm.prank(recipient);
        vm.expectRevert(NotManager.selector);
        slot.proposeTerms(_taxTerms(), _noHook(), TAX_RATE);
    }

    function test_CancelClearsOnlyWhatIsQueued() public {
        _propose(slot, TaxTerms({recipient: next, rateBps: 900, minRunwaySeconds: 0}), _noHook(), TAX_RATE | RECIPIENT);

        vm.prank(manager);
        slot.cancelTerms(RECIPIENT | HOOK);
        PendingTerms memory __p3 = slot.pendingTerms();
        TaxTerms memory queued = __p3.taxTerms;
        uint8 mask = __p3.mask;
        uint64 at = __p3.proposedAt;
        assertEq(mask, TAX_RATE, "the tax is still queued");
        assertEq(queued.rateBps, 900);
        assertEq(queued.recipient, address(0));
        assertGt(at, 0);

        vm.prank(manager);
        slot.cancelTerms(TAX_RATE);
        PendingTerms memory __p4 = slot.pendingTerms();
        mask = __p4.mask;
        at = __p4.proposedAt;
        assertEq(mask, 0);
        assertEq(at, 0);

        vm.prank(manager);
        vm.expectRevert(NoPendingTerms.selector);
        slot.cancelTerms(TAX_RATE);
    }

    // ── applying ────────────────────────────────────────────────────────────

    function test_TermsLandAtTheNextTransitionAfterTheDelay() public {
        _buy(slot);
        _propose(
            slot,
            TaxTerms({recipient: next, rateBps: 900, minRunwaySeconds: 2 hours}),
            _noHook(),
            TAX_RATE | RECIPIENT | MIN_RUNWAY
        );

        skip(slot.TERMS_DELAY());
        assertEq(slot.recipient(), recipient, "a delay alone applies nothing");

        _releaseAndApply(slot);

        assertEq(slot.recipient(), next);
        assertEq(slot.taxRateBps(), 900);
        assertEq(slot.minRunwaySeconds(), 2 hours);
        PendingTerms memory __p5 = slot.pendingTerms();
        uint8 mask = __p5.mask;
        assertEq(mask, 0);
    }

    function test_UnripeTermsWaitThroughATransition() public {
        _buy(slot);
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noHook(), RECIPIENT);

        _release(slot);

        assertEq(slot.recipient(), recipient, "still inside the delay");
        PendingTerms memory __p6 = slot.pendingTerms();
        uint8 mask = __p6.mask;
        assertEq(mask, RECIPIENT, "and still queued");
    }

    function test_RentEarnedBeforeTheChangeGoesToTheOutgoingRecipient() public {
        _buy(slot);
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noHook(), RECIPIENT);
        skip(10 days);

        _release(slot);

        assertGt(recipient.balance, 0, "the tenure's rent went to its recipient");
        assertEq(next.balance, 0);
    }

    // ── manager ─────────────────────────────────────────────────────────────

    function test_ManagerHandsOver() public {
        vm.expectEmit(address(slot));
        emit ISlotEvents.ManagerSet(manager, next);
        vm.prank(manager);
        slot.setManager(next);
        assertEq(slot.manager(), next);

        vm.prank(manager);
        vm.expectRevert(NotManager.selector);
        slot.proposeTerms(_taxTerms(), _noHook(), TAX_RATE);

        vm.prank(next);
        slot.proposeTerms(_taxTerms(), _noHook(), TAX_RATE);
    }

    function test_ZeroManagerRefused() public {
        vm.prank(manager);
        vm.expectRevert(InvalidManager.selector);
        slot.setManager(address(0));
    }

    // ── hook offer ──────────────────────────────────────────────────────────

    function _offerSlot(bool mutableHook, uint16 bps, address to) internal returns (Slot s, OfferHook h) {
        h = new OfferHook(bps, to);
        s = _slot(true, true, mutableHook, HookTerms({target: address(h), config: 0}));
    }

    function test_TheOfferIsWhatTheHookDeclares() public {
        (Slot s, ) = _offerSlot(true, 2_500, author);

        HookOffer memory offer = s.hookOffer();
        assertEq(offer.permissions, SETTLE);
        assertEq(offer.feeBps, 2_500);
        assertEq(offer.feeRecipient, author);
        assertTrue(s.hookPermissions().afterSettle);
    }

    function test_AHookWithABadOfferIsRefused() public {
        OfferHook noRecipient = new OfferHook(100, address(0));
        vm.expectRevert(InvalidHookFee.selector);
        factory.createSlot(_init(true, true, true, HookTerms({target: address(noRecipient), config: 0})));

        OfferHook tooMuch = new OfferHook(10_001, author);
        vm.expectRevert(InvalidHookFee.selector);
        factory.createSlot(_init(true, true, true, HookTerms({target: address(tooMuch), config: 0})));

        OfferHook noFlags = new OfferHook(0, address(0));
        noFlags.setPermissions(0);
        vm.expectRevert(InvalidHook.selector);
        factory.createSlot(_init(true, true, true, HookTerms({target: address(noFlags), config: 0})));

    }

    function test_TheFeeIsSplitFromCollectedRent() public {
        (Slot s, ) = _offerSlot(true, 2_500, author);
        _buy(s);
        skip(10 days);

        uint256 owed = s.taxOwed();
        s.collect();

        assertEq(author.balance, owed / 4, "a quarter to the hook's fee recipient");
        assertEq(recipient.balance, owed - owed / 4, "the rest to the recipient");
    }

    function test_AnOfferIsVisibleUntilAccepted() public {
        (Slot s, OfferHook h) = _offerSlot(true, 1_000, author);

        (, , bool feeDiffers, bool permissionsDiffer) = s.hookOfferStatus();
        assertFalse(feeDiffers);
        assertFalse(permissionsDiffer);

        h.set(2_000, author);
        h.setPermissions(SETTLE_AND_BUY);
        HookOffer memory accepted;
        HookOffer memory offered;
        (accepted, offered, feeDiffers, permissionsDiffer) = s.hookOfferStatus();
        assertTrue(feeDiffers);
        assertTrue(permissionsDiffer);
        assertEq(accepted.feeBps, 1_000);
        assertEq(offered.feeBps, 2_000);
        assertEq(offered.permissions, SETTLE_AND_BUY);
    }

    function test_ANewFeeAppliesAtOnceEvenOnALockedHook() public {
        (Slot s, OfferHook h) = _offerSlot(false, 1_000, author);
        h.set(2_000, author);

        vm.expectEmit(address(s));
        emit ISlotEvents.HookOfferAccepted(HookOffer(SETTLE, 2_000, author), true, false);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE, 2_000, author));

        assertEq(s.hookOffer().feeBps, 2_000);
        (, , bool feeDiffers, ) = s.hookOfferStatus();
        assertFalse(feeDiffers);
    }

    function test_ALockedHookKeepsItsFlags() public {
        (Slot s, OfferHook h) = _offerSlot(false, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);

        (, , , bool permissionsDiffer) = s.hookOfferStatus();
        assertFalse(permissionsDiffer, "nothing a manager could take");

        vm.prank(manager);
        vm.expectRevert(NothingToAccept.selector);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        // A fee change alongside is still taken, and the flags are not.
        h.set(500, author);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 500, author));
        assertEq(s.hookOffer().feeBps, 500);
        assertEq(s.hookOffer().permissions, SETTLE);
        assertEq(s.pendingTerms().mask, 0);
    }

    function test_NewFlagsWaitForTheNextTransitionAfterTheDelay() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);

        vm.expectEmit(address(s));
        emit ISlotEvents.HookOfferAccepted(HookOffer(SETTLE_AND_BUY, 0, address(0)), false, true);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        PendingTerms memory p = s.pendingTerms();
        assertEq(p.mask, HOOK_PERMISSIONS);
        assertEq(p.hookPermissions, SETTLE_AND_BUY);
        assertEq(s.hookOffer().permissions, SETTLE, "not yet");

        _buy(s);
        assertEq(h.buys(), 0, "the sitting occupant bought under the old flags");

        skip(s.TERMS_DELAY());
        _releaseAndApply(s);
        assertEq(s.hookOffer().permissions, SETTLE_AND_BUY, "the seat changed hands");
        assertEq(s.pendingTerms().mask, 0);

        _buy(s);
        assertEq(h.buys(), 1);
    }

    function test_FlagsTheHookNoLongerDeclaresAreDropped() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        h.setPermissions(SETTLE);
        skip(s.TERMS_DELAY());

        vm.expectEmit(address(s));
        emit HookPermissionsDropped(address(h), SETTLE_AND_BUY);
        _buy(s);

        assertEq(s.hookOffer().permissions, SETTLE);
        assertEq(s.pendingTerms().mask, 0);
        assertEq(h.buys(), 0);
    }

    function test_AcceptingQueuedFlagsAgainIsNothing() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        (, , , bool permissionsDiffer) = s.hookOfferStatus();
        assertFalse(permissionsDiffer);
        vm.prank(manager);
        vm.expectRevert(NothingToAccept.selector);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));
    }

    function test_AcceptedFlagsCanBeCancelled() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        vm.prank(manager);
        s.cancelTerms(HOOK_PERMISSIONS);
        PendingTerms memory p = s.pendingTerms();
        assertEq(p.mask, 0);
        assertEq(p.hookPermissions, 0);
    }

    function test_AQueuedHookSupersedesAcceptedFlags() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        h.setPermissions(SETTLE_AND_BUY);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE_AND_BUY, 0, address(0)));

        AnyHook other = new AnyHook();
        _propose(s, _taxTerms(), HookTerms({target: address(other), config: 0}), HOOK);
        skip(s.TERMS_DELAY());
        _buy(s);

        assertEq(s.hook(), address(other));
        assertEq(s.hookOffer().permissions, SETTLE, "the new hook's own offer");
        assertEq(s.pendingTerms().mask, 0);
    }

    function test_AcceptingPinsTheReviewedOffer() public {
        (Slot s, OfferHook h) = _offerSlot(true, 1_000, author);
        h.set(2_000, author);
        // The hook raises again after the manager reviewed 2_000.
        h.set(9_000, author);

        vm.prank(manager);
        vm.expectRevert(HookOfferChanged.selector);
        s.acceptHookOffer(HookOffer(SETTLE, 2_000, author));

        // And widens its subscriptions behind a fee the manager reviewed.
        h.setPermissions(SETTLE_AND_BUY);
        vm.prank(manager);
        vm.expectRevert(HookOfferChanged.selector);
        s.acceptHookOffer(HookOffer(SETTLE, 9_000, author));
    }

    function test_OnlyTheManagerAcceptsAndOnlyWithAHook() public {
        (Slot s, OfferHook h) = _offerSlot(true, 1_000, author);
        h.set(2_000, author);
        vm.expectRevert(NotManager.selector);
        s.acceptHookOffer(HookOffer(SETTLE, 2_000, author));

        vm.prank(manager);
        vm.expectRevert(InvalidHook.selector);
        slot.acceptHookOffer(HookOffer(SETTLE, 2_000, author));
    }

    function test_AcceptingPaysEarnedRentUnderTheOldFee() public {
        (Slot s, OfferHook h) = _offerSlot(false, 0, address(0));
        _buy(s);
        skip(10 days);

        h.set(10_000, author);
        vm.prank(manager);
        s.acceptHookOffer(HookOffer(SETTLE, 10_000, author));

        assertEq(author.balance, 0, "rent earned under a 0% fee pays no fee");
        assertGt(recipient.balance, 0);
    }

    function test_AHookRaisingItsFeeDoesNotReachAttachedSlotsUntilAccepted() public {
        (Slot s, OfferHook h) = _offerSlot(true, 1_000, author);

        h.set(9_000, author);
        _buy(s);
        skip(10 days);
        uint256 owed = s.taxOwed();
        s.collect();

        assertEq(s.hookOffer().feeBps, 1_000, "the copy holds");
        assertEq(author.balance, owed / 10);
    }

    function test_ReattachingPicksUpTheNewOfferAndNeverReachesEarnedRent() public {
        (Slot s, OfferHook h) = _offerSlot(true, 0, address(0));
        _buy(s);

        h.set(10_000, author);
        _propose(s, _taxTerms(), HookTerms({target: address(h), config: 0}), HOOK);
        skip(10 days);
        _releaseAndApply(s);

        assertEq(author.balance, 0, "rent earned under a 0% fee pays no fee");
        assertGt(recipient.balance, 0);
        assertEq(s.hookOffer().feeBps, 10_000, "and the new fee is in force");
    }

    function test_DetachingClearsTheHookAndItsOffer() public {
        (Slot s, ) = _offerSlot(true, 2_500, author);
        _buy(s);
        _propose(s, _taxTerms(), _noHook(), HOOK);
        skip(s.TERMS_DELAY());
        _releaseAndApply(s);

        HookOffer memory offer = s.hookOffer();
        assertEq(s.hook(), address(0));
        assertEq(offer.permissions, 0);
        assertEq(offer.feeBps, 0);
        assertEq(offer.feeRecipient, address(0));
    }

    function test_AnImmutableHookCannotBeProposed() public {
        Slot fixedHook = _slot(true, true, false, _noHook());
        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        fixedHook.proposeTerms(_taxTerms(), _noHook(), HOOK);
    }
}
