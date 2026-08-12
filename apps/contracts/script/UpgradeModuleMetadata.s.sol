// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {FeedPostModule} from "../src/modules/FeedPostModule.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {MinimumTenurePolicyFactory} from "../src/policies/MinimumTenurePolicyFactory.sol";
import {MinimumPricePolicyFactory} from "../src/policies/MinimumPricePolicyFactory.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/**
 * @title UpgradeModuleMetadata
 * @notice Ships `IModuleMetadata` — one broadcast per chain.
 *
 * @dev `moduleURI()`/`policyURI()` became `metadataURI()`, and that is a WIRE
 *      break in two independent ways. Both matter for the ORDER below.
 *
 *        1. The selector. `Slot` staticcalls the getter, wrapped in `try`, so
 *           an un-upgraded utility does not revert — it silently reports no
 *           URI. Silence is the dangerous outcome, not failure.
 *        2. The ERC165 id. An id is the XOR of an interface's OWN selectors,
 *           so moving three of them to a parent changed
 *           `type(IUtility).interfaceId` from the value deployed utilities
 *           answer with. Until a utility is upgraded, `setUtilityVerified`
 *           rejects it outright.
 *
 *      ── Why this is safe to run as one transaction batch ─────────────────
 *
 *      Utilities are UUPS proxies, so they upgrade IN PLACE: addresses are
 *      preserved and every slot pointing at one keeps working across the
 *      upgrade. Policies are NOT — they hold their configuration in
 *      `immutable` fields and are minted per-slot by a factory — so the
 *      factories are redeployed and only NEW policies get the new interface.
 *
 *      A slot still pointing at a pre-rename policy keeps operating normally:
 *      `checkBuy` and `checkPriceUpdate` are untouched, and those are the only
 *      functions `Slot` calls on a policy. What it loses is re-verification —
 *      `setPolicyVerified` would revert on it — and its existing
 *      `verifiedPolicies[...]` entry is untouched by this script, so it stays
 *      whatever it already was.
 *
 *      ── Order ────────────────────────────────────────────────────────────
 *
 *      Utilities FIRST, factory LAST. The new factory asserts the new
 *      `IModuleMetadata` id during verification; doing it in the other order
 *      leaves a window where the freshly-upgraded utilities cannot be
 *      re-verified. Nothing here is atomic across transactions, so the window
 *      is real — it is just made as small and as harmless as possible.
 *
 *      Re-verification at the end is not cosmetic. It re-emits
 *      `ModuleVerified` with `metadataURI`, which is what the indexer reads;
 *      without it the registry keeps its old row and the rename never reaches
 *      the API.
 *
 *      Run: forge script script/UpgradeModuleMetadata.s.sol --sig 'upgradeChain(uint8)' <idx> --broadcast
 */
contract UpgradeModuleMetadata is BaseScript {
    function upgradeChain(uint8 chainIdx) external {
        _run(DeployementChain(chainIdx));
    }

    function _run(DeployementChain chain) internal broadcastOn(chain) {
        console2.log("=== UpgradeModuleMetadata ===");

        // ── 1. Utilities (UUPS, upgraded in place) ───────────────────────
        address feedPost = _readDeployment("FeedPostModule");
        FeedPostModule fp = FeedPostModule(feedPost);
        console2.log("FeedPostModule    ", feedPost, fp.version());
        fp.upgradeToAndCall(address(new FeedPostModule()), "");
        _assertMetadata(feedPost, "FeedPostModule");

        address metaMod = _readDeployment("MetadataModule");
        MetadataModule mm = MetadataModule(metaMod);
        console2.log("MetadataModule    ", metaMod, mm.version());
        mm.upgradeToAndCall(address(new MetadataModule()), "");
        _assertMetadata(metaMod, "MetadataModule");

        // ── 2. Policy factories (policies are immutable — redeploy) ───────
        //
        // These mint policies with CREATE2 and `verify()` proves authenticity
        // by recomputing the address from the terms. CREATE2 binds the address
        // to the INIT CODE, and the policy's bytecode changed with the rename —
        // so the same terms now land somewhere new, and the previously deployed
        // policies will not verify against these factories. That is correct,
        // not a regression: they genuinely are not deployments of this code.
        // Slots already pointing at one keep working regardless; `Slot` only
        // ever calls `checkBuy`/`checkPriceUpdate`, neither of which moved.
        MinimumTenurePolicyFactory tenure = new MinimumTenurePolicyFactory();
        _saveDeployment(address(tenure), "MinimumTenurePolicyFactory");
        console2.log("TenurePolicyFactory (new)", address(tenure));

        MinimumPricePolicyFactory price = new MinimumPricePolicyFactory();
        _saveDeployment(address(price), "MinimumPricePolicyFactory");
        console2.log("PricePolicyFactory  (new)", address(price));

        // ── 3. Slot implementation + beacon ──────────────────────────────
        SlotFactory factory = SlotFactory(_readDeployment("SlotFactoryV3"));
        UpgradeableBeacon beacon = UpgradeableBeacon(factory.beacon());

        Slot newSlot = new Slot();
        _saveDeployment(address(newSlot), "SlotImplementation");
        console2.log("Slot impl (new)   ", address(newSlot));

        // Base mainnet's beacon is owned by the admin EOA; Sepolia's was handed
        // to the factory. Take whichever path this chain is actually in rather
        // than assuming — the wrong one reverts. See UpgradeBaseMainnet.
        if (beacon.owner() == address(factory)) {
            factory.upgradeBeacon(address(newSlot));
        } else {
            beacon.upgradeTo(address(newSlot));
        }
        require(
            beacon.implementation() == address(newSlot),
            "beacon not upgraded"
        );

        // ── 4. Factory itself (new event shape + dual-id assertion) ───────
        SlotFactory newFactoryImpl = new SlotFactory();
        _saveDeployment(address(newFactoryImpl), "SlotFactoryImplementation");
        factory.upgradeToAndCall(address(newFactoryImpl), "");
        console2.log("Factory impl (new)", address(newFactoryImpl));

        // ── 5. Re-verify, so ModuleVerified re-emits with metadataURI ─────
        factory.setUtilityVerified(feedPost, true);
        factory.setUtilityVerified(metaMod, true);
        console2.log("Re-verified both utilities");

        console2.log("=== Done ===");
    }

    /// Fail here rather than let a half-upgraded utility reach verification:
    /// the getter is `try`-wrapped at the call site, so a miss is silent.
    function _assertMetadata(address target, string memory label) internal view {
        require(
            IModuleMetadata(target).supportsInterface(
                type(IModuleMetadata).interfaceId
            ),
            string.concat(label, ": missing IModuleMetadata id")
        );
        require(
            IUtility(target).supportsInterface(type(IUtility).interfaceId),
            string.concat(label, ": missing IUtility id")
        );
        // Reverts if the selector did not land, which is the whole point.
        IModuleMetadata(target).metadataURI();
        console2.log(string.concat("  ", label, " -> metadataURI() OK"));
    }
}
