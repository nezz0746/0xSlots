// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage, Occupancy} from "./SlotStorage.sol";
import {ISlotModule, Scopes, SlotContext} from "../interfaces/ISlotModule.sol";
import {ScopesLib} from "../libraries/ScopesLib.sol";
import {ModuleLib} from "../libraries/ModuleLib.sol";
import {ModuleTerms, ModuleFee, InstalledModule} from "../types/SlotTypes.sol";

/**
 * @title SlotModules
 * @notice Calling the module, and the two ways that can go.
 *
 * @dev How is `ModuleLib`'s; this file decides when, and builds the context
 *      each call carries.
 *
 *      The asymmetry here is the whole design, so it is worth stating once:
 *
 *      `_before*` is a STATICCALL to a `view` function. It is not gas-capped,
 *      because a `view` cannot write and therefore cannot reenter — there is
 *      nothing to protect against. If it reverts, the caller's action reverts:
 *      that is the veto, and it is the point.
 *
 *      `_after*` is a CALL with a fixed stipend and its failure is swallowed.
 *      It runs inside `buy`, `release` and `liquidate`. A module that could revert
 *      there would be able to block an eviction, and unconditional liquidation
 *      is the first thing this protocol promises.
 *
 *      Unless the module declared `afterCallbacksMustSucceed`, which drops the stipend and lets the
 *      revert through. That is one more bit in the same accepted byte, so a
 *      slot's exposure is fixed when it attaches and legible from
 *      `SlotInfo.scopes` — and the promise above still holds for every module
 *      that did not ask.
 *
 *      Both are skipped entirely unless the module declared them, read from the
 *      slot's copy of its scopes.
 */
abstract contract SlotModules is SlotStorage {
    using ModuleLib for InstalledModule;

    /// @notice A module callback reverted and was ignored.
    /// @dev Only ever emitted for the `after` side. A failing `before` reverts
    ///      the transaction and never reaches here.
    event ModuleCallFailed(address indexed module, bytes4 selector);

    /// @notice The module's accepted scopes, unpacked.
    function scopes() public view returns (Scopes memory) {
        return ScopesLib.unpack(_module().scopes);
    }

    // ─── reading a module ───────────────────────────────────────────────────

    /// @dev What a module asks for, fail-open, under the cap the slot uses
    ///      wherever a module lands: a third of `MODULE_CALLBACK_GAS_LIMIT` per read, so the
    ///      three reads together cost what one callback may.
    function _tryReadModule(ModuleTerms memory t)
        internal
        view
        returns (bool, uint16, ModuleFee memory)
    {
        return ModuleLib.tryRead(t.module, t.settings, MODULE_CALLBACK_GAS_LIMIT / 3);
    }

    /// @dev The context every callback receives. Built once per call site.
    ///
    ///      On an exit it is built after `_vacate`, so `occupant`,
    ///      `occupiedSince` and `currentPrice` are zero: the tenure is over, and
    ///      a module closing its books needs to know that. The terms are still the
    ///      ones it governed under — nothing moves them during an exit, because
    ///      queued terms land at a buy.
    function _ctx(
        address caller,
        address account,
        uint256 newPrice,
        uint256 depositAmount
    ) internal view returns (SlotContext memory) {
        Occupancy storage o = _occupancy();
        return SlotContext({
            slot: address(this),
            caller: caller,
            account: account,
            occupant: o.occupant,
            occupiedSince: o.occupiedSince,
            taxRateBps: _taxTerms().rateBps,
            currentPrice: o.price,
            newPrice: newPrice,
            depositAmount: depositAmount,
            taxOwed: 0,
            taxPaid: 0,
            moduleTerms: _module().terms()
        });
    }

    // ─── calling it ─────────────────────────────────────────────────────────

    /// @dev A decision: may veto. See {ModuleLib-callBefore}.
    function _before(uint16 scope, bytes memory call) internal view {
        _module().callBefore(scope, call);
    }

    /// @dev An effect: capped and swallowed unless `afterCallbacksMustSucceed`. See {ModuleLib-callAfter}.
    function _after(uint16 scope, bytes memory call) internal {
        InstalledModule storage m = _module();
        if (m.callAfter(scope, call, MODULE_CALLBACK_GAS_LIMIT)) {
            // `call` is always an encoded call: its first four bytes are a selector.
            // forge-lint: disable-next-line(unsafe-typecast)
            emit ModuleCallFailed(m.module, bytes4(call));
        }
    }

    // ─── install and remove ─────────────────────────────────────────────────

    /**
     * @dev Tell a module attached by queued terms, if it asked to be told.
     *      Only ever called where a seat is taken, never on an eviction.
     *
     *      Capped and swallowed even for an `afterCallbacksMustSucceed`
     *      module, like {_onUninstall}. This runs inside every buy that lands
     *      the queue, and the queue stays ripe until something lands it — so a
     *      module able to revert here could refuse every buy for as long as
     *      nobody cancelled it. At creation the slot calls it strictly
     *      instead: refusing there fails only the creator's own transaction.
     */
    function _onInstall(address account, uint256 price_, uint256 depositAmount) internal {
        InstalledModule storage m = _module();
        if (!m.has(ScopesLib.ON_INSTALL)) return;
        bytes memory call = abi.encodeCall(
            ISlotModule.onInstall, (_ctx(msg.sender, account, price_, depositAmount))
        );
        if (!ModuleLib.callCapped(m.module, call, MODULE_CALLBACK_GAS_LIMIT)) {
            emit ModuleCallFailed(m.module, ISlotModule.onInstall.selector);
        }
    }

    /**
     * @dev Tell the installed module it is being removed, if it asked to be told.
     *      Called while its record is still installed, so the context carries
     *      its own settings.
     *
     *      Capped and swallowed even for a `afterCallbacksMustSucceed` module, unlike every other
     *      callback it declared. A module able to revert here is a module a manager
     *      can never replace: the removal is the one action that must not
     *      depend on the thing being removed.
     */
    function _onUninstall() internal {
        InstalledModule storage m = _module();
        if (!m.has(ScopesLib.ON_UNINSTALL)) return;
        bytes memory call = abi.encodeCall(
            ISlotModule.onUninstall, (_ctx(msg.sender, _occupancy().occupant, 0, 0))
        );
        if (!ModuleLib.callCapped(m.module, call, MODULE_CALLBACK_GAS_LIMIT)) {
            emit ModuleCallFailed(m.module, ISlotModule.onUninstall.selector);
        }
    }
}
