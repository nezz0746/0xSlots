// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Everything a hook is told, for every callback.
 *
 * @dev ONE shape for all eight hooks, rather than a rich struct for decisions
 *      and loose deltas for notifications. The previous design had exactly that
 *      split — nine fields for a policy, three loose arguments for a module —
 *      and it meant learning two vocabularies to extend one slot.
 *
 *      Fields not meaningful for a given callback are zero. `afterSettle` is the
 *      only one that populates `owed`/`paid`; `beforeBuy` is the only one where
 *      `newPrice` is a proposal rather than a fact.
 */
struct SlotContext {
    /// The slot itself. Always `msg.sender`, passed explicitly so a hook
    /// serving many slots does not have to trust its own call frame.
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
    uint256 taxBps;
    uint256 currentPrice;
    /// The price being proposed (`before`) or just set (`after`).
    uint256 newPrice;
    uint256 depositAmount;
    /// Tax that accrued, and what could actually be taken from the deposit.
    /// `owed > paid` means the occupant has run dry. `afterSettle` only.
    uint256 owed;
    uint256 paid;
    /// The slot's configuration FOR THIS HOOK, verbatim from `Slot.hookData`.
    ///
    /// What lets one deployment serve every configuration, instead of a
    /// factory deploying a contract per setting. It is the slot's storage, not
    /// the hook's — so a hook reading it stays stateless, and a slot whose
    /// `mutableHook` is false has both halves of its rules frozen.
    ///
    /// Zero means the slot configured nothing. A hook whose behaviour is fully
    /// determined by its own address ignores this field entirely.
    bytes32 hookData;
}

/**
 * @notice Which callbacks a hook wants.
 *
 * @dev Declared by the hook and read ONCE when it is attached, then
 *      snapshotted. Not re-read: a hook able to widen its own reach mid-tenure
 *      could start charging an occupant gas they never agreed to.
 *
 *      Declared rather than encoded in the address. Uniswap v4 packs these into
 *      address bits, which is elegant and saves gas in the hottest loop in
 *      DeFi — but it costs a salt miner in the deploy pipeline, a redeploy
 *      whenever a flag is wrong, and an address that tells a reader nothing.
 *      This protocol is optimising for a handful of people understanding it in
 *      one sitting, which points the other way.
 *
 *      Flags are also not optional for the `before` set, for a reason easy to
 *      miss: a `before` hook is fail-CLOSED. Calling one optimistically on a
 *      contract that does not implement it reverts on the missing function, and
 *      a fail-closed revert means every buy on that slot is vetoed forever. The
 *      `after` set could be discovered by trying. The `before` set never can.
 */
struct HookFlags {
    bool beforeBuy;
    bool beforeSelfAssess;
    bool afterBuy;
    bool afterRelease;
    bool afterLiquidate;
    bool afterSettle;
}

/**
 * @title ISlotHook
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
 *        treats as unconditional.
 *
 *      A hook that wants to record something about a decision does it in the
 *      matching `after`. There is deliberately no way to write during `before`.
 *
 *      ── One hook per slot ───────────────────────────────────────────────
 *
 *      A slot that wants several behaviours points at a `CompositeHook` that
 *      fans out. Keeping the fan-out in userland is not tidiness: it means the
 *      core makes ONE capped call, and that single cap bounds the whole subtree
 *      beneath it. A badly built composite harms only the slot that chose it.
 */
interface ISlotHook {
    // `beforeSell` and `afterSell` used to sit beside these. `Slot.sell` was
    // removed — a consensual sale is `selfAssess` then `buy`, performed by the
    // OfferBook — so a sale now runs `beforeSelfAssess` and `beforeBuy` like
    // any other seating. Leaving the two callbacks declared would have left a
    // hook able to subscribe to something that can never fire.

    /// @dev `view`, not `pure`: a composite answers this from storage, and
    ///      that is a legitimate hook rather than an edge case.
    function subscriptions() external view returns (HookFlags memory);

    /**
     * @notice Revert if `data` is not a configuration this hook accepts.
     *
     * @dev Called once, when the hook is attached, so a misconfiguration is
     *      refused at the only moment somebody is around to fix it.
     *
     *      Not optional, and that is the point. `hookData` is opaque to the
     *      slot: only the hook knows whether a given word means anything. Left
     *      unchecked, a slot attaches a hook with data it will reject on every
     *      callback — and since `before` is fail-closed, that is a slot nobody
     *      can ever buy. Where `mutableHook` is false it is a slot nobody can
     *      ever repair.
     *
     *      A hook that takes no configuration implements this as a no-op and
     *      thereby accepts anything, including zero. Say so deliberately rather
     *      than by omission.
     */
    function validateHookData(bytes32 data) external view;

    // ─── decisions: `view`, revert to veto ──────────────────────────────────

    function beforeBuy(SlotContext calldata ctx) external view;

    function beforeSelfAssess(SlotContext calldata ctx) external view;

    // ─── effects: capped, swallowed, cannot change the outcome ──────────────

    function afterBuy(SlotContext calldata ctx) external;

    function afterRelease(SlotContext calldata ctx) external;

    function afterLiquidate(SlotContext calldata ctx) external;

    function afterSettle(SlotContext calldata ctx) external;
}
