// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC721Slots} from "./ERC721Slots.sol";
import {SlotConfig, SlotInitParams} from "./interfaces/ISlot.sol";

/// @title ERC721SlotsFactory — Deploy Harberger NFT collections via Beacon Proxy
/// @notice UUPS-upgradeable factory. All collections delegate to a shared beacon.
///         Upgrading the beacon upgrades all collections.
contract ERC721SlotsFactory is UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error NotAdmin();
    error AlreadyInitialized();
    error InvalidName();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event CollectionDeployed(
        address indexed collection,
        address indexed creator,
        address indexed currency,
        string name,
        string symbol,
        address slotFactory
    );

    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The UpgradeableBeacon that all collection proxies point to
    UpgradeableBeacon public beacon;

    /// @notice Factory admin
    address public admin;

    /// @notice The SlotFactory address that all collections use
    address public slotFactory;

    /// @notice Total collections deployed
    uint256 public collectionCount;

    bool private _initialized;

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _initialized = true;
    }

    /// @notice Initialize the factory (called once via proxy)
    function initialize(
        address _admin,
        address _erc721SlotsImplementation,
        address _slotFactory
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        admin = _admin;
        slotFactory = _slotFactory;
        beacon = new UpgradeableBeacon(_erc721SlotsImplementation, _admin);
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

    function transferAdmin(address newAdmin) external onlyAdmin {
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Deploy a new ERC721Slots collection as a BeaconProxy
    /// @param name_ Collection name
    /// @param symbol_ Collection symbol
    /// @param currency_ ERC20 currency for all slots
    /// @param config_ Shared slot config for all tokens
    /// @param initParams_ Shared slot init params for all tokens
    function createCollection(
        string calldata name_,
        string calldata symbol_,
        address currency_,
        SlotConfig memory config_,
        SlotInitParams memory initParams_
    ) external returns (address collection) {
        if (bytes(name_).length == 0) revert InvalidName();

        bytes memory initData = abi.encodeCall(
            ERC721Slots.initialize,
            (
                name_,
                symbol_,
                slotFactory,
                msg.sender,
                currency_,
                config_,
                initParams_
            )
        );
        BeaconProxy proxy = new BeaconProxy(address(beacon), initData);
        collection = address(proxy);
        collectionCount++;

        emit CollectionDeployed(
            collection,
            msg.sender,
            currency_,
            name_,
            symbol_,
            slotFactory
        );
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
