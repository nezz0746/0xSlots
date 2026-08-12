// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SlotCollective} from "../src/SlotCollective.sol";
import {SlotCollectiveFactory} from "../src/SlotCollectiveFactory.sol";

/**
 * @title DeployCollectiveFactory
 * @notice Ships SlotCollectiveFactory to a real chain.
 *
 * Usage:
 *   forge script script/DeployCollectiveFactory.s.sol:DeployCollectiveFactory \
 *     --sig "baseSepolia()" --broadcast
 *
 * ── The warehouse is permanent ───────────────────────────────────────────────
 *
 * `SlotCollective`'s constructor takes the SplitsWarehouse and `PushSplit`
 * stores it as an IMMUTABLE — it lives in the implementation's runtime bytecode
 * and can never be changed, only replaced by a beacon upgrade to a
 * newly-constructed implementation.
 *
 * So this is the one value worth being certain about. It is the canonical 0xSplits
 * v2 warehouse, identical across every chain they have shipped to, and taken
 * from their own deploy config at
 * lib/splits-contracts-monorepo/packages/splits-v2/script/config/<chainId>.json.
 * The run asserts it has code before deploying anything — a warehouse address
 * with no contract behind it would produce a factory whose collectives can
 * receive tax forever and never distribute it.
 *
 * ── Why the proxy is plain CREATE ────────────────────────────────────────────
 *
 * Unlike the local script there is no address to pin: nothing is redeployed on a
 * real chain, so there is no drift to defend against and CREATE2's cost buys
 * nothing. The resulting address goes into packages/contracts/src/addresses.ts
 * and packages/ponder/ponder.config.ts.
 */
contract DeployCollectiveFactory is BaseScript {
    /// Canonical 0xSplits v2 warehouse. Same address on base and base-sepolia.
    address internal constant SPLITS_WAREHOUSE =
        0x8fb66F38cF86A3d5e8768f8F1754A24A6c661Fb8;

    function baseSepolia() external {
        _deploy(DeployementChain.BaseSepolia);
    }

    function base() external {
        _deploy(DeployementChain.Base);
    }

    function _deploy(DeployementChain chain) internal broadcastOn(chain) {
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("=== SlotCollectiveFactory deploy ===");
        console2.log("chainid:", block.chainid);
        console2.log("deployer:", deployer);

        // Fail before spending anything if the warehouse is wrong for this
        // chain. It is baked into the implementation permanently.
        require(
            SPLITS_WAREHOUSE.code.length > 0,
            "SplitsWarehouse has no code on this chain"
        );
        console2.log("SplitsWarehouse:", SPLITS_WAREHOUSE);

        SlotCollective implementation = new SlotCollective(SPLITS_WAREHOUSE);
        console2.log("SlotCollective impl:", address(implementation));

        SlotCollectiveFactory factoryImpl = new SlotCollectiveFactory();
        console2.log("Factory impl:", address(factoryImpl));

        // Initialize in the proxy constructor, so the factory is never briefly
        // live and uninitialized — the window an observer could claim admin in.
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(
                SlotCollectiveFactory.initialize,
                (deployer, address(implementation))
            )
        );

        SlotCollectiveFactory factory = SlotCollectiveFactory(address(proxy));
        console2.log("Factory proxy:", address(proxy));
        console2.log("admin:", factory.admin());
        console2.log("beacon:", address(factory.beacon()));

        require(factory.admin() == deployer, "admin not set");

        _saveDeployment(address(proxy), "SlotCollectiveFactory");
        _saveDeployment(address(implementation), "SlotCollectiveImplementation");

        console2.log("=== done ===");
    }
}
