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
    /// is zero too.
    address target;
    /// This slot's configuration for the module. Opaque to the slot.
    bytes32 settings;
}

/**
 * @notice What a module asks of a slot: the callbacks it wants and a share of rent.
 * @dev Declared by the module in `ISlotModule.manifest`. The slot keeps its own
 *      copy, taken when the module attaches, and never reads the module's current
 *      answer at payout or callback time. A different answer is a manifest the
 *      manager may accept: the fee applies at once, the scopes at the next
 *      buy and only on a slot whose module is mutable.
 *      Append new fields at the end only.
 */
struct Manifest {
    /// Callbacks the module wants, as `ScopesLib` bits. Never zero.
    uint16 scopes;
    /// Share of collected rent, in basis points. 0..10_000.
    uint16 feeBps;
    /// Required when `feeBps` is non-zero.
    address feeRecipient;
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
    /// What the module asks, as the slot last accepted it.
    Manifest manifest;
}

/// @notice The terms queued for the next buy.
struct PendingTerms {
    /// Only the fields named by `mask` are meaningful.
    TaxTerms taxTerms;
    /// Meaningful when `mask` includes `TERM_MODULE`.
    ModuleTerms moduleTerms;
    /// Meaningful when `mask` includes `TERM_SCOPES`: scopes the
    /// manager accepted from the attached module.
    uint16 scopes;
    uint8 mask;
    uint64 proposedAt;
    /// Whether the next transition will apply them.
    bool ripe;
}
