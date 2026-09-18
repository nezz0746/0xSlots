// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice What the slot charges and who receives it.
 * @dev A term group: the live copy and the queued copy share this shape.
 *      Append new fields at the end only.
 */
struct TaxTerms {
    /// Receives the rent, less any hook fee.
    address recipient;
    /// Basis points of the declared price per 30 days. 1..10_000.
    uint16 rateBps;
    /// Runway a buyer must fund, in seconds. Zero means no minimum.
    uint32 minRunwaySeconds;
}

/**
 * @notice The slot's hook and its configuration.
 * @dev Always proposed and applied as a whole. Append new fields at the end only.
 */
struct HookTerms {
    /// The hook contract. Zero for a slot with no hook, in which case `config`
    /// is zero too.
    address target;
    /// This slot's configuration for the hook. Opaque to the slot.
    bytes32 config;
}

/**
 * @notice What a hook asks of a slot: the callbacks it wants and a share of rent.
 * @dev Declared by the hook in `ISlotHook.hookOffer`. The slot keeps its own
 *      copy, taken when the hook attaches, and never reads the hook's current
 *      answer at payout or callback time. A different answer is an offer the
 *      manager may accept: the fee applies at once, the permissions at the next
 *      buy and only on a slot whose hook is mutable.
 *      Append new fields at the end only.
 */
struct HookOffer {
    /// Callbacks the hook wants, as `HookPermissionsLib` bits. Never zero.
    uint8 permissions;
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
    /// Whether the hook can change.
    bool mutableHook;
    TaxTerms taxTerms;
    HookTerms hookTerms;
}

/// @notice The terms in force.
struct Terms {
    TaxTerms taxTerms;
    HookTerms hookTerms;
    /// What the hook asks, as the slot last accepted it.
    HookOffer hookOffer;
}

/// @notice The terms queued for the next buy.
struct PendingTerms {
    /// Only the fields named by `mask` are meaningful.
    TaxTerms taxTerms;
    /// Meaningful when `mask` includes `TERM_HOOK`.
    HookTerms hookTerms;
    /// Meaningful when `mask` includes `TERM_HOOK_PERMISSIONS`: permissions the
    /// manager accepted from the attached hook.
    uint8 hookPermissions;
    uint8 mask;
    uint64 proposedAt;
    /// Whether the next transition will apply them.
    bool ripe;
}
