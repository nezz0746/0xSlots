// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";

/**
 * @title SmokeBuyAndUpdate
 * @notice Proves `buyAndUpdate` against REAL deployed bytecode, on a throwaway
 *         slot, before the same upgrade is pointed at mainnet.
 *
 * @dev The Foundry tests run against a `Slot` compiled from this working tree.
 *      What they cannot tell you is whether the module works against the `Slot`
 *      implementation the beacon ACTUALLY points at on this chain, which is a
 *      different build and the one every live slot runs. That gap is the whole
 *      reason to smoke-test on a testnet before touching mainnet.
 *
 *      Native currency deliberately: it needs no token, no approval and no
 *      faucet beyond the gas the deployer already holds, and it exercises the
 *      fiddlier of the two paths — the one where `msg.value` has to match
 *      `owedByBuyer` exactly.
 *
 *      What this does NOT prove is the bug being fixed. That is a wallet/RPC
 *      timing failure and only a real browser wallet can show it is gone.
 *
 *      Run: forge script script/SmokeBuyAndUpdate.s.sol \
 *             --sig 'run(uint8)' 2 --broadcast
 */
contract SmokeBuyAndUpdate is BaseScript {
    function run(uint8 chainIdx) external {
        _run(DeployementChain(chainIdx));
    }

    function _run(DeployementChain chain) internal broadcastOn(chain) {
        address me = vm.addr(deployerPrivateKey);
        MetadataModule module = MetadataModule(
            _readDeployment("MetadataModule")
        );
        SlotFactory factory = SlotFactory(_readDeployment("SlotFactoryV3"));

        console2.log("=== SmokeBuyAndUpdate ===");
        console2.log("module ", address(module), module.version());
        console2.log("beacon impl (live)", factory.implementation());

        // A throwaway slot, priced so the whole exercise costs dust.
        address slot = factory.createSlot(
            me,
            IERC20(address(0)),
            SlotConfig({
                mutableTax: true,
                mutableUtility: true,
                mutablePolicy: false,
                manager: me
            }),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(module),
                liquidationBountyBps: 500,
                minDepositSeconds: 86400,
                occupancyPolicy: address(0)
            })
        );
        console2.log("slot   ", slot);

        // Vacant, so the price is zero and the whole cost is the deposit.
        uint256 owed = Slot(slot).price() + 1000 wei;
        require(Slot(slot).occupant() == address(0), "expected vacant");

        module.buyAndUpdate{value: owed}(
            slot,
            1000 wei,
            1_000_000 wei,
            "ipfs://smoke-test"
        );

        // The two halves that used to need two transactions, checked together.
        require(Slot(slot).occupant() == me, "buyer was not seated");
        require(
            keccak256(bytes(module.tokenURI(slot))) ==
                keccak256(bytes("ipfs://smoke-test")),
            "uri did not survive the onTransfer clear"
        );

        console2.log("occupant", Slot(slot).occupant());
        console2.log("uri     ", module.tokenURI(slot));
        console2.log("=== One transaction. Both halves landed. ===");
    }
}
