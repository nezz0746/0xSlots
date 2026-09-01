// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {SlotTaker} from "../../src/periphery/SlotTaker.sol";
import {SlotCollective} from "../../src/collectives/SlotCollective.sol";
import {SlotCollectiveFactory} from "../../src/collectives/SlotCollectiveFactory.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";

/**
 * @title DeployProtocol
 * @notice The whole protocol, at the same addresses on every chain.
 *
 *   forge script script/protocol/DeployProtocol.s.sol:DeployProtocol \
 *     --rpc-url $RPC --broadcast --private-key $PK
 *
 * @dev ── Why CREATE2 everywhere ─────────────────────────────────────────
 *
 *      Plain CREATE derives an address from the deployer's nonce, so the same
 *      code lands somewhere different on every chain — and every consumer
 *      needs a per-chain address map that has to be right. CREATE2 through the
 *      canonical factory derives it from (factory, salt, initcode) instead,
 *      none of which is chain-specific. Deploy to a new chain and the SDK
 *      needs no new constant.
 *
 *      The salt carries the VERSION, so a new implementation is a new address
 *      rather than a collision with the old one. That also means this script
 *      is idempotent: run it twice and the second run finds code already
 *      there and skips, because the address is a pure function of what is
 *      being deployed.
 *
 *      ── The one thing that must match across chains ─────────────────────
 *
 *      A proxy's initcode contains its initializer calldata, which contains
 *      the admin. Same admin everywhere or the proxies diverge. The config
 *      README says so, and a zero admin is refused before anything is sent.
 */
contract DeployProtocol is ProtocolConfig {
    error SplitsWarehouseNotConfigured(uint256 chainId);

    function run() external {
        ChainConfig memory cfg = chainConfig();
        console2.log("chain    ", cfg.name);
        console2.log("admin    ", cfg.admin);

        vm.startBroadcast();

        // ── implementations ───────────────────────────────────────────────
        address slotImpl = _deploy2(
            "Slot",
            new Slot().version(),
            type(Slot).creationCode
        );
        address factoryImpl = _deploy2(
            "SlotFactoryImpl",
            new SlotFactory().version(),
            type(SlotFactory).creationCode
        );
        address bookImpl = _deploy2(
            "OfferBookImpl",
            new OfferBook().version(),
            type(OfferBook).creationCode
        );
        // The collectives sit on 0xSplits, which is an external dependency
        // and therefore per-chain configuration rather than something this
        // script knows. On a local chain there is none, so one is deployed.
        address warehouse = cfg.splitsWarehouse;
        if (warehouse == address(0)) {
            if (!cfg.testnet) revert SplitsWarehouseNotConfigured(block.chainid);
            // CREATE2 even here. A plain `new` would make the warehouse's
            // address depend on the deployer's nonce, and the collective
            // implementation takes it as a constructor argument — so the whole
            // chain downstream of it would move when a different key ran the
            // script. Verified by deploying from two different accounts.
            warehouse = _deploy2Raw(
                "SplitsWarehouse",
                saltFor("SplitsWarehouse", 1),
                abi.encodePacked(
                    type(SplitsWarehouse).creationCode,
                    abi.encode("Ether", "ETH")
                )
            );
        }

        // Also CREATE2, for the same reason: this address ends up inside the
        // collective factory's initializer calldata, and therefore inside its
        // proxy's initcode.
        //
        // Note this one is only identical ACROSS chains where the warehouse
        // is: it is a constructor argument, so it is part of the initcode.
        // 0xSplits is at one address on Base and Base Sepolia, so it holds
        // there; on a local chain it will not, which is fine.
        address collectiveImpl = _deploy2Raw(
            "SlotCollective",
            saltFor("SlotCollective", new SlotCollective(warehouse).version()),
            abi.encodePacked(
                type(SlotCollective).creationCode,
                abi.encode(warehouse)
            )
        );
        address collectiveFactoryImpl = _deploy2(
            "SlotCollectiveFactoryImpl",
            new SlotCollectiveFactory().version(),
            type(SlotCollectiveFactory).creationCode
        );

        // ── proxies ───────────────────────────────────────────────────────
        address factory = _proxy(
            "SlotFactory",
            factoryImpl,
            abi.encodeCall(SlotFactory.initialize, (cfg.admin, slotImpl))
        );
        address book = _proxy(
            "OfferBook",
            bookImpl,
            abi.encodeCall(OfferBook.initialize, (cfg.admin))
        );
        address collectiveFactory = _proxy(
            "SlotCollectiveFactory",
            collectiveFactoryImpl,
            abi.encodeCall(
                SlotCollectiveFactory.initialize,
                (cfg.admin, collectiveImpl)
            )
        );

        // ── stateless periphery ───────────────────────────────────────────
        address taker = _deploy2("SlotTaker", 1, type(SlotTaker).creationCode);

        vm.stopBroadcast();

        record("Slot", slotImpl, Slot(payable(slotImpl)).version());
        record("SlotFactory", factory, SlotFactory(factory).version());
        record("OfferBook", book, OfferBook(book).version());
        record("SlotCollective", collectiveImpl, 1);
        record(
            "SlotCollectiveFactory",
            collectiveFactory,
            SlotCollectiveFactory(collectiveFactory).version()
        );
        record("SlotTaker", taker, 1);

        console2.log("");
        console2.log("SlotFactory          ", factory);
        console2.log("OfferBook            ", book);
        console2.log("SlotCollectiveFactory", collectiveFactory);
        console2.log("SlotTaker            ", taker);
    }

    /// @dev Deploy at a deterministic address, or return what is already there.
    function _deploy2(
        string memory name,
        uint64 v,
        bytes memory creationCode
    ) internal returns (address at) {
        bytes32 salt = saltFor(name, v);
        at = predict(salt, creationCode);
        if (at.code.length != 0) {
            console2.log("exists   ", name, at);
            return at;
        }
        assembly {
            at := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(at != address(0), "create2 failed");
        console2.log("deployed ", name, at);
    }

    function _proxy(
        string memory name,
        address impl,
        bytes memory initData
    ) internal returns (address at) {
        bytes memory code = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(impl, initData)
        );
        // The proxy's salt carries no version: the PROXY is the stable address
        // users hold, and it must not move when the implementation behind it
        // does. Versioning lives on the implementation's salt.
        return _deploy2Raw(name, saltFor(name, 0), code);
    }

    function _deploy2Raw(
        string memory name,
        bytes32 salt,
        bytes memory code
    ) internal returns (address at) {
        at = predict(salt, code);
        if (at.code.length != 0) {
            console2.log("exists   ", name, at);
            return at;
        }
        assembly {
            at := create2(0, add(code, 0x20), mload(code), salt)
        }
        require(at != address(0), "create2 failed");
        console2.log("deployed ", name, at);
    }

}
