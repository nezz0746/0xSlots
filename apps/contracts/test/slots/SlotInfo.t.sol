// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotInfo, SlotConstantsInfo} from "../../src/SlotViews.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @notice The bundled read must never disagree with the individual ones —
///         that is the only way a second implementation earns its place.
contract SlotInfoTest is Test {
    SlotFactory factory;
    Tok token;
    Slot slot;
    address occ = address(0xA11CE);

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Tok();
        slot = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(token)),
            manager: address(this),
            hook: address(new MinimumTenureHook(7 days, "")),
            taxPercentage: 500,
            minDepositSeconds: 1 days,
            mutableTax: true,
            mutableHook: true
        }))));
        token.mint(occ, 1e24);
    }

    function _assertAgrees() internal view {
        SlotInfo memory i = slot.getSlotInfo();
        assertEq(i.recipient, slot.recipient());
        assertEq(address(i.currency), address(slot.currency()));
        assertEq(i.manager, slot.manager());
        assertEq(i.taxPercentage, slot.taxPercentage());
        assertEq(i.minDepositSeconds, slot.minDepositSeconds());
        assertEq(i.mutableTax, slot.mutableTax());
        assertEq(i.mutableHook, slot.mutableHook());
        assertEq(i.hook, slot.hook());
        assertEq(i.hookFlags.beforeBuy, slot.hookFlags().beforeBuy);
        assertEq(i.occupant, slot.occupant());
        assertEq(i.price, slot.price());
        assertEq(i.deposit, slot.deposit());
        assertEq(i.occupiedSince, slot.occupiedSince());
        assertEq(i.tenureId, slot.tenureId());
        assertEq(i.lastSettled, slot.lastSettled());
        assertEq(i.taxOwed, slot.taxOwed());
        assertEq(i.collectedTax, slot.collectedTax());
        assertEq(i.isVacant, slot.isVacant());
        assertEq(i.isInsolvent, slot.isInsolvent());
        assertEq(i.secondsUntilLiquidation, slot.secondsUntilLiquidation());
        assertEq(i.pendingApplies, slot.pendingApplies());
        (uint256 pt, address ph, bool hasT, bool hasH, uint64 at) = slot.pending();
        assertEq(i.pendingTaxPercentage, pt);
        assertEq(i.pendingHook, ph);
        assertEq(i.pendingHasTax, hasT);
        assertEq(i.pendingHasHook, hasH);
        assertEq(i.pendingProposedAt, at);
    }

    function test_AgreesWhenVacant() public view {
        _assertAgrees();
    }

    function test_AgreesWhenOccupied() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, dep, 100e18, 0);
        vm.stopPrank();
        _assertAgrees();
    }

    function test_AgreesWithTermsQueuedAndRipe() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, dep, 100e18, 0);
        vm.stopPrank();

        slot.proposeTerms(750, address(0), true, false);
        _assertAgrees();                     // queued, not ripe
        assertFalse(slot.getSlotInfo().pendingApplies);

        vm.warp(block.timestamp + 1 days + 1);
        _assertAgrees();                     // ripe
        assertTrue(slot.getSlotInfo().pendingApplies);
    }

    function test_AgreesWhenInsolvent() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, dep, 100e18, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        assertTrue(slot.getSlotInfo().isInsolvent);
        assertEq(slot.getSlotInfo().secondsUntilLiquidation, 0);
        _assertAgrees();
    }

    /// @notice The bundled constants must equal the individual ones.
    function test_ConstantsAgreeWithTheirGetters() public view {
        SlotConstantsInfo memory c = slot.getSlotConstants();
        assertEq(c.maxPrice, slot.MAX_PRICE());
        assertEq(c.maxTaxBps, slot.MAX_TAX_BPS());
        assertEq(c.basisPoints, slot.BASIS_POINTS());
        assertEq(c.month, slot.MONTH());
        assertEq(c.hookGas, slot.HOOK_GAS());
        assertEq(c.payoutGas, slot.PAYOUT_GAS());
        assertEq(c.termsDelay, slot.TERMS_DELAY());
    }

    /// @notice And they are the numbers the contract actually enforces.
    function test_ConstantsAreTheOnesEnforced() public {
        SlotConstantsInfo memory c = slot.getSlotConstants();
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        vm.expectRevert();                       // price above MAX_PRICE
        slot.buy(occ, 1, c.maxPrice + 1, 0);
        vm.stopPrank();

        vm.expectRevert();                       // tax above MAX_TAX_BPS
        slot.proposeTerms(c.maxTaxBps + 1, address(0), true, false);
    }
}
