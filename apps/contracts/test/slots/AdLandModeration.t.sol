// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotConstants} from "../../src/slot/SlotConstants.sol";

import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";
import {AdLand} from "../../src/modules/adland/AdLand.sol";
import {AdConfig, IAdLand, ModerationMode} from "../../src/modules/adland/IAdLand.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";

/**
 * A slot's manager screening creatives before they show.
 *
 * The manager here is this test contract, so moderation calls need no prank;
 * `alice` and `bob` are advertisers.
 */
contract AdLandModerationTest is Test, SlotConstants {
    SlotFactory factory;
    AdLand adland;
    Slot slot;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    string constant V1 = "ipfs://creative-one";
    string constant V2 = "ipfs://creative-two";

    function setUp() public {
        SlotFactory factoryImpl = new SlotFactory();
        Slot slotImpl = new Slot();
        bytes memory fInit =
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)));
        factory = SlotFactory(address(new ERC1967Proxy(address(factoryImpl), fInit)));

        AdLand adImpl = new AdLand();
        bytes memory aInit = abi.encodeCall(AdLand.initialize, (owner));
        adland = AdLand(address(new ERC1967Proxy(address(adImpl), aInit)));

        slot = _makeSlot(address(this));

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    /// @dev The mode is the slot's AdLand configuration, stored on the slot,
    ///      so setting it is creating the slot with it.
    function _config(ModerationMode mode) internal pure returns (bytes memory) {
        return abi.encode(AdConfig({tenureWindow: 0, moderation: mode, key: bytes32(0)}));
    }

    /// @dev Replaces `slot` with one configured for `mode`. Only meaningful
    ///      before anyone is seated, which is where every caller uses it.
    function _mode(ModerationMode mode) internal {
        slot = _makeSlot(address(this), mode);
    }

    function _makeSlot(address manager) internal returns (Slot) {
        return _makeSlot(manager, ModerationMode.Open);
    }

    function _makeSlot(address manager, ModerationMode mode) internal returns (Slot) {
        bool mutable_ = manager != address(0);
        bytes memory settings = mode == ModerationMode.Open ? bytes("") : _config(mode);
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: manager,
                        mutableTax: mutable_,
                        mutableRecipient: mutable_,
                        mutableModule: mutable_,
                        taxTerms: TaxTerms({
                            recipient: address(this),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(7 days)
                        }),
                        moduleTerms: ModuleTerms({target: address(adland), settings: settings})
                    })
                ))
        );
    }

    function _seat(address who, uint256 price) internal {
        uint256 dep = slot.minDepositForBuy(price);
        uint256 owed = dep + (slot.occupant() == address(0) ? 0 : slot.price());
        vm.prank(who);
        slot.buy{value: owed}(who, price, dep, type(uint256).max);
    }

    function _publish(address who, string memory uri) internal {
        vm.prank(who);
        adland.publish(address(slot), uri);
    }

    function _hash(string memory uri) internal pure returns (bytes32) {
        return keccak256(bytes(uri));
    }

    function _showing() internal view returns (string memory) {
        return adland.creativeOf(address(slot));
    }

    function _submission() internal view returns (string memory submission) {
        (,, submission) = adland.moderationOf(address(slot));
    }

    // ─── Open: nothing changes ──────────────────────────────────────────────

    /// @notice Every slot that existed before moderation reads `Open` and
    ///         publishes exactly as it did.
    function test_OpenIsTheDefaultAndPublishesImmediately() public {
        (ModerationMode current, ModerationMode next, string memory waiting) =
            adland.moderationOf(address(slot));
        assertEq(uint8(current), uint8(ModerationMode.Open));
        assertEq(uint8(next), uint8(ModerationMode.Open));
        assertEq(waiting, "");

        _seat(alice, 1 ether);
        _publish(alice, V1);
        assertEq(_showing(), V1, "live at once");
    }

    // ─── Every ──────────────────────────────────────────────────────────────

    /// @notice A submission shows nowhere until the manager approves it.
    function test_EveryHoldsASubmissionUntilApproved() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);

        vm.expectEmit(true, false, false, true, address(adland));
        emit IAdLand.Submitted(address(slot), V1, slot.tenureId());
        _publish(alice, V1);

        assertEq(_showing(), "", "not live");
        assertEq(adland.ad(address(slot)).uri, "", "not in the lens either");
        assertEq(_submission(), V1, "waiting for the manager");

        vm.expectEmit(true, false, false, true, address(adland));
        emit IAdLand.Approved(address(slot), V1, slot.tenureId());
        vm.expectEmit(true, false, false, true, address(adland));
        emit IAdLand.Published(address(slot), V1, slot.tenureId());
        adland.approveCreative(address(slot), _hash(V1));

        assertEq(_showing(), V1, "live once approved");
        assertEq(_submission(), "", "and no longer waiting");
    }

    /// @notice The same occupant's last approved creative keeps showing while
    ///         their update waits.
    function test_EveryKeepsThePreviousCreativeWhileAnUpdateWaits() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);
        adland.approveCreative(address(slot), _hash(V1));

        _publish(alice, V2);
        assertEq(_showing(), V1, "the approved one stays up");

        adland.approveCreative(address(slot), _hash(V2));
        assertEq(_showing(), V2, "until its replacement is approved");
    }

    /// @notice A different occupant does not inherit the previous advertiser's
    ///         ad while their own waits.
    function test_ANewOccupantDoesNotInheritThePreviousAd() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);
        adland.approveCreative(address(slot), _hash(V1));

        _seat(bob, 2 ether);
        assertEq(_showing(), "", "alice's ad ended with her tenure");

        _publish(bob, V2);
        assertEq(_showing(), "", "and bob's waits for approval");
    }

    // ─── FirstPerTenure ─────────────────────────────────────────────────────

    /// @notice Once an occupant has had a creative approved this tenure, they
    ///         publish directly. A new occupant is screened again.
    function test_FirstPerTenureTrustsAnApprovedOccupant() public {
        _mode(ModerationMode.FirstPerTenure);
        _seat(alice, 1 ether);

        _publish(alice, V1);
        assertEq(_showing(), "", "the first one waits");
        adland.approveCreative(address(slot), _hash(V1));

        _publish(alice, V2);
        assertEq(_showing(), V2, "the next goes straight up");

        _seat(bob, 2 ether);
        _publish(bob, V1);
        assertEq(_showing(), "", "a new occupant is screened again");
    }

    // ─── what makes it safe ─────────────────────────────────────────────────

    /// @notice An occupant who swaps their submission after the manager has
    ///         reviewed it cannot ride the approval.
    function test_ApprovalIsPinnedToWhatWasReviewed() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);

        bytes32 reviewed = _hash(V1);
        _publish(alice, V2); // swapped in before the approval lands

        vm.expectRevert(IAdLand.SubmissionChanged.selector);
        adland.approveCreative(address(slot), reviewed);
        assertEq(_showing(), "");
    }

    /// @notice A submission from an ended tenure is dead, even though nothing
    ///         deleted it.
    function test_ASubmissionFromAnEndedTenureCannotBeApproved() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);

        _seat(bob, 2 ether);

        assertEq(_submission(), "", "reads as nothing");
        vm.expectRevert(IAdLand.NothingToModerate.selector);
        adland.approveCreative(address(slot), _hash(V1));
    }

    /// @notice Vacating also kills a submission.
    function test_AReleasedSlotHasNothingToApprove() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);

        vm.prank(alice);
        slot.release();

        vm.expectRevert(IAdLand.NothingToModerate.selector);
        adland.approveCreative(address(slot), _hash(V1));
    }

    /// @notice Rejecting discards the submission and leaves the live creative.
    function test_RejectDiscardsTheSubmissionAndKeepsTheLiveOne() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);
        adland.approveCreative(address(slot), _hash(V1));

        _publish(alice, V2);
        vm.expectEmit(true, false, false, true, address(adland));
        emit IAdLand.Rejected(address(slot), V2, slot.tenureId());
        adland.rejectCreative(address(slot), _hash(V2));

        assertEq(_showing(), V1, "still showing the approved one");
        assertEq(_submission(), "", "the rejected one is gone");
    }

    /// @notice Clearing your own ad never waits, and drops anything waiting.
    function test_ClearingNeverWaits() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);
        adland.approveCreative(address(slot), _hash(V1));
        _publish(alice, V2);

        _publish(alice, "");

        assertEq(_showing(), "", "taken down at once");
        assertEq(_submission(), "", "and V2 cannot be approved into it later");
    }

    /// @notice Buying and publishing in one call is screened like any publish.
    function test_BuyAndPublishIsModerated() public {
        _mode(ModerationMode.Every);

        uint256 dep = slot.minDepositForBuy(1 ether);
        vm.prank(bob);
        adland.buyAndPublish{value: dep}(address(slot), 1 ether, dep, type(uint256).max, V1);

        assertEq(slot.occupant(), bob, "bought");
        assertEq(_showing(), "", "but not live");
        assertEq(_submission(), V1, "waiting");
    }

    // ─── mode changes ───────────────────────────────────────────────────────

    /// @notice An occupant keeps the mode they bought under: changing it is a
    ///         module term, so it lands at the next buy.
    function test_AModeChangeIsAModuleTermAndWaitsForTheNextOccupant() public {
        _seat(alice, 1 ether);

        TaxTerms memory none;
        slot.proposeTerms(
            none, ModuleTerms({target: address(adland), settings: _config(ModerationMode.Every)}), 8
        );

        (ModerationMode current, ModerationMode next,) = adland.moderationOf(address(slot));
        assertEq(uint8(current), uint8(ModerationMode.Open), "alice still bought under Open");
        assertEq(uint8(next), uint8(ModerationMode.Every), "a buyer would get Every");

        _publish(alice, V1);
        assertEq(_showing(), V1, "so alice still publishes directly");

        vm.warp(block.timestamp + TERMS_DELAY + 1);
        _seat(bob, 2 ether);
        _publish(bob, V2);
        assertEq(_showing(), "", "bob is seated under Every");
    }

    // ─── who ────────────────────────────────────────────────────────────────

    function test_OnlyTheManagerModerates() public {
        _mode(ModerationMode.Every);
        _seat(alice, 1 ether);
        _publish(alice, V1);

        vm.startPrank(alice);
        vm.expectRevert(IAdLand.NotSlotManager.selector);
        adland.approveCreative(address(slot), _hash(V1));
        vm.expectRevert(IAdLand.NotSlotManager.selector);
        adland.rejectCreative(address(slot), _hash(V1));
        vm.stopPrank();
    }

    /// @notice A slot with no manager has nobody to approve, so a creative
    ///         waits for ever — which is why such a slot should stay `Open`.
    function test_ASlotWithNoManagerHasNobodyToModerate() public {
        Slot fixedTerms = _makeSlot(address(0), ModerationMode.Every);

        uint256 dep = fixedTerms.minDepositForBuy(1 ether);
        vm.prank(alice);
        fixedTerms.buy{value: dep}(alice, 1 ether, dep, type(uint256).max);
        vm.prank(alice);
        adland.publish(address(fixedTerms), V1);
        assertEq(adland.creativeOf(address(fixedTerms)), "", "nothing can approve it");

        vm.expectRevert(IAdLand.NotSlotManager.selector);
        adland.approveCreative(address(fixedTerms), _hash(V1));
    }

    function test_ModerationOfNeverReverts() public {
        (ModerationMode current, ModerationMode next, string memory waiting) =
            adland.moderationOf(makeAddr("not a slot"));
        assertEq(uint8(current), uint8(ModerationMode.Open));
        assertEq(uint8(next), uint8(ModerationMode.Open));
        assertEq(waiting, "");
    }

    // ─── keys ───────────────────────────────────────────────────────────────

    /// @notice A key is claimed from the slot that asks for it, first come.
    function test_AKeyIsClaimedFromTheSlotThatAsksForIt() public {
        bytes memory settings =
            abi.encode(AdConfig({tenureWindow: 0, moderation: ModerationMode.Open, key: "spot"}));
        Slot keyed = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(7 days)
                        }),
                        moduleTerms: ModuleTerms({target: address(adland), settings: settings})
                    })
                ))
        );

        // Anyone may press it; what it trusts is the slot.
        vm.prank(alice);
        adland.claimKey(address(keyed));
        assertEq(adland.slotOf("spot"), address(keyed));
        assertEq(adland.keyOwner("spot"), address(this), "the slot's manager holds it");

        // A second slot asking the same name loses.
        Slot other = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(7 days)
                        }),
                        moduleTerms: ModuleTerms({target: address(adland), settings: settings})
                    })
                ))
        );
        vm.expectRevert(abi.encodeWithSelector(IAdLand.KeyTaken.selector, bytes32("spot")));
        adland.claimKey(address(other));
    }

    /// @notice A slot that asks for no key has nothing to claim.
    function test_ASlotWithNoKeyCannotClaim() public {
        vm.expectRevert(IAdLand.ZeroSlot.selector);
        adland.claimKey(address(slot));
    }

    // ─── registry authority ─────────────────────────────────────────────────

    function _keyedSlot(address manager_, bytes32 key) internal returns (Slot) {
        bytes memory settings =
            abi.encode(AdConfig({tenureWindow: 0, moderation: ModerationMode.Open, key: key}));
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: manager_,
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: manager_,
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(7 days)
                        }),
                        moduleTerms: ModuleTerms({target: address(adland), settings: settings})
                    })
                ))
        );
    }

    /// @notice The SDK's default render target is not a first-come name.
    function test_PrimaryCannotBeClaimed() public {
        bytes32 primary = adland.PRIMARY();
        Slot s = _keyedSlot(alice, primary);
        vm.expectRevert(abi.encodeWithSelector(IAdLand.ReservedKey.selector, primary));
        adland.claimKey(address(s));
    }

    /// @notice A name belongs to whoever manages the slot behind it now.
    function test_AKeyFollowsTheSlotsManager() public {
        Slot s = _keyedSlot(alice, "acme");
        adland.claimKey(address(s));
        assertEq(adland.keyOwner("acme"), alice);

        vm.prank(alice);
        s.setManager(bob);
        assertEq(adland.keyOwner("acme"), bob, "the name moved with the slot");

        Slot elsewhere = _keyedSlot(alice, "elsewhere");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAdLand.NotKeyOwner.selector, bytes32("acme")));
        adland.setSlot("acme", address(elsewhere));
    }

    /// @notice The owner's recovery of a squatted key cannot be displaced by
    ///         the squatter, by overwriting or by cancelling it.
    function test_AHolderCannotDisplaceTheOwnersRecovery() public {
        Slot squat = _keyedSlot(alice, "acme");
        adland.claimKey(address(squat));
        Slot good = _keyedSlot(bob, "good");
        Slot bad = _keyedSlot(alice, "bad");

        vm.prank(owner);
        adland.setSlot("acme", address(good));

        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAdLand.OwnerProposalPending.selector, bytes32("acme"))
        );
        adland.setSlot("acme", address(bad));
        vm.expectRevert(
            abi.encodeWithSelector(IAdLand.OwnerProposalPending.selector, bytes32("acme"))
        );
        adland.cancelSlot("acme");
        vm.stopPrank();

        skip(adland.CHANGE_DELAY());
        adland.commitSlot("acme");
        assertEq(adland.slotOf("acme"), address(good), "the owner's recovery lands");
    }
}
