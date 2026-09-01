// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

import {SlotAccounting} from "./SlotAccounting.sol";

/**
 * @title SlotViews
 * @notice Reads.
 *
 * @dev Includes the deprecated `module()` / `mutableModule()` aliases. Those
 *      are not dead weight — third-party embeds hold those selectors and will
 *      never be redeployed. They stay.
 */
abstract contract SlotViews is SlotAccounting {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════

    /// @notice Current occupant. Hand-written rather than an auto-getter
    ///         because `_occupant` is internal.
    function occupant() public view override returns (address) {
        return _occupant;
    }

    function price() public view override returns (uint256) {
        return _price;
    }

    function deposit() public view override returns (uint256) {
        return _deposit;
    }

    function taxOwed() public view returns (uint256) {
        address occ = occupant();
        if (occ == address(0)) return 0;
        uint256 elapsed = block.timestamp - lastSettled;
        // Mirrors `_accrue`'s `mulDiv`. A view that reverts is not harmless:
        // `getSlotInfo`, `isInsolvent` and `SlotFactory.collectAll` all read
        // through here, so an overflow made a broken slot un-observable too.
        return Math.mulDiv(price(), taxPercentage * elapsed, MONTH * BASIS_POINTS);
    }

    function secondsUntilLiquidation() public view returns (uint256) {
        if (occupant() == address(0)) return type(uint256).max;
        uint256 owed = taxOwed();
        uint256 dep = deposit();
        uint256 remaining = dep > owed ? dep - owed : 0;
        uint256 taxNumerator = price() * taxPercentage;
        if (taxNumerator == 0) return type(uint256).max;
        return (remaining * MONTH * BASIS_POINTS) / taxNumerator;
    }

    function isInsolvent() public view returns (bool) {
        if (occupant() == address(0)) return false;
        return taxOwed() >= deposit();
    }

    function isVacant() public view returns (bool) {
        return occupant() == address(0);
    }

    function getPendingUpdate() external view returns (PendingUpdate memory) {
        return pendingUpdate;
    }

    /// @notice The pending update for one dimension, in the shape the per-kind
    ///         events use.
    /// @dev Reaches across both storage structs so a caller can ask about any
    ///      kind uniformly. `getPendingUpdate()` still returns the raw
    ///      tax-and-utility struct and has no policy equivalent — this is the
    ///      one that covers all three.
    /// @return isSet Whether anything is queued for `kind`.
    /// @return value The proposed value: raw basis points for `Tax`, the
    ///         left-padded address for `Utility` and `Policy`.
    /// @return proposedAt When it was queued. Zero with `isSet` true means it
    ///         predates the timestamp being recorded.
    function pendingUpdateOf(
        UpdateKind kind
    ) external view returns (bool isSet, bytes32 value, uint64 proposedAt) {
        if (kind == UpdateKind.Tax) {
            return (
                pendingUpdate.hasTaxUpdate,
                bytes32(pendingUpdate.newTaxPercentage),
                taxProposedAt
            );
        }
        if (kind == UpdateKind.Utility) {
            return (
                pendingUpdate.hasUtilityUpdate,
                _asValue(pendingUpdate.newUtility),
                utilityProposedAt
            );
        }
        return (
            pendingPolicyUpdate.hasPolicyUpdate,
            _asValue(pendingPolicyUpdate.newPolicy),
            policyProposedAt
        );
    }

    // ── deprecated getters ──────────────────────────────────────
    // The storage moved to clearer names (`utility`, `mutableUtility`); these
    // keep the selectors that deployed callers and old ABIs hold. Remove in
    // the next major version.

    /// @notice Deprecated name for `utility()`.
    function module() external view returns (address) {
        return utility;
    }

    /// @notice Deprecated name for `mutableUtility()`.
    function mutableModule() external view returns (bool) {
        return mutableUtility;
    }

    /// @notice Returns complete slot state in a single call
    function getSlotInfo() external view returns (SlotInfo memory info) {
        info.recipient = recipient;
        info.currency = address(currency);
        info.manager = manager;
        info.mutableTax = mutableTax;
        info.mutableUtility = mutableUtility;
        info.mutablePolicy = mutablePolicy;

        info.occupant = occupant();
        info.price = price();
        info.taxPercentage = taxPercentage;
        info.utility = utility;
        info.liquidationBountyBps = liquidationBountyBps;
        info.minDepositSeconds = minDepositSeconds;

        info.deposit = deposit();
        info.collectedTax = collectedTax;
        info.taxOwed = taxOwed();
        info.lastSettled = lastSettled;
        info.secondsUntilLiquidation = secondsUntilLiquidation();
        info.insolvent = isInsolvent();

        // Utility info — guard with code-size check to avoid reverts when
        // the utility address has no deployed code (try/catch does not catch
        // ABI-decode failures from empty returndata).
        if (utility != address(0) && utility.code.length > 0) {
            IUtility mod = IUtility(utility);
            try mod.name() returns (string memory n) {
                info.utilityName = n;
            } catch {}
            try mod.version() returns (string memory v) {
                info.utilityVersion = v;
            } catch {}
            try mod.feeBps() returns (uint256 f) {
                info.utilityFeeBps = f;
            } catch {}
            try mod.feeRecipient() returns (address r) {
                info.utilityFeeRecipient = r;
            } catch {}
            try mod.metadataURI() returns (string memory u) {
                info.utilityURI = u;
            } catch {}
        }

        info.hasPendingTax = pendingUpdate.hasTaxUpdate;
        info.pendingTaxPercentage = pendingUpdate.newTaxPercentage;
        info.hasPendingUtility = pendingUpdate.hasUtilityUpdate;
        info.pendingUtility = pendingUpdate.newUtility;

        info.occupancyPolicy = occupancyPolicy;
        info.occupiedSince = occupiedSince;
        info.hasPendingPolicy = pendingPolicyUpdate.hasPolicyUpdate;
        info.pendingPolicy = pendingPolicyUpdate.newPolicy;

        info.taxProposedAt = taxProposedAt;
        info.utilityProposedAt = utilityProposedAt;
        info.policyProposedAt = policyProposedAt;
    }

}
