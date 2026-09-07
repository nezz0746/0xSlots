// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";

/**
 * @title CreateTestSlot
 * @notice Creates a test slot on the new Base Sepolia factory and verifies event hub
 *
 * Usage:
 *   forge script script/CreateTestSlot.s.sol:CreateTestSlot \
 *     --sig "run()" --broadcast --rpc-url https://sepolia.base.org
 */
contract CreateTestSlot is BaseScript {

    function run() external {
        _create(DeployementChain.BaseSepolia);
    }

    function _create(DeployementChain chain) internal broadcastOn(chain) {
        address factoryProxy = _readDeployment("SlotFactoryV3");
        SlotFactory factory = SlotFactory(factoryProxy);

        console2.log("=== Creating Test Slot ===");
        console2.log("Factory:", factoryProxy);

        address deployer = vm.addr(deployerPrivateKey);

        // USDC on Base Sepolia
        IERC20 usdc = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e);

        SlotConfig memory config = SlotConfig({
            mutableTax: false,
            mutableUtility: false, mutablePolicy: false,
            manager: address(0)
        });

        SlotInitParams memory initParams = SlotInitParams({
            taxPercentage: 100, // 1%
            utility: address(0),
            liquidationBountyBps: 0,
            minDepositSeconds: 0,
            occupancyPolicy: address(0)
        });

        address slot = factory.createSlot(
            deployer,    // recipient
            usdc,        // currency
            config,
            initParams
        );

        console2.log("Slot deployed:", slot);

        // Verify event hub wiring
        address slotFactory = Slot(slot).factory();
        console2.log("Slot factory:", slotFactory);
        require(slotFactory == factoryProxy, "factory not set!");
        require(factory.isSlot(slot), "slot not registered!");

        console2.log("=== Test Slot Created & Verified ===");
    }
}
