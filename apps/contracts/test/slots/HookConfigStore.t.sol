// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, HookTerms, HookOffer} from "../../src/types/SlotTypes.sol";
import {ISlotHook, SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../../src/libraries/HookPermissionsLib.sol";
import {HookConfigStore} from "../../src/hooks/base/HookConfigStore.sol";

/// @dev Refuses buys below a floor carried in a large, registered configuration.
contract FloorHook is ISlotHook, HookConfigStore {
    error BelowFloor(uint256 floor);

    struct Config {
        uint256 floor;
        string label;
        address[] allowlist;
    }

    function validateHookConfig(bytes32 id) external view {
        abi.decode(_hookConfig(id), (Config));
    }

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        o.permissions = HookPermissionsLib.BEFORE_BUY;
    }

    function beforeBuy(SlotContext calldata ctx) external view {
        Config memory c = abi.decode(_hookConfig(ctx.hookTerms.config), (Config));
        if (ctx.newPrice < c.floor) revert BelowFloor(c.floor);
    }

    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata) external {}
}

/// @notice A hook can take configuration of any size: the slot carries its id.
contract HookConfigStoreTest is Test {
    SlotFactory factory;
    FloorHook hook;
    address alice = makeAddr("alice");

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        hook = new FloorHook();
        vm.deal(alice, 100 ether);
    }

    function _config(uint256 floor) internal pure returns (bytes memory) {
        address[] memory allow = new address[](3);
        allow[0] = address(1);
        allow[1] = address(2);
        allow[2] = address(3);
        return abi.encode(FloorHook.Config({floor: floor, label: "a label well past thirty-two bytes", allowlist: allow}));
    }

    function _slot(bytes32 id) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: address(0),
            mutableTax: false, mutableRecipient: false, mutableHook: false,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: address(hook), config: id})
        }))));
    }

    function test_TheIdIsTheHashAndRegistrationIsIdempotent() public {
        bytes memory config = _config(1 ether);
        assertGt(config.length, 32);

        bytes32 id = hook.registerHookConfig(config);
        assertEq(id, keccak256(config));
        assertEq(hook.hookConfigOf(id), config);
        assertEq(hook.registerHookConfig(config), id, "the same bytes, the same id");
    }

    function test_ASlotCannotAttachAnUnregisteredId() public {
        bytes32 id = keccak256(_config(1 ether));
        vm.expectRevert(abi.encodeWithSelector(HookConfigStore.UnknownHookConfig.selector, id));
        _slot(id);
    }

    function test_TheHookReadsTheFullConfigurationOnCallbacks() public {
        bytes32 id = hook.registerHookConfig(_config(1 ether));
        Slot s = _slot(id);
        uint256 dep = s.minDepositForBuy(1 ether);

        uint256 low = s.minDepositForBuy(0.5 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(FloorHook.BelowFloor.selector, 1 ether));
        s.buy{value: low}(alice, 0.5 ether, low, 0);

        vm.prank(alice);
        s.buy{value: dep}(alice, 1 ether, dep, 0);
        assertEq(s.occupant(), alice);
    }

    function test_EmptyConfigurationIsRefused() public {
        vm.expectRevert(HookConfigStore.EmptyHookConfig.selector);
        hook.registerHookConfig("");
    }
}
