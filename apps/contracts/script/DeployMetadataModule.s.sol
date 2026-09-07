// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {MetadataModule} from "../src/v1/modules/MetadataModule.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployMetadataModule is BaseScript {
    function run() external broadcastOn(DeployementChain.BaseSepolia) {
        // Deploy implementation
        MetadataModule impl = new MetadataModule();
        console2.log("MetadataModule impl:", address(impl));

        // Deploy UUPS proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MetadataModule.initialize, (vm.addr(deployerPrivateKey)))
        );
        console2.log("MetadataModule proxy:", address(proxy));
        console2.log("Owner:", vm.addr(deployerPrivateKey));

        _saveDeployment(address(proxy), "MetadataModule");
    }
}
