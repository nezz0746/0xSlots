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
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED, MAX_PRICE, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

import {SlotAccounting} from "./SlotAccounting.sol";

/**
 * @title SlotAdmin
 * @notice Manager-controlled terms, and the delay that guards them.
 *
 * @dev Tax, utility and policy changes are PROPOSED here and applied on the
 *      next occupancy transition, never immediately. That deferral is the
 *      occupant's guarantee: the terms they bought into hold for their tenure.
 */
abstract contract SlotAdmin is SlotAccounting {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // MANAGER: PENDING UPDATES
    // ═══════════════════════════════════════════════════════════

    /// @notice Propose a new tax rate (applied on next ownership transition)
    function proposeTaxUpdate(uint256 newPct) external onlyManager {
        if (!mutableTax) revert TaxNotMutable();
        if (newPct == 0) revert InvalidTaxPercentage();

        pendingUpdate.newTaxPercentage = newPct;
        pendingUpdate.hasTaxUpdate = true;
        taxProposedAt = uint64(block.timestamp);

        emit TaxUpdateProposed(newPct);
        emit UpdateProposed(
            UpdateKind.Tax,
            bytes32(newPct),
            uint64(block.timestamp)
        );
    }

    // ── RETIRED: proposeUtilityUpdate / proposeModuleUpdate ────────────────
    //
    // The head (`utility`, slot 6) can no longer be SET, only vacated, via
    // `SlotModules.removeModule(utility)`.
    //
    // They were retired because they were an unverified back door. `addModule`
    // refuses anything the factory has not verified; `proposeUtilityUpdate`
    // checked only `code.length`, so a manager could not install an unvetted
    // module into the gallery but could install the very same contract as the
    // head, where it is called on exactly the same hooks. "Verified modules
    // only" was true of one door and not the other.
    //
    // The pending-update machinery below deliberately KEEPS its utility
    // branch: proxies may carry an in-flight proposal made before this upgrade,
    // and `_applyPendingUpdates` must still land it. Dropping that branch would
    // strand those silently — the manager saw the proposal accepted and it
    // would simply never happen. `cancelPendingUpdate(UpdateKind.Utility)`
    // stays for the same reason: it is now the only way to withdraw one.

    /// @notice Propose a new occupancy policy (applied on next ownership transition)
    /// @dev Gated on `mutablePolicy`, NOT `mutableUtility`. Swapping what a slot
    ///      does and swapping whether it can be taken from you are different
    ///      promises, and a holder who accepted the first has not accepted the
    ///      second.
    function proposePolicyUpdate(address newPolicy) external onlyManager {
        if (!mutablePolicy) revert PolicyNotMutable();
        if (newPolicy != address(0) && newPolicy.code.length == 0)
            revert InvalidModule_NoCode();
        pendingPolicyUpdate.newPolicy = newPolicy;
        pendingPolicyUpdate.hasPolicyUpdate = true;
        policyProposedAt = uint64(block.timestamp);

        emit PolicyUpdateProposed(newPolicy);
        emit UpdateProposed(
            UpdateKind.Policy,
            _asValue(newPolicy),
            uint64(block.timestamp)
        );
    }

    /// @notice Cancel the pending update for ONE dimension, leaving the others.
    ///
    /// @dev The reason this exists is `SlotCollective`, where tax, utility and
    ///      policy are three separate roles. While cancelling was all-or-nothing
    ///      the manager had to gate it on `DEFAULT_ADMIN_ROLE` — a tax manager
    ///      retracting their own proposal would otherwise have destroyed the
    ///      policy manager's queued one. So a role holder could propose but not
    ///      take it back, and the only address that could was the one the role
    ///      split exists to avoid needing.
    ///
    ///      Gated on the same mutability flag as the matching `propose`. That is
    ///      belt-and-braces — an immutable dimension can never hold a pending
    ///      update to cancel — but it keeps one rule per dimension rather than
    ///      two, so a future flag change cannot leave the pair disagreeing.
    function cancelPendingUpdate(UpdateKind kind) external onlyManager {
        if (kind == UpdateKind.Tax) {
            if (!mutableTax) revert TaxNotMutable();
            if (!pendingUpdate.hasTaxUpdate) revert NoPendingUpdate();
            pendingUpdate.newTaxPercentage = 0;
            pendingUpdate.hasTaxUpdate = false;
            taxProposedAt = 0;
        } else if (kind == UpdateKind.Utility) {
            if (!mutableUtility) revert ModuleNotMutable();
            if (!pendingUpdate.hasUtilityUpdate) revert NoPendingUpdate();
            pendingUpdate.newUtility = address(0);
            pendingUpdate.hasUtilityUpdate = false;
            utilityProposedAt = 0;
        } else {
            if (!mutablePolicy) revert PolicyNotMutable();
            if (!pendingPolicyUpdate.hasPolicyUpdate) revert NoPendingUpdate();
            delete pendingPolicyUpdate;
            policyProposedAt = 0;
        }

        emit UpdateCancelled(kind);
    }

    /// @notice Cancel every pending update at once.
    /// @dev Kept as the blunt instrument beside `cancelPendingUpdate`. Emits a
    ///      per-kind `UpdateCancelled` for each one it actually drops, so an
    ///      indexer following only the per-kind log never misses a clear.
    function cancelPendingUpdates() external onlyManager {
        bool hadTax = pendingUpdate.hasTaxUpdate;
        bool hadUtility = pendingUpdate.hasUtilityUpdate;
        bool hadPolicy = pendingPolicyUpdate.hasPolicyUpdate;

        if (!hadTax && !hadUtility && !hadPolicy) revert NoPendingUpdate();

        delete pendingUpdate;
        delete pendingPolicyUpdate;
        taxProposedAt = 0;
        utilityProposedAt = 0;
        policyProposedAt = 0;

        if (hadTax) emit UpdateCancelled(UpdateKind.Tax);
        if (hadUtility) emit UpdateCancelled(UpdateKind.Utility);
        if (hadPolicy) emit UpdateCancelled(UpdateKind.Policy);

        emit PendingUpdateCancelled();
    }

    /// @notice Update liquidation bounty (immediate, doesn't affect current occupant terms)
    /// @notice Retired. Liquidation pays no bounty.
    ///
    /// @dev Kept as a reverting stub rather than deleted: the selector is in
    ///      published ABIs and in `SlotGovernance`'s relay, and a caller
    ///      deserves to learn the feature is gone rather than have the call
    ///      succeed and do nothing.
    ///
    ///      `liquidationBountyBps` (slot 7) stays in storage and is now inert,
    ///      for the same reason `_legacyInitialized` does — it cannot move
    ///      without shifting every variable after it on 237+ live proxies.
    function setLiquidationBounty(uint256) external pure {
        revert LiquidationBountyRetired();
    }

}
