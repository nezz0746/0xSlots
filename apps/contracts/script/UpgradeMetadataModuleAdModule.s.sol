// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {AdModule} from "../src/modules/AdModule.sol";

/**
 * @title UpgradeMetadataModuleAdModule
 * @notice Ships the slot registry and the read lens — 2.1.0 to 2.2.0.
 *
 * @dev A UUPS upgrade in place. The module is a proxy, so the address is
 *      unchanged and every slot already pointing at it gains the new entry
 *      points at once: no migration, no re-verification, no address-book edit.
 *
 *      ── What this is for ─────────────────────────────────────────────────
 *
 *      A publisher pastes `<adland-slot slot="0xf872…">` into their page, and
 *      that address then lives in someone else's HTML with no mechanism by
 *      which it can ever be changed. It is the one dependency in the embed that
 *      shipping cannot repair. After this, the SDK can resolve a NAME through
 *      the module instead, and the name is ours to repoint.
 *
 *      ── The risk, and what bounds it ─────────────────────────────────────
 *
 *      This proxy holds every creative in the protocol in `tokenURI` at storage
 *      slot 0. `AdModule` is `MetadataModule` plus appended state, so the
 *      ordering is the compiler's guarantee rather than a reviewer's — and
 *      `test_UpgradePreservesEveryStoredCreative` performs this exact upgrade
 *      against a proxy with a creative in it and checks the creative survives.
 *      Run the suite before broadcasting; it is the only thing standing between
 *      a reordered slot and every ad in the protocol decoding as garbage.
 *
 *      ── Why `name()` must not move ───────────────────────────────────────
 *
 *      The SDK verifies module identity against `name()` before it will write,
 *      so this changes `version()` and nothing else about identity. Both are
 *      asserted below, one for having changed and one for not having.
 *
 *      Run: forge script script/UpgradeMetadataModuleAdModule.s.sol \
 *             --sig 'upgradeChain(uint8)' <idx> --broadcast
 *           (idx: 2 = BaseSepolia, 4 = Base)
 *
 *      Sepolia first. The registry is empty after this and setting it is a
 *      separate transaction, so an upgrade that lands and a key that resolves
 *      are two things to check rather than one.
 */
contract UpgradeMetadataModuleAdModule is BaseScript {
    function upgradeChain(uint8 chainIdx) external {
        _run(DeployementChain(chainIdx));
    }

    function _run(DeployementChain chain) internal broadcastOn(chain) {
        address proxy = _readDeployment("MetadataModule");
        AdModule mm = AdModule(proxy);

        console2.log("=== UpgradeMetadataModuleAdModule ===");
        console2.log("proxy  ", proxy);
        console2.log("before ", mm.version());

        address newImpl = address(new AdModule());
        console2.log("impl   ", newImpl);

        mm.upgradeToAndCall(newImpl, "");

        // Read back THROUGH the proxy. Asking the implementation directly would
        // pass whether or not the upgrade pointer actually moved.
        string memory after_ = mm.version();
        console2.log("after  ", after_);
        require(
            keccak256(bytes(after_)) == keccak256(bytes("2.2.0")),
            "upgrade did not land"
        );

        require(
            keccak256(bytes(mm.name())) == keccak256(bytes("AdLandModule")),
            "name changed"
        );

        // The new surface, proven live rather than assumed. `primary()` reads
        // storage that did not exist a moment ago; if the proxy were still on
        // the old implementation this call would revert rather than return
        // zero, so it distinguishes "upgraded, unset" from "not upgraded".
        console2.log("primary (expect 0) ", mm.primary());

        _saveDeployment(newImpl, "MetadataModuleImplementation");
        console2.log("=== Done ===");
    }
}
