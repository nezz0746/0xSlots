// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotCollective} from "./SlotCollective.sol";

/// @title SlotCollectiveFactory — deploys SlotCollectives behind one upgradeable beacon
///
/// @notice A `SlotCollective` is a 0xSplits PushSplit wearing a role-gated control
///         panel: it receives a slot's tax AND governs that slot's tax, utility
///         and occupancy policy. Deploying one by hand means getting a warehouse
///         address, a validated split, four role arrays and a self-bound owner
///         right in a single constructor call, on every chain, every time.
///
///         This mints them instead, from one implementation, with the same
///         upgrade path `SlotFactory` gives slots.
///
/// @dev ── SHAPE, AND WHY IT MATCHES SlotFactory ───────────────────────────────
///      UUPS proxy for the factory, `UpgradeableBeacon` for the managers. The
///      protocol already has exactly this arrangement one layer down, and a
///      second pattern for the same job would mean two upgrade runbooks and two
///      sets of assumptions about who can move what.
///
///      ── WHAT A BEACON MEANS HERE, WHICH IS NOT WHAT IT MEANS FOR SLOTS ─────
///      Read this before shipping it. A slot holds a deposit; a manager holds
///      *revenue* and is the named `recipient` of every slot pointed at it. One
///      `upgradeBeacon` call rewrites the code of every manager at once — so
///      whoever holds `admin` here can, in one transaction, change how every
///      manager on the chain distributes money that is not theirs.
///
///      That is the same authority the slot beacon already carries, which is why
///      this is a considered trade rather than an oversight. But slots and
///      managers are not equally attractive targets, and if these are ever
///      handed to third parties the honest answer may be immutable clones
///      (EIP-1167) with no beacon at all. `createManager` would be unchanged;
///      only `_deployManager` and the beacon plumbing would go.
///
///      ── WHY MANAGERS ARE PROXIES AT ALL ───────────────────────────────────
///      `SplitWalletV2` keeps `SPLITS_WAREHOUSE`, `NATIVE_TOKEN` and `FACTORY`
///      in `immutable`s, which live in the implementation's runtime bytecode and
///      are therefore read correctly through a delegatecall. The first two are
///      chain-wide constants and want to be shared. The third would have been a
///      problem — it gates the inherited `initialize` on `msg.sender == FACTORY`
///      — except `SlotCollective.initializeManager` does that work itself and never
///      touches it. See the constructor note over there.
contract SlotCollectiveFactory is UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error AlreadyInitialized();
    error NotAdmin();
    error AdminRequired();
    error ImplementationRequired();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @dev `admin` is the manager's own `DEFAULT_ADMIN_ROLE` holder, which is
    ///      NOT this factory's admin. Indexed because "which managers can this
    ///      address govern" is the question a UI actually asks, and it cannot be
    ///      answered from the split or from role events alone.
    event SlotCollectiveDeployed(
        address indexed manager,
        address indexed admin,
        address indexed deployer
    );
    event BeaconUpgraded(address indexed newImplementation);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The beacon every manager proxy points at.
    UpgradeableBeacon public beacon;

    /// @notice Can upgrade this factory and the beacon.
    address public admin;

    bool private _initialized;

    /// @notice Managers deployed here. The provenance check a slot creator needs
    ///         before naming an address as both `recipient` and `manager`.
    mapping(address => bool) public isSlotCollective;

    /// @notice Deployed managers, in order, so a UI can enumerate without logs.
    address[] public managers;

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _initialized = true; // Disable init on the implementation
    }

    /// @notice Initialize the factory (called once, through its proxy).
    /// @param _admin Upgrades this factory and the beacon.
    /// @param _managerImplementation A deployed `SlotCollective`, constructed with
    ///        this chain's canonical `SplitsWarehouse`.
    function initialize(address _admin, address _managerImplementation) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        if (_admin == address(0)) revert AdminRequired();
        if (_managerImplementation.code.length == 0)
            revert ImplementationRequired();

        admin = _admin;
        // Owned by this factory from the start, unlike `SlotFactory` — whose
        // beacon was created owned by the admin EOA and later had to be
        // transferred, which is why mainnet needed its own one-shot upgrade
        // script. Starting here costs nothing and skips that.
        beacon = new UpgradeableBeacon(_managerImplementation, address(this));
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Deploy a manager.
    ///
    /// @dev Permissionless. A manager is only powerful over slots that have
    ///      NAMED it — `Slot.manager` is set at creation and never moves — so
    ///      minting one grants nothing by itself. Gating this would only stop
    ///      people from creating their own payout contracts.
    ///
    ///      The split and roles are validated inside `initializeManager`, in the
    ///      proxy's constructor, so a manager is never briefly live with an
    ///      empty split or no admin.
    ///
    /// @param split Initial payout configuration. Must have recipients and a
    ///        non-zero total allocation.
    /// @param roles Initial role assignment. `roles.admin` is required.
    /// @return manager The deployed manager's address.
    function createManager(
        SplitV2Lib.Split calldata split,
        SlotCollective.InitialRoles calldata roles
    ) external returns (address manager) {
        manager = _deployManager(split, roles);
    }

    /// @notice How many managers this factory has deployed.
    function managerCount() external view returns (uint256) {
        return managers.length;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /// @notice Point every manager at new code.
    /// @dev Read the beacon note at the top of this contract before using it.
    function upgradeBeacon(address newImplementation) external onlyAdmin {
        beacon.upgradeTo(newImplementation);
        emit BeaconUpgraded(newImplementation);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert AdminRequired();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _deployManager(
        SplitV2Lib.Split calldata split,
        SlotCollective.InitialRoles calldata roles
    ) internal returns (address manager) {
        bytes memory initData = abi.encodeCall(
            SlotCollective.initializeManager,
            (split, roles)
        );
        manager = address(new BeaconProxy(address(beacon), initData));

        isSlotCollective[manager] = true;
        managers.push(manager);

        emit SlotCollectiveDeployed(manager, roles.admin, msg.sender);
    }
}
