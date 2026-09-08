// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotsTest, DenyBuys} from "./Slots.t.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {InsufficientGasForTerms} from "../../src/SlotErrors.sol";

/**
 * The two defects this file was written to demonstrate, now asserting the fix.
 *
 * Written as exploit reproductions — a PASSING test meant the bug was live —
 * and both were real. They are inverted rather than deleted: an exploit that
 * once worked is the most valuable regression test there is, because it names
 * the exact shape of the mistake, and the comment saying "this used to drain
 * the deposit" is worth more beside the assertion than in a commit message.
 */
contract QuickAuditTest is SlotsTest {
    /**
     * @notice Settling a hundred times in one second costs one second of tax.
     *
     * @dev This drained the whole deposit. `secondsFor(paid, price, taxBps)`
     *      floors, so at a price whose per-second tax is fractional — 1.5 wei
     *      here — one wei of tax bought ZERO seconds of clock. The settle took
     *      the wei and left `lastSettled` where it was, so the next call in the
     *      same block was owed the same wei again. A hundred `topUp(0)` calls
     *      at the same timestamp emptied a hundred-wei deposit and let the
     *      caller liquidate a slot that was solvent a moment earlier.
     *
     *      The fix is one line in `_settle`: a payment that buys no time buys
     *      one second. Rounding in the occupant's favour was the alternative
     *      and is worse — it lets a slot accrue nothing at all.
     */
    function test_RepeatedSettlementCannotDrainDepositInOneBlock() public {
        SlotInit memory init = _init(address(0), 0);
        init.currency = IERC20(address(0));
        init.taxBps = 10_000;
        Slot s = Slot(payable(factory.createSlot(init)));
        vm.deal(alice, 100);
        vm.prank(alice);
        // 3,888,000 / 2,592,000 = 1.5 wei per second.
        s.buy{value: 100}(alice, 3_888_000, 100, 100);
        uint256 start = block.timestamp;
        vm.warp(start + 1);
        assertEq(s.taxOwed(), 1);

        vm.startPrank(bob);
        for (uint256 i; i < 100; ++i) s.topUp(0);
        vm.stopPrank();

        assertEq(block.timestamp, start + 1, "no time passed");
        // One second of tax, once — not once per call.
        assertEq(s.collectedTax(), 1, "a hundred settles, one second's tax");
        assertEq(s.deposit(), 99, "and the rest of the deposit is untouched");

        // Still solvent, so the liquidation that followed is refused.
        vm.prank(bob);
        vm.expectRevert();
        s.liquidate();
        assertEq(s.occupant(), alice, "alice keeps a slot she is still paying for");
    }

    /**
     * @notice A buy too gas-starved to apply ripe terms reverts, rather than
     *         buying under the old ones.
     *
     * @dev `_applyPending` was gas-guarded so a hostile hook could not block a
     *      slot, and `buy` inherited the guard. That let a buyer CHOOSE to skip
     *      it: send just enough gas for the buy and not enough for the terms,
     *      and a ripe hook that would have vetoed you never ran, while the tax
     *      rate stayed at the old one. The manager's change sat ripe and
     *      unapplied for as long as buyers kept starving it.
     *
     *      The guard still exists everywhere it was protecting somebody —
     *      settlement, release, liquidation — and `buy` alone now insists.
     *      Nobody is trapped by that: a buy is optional, and the person it
     *      inconveniences is the one who chose the gas.
     */
    function test_LowGasBuyCannotSkipRipeTerms() public {
        Slot s = _slot(address(0));
        DenyBuys deny = new DenyBuys();
        vm.prank(manager);
        s.proposeTerms(10_000, address(deny), bytes32(0), true, true);
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms());
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        // With gas to spare, the ripe hook applies and then vetoes.
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);

        // Starved of gas, it no longer slips past — it says so.
        vm.expectRevert(InsufficientGasForTerms.selector);
        s.buy{gas: 300_000}(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();

        assertEq(s.occupant(), address(0), "nobody bought under the old terms");
        assertTrue(s.hasRipeTerms(), "and the change is still waiting");
    }
}
