// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, ModuleFee, Pending} from "../../src/types/SlotTypes.sol";
import {ISlotModule, SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

/// @dev Refuses buys below a floor carried in a configuration far past one word.
contract FloorModule is AskModule {
    error BelowFloor(uint256 floor);

    struct Config {
        uint256 floor;
        string label;
        address[] allowlist;
    }

    function checkSettings(bytes calldata settings) external pure {
        abi.decode(settings, (Config));
    }

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        o.scopes = ScopesLib.BEFORE_BUY;
    }

    function beforeBuy(SlotContext calldata ctx) external view {
        Config memory c = abi.decode(ctx.moduleTerms.settings, (Config));
        if (ctx.newPrice < c.floor) revert BelowFloor(c.floor);
    }

    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}
}

/// @notice A module can take configuration of any size: the slot stores the bytes
///         and hands them to every callback, so the module keeps nothing.
contract LargeSettingsTest is Test {
    SlotFactory factory;
    FloorModule module;
    address alice = makeAddr("alice");

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        module = new FloorModule();
        vm.deal(alice, 100 ether);
    }

    function _config(uint256 floor) internal pure returns (bytes memory) {
        address[] memory allow = new address[](3);
        allow[0] = address(1);
        allow[1] = address(2);
        allow[2] = address(3);
        return abi.encode(
            FloorModule.Config({
                floor: floor, label: "a label well past thirty-two bytes", allowlist: allow
            })
        );
    }

    function _slot(bytes memory settings) internal returns (Slot) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(0),
                        mutableTax: false,
                        mutableRecipient: false,
                        mutableModule: false,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days
                        }),
                        moduleTerms: ModuleTerms({target: address(module), settings: settings})
                    })
                ))
        );
    }

    function test_TheSlotStoresTheBytesAsGiven() public {
        bytes memory settings = _config(1 ether);
        assertGt(settings.length, 32);
        Slot s = _slot(settings);
        assertEq(s.moduleTerms().settings, settings);
    }

    function test_ASlotCannotAttachSettingsTheModuleRefuses() public {
        vm.expectRevert();
        _slot(hex"01");
    }

    function test_TheModuleReadsTheFullConfigurationOnCallbacks() public {
        Slot s = _slot(_config(1 ether));
        uint256 dep = s.minDepositForBuy(1 ether);

        uint256 low = s.minDepositForBuy(0.5 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(FloorModule.BelowFloor.selector, 1 ether));
        s.buy{value: low}(alice, 0.5 ether, low, 0);

        vm.prank(alice);
        s.buy{value: dep}(alice, 1 ether, dep, 0);
        assertEq(s.occupant(), alice);
    }

    /// @notice Queued settings sit in `pendingTerms`, whole; a cancel empties
    ///         them, and landing copies them to the live terms.
    function test_QueuedSettingsLandWholeAndCancelClearsThem() public {
        Slot s = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: false,
                        mutableRecipient: false,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days
                        }),
                        moduleTerms: ModuleTerms({
                            target: address(module), settings: _config(1 ether)
                        })
                    })
                ))
        );
        TaxTerms memory none;
        ModuleTerms memory next = ModuleTerms({target: address(module), settings: _config(2 ether)});

        s.proposeTerms(none, next, s.TERM_MODULE());
        Pending memory p = s.pending();
        assertEq(p.module.settings, next.settings, "queued whole");
        assertEq(p.module.scopes, ScopesLib.BEFORE_BUY, "and the reviewed scopes kept beside it");

        s.cancelTerms(s.TERM_MODULE());
        p = s.pending();
        assertEq(p.module.settings.length, 0, "cancel empties the bytes");
        assertEq(p.module.scopes, 0);
        assertEq(p.mask, 0);

        s.proposeTerms(none, next, s.TERM_MODULE());
        vm.warp(block.timestamp + s.TERMS_DELAY());
        s.applyTerms();
        assertEq(s.moduleTerms().settings, next.settings, "landed");
        assertEq(s.pending().module.settings.length, 0, "and the queue is empty");
    }
}
