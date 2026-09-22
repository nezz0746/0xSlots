// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotModule, Scopes, SlotContext} from "../../interfaces/ISlotModule.sol";
import {IDescribedModule} from "../../interfaces/IDescribedModule.sol";
import {ScopesLib} from "../../libraries/ScopesLib.sol";
import {ModuleSchemaLib} from "../../libraries/ModuleSchemaLib.sol";
import {Manifest, ModuleTerms, PendingTerms} from "../../types/SlotTypes.sol";
import {TermsLib} from "../../libraries/TermsLib.sol";
import {MinimumTenure} from "../MinimumTenure.sol";
import {SettingsStore} from "../base/SettingsStore.sol";
import {AdLandCreatives} from "./AdLandCreatives.sol";
import {AdLandModeration} from "./AdLandModeration.sol";
import {AdConfig, ISlotAd, ModerationMode} from "./IAdLand.sol";

/**
 * @title AdLandModule
 * @notice Everything a slot's module does: what AdLand asks of a slot, what it
 *         accepts as configuration, and what it does on each callback.
 *
 * @dev The advertising itself is {AdLandCreatives}, which works as a plain
 *      registry for a slot whose module is something else. This is the half that
 *      only means anything to a slot that attached AdLand.
 *
 *      A slot takes ONE module, so an advertising slot that also wants a minimum
 *      tenure cannot attach both — which is why the rule is inherited here from
 *      {MinimumTenure} rather than standing behind a second contract.
 */
abstract contract AdLandModule is
    AdLandCreatives,
    MinimumTenure,
    SettingsStore,
    ISlotModule,
    IDescribedModule
{
    using ModuleSchemaLib for ModuleSchemaLib.Field;

    function manifest(bytes32) external pure returns (Manifest memory o) {
        Scopes memory f;
        // Every path that ends a tenure. `afterSettle` is tax moving under a
        // tenure that has not ended.
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;

        // A slot takes ONE module, so an advertising slot that also wants a
        // minimum tenure cannot attach both — which is why AdLand vetoes buys
        // itself. The rule is {MinimumTenure}'s, shared with
        // {MinimumTenureModule} so there is one implementation rather than two
        // that drift.
        //
        // Declared unconditionally because `manifest` is `pure` and
        // cannot see a slot's data. Slots that configure no window pay one
        // staticcall that returns immediately; the alternative is a flag the
        // module could not honestly answer.
        f.beforeBuy = true;
        f.beforeSelfAssess = true;
        o.scopes = ScopesLib.pack(f);
    }

    /**
     * @dev The word is the id of a registered {AdConfig}: window, moderation
     *      mode and the key this slot asks for. ZERO configures nothing — no
     *      window, `Open`, no key — which is a legitimate advertising slot.
     *
     *      Everything a slot configures here is therefore a module term: changing
     *      any of it goes through `proposeTerms`, needs a mutable module, waits
     *      out the delay and lands at the next buy.
     */
    function checkSettings(bytes32 id) external view {
        if (id == bytes32(0)) return;
        AdConfig memory c = adConfigOf(id);
        if (c.tenureWindow != 0) tenureOf(bytes32(uint256(c.tenureWindow)));
    }

    /// @notice The configuration registered under `id`.
    /// @dev Reverts when nothing is registered, which is what stops a slot
    ///      attaching an id nobody wrote.
    function adConfigOf(bytes32 id) public view returns (AdConfig memory) {
        return abi.decode(_settingsById(id), (AdConfig));
    }

    /// @notice What a slot configured, or the defaults when it configured nothing.
    function adConfig(address slot) public view returns (AdConfig memory c) {
        if (slot.code.length == 0) return c;
        try ISlotAd(slot).moduleTerms() returns (ModuleTerms memory terms) {
            if (terms.target != address(this) || terms.settings == bytes32(0)) return c;
            return adConfigOf(terms.settings);
        } catch {
            return c;
        }
    }

    /// @inheritdoc AdLandModeration
    function _modeOf(address slot) internal view override returns (ModerationMode) {
        return adConfig(slot).moderation;
    }

    /// @inheritdoc AdLandModeration
    function _queuedModeOf(address slot, ModerationMode live)
        internal
        view
        override
        returns (ModerationMode)
    {
        try ISlotAd(slot).pendingTerms() returns (PendingTerms memory p) {
            if (p.mask & TermsLib.MODULE == 0) return live;
            if (p.moduleTerms.target != address(this)) return ModerationMode.Open;
            if (p.moduleTerms.settings == bytes32(0)) return ModerationMode.Open;
            return adConfigOf(p.moduleTerms.settings).moderation;
        } catch {
            return live;
        }
    }

    /// @inheritdoc MinimumTenure
    function _windowOf(bytes32 settings) internal view override returns (uint256) {
        if (settings == bytes32(0)) return 0;
        return adConfigOf(settings).tenureWindow;
    }


    /// @notice Refuse a buy that lands inside a protected window, when this
    ///         slot configured one.
    function beforeBuy(SlotContext calldata ctx) external view {
        if (_windowOf(ctx.moduleTerms.settings) == 0) return;
        _enforceTenureOnBuy(ctx);
    }

    /// @notice No cutting your price while nobody is allowed to take it.
    function beforeSelfAssess(SlotContext calldata ctx) external view {
        if (_windowOf(ctx.moduleTerms.settings) == 0) return;
        _enforceTenureOnSelfAssess(ctx);
    }

    function afterBuy(SlotContext calldata ctx) external {
        _clear(ctx.slot);
    }

    function afterRelease(SlotContext calldata ctx) external {
        _clear(ctx.slot);
        _barIfWindowed(ctx);
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        _clear(ctx.slot);
        _barIfWindowed(ctx);
    }

    /// @dev The window is only half enforced by `beforeBuy`: without the bar,
    ///      whoever leaves can buy the vacant slot back at any price and restart
    ///      their window. Slots with no window configured have nothing to bar.
    function _barIfWindowed(SlotContext calldata ctx) private {
        if (_windowOf(ctx.moduleTerms.settings) == 0) return;
        _barReentry(ctx);
    }

    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}



    function definition() external pure returns (string memory) {
        return
            ModuleSchemaLib.describe(
                "AdLand",
                "An advertising space: the occupant publishes a creative, the manager may screen it, and a minimum tenure can protect them while it runs.",
                "https://adland.xyz",
                ModuleSchemaLib.list(
                    // Optional HERE, where the rule is one of several things a
                    // slot configures, so zero is a legitimate "no window"
                    // rather than the unconfigured word {tenureOf} refuses.
                    tenureField("tenureWindow", "uint64").from(0),
                    ModuleSchemaLib
                        .choice(
                            "moderation",
                            "uint8",
                            "Moderation",
                            ModuleSchemaLib.labels("Open", "First per tenure", "Every")
                        )
                        .explain("Which creatives wait for the manager to approve them."),
                    ModuleSchemaLib
                        .value("key", "bytes32", "Key")
                        .explain("A registry name this slot asks for. Claimed first come, with claimKey.")
                        .means("adland-key")
                ),
                true, // three values do not fit a word, so the slot holds their id
                true // and a slot may configure none of them
            );
    }

}
