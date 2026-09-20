// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage} from "./SlotStorage.sol";
import {ISlotApp, Scopes, SlotContext} from "../interfaces/ISlotApp.sol";
import {ScopesLib} from "../libraries/ScopesLib.sol";
import {AppTerms, Manifest} from "../types/SlotTypes.sol";
import {Occupancy} from "./SlotStorage.sol";
import {TermsLib, TermsQueue} from "../libraries/TermsLib.sol";
import "../errors/SlotErrors.sol";

/**
 * @title SlotApps
 * @notice Calling the app, and the two ways that can go.
 *
 * @dev The asymmetry here is the whole design, so it is worth stating once:
 *
 *      `_before*` is a STATICCALL to a `view` function. It is not gas-capped,
 *      because a `view` cannot write and therefore cannot reenter — there is
 *      nothing to protect against. If it reverts, the caller's action reverts:
 *      that is the veto, and it is the point.
 *
 *      `_after*` is a CALL with a fixed stipend and its failure is swallowed.
 *      It runs inside `buy`, `release` and `liquidate`. An app that could revert
 *      there would be able to block an eviction, and unconditional liquidation
 *      is the first thing this protocol promises.
 *
 *      Unless the app declared `strict`, which drops the stipend and lets the
 *      revert through. That is one more bit in the same accepted byte, so a
 *      slot's exposure is fixed when it attaches and legible from
 *      `SlotInfo.scopes` — and the promise above still holds for every app
 *      that did not ask.
 *
 *      Both are skipped entirely unless the app declared them, read from the
 *      slot's copy of its offer.
 */
abstract contract SlotApps is SlotStorage {
    uint16 internal constant F_BEFORE_BUY = ScopesLib.BEFORE_BUY;
    uint16 internal constant F_BEFORE_SELF_ASSESS = ScopesLib.BEFORE_SELF_ASSESS;
    uint16 internal constant F_AFTER_BUY = ScopesLib.AFTER_BUY;
    uint16 internal constant F_AFTER_RELEASE = ScopesLib.AFTER_RELEASE;
    uint16 internal constant F_AFTER_LIQUIDATE = ScopesLib.AFTER_LIQUIDATE;
    uint16 internal constant F_AFTER_SETTLE = ScopesLib.AFTER_SETTLE;
    uint16 internal constant F_STRICT = ScopesLib.STRICT;
    uint16 internal constant F_ON_INSTALL = ScopesLib.ON_INSTALL;
    uint16 internal constant F_ON_UNINSTALL = ScopesLib.ON_UNINSTALL;

    /// @notice An app callback reverted and was ignored.
    /// @dev Only ever emitted for the `after` side. A failing `before` reverts
    ///      the transaction and never reaches here.
    event AppCallFailed(address indexed app, bytes4 selector);

    /// @notice The app's accepted scopes, unpacked.
    function scopes() public view returns (Scopes memory) {
        return ScopesLib.unpack(_manifest().scopes);
    }

    /**
     * @dev `_readManifest` without the right to revert.
     *
     *      Used by `_applyPending`, where the app being read is one the slot
     *      has not run yet, and by the offer view. Failing open is what keeps a
     *      app that stopped answering from wedging the queue shut: it attaches
     *      as nothing rather than barring every buy. The cap bounds what that
     *      read may cost the buyer who happens to trigger it; `proposeTerms`
     *      refuses an app that cannot answer within it, so the fail-open is for
     *      an app that BREAKS after it was accepted, never for one that was
     *      always too expensive.
     *
     *      Returns ok=false for a revert, a configuration the app rejects, an
     *      answer that does not decode, no scopes or unknown ones, or a fee out
     *      of range.
     *
     *      ── Why this is assembly and not `try` ──────────────────────────
     *
     *      `try` catches the CALL, not the code solc emits around it: the
     *      `extcodesize` guard before a call that returns nothing, and the ABI
     *      decoder after one that returns a struct. Either can revert outside
     *      the `catch`, which would make this fail CLOSED on exactly the apps
     *      it exists to survive. So the calls are raw, into fixed-size buffers,
     *      and decoded by hand as strictly as solc would, except that failing
     *      returns false.
     */
    function _tryReadManifest(
        AppTerms memory terms
    ) internal view returns (bool ok, Manifest memory offer) {
        address h = terms.target;
        if (h == address(0)) return (false, offer);

        // Half each, so the two reads together cost what one call's stipend
        // always did.
        uint256 stipend = APP_GAS / 2;

        bytes memory cd = abi.encodeCall(ISlotApp.checkSettings, (terms.settings));
        bool answered;
        assembly ("memory-safe") {
            answered := staticcall(stipend, h, add(cd, 0x20), mload(cd), 0, 0)
        }
        if (!answered) return (false, offer);

        cd = abi.encodeCall(ISlotApp.manifest, (terms.settings));
        uint256 got;
        uint256 scopesWord;
        uint256 bpsWord;
        uint256 recipientWord;
        assembly ("memory-safe") {
            let out := mload(0x40)
            answered := staticcall(stipend, h, add(cd, 0x20), mload(cd), out, 0x60)
            got := returndatasize()
            scopesWord := mload(out)
            bpsWord := mload(add(out, 0x20))
            recipientWord := mload(add(out, 0x40))
        }
        if (!answered || got < 0x60) return (false, offer);
        if (scopesWord == 0 || scopesWord > ScopesLib.ALL) return (false, offer);
        if (bpsWord > BASIS_POINTS || recipientWord >> 160 != 0) return (false, offer);
        if (bpsWord != 0 && recipientWord == 0) return (false, offer);

        offer.scopes = uint8(scopesWord);
        offer.feeBps = uint16(bpsWord);
        offer.feeRecipient = address(uint160(recipientWord));
        ok = true;
    }

    /**
     * @dev Read an app's offer, and check its configuration.
     *
     *      Deliberately NOT fail-open. This happens while proposing, creating
     *      or accepting, in a call somebody sent on purpose, and an app that
     *      will not answer is an app that will not work: better refused now
     *      than attached with nothing firing.
     */
    function _readManifest(AppTerms memory terms) internal view returns (Manifest memory offer) {
        address h = terms.target;
        if (h == address(0)) return offer;

        ISlotApp(h).checkSettings(terms.settings);
        offer = ISlotApp(h).manifest(terms.settings);

        if (offer.scopes == 0 || offer.scopes & ~ScopesLib.ALL != 0) revert InvalidApp();
        if (offer.feeBps > BASIS_POINTS) revert InvalidAppFee();
        if (offer.feeBps != 0 && offer.feeRecipient == address(0)) revert InvalidAppFee();
    }

    /**
     * @dev What accepting `offered` would change.
     *
     *      The fee, whenever it differs. The scopes only on a slot whose app is
     *      mutable, and not when exactly those scopes are already queued.
     */
    function _manifestChanges(
        Manifest memory offered
    ) internal view returns (bool fee, bool scopes) {
        Manifest storage live = _manifest();
        fee = offered.feeBps != live.feeBps || offered.feeRecipient != live.feeRecipient;

        TermsQueue storage q = _queue();
        bool queued = q.mask & TermsLib.SCOPES != 0 && q.scopes == offered.scopes;
        scopes = _settings().mutableApp && offered.scopes != live.scopes && !queued;
    }

    /// @dev The context every callback receives. Built once per call site.
    ///
    ///      On an exit it is built after `_vacate`, so `occupant`,
    ///      `occupiedSince` and `currentPrice` are zero: the tenure is over, and
    ///      an app closing its books needs to know that. The terms are still the
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
                appTerms: _appTerms()
            });
    }

    // ─── decisions ──────────────────────────────────────────────────────────

    /// @dev Uncapped on purpose: `view` cannot write, so it cannot reenter, and
    ///      a gas limit here would only turn a legitimate veto into a silent
    ///      pass on a complex policy.
    function _before(uint16 scope, bytes memory call) internal view {
        address h = _appTerms().target;
        if (h == address(0) || _manifest().scopes & scope == 0) return;
        (bool ok, bytes memory err) = h.staticcall(call);
        if (ok) return;
        // Bubble the app's own revert reason. A vetoed buy should say why the
        // policy refused, not "call failed".
        assembly {
            revert(add(err, 0x20), mload(err))
        }
    }

    // ─── effects ────────────────────────────────────────────────────────────

    /**
     * @dev Tell the app, if it asked to be told. Capped and swallowed, so a
     *      app cannot fail the call it is being told about.
     */
    function _after(uint16 scope, bytes memory call) internal {
        address h = _appTerms().target;
        if (h == address(0) || _manifest().scopes & scope == 0) return;

        // Strict: uncapped, and the revert propagates. Declared by the app
        // and accepted with every other scope, so it is fixed for the slot
        // the moment it attaches and readable from `SlotInfo.scopes`.
        //
        // An app that asked for this can do work that MUST land, and cannot be
        // starved by a caller calibrating gas. It can also fail the slot,
        // eviction included. That is the trade, and choosing this app's
        // address is where it was made.
        if (_manifest().scopes & F_STRICT != 0) {
            (bool strictOk, bytes memory err) = h.call(call);
            if (strictOk) return;
            assembly ("memory-safe") {
                revert(add(err, 0x20), mload(err))
            }
        }

        (bool ok, ) = h.call{gas: APP_GAS}(call);
        if (!ok) emit AppCallFailed(h, bytes4(call));
    }
}
