// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotConstants} from "../../src/slot/SlotConstants.sol";

import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

import {SlotInit, TaxTerms, ModuleTerms, Pending} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotLens, SlotInfo, SlotConstantsInfo} from "../../src/periphery/lens/SlotLens.sol";
import {NotManager, InvalidRecipient} from "../../src/errors/SlotErrors.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureModule} from "../../src/modules/MinimumTenureModule.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @notice The lens's bundled read must never disagree with the slot's own
///         getters — that is the only way a second implementation earns its place.
contract SlotLensTest is Test, SlotConstants {
    SlotFactory factory;
    SlotLens lens;
    Tok token;
    Slot slot;
    address occ = address(0xA11CE);

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        lens = SlotLens(
            address(
                new ERC1967Proxy(
                    address(new SlotLens()), abi.encodeCall(SlotLens.initialize, (address(this)))
                )
            )
        );
        token = new Tok();
        slot = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(token)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(0xF00D),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(1 days)
                        }),
                        moduleTerms: ModuleTerms({
                            module: address(new MinimumTenureModule()),
                            settings: abi.encode(uint256(7 days))
                        })
                    })
                ))
        );
        token.mint(occ, 1e24);
    }

    function _assertAgrees() internal view {
        SlotInfo memory i = lens.getSlotInfo(address(slot));
        assertEq(i.terms.taxTerms.recipient, slot.recipient());
        assertEq(address(i.currency), address(slot.currency()));
        assertEq(i.manager, slot.manager());
        assertEq(i.mutableTax, slot.mutableTax());
        assertEq(i.mutableRecipient, slot.mutableRecipient());
        assertEq(i.mutableModule, slot.mutableModule());
        assertEq(i.fee.bps, slot.fee().bps);
        assertEq(ScopesLib.pack(i.scopes), ScopesLib.pack(slot.scopes()));
        assertEq(i.terms.taxTerms.rateBps, slot.taxRateBps());
        assertEq(i.terms.taxTerms.minRunwaySeconds, slot.minRunwaySeconds());
        assertEq(i.terms.moduleTerms.module, slot.module());
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
        assertEq(i.hasRipeTerms, slot.hasRipeTerms());
        Pending memory __p1 = slot.pending();
        TaxTerms memory taxTerms = __p1.taxTerms;
        ModuleTerms memory module = ModuleTerms(__p1.nextModule.module, __p1.nextModule.settings);
        uint16 mask = __p1.mask;
        uint64 at = __p1.proposedAt;
        assertEq(i.pending.taxTerms.rateBps, taxTerms.rateBps);
        assertEq(i.pending.taxTerms.recipient, taxTerms.recipient);
        assertEq(i.pending.nextModule.module, module.module);
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

        slot.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}),
            ModuleTerms({module: address(0), settings: ""}),
            uint16(1)
        );
        _assertAgrees(); // queued, not ripe
        assertFalse(lens.getSlotInfo(address(slot)).hasRipeTerms);

        vm.warp(block.timestamp + 1 days + 1);
        _assertAgrees(); // ripe
        assertTrue(lens.getSlotInfo(address(slot)).hasRipeTerms);
    }

    function test_AgreesWhenInsolvent() public {
        uint256 dep = slot.minDepositForBuy(100e18) + 1e18;
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        slot.buy(occ, 100e18, dep, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        assertTrue(lens.getSlotInfo(address(slot)).isInsolvent);
        assertEq(lens.getSlotInfo(address(slot)).secondsUntilLiquidation, 0);
        _assertAgrees();
    }

    /// @notice The bundled constants must equal the individual ones.
    function test_ConstantsBundleEveryConstant() public view {
        SlotConstantsInfo memory c = lens.getSlotConstants(address(slot));
        assertEq(c.maxPrice, MAX_PRICE);
        assertEq(c.maxTaxBps, MAX_TAX_BPS);
        assertEq(c.basisPoints, BASIS_POINTS);
        assertEq(c.month, MONTH);
        assertEq(c.moduleCallbackGasLimit, MODULE_CALLBACK_GAS_LIMIT);
        assertEq(c.nativePayoutGasLimit, NATIVE_PAYOUT_GAS_LIMIT);
        assertEq(c.termsDelay, TERMS_DELAY);
        assertEq(c.maxMinRunway, MAX_MIN_RUNWAY);
        assertEq(c.termTaxRate, TERM_TAX_RATE);
        assertEq(c.termRecipient, TERM_RECIPIENT);
        assertEq(c.termMinRunway, TERM_MIN_RUNWAY);
        assertEq(c.termModule, TERM_MODULE);
        assertEq(c.termScopes, TERM_SCOPES);
    }

    /// @notice And they are the numbers the contract actually enforces.
    function test_ConstantsAreTheOnesEnforced() public {
        SlotConstantsInfo memory c = lens.getSlotConstants(address(slot));
        vm.startPrank(occ);
        token.approve(address(slot), type(uint256).max);
        vm.expectRevert(); // price above MAX_PRICE
        slot.buy(occ, c.maxPrice + 1, 1, 0);
        vm.stopPrank();

        vm.expectRevert(); // tax above MAX_TAX_BPS
        slot.proposeTerms(
            TaxTerms({
                recipient: address(0), rateBps: uint16(c.maxTaxBps + 1), minRunwaySeconds: 0
            }),
            ModuleTerms({module: address(0), settings: ""}),
            uint16(1)
        );
    }

    /// @notice Many slots in one call, each the same as asking for it alone.
    function test_ManySlotsReadAsOne() public {
        Slot other = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(0),
                        mutableTax: false,
                        mutableRecipient: false,
                        mutableModule: false,
                        taxTerms: TaxTerms({
                            recipient: address(0xBEEF), rateBps: uint16(100), minRunwaySeconds: 0
                        }),
                        moduleTerms: ModuleTerms({module: address(0), settings: ""})
                    })
                ))
        );
        address[] memory slots = new address[](2);
        slots[0] = address(slot);
        slots[1] = address(other);

        SlotInfo[] memory infos = lens.getSlotInfos(slots);
        assertEq(infos.length, 2);
        assertEq(keccak256(abi.encode(infos[0])), keccak256(abi.encode(lens.getSlotInfo(slots[0]))));
        assertEq(keccak256(abi.encode(infos[1])), keccak256(abi.encode(lens.getSlotInfo(slots[1]))));
        assertEq(infos[1].terms.taxTerms.recipient, address(0xBEEF));
    }

    /// @notice An address that is not a slot is an error, not a zero row.
    function test_ANonSlotReverts() public {
        vm.expectRevert();
        lens.getSlotInfo(address(token));
    }

    // ── upgrades ────────────────────────────────────────────────────────────

    function test_OnlyTheAdminUpgrades() public {
        address next = address(new SlotLens());
        vm.prank(address(0xBAD));
        vm.expectRevert(NotManager.selector);
        lens.upgradeToAndCall(next, "");

        lens.upgradeToAndCall(next, "");
        _assertAgrees(); // same reads after
    }

    function test_AdminHandsOver() public {
        vm.expectRevert(InvalidRecipient.selector);
        lens.transferAdmin(address(0));

        lens.transferAdmin(address(0xA));
        assertEq(lens.admin(), address(0xA));
        vm.expectRevert(NotManager.selector);
        lens.transferAdmin(address(this));
    }

    function test_InitializesOnce() public {
        vm.expectRevert();
        lens.initialize(address(this));
    }
}
