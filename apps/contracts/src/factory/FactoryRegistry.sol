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
import {FactoryStorage} from "./FactoryStorage.sol";

/**
 * @title FactoryRegistry
 * @notice What the factory vouches for.
 *
 * @dev Verification of utility modules and occupancy policies. Both registries
 *      are advisory by design — nothing in `createSlot` consults them — with
 *      one exception: `Slot.addModule` refuses anything not verified here, so
 *      this is the only gate on what a live slot may install.
 *
 *      Includes the deprecated `setModuleVerified` / `isModuleVerified` /
 *      `verifiedModules` aliases. They forward and stay: published ABIs hold
 *      those selectors.
 */
abstract contract FactoryRegistry is FactoryStorage {
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

        // The advertised fee is read under a stipend and defaults to zero if
        // the module misbehaves. Read unguarded, a module whose `feeBps()`
        // burns gas made itself impossible to even verify — or to un-verify,
        // which is worse, since revocation is the admin's only lever.
        uint256 advertisedFee = 0;
        (bool feeOk, bytes memory feeData) = _utility.staticcall{gas: 100_000}(
            abi.encodeWithSignature("feeBps()")
        );
        if (feeOk && feeData.length >= 32) {
            advertisedFee = abi.decode(feeData, (uint256));
        }

        emit ModuleVerified(
            _utility,
            verified,
            mod.name(),
            mod.version(),
            advertisedFee,
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

}
