// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotsTest} from "./Slots.t.sol";

/**
 * Settlement may never charge the same second twice, and never forgive one.
 *
 * `_settle` moves the clock to now and CARRIES whatever fell short of a whole
 * unit (`Occupancy.taxCarry`). Two earlier designs each failed one direction:
 * holding the clock back by the time paid for, with a floor, took a wei and
 * advanced nothing, so the same second was chargeable for ever through
 * `topUp(0)`; the ceiling that fixed it forgave up to a unit per settle, and a
 * settle every block turned that into up to half the rent. Carrying the
 * remainder makes the total independent of how often anybody settles.
 */
contract SettlementClockTest is SlotsTest {
    /// @dev A native slot whose per-second tax is deliberately fractional.
    function _fractional(
        uint256 taxRateBps,
        uint256 window
    ) internal returns (Slot s) {
        SlotInit memory init = _init(address(0), 0);
        init.currency = IERC20(address(0));
        init.taxTerms.rateBps = uint16(taxRateBps);
        init.taxTerms.minRunwaySeconds = uint32(window);
        return Slot(payable(factory.createSlot(init)));
    }

    /**
     * The whole exploit, at the smallest numbers that show it.
     *
     * 3,888,000 at 100%/month accrues 1.5 wei a second, so one second charges
     * one wei and one wei buys nothing back. Before the fix a hundred free
     * settles took the entire escrow without the clock moving.
     */
    function test_RepeatedSettlementCannotChargeTheSameSecondTwice() public {
        // No minimum window, so the 100-wei escrow below is admissible; the
        // bug is about the clock, not about the funding floor.
        Slot s = _fractional(10_000, 0);
        vm.deal(alice, 100);
        vm.prank(alice);
        s.buy{value: 100}(alice, 3_888_000, 100, 100);

        uint256 start = block.timestamp;
        vm.warp(start + 1);
        assertEq(s.taxOwed(), 1, "the second is worth one wei");

        vm.startPrank(bob);
        s.topUp(0);
        uint256 afterFirst = s.deposit();
        for (uint256 i; i < 99; ++i) s.topUp(0);
        vm.stopPrank();

        assertEq(block.timestamp, start + 1, "no time passed");
        assertEq(s.deposit(), afterFirst, "the escrow moved only once");
        assertEq(s.collectedTax(), 1, "one second, charged once");
        assertEq(s.occupant(), alice, "and alice still holds it");
    }

    /// @notice A realistic slot cannot be emptied at one timestamp either.
    /// @dev 1 ETH at 1.5%/month is 5.787 gwei a second, which is fractional —
    ///      so this is the ordinary case, not a contrived one. The escrow
    ///      funded a day and used to be drainable in 86,400 free calls.
    function test_AFundedOccupantSurvivesAFloodOfSettles() public {
        Slot s = _fractional(150, 1 days);
        uint256 price = 1 ether;
        uint256 dep = s.minDepositForBuy(price);

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        s.buy{value: dep}(alice, price, dep, 0);

        vm.warp(block.timestamp + 1);
        uint256 oneSecond = s.taxOwed();
        assertGt(oneSecond, 0, "a second is worth something here");

        vm.startPrank(bob);
        for (uint256 i; i < 500; ++i) s.topUp(0);
        vm.stopPrank();

        // Exactly one second, however many times it was asked for. A tolerance
        // would let the flood take five hundred seconds' tax and still pass.
        assertEq(s.deposit(), dep - oneSecond, "one second, charged once");
        assertEq(s.collectedTax(), oneSecond, "and collected once");
        assertFalse(s.isInsolvent(), "and nowhere near evictable");
        vm.expectRevert();
        s.liquidate();
    }

    /**
     * A window too short to price one unit of currency accrues zero now, but
     * is carried rather than lost — so a free settle cannot grind time
     * forward for nothing, which is the mirror of the bug above.
     */
    function test_AWindowTooShortToChargeIsCarriedNotLost() public {
        Slot s = _fractional(1, 30 days);
        uint256 price = 1e6; // 1 wei per ~2.6e7 seconds: a second buys nothing
        uint256 dep = s.minDepositForBuy(price);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        s.buy{value: dep}(alice, price, dep, 0);

        vm.warp(block.timestamp + 1);
        assertEq(s.taxOwed(), 0, "a second is worth nothing here");

        vm.startPrank(bob);
        for (uint256 i; i < 50; ++i) s.topUp(0);
        vm.stopPrank();

        assertEq(s.deposit(), dep, "nothing taken");
        assertEq(s.collectedTax(), 0, "nothing collected");

        // And the unpaid second is still owed, rather than ground away.
        vm.warp(block.timestamp + 30 days);
        assertGt(s.taxOwed(), 0, "the elapsed time still accrues");
    }

    /**
     * The grind the ceiling allowed, measured at its worst price band.
     *
     * 5,183,999 at 100%/month accrues 1.9999996 wei a second. Settled once an
     * hour that is 7,199 wei; settled every second under the old ceiling it
     * was 3,600 — half the rent destroyed by 3,600 free `topUp(0)` calls. The
     * carried remainder makes the two identical to the wei.
     */
    function test_SettlingEverySecondChargesWhatSettlingOnceDoes() public {
        Slot once = _fractional(10_000, 0);
        Slot ground = _fractional(10_000, 0);
        uint256 price = 5_183_999;
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        once.buy{value: 10_000}(alice, price, 10_000, 10_000);
        ground.buy{value: 10_000}(alice, price, 10_000, 10_000);
        vm.stopPrank();

        // `skip`, not `warp(start + i)`: under via-IR the optimizer may re-read
        // `block.timestamp` in place of a local copy, and the warps compound.
        vm.startPrank(bob);
        for (uint256 i = 1; i <= 3600; ++i) {
            skip(1);
            ground.topUp(0);
        }
        once.topUp(0);
        vm.stopPrank();

        assertEq(once.collectedTax(), 7_199, "an hour, settled once");
        assertEq(ground.collectedTax(), once.collectedTax(), "settled every second: the same");
    }

    /// @notice Tax over a long window is unchanged by the floor.
    /// @dev The fix rounds in the occupant's favour by at most one second, so
    ///      an ordinary settlement must still take the ordinary amount.
    function test_AnOrdinarySettlementIsUnaffected() public {
        Slot s = _fractional(150, 30 days);
        uint256 price = 1 ether;
        uint256 dep = s.minDepositForBuy(price);
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        s.buy{value: dep}(alice, price, dep, 0);

        vm.warp(block.timestamp + 10 days);
        uint256 owed = s.taxOwed();
        vm.prank(bob);
        s.topUp(0);

        assertEq(s.collectedTax(), owed, "took exactly what accrued");
        assertEq(s.deposit(), dep - owed, "and no more");
        assertEq(s.taxOwed(), 0, "settled up to now");
    }
}
