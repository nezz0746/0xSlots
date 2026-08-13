// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";

/// Local-only test currency. Freely mintable; never deploy to a real network.
contract LocalToken is ERC20 {
    constructor() ERC20("0xSlots Test USD", "USDX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title SeedLocal
 * @notice Populates the local chain so the explorer has something to render.
 *
 * Run after DeployLocal:
 *   forge script script/SeedLocal.s.sol:SeedLocal --broadcast
 *
 * Aims for coverage of the axes the UI actually branches on rather than volume:
 * ERC-20 vs native currency, mutable vs immutable config, with and without a
 * utility module, occupied vs vacant, and one slot deliberately funded to the
 * exact minimum so a short time warp makes it liquidatable. That last one is
 * the case that is effectively untestable against a live testnet.
 */
contract SeedLocal is BaseScript {
    uint256 internal constant MONTH = 30 days;
    uint256 internal constant BASIS_POINTS = 10_000;

    /**
     * LocalToken's address, pinned.
     *
     * Plain CREATE, so this depends on (deployer, nonce) — not on the token's
     * bytecode. It survives Solidity edits, and moves whenever the deployer's
     * NONCE COUNT changes at the moment this line runs.
     *
     * That is a wider surface than it looks, and it has bitten once: the nonce
     * is shared with `DeployLocal`, which runs first against the same EOA. Any
     * contract added THERE shifts this address, even though nothing in this
     * script changed. Adding the SplitsWarehouse and collective deployments
     * moved it from 0x8A79…C318 to the value below.
     *
     * packages/sdk/src/tokens.ts lists this as anvil's default currency, so
     * drift would leave the create form pointed at an address with no code.
     * Assert rather than discover that in the UI — and when it fires, update
     * BOTH constants together.
     */
    address internal constant EXPECTED_LOCAL_TOKEN =
        0x9A676e781A523b5d0C0e43731313A708CB607508;

    SlotFactory internal factory;
    MetadataModule internal metadata;
    LocalToken internal token;

    struct Actor {
        address addr;
        uint256 pk;
    }

    Actor[5] internal actors;

    function run() external {
        _seed();
    }

    /**
     * Mirrors Slot._minDepositFor — including its `ceilDiv`.
     *
     * Flooring here instead silently under-funds by one wei whenever the
     * division has a remainder, which passes for every generous multiple and
     * fails only for the exact-minimum slot: the one case this seed exists to
     * create.
     */
    function _minDeposit(
        uint256 price,
        uint256 taxBps,
        uint256 minDepositSeconds
    ) internal pure returns (uint256) {
        uint256 num = price * taxBps * minDepositSeconds;
        uint256 den = MONTH * BASIS_POINTS;
        return (num + den - 1) / den;
    }

    function _cfg(
        bool mutableTax,
        address manager
    ) internal pure returns (SlotConfig memory) {
        return
            SlotConfig({
                mutableTax: mutableTax,
                mutableUtility: false,
                mutablePolicy: false,
                manager: manager
            });
    }

    function _init(
        uint256 taxBps,
        address utility,
        uint256 minDepositSeconds
    ) internal pure returns (SlotInitParams memory) {
        return
            SlotInitParams({
                taxPercentage: taxBps,
                utility: utility,
                liquidationBountyBps: 500,
                minDepositSeconds: minDepositSeconds,
                occupancyPolicy: address(0)
            });
    }

    function _seed() internal broadcastOnOnly(DeployementChain.Anvil) {
        for (uint256 i = 0; i < 5; i++) {
            uint256 pk = vm.deriveKey(TEST_MNEMONIC, uint32(i));
            actors[i] = Actor({addr: vm.addr(pk), pk: pk});
        }
        address deployer = actors[0].addr;

        factory = SlotFactory(_readDeployment("SlotFactory"));
        metadata = MetadataModule(_readDeployment("MetadataModule"));
        console2.log("factory:", address(factory));

        // ── Test currency, funded to every actor ─────────────────────────────
        vm.startBroadcast(actors[0].pk);
        token = new LocalToken();
        for (uint256 i = 0; i < 5; i++) {
            token.mint(actors[i].addr, 1_000_000 ether);
        }
        vm.stopBroadcast();
        console2.log("LocalToken:", address(token));
        require(
            address(token) == EXPECTED_LOCAL_TOKEN,
            "LocalToken address drifted - update tokens.ts in packages/sdk"
        );

        IERC20 usdx = IERC20(address(token));
        IERC20 native = IERC20(address(0));

        // ── Slots ────────────────────────────────────────────────────────────
        vm.startBroadcast(actors[0].pk);
        address prime = factory.createSlot(
            deployer,
            usdx,
            _cfg(false, address(0)),
            _init(500, address(0), 7 days)
        );
        address managed = factory.createSlot(
            deployer,
            usdx,
            _cfg(true, deployer),
            _init(1000, address(0), 1 days)
        );
        address ethSlot = factory.createSlot(
            deployer,
            native,
            _cfg(false, address(0)),
            _init(250, address(0), 3 days)
        );
        address withMeta = factory.createSlot(
            deployer,
            usdx,
            _cfg(false, address(0)),
            _init(400, address(metadata), 2 days)
        );
        address vacant = factory.createSlot(
            deployer,
            usdx,
            _cfg(false, address(0)),
            _init(300, address(0), 1 days)
        );
        address thin = factory.createSlot(
            deployer,
            usdx,
            _cfg(false, address(0)),
            _init(2000, address(0), 1 hours)
        );
        vm.stopBroadcast();

        console2.log("slot prime:   ", prime);
        console2.log("slot managed: ", managed);
        console2.log("slot eth:     ", ethSlot);
        console2.log("slot withMeta:", withMeta);
        console2.log("slot vacant:  ", vacant, "(left unoccupied)");
        console2.log("slot thin:    ", thin, "(min deposit - liquidatable soon)");

        // ── Occupancy ────────────────────────────────────────────────────────
        _buyErc20(actors[1], prime, 100 ether, 500, 7 days, 3);
        _buyErc20(actors[2], managed, 250 ether, 1000, 1 days, 2);
        _buyErc20(actors[4], withMeta, 75 ether, 400, 2 days, 3);
        // Exactly the minimum: one warp past `minDepositSeconds` drains it.
        _buyErc20(actors[1], thin, 500 ether, 2000, 1 hours, 1);

        // Native: the value must equal deposit exactly on a vacant slot.
        {
            uint256 price = 0.5 ether;
            uint256 dep = _minDeposit(price, 250, 3 days) * 2;
            vm.startBroadcast(actors[3].pk);
            Slot(payable(ethSlot)).buy{value: dep}(actors[3].addr, dep, price);
            vm.stopBroadcast();
            console2.log("eth slot bought by", actors[3].addr);
        }

        // ── Metadata ─────────────────────────────────────────────────────────
        vm.startBroadcast(actors[4].pk);
        metadata.updateMetadata(
            withMeta,
            "ipfs://bafkreibsvdxwq5vaqfnrlhxsx7dgnnmavgnhtavqf3ykkbjuu4ykccwq7e"
        );
        vm.stopBroadcast();

        vm.startBroadcast(actors[1].pk);
        metadata.updateMetadata(
            prime,
            '{"name":"Prime billboard","description":"Local seed slot","type":"ad"}'
        );
        vm.stopBroadcast();

        _saveDeployment(address(token), "LocalToken");

        console2.log("=== seed complete ===");
    }

    /// Vacant slot: the buyer owes the deposit only, so approve exactly that.
    function _buyErc20(
        Actor memory actor,
        address slotAddr,
        uint256 price,
        uint256 taxBps,
        uint256 minDepositSeconds,
        uint256 multiple
    ) internal {
        uint256 dep = _minDeposit(price, taxBps, minDepositSeconds) * multiple;
        vm.startBroadcast(actor.pk);
        token.approve(slotAddr, type(uint256).max);
        Slot(payable(slotAddr)).buy(actor.addr, dep, price);
        vm.stopBroadcast();
        console2.log("bought", slotAddr);
        console2.log("   by", actor.addr);
    }
}
