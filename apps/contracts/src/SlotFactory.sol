// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "./Slot.sol";
import {SlotConfig, SlotInitParams, ISlotEvents} from "./interfaces/ISlot.sol";
import {IUtility} from "./interfaces/IUtility.sol";
import {IOccupancyPolicy} from "./interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "./interfaces/IModuleMetadata.sol";

/// @title SlotFactory — Deploy Harberger-taxed slots via Beacon Proxy
/// @notice UUPS-upgradeable factory. All slots delegate to a shared beacon.
///         Upgrading the beacon upgrades all slots.
///
/// @dev The creation surface is two functions — `createSlot` and `createSlots`
///      — and is meant to stay that way. A new slot parameter goes into
///      `SlotInitParams`, which both already carry, never into a new suffixed
///      entry point. A versioned creator is a permanent tax on every caller,
///      every published ABI and every integration, paid to avoid changing one
///      struct once.
contract SlotFactory is UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error InvalidConfig_ManagerRequired();
    error InvalidConfig_ManagerMustBeZero();
    error InvalidTaxPercentage();
    error InvalidCount();
    error NotAdmin();
    error AlreadyInitialized();
    error InvalidModule_NoCode();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event SlotDeployed(
        address indexed slot,
        address indexed recipient,
        address indexed currency,
        SlotConfig config,
        SlotInitParams initParams
    );

    event ModuleVerified(
        address indexed utility,
        bool verified,
        string name,
        string version,
        uint256 feeBps,
        string metadataURI
    );
    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event SlotEvent(address indexed slot, uint8 indexed eventType, bytes data);
    event BeaconUpgraded(address indexed newImplementation);

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The UpgradeableBeacon that all slot proxies point to
    UpgradeableBeacon public beacon;

    /// @notice Verified utilities registry (informational, non-blocking)
    mapping(address => bool) public verifiedUtilities;

    /// @notice Factory admin (can upgrade factory, upgrade beacon, verify utilities)
    address public admin;

    bool private _initialized;

    /// @notice Tracks deployed slots for emitEvent authorization
    mapping(address => bool) public isSlot;

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _initialized = true; // Disable init on implementation
    }

    /// @notice Initialize the factory (called once via proxy)
    /// @param _admin Admin address (owns beacon + can upgrade factory + verify utilities)
    /// @param _slotImplementation Address of the Slot implementation contract
    function initialize(address _admin, address _slotImplementation) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        admin = _admin;
        beacon = new UpgradeableBeacon(_slotImplementation, _admin);
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /// @notice Transfer admin role
    function transferAdmin(address newAdmin) external onlyAdmin {
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Deploy a new Slot as a BeaconProxy
    function createSlot(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) external returns (address slot) {
        _validateConfig(config, initParams);
        slot = _deploySlot(recipient, currency, config, initParams);
    }

    /// @notice Deploy multiple Slot BeaconProxies with the same params
    function createSlots(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams,
        uint256 count
    ) external returns (address[] memory slots) {
        if (count == 0) revert InvalidCount();
        _validateConfig(config, initParams);

        slots = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            slots[i] = _deploySlot(recipient, currency, config, initParams);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice Current Slot implementation address (from beacon)
    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    // ═══════════════════════════════════════════════════════════
    // MODULE REGISTRY (informational, non-blocking)
    // ═══════════════════════════════════════════════════════════

    /// @notice Mark a utility as verified/unverified (admin only)
    function setUtilityVerified(
        address _utility,
        bool verified
    ) public onlyAdmin {
        // NOTE: must be IUtility's id — the ISlotsModule alias interface is
        // empty, and ERC165 ids exclude inherited members, so its own id is
        // meaningless. IUtility's id equals the historical ISlotsModule id
        // (same selectors), which is what deployed utilities answer to.
        IUtility mod = IUtility(_utility);
        // Both ids, because an ERC165 id covers only an interface's OWN
        // selectors: `IUtility` inherits its name/version/metadataURI from
        // `IModuleMetadata`, so its own id no longer says anything about them.
        // Checking one alone would verify a utility that cannot describe
        // itself — and this event immediately reads all three.
        require(
            mod.supportsInterface(type(IUtility).interfaceId),
            "not IUtility"
        );
        require(
            mod.supportsInterface(type(IModuleMetadata).interfaceId),
            "not IModuleMetadata"
        );
        verifiedUtilities[_utility] = verified;
        emit ModuleVerified(
            _utility,
            verified,
            mod.name(),
            mod.version(),
            mod.feeBps(),
            mod.metadataURI()
        );
    }

    /// @notice Check if a utility is verified
    function isUtilityVerified(address _utility) external view returns (bool) {
        return verifiedUtilities[_utility];
    }

    // ── deprecated names ────────────────────────────────────────
    // Selectors deployed callers and old ABIs hold. Remove next major.

    /// @notice Deprecated name for `setUtilityVerified`.
    function setModuleVerified(address _utility, bool verified) external {
        setUtilityVerified(_utility, verified);
    }

    /// @notice Deprecated name for `isUtilityVerified`.
    function isModuleVerified(address _utility) external view returns (bool) {
        return verifiedUtilities[_utility];
    }

    /// @notice Deprecated name for `verifiedUtilities`.
    function verifiedModules(address _utility) external view returns (bool) {
        return verifiedUtilities[_utility];
    }

    // ═══════════════════════════════════════════════════════════
    // OCCUPANCY POLICY REGISTRY (informational, non-blocking)
    // ═══════════════════════════════════════════════════════════

    /// @notice Verified occupancy policies (informational, non-blocking)
    mapping(address => bool) public verifiedPolicies;

    event PolicyVerified(
        address indexed policy,
        bool verified,
        string name,
        string version,
        string metadataURI
    );

    /// @notice Mark an occupancy policy verified/unverified (admin only)
    function setPolicyVerified(address _policy, bool verified) external onlyAdmin {
        IOccupancyPolicy p = IOccupancyPolicy(_policy);
        // See `setUtilityVerified` — same two-id reasoning.
        require(
            p.supportsInterface(type(IOccupancyPolicy).interfaceId),
            "not IOccupancyPolicy"
        );
        require(
            p.supportsInterface(type(IModuleMetadata).interfaceId),
            "not IModuleMetadata"
        );
        verifiedPolicies[_policy] = verified;
        emit PolicyVerified(_policy, verified, p.name(), p.version(), p.metadataURI());
    }

    // ═══════════════════════════════════════════════════════════
    // BATCH OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Collect tax from multiple slots in a single transaction
    /// @param slots Array of slot addresses to collect from
    /// @return collected Amount collected from each slot (0 if skipped or nothing to collect)
    function collectAll(
        address[] calldata slots
    ) external returns (uint256[] memory collected) {
        collected = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            if (!isSlot[slots[i]]) continue;
            Slot s = Slot(slots[i]);
            uint256 tax = s.collectedTax() + s.taxOwed();
            if (tax == 0) continue;
            try s.collect() {
                collected[i] = tax;
            } catch {}
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PROTOCOL EVENT HUB
    // ═══════════════════════════════════════════════════════════

    /// @notice Emit a protocol-wide event (called by slots)
    function emitEvent(uint8 eventType, bytes calldata data) external {
        require(isSlot[msg.sender], "not a slot");
        emit SlotEvent(msg.sender, eventType, data);
    }

    /// @notice Register pre-existing slots deployed before this upgrade (admin only)
    function registerSlots(address[] calldata slots) external onlyAdmin {
        for (uint256 i = 0; i < slots.length; i++) {
            isSlot[slots[i]] = true;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // BEACON UPGRADES
    // ═══════════════════════════════════════════════════════════

    /// @notice Upgrade the beacon (admin only). Requires the factory to own it.
    /// @dev Beacon ownership starts with `admin` (see `initialize`). Transfer it
    ///      to this factory with `UpgradeableBeacon.transferOwnership` to enable
    ///      this. Authority is unchanged either
    ///      way — `onlyAdmin` here is the same address that owned the beacon.
    function upgradeBeacon(address newImplementation) external onlyAdmin {
        beacon.upgradeTo(newImplementation);
        emit BeaconUpgraded(newImplementation);
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _validateConfig(
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) internal view {
        if (config.mutableTax || config.mutableUtility || config.mutablePolicy) {
            if (config.manager == address(0))
                revert InvalidConfig_ManagerRequired();
        } else {
            if (config.manager != address(0))
                revert InvalidConfig_ManagerMustBeZero();
        }
        if (initParams.taxPercentage == 0) revert InvalidTaxPercentage();

        // Reject non-contract utility addresses (e.g. EOA, wrong-chain address).
        // Without this check, getSlotInfo() will revert on the resulting slot.
        if (initParams.utility != address(0) && initParams.utility.code.length == 0)
            revert InvalidModule_NoCode();
    }

    function _deploySlot(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams
    ) internal returns (address slot) {
        // `factory` is set inside `initialize` now, in the proxy constructor —
        // atomically with creation, so a new slot is never briefly claimable.
        bytes memory initData = abi.encodeCall(
            Slot.initialize,
            (recipient, currency, config, initParams, address(this))
        );
        BeaconProxy proxy = new BeaconProxy(address(beacon), initData);
        slot = address(proxy);
        isSlot[slot] = true;
        emit SlotDeployed(
            slot,
            recipient,
            address(currency),
            config,
            initParams
        );
    }
}
