// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotStorage} from "./SlotStorage.sol";
import {ISlotModule, Scopes, SlotContext} from "../interfaces/ISlotModule.sol";
import {ScopesLib} from "../libraries/ScopesLib.sol";
import {ModuleLib} from "../libraries/ModuleLib.sol";
import {ModuleTerms, ModuleFee, InstalledModule} from "../types/SlotTypes.sol";
import {Occupancy} from "./SlotStorage.sol";
import "../errors/SlotErrors.sol";

/**
 * @title SlotModules
 * @notice Calling the module, and the two ways that can go.
 *
 * @dev How is `ModuleLib`'s; this file decides when, and builds the context
 *      each call carries.
 *
 * @dev The asymmetry here is the whole design, so it is worth stating once:
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
 *      Unless the module declared `strict`, which drops the stipend and lets the
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

    uint16 internal constant F_BEFORE_BUY = ScopesLib.BEFORE_BUY;
    uint16 internal constant F_BEFORE_SELF_ASSESS = ScopesLib.BEFORE_SELF_ASSESS;
    uint16 internal constant F_AFTER_BUY = ScopesLib.AFTER_BUY;
    uint16 internal constant F_AFTER_RELEASE = ScopesLib.AFTER_RELEASE;
    uint16 internal constant F_AFTER_LIQUIDATE = ScopesLib.AFTER_LIQUIDATE;
    uint16 internal constant F_AFTER_SETTLE = ScopesLib.AFTER_SETTLE;
    uint16 internal constant F_ON_INSTALL = ScopesLib.ON_INSTALL;
    uint16 internal constant F_ON_UNINSTALL = ScopesLib.ON_UNINSTALL;

    /// @notice A module callback reverted and was ignored.
    /// @dev Only ever emitted for the `after` side. A failing `before` reverts
    ///      the transaction and never reaches here.
    event ModuleCallFailed(address indexed module, bytes4 selector);

    /// @notice The module's accepted scopes, unpacked.
    function scopes() public view returns (Scopes memory) {
        return ScopesLib.unpack(_module().scopes);
    }

    // ─── reading a module ───────────────────────────────────────────────────

    /// @dev What a module asks for, strictly: its own revert bubbles.
    function _readModule(ModuleTerms memory t) internal view returns (uint16, ModuleFee memory) {
        return ModuleLib.read(t.target, t.settings);
    }

    /// @dev What a module asks for, fail-open, under the cap the slot uses
    ///      wherever a module lands: a third of `MODULE_GAS` per read, so the
    ///      three reads together cost what one callback may.
    function _tryReadModule(
        ModuleTerms memory t
    ) internal view returns (bool, uint16, ModuleFee memory) {
        return ModuleLib.tryRead(t.target, t.settings, MODULE_GAS / 3);
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
                moduleTerms: _module().terms()
            });
    }

    // ─── calling it ─────────────────────────────────────────────────────────

    /// @dev A decision: may veto. See {ModuleLib-callBefore}.
    function _before(uint16 scope, bytes memory call) internal view {
        _module().callBefore(scope, call);
    }

    /// @dev An effect: capped and swallowed unless `strict`. See {ModuleLib-callAfter}.
    function _after(uint16 scope, bytes memory call) internal {
        InstalledModule storage m = _module();
        if (m.callAfter(scope, call, MODULE_GAS)) emit ModuleCallFailed(m.target, bytes4(call));
    }

    // ─── install and remove ─────────────────────────────────────────────────

    /// @dev Tell a newly attached module, if it asked to be told. Only ever
    ///      called where a seat is taken, never on an eviction.
    function _onInstall(address account, uint256 price_, uint256 depositAmount) internal {
        _after(
            F_ON_INSTALL,
            abi.encodeCall(ISlotModule.onInstall, (_ctx(msg.sender, account, price_, depositAmount)))
        );
    }

    /**
     * @dev Tell the installed module it is being removed, if it asked to be told.
     *      Called while its record is still installed, so the context carries
     *      its own settings.
     *
     *      Capped and swallowed even for a `strict` module, unlike every other
     *      callback it declared. A module able to revert here is a module a manager
     *      can never replace: the removal is the one action that must not
     *      depend on the thing being removed.
     */
    function _onUninstall() internal {
        InstalledModule storage m = _module();
        if (!m.has(F_ON_UNINSTALL)) return;
        bytes memory call = abi.encodeCall(
            ISlotModule.onUninstall,
            (_ctx(msg.sender, _occupancy().occupant, 0, 0))
        );
        if (!ModuleLib.callCapped(m.target, call, MODULE_GAS)) {
            emit ModuleCallFailed(m.target, ISlotModule.onUninstall.selector);
        }
    }
}
