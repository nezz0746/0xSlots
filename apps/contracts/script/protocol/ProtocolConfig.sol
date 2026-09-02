// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/console2.sol";
import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/**
 * @title ProtocolConfig
 * @notice Reads `deployments/config/<chainid>.json`, and the address book.
 *
 * @dev Configuration is per chain and lives on disk, so adding a chain is
 *      adding a file rather than editing a script. The script never contains a
 *      chain id, an RPC URL or an admin — the first is `block.chainid`, the
 *      second is an env var named by the config, and the third is the config's
 *      job to state.
 */
abstract contract ProtocolConfig is Script {
    using stdJson for string;

    /// @notice The canonical CREATE2 factory, present on essentially every
    ///         EVM chain and predeployed by anvil.
    /// @dev Forge routes `new X{salt: s}(...)` through this during broadcast,
    ///      which is what makes the deployer address — and therefore the
    ///      derived address — the same everywhere.
    address internal constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev Namespaced so a salt of ours can never collide with another
    ///      protocol's on a shared CREATE2 factory.
    string internal constant NAMESPACE = "0xslots.v1";

    struct ChainConfig {
        string name;
        address admin;
        address splitsWarehouse;
        bool explorerVerify;
        bool testnet;
    }

    error NoConfigForChain(uint256 chainId);
    error AdminNotSet(uint256 chainId);
    error MainnetNeedsAnExplicitFlag(uint256 chainId);

    function chainConfig() internal view returns (ChainConfig memory c) {
        string memory path = string.concat(
            vm.projectRoot(),
            "/deployments/config/",
            vm.toString(block.chainid),
            ".json"
        );
        if (!vm.exists(path)) revert NoConfigForChain(block.chainid);

        string memory json = vm.readFile(path);
        c.name = json.readString(".name");
        c.admin = json.readAddress(".admin");
        c.splitsWarehouse = json.readAddress(".splitsWarehouse");
        c.explorerVerify = json.readBool(".explorerVerify");
        c.testnet = json.readBool(".testnet");

        // A placeholder admin is how a mainnet config ships, so that reaching
        // for it by accident fails here rather than deploying something nobody
        // can upgrade.
        if (c.admin == address(0)) revert AdminNotSet(block.chainid);
    }

    /**
     * @dev The salt for one contract at one version.
     *
     *      Includes the version, so a new implementation lands at a NEW
     *      address on every chain rather than colliding with the old one —
     *      and excludes the chain id, so that address is the same everywhere.
     */
    function saltFor(string memory contractName, uint64 v)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(NAMESPACE, contractName, v));
    }

    /// @dev Where a `new X{salt: s}(args)` will land, given the canonical
    ///      deployer. Lets a script report an address before spending gas.
    function predict(bytes32 salt, bytes memory initCode)
        internal
        pure
        returns (address)
    {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                CREATE2_DEPLOYER,
                                salt,
                                keccak256(initCode)
                            )
                        )
                    )
                )
            );
    }

    // ── the address book ──────────────────────────────────────────────────

    function recordPath(string memory name)
        internal
        view
        returns (string memory)
    {
        return
            string.concat(
                vm.projectRoot(),
                "/deployments/",
                vm.toString(block.chainid),
                "/",
                name,
                ".json"
            );
    }

    /**
     * @dev `startBlock` is where the INDEXER begins, so it belongs to the
     *      deployment and never to the run that happens to be writing.
     *
     *      This wrote `block.number` unconditionally, which was harmless while
     *      the script only ever deployed. Now that it upgrades in place, that
     *      would stamp the UPGRADE's block onto a contract deployed long before
     *      it — and the indexer, reading this file, would silently skip every
     *      event in between. The first symptom is an explorer that has lost
     *      slots nobody deleted.
     *
     *      Keep whatever the record already holds. Only a genuinely new address
     *      gets today's block.
     */
    function record(string memory name, address addr, uint64 v) internal {
        uint256 start = block.number;

        string memory path = recordPath(name);
        address prevAddr;
        if (vm.exists(path)) {
            string memory prev = vm.readFile(path);
            prevAddr = prev.readAddress(".address");
            if (prevAddr == addr) {
                start = prev.readUint(".startBlock");
            }
        }

        string memory obj = name;
        vm.serializeAddress(obj, "address", addr);
        vm.serializeUint(obj, "version", v);
        string memory json = vm.serializeUint(obj, "startBlock", start);

        // `forge script` runs the script either way — `--broadcast` decides
        // only whether the transactions are SENT, not whether the body runs. So
        // a dry run reached this line and rewrote the records with addresses it
        // had merely predicted; on a live chain that pointed the indexer at
        // contracts that did not exist. Nothing in forge tells a script which
        // mode it is in, so the caller says.
        if (vm.envOr("DRY_RUN", false)) {
            // Only when the record would actually change. `record` is called for
            // every contract on every run, so logging each one buried the two
            // lines that mattered under a dozen that said nothing.
            if (!vm.exists(path) || prevAddr != addr) {
                console2.log("would record", name, addr);
            }
            return;
        }

        vm.writeFile(path, json);
    }

    function deployed(string memory name) internal view returns (address) {
        string memory path = recordPath(name);
        if (!vm.exists(path)) return address(0);
        return vm.readFile(path).readAddress(".address");
    }

    function deployedVersion(string memory name)
        internal
        view
        returns (uint64)
    {
        string memory path = recordPath(name);
        if (!vm.exists(path)) return 0;
        return uint64(vm.readFile(path).readUint(".version"));
    }
}
