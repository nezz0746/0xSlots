// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaxTerms, ModuleTerms, Pending} from "../types/SlotTypes.sol";

/**
 * @title TermsLib
 * @notice Queueing and applying term changes, as data.
 *
 * @dev Knows nothing about money or modules. The slot validates before
 *      `propose`, writes the module's reviewed scopes and fee into the queue
 *      itself, and installs a queued module around `applyQueued`.
 *
 *      Adding a term: a field on its struct, a bit below, one line in
 *      `propose`, `applyQueued` and `clear`. Bits are permanent: never reorder or
 *      reuse one.
 */
library TermsLib {
    uint16 internal constant TAX_RATE = 1 << 0;
    uint16 internal constant RECIPIENT = 1 << 1;
    uint16 internal constant MIN_RUNWAY = 1 << 2;
    uint16 internal constant MODULE = 1 << 3;
    /// Not proposed: queued by accepting the attached module's new scopes.
    /// Never queued beside `MODULE`, which replaces it.
    uint16 internal constant SCOPES = 1 << 4;

    uint16 internal constant TAX_TERMS = TAX_RATE | RECIPIENT | MIN_RUNWAY;
    uint16 internal constant PROPOSABLE = TAX_TERMS | MODULE;
    uint16 internal constant ALL = PROPOSABLE | SCOPES;

    /// @dev Copy the masked fields into the queue and restart the clock.
    function propose(
        Pending storage p,
        TaxTerms calldata taxTerms,
        ModuleTerms calldata moduleTerms,
        uint16 mask
    ) internal {
        if (mask & TAX_RATE != 0) {
            p.taxTerms.rateBps = taxTerms.rateBps;
        }
        if (mask & RECIPIENT != 0) p.taxTerms.recipient = taxTerms.recipient;
        if (mask & MIN_RUNWAY != 0) p.taxTerms.minRunwaySeconds = taxTerms.minRunwaySeconds;
        if (mask & MODULE != 0) {
            p.nextModule.module = moduleTerms.module;
            p.nextModule.settings = moduleTerms.settings;
            // A new module replaces scopes accepted from the one it replaces.
            // The slot writes the reviewed scopes and fee right after this.
            p.mask &= ~SCOPES;
        }
        p.mask |= mask;
        p.proposedAt = uint64(block.timestamp);
    }

    /// @dev Queue the attached module's scopes and restart the clock.
    function queueScopes(Pending storage p, uint16 scopes) internal {
        p.nextModule.scopes = scopes;
        p.mask |= SCOPES;
        p.proposedAt = uint64(block.timestamp);
    }

    /// @dev Drop whichever of `mask` is queued. Returns what was dropped.
    function cancel(Pending storage p, uint16 mask) internal returns (uint16 dropped) {
        dropped = p.mask & mask;
        clear(p, dropped);
        p.mask &= ~dropped;
        if (p.mask == 0) p.proposedAt = 0;
    }

    function isRipe(Pending storage p, uint64 delay) internal view returns (bool) {
        return p.mask != 0 && block.timestamp >= p.proposedAt + delay;
    }

    /// @dev Copy the queued tax terms into the live ones and empty the queue.
    ///      Returns what was queued. The module is the slot's to install: it
    ///      reads `p.nextModule` before calling this, and checks it first.
    function applyQueued(
        Pending storage p,
        TaxTerms storage liveTaxTerms
    ) internal returns (uint16 applied) {
        applied = p.mask;
        if (applied & TAX_RATE != 0) liveTaxTerms.rateBps = p.taxTerms.rateBps;
        if (applied & RECIPIENT != 0) liveTaxTerms.recipient = p.taxTerms.recipient;
        if (applied & MIN_RUNWAY != 0) liveTaxTerms.minRunwaySeconds = p.taxTerms.minRunwaySeconds;
        clear(p, applied);
        p.mask = 0;
        p.proposedAt = 0;
    }

    /// @dev Empty the queued fields named by `mask`.
    function clear(Pending storage p, uint16 mask) internal {
        if (mask & TAX_RATE != 0) p.taxTerms.rateBps = 0;
        if (mask & RECIPIENT != 0) p.taxTerms.recipient = address(0);
        if (mask & MIN_RUNWAY != 0) p.taxTerms.minRunwaySeconds = 0;
        if (mask & MODULE != 0) delete p.nextModule;
        if (mask & SCOPES != 0) p.nextModule.scopes = 0;
    }
}
