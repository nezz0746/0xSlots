// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage} from "./SlotStorage.sol";
import {ISlotHook, HookPermissions, SlotContext} from "../interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../libraries/HookPermissionsLib.sol";
import {HookTerms, HookOffer} from "../types/SlotTypes.sol";
import {Occupancy} from "./SlotStorage.sol";
import {TermsLib, TermsQueue} from "../libraries/TermsLib.sol";
import "../errors/SlotErrors.sol";

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
 *      It runs inside `buy`, `release` and `liquidate`. A hook that could revert
 *      there would be able to block an eviction, and unconditional liquidation
 *      is the first thing this protocol promises.
 *
 *      Unless the hook declared `strict`, which drops the stipend and lets the
 *      revert through. That is one more bit in the same accepted byte, so a
 *      slot's exposure is fixed when it attaches and legible from
 *      `SlotInfo.hookPermissions` — and the promise above still holds for every hook
 *      that did not ask.
 *
 *      Both are skipped entirely unless the hook declared them, read from the
 *      slot's copy of its offer.
 */
abstract contract SlotHooks is SlotStorage {
    uint8 internal constant F_BEFORE_BUY = HookPermissionsLib.BEFORE_BUY;
    uint8 internal constant F_BEFORE_SELF_ASSESS = HookPermissionsLib.BEFORE_SELF_ASSESS;
    uint8 internal constant F_AFTER_BUY = HookPermissionsLib.AFTER_BUY;
    uint8 internal constant F_AFTER_RELEASE = HookPermissionsLib.AFTER_RELEASE;
    uint8 internal constant F_AFTER_LIQUIDATE = HookPermissionsLib.AFTER_LIQUIDATE;
    uint8 internal constant F_AFTER_SETTLE = HookPermissionsLib.AFTER_SETTLE;
    uint8 internal constant F_STRICT = HookPermissionsLib.STRICT;
    uint8 internal constant F_AFTER_ATTACH = HookPermissionsLib.AFTER_ATTACH;

    /// @notice A hook callback reverted and was ignored.
    /// @dev Only ever emitted for the `after` side. A failing `before` reverts
    ///      the transaction and never reaches here.
    event HookCallFailed(address indexed hook, bytes4 selector);

    /// @notice The hook's accepted permissions, unpacked.
    function hookPermissions() public view returns (HookPermissions memory) {
        return HookPermissionsLib.unpack(_hookOffer().permissions);
    }

    /**
     * @dev `_readHook` without the right to revert.
     *
     *      Used by `_applyPending`, where the hook being read is one the slot
     *      has not run yet, and by the offer view. Failing open is what keeps a
     *      hook that stopped answering from wedging the queue shut: it attaches
     *      as nothing rather than barring every buy. The cap bounds what that
     *      read may cost the buyer who happens to trigger it; `proposeTerms`
     *      refuses a hook that cannot answer within it, so the fail-open is for
     *      a hook that BREAKS after it was accepted, never for one that was
     *      always too expensive.
     *
     *      Returns ok=false for a revert, a configuration the hook rejects, an
     *      answer that does not decode, no permissions or unknown ones, or a fee out
     *      of range.
     *
     *      ── Why this is assembly and not `try` ──────────────────────────
     *
     *      `try` catches the CALL, not the code solc emits around it: the
     *      `extcodesize` guard before a call that returns nothing, and the ABI
     *      decoder after one that returns a struct. Either can revert outside
     *      the `catch`, which would make this fail CLOSED on exactly the hooks
     *      it exists to survive. So the calls are raw, into fixed-size buffers,
     *      and decoded by hand as strictly as solc would, except that failing
     *      returns false.
     */
    function _tryReadHook(
        HookTerms memory terms
    ) internal view returns (bool ok, HookOffer memory offer) {
        address h = terms.target;
        if (h == address(0)) return (false, offer);

        // Half each, so the two reads together cost what one call's stipend
        // always did.
        uint256 stipend = HOOK_GAS / 2;

        bytes memory cd = abi.encodeCall(ISlotHook.validateHookConfig, (terms.config));
        bool answered;
        assembly ("memory-safe") {
            answered := staticcall(stipend, h, add(cd, 0x20), mload(cd), 0, 0)
        }
        if (!answered) return (false, offer);

        cd = abi.encodeCall(ISlotHook.hookOffer, (terms.config));
        uint256 got;
        uint256 permissionsWord;
        uint256 bpsWord;
        uint256 recipientWord;
        assembly ("memory-safe") {
            let out := mload(0x40)
            answered := staticcall(stipend, h, add(cd, 0x20), mload(cd), out, 0x60)
            got := returndatasize()
            permissionsWord := mload(out)
            bpsWord := mload(add(out, 0x20))
            recipientWord := mload(add(out, 0x40))
        }
        if (!answered || got < 0x60) return (false, offer);
        if (permissionsWord == 0 || permissionsWord > HookPermissionsLib.ALL) return (false, offer);
        if (bpsWord > BASIS_POINTS || recipientWord >> 160 != 0) return (false, offer);
        if (bpsWord != 0 && recipientWord == 0) return (false, offer);

        offer.permissions = uint8(permissionsWord);
        offer.feeBps = uint16(bpsWord);
        offer.feeRecipient = address(uint160(recipientWord));
        ok = true;
    }

    /**
     * @dev Read a hook's offer, and check its configuration.
     *
     *      Deliberately NOT fail-open. This happens while proposing, creating
     *      or accepting, in a call somebody sent on purpose, and a hook that
     *      will not answer is a hook that will not work: better refused now
     *      than attached with nothing firing.
     */
    function _readHook(HookTerms memory terms) internal view returns (HookOffer memory offer) {
        address h = terms.target;
        if (h == address(0)) return offer;

        ISlotHook(h).validateHookConfig(terms.config);
        offer = ISlotHook(h).hookOffer(terms.config);

        if (offer.permissions == 0 || offer.permissions & ~HookPermissionsLib.ALL != 0) revert InvalidHook();
        if (offer.feeBps > BASIS_POINTS) revert InvalidHookFee();
        if (offer.feeBps != 0 && offer.feeRecipient == address(0)) revert InvalidHookFee();
    }

    /**
     * @dev What accepting `offered` would change.
     *
     *      The fee, whenever it differs. The permissions only on a slot whose hook is
     *      mutable, and not when exactly those permissions are already queued.
     */
    function _offerChanges(
        HookOffer memory offered
    ) internal view returns (bool fee, bool permissions) {
        HookOffer storage live = _hookOffer();
        fee = offered.feeBps != live.feeBps || offered.feeRecipient != live.feeRecipient;

        TermsQueue storage q = _queue();
        bool queued = q.mask & TermsLib.HOOK_PERMISSIONS != 0 && q.hookPermissions == offered.permissions;
        permissions = _settings().mutableHook && offered.permissions != live.permissions && !queued;
    }

    /// @dev The context every callback receives. Built once per call site.
    ///
    ///      On an exit it is built after `_vacate`, so `occupant`,
    ///      `occupiedSince` and `currentPrice` are zero: the tenure is over, and
    ///      a hook closing its books needs to know that. The terms are still the
    ///      ones it governed under — nothing moves them during an exit, because
    ///      queued terms land at a buy.
    function _ctx(
        address caller,
        address account,
        uint256 newPrice,
        uint256 depositAmount
    ) internal view returns (SlotContext memory) {
        Occupancy storage o = _occupancy();
        return
            SlotContext({
                slot: address(this),
                caller: caller,
                account: account,
                occupant: o.occupant,
                occupiedSince: o.since,
                taxRateBps: _taxTerms().rateBps,
                currentPrice: o.price,
                newPrice: newPrice,
                depositAmount: depositAmount,
                owed: 0,
                paid: 0,
                hookTerms: _hookTerms()
            });
    }

    // ─── decisions ──────────────────────────────────────────────────────────

    /// @dev Uncapped on purpose: `view` cannot write, so it cannot reenter, and
    ///      a gas limit here would only turn a legitimate veto into a silent
    ///      pass on a complex policy.
    function _before(uint8 permission, bytes memory call) internal view {
        address h = _hookTerms().target;
        if (h == address(0) || _hookOffer().permissions & permission == 0) return;
        (bool ok, bytes memory err) = h.staticcall(call);
        if (ok) return;
        // Bubble the hook's own revert reason. A vetoed buy should say why the
        // policy refused, not "call failed".
        assembly {
            revert(add(err, 0x20), mload(err))
        }
    }

    // ─── effects ────────────────────────────────────────────────────────────

    /**
     * @dev Tell the hook, if it asked to be told. Capped and swallowed, so a
     *      hook cannot fail the call it is being told about.
     */
    function _after(uint8 permission, bytes memory call) internal {
        address h = _hookTerms().target;
        if (h == address(0) || _hookOffer().permissions & permission == 0) return;

        // Strict: uncapped, and the revert propagates. Declared by the hook
        // and accepted with every other permission, so it is fixed for the slot
        // the moment it attaches and readable from `SlotInfo.hookPermissions`.
        //
        // A hook that asked for this can do work that MUST land, and cannot be
        // starved by a caller calibrating gas. It can also fail the slot,
        // eviction included. That is the trade, and choosing this hook's
        // address is where it was made.
        if (_hookOffer().permissions & F_STRICT != 0) {
            (bool strictOk, bytes memory err) = h.call(call);
            if (strictOk) return;
            assembly ("memory-safe") {
                revert(add(err, 0x20), mload(err))
            }
        }

        (bool ok, ) = h.call{gas: HOOK_GAS}(call);
        if (!ok) emit HookCallFailed(h, bytes4(call));
    }
}
