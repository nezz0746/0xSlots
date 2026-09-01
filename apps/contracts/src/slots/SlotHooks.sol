// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage, HOOK_GAS} from "./SlotStorage.sol";
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
    function hookFlags() external view returns (HookFlags memory f) {
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
     */
    function _readHookFlags(address h) internal view returns (uint8 packed) {
        if (h == address(0)) return 0;

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
                paid: 0
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
        address h = hook;
        if (h == address(0) || _hookFlags & flag == 0) return;
        (bool ok, ) = h.call{gas: HOOK_GAS}(call);
        if (!ok) emit HookCallFailed(h, bytes4(call));
    }
}
