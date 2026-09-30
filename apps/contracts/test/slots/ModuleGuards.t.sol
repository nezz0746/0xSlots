// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";
import {LensModule} from "./ModuleUpdate.t.sol";

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";
import {SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {NotMutable, ModuleGasTooLow} from "../../src/errors/SlotErrors.sol";
import {TermsLib} from "../../src/libraries/TermsLib.sol";

/// @dev Refuses any buy that would displace a sitting occupant, for as long as
///      it declares `beforeBuy`. Its owner can stop declaring it.
contract KeepSeat is AskModule {
    error Protected();

    uint16 public scopeBits = ScopesLib.BEFORE_BUY;

    function setScopes(uint16 s) external {
        scopeBits = s;
    }

    function _ask(bytes calldata) internal view override returns (Ask memory a) {
        a.scopes = scopeBits;
    }

    function validateSettings(bytes calldata) external pure {}

    function beforeBuy(SlotContext calldata c) external pure {
        if (c.occupant != address(0)) revert Protected();
    }

    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onInstall(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}
}

/// @dev Must-succeed, and refuses to be told it was attached by a buy. Harmless
///      at creation, where its refusal would only fail the creator.
contract InstallBomb is AskModule {
    function _ask(bytes calldata) internal pure override returns (Ask memory a) {
        a.scopes = ScopesLib.ON_INSTALL | ScopesLib.AFTER_CALLBACKS_MUST_SUCCEED;
    }

    function validateSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onInstall(SlotContext calldata c) external pure {
        if (c.account != address(0)) revert("no");
    }

    function onUninstall(SlotContext calldata) external {}
}

/// @dev Must-succeed, and burns every unit of gas it is given on a settle.
contract SettleBurner is AskModule {
    uint256 public sink;

    function _ask(bytes calldata) internal pure override returns (Ask memory a) {
        a.scopes = ScopesLib.AFTER_SETTLE | ScopesLib.AFTER_CALLBACKS_MUST_SUCCEED;
    }

    function validateSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}

    function afterSettle(SlotContext calldata) external {
        while (true) sink++;
    }

    function onInstall(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}
}

/// @notice The guards around a slot's module: who judges a displacing buy,
///         where an accepted fee may be sent, and the gas a callback is owed.
contract ModuleGuardsTest is Test {
    SlotFactory factory;
    address author = makeAddr("author");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _slot(address module, bool mutableRecipient) internal returns (Slot) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: mutableRecipient,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days
                        }),
                        moduleTerms: ModuleTerms({module: module, settings: ""})
                    })
                ))
        );
    }

    function _seat(Slot s, address who, uint256 price) internal {
        uint256 dep = s.minDepositForBuy(price);
        uint256 cost = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: cost}(who, price, dep, 0);
    }

    /// @notice New scopes that stop asking to judge a buy land at that buy,
    ///         but the module governing the sitting occupant still judges it
    ///         first — as it does when a whole new module is queued.
    function test_DroppingBeforeBuyStillLetsTheOutgoingModuleJudge() public {
        KeepSeat m = new KeepSeat();
        Slot s = _slot(address(m), true);
        _seat(s, alice, 1 ether);

        m.setScopes(ScopesLib.AFTER_SETTLE);
        s.acceptScopes(ScopesLib.AFTER_SETTLE);
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms());

        uint256 dep = s.minDepositForBuy(2 ether);
        uint256 cost = s.quoteBuy(bob, dep);
        vm.prank(bob);
        vm.expectRevert(KeepSeat.Protected.selector);
        s.buy{value: cost}(bob, 2 ether, dep, 0);
        assertEq(s.occupant(), alice, "alice keeps the seat she paid to protect");
    }

    /// @notice Moving an accepted fee to a new recipient is a change of
    ///         destination, so a slot with a fixed recipient refuses it even at
    ///         the same rate.
    function test_ANewFeeRecipientNeedsMutableRecipient() public {
        LensModule m = new LensModule();
        m.set(1_000, author);
        Slot s = _slot(address(m), false);

        m.set(1_000, makeAddr("elsewhere"));
        ModuleFee memory offered = ModuleFee({bps: 1_000, recipient: makeAddr("elsewhere")});
        vm.expectRevert(NotMutable.selector);
        s.acceptFee(offered);

        m.set(500, author);
        s.acceptFee(ModuleFee({bps: 500, recipient: author}));
        assertEq(s.fee().bps, 500, "a lower fee to the same recipient lands");
    }

    /// @notice A caller cannot starve a module callback and have the failure
    ///         swallowed: short of the stipend, the call is refused; with gas
    ///         to spare, the same call goes through.
    function test_ACallbackIsNeverStarvedOnPurpose() public {
        LensModule m = new LensModule(); // declares `afterSettle`
        Slot s = _slot(address(m), true);
        _seat(s, alice, 1 ether);
        vm.warp(block.timestamp + 30 days);

        vm.expectRevert(ModuleGasTooLow.selector);
        s.liquidate{gas: 300_000}();

        s.liquidate();
        assertTrue(s.isVacant());
    }

    /// @notice A queued module that refuses `onInstall` cannot refuse every
    ///         buy: the call is capped and swallowed, and the buy seats.
    function test_AQueuedModuleCannotRefuseItsOwnInstall() public {
        Slot s = _slot(address(0), true);
        InstallBomb bomb = new InstallBomb();
        TaxTerms memory none;
        s.proposeTerms(none, ModuleTerms({module: address(bomb), settings: ""}), s.TERM_MODULE());
        vm.warp(block.timestamp + s.TERMS_DELAY());

        _seat(s, bob, 1 ether);
        assertEq(s.occupant(), bob, "the buy went through");
        assertEq(s.module(), address(bomb), "and the module attached");
    }

    /// @notice A queued module that no longer declares what was reviewed is
    ///         dropped, and the slot keeps the module it had.
    function test_ADroppedModuleLeavesTheOldOneInstalled() public {
        LensModule current = new LensModule();
        Slot s = _slot(address(current), true);
        LensModule next = new LensModule();
        TaxTerms memory none;
        s.proposeTerms(none, ModuleTerms({module: address(next), settings: ""}), s.TERM_MODULE());
        next.set(1_000, author); // now asks for a fee nobody reviewed
        vm.warp(block.timestamp + s.TERMS_DELAY());

        s.applyTerms();
        assertEq(s.module(), address(current), "the old module stays");
        assertEq(s.pending().mask, 0, "and the change is gone from the queue");
    }

    /// @notice One role re-proposing its own terms does not hold another
    ///         role's change back: each group ripens on its own clock.
    function test_TaxProposalsDoNotResetTheModuleClock() public {
        Slot s = _slot(address(0), true);
        LensModule next = new LensModule();
        TaxTerms memory none;
        s.proposeTerms(none, ModuleTerms({module: address(next), settings: ""}), s.TERM_MODULE());

        vm.warp(block.timestamp + s.TERMS_DELAY() - 60);
        TaxTerms memory rate;
        rate.rateBps = 700;
        ModuleTerms memory noModule;
        s.proposeTerms(rate, noModule, s.TERM_TAX_RATE());

        vm.warp(block.timestamp + 61);
        s.applyTerms();
        assertEq(s.module(), address(next), "the module landed on its own clock");
        assertEq(s.pending().mask, s.TERM_TAX_RATE(), "the tax change waits for its own");
        assertEq(s.taxRateBps(), 500);
        assertFalse(s.hasRipeTerms());
    }

    /// @notice The reported runway is exact: insolvent on that second, not a
    ///         second before.
    function test_SecondsUntilLiquidationIsExact() public {
        Slot s = _slot(address(0), true);
        _seat(s, alice, 1 ether);
        vm.warp(block.timestamp + 12 hours + 17); // leave a carried fraction
        s.topUp(0);

        uint256 left = s.secondsUntilLiquidation();
        assertGt(left, 1);
        vm.warp(block.timestamp + left - 1);
        assertFalse(s.isInsolvent(), "a second early, still solvent");
        vm.warp(block.timestamp + 1);
        assertTrue(s.isInsolvent(), "on the second");
    }

    /// @notice One slot that burns every unit of gas it is given cannot sink a
    ///         whole collection run.
    function test_CollectAllSurvivesASlotThatBurnsAllItsGas() public {
        Slot bad = _slot(address(new SettleBurner()), true);
        Slot good = _slot(address(0), true);
        _seat(bad, alice, 1 ether);
        _seat(good, bob, 1 ether);
        vm.warp(block.timestamp + 1 days);

        address[] memory slots = new address[](2);
        slots[0] = address(bad);
        slots[1] = address(good);
        uint256[] memory collected = factory.collectAll(slots);
        assertEq(collected[0], 0, "the burner is skipped");
        assertGt(collected[1], 0, "the rest is collected");
    }
}
