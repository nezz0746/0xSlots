// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";

import {SlotsTest, DenyBuys} from "./Slots.t.sol";
import {Slot} from "../../src/Slot.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
     * @dev This drained the whole deposit. `secondsFor(paid, price, taxRateBps)`
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
        init.taxTerms.rateBps = uint16(10_000);
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
     * @notice A buyer cannot be seated under terms a ripe proposal replaced.
     *
     * @dev REGRESSION, restated. `buy` applies the queue BEFORE asking the module,
     *      so a buyer always faces the module their purchase brings in. It used to
     *      be skippable by starving the gas the application needed; exits no
     *      longer apply terms, so there is no starvation path left to inherit.
     */
    function test_ABuyCannotSlipPastRipeTerms() public {
        Slot s = _slot(address(0));
        DenyBuys deny = new DenyBuys();
        vm.prank(manager);
        s.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(10_000), minRunwaySeconds: 0}), ModuleTerms({target: address(deny), settings: ""}), uint16(9));
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms());

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();

        assertEq(s.occupant(), address(0), "nobody bought under the old terms");
        assertTrue(s.hasRipeTerms(), "and the change is still waiting");
    }

}
