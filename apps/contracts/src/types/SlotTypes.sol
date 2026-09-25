// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice What the slot charges and who receives it.
 * @dev A term group: the live copy and the queued copy share this shape.
 *      Append new fields at the end only.
 */
struct TaxTerms {
    /// Receives the rent, less any module fee.
    address recipient;
    /// Basis points of the declared price per 30 days. 1..10_000.
    uint16 rateBps;
    /// Runway a buyer must fund, in seconds. Zero means no minimum.
    uint32 minRunwaySeconds;
}

/**
 * @notice The slot's module and its configuration.
 * @dev Always proposed and applied as a whole. Append new fields at the end only.
 */
struct ModuleTerms {
    /// The module contract. Zero for a slot with no module, in which case `settings`
    /// is empty too.
    address target;
    /// This slot's configuration for the module, as the module's `definition()`
    /// says to encode it. Opaque to the slot, handed to every callback.
    bytes settings;
}

/**
 * @notice A module's share of collected tax, and who receives it.
 * @dev Declared by the module in `ISlotModule.fee`. The slot keeps its own
 *      copy, taken when the module attaches, and never reads the module's
 *      current answer at payout time. A different answer is a fee the manager
 *      may accept with `acceptFee`, and it applies at once.
 *      Append new fields at the end only.
 */
struct ModuleFee {
    /// Share of collected tax, in basis points. 0..10_000.
    uint16 bps;
    /// Required when `bps` is non-zero.
    address recipient;
}

/// @notice Everything a slot needs at birth.
struct SlotInit {
    /// Zero for native ETH.
    IERC20 currency;
    /// Proposes term changes and hands the slot over. Required exactly when
    /// something is mutable, and forbidden otherwise.
    address manager;
    /// Whether the tax rate and minimum runway can change.
    bool mutableTax;
    /// Whether the recipient can change.
    bool mutableRecipient;
    /// Whether the module can change.
    bool mutableModule;
    TaxTerms taxTerms;
    ModuleTerms moduleTerms;
}

/// @notice The terms in force.
struct Terms {
    TaxTerms taxTerms;
    ModuleTerms moduleTerms;
}

/**
 * @notice A slot's module, as installed: which contract, its settings, and the
 *         scopes and fee the slot copied from it.
 * @dev One record, live and queued (`Pending.module`). Installing a module is
 *      copying a record in; removing it is deleting it. Ordered so `target`
 *      and `scopes`, read on every callback, share one storage word.
 *      Append new fields at the end only.
 */
struct InstalledModule {
    /// Zero for no module; the other fields are then empty.
    address target;
    /// Callbacks the slot calls, as `ScopesLib` bits. Copied from the module.
    uint16 scopes;
    /// The module's share of collected tax. Copied from the module.
    ModuleFee fee;
    /// This slot's settings for the module, handed to every callback.
    bytes settings;
}

/**
 * @notice Everything queued for the next buy, and since when.
 * @dev Stored exactly as `pending()` returns it. Whether it will land at the
 *      next buy is `hasRipeTerms()`. `TERM_MODULE` and `TERM_SCOPES` are never
 *      queued together: a proposed module replaces accepted scopes.
 */
struct Pending {
    /// Only the fields named by `mask` are meaningful.
    TaxTerms taxTerms;
    /// With `TERM_MODULE`: the proposed module, with the scopes and fee the
    /// manager reviewed. With `TERM_SCOPES`: only `scopes`, the new scopes
    /// accepted from the current module. Read again when it lands; different
    /// means dropped.
    InstalledModule module;
    /// Which terms are queued: `TERM_*` bits.
    uint16 mask;
    /// When the delay started. Every proposal restarts it.
    uint64 proposedAt;
}
