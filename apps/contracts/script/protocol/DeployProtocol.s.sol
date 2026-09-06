// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {SlotBoundNFTFactory} from "../../src/hooks/nft/SlotBoundNFTFactory.sol";
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

        // One memory pointer instead of six stack slots — `run()` is already
        // at the edge of the stack limit.
        Versions memory v = _versions();

        vm.startBroadcast();

        // ── implementations ───────────────────────────────────────────────
        address slotImpl = _deploy2(
            "Slot",
            v.slot,
            type(Slot).creationCode
        );
        address factoryImpl = _deploy2(
            "SlotFactoryImpl",
            v.factory,
            type(SlotFactory).creationCode
        );
        address bookImpl = _deploy2(
            "OfferBook",
            v.book,
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
            saltFor("SlotCollective", v.collective),
            abi.encodePacked(
                type(SlotCollective).creationCode,
                abi.encode(warehouse)
            )
        );
        address collectiveFactoryImpl = _deploy2(
            "SlotCollectiveFactoryImpl",
            v.collectiveFactory,
            type(SlotCollectiveFactory).creationCode
        );
        address nftFactoryImpl = _deploy2(
            "SlotBoundNFTFactoryImpl",
            v.nftFactory,
            type(SlotBoundNFTFactory).creationCode
        );

        // ── proxies ───────────────────────────────────────────────────────
        address factory = _proxy(
            "SlotFactory",
            factoryImpl,
            abi.encodeCall(SlotFactory.initialize, (cfg.admin, slotImpl))
        );
        // Not a proxy. The book is an operator on every slot whose occupant
        // has approved it, and an operator may reprice — so an upgradeable book
        // would mean every one of them had granted that power to whatever its
        // admin deployed next. Immutable, the code they approved is the code
        // that runs.
        address book = bookImpl;
        address collectiveFactory = _proxy(
            "SlotCollectiveFactory",
            collectiveFactoryImpl,
            abi.encodeCall(
                SlotCollectiveFactory.initialize,
                (cfg.admin, collectiveImpl)
            )
        );

        // Deployed AFTER the slot factory, which it takes as an initializer
        // argument: a collection creates its slots through it, and the address
        // is fixed for this proxy's life.
        //
        // Upgradeable, unlike the collections it deploys. An upgrade here
        // changes what the NEXT collection is; an existing one is a plain
        // contract with no key over it, so nobody can rewrite what `ownerOf`
        // means for tokens people already hold.
        address nftFactory = _proxy(
            "SlotBoundNFTFactory",
            nftFactoryImpl,
            abi.encodeCall(
                SlotBoundNFTFactory.initialize,
                (cfg.admin, SlotFactory(factory))
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
            v.adLand,
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
        record("SlotCollective", collectiveImpl, v.collective);
        record(
            "SlotCollectiveFactory",
            collectiveFactory,
            SlotCollectiveFactory(collectiveFactory).version()
        );
        record("AdLand", adLand, AdLand(adLand).version());
        record("MinimumTenureHook", tenureHook, TENURE_HOOK_VERSION);
        record(
            "SlotBoundNFTFactory",
            nftFactory,
            SlotBoundNFTFactory(nftFactory).version()
        );

        console2.log("");
        console2.log("SlotFactory          ", factory);
        console2.log("OfferBook            ", book);
        console2.log("SlotCollectiveFactory", collectiveFactory);
        console2.log("AdLand               ", adLand);
        console2.log("MinimumTenureHook    ", tenureHook);
        console2.log("SlotBoundNFTFactory  ", nftFactory);
    }

    struct Versions {
        uint64 slot;
        uint64 factory;
        uint64 book;
        uint64 collective;
        uint64 collectiveFactory;
        uint64 adLand;
        uint64 nftFactory;
    }

    /**
     * @dev Every implementation's `version()`, read BEFORE the broadcast.
     *
     *      `version()` is `pure` and its answer is a compile-time constant, but
     *      reading it needs an instance — and a `new X()` INSIDE
     *      `vm.startBroadcast()` is a real deployment: broadcast, paid for, and
     *      abandoned the moment it has answered. Six of them were 12.6M of this
     *      script's 28.7M gas — 44% — plus six orphan contracts on every chain,
     *      every run. Called from outside the broadcast the identical `new` runs
     *      in the simulation only and costs nothing.
     *
     *      `UpgradeProtocol` always read them this way. This script did not, and
     *      nothing in either said which was which.
     *
     *      `SlotCollective` needs a warehouse with CODE — `PushSplit`'s
     *      constructor calls `NATIVE_TOKEN()` on it — so the probe borrows the
     *      configured one, or stands up a throwaway when there is none. Both
     *      happen outside the broadcast, so both are free; on a real chain the
     *      configured warehouse already exists and nothing extra is built.
     */
    function _versions() internal returns (Versions memory v) {
        v.slot = new Slot().version();
        v.factory = new SlotFactory().version();
        v.book = new OfferBook().version();
        address probeWarehouse = chainConfig().splitsWarehouse;
        if (probeWarehouse.code.length == 0) {
            probeWarehouse = address(new SplitsWarehouse("Ether", "ETH"));
        }
        v.collective = new SlotCollective(probeWarehouse).version();
        v.collectiveFactory = new SlotCollectiveFactory().version();
        v.adLand = new AdLand().version();
        v.nftFactory = new SlotBoundNFTFactory().version();
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
