// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {MinimumTenureHookFactory} from "../../src/hooks/MinimumTenureHookFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {SlotTaker} from "../../src/periphery/SlotTaker.sol";

contract SlotsTestToken is ERC20 {
    constructor() ERC20("Slots Test USD", "USDX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title DeploySlots
 * @notice Deploys the hook-based Slots protocol to a local chain.
 *
 *   anvil &
 *   forge script script/slots/DeploySlots.s.sol:DeploySlots \
 *     --rpc-url http://127.0.0.1:8545 --broadcast \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *
 * @dev ── Why this does not extend BaseScript ────────────────────────────────
 *
 *      `BaseScript.broadcastOn` opens its own fork from a foundry.toml alias and
 *      ignores `--rpc-url` entirely. That is a good default for the multichain
 *      deploys it was written for and a trap here: you read a simulation against
 *      whatever the alias points at while believing you were reading the chain
 *      on the command line. A local script should talk to the URL it was given.
 *
 *      ── No address pinning ──────────────────────────────────────────────────
 *
 *      The old local deploy CREATE2'd the factory through a bootstrap so its
 *      address survived contract edits. That machinery exists to spare you
 *      re-pasting an address into two configs; it costs an indirection that has
 *      confused every person who has read it. While the protocol is changing
 *      daily, print the addresses and paste them. Pin it again when it settles.
 */
contract DeploySlots is Script {
    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;
        uint256 startBlock = block.number;

        Slot implementation = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        SlotFactory factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(factoryImpl),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (deployer, address(implementation))
                    )
                )
            )
        );

        // A week of protected tenure: long enough that the UI's "available in…"
        // state is visible without a time warp, short enough to wait out.
        MinimumTenureHook tenureHook = new MinimumTenureHook(7 days, "");
        factory.attestHook(address(tenureHook), true);

        SlotsTestToken token = new SlotsTestToken();
        token.mint(deployer, 1_000_000e18);

        // ── Appended, deliberately last ──────────────────────────────────────
        //
        // Every CREATE address above is a function of the deployer's nonce, and
        // `scripts/slots-local.sh` and `packages/contracts/src/slots.ts` both
        // assert the factory's. Inserting a deployment ANYWHERE above this line
        // shifts all of them and breaks both. New deployments go at the end.
        //
        // Empty default metadata: nothing has been published for this family
        // yet, and `IDescribedHook` says empty means exactly that. Passing a URI
        // that resolves to nothing would look authoritative and be worse.
        MinimumTenureHookFactory tenureHookFactory = new MinimumTenureHookFactory();

        // Appended last, like the hook factory above it: anything inserted
        // higher shifts every address after it and breaks the pinned
        // SlotFactory that slots.ts and dev-chain.sh both assert.
        OfferBook offerBook = OfferBook(
            address(
                new ERC1967Proxy(
                    address(new OfferBook()),
                    abi.encodeCall(OfferBook.initialize, (deployer))
                )
            )
        );
        SlotTaker slotTaker = new SlotTaker();

        vm.stopBroadcast();

        // The indexer's dev loop blocks until this file appears — that is what
        // makes the chain half and the index half independently restartable,
        // instead of depending on turbo's start order. Same shape the older
        // scripts write, so `_readDeployment` still reads it.
        _record("SlotFactory", address(factory), startBlock);
        _record("Slot", address(implementation), startBlock);
        _record("MinimumTenureHook", address(tenureHook), startBlock);
        _record("SlotsTestToken", address(token), startBlock);
        _record("OfferBook", address(offerBook), startBlock);
        _record("SlotTaker", address(slotTaker), startBlock);
        _record(
            "MinimumTenureHookFactory",
            address(tenureHookFactory),
            startBlock
        );

        console2.log("");
        console2.log("SLOT_FACTORY       ", address(factory));
        console2.log("SLOT_IMPLEMENTATION", address(implementation));
        console2.log("MIN_TENURE_HOOK    ", address(tenureHook));
        console2.log("TEST_TOKEN         ", address(token));
        console2.log("TENURE_HOOK_FACTORY", address(tenureHookFactory));
        console2.log("ADMIN              ", deployer);
        console2.log("OFFER_BOOK         ", address(offerBook));
        console2.log("SLOT_TAKER         ", address(slotTaker));
        console2.log("START_BLOCK        ", startBlock);
    }

    function _record(
        string memory name,
        address addr,
        uint256 startBlock
    ) internal {
        string memory obj = name;
        vm.serializeAddress(obj, "address", addr);
        string memory json = vm.serializeUint(obj, "startBlock", startBlock);
        vm.writeFile(
            string.concat(
                "./deployments/",
                vm.toString(block.chainid),
                "/",
                name,
                ".json"
            ),
            json
        );
    }
}
