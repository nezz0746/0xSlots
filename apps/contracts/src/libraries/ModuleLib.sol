// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotModule} from "../interfaces/ISlotModule.sol";
import {ScopesLib} from "./ScopesLib.sol";
import {SlotMath} from "./SlotMath.sol";
import {InstalledModule, ModuleTerms, ModuleFee} from "../types/SlotTypes.sol";
import {InvalidModule, InvalidModuleFee} from "../errors/SlotErrors.sol";

/**
 * @title ModuleLib
 * @notice Everything a slot does with its module: read what it asks for, call
 *         it, install it and remove it.
 *
 * @dev The shape of Uniswap v4's `Hooks` library: the slot keeps one
 *      {InstalledModule} record and calls through here, so the rules for
 *      talking to a module live in one file rather than across the slot.
 *
 *      Knows nothing about occupancy or money. The slot builds each callback's
 *      context and decides when to call; this decides how.
 */
library ModuleLib {
    // ─── the record ─────────────────────────────────────────────────────────

    /// @dev The record's `ModuleTerms`: which module, configured how.
    function terms(InstalledModule storage m) internal view returns (ModuleTerms memory) {
        return ModuleTerms(m.target, m.settings);
    }

    /// @dev Whether the slot calls this module for `scope`.
    function has(InstalledModule storage m, uint16 scope) internal view returns (bool) {
        return m.target != address(0) && m.scopes & scope != 0;
    }

    /// @dev Replace the installed record with `next`. An empty `next` removes it.
    function install(InstalledModule storage m, InstalledModule memory next) internal {
        m.target = next.target;
        m.scopes = next.scopes;
        m.fee.bps = next.fee.bps;
        m.fee.recipient = next.fee.recipient;
        m.settings = next.settings;
    }

    function sameFee(ModuleFee memory a, ModuleFee memory b) internal pure returns (bool) {
        return a.bps == b.bps && a.recipient == b.recipient;
    }

    // ─── reading what a module asks for ─────────────────────────────────────

    /**
     * @dev Check `settings`, then read the scopes and fee the module declares.
     *
     *      Deliberately NOT fail-open. This happens while creating, proposing
     *      or accepting, in a call somebody sent on purpose, and a module that
     *      will not answer is a module that will not work: better refused now
     *      than attached with nothing firing. The module's own revert bubbles.
     */
    function read(
        address target,
        bytes memory settings
    ) internal view returns (uint16 scopes, ModuleFee memory fee) {
        if (target == address(0)) return (0, fee);

        ISlotModule(target).checkSettings(settings);
        scopes = ISlotModule(target).scopes(settings);
        fee = ISlotModule(target).fee(settings);

        if (scopes == 0 || scopes & ~ScopesLib.ALL != 0) revert InvalidModule();
        if (fee.bps > SlotMath.BASIS_POINTS) revert InvalidModuleFee();
        if (fee.bps != 0 && fee.recipient == address(0)) revert InvalidModuleFee();
    }

    /**
     * @dev {read} without the right to revert, each call capped at `gasEach`.
     *
     *      Used where a module lands, which is a buy someone else is paying
     *      for. Failing open keeps a module that stopped answering from wedging
     *      the queue shut: it attaches as nothing rather than barring every
     *      buy. `proposeTerms` refuses a module that cannot answer under the same
     *      cap, so the fail-open is for a module that BREAKS after it was
     *      accepted, never for one that was always too expensive.
     *
     *      Returns ok=false for a revert, settings the module rejects, an answer
     *      that does not decode, no scopes or unknown ones, or a fee out of range.
     *
     *      Raw calls into fixed-size buffers rather than `try`: `try` catches
     *      the CALL, not the `extcodesize` guard before it or the ABI decoder
     *      after it, and either would make this fail CLOSED on exactly the
     *      modules it exists to survive.
     */
    function tryRead(
        address target,
        bytes memory settings,
        uint256 gasEach
    ) internal view returns (bool ok, uint16 scopes, ModuleFee memory fee) {
        if (target == address(0)) return (false, 0, fee);

        bytes memory cd = abi.encodeCall(ISlotModule.checkSettings, (settings));
        bool answered;
        assembly ("memory-safe") {
            answered := staticcall(gasEach, target, add(cd, 0x20), mload(cd), 0, 0)
        }
        if (!answered) return (false, 0, fee);

        cd = abi.encodeCall(ISlotModule.scopes, (settings));
        uint256 got;
        uint256 scopesWord;
        assembly ("memory-safe") {
            let out := mload(0x40)
            answered := staticcall(gasEach, target, add(cd, 0x20), mload(cd), out, 0x20)
            got := returndatasize()
            scopesWord := mload(out)
        }
        if (!answered || got < 0x20) return (false, 0, fee);
        if (scopesWord == 0 || scopesWord > ScopesLib.ALL) return (false, 0, fee);

        cd = abi.encodeCall(ISlotModule.fee, (settings));
        uint256 bpsWord;
        uint256 recipientWord;
        assembly ("memory-safe") {
            let out := mload(0x40)
            answered := staticcall(gasEach, target, add(cd, 0x20), mload(cd), out, 0x40)
            got := returndatasize()
            bpsWord := mload(out)
            recipientWord := mload(add(out, 0x20))
        }
        if (!answered || got < 0x40) return (false, 0, fee);
        if (bpsWord > SlotMath.BASIS_POINTS || recipientWord >> 160 != 0) return (false, 0, fee);
        if (bpsWord != 0 && recipientWord == 0) return (false, 0, fee);

        scopes = uint16(scopesWord);
        fee.bps = uint16(bpsWord);
        fee.recipient = address(uint160(recipientWord));
        ok = true;
    }

    // ─── calling it ─────────────────────────────────────────────────────────

    /**
     * @dev A decision: an uncapped `staticcall` whose revert is the veto.
     *
     *      Uncapped on purpose: a `view` cannot write, so it cannot reenter, and
     *      a gas limit would only turn a legitimate veto into a silent pass on a
     *      complex policy. The module's own revert bubbles, so a refused buy
     *      says why.
     */
    function callBefore(InstalledModule storage m, uint16 scope, bytes memory data) internal view {
        if (!has(m, scope)) return;
        (bool ok, bytes memory err) = m.target.staticcall(data);
        if (ok) return;
        assembly ("memory-safe") {
            revert(add(err, 0x20), mload(err))
        }
    }

    /**
     * @dev An effect: capped at `gasCap` and swallowed, so a module cannot fail
     *      the call it is being told about. Returns true when a call failed and
     *      was swallowed, for the slot to log.
     *
     *      Unless the module declared `strict`: then uncapped, and the revert
     *      propagates. A module that asked for this can do work that MUST land,
     *      and can also fail the slot, eviction included. That trade was made
     *      when the module was attached.
     */
    function callAfter(
        InstalledModule storage m,
        uint16 scope,
        bytes memory data,
        uint256 gasCap
    ) internal returns (bool swallowed) {
        if (!has(m, scope)) return false;
        address target = m.target;

        if (m.scopes & ScopesLib.STRICT != 0) {
            (bool ok, bytes memory err) = target.call(data);
            if (ok) return false;
            assembly ("memory-safe") {
                revert(add(err, 0x20), mload(err))
            }
        }

        return !callCapped(target, data, gasCap);
    }

    /**
     * @dev A capped call that ignores whatever comes back.
     *
     *      Nothing is copied from the returndata, so a module answering with a
     *      huge payload cannot spend the caller's gas on the copy — the path
     *      evictions run through stays bounded by `gasCap` alone.
     */
    function callCapped(address target, bytes memory data, uint256 gasCap) internal returns (bool ok) {
        assembly ("memory-safe") {
            ok := call(gasCap, target, 0, add(data, 0x20), mload(data), 0, 0)
        }
    }
}
