// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, Manifest, PendingTerms} from "../../src/types/SlotTypes.sol";
import {ISlotEvents} from "../../src/interfaces/ISlotEvents.sol";
import {ISlotModule, Scopes, SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import "../../src/errors/SlotErrors.sol";

/// @dev Takes no fee, subscribes to one harmless callback.
contract AnyModule is ISlotModule {
    function manifest(bytes calldata) external view virtual returns (Manifest memory o) {
        o.scopes = ScopesLib.AFTER_SETTLE;
    }

    function checkSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external virtual {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}


}

/// @dev A manifest its owner can change at any time, and a count of the buys it hears about.
contract ManifestModule is AnyModule {
    uint16 public scopes = ScopesLib.AFTER_SETTLE;
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

    function setScopes(uint16 scopes_) external {
        scopes = scopes_;
    }

    function manifest(bytes calldata) external view override returns (Manifest memory) {
        return Manifest(scopes, bps, to);
    }

    function afterBuy(SlotContext calldata) external override {
        ++buys;
    }
}

/// @notice Terms queue per mutable term and land at transitions; modules declare
///         a manifest the slot keeps a copy of until its manager accepts another.
contract SlotTermsTest is Test {
    event ScopesDropped(address indexed module, uint16 scopes);

    uint8 constant TAX_RATE = 1;
    uint8 constant RECIPIENT = 2;
    uint8 constant MIN_RUNWAY = 4;
    uint8 constant MODULE = 8;
    uint8 constant SCOPES = 16;
    uint16 constant SETTLE = ScopesLib.AFTER_SETTLE;
    uint16 constant SETTLE_AND_BUY = ScopesLib.AFTER_SETTLE | ScopesLib.AFTER_BUY;

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
        slot = _slot(true, true, true, _noModule());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _noModule() internal pure returns (ModuleTerms memory) {
        return ModuleTerms({target: address(0), settings: ""});
    }

    function _taxTerms() internal view returns (TaxTerms memory) {
        return TaxTerms({recipient: recipient, rateBps: 500, minRunwaySeconds: 1 hours});
    }

    function _init(bool tax, bool rec, bool module, ModuleTerms memory h) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(0)),
            manager: (tax || rec || module) ? manager : address(0),
            mutableTax: tax,
            mutableRecipient: rec,
            mutableModule: module,
            taxTerms: _taxTerms(),
            moduleTerms: h
        });
    }

    function _slot(bool tax, bool rec, bool module, ModuleTerms memory h) internal returns (Slot) {
        return Slot(payable(factory.createSlot(_init(tax, rec, module, h))));
    }

    function _propose(Slot s, TaxTerms memory taxTerms, ModuleTerms memory module, uint8 mask) internal {
        vm.prank(manager);
        s.proposeTerms(taxTerms, module, mask);
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
        Slot taxOnly = _slot(true, false, false, _noModule());
        TaxTerms memory taxTerms = TaxTerms({recipient: next, rateBps: 700, minRunwaySeconds: 2 hours});

        _propose(taxOnly, taxTerms, _noModule(), TAX_RATE | MIN_RUNWAY);

        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        taxOnly.proposeTerms(taxTerms, _noModule(), RECIPIENT);

        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        taxOnly.proposeTerms(taxTerms, _noModule(), MODULE);

        Slot recipientOnly = _slot(false, true, false, _noModule());
        _propose(recipientOnly, taxTerms, _noModule(), RECIPIENT);
        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        recipientOnly.proposeTerms(taxTerms, _noModule(), TAX_RATE);
    }

    function test_AManagerIsRequiredExactlyWhenSomethingIsMutable() public {
        SlotInit memory i = _init(true, false, false, _noModule());
        i.manager = address(0);
        vm.expectRevert(InvalidManager.selector);
        factory.createSlot(i);

        SlotInit memory j = _init(false, false, false, _noModule());
        j.manager = manager;
        vm.expectRevert(InvalidManager.selector);
        factory.createSlot(j);
    }

    // ── queueing ────────────────────────────────────────────────────────────

    function test_ProposalQueuesOnlyTheMaskedFields() public {
        TaxTerms memory taxTerms = TaxTerms({recipient: next, rateBps: 900, minRunwaySeconds: 2 days});
        _propose(slot, taxTerms, _noModule(), RECIPIENT);

        assertEq(slot.recipient(), recipient, "nothing moves on proposal");
        PendingTerms memory __p1 = slot.pendingTerms();
        TaxTerms memory queued = __p1.taxTerms;
        uint8 mask = __p1.mask;
        assertEq(mask, RECIPIENT);
        assertEq(queued.recipient, next);
        assertEq(queued.rateBps, 0, "an unmasked field is not queued");
    }

    function test_ProposalsAccumulateAcrossTerms() public {
        _propose(slot, TaxTerms({recipient: address(0), rateBps: 900, minRunwaySeconds: 0}), _noModule(), TAX_RATE);
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noModule(), RECIPIENT);

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
        slot.proposeTerms(_taxTerms(), _noModule(), 0);
        vm.expectRevert(UnknownTerms.selector);
        slot.proposeTerms(_taxTerms(), _noModule(), 32);
        vm.expectRevert(UnknownTerms.selector);
        slot.proposeTerms(_taxTerms(), _noModule(), SCOPES);
        vm.stopPrank();
    }

    function test_OnlyTheMaskedFieldsAreValidated() public {
        TaxTerms memory taxTerms = TaxTerms({recipient: address(0), rateBps: 0, minRunwaySeconds: 0});
        _propose(slot, taxTerms, _noModule(), MIN_RUNWAY);

        vm.prank(manager);
        vm.expectRevert(InvalidRecipient.selector);
        slot.proposeTerms(taxTerms, _noModule(), RECIPIENT);

        vm.prank(manager);
        vm.expectRevert(InvalidTax.selector);
        slot.proposeTerms(taxTerms, _noModule(), TAX_RATE);
    }

    function test_OnlyTheManagerProposes() public {
        vm.prank(recipient);
        vm.expectRevert(NotManager.selector);
        slot.proposeTerms(_taxTerms(), _noModule(), TAX_RATE);
    }

    function test_CancelClearsOnlyWhatIsQueued() public {
        _propose(slot, TaxTerms({recipient: next, rateBps: 900, minRunwaySeconds: 0}), _noModule(), TAX_RATE | RECIPIENT);

        vm.prank(manager);
        slot.cancelTerms(RECIPIENT | MODULE);
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
            _noModule(),
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
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noModule(), RECIPIENT);

        _release(slot);

        assertEq(slot.recipient(), recipient, "still inside the delay");
        PendingTerms memory __p6 = slot.pendingTerms();
        uint8 mask = __p6.mask;
        assertEq(mask, RECIPIENT, "and still queued");
    }

    function test_RentEarnedBeforeTheChangeGoesToTheOutgoingRecipient() public {
        _buy(slot);
        _propose(slot, TaxTerms({recipient: next, rateBps: 0, minRunwaySeconds: 0}), _noModule(), RECIPIENT);
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
        slot.proposeTerms(_taxTerms(), _noModule(), TAX_RATE);

        vm.prank(next);
        slot.proposeTerms(_taxTerms(), _noModule(), TAX_RATE);
    }

    function test_ZeroManagerRefused() public {
        vm.prank(manager);
        vm.expectRevert(InvalidManager.selector);
        slot.setManager(address(0));
    }

    // ── module manifest ──────────────────────────────────────────────────────────

    function _manifestSlot(bool mutableModule, uint16 bps, address to) internal returns (Slot s, ManifestModule h) {
        h = new ManifestModule(bps, to);
        s = _slot(true, true, mutableModule, ModuleTerms({target: address(h), settings: ""}));
    }

    function test_TheManifestIsWhatTheModuleDeclares() public {
        (Slot s, ) = _manifestSlot(true, 2_500, author);

        Manifest memory declared = s.manifest();
        assertEq(declared.scopes, SETTLE);
        assertEq(declared.feeBps, 2_500);
        assertEq(declared.feeRecipient, author);
        assertTrue(s.scopes().afterSettle);
    }

    function test_AModuleWithABadManifestIsRefused() public {
        ManifestModule noRecipient = new ManifestModule(100, address(0));
        vm.expectRevert(InvalidModuleFee.selector);
        factory.createSlot(_init(true, true, true, ModuleTerms({target: address(noRecipient), settings: ""})));

        ManifestModule tooMuch = new ManifestModule(10_001, author);
        vm.expectRevert(InvalidModuleFee.selector);
        factory.createSlot(_init(true, true, true, ModuleTerms({target: address(tooMuch), settings: ""})));



        ManifestModule noScopes = new ManifestModule(0, address(0));
        noScopes.setScopes(0);
        vm.expectRevert(InvalidModule.selector);
        factory.createSlot(_init(true, true, true, ModuleTerms({target: address(noScopes), settings: ""})));

    }

    function test_TheFeeIsSplitFromCollectedRent() public {
        (Slot s, ) = _manifestSlot(true, 2_500, author);
        _buy(s);
        skip(10 days);

        uint256 owed = s.taxOwed();
        s.collect();

        uint256 fee = owed / 4;
        assertEq(author.balance, fee, "a quarter to the module's fee recipient");
        assertEq(recipient.balance, owed - fee, "the rest to the recipient");
    }

    function test_ANewManifestIsVisibleUntilAccepted() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 1_000, author);

        (, , bool feeDiffers, bool scopesDiffer) = s.grantStatus();
        assertFalse(feeDiffers);
        assertFalse(scopesDiffer);

        h.set(2_000, author);
        h.setScopes(SETTLE_AND_BUY);
        Manifest memory accepted;
        Manifest memory offered;
        (accepted, offered, feeDiffers, scopesDiffer) = s.grantStatus();
        assertTrue(feeDiffers);
        assertTrue(scopesDiffer);
        assertEq(accepted.feeBps, 1_000);
        assertEq(offered.feeBps, 2_000);
        assertEq(offered.scopes, SETTLE_AND_BUY);
    }

    function test_ANewFeeAppliesAtOnceEvenOnALockedModule() public {
        (Slot s, ManifestModule h) = _manifestSlot(false, 1_000, author);
        h.set(2_000, author);

        vm.expectEmit(address(s));
        emit ISlotEvents.ScopesGranted(Manifest(SETTLE, 2_000, author), true, false);
        vm.prank(manager);
        s.grant(Manifest(SETTLE, 2_000, author));

        assertEq(s.manifest().feeBps, 2_000);
        (, , bool feeDiffers, ) = s.grantStatus();
        assertFalse(feeDiffers);
    }

    function test_ALockedModuleKeepsItsScopes() public {
        (Slot s, ManifestModule h) = _manifestSlot(false, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);

        (, , , bool scopesDiffer) = s.grantStatus();
        assertFalse(scopesDiffer, "nothing a manager could take");

        vm.prank(manager);
        vm.expectRevert(NothingToAccept.selector);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        // A fee change alongside is still taken, and the scopes are not.
        h.set(500, author);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 500, author));
        assertEq(s.manifest().feeBps, 500);
        assertEq(s.manifest().scopes, SETTLE);
        assertEq(s.pendingTerms().mask, 0);
    }

    function test_NewScopesWaitForTheNextTransitionAfterTheDelay() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);

        vm.expectEmit(address(s));
        emit ISlotEvents.ScopesGranted(Manifest(SETTLE_AND_BUY, 0, address(0)), false, true);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        PendingTerms memory p = s.pendingTerms();
        assertEq(p.mask, SCOPES);
        assertEq(p.scopes, SETTLE_AND_BUY);
        assertEq(s.manifest().scopes, SETTLE, "not yet");

        _buy(s);
        assertEq(h.buys(), 0, "the sitting occupant bought under the old scopes");

        skip(s.TERMS_DELAY());
        _releaseAndApply(s);
        assertEq(s.manifest().scopes, SETTLE_AND_BUY, "the seat changed hands");
        assertEq(s.pendingTerms().mask, 0);

        _buy(s);
        assertEq(h.buys(), 1);
    }

    function test_ScopesTheModuleNoLongerDeclaresAreDropped() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        h.setScopes(SETTLE);
        skip(s.TERMS_DELAY());

        vm.expectEmit(address(s));
        emit ScopesDropped(address(h), SETTLE_AND_BUY);
        _buy(s);

        assertEq(s.manifest().scopes, SETTLE);
        assertEq(s.pendingTerms().mask, 0);
        assertEq(h.buys(), 0);
    }

    function test_AcceptingQueuedScopesAgainIsNothing() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        (, , , bool scopesDiffer) = s.grantStatus();
        assertFalse(scopesDiffer);
        vm.prank(manager);
        vm.expectRevert(NothingToAccept.selector);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));
    }

    function test_AcceptedScopesCanBeCancelled() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        vm.prank(manager);
        s.cancelTerms(SCOPES);
        PendingTerms memory p = s.pendingTerms();
        assertEq(p.mask, 0);
        assertEq(p.scopes, 0);
    }

    function test_AQueuedModuleSupersedesAcceptedScopes() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        h.setScopes(SETTLE_AND_BUY);
        vm.prank(manager);
        s.grant(Manifest(SETTLE_AND_BUY, 0, address(0)));

        AnyModule other = new AnyModule();
        _propose(s, _taxTerms(), ModuleTerms({target: address(other), settings: ""}), MODULE);
        skip(s.TERMS_DELAY());
        _buy(s);

        assertEq(s.module(), address(other));
        assertEq(s.manifest().scopes, SETTLE, "the new module's own manifest");
        assertEq(s.pendingTerms().mask, 0);
    }

    function test_AcceptingPinsTheReviewedManifest() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 1_000, author);
        h.set(2_000, author);
        // The module raises again after the manager reviewed 2_000.
        h.set(9_000, author);

        vm.prank(manager);
        vm.expectRevert(ManifestChanged.selector);
        s.grant(Manifest(SETTLE, 2_000, author));

        // And widens its subscriptions behind a fee the manager reviewed.
        h.setScopes(SETTLE_AND_BUY);
        vm.prank(manager);
        vm.expectRevert(ManifestChanged.selector);
        s.grant(Manifest(SETTLE, 9_000, author));
    }

    function test_OnlyTheManagerAcceptsAndOnlyWithAModule() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 1_000, author);
        h.set(2_000, author);
        vm.expectRevert(NotManager.selector);
        s.grant(Manifest(SETTLE, 2_000, author));

        vm.prank(manager);
        vm.expectRevert(InvalidModule.selector);
        slot.grant(Manifest(SETTLE, 2_000, author));
    }

    function test_AcceptingPaysEarnedRentUnderTheOldFee() public {
        (Slot s, ManifestModule h) = _manifestSlot(false, 0, address(0));
        _buy(s);
        skip(10 days);

        h.set(10_000, author);
        vm.prank(manager);
        s.grant(Manifest(SETTLE, 10_000, author));

        assertEq(author.balance, 0, "rent earned under a 0% fee pays no fee");
        assertGt(recipient.balance, 0);
    }

    function test_AModuleRaisingItsFeeDoesNotReachAttachedSlotsUntilAccepted() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 1_000, author);

        h.set(9_000, author);
        _buy(s);
        skip(10 days);
        uint256 owed = s.taxOwed();
        s.collect();

        assertEq(s.manifest().feeBps, 1_000, "the copy holds");
        assertEq(author.balance, owed / 10);
    }

    function test_ReattachingPicksUpTheNewManifestAndNeverReachesEarnedRent() public {
        (Slot s, ManifestModule h) = _manifestSlot(true, 0, address(0));
        _buy(s);

        h.set(10_000, author);
        _propose(s, _taxTerms(), ModuleTerms({target: address(h), settings: ""}), MODULE);
        skip(10 days);
        _releaseAndApply(s);

        assertEq(author.balance, 0, "rent earned under a 0% fee pays no fee");
        assertGt(recipient.balance, 0);
        assertEq(s.manifest().feeBps, 10_000, "and the new fee is in force");
    }

    function test_DetachingClearsTheModuleAndItsManifest() public {
        (Slot s, ) = _manifestSlot(true, 2_500, author);
        _buy(s);
        _propose(s, _taxTerms(), _noModule(), MODULE);
        skip(s.TERMS_DELAY());
        _releaseAndApply(s);

        Manifest memory declared = s.manifest();
        assertEq(s.module(), address(0));
        assertEq(declared.scopes, 0);
        assertEq(declared.feeBps, 0);
        assertEq(declared.feeRecipient, address(0));
    }

    function test_AnImmutableModuleCannotBeProposed() public {
        Slot fixedModule = _slot(true, true, false, _noModule());
        vm.prank(manager);
        vm.expectRevert(NotMutable.selector);
        fixedModule.proposeTerms(_taxTerms(), _noModule(), MODULE);
    }

    /// @notice A runway past a year is refused, at creation and on proposal.
    function test_ARunwayPastAYearIsRefused() public {
        TaxTerms memory t = _taxTerms();
        t.minRunwaySeconds = uint32(365 days) + 1;
        vm.prank(manager);
        vm.expectRevert(InvalidRunway.selector);
        slot.proposeTerms(t, _noModule(), MIN_RUNWAY);

        SlotInit memory i = _init(true, true, true, _noModule());
        i.taxTerms.minRunwaySeconds = uint32(365 days) + 1;
        vm.expectRevert(InvalidRunway.selector);
        factory.createSlot(i);

        t.minRunwaySeconds = uint32(365 days);
        _propose(slot, t, _noModule(), MIN_RUNWAY);
    }

}
