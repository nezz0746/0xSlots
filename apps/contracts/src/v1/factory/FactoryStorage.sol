// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Slot} from "../Slot.sol";
import {SlotConfig, SlotInitParams, ISlotEvents, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
import {InvalidLiquidationBounty} from "../interfaces/SlotErrors.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy} from "../interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";

/**
 * @title FactoryStorage
 * @notice Every storage variable the factory has, in the only order they may
 *         appear, plus the errors, events and modifiers the rest share.
 *
 * @dev FIRST base of `SlotFactory`, and that position is load-bearing.
 *      Solidity allocates base storage before a derived contract's own, so
 *      holding all state here reproduces the layout the factory had when it
 *      declared these inline: `beacon` at slot 0 through `verifiedPolicies` at
 *      slot 4. The factory is a UUPS proxy with live state; moving any of them
 *      would corrupt it.
 *
 *      Every other base must therefore be storage-FREE. `UUPSUpgradeable` is
 *      safe to sit here because OZ v5 keeps its state in an ERC-7201 namespace
 *      rather than in sequential slots.
 *
 *      Note `verifiedPolicies`: it was appended later and originally sat
 *      halfway down the file, beside the functions that use it. It is grouped
 *      with the rest here — its slot is unchanged, which is the only thing the
 *      proxy cares about.
 *
 *      The gate for any change is `forge inspect SlotFactory storage` being
 *      byte-identical before and after.
 */
abstract contract FactoryStorage is UUPSUpgradeable {
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

    bool internal _initialized;

    /// @notice Tracks deployed slots for emitEvent authorization
    mapping(address => bool) public isSlot;


    /// @notice Verified occupancy policies (informational, non-blocking).
    mapping(address => bool) public verifiedPolicies;
    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

}
