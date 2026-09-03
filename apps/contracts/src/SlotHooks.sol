// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage} from "./SlotStorage.sol";
import {ISlotHook, HookFlags, SlotContext} from "./ISlotHook.sol";
import "./SlotErrors.sol";

/**
 * @title SlotHooks
 * @notice Calling the hook, and the two ways that can go.
 *
 * @dev The asymmetry here is the whole design, so it is worth stating once:
 *
 *      `_before*` is a STATICCALL to a `view` function. It is not gas-capped,
 *      because a `view` cannot write and therefore cannot reenter — there is
 *      nothing to protect against. If it reverts, the caller's action reverts:
 *      that is the veto, and it is the point.
 *
 *      `_after*` is a CALL with a fixed stipend and its failure is swallowed.
 *      It runs inside `buy`, `sell`, `release` and `liquidate`. A hook that
 *      could revert there would be able to block an eviction, and unconditional
 *      liquidation is the first thing this protocol promises.
 *
 *      Both are skipped entirely unless the hook declared them, read from the
 *      snapshot taken when it was attached.
 */
abstract contract SlotHooks is SlotStorage {
    /// @dev Bit positions match `HookFlags` field order.
    uint8 internal constant F_BEFORE_BUY = 1 << 0;
    uint8 internal constant F_BEFORE_SELL = 1 << 1;
    uint8 internal constant F_BEFORE_SELF_ASSESS = 1 << 2;
    uint8 internal constant F_AFTER_BUY = 1 << 3;
    uint8 internal constant F_AFTER_SELL = 1 << 4;
    uint8 internal constant F_AFTER_RELEASE = 1 << 5;
    uint8 internal constant F_AFTER_LIQUIDATE = 1 << 6;
    uint8 internal constant F_AFTER_SETTLE = 1 << 7;

    /// @notice A hook callback reverted and was ignored.
    /// @dev Only ever emitted for the `after` side. A failing `before` reverts
    ///      the transaction and never reaches here.
    event HookCallFailed(address indexed hook, bytes4 selector);

    /// @notice The hook's snapshotted subscriptions, unpacked.
    function hookFlags() public view returns (HookFlags memory f) {
        uint8 b = _hookFlags;
        f.beforeBuy = b & F_BEFORE_BUY != 0;
        f.beforeSell = b & F_BEFORE_SELL != 0;
        f.beforeSelfAssess = b & F_BEFORE_SELF_ASSESS != 0;
        f.afterBuy = b & F_AFTER_BUY != 0;
        f.afterSell = b & F_AFTER_SELL != 0;
        f.afterRelease = b & F_AFTER_RELEASE != 0;
        f.afterLiquidate = b & F_AFTER_LIQUIDATE != 0;
        f.afterSettle = b & F_AFTER_SETTLE != 0;
    }

    /**
     * @dev Read a hook's declared subscriptions and pack them.
     *
     *      Deliberately NOT fail-open. Everywhere else a misbehaving hook is
     *      tolerated, but this read happens once, while attaching, in a call
     *      the manager sent on purpose — and getting it wrong is silent and
     *      permanent. A hook whose `hooks()` reverts is a hook that will not
     *      work; better to refuse it now than to attach it with no
     *      subscriptions and leave someone wondering why nothing fires.
     *
     *      Also where `hookData` is checked, for the same reason and by the
     *      same argument. The slot cannot judge an opaque word, so it asks the
     *      only party that can, once, while it is still fixable.
     */
    /**
     * @dev `_readHookFlags` without the right to revert.
     *
     *      Used only by `_applyPending`, which runs inside `_liquidate`. The
     *      gas cap matters as much as the fail-open: an uncapped read lets a
     *      hook burn the caller's frame, which prices out an eviction rather
     *      than blocking it — the same harm by a slower route.
     *
     *      Returns ok=false for a revert, for all-false flags, for a hook whose
     *      answer does not decode, and for one that rejects `data`. The caller
     *      attaches nothing.
     *
     *      ── Why this is assembly and not `try` ──────────────────────────
     *
     *      Because `try` does NOT catch everything that can revert. It catches
     *      the CALL. The compiler emits code AROUND the call that is outside
     *      the catch entirely, and both kinds were reachable here:
     *
     *        - `validateHookData` returns nothing, so solc cannot skip its
     *          `extcodesize` guard and emits it BEFORE the call. A pending hook
     *          with no code — a 7702-delegated EOA whose delegation was
     *          revoked — reverted straight through the `catch`.
     *        - `hooks()` returns a struct, so solc decodes AFTER the call.
     *          Returndata under 256 bytes, or a bool word that is not 0 or 1,
     *          reverted in the decoder, also outside the `catch`.
     *
     *      Either one reverts `_applyPending`, which runs inside `_liquidate`
     *      — and `buy`, `sell` and `release` call it too, so the slot was not
     *      merely un-evictable but frozen, with `cancelProposal` the only exit
     *      and the manager who chose the hook the only one who could reach it.
     *      That is rule 1 broken, by the one function written to uphold it.
     *
     *      So the calls are made raw and the answer is decoded by hand. Both
     *      use a zero-length output buffer or a fixed 256-byte one, so a
     *      returndata bomb cannot expand memory in this frame either.
     *
     *      The decoding is just as strict as solc's — a word that is not 0 or
     *      1 is not a bool, and a hook that cannot encode one will not work.
     *      What changes is what strictness DOES: it returns false and the
     *      caller attaches nothing, where the compiler's decoder reverted. Read
     *      leniently instead, garbage would attach a broken hook with all eight
     *      subscriptions set, and `before` is fail-closed — so the reward for
     *      answering nonsense would be a veto over every buy.
     */
    function _tryReadHookFlags(address h, bytes32 data)
        internal
        view
        returns (bool ok, uint8 packed)
    {
        if (h == address(0)) return (false, 0);

        uint256 stipend = HOOK_GAS;

        // Calldata is built in Solidity — `abi.encodeCall` type-checks the
        // selector, so a signature change breaks the build rather than the
        // eviction path.
        bytes memory cd = abi.encodeCall(ISlotHook.validateHookData, (data));
        bool answered;
        assembly ("memory-safe") {
            answered := staticcall(
                stipend,
                h,
                add(cd, 0x20),
                mload(cd),
                0,
                0
            )
        }
        if (!answered) return (false, 0);

        cd = abi.encodeCall(ISlotHook.hooks, ());
        // Eight bools, ABI-encoded one per word.
        bytes memory ret = new bytes(256);
        uint256 got;
        assembly ("memory-safe") {
            answered := staticcall(
                stipend,
                h,
                add(cd, 0x20),
                mload(cd),
                add(ret, 0x20),
                256
            )
            got := returndatasize()
        }
        if (!answered || got < 256) return (false, 0);

        for (uint256 i; i < 8; ++i) {
            uint256 word;
            assembly ("memory-safe") {
                word := mload(add(add(ret, 0x20), mul(i, 0x20)))
            }
            if (word > 1) return (false, 0);
            // Bit positions match `HookFlags` field order, as the constants say.
            if (word == 1) packed |= uint8(1 << i);
        }

        ok = packed != 0;
        if (!ok) packed = 0;
    }

    function _readHookFlags(address h, bytes32 data)
        internal
        view
        returns (uint8 packed)
    {
        if (h == address(0)) return 0;

        // Together, always. The flags and the configuration are the two halves
        // of what attaching a hook means, and a path that checked one without
        // the other is a path that attaches something nobody validated.
        ISlotHook(h).validateHookData(data);

        HookFlags memory f = ISlotHook(h).hooks();
        if (f.beforeBuy) packed |= F_BEFORE_BUY;
        if (f.beforeSell) packed |= F_BEFORE_SELL;
        if (f.beforeSelfAssess) packed |= F_BEFORE_SELF_ASSESS;
        if (f.afterBuy) packed |= F_AFTER_BUY;
        if (f.afterSell) packed |= F_AFTER_SELL;
        if (f.afterRelease) packed |= F_AFTER_RELEASE;
        if (f.afterLiquidate) packed |= F_AFTER_LIQUIDATE;
        if (f.afterSettle) packed |= F_AFTER_SETTLE;

        if (packed == 0) revert InvalidHook();
    }

    /// @dev The context every callback receives. Built once per call site.
    function _ctx(
        address caller,
        address account,
        uint256 newPrice,
        uint256 depositAmount
    ) internal view returns (SlotContext memory) {
        return _ctxFor(caller, account, newPrice, depositAmount, hookData);
    }

    /// @dev `_ctx` with the configuration named rather than read.
    ///
    ///      The counterpart to `_afterOn`, and needed for the same reason: a
    ///      transition that swaps hooks has already overwritten `hookData` by
    ///      the time the end-of-tenure callback goes out, so a context built
    ///      from storage would hand the outgoing hook its successor's
    ///      configuration — a window it never granted, on a tenure it did.
    function _ctxFor(
        address caller,
        address account,
        uint256 newPrice,
        uint256 depositAmount,
        bytes32 data
    ) internal view returns (SlotContext memory) {
        return
            SlotContext({
                slot: address(this),
                caller: caller,
                account: account,
                occupant: _occupant,
                occupiedSince: occupiedSince,
                taxPercentage: taxPercentage,
                currentPrice: _price,
                newPrice: newPrice,
                depositAmount: depositAmount,
                owed: 0,
                paid: 0,
                hookData: data
            });
    }

    // ─── decisions ──────────────────────────────────────────────────────────

    /// @dev Uncapped on purpose: `view` cannot write, so it cannot reenter, and
    ///      a gas limit here would only turn a legitimate veto into a silent
    ///      pass on a complex policy.
    function _before(uint8 flag, bytes memory call) internal view {
        address h = hook;
        if (h == address(0) || _hookFlags & flag == 0) return;
        (bool ok, bytes memory err) = h.staticcall(call);
        if (ok) return;
        // Bubble the hook's own revert reason. A vetoed buy should say why the
        // policy refused, not "call failed".
        assembly {
            revert(add(err, 0x20), mload(err))
        }
    }

    // ─── effects ────────────────────────────────────────────────────────────

    function _after(uint8 flag, bytes memory call) internal {
        _afterOn(hook, _hookFlags, flag, call);
    }

    /**
     * @dev `_after`, addressed to a hook named by the caller.
     *
     *      Exists because a transition that swaps hooks would otherwise split
     *      its own callbacks across two contracts: the hook that governed the
     *      tenure is asked for permission, `_applyPending` replaces it, and
     *      the notification that the tenure ENDED is delivered to its
     *      successor — which never saw the tenure begin. Any hook holding
     *      per-occupancy state (rewards, a feed, an allowlist) is left with a
     *      tenure it can never close.
     *
     *      End-of-tenure callbacks pass the hook cached before the swap.
     */
    function _afterOn(
        address h,
        uint8 flags,
        uint8 flag,
        bytes memory call
    ) internal {
        if (h == address(0) || flags & flag == 0) return;
        (bool ok, ) = h.call{gas: HOOK_GAS}(call);
        if (!ok) emit HookCallFailed(h, bytes4(call));
    }
}
