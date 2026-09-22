// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, ModuleTerms, PendingTerms} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotInfo, SlotConstantsInfo} from "../../src/slot/SlotViews.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureModule} from "../../src/modules/MinimumTenureModule.sol";

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
            currency: IERC20(address(token)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(0xF00D), rateBps: uint16(500), minRunwaySeconds: uint32(1 days)}),
            moduleTerms: ModuleTerms({target: address(new MinimumTenureModule()), settings: bytes32(uint256(7 days))})
        }))));
        token.mint(occ, 1e24);
    }

    function _assertAgrees() internal view {
        SlotInfo memory i = slot.getSlotInfo();
        assertEq(i.terms.taxTerms.recipient, slot.recipient());
        assertEq(address(i.currency), address(slot.currency()));
        assertEq(i.manager, slot.manager());
        assertEq(i.mutableTax, slot.mutableTax());
        assertEq(i.mutableRecipient, slot.mutableRecipient());
        assertEq(i.mutableModule, slot.mutableModule());
        assertEq(i.terms.manifest.feeBps, slot.manifest().feeBps);
        assertEq(i.terms.manifest.scopes, slot.manifest().scopes);
        assertEq(i.terms.taxTerms.rateBps, slot.taxRateBps());
        assertEq(i.terms.taxTerms.minRunwaySeconds, slot.minRunwaySeconds());
        assertEq(i.terms.moduleTerms.target, slot.module());
        assertEq(i.terms.moduleTerms.settings, slot.moduleTerms().settings);
        assertEq(i.scopes.beforeBuy, slot.scopes().beforeBuy);
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
        assertEq(i.pending.ripe, slot.hasRipeTerms());
        PendingTerms memory __p1 = slot.pendingTerms();
        TaxTerms memory taxTerms = __p1.taxTerms;
        ModuleTerms memory module = __p1.moduleTerms;
        uint8 mask = __p1.mask;
        uint64 at = __p1.proposedAt;
        assertEq(i.pending.taxTerms.rateBps, taxTerms.rateBps);
        assertEq(i.pending.taxTerms.recipient, taxTerms.recipient);
        assertEq(i.pending.moduleTerms.target, module.target);
        assertEq(i.pending.mask, mask);
        assertEq(i.pending.proposedAt, at);
    }

    function test_AgreesWhenVacant() public view {
        _assertAgrees();
    }

    function test_AgreesWhenOccupied() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, 100e18, dep, 0);
        vm.stopPrank();
        _assertAgrees();
    }

    function test_AgreesWithTermsQueuedAndRipe() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, 100e18, dep, 0);
        vm.stopPrank();

        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), ModuleTerms({target: address(0), settings: bytes32(0)}), uint8(1));
        _assertAgrees();                     // queued, not ripe
        assertFalse(slot.getSlotInfo().pending.ripe);

        vm.warp(block.timestamp + 1 days + 1);
        _assertAgrees();                     // ripe
        assertTrue(slot.getSlotInfo().pending.ripe);
    }

    function test_AgreesWhenInsolvent() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, 100e18, dep, 0);
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
        assertEq(c.moduleGas, slot.MODULE_GAS());
        assertEq(c.payoutGas, slot.PAYOUT_GAS());
        assertEq(c.termsDelay, slot.TERMS_DELAY());
    }

    /// @notice And they are the numbers the contract actually enforces.
    function test_ConstantsAreTheOnesEnforced() public {
        SlotConstantsInfo memory c = slot.getSlotConstants();
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        vm.expectRevert();                       // price above MAX_PRICE
        slot.buy(occ, c.maxPrice + 1, 1, 0);
        vm.stopPrank();

        vm.expectRevert();                       // tax above MAX_TAX_BPS
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(c.maxTaxBps + 1), minRunwaySeconds: 0}), ModuleTerms({target: address(0), settings: bytes32(0)}), uint8(1));
    }
}
