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
}
