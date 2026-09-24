// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaxTerms, ModuleTerms, PendingTerms} from "../types/SlotTypes.sol";

/**
 * @title TermsLib
 * @notice Queueing and applying term changes, as data.
 *
 * @dev Knows nothing about money or modules. The slot validates before
 *      `propose`, and runs any side effect (paying out rent, reading module
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
    uint8 internal constant MODULE = 1 << 3;
    /// Not proposed: queued by accepting the attached module's new scopes.
    /// A queued `MODULE` supersedes it.
    uint8 internal constant SCOPES = 1 << 4;

    uint8 internal constant TAX_TERMS = TAX_RATE | RECIPIENT | MIN_RUNWAY;
    uint8 internal constant PROPOSABLE = TAX_TERMS | MODULE;
    uint8 internal constant ALL = PROPOSABLE | SCOPES;

    /// @dev Copy the masked fields into the queue and restart the clock.
    function propose(
        PendingTerms storage p,
        TaxTerms calldata taxTerms,
        ModuleTerms calldata module,
        uint8 mask
    ) internal {
        if (mask & TAX_RATE != 0) p.taxTerms.rateBps = taxTerms.rateBps;
        if (mask & RECIPIENT != 0) p.taxTerms.recipient = taxTerms.recipient;
        if (mask & MIN_RUNWAY != 0) p.taxTerms.minRunwaySeconds = taxTerms.minRunwaySeconds;
        if (mask & MODULE != 0) {
            p.moduleTerms.target = module.target;
            p.moduleTerms.settings = module.settings;
        }
        p.mask |= mask;
        p.proposedAt = uint64(block.timestamp);
    }

    /// @dev Queue the attached module's scopes and restart the clock.
    function queueScopes(PendingTerms storage p, uint16 scopes) internal {
        p.scopes = scopes;
        p.mask |= SCOPES;
        p.proposedAt = uint64(block.timestamp);
    }

    /// @dev Drop whichever of `mask` is queued. Returns what was dropped.
    function cancel(PendingTerms storage p, uint8 mask) internal returns (uint8 dropped) {
        dropped = p.mask & mask;
        clear(p, dropped);
        p.mask &= ~dropped;
        if (p.mask == 0) p.proposedAt = 0;
    }

    function isRipe(PendingTerms storage p, uint64 delay) internal view returns (bool) {
        return p.mask != 0 && block.timestamp >= p.proposedAt + delay;
    }

    /// @dev Copy every queued field into the live terms and empty the queue.
    ///      Returns what was queued. `SCOPES` is cleared, not copied: the
    ///      live scopes belong to the slot, which re-reads the module first.
    function applyQueued(
        PendingTerms storage p,
        TaxTerms storage liveTaxTerms,
        ModuleTerms storage liveModule
    ) internal returns (uint8 applied) {
        applied = p.mask;
        if (applied & TAX_RATE != 0) liveTaxTerms.rateBps = p.taxTerms.rateBps;
        if (applied & RECIPIENT != 0) liveTaxTerms.recipient = p.taxTerms.recipient;
        if (applied & MIN_RUNWAY != 0) liveTaxTerms.minRunwaySeconds = p.taxTerms.minRunwaySeconds;
        if (applied & MODULE != 0) {
            liveModule.target = p.moduleTerms.target;
            liveModule.settings = p.moduleTerms.settings;
        }
        clear(p, applied);
        p.mask = 0;
        p.proposedAt = 0;
    }

    /// @dev Empty the queued fields named by `mask`.
    function clear(PendingTerms storage p, uint8 mask) internal {
        if (mask & TAX_RATE != 0) p.taxTerms.rateBps = 0;
        if (mask & RECIPIENT != 0) p.taxTerms.recipient = address(0);
        if (mask & MIN_RUNWAY != 0) p.taxTerms.minRunwaySeconds = 0;
        if (mask & MODULE != 0) {
            delete p.moduleTerms;
            p.reviewedManifest = bytes32(0);
        }
        if (mask & SCOPES != 0) p.scopes = 0;
    }
}
