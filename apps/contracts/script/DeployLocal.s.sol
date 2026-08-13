// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {LocalBootstrap} from "./LocalBootstrap.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {SlotCollective} from "../src/SlotCollective.sol";
import {SlotCollectiveFactory} from "../src/SlotCollectiveFactory.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";

/**
 * @title DeployLocal
 * @notice Deploys the protocol to anvil at addresses that survive contract edits.
 *
 * Usage (anvil must already be running on :8545):
 *   forge script script/DeployLocal.s.sol:DeployLocal --broadcast
 *
 * ── The pinning ──────────────────────────────────────────────────────────────
 *
 * Both user-facing addresses — the SlotFactory proxy and the MetadataModule
 * proxy — are CREATE2'd against LocalBootstrap and then upgraded to the real
 * implementations. See LocalBootstrap.sol for why that is what actually pins an
 * address (CREATE2 on its own does the opposite of what you'd want here).
 *
 * Implementation addresses are plain CREATE and are free to move; nothing
 * references them directly.
 *
 * Anvil predeploys the CREATE2 deterministic deployer at
 * 0x4e59b44847b379578588920cA78FbF26c0B4956C, and forge routes `new X{salt:}`
 * through it during broadcast — so the deployer in the address derivation is
 * that contract, not the EOA. The pinned addresses are therefore independent of
 * which anvil account runs the script.
 *
 * ── If the assertions fail ───────────────────────────────────────────────────
 *
 * Something that feeds the proxy initcode changed: LocalBootstrap's bytecode,
 * the OZ ERC1967Proxy version, or the solc/optimizer/via-ir settings in
 * foundry.toml. Re-run, read the logged addresses, and update the constants
 * below — deliberately, so the churn is visible in a diff.
 *
 * Nothing depends on the pin for correctness: ponder and landing read
 * deployments/31337/*.json, which this script writes. The pin exists so browser
 * state, bookmarks and wallet history survive a redeploy.
 */
contract DeployLocal is BaseScript {
    bytes32 internal constant BOOTSTRAP_SALT = keccak256("0xslots.local.bootstrap.v1");
    bytes32 internal constant FACTORY_SALT = keccak256("0xslots.local.factory.v1");
    bytes32 internal constant METADATA_SALT = keccak256("0xslots.local.metadata.v1");
    bytes32 internal constant COLLECTIVE_FACTORY_SALT =
        keccak256("0xslots.local.collectivefactory.v1");

    /// Expected pinned addresses. Zero disables the check (first run).
    address internal constant EXPECTED_FACTORY =
        0x78F614D6e3489a90BD2584D2ab1D90F5C35722F6;
    address internal constant EXPECTED_METADATA =
        0x6b2FB65de140764b208007b1591Cc6F7BaAad129;
    /// Zero until the first run logs it — see the docblock on drift.
    address internal constant EXPECTED_COLLECTIVE_FACTORY =
        0x60E7C43423f7aCD6a70d5a1eFd688558a391Bb6d;

    function run() external {
        _deploy();
    }

    function _deploy() internal broadcastOn(DeployementChain.Anvil) {
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("=== 0xSlots local deploy ===");
        console2.log("deployer:", deployer);

        // 1. CREATE2 seed. Same address every run, forever.
        LocalBootstrap bootstrap = new LocalBootstrap{salt: BOOTSTRAP_SALT}();
        console2.log("LocalBootstrap:", address(bootstrap));

        // 2. Proxies at their pinned addresses, pointing at the seed.
        bytes memory seedInit = abi.encodeCall(LocalBootstrap.bootstrapNoop, ());
        ERC1967Proxy factoryProxy = new ERC1967Proxy{salt: FACTORY_SALT}(
            address(bootstrap),
            seedInit
        );
        ERC1967Proxy metadataProxy = new ERC1967Proxy{salt: METADATA_SALT}(
            address(bootstrap),
            seedInit
        );

        // 3. Real implementations (plain CREATE — free to move).
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        MetadataModule metadataImpl = new MetadataModule();
        console2.log("Slot impl:", address(slotImpl));
        console2.log("SlotFactory impl:", address(factoryImpl));
        console2.log("MetadataModule impl:", address(metadataImpl));

        // 4. Upgrade each proxy off the seed and initialize in the same call.
        LocalBootstrap(address(factoryProxy)).upgradeToAndCall(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (deployer, address(slotImpl)))
        );
        LocalBootstrap(address(metadataProxy)).upgradeToAndCall(
            address(metadataImpl),
            abi.encodeCall(MetadataModule.initialize, (deployer))
        );

        SlotFactory factory = SlotFactory(address(factoryProxy));
        console2.log("SlotFactory proxy:", address(factoryProxy));
        console2.log("MetadataModule proxy:", address(metadataProxy));
        console2.log("beacon:", address(factory.beacon()));
        console2.log("admin:", factory.admin());

        // 5. Verify the metadata module so slots may use it.
        factory.setModuleVerified(address(metadataProxy), true);

        // 6. Fail loudly if the pin drifted.
        if (EXPECTED_FACTORY != address(0)) {
            require(
                address(factoryProxy) == EXPECTED_FACTORY,
                "factory address drifted - see DeployLocal docblock"
            );
            require(
                address(metadataProxy) == EXPECTED_METADATA,
                "metadata address drifted - see DeployLocal docblock"
            );
        }

        // 7. Collectives.
        //
        // A collective is a 0xSplits PushSplit wearing a role-gated control
        // panel, so it needs a SplitsWarehouse. Mainnet and Base have a
        // canonical one; anvil has nothing, so deploy a local instance. It is
        // only reached by `distribute()` — creating a collective never touches
        // it — but the address is an immutable baked into the implementation's
        // runtime bytecode, so it has to exist before the implementation does.
        SplitsWarehouse warehouse = new SplitsWarehouse("Ether", "ETH");
        SlotCollective collectiveImpl = new SlotCollective(address(warehouse));
        ERC1967Proxy collectiveFactoryProxy = new ERC1967Proxy{
            salt: COLLECTIVE_FACTORY_SALT
        }(address(bootstrap), seedInit);

        SlotCollectiveFactory collectiveFactoryImpl = new SlotCollectiveFactory();
        LocalBootstrap(address(collectiveFactoryProxy)).upgradeToAndCall(
            address(collectiveFactoryImpl),
            abi.encodeCall(
                SlotCollectiveFactory.initialize,
                (deployer, address(collectiveImpl))
            )
        );

        console2.log("SplitsWarehouse:", address(warehouse));
        console2.log("SlotCollective impl:", address(collectiveImpl));
        console2.log("SlotCollectiveFactory proxy:", address(collectiveFactoryProxy));

        if (EXPECTED_COLLECTIVE_FACTORY != address(0)) {
            require(
                address(collectiveFactoryProxy) == EXPECTED_COLLECTIVE_FACTORY,
                "collective factory address drifted - see DeployLocal docblock"
            );
        }

        _saveDeployment(address(factoryProxy), "SlotFactory");
        _saveDeployment(address(metadataProxy), "MetadataModule");
        _saveDeployment(address(slotImpl), "SlotImplementation");
        _saveDeployment(address(collectiveFactoryProxy), "SlotCollectiveFactory");
        _saveDeployment(address(warehouse), "SplitsWarehouse");

        console2.log("=== done ===");
    }
}
