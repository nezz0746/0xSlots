// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MulticallUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {IDescribedHook, HookDescriptor} from "../../IDescribedHook.sol";
import {Versioned} from "../../Versioned.sol";
import {AdLandCreate} from "./AdLandCreate.sol";
import {AdLandCreatives} from "./AdLandCreatives.sol";
import {AdLandLens} from "./AdLandLens.sol";
import {AdLandRegistry} from "./AdLandRegistry.sol";

/**
 * @title AdLand
 * @notice AdLand on the V2 slot surface: the creative, the key that names a
 *         slot, and one call that reads both.
 *
 * @dev ── One contract, three roles ────────────────────────────────────────
 *
 *      Called BY a slot it is that slot's hook (`AdLandCreatives`). Called
 *      directly it is the registry (`AdLandRegistry`) and the lens
 *      (`AdLandLens`). V1's `AdModule` merged the same three for the same
 *      reason: nothing is circular because nothing has to be discovered — the
 *      address is a constant in the SDK — and merging is what makes the lens
 *      cheap, because the creative is this contract's own storage rather than a
 *      cross-contract call.
 *
 *      V1's `MetadataModule` / `AdModule` split is gone. That split was an
 *      upgrade seam, not a design: `AdModule` inherited `MetadataModule` so the
 *      live proxy's slot order was guaranteed by the compiler. This is a fresh
 *      deployment with no proxy to preserve.
 *
 *      Everything here is what is left once the three concerns are elsewhere:
 *      construction, identity, and who may replace the code.
 */
contract AdLand is
    AdLandCreate,
    AdLandCreatives,
    AdLandLens,
    AdLandRegistry,

    /**
     * Batch anything on this hook in one transaction.
     *
     * ── Why it is safe to add to a LIVE proxy ────────────────────────────
     *
     * It declares no storage. `MulticallUpgradeable` extends `Initializable`
     * and `ContextUpgradeable`, both of which this contract already inherits
     * through `OwnableUpgradeable`, and OZ v5 keeps what state they have in
     * ERC-7201 namespaced slots rather than the sequential layout. So this
     * appears in the inheritance list without moving a single slot beneath
     * it — which is the only question that matters for an upgrade, and the
     * reason {AdLandStorage} declares every slot in one place.
     *
     * ── What it does and does not give the caller ───────────────────────
     *
     * `multicall` is a self-`delegatecall` per entry, so `msg.sender` is
     * preserved throughout: a batch of `publish` calls is still the
     * occupant publishing, and a batch of `createAdSlot` calls still
     * records the caller in `keyOwner`. That is the difference from routing
     * the same batch through a generic aggregator like Multicall3, where
     * every call arrives from the aggregator and a claimed name ends up
     * owned by it.
     *
     * It grants nothing new. Every function it can reach is one the caller
     * could already call directly, with the same access control applied in
     * the same order — this only removes the confirmations between them.
     */
    MulticallUpgradeable,
    IDescribedHook
{
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    ///
    ///      3 — `multicall` and `createAdSlotMany`. Additive: no storage moved,
    ///      no existing selector changed, no behaviour altered for a caller who
    ///      uses neither.
    function version() public pure virtual override returns (uint64) {
        return 3;
    }

    /**
     * @notice Two families, because this hook now does two things.
     *
     * @dev A slot takes one hook, so an advertising slot that also wants a
     *      minimum tenure attaches AdLand and nothing else. A consumer that
     *      only read the first entry would see "creatives" and conclude the
     *      slot is freely buyable, which is the opposite of true for a slot
     *      inside its window. Both are declared, and a client matches whichever
     *      families it understands.
     *
     *      `version: 1` on the adland entry describes THIS contract's creative
     *      behaviour, unchanged. The tenure entry carries the rule's own
     *      version, so a client that already knows {MinimumTenureHook} reads it
     *      here without learning anything new.
     *
     *      Declared unconditionally, like `subscriptions`. This is `pure` and
     *      cannot see a slot, so it says what the hook CAN enforce; whether a
     *      given slot configured a window is `Slot.hookData`, and zero means
     *      none.
     */
    function descriptors() external pure returns (HookDescriptor[] memory d) {
        d = new HookDescriptor[](2);
        d[0] = HookDescriptor({
            family: FAMILY,
            version: 1,
            // Creatives take no per-slot configuration.
            signature: "",
            // The creative side takes no configuration and behaves identically
            // for every slot pointing here.
            data: "",
            metadataURI: ""
        });
        d[1] = HookDescriptor({
            family: TENURE_FAMILY,
            version: TENURE_DESCRIPTOR_VERSION,
            signature: tenureSignature(),
            // The same schema {MinimumTenureHook} publishes, from the same
            // base — so a client that can configure a tenure hook can
            // configure an AdLand slot's window without knowing it is AdLand.
            data: tenureBounds_(),
            metadataURI: ""
        });
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
