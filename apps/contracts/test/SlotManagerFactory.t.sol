// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotManager} from "../src/SlotManager.sol";
import {SlotManagerFactory} from "../src/SlotManagerFactory.sol";

/// @dev Storage-compatible successor, used to prove a beacon upgrade actually
///      moves the code every existing manager runs.
contract SlotManagerV2 is SlotManager {
    constructor(address warehouse) SlotManager(warehouse) {}

    function version() external pure returns (string memory) {
        return "v2";
    }
}

contract SlotManagerFactoryTest is Test {
    SlotManagerFactory internal factory;
    SlotManager internal implementation;
    SplitsWarehouse internal warehouse;

    address internal factoryAdmin = makeAddr("factoryAdmin");
    address internal managerAdmin = makeAddr("managerAdmin");
    address internal stranger = makeAddr("stranger");
    address internal payeeA = makeAddr("payeeA");
    address internal payeeB = makeAddr("payeeB");

    function setUp() public {
        warehouse = new SplitsWarehouse("Ether", "ETH");
        implementation = new SlotManager(address(warehouse));

        SlotManagerFactory factoryImpl = new SlotManagerFactory();
        factory = SlotManagerFactory(
            address(
                new ERC1967Proxy(
                    address(factoryImpl),
                    abi.encodeCall(
                        SlotManagerFactory.initialize,
                        (factoryAdmin, address(implementation))
                    )
                )
            )
        );
    }

    // ── helpers ─────────────────────────────────────────────────

    function _split() internal view returns (SplitV2Lib.Split memory s) {
        address[] memory recipients = new address[](2);
        recipients[0] = payeeA;
        recipients[1] = payeeB;

        uint256[] memory allocations = new uint256[](2);
        allocations[0] = 60;
        allocations[1] = 40;

        s = SplitV2Lib.Split({
            recipients: recipients,
            allocations: allocations,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    function _roles(address admin_)
        internal
        pure
        returns (SlotManager.InitialRoles memory r)
    {
        r.admin = admin_;
    }

    function _create(address admin_) internal returns (SlotManager) {
        return SlotManager(payable(factory.createManager(_split(), _roles(admin_))));
    }

    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    function test_deploysAFullyConfiguredManager() public {
        SlotManager mgr = _create(managerAdmin);

        assertTrue(mgr.hasRole(mgr.DEFAULT_ADMIN_ROLE(), managerAdmin));
        assertEq(mgr.owner(), address(mgr), "owner must be self-bound");
        assertEq(
            address(mgr.SPLITS_WAREHOUSE()),
            address(warehouse),
            "warehouse immutable must resolve through the proxy"
        );
        assertTrue(factory.isSlotManager(address(mgr)));
    }

    /// @dev The immutables live in the implementation's bytecode, not storage.
    ///      This is the check that they are still read correctly under
    ///      delegatecall — if they were not, every manager would push tax at a
    ///      zero-address warehouse.
    function test_immutablesResolveThroughTheProxy() public {
        SlotManager mgr = _create(managerAdmin);
        assertEq(address(mgr.SPLITS_WAREHOUSE()), address(warehouse));
        assertEq(mgr.NATIVE_TOKEN(), implementation.NATIVE_TOKEN());
    }

    /// @dev Permissionless on purpose: a manager governs only slots that have
    ///      NAMED it, so minting one grants nothing by itself.
    function test_anyoneCanDeployAManager() public {
        vm.prank(stranger);
        SlotManager mgr = _create(managerAdmin);
        assertTrue(factory.isSlotManager(address(mgr)));
    }

    function test_registryTracksEveryManager() public {
        assertEq(factory.managerCount(), 0);

        SlotManager a = _create(managerAdmin);
        SlotManager b = _create(stranger);

        assertEq(factory.managerCount(), 2);
        assertEq(factory.managers(0), address(a));
        assertEq(factory.managers(1), address(b));
        assertFalse(factory.isSlotManager(makeAddr("notAManager")));
    }

    function test_managersAreIndependent() public {
        SlotManager a = _create(managerAdmin);
        SlotManager b = _create(stranger);

        assertTrue(a.hasRole(a.DEFAULT_ADMIN_ROLE(), managerAdmin));
        assertFalse(b.hasRole(b.DEFAULT_ADMIN_ROLE(), managerAdmin));
        assertTrue(b.hasRole(b.DEFAULT_ADMIN_ROLE(), stranger));
        assertTrue(address(a) != address(b));
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZER SEALING
    // ═══════════════════════════════════════════════════════════

    /// @dev A live, owned, role-granted implementation sitting behind a beacon
    ///      is a standing invitation. `_disableInitializers` in the constructor
    ///      is what closes it.
    function test_implementationCannotBeInitialized() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initializeManager(_split(), _roles(stranger));
    }

    function test_managerCannotBeReinitialized() public {
        SlotManager mgr = _create(managerAdmin);

        vm.expectRevert(Initializable.InvalidInitialization.selector);
        vm.prank(stranger);
        mgr.initializeManager(_split(), _roles(stranger));

        // And the original admin is untouched.
        assertTrue(mgr.hasRole(mgr.DEFAULT_ADMIN_ROLE(), managerAdmin));
        assertFalse(mgr.hasRole(mgr.DEFAULT_ADMIN_ROLE(), stranger));
    }

    // ═══════════════════════════════════════════════════════════
    // BEACON
    // ═══════════════════════════════════════════════════════════

    /// @dev Owned by the factory from `initialize`, unlike `SlotFactory` — whose
    ///      beacon started owned by an EOA and needed a one-shot mainnet script
    ///      to hand over before `upgradeBeacon` could work at all.
    function test_beaconIsFactoryOwnedFromTheStart() public view {
        assertEq(factory.beacon().owner(), address(factory));
    }

    function test_beaconUpgradeMovesEveryExistingManager() public {
        SlotManager a = _create(managerAdmin);
        SlotManager b = _create(stranger);

        SlotManagerV2 v2 = new SlotManagerV2(address(warehouse));
        vm.prank(factoryAdmin);
        factory.upgradeBeacon(address(v2));

        assertEq(SlotManagerV2(payable(address(a))).version(), "v2");
        assertEq(SlotManagerV2(payable(address(b))).version(), "v2");

        // State survives the code swap.
        assertTrue(a.hasRole(a.DEFAULT_ADMIN_ROLE(), managerAdmin));
        assertEq(a.owner(), address(a));
    }

    function test_beaconUpgradeIsAdminOnly() public {
        SlotManagerV2 v2 = new SlotManagerV2(address(warehouse));

        vm.expectRevert(SlotManagerFactory.NotAdmin.selector);
        vm.prank(stranger);
        factory.upgradeBeacon(address(v2));

        vm.expectRevert(SlotManagerFactory.NotAdmin.selector);
        vm.prank(managerAdmin);
        factory.upgradeBeacon(address(v2));
    }

    // ═══════════════════════════════════════════════════════════
    // FACTORY ADMIN
    // ═══════════════════════════════════════════════════════════

    function test_factoryCannotBeReinitialized() public {
        vm.expectRevert(SlotManagerFactory.AlreadyInitialized.selector);
        factory.initialize(stranger, address(implementation));
    }

    function test_rejectsZeroAdminAndCodelessImplementation() public {
        SlotManagerFactory impl = new SlotManagerFactory();

        vm.expectRevert(SlotManagerFactory.AdminRequired.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                SlotManagerFactory.initialize,
                (address(0), address(implementation))
            )
        );

        vm.expectRevert(SlotManagerFactory.ImplementationRequired.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                SlotManagerFactory.initialize,
                (factoryAdmin, makeAddr("noCode"))
            )
        );
    }

    function test_transferAdmin() public {
        vm.prank(factoryAdmin);
        factory.transferAdmin(stranger);
        assertEq(factory.admin(), stranger);

        vm.expectRevert(SlotManagerFactory.NotAdmin.selector);
        vm.prank(factoryAdmin);
        factory.transferAdmin(factoryAdmin);
    }

    function test_factoryUpgradeIsAdminOnly() public {
        SlotManagerFactory next = new SlotManagerFactory();

        vm.expectRevert(SlotManagerFactory.NotAdmin.selector);
        vm.prank(stranger);
        factory.upgradeToAndCall(address(next), "");

        vm.prank(factoryAdmin);
        factory.upgradeToAndCall(address(next), "");
        // Registry survives the factory upgrade.
        assertEq(factory.admin(), factoryAdmin);
    }

    // ═══════════════════════════════════════════════════════════
    // THE GAS CAP, THROUGH THE PROXY
    // ═══════════════════════════════════════════════════════════

    /// @dev The one thing proxying a SlotManager genuinely risked. Native tax
    ///      arrives via `Slot._payOrCredit`'s `call{gas: 30_000}`, and a
    ///      BeaconProxy adds a staticcall to the beacon plus a delegatecall
    ///      before `receive()` even runs. If that no longer fits, every native
    ///      push silently degrades into a `withdrawableOf` credit needing a
    ///      manual claim.
    function test_nativeTaxStillFitsThe30kCapThroughTheProxy() public {
        SlotManager mgr = _create(managerAdmin);
        vm.deal(address(this), 1 ether);

        (bool ok,) = address(mgr).call{value: 1 ether, gas: 30_000}("");

        assertTrue(ok, "native push must fit the slot's 30k cap");
        assertEq(address(mgr).balance, 1 ether);
    }

    receive() external payable {}
}
