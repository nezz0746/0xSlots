// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
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

        // ── beacons ───────────────────────────────────────────────────────
        //
        // The implementation address reaches a beacon through `initialize`, and
        // `initialize` runs ONCE. So without this, bumping `Slot` deployed a new
        // implementation, updated the record to name it, and left the beacon
        // pointing at the old one — every existing slot AND every new slot still
        // running the previous code, while the deployment ledger claimed
        // otherwise. It is the largest blast radius in the protocol and it was
        // the one thing the upgrade path could not do.
        _beacon("Slot", factory, slotImpl);
        _beacon("SlotCollective", collectiveFactory, collectiveImpl);

        // ── hooks ─────────────────────────────────────────────────────────
        address adLandImpl = _deploy2(
            "AdLandImpl",
            new AdLand().version(),
            type(AdLand).creationCode
        );
        address adLand = _proxy(
            "AdLand",
            adLandImpl,
            abi.encodeCall(AdLand.initialize, (cfg.admin))
        );

        // Deployed here, once per chain, rather than per configuration. The
        // window a slot enforces is its own `hookData`, so one contract serves
        // every duration — which is what let the CREATE2 hook factory, its
        // predicted-address dance and its resolver UI all go away.
        //
        // Not a proxy. It holds no configuration to migrate and one mapping of
        // history, and a hook the whole protocol can be pointed at is a poor
        // thing to make upgradeable by a single key.
        address tenureHook = _deploy2(
            "MinimumTenureHook",
            TENURE_HOOK_VERSION,
            type(MinimumTenureHook).creationCode
        );

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
        record("AdLand", adLand, AdLand(adLand).version());
        record("MinimumTenureHook", tenureHook, TENURE_HOOK_VERSION);

        console2.log("");
        console2.log("SlotFactory          ", factory);
        console2.log("OfferBook            ", book);
        console2.log("SlotCollectiveFactory", collectiveFactory);
        console2.log("AdLand               ", adLand);
        console2.log("MinimumTenureHook    ", tenureHook);
    }

    /// @dev `MinimumTenureHook` has no `version()` of its own — it is not
    ///      upgradeable — so the salt's discriminator is stated here. Version 1
    ///      was the shape whose window was an immutable, and it is deliberately
    ///      NOT the same address: a slot still pointing at one of those has a
    ///      hook that ignores `hookData` entirely.
    uint64 internal constant TENURE_HOOK_VERSION = 2;

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

    /// @dev EIP-1967 implementation slot.
    bytes32 internal constant _IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * Point a factory's beacon at `impl`, if it is not there already.
     *
     * Both factories own their beacon and gate `upgradeBeacon` behind their
     * admin, so this is the admin's call to make — the same key that authorises
     * a UUPS upgrade.
     *
     * Read through the FACTORY rather than the beacon: `SlotFactory` exposes
     * `implementation()` and `SlotCollectiveFactory` exposes `beacon()`, and
     * going through the public surface means this cannot drift from what the
     * contracts actually do.
     */
    function _beacon(
        string memory name,
        address factory_,
        address impl
    ) internal {
        (bool ok, bytes memory data) = factory_.staticcall(
            abi.encodeWithSignature("implementation()")
        );
        if (!ok || data.length < 32) {
            (ok, data) = factory_.staticcall(abi.encodeWithSignature("beacon()"));
            require(ok && data.length >= 32, "no beacon on factory");
            address b = abi.decode(data, (address));
            (ok, data) = b.staticcall(abi.encodeWithSignature("implementation()"));
            require(ok && data.length >= 32, "beacon has no implementation()");
        }
        address current = abi.decode(data, (address));

        if (current == impl) {
            console2.log("current  ", name, impl);
            return;
        }
        (ok, ) = factory_.call(
            abi.encodeWithSignature("upgradeBeacon(address)", impl)
        );
        require(ok, "upgradeBeacon failed");
        console2.log("beacon   ", name, impl);
    }

    /**
     * @dev Bring a proxy to `impl`, deploying it the first time and UPGRADING it
     *      every time after.
     *
     *      This used to CREATE2 the proxy unconditionally, and it had a bug that
     *      the surrounding comment denied: a proxy's initcode embeds its
     *      implementation address, so the predicted address MOVED whenever the
     *      implementation's bytecode changed. `_deploy2Raw` skips only when code
     *      already exists at the predicted address — and a moved address has
     *      none. So a routine implementation change did not upgrade anything; it
     *      deployed a second protocol beside the first and left every slot the
     *      live factory had created pointing at the abandoned one.
     *
     *      The fix is to stop deriving the address at all after the first
     *      deployment. The record in `deployments/<chainid>/` is where the proxy
     *      lives; CREATE2 only decides where a proxy that does not exist yet
     *      goes. That also makes this the same operation CI runs: `upgrade`
     *      really upgrades.
     */
    function _proxy(
        string memory name,
        address impl,
        bytes memory initData
    ) internal returns (address at) {
        address rec = deployed(name);

        if (rec != address(0) && rec.code.length != 0) {
            address current = address(
                uint160(uint256(vm.load(rec, _IMPL_SLOT)))
            );
            if (current == impl) {
                console2.log("current  ", name, rec);
                return rec;
            }
            // No init data: the proxy's storage is already initialized. A
            // migration that genuinely needs one belongs in a `reinitializer`
            // called explicitly, not smuggled into every deploy run.
            UUPSUpgradeable(rec).upgradeToAndCall(impl, "");
            console2.log("upgraded ", name, rec);
            return rec;
        }

        if (rec != address(0)) {
            // A record naming an address with no code is a record from another
            // chain, or from a run that never landed. Continuing would deploy a
            // second proxy and overwrite the record with it, which is exactly
            // the failure this function now exists to prevent.
            console2.log("STALE RECORD", name, rec);
            revert("record names an address with no code");
        }

        bytes memory code = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(impl, initData)
        );
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
