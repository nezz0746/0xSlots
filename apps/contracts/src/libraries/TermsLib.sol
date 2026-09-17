// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaxTerms, HookTerms} from "../types/SlotTypes.sol";

/// @notice Which terms are queued, and since when.
struct TermsQueue {
    uint8 mask;
    uint64 proposedAt;
    /// Accepted from the attached hook; queued under `HOOK_PERMISSIONS`.
    uint8 hookPermissions;
}

/**
 * @title TermsLib
 * @notice Queueing and applying term changes, as data.
 *
 * @dev Knows nothing about money or hooks. The slot validates before
 *      `propose`, and runs any side effect (paying out rent, reading hook
 *      permissions) around `applyQueued` based on the mask it returns.
 *
 *      Adding a term: a field on its struct, a bit below, one line in
 *      `propose`, `applyQueued` and `clear`. Bits are permanent: never reorder or
 *      reuse one.
 */
library TermsLib {
    uint8 internal constant TAX_RATE = 1 << 0;
    uint8 internal constant RECIPIENT = 1 << 1;
    uint8 internal constant MIN_RUNWAY = 1 << 2;
    uint8 internal constant HOOK = 1 << 3;
    /// Not proposed: queued by accepting the attached hook's new permissions.
    /// A queued `HOOK` supersedes it.
    uint8 internal constant HOOK_PERMISSIONS = 1 << 4;

    uint8 internal constant TAX_TERMS = TAX_RATE | RECIPIENT | MIN_RUNWAY;
    uint8 internal constant PROPOSABLE = TAX_TERMS | HOOK;
    uint8 internal constant ALL = PROPOSABLE | HOOK_PERMISSIONS;

    /// @dev Copy the masked fields into the queued copy and restart the clock.
    function propose(
        TermsQueue storage q,
        TaxTerms storage nextTaxTerms,
        HookTerms storage nextHook,
        TaxTerms calldata taxTerms,
        HookTerms calldata hook,
        uint8 mask
    ) internal {
        if (mask & TAX_RATE != 0) nextTaxTerms.rateBps = taxTerms.rateBps;
        if (mask & RECIPIENT != 0) nextTaxTerms.recipient = taxTerms.recipient;
        if (mask & MIN_RUNWAY != 0) nextTaxTerms.minRunwaySeconds = taxTerms.minRunwaySeconds;
        if (mask & HOOK != 0) {
            nextHook.target = hook.target;
            nextHook.config = hook.config;
        }
        q.mask |= mask;
        q.proposedAt = uint64(block.timestamp);
    }

    /// @dev Queue the attached hook's permissions and restart the clock.
    function queueHookPermissions(TermsQueue storage q, uint8 permissions) internal {
        q.hookPermissions = permissions;
        q.mask |= HOOK_PERMISSIONS;
        q.proposedAt = uint64(block.timestamp);
    }

    /// @dev Drop whichever of `mask` is queued. Returns what was dropped.
    function cancel(
        TermsQueue storage q,
        TaxTerms storage nextTaxTerms,
        HookTerms storage nextHook,
        uint8 mask
    ) internal returns (uint8 dropped) {
        dropped = q.mask & mask;
        clear(nextTaxTerms, nextHook, dropped);
        if (dropped & HOOK_PERMISSIONS != 0) q.hookPermissions = 0;
        q.mask &= ~dropped;
        if (q.mask == 0) q.proposedAt = 0;
    }

    function isRipe(TermsQueue storage q, uint64 delay) internal view returns (bool) {
        return q.mask != 0 && block.timestamp >= q.proposedAt + delay;
    }

    /// @dev Copy every queued field into the live copy and empty the queue.
    ///      Returns what was queued. `HOOK_PERMISSIONS` is cleared, not copied: the
    ///      live permissions belong to the slot, which re-reads the hook first.
    function applyQueued(
        TermsQueue storage q,
        TaxTerms storage liveTaxTerms,
        HookTerms storage liveHook,
        TaxTerms storage nextTaxTerms,
        HookTerms storage nextHook
    ) internal returns (uint8 applied) {
        applied = q.mask;
        if (applied & TAX_RATE != 0) liveTaxTerms.rateBps = nextTaxTerms.rateBps;
        if (applied & RECIPIENT != 0) liveTaxTerms.recipient = nextTaxTerms.recipient;
        if (applied & MIN_RUNWAY != 0) liveTaxTerms.minRunwaySeconds = nextTaxTerms.minRunwaySeconds;
        if (applied & HOOK != 0) {
            liveHook.target = nextHook.target;
            liveHook.config = nextHook.config;
        }
        clear(nextTaxTerms, nextHook, applied);
        q.mask = 0;
        q.proposedAt = 0;
        q.hookPermissions = 0;
    }

    function clear(TaxTerms storage nextTaxTerms, HookTerms storage nextHook, uint8 mask) internal {
        if (mask & TAX_RATE != 0) nextTaxTerms.rateBps = 0;
        if (mask & RECIPIENT != 0) nextTaxTerms.recipient = address(0);
        if (mask & MIN_RUNWAY != 0) nextTaxTerms.minRunwaySeconds = 0;
        if (mask & HOOK != 0) {
            nextHook.target = address(0);
            nextHook.config = bytes32(0);
        }
    }
}
