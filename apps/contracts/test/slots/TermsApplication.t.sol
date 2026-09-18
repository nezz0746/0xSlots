// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, HookTerms} from "../../src/types/SlotTypes.sol";

import {Slot} from "../../src/Slot.sol";
import "../../src/errors/SlotErrors.sol";
import {DenyBuys, SlotsTest} from "./Slots.t.sol";

/**
 * WHERE queued terms land, now that exits do not carry them.
 *
 * Terms are applied when the seat is TAKEN — by `buy`, or by `applyTerms` when
 * somebody entitled to asks for them. `release` and `liquidate` leave the queue
 * standing: applying reads the incoming hook, and a read on the eviction path
 * is something a hook can make expensive.
 *
 * What the occupant is promised is unchanged: nothing lands under them without
 * their say, and a buyer is always seated under the terms they funded.
 */
contract TermsApplicationTest is SlotsTest {
    function _ripeDenial(Slot s) internal returns (DenyBuys deny) {
        deny = new DenyBuys();
        vm.prank(manager);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(10_000), minRunwaySeconds: 0}), HookTerms({target: address(deny), config: bytes32(0)}), uint8(9));
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms(), "terms are ripe");
    }

    function _seat(Slot s, address who) internal {
        uint256 dep = s.minDepositForBuy(1 ether);
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, 1 ether, dep, 0);
        vm.stopPrank();
    }

    /// @notice A buyer is judged by the hook their purchase brings in.
    function test_ABuyerIsSeatedUnderTheTermsTheyFund() public {
        Slot s = _slot(address(0));
        _ripeDenial(s);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();
    }

    /// @notice An eviction carries no terms, so no hook runs on that path.
    function test_ALiquidationLeavesTheQueueStanding() public {
        Slot s = _slot(address(0));
        _seat(s, alice);
        _ripeDenial(s);
        vm.warp(block.timestamp + 365 days);
        assertTrue(s.isInsolvent(), "escrow is gone");

        vm.prank(bob);
        s.liquidate();

        assertEq(s.occupant(), address(0), "evicted");
        assertEq(s.hook(), address(0), "the queued hook did not attach");
        assertTrue(s.hasRipeTerms(), "it is still queued");
    }

    /// @notice Nor does a release.
    function test_AReleaseLeavesTheQueueStanding() public {
        Slot s = _slot(address(0));
        _seat(s, alice);
        _ripeDenial(s);

        vm.prank(alice);
        s.release();

        assertEq(s.occupant(), address(0), "released");
        assertTrue(s.hasRipeTerms(), "proposal intact");
    }

    /// @notice The next buyer lands them, however the seat came free.
    function test_TheNextBuyerLandsWhatTheEvictionLeft() public {
        Slot s = _slot(address(0));
        _seat(s, alice);
        DenyBuys deny = _ripeDenial(s);
        vm.warp(block.timestamp + 365 days);
        vm.prank(bob);
        s.liquidate();

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();
        assertEq(s.hook(), address(0), "still nothing attached; the buy never landed");
        assertEq(address(deny), address(deny));
    }

    /// @notice Anyone may land them once the slot stands empty.
    function test_AnyoneAppliesTermsToAVacantSlot() public {
        Slot s = _slot(address(0));
        DenyBuys deny = _ripeDenial(s);

        vm.prank(bob);
        s.applyTerms();

        assertEq(s.hook(), address(deny), "the queued hook attached");
        assertEq(s.taxRateBps(), 10_000);
        assertFalse(s.hasRipeTerms(), "the queue is empty");
    }

    /// @notice While somebody is seated it is their call, and nobody else's.
    function test_OnlyTheOccupantAppliesTermsToTheirOwnSeat() public {
        Slot s = _slot(address(0));
        _seat(s, alice);
        DenyBuys deny = _ripeDenial(s);

        vm.prank(bob);
        vm.expectRevert(NotOccupant.selector);
        s.applyTerms();
        assertEq(s.hook(), address(0), "nothing moved under alice");

        vm.prank(alice);
        s.applyTerms();
        assertEq(s.hook(), address(deny), "she waived the wait herself");
        assertEq(s.occupant(), alice, "and kept her seat");
    }

    /// @notice Nothing ripe is nothing to apply.
    function test_ApplyingNothingIsRefused() public {
        Slot s = _slot(address(0));
        vm.prank(bob);
        vm.expectRevert(NoPendingTerms.selector);
        s.applyTerms();

        vm.prank(manager);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(600), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        vm.prank(bob);
        vm.expectRevert(NoPendingTerms.selector);
        s.applyTerms();
    }
}
