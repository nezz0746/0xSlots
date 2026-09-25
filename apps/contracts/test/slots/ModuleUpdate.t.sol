// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory, ModuleUpdate} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";
import {SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {NotASlot} from "../../src/errors/SlotErrors.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

/// @dev Scopes and a fee its owner can change at any time.
contract LensModule is AskModule {
    uint16 public scopeBits = ScopesLib.AFTER_SETTLE;
    uint16 public bps;
    address public to;

    function set(uint16 bps_, address to_) external {
        bps = bps_;
        to = to_;
    }

    function setScopes(uint16 s) external {
        scopeBits = s;
    }

    function _ask(bytes calldata) internal view override returns (Ask memory) {
        return Ask(scopeBits, bps, to);
    }

    function validateSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onInstall(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}
}

/// @notice `SlotFactory.moduleUpdate` says what `acceptFee` and `acceptScopes`
///         would do, and never reverts on a module that misbehaves.
contract ModuleUpdateTest is Test {
    uint16 constant SETTLE = ScopesLib.AFTER_SETTLE;
    uint16 constant SETTLE_AND_BUY = ScopesLib.AFTER_SETTLE | ScopesLib.AFTER_BUY;

    SlotFactory factory;
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
    }

    function _slot(
        address module,
        bool mutableRecipient,
        bool mutableModule
    ) internal returns (Slot) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: mutableRecipient,
                        mutableModule: mutableModule,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days
                        }),
                        moduleTerms: ModuleTerms({module: module, settings: ""})
                    })
                ))
        );
    }

    function test_NoModuleIsNoAnswer() public {
        ModuleUpdate memory u = factory.moduleUpdate(address(_slot(address(0), true, true)));
        assertFalse(u.answered);
        assertFalse(u.feeDiffers);
        assertFalse(u.scopesDiffer);
    }

    function test_NothingNewIsNothingToAccept() public {
        LensModule m = new LensModule();
        m.set(1_000, author);
        ModuleUpdate memory u = factory.moduleUpdate(address(_slot(address(m), true, true)));
        assertTrue(u.answered);
        assertEq(u.currentScopes, SETTLE);
        assertEq(u.currentFee.bps, 1_000);
        assertFalse(u.feeDiffers);
        assertFalse(u.scopesDiffer);
    }

    function test_ANewFeeAndNewScopesAreBothReported() public {
        LensModule m = new LensModule();
        m.set(1_000, author);
        Slot s = _slot(address(m), true, true);
        m.set(2_000, author);
        m.setScopes(SETTLE_AND_BUY);

        ModuleUpdate memory u = factory.moduleUpdate(address(s));
        assertEq(u.declaredFee.bps, 2_000);
        assertEq(u.declaredScopes, SETTLE_AND_BUY);
        assertTrue(u.feeDiffers);
        assertTrue(u.scopesDiffer);

        // And each accept the lens promised goes through.
        s.acceptFee(u.declaredFee);
        s.acceptScopes(u.declaredScopes);
    }

    function test_AFeeRiseOnAFixedRecipientIsNotOnOffer() public {
        LensModule m = new LensModule();
        Slot s = _slot(address(m), false, true);
        m.set(2_000, author);
        assertFalse(factory.moduleUpdate(address(s)).feeDiffers, "acceptFee would revert");

        // A cut still is.
        LensModule cheap = new LensModule();
        cheap.set(1_000, author);
        Slot t = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: false,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days
                        }),
                        moduleTerms: ModuleTerms({module: address(cheap), settings: ""})
                    })
                ))
        );
        cheap.set(500, author);
        assertTrue(factory.moduleUpdate(address(t)).feeDiffers);
    }

    function test_ScopesAreNotOnOfferWhenTheyCannotBeAccepted() public {
        LensModule m = new LensModule();
        Slot locked = _slot(address(m), true, false);
        m.setScopes(SETTLE_AND_BUY);
        assertFalse(factory.moduleUpdate(address(locked)).scopesDiffer, "module is immutable");

        LensModule n = new LensModule();
        Slot s = _slot(address(n), true, true);
        n.setScopes(SETTLE_AND_BUY);
        s.acceptScopes(SETTLE_AND_BUY);
        assertFalse(factory.moduleUpdate(address(s)).scopesDiffer, "already queued");

        LensModule o = new LensModule();
        Slot t = _slot(address(o), true, true);
        TaxTerms memory none;
        t.proposeTerms(none, ModuleTerms({module: address(new LensModule()), settings: ""}), 8);
        o.setScopes(SETTLE_AND_BUY);
        assertFalse(factory.moduleUpdate(address(t)).scopesDiffer, "a new module is queued");
    }

    function test_AModuleThatStopsAnsweringIsNoAnswerNotARevert() public {
        LensModule m = new LensModule();
        Slot s = _slot(address(m), true, true);
        m.setScopes(0); // out of range: the slot would not take it
        ModuleUpdate memory u = factory.moduleUpdate(address(s));
        assertFalse(u.answered);
        assertEq(u.currentScopes, SETTLE, "the slot's copy is still reported");
    }

    function test_OnlyItsOwnSlots() public {
        vm.expectRevert(NotASlot.selector);
        factory.moduleUpdate(address(this));
    }
}
