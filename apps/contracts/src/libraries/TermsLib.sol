// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaxTerms, AppTerms} from "../types/SlotTypes.sol";

/// @notice Which terms are queued, and since when.
struct TermsQueue {
    uint8 mask;
    uint64 proposedAt;
    /// Accepted from the attached app; queued under `SCOPES`.
    uint16 scopes;
}

/**
 * @title TermsLib
 * @notice Queueing and applying term changes, as data.
 *
 * @dev Knows nothing about money or apps. The slot validates before
 *      `propose`, and runs any side effect (paying out rent, reading app
 *      scopes) around `applyQueued` based on the mask it returns.
 *
 *      Adding a term: a field on its struct, a bit below, one line in
 *      `propose`, `applyQueued` and `clear`. Bits are permanent: never reorder or
 *      reuse one.
 */
library TermsLib {
    uint8 internal constant TAX_RATE = 1 << 0;
    uint8 internal constant RECIPIENT = 1 << 1;
    uint8 internal constant MIN_RUNWAY = 1 << 2;
    uint8 internal constant APP = 1 << 3;
    /// Not proposed: queued by accepting the attached app's new scopes.
    /// A queued `APP` supersedes it.
    uint8 internal constant SCOPES = 1 << 4;

    uint8 internal constant TAX_TERMS = TAX_RATE | RECIPIENT | MIN_RUNWAY;
    uint8 internal constant PROPOSABLE = TAX_TERMS | APP;
    uint8 internal constant ALL = PROPOSABLE | SCOPES;

    /// @dev Copy the masked fields into the queued copy and restart the clock.
    function propose(
        TermsQueue storage q,
        TaxTerms storage nextTaxTerms,
        AppTerms storage nextApp,
        TaxTerms calldata taxTerms,
        AppTerms calldata app,
        uint8 mask
    ) internal {
        if (mask & TAX_RATE != 0) nextTaxTerms.rateBps = taxTerms.rateBps;
        if (mask & RECIPIENT != 0) nextTaxTerms.recipient = taxTerms.recipient;
        if (mask & MIN_RUNWAY != 0) nextTaxTerms.minRunwaySeconds = taxTerms.minRunwaySeconds;
        if (mask & APP != 0) {
            nextApp.target = app.target;
            nextApp.settings = app.settings;
        }
        q.mask |= mask;
        q.proposedAt = uint64(block.timestamp);
    }

    /// @dev Queue the attached app's scopes and restart the clock.
    function queueScopes(TermsQueue storage q, uint16 scopes) internal {
        q.scopes = scopes;
        q.mask |= SCOPES;
        q.proposedAt = uint64(block.timestamp);
    }

    /// @dev Drop whichever of `mask` is queued. Returns what was dropped.
    function cancel(
        TermsQueue storage q,
        TaxTerms storage nextTaxTerms,
        AppTerms storage nextApp,
        uint8 mask
    ) internal returns (uint8 dropped) {
        dropped = q.mask & mask;
        clear(nextTaxTerms, nextApp, dropped);
        if (dropped & SCOPES != 0) q.scopes = 0;
        q.mask &= ~dropped;
        if (q.mask == 0) q.proposedAt = 0;
    }

    function isRipe(TermsQueue storage q, uint64 delay) internal view returns (bool) {
        return q.mask != 0 && block.timestamp >= q.proposedAt + delay;
    }

    /// @dev Copy every queued field into the live copy and empty the queue.
    ///      Returns what was queued. `SCOPES` is cleared, not copied: the
    ///      live scopes belong to the slot, which re-reads the app first.
    function applyQueued(
        TermsQueue storage q,
        TaxTerms storage liveTaxTerms,
        AppTerms storage liveApp,
        TaxTerms storage nextTaxTerms,
        AppTerms storage nextApp
    ) internal returns (uint8 applied) {
        applied = q.mask;
        if (applied & TAX_RATE != 0) liveTaxTerms.rateBps = nextTaxTerms.rateBps;
        if (applied & RECIPIENT != 0) liveTaxTerms.recipient = nextTaxTerms.recipient;
        if (applied & MIN_RUNWAY != 0) liveTaxTerms.minRunwaySeconds = nextTaxTerms.minRunwaySeconds;
        if (applied & APP != 0) {
            liveApp.target = nextApp.target;
            liveApp.settings = nextApp.settings;
        }
        clear(nextTaxTerms, nextApp, applied);
        q.mask = 0;
        q.proposedAt = 0;
        q.scopes = 0;
    }

    function clear(TaxTerms storage nextTaxTerms, AppTerms storage nextApp, uint8 mask) internal {
        if (mask & TAX_RATE != 0) nextTaxTerms.rateBps = 0;
        if (mask & RECIPIENT != 0) nextTaxTerms.recipient = address(0);
        if (mask & MIN_RUNWAY != 0) nextTaxTerms.minRunwaySeconds = 0;
        if (mask & APP != 0) {
            nextApp.target = address(0);
            nextApp.settings = bytes32(0);
        }
    }
}
