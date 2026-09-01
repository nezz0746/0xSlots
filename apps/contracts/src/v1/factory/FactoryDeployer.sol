// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Slot} from "../Slot.sol";
import {SlotConfig, SlotInitParams, ISlotEvents, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy} from "../interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {FactoryStorage} from "./FactoryStorage.sol";

/**
 * @title FactoryDeployer
 * @notice Creating slots.
 *
 * @dev Two entry points, `createSlot` and `createSlots`, and it is meant to
 *      stay that way — a new slot parameter goes into `SlotInitParams`, never
 *      into a new suffixed function.
 *
 *      `_validateConfig` lives here because it is the front door's bouncer: it
 *      enforces the same price/tax/bounty bounds the slot enforces internally,
 *      so a slot cannot be born outside them.
 */
abstract contract FactoryDeployer is FactoryStorage {
    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Deploy a new Slot as a BeaconProxy
    function createSlot(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) external returns (address slot) {
        _validateConfig(config, initParams);
        slot = _deploySlot(recipient, currency, config, initParams);
    }

    /// @notice Deploy multiple Slot BeaconProxies with the same params
    function createSlots(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams,
        uint256 count
    ) external returns (address[] memory slots) {
        if (count == 0) revert InvalidCount();
        _validateConfig(config, initParams);

        slots = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            slots[i] = _deploySlot(recipient, currency, config, initParams);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice Current Slot implementation address (from beacon)
    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _validateConfig(
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) internal view {
        if (config.mutableTax || config.mutableUtility || config.mutablePolicy) {
            if (config.manager == address(0))
                revert InvalidConfig_ManagerRequired();
        } else {
            if (config.manager != address(0))
                revert InvalidConfig_ManagerMustBeZero();
        }
        // Bounded, not merely non-zero. `taxPercentage` is one factor of the
        // `price * taxPercentage * elapsed` product in `_accrue`; leaving it
        // open was a second lever into the overflow that bricks a slot.
        if (
            initParams.taxPercentage == 0 ||
            initParams.taxPercentage > MAX_TAX_BPS
        ) revert InvalidTaxPercentage();


        // Reject non-contract utility addresses (e.g. EOA, wrong-chain address).
        // Without this check, getSlotInfo() will revert on the resulting slot.
        if (initParams.utility != address(0) && initParams.utility.code.length == 0)
            revert InvalidModule_NoCode();
    }

    function _deploySlot(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) internal returns (address slot) {
        // `factory` is set inside `initialize` now, in the proxy constructor —
        // atomically with creation, so a new slot is never briefly claimable.
        bytes memory initData = abi.encodeCall(
            Slot.initialize,
            (recipient, currency, config, initParams, address(this))
        );
        BeaconProxy proxy = new BeaconProxy(address(beacon), initData);
        slot = address(proxy);
        isSlot[slot] = true;
        emit SlotDeployed(
            slot,
            recipient,
            address(currency),
            config,
            initParams
        );
    }
}
