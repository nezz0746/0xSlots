// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {FactoryDeployer} from "./factory/FactoryDeployer.sol";
import {FactoryRegistry} from "./factory/FactoryRegistry.sol";
import {FactoryHub} from "./factory/FactoryHub.sol";

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
///
///      ── Reading this contract ─────────────────────────────────────────────
///
///      The behaviour is split across bases, each answering one question:
///
///        FactoryStorage    what the factory remembers, and in what order
///        FactoryRegistry   what it vouches for (modules, policies)
///        FactoryDeployer   how a slot is created and validated
///        FactoryHub        the shared event bus and batch helpers
///
///      What stays HERE is governance: who the admin is, and the two powers
///      that reach every deployment at once — upgrading the beacon (which
///      rewrites the implementation behind all 237+ live slots) and upgrading
///      the factory itself. They are kept together, in the smallest file,
///      because they are the ones worth re-reading before every release.
///
///      ── Why the inheritance order is not stylistic ───────────────────────
///
///      Solidity allocates base storage before the derived contract's own, in
///      linearization order. `FactoryStorage` must therefore be reached first,
///      which it is: every other base descends from it, and all of them are
///      storage-free. Adding an ordinary state variable to any base other than
///      `FactoryStorage` shifts this proxy's live state and is unrecoverable.
///      `forge inspect SlotFactory storage` is the gate.
contract SlotFactory is FactoryDeployer, FactoryRegistry, FactoryHub {
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
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /// @notice Transfer admin role
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
        emit AdminTransferred(admin, newAdmin);
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
}
