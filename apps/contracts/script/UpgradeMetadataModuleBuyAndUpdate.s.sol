// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";

/**
 * @title UpgradeMetadataModuleBuyAndUpdate
 * @notice Ships `buyAndUpdate` / `buyAndUpdateWithPermit` — 2.0.0 to 2.1.0.
 *
 * @dev A UUPS upgrade in place. The module is a proxy, so the address is
 *      unchanged and every slot already pointing at it gains the new entry
 *      points at once: no migration, no re-verification, and no address-book
 *      edit in the contracts package.
 *
 *      ── Why this is a small script ───────────────────────────────────────
 *
 *      Nothing else moves. This upgrade ADDS two external functions and changes
 *      `version()`. It touches no storage — the layout is still the single
 *      `tokenURI` mapping, with `Ownable`/`UUPS` in their ERC-7201 namespaces —
 *      and it changes neither `IUtility` nor `IModuleMetadata`, so the interface
 *      ids `SlotFactory` checks are the ones it already holds. That is what
 *      separates it from `UpgradeModuleMetadata`, which had to re-verify both
 *      utilities and redeploy the policy factories because the ids themselves
 *      had shifted underneath them.
 *
 *      ── What the assertions are for ──────────────────────────────────────
 *
 *      `version()` proves the new implementation is live: the proxy answers
 *      2.1.0 only if `upgradeToAndCall` landed. `tokenURI` on a known-occupied
 *      slot is not tested here because the script cannot know one — that check
 *      belongs to a real buy against the upgraded module, which is the step
 *      after this one and the only thing that can prove the RPC-lag bug is gone.
 *
 *      Run: forge script script/UpgradeMetadataModuleBuyAndUpdate.s.sol \
 *             --sig 'upgradeChain(uint8)' <idx> --broadcast
 *           (idx: 2 = BaseSepolia, 4 = Base)
 */
contract UpgradeMetadataModuleBuyAndUpdate is BaseScript {
    function upgradeChain(uint8 chainIdx) external {
        _run(DeployementChain(chainIdx));
    }

    function _run(DeployementChain chain) internal broadcastOn(chain) {
        address proxy = _readDeployment("MetadataModule");
        MetadataModule mm = MetadataModule(proxy);

        console2.log("=== UpgradeMetadataModuleBuyAndUpdate ===");
        console2.log("proxy  ", proxy);
        console2.log("before ", mm.version());

        address newImpl = address(new MetadataModule());
        console2.log("impl   ", newImpl);

        mm.upgradeToAndCall(newImpl, "");

        // Read back THROUGH the proxy. Asking the implementation directly would
        // pass whether or not the upgrade pointer actually moved.
        string memory after_ = mm.version();
        console2.log("after  ", after_);
        require(
            keccak256(bytes(after_)) == keccak256(bytes("2.1.0")),
            "upgrade did not land"
        );

        // Identity is part of the contract the SDK verifies against before it
        // will write; a rename here would break `MetadataModuleClient` silently.
        require(
            keccak256(bytes(mm.name())) == keccak256(bytes("AdLandModule")),
            "name changed"
        );

        _saveDeployment(newImpl, "MetadataModuleImplementation");
        console2.log("=== Done ===");
    }
}
