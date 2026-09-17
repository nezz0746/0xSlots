// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Versioned} from "./Versioned.sol";

/**
 * @title VersionedUUPS
 * @notice What every UUPS singleton in this protocol needs, in one place.
 *
 * @dev Three things were being repeated verbatim in every upgradeable
 *      contract — the initializer lock in the constructor, the
 *      `initializedVersion()` reader, and the `Initializable + UUPSUpgradeable
 *      + Versioned` inheritance list. Repeated, and unevenly: some contracts
 *      exposed `initializedVersion()` and some did not, and one rolled its own
 *      initializer guard instead of using OpenZeppelin's.
 *
 *      ── It deliberately adds no storage ──────────────────────────────────
 *
 *      Solidity allocates base storage BEFORE derived, so a new base in the
 *      chain of a live contract is a layout change waiting to happen. This one
 *      is safe only because it declares nothing: `Initializable` keeps its
 *      state in an ERC-7201 namespaced slot and `UUPSUpgradeable` holds an
 *      immutable, so neither takes a sequential slot. Anything added here later
 *      WOULD shift every inheriting contract's storage. Don't.
 *
 *      ── What it does not take on ─────────────────────────────────────────
 *
 *      `_authorizeUpgrade` stays abstract. There are three different authority
 *      models in this repo — an `admin` address, an `owner`, and OfferBook's
 *      own — and picking one here would force the others to fight it.
 *
 *      Beacon implementations (`Slot`, `SlotCollective`) inherit `Versioned`
 *      alone. They are not UUPS and must not gain an upgrade entry point of
 *      their own; upgrading them is the beacon's job.
 */
abstract contract VersionedUUPS is Initializable, UUPSUpgradeable, Versioned {
    /// @dev Locks the IMPLEMENTATION so it can never be initialized directly.
    ///      Only the proxy delegating into it ever runs `initialize`.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Which MIGRATION has run in this proxy's storage.
    ///
    /// @dev The counterpart to `version()`, which reports which CODE is behind
    ///      the proxy. Both are needed and they answer different questions —
    ///      see `Versioned`. A mismatch after an upgrade means a reinitializer
    ///      was expected and did not run.
    function initializedVersion() external view returns (uint64) {
        return _getInitializedVersion();
    }
}
