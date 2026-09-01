// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Slot} from "../Slot.sol";
import {SlotConfig, SlotInitParams, ISlotEvents, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
import {InvalidLiquidationBounty} from "../interfaces/SlotErrors.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy} from "../interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {FactoryStorage} from "./FactoryStorage.sol";

/**
 * @title FactoryHub
 * @notice The protocol's shared event bus and batch helpers.
 *
 * @dev `emitEvent` lets every slot publish through one address, so an indexer
 *      watches a single contract instead of discovering 237+ proxies. Authority
 *      is `isSlot`, which only the deploy path and the admin can extend.
 *
 *      `collectAll` is the batch flush. Note its try/catch: the whole point is
 *      that one unhealthy slot must not block collection for the others, which
 *      is why the read that decides whether to collect is inside the try.
 */
abstract contract FactoryHub is FactoryStorage {
    // ═══════════════════════════════════════════════════════════
    // BATCH OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Collect tax from multiple slots in a single transaction
    /// @param slots Array of slot addresses to collect from
    /// @return collected Amount collected from each slot (0 if skipped or nothing to collect)
    function collectAll(
        address[] calldata slots
    ) external returns (uint256[] memory collected) {
        collected = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            if (!isSlot[slots[i]]) continue;
            Slot s = Slot(slots[i]);
            // `taxOwed()` reads inside the try, not outside it. A slot whose
            // accrual reverts used to take the whole batch down with it from
            // this pre-check, so one broken slot blocked collection for every
            // other recipient in the array — the try/catch around `collect()`
            // never got the chance to do its job.
            try s.collect() {
                collected[i] = s.collectedTax();
            } catch {}
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PROTOCOL EVENT HUB
    // ═══════════════════════════════════════════════════════════

    /// @notice Emit a protocol-wide event (called by slots)
    function emitEvent(uint8 eventType, bytes calldata data) external {
        require(isSlot[msg.sender], "not a slot");
        emit SlotEvent(msg.sender, eventType, data);
    }

    /// @notice Register pre-existing slots deployed before this upgrade (admin only)
    function registerSlots(address[] calldata slots) external onlyAdmin {
        for (uint256 i = 0; i < slots.length; i++) {
            isSlot[slots[i]] = true;
        }
    }

}
