// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/slots/Slot.sol";
import {SlotFactory} from "../../src/slots/SlotFactory.sol";

/// @dev A distinguishable implementation, so an upgrade is observable rather
///      than merely reported.
contract SlotV2 is Slot {
    function version() external pure returns (string memory) {
        return "v2";
    }
}

/**
 * @notice `upgradeBeacon` is described as the single most consequential action
 *         in the protocol. Nothing exercised it. This does.
 */
contract BeaconUpgradeTest is Test {
    SlotFactory factory;
    address admin = address(0xA11CE);
    address stranger = address(0xBAD);

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (admin, address(new Slot()))
                    )
                )
            )
        );
    }

    function _slot() internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(0)),
            manager: admin,
            hook: address(0),
            taxPercentage: 1_000,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
    }

    /// @notice The admin can upgrade every slot at once.
    function test_TheAdminCanUpgradeEverySlotAtOnce() public {
        Slot a = _slot();
        Slot b = _slot();

        address v2 = address(new SlotV2());
        vm.prank(admin);
        factory.upgradeBeacon(v2);

        assertEq(factory.implementation(), v2);
        assertEq(SlotV2(payable(address(a))).version(), "v2");
        assertEq(SlotV2(payable(address(b))).version(), "v2", "all slots move together");
    }

    /// @notice And nobody else can.
    function test_AStrangerCannotUpgradeTheBeacon() public {
        address v2 = address(new SlotV2());
        vm.prank(stranger);
        vm.expectRevert();
        factory.upgradeBeacon(v2);
    }

    /// @notice Ownership of the beacon must follow `transferAdmin`, or the
    ///         handover silently keeps upgrade rights with the old admin —
    ///         which is worse than not transferring at all, because the new
    ///         admin believes they hold something they do not.
    function test_UpgradeRightsFollowTheAdminHandover() public {
        address next = address(0xBEEF);

        vm.prank(admin);
        factory.transferAdmin(next);

        address v2 = address(new SlotV2());

        vm.prank(admin);
        vm.expectRevert();
        factory.upgradeBeacon(v2);

        vm.prank(next);
        factory.upgradeBeacon(v2);
        assertEq(factory.implementation(), v2);
    }
}
