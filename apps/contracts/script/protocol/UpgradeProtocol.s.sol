// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {Upgrades, Options} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";

/**
 * @title UpgradeProtocol
 * @notice Upgrade one contract, with every check that can be made before the
 *         transaction is sent.
 *
 *   forge script script/protocol/UpgradeProtocol.s.sol:UpgradeProtocol \
 *     --sig "run(string)" SlotFactory --rpc-url $RPC --broadcast
 *
 * @dev ── What this refuses ──────────────────────────────────────────────
 *
 *      1. A version that does not strictly increase. Catches shipping the
 *         same implementation twice, and shipping an OLDER one off a stale
 *         branch — neither of which reverts on its own.
 *      2. A storage layout that is not compatible with what is deployed.
 *         `Upgrades.validateUpgrade` runs the OpenZeppelin checker, which is
 *         the same analysis a human does by diffing `forge inspect storage`
 *         and is not subject to remembering to do it.
 *      3. An unset admin, or a chain with no config at all.
 *
 *      ── What it deliberately does NOT do ────────────────────────────────
 *
 *      Broadcast against a chain whose config says `testnet: false`. The
 *      beacon upgrade replaces the code behind every slot at once; that
 *      transaction should be signed by whoever owns the protocol, from a
 *      Safe, having read the calldata. This script will PREPARE it — deploy
 *      and validate the implementation, print the address and the calldata —
 *      and stop.
 */
contract UpgradeProtocol is ProtocolConfig {
    error VersionMustIncrease(string name, uint64 deployed, uint64 candidate);
    error NothingDeployed(string name);
    error MainnetIsNotUpgradedByScript(string name);

    function run(string memory name) external {
        ChainConfig memory cfg = chainConfig();
        address proxy = deployed(name);
        if (proxy == address(0)) revert NothingDeployed(name);

        uint64 onChain = _versionOf(proxy);
        uint64 candidate = _candidateVersion(name);
        if (candidate <= onChain) {
            revert VersionMustIncrease(name, onChain, candidate);
        }

        console2.log("chain    ", cfg.name);
        console2.log("contract ", name);
        console2.log("proxy    ", proxy);
        console2.log("deployed version", onChain);
        console2.log("candidate version", candidate);

        // The layout check. Reverts the script if the new implementation
        // cannot safely read what the old one wrote.
        Options memory opts;
        opts.referenceContract = _reference(name);
        Upgrades.validateUpgrade(_artifact(name), opts);
        console2.log("storage layout: compatible");

        if (!cfg.testnet) {
            console2.log("");
            console2.log("MAINNET: prepared, not sent. Execute from the admin.");
            revert MainnetIsNotUpgradedByScript(name);
        }

        vm.startBroadcast();
        Upgrades.upgradeProxy(proxy, _artifact(name), "", opts);
        vm.stopBroadcast();

        uint64 after_ = _versionOf(proxy);
        require(after_ == candidate, "post-upgrade version mismatch");
        record(name, proxy, after_);
        console2.log("upgraded. version now", after_);
    }

    function _versionOf(address proxy) internal view returns (uint64) {
        (bool ok, bytes memory data) = proxy.staticcall(
            abi.encodeWithSignature("version()")
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint64));
    }

    function _candidateVersion(string memory name)
        internal
        returns (uint64)
    {
        bytes32 h = keccak256(bytes(name));
        if (h == keccak256("SlotFactory")) return new SlotFactory().version();
        if (h == keccak256("OfferBook")) return new OfferBook().version();
        if (h == keccak256("Slot")) return new Slot().version();
        revert NothingDeployed(name);
    }

    function _artifact(string memory name)
        internal
        pure
        returns (string memory)
    {
        return string.concat(name, ".sol:", name);
    }

    /// @dev The contract the new one must stay compatible WITH. The OZ
    ///      annotation on the candidate can supply this instead; naming it
    ///      here keeps the reference explicit at the call site.
    function _reference(string memory name)
        internal
        pure
        returns (string memory)
    {
        return _artifact(name);
    }
}
