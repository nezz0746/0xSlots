// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ModuleTerms, Manifest} from "../types/SlotTypes.sol";

/**
 * @notice Everything a module is told, for every callback.
 *
 * @dev One shape for every callback. Fields not meaningful for a given callback are zero. `afterSettle` is the
 *      only one that populates `owed`/`paid`; `beforeBuy` is the only one where
 *      `newPrice` is a proposal rather than a fact.
 */
struct SlotContext {
    /// The slot itself — `msg.sender` WHEN THE SLOT IS CALLING, and passed
    /// explicitly so a module serving many slots can key on it.
    ///
    /// It is not proof of anything on its own. A module's `after` functions are
    /// external, so anyone may call one with a context they invented; only the
    /// slot fills this in honestly. See the note on `after` below.
    address slot;
    /// Who called the slot. NOT necessarily the occupant — `buy` lets one
    /// address pay and another be seated.
    address caller;
    /// The incoming occupant on a transition; the current one otherwise.
    address account;
    /// Who holds the slot right now. Zero when vacant.
    address occupant;
    /// When the current occupancy began. Zero when vacant.
    uint256 occupiedSince;
    /// Basis points per 30 days.
    uint256 taxRateBps;
    uint256 currentPrice;
    /// The price being proposed (`before`) or just set (`after`).
    uint256 newPrice;
    uint256 depositAmount;
    /// Tax that accrued, and what could actually be taken from the deposit.
    /// `owed > paid` means the occupant has run dry. `afterSettle` only.
    uint256 owed;
    uint256 paid;
    /// The slot's terms FOR THIS MODULE: its address (`target`) and `settings`.
    ///
    /// What lets one deployment serve every configuration, instead of a
    /// factory deploying a contract per setting. It is the slot's storage, not
    /// the module's, so a module reading it stays stateless.
    ModuleTerms moduleTerms;
}

/**
 * @notice What a module may do to a slot, unpacked: the callbacks it receives,
 *         and whether it may block an exit (`strict`).
 *
 * @dev Declared by the module as `Manifest.scopes` and copied when it attaches.
 *      Never re-read on its own: a module able to widen its own reach mid-tenure
 *      could veto an exit its occupant never agreed to. A change reaches the
 *      slot only when its manager accepts it, at the next buy, and never on a
 *      slot whose module is immutable.
 *
 *      Declared rather than encoded in the address. Uniswap v4 packs these into
 *      address bits, which is elegant and saves gas in the hottest loop in
 *      DeFi — but it costs a salt miner in the deploy pipeline, a redeploy
 *      whenever a scope is wrong, and an address that tells a reader nothing.
 *      This protocol is optimising for a handful of people understanding it in
 *      one sitting, which points the other way.
 *
 *      Scopes are also not optional for the `before` set, for a reason easy to
 *      miss: a `before` module is fail-CLOSED. Calling one optimistically on a
 *      contract that does not implement it reverts on the missing function, and
 *      a fail-closed revert means every buy on that slot is vetoed forever. The
 *      `after` set could be discovered by trying. The `before` set never can.
 */
struct Scopes {
    bool beforeBuy;
    bool beforeSelfAssess;
    bool afterBuy;
    bool afterRelease;
    bool afterLiquidate;
    bool afterSettle;
    /**
     * @notice Run this module's `after` callbacks uncapped, and let them revert.
     *
     * @dev The stipend exists so a module cannot block an eviction. A module that
     *      declares this gives that up on the slots that attach it: its `after`
     *      calls get all the gas the caller left and their revert propagates,
     *      so work that MUST land — a mint, a transfer, an announcement — can
     *      no longer be starved by a caller calibrating gas, and no longer
     *      fails silently.
     *
     *      The cost is real and belongs to whoever attaches it: such a slot is
     *      only as evictable as this module. Declare it only when a swallowed
     *      write would be worse than a stuck slot.
     *
     *      It grants less new power than it looks. `beforeBuy` is already
     *      uncapped and already propagates, so a module could always refuse every
     *      purchase for ever. What this adds is the ability to refuse an EXIT.
     */
    bool strict;
    /**
     * @notice Be told when this module is attached to a slot, so it can set up
     *         whatever it keeps per slot.
     *
     * @dev Fires from `initialize` and from the application of a queued module.
     *      Neither can happen during an eviction — terms land when a seat is
     *      taken, never when one is given up — so `strict` is honoured here
     *      like anywhere else: a module that must not be attached half-configured
     *      can refuse the attachment outright.
     */
    bool onInstall;
    /**
     * @notice Be told when this module stops being a slot's module, so it can close
     *         whatever {onInstall} opened.
     *
     * @dev Fires on the OUTGOING module, just before a queued module replaces it or a
     *      detach clears it, while the slot's terms still describe the one
     *      being removed.
     *
     *      Capped and swallowed ALWAYS, `strict` or not. A module that could
     *      refuse its own removal would be a module a manager can never replace,
     *      and the slot would be stuck with it for ever. Whatever this does
     *      must therefore be optional to the module's correctness — the same trade
     *      as every other `after`.
     */
    bool onUninstall;
}

/**
 * @title ISlotModule
 * @notice The one way to extend a slot.
 *
 * @dev ── The whole rule ──────────────────────────────────────────────────
 *
 *      `before` decides and may refuse. `after` records and cannot.
 *
 *      Everything else follows from it:
 *
 *      - `before` is `view`, so it cannot write and therefore cannot reenter.
 *        That is what makes it safe to call without a gas cap.
 *      - `after` is gas-capped and its revert is swallowed, so it cannot block
 *        a buy — and above all cannot block a liquidation, which this protocol
 *        treats as unconditional for every module that does not declare `strict`.
 *        One that does trades that guarantee for delivery; see {Scopes}.
 *
 *      A module that wants to record something about a decision does it in the
 *      matching `after`. There is deliberately no way to write during `before`.
 *
 *      ── `after` callbacks are world-callable ────────────────────────────
 *
 *      They are `external` and state-changing, so a module must assume `ctx` is
 *      whatever the caller wrote. When the SLOT calls, every field is built
 *      from its own storage and is true; when anybody else does, none of it is.
 *
 *      Two ways to be safe, and the choice is the module author's:
 *
 *        - `require(msg.sender == ctx.slot)` — cheap, and authenticates the
 *          whole context at once. Fine for a lenient module.
 *        - read the slot instead of the argument — `occupant()`, `moduleTerms()`
 *          — which costs a staticcall and is indifferent to who is calling.
 *          Preferable for a `strict` module, where a revert is a stuck slot.
 *
 *      What is NOT safe is keying storage on `ctx` without either.
 *
 *      ── One module per slot ───────────────────────────────────────────────
 *
 *      Exactly one, and the core makes exactly one capped call per callback —
 *      so the cap bounds the whole of what a slot's module may cost, with no
 *      subtree hiding behind it.
 *
 *      A slot that wants several behaviours composes them in ONE module, written
 *      as one contract. Fanning out to a list of children in userland buys
 *      nothing the author of a purpose-built module cannot do directly, and costs
 *      the stipend split between callees and a `msg.sender` that is no longer
 *      the slot.
 */
interface ISlotModule {
    /**
     * @notice Revert if `settings` is not a configuration this module accepts.
     *
     * @dev Called when the module is proposed or attached, so a misconfiguration
     *      is refused at the only moment somebody is around to fix it.
     *
     *      Not optional. `settings` is opaque to the slot: only the module knows
     *      whether given bytes mean anything. Left unchecked, a slot attaches
     *      a module with data it will reject on every callback, and since
     *      `before` is fail-closed, that is a slot nobody can ever buy.
     *
     *      A module that takes no configuration implements this as a no-op and
     *      thereby accepts anything, including nothing. Say so deliberately.
     */
    function checkSettings(bytes calldata settings) external view;

    /**
     * @notice What this module asks of a slot configured with `settings`: the
     *         callbacks it wants and its share of rent.
     *
     * @dev A request, not a setting. The slot copies it when the module attaches,
     *      and later only when its manager calls `grant`: a new fee
     *      at once, new scopes at the next buy and only if the slot's
     *      module is mutable. Payouts and callbacks use the slot's copy and
     *      never call back here, so a module can neither make an eviction depend
     *      on it nor change what it takes from rent already earned. A module whose
     *      manifest a manager ignores may refuse service; that is the module's lever,
     *      and the manager's risk.
     *
     *      `view`, not `pure`: a module may answer from storage, and that is a
     *      legitimate module rather than an edge case.
     *
     *      `scopes` must be non-zero and use only `ScopesLib` bits. A zero fee
     *      takes nothing; a non-zero `feeBps` needs a recipient and may not
     *      exceed 10_000.
     */
    function manifest(bytes calldata settings) external view returns (Manifest memory);

    // ─── decisions: `view`, revert to veto ──────────────────────────────────

    function beforeBuy(SlotContext calldata ctx) external view;

    function beforeSelfAssess(SlotContext calldata ctx) external view;

    // ─── effects: capped, swallowed, cannot change the outcome ──────────────

    function afterBuy(SlotContext calldata ctx) external;

    function afterRelease(SlotContext calldata ctx) external;

    function afterLiquidate(SlotContext calldata ctx) external;

    function afterSettle(SlotContext calldata ctx) external;

    /// @notice This module is now this slot's module. `msg.sender` is the slot.
    function onInstall(SlotContext calldata ctx) external;

    /// @notice This module is no longer this slot's module. `msg.sender` is the slot.
    /// @dev Never fatal, even for a `strict` module: see {Scopes-onUninstall}.
    function onUninstall(SlotContext calldata ctx) external;
}
