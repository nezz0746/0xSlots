// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Slot, SlotInit} from "./Slot.sol";
import "./SlotErrors.sol";

/**
 * @title SlotFactory
 * @notice Deploys slots behind a shared beacon, and is the protocol's event hub.
 *
 * @dev ── One creation function ────────────────────────────────────────────
 *
 *      A new slot parameter goes into `SlotInit`, never into a suffixed second
 *      creator. A versioned entry point is a permanent tax on every caller,
 *      every published ABI and every integration, paid to avoid changing one
 *      struct once — and it also splits the indexer, which then has to register
 *      every handler twice to cover both eras.
 */
contract SlotFactory is Initializable, UUPSUpgradeable {
    /// @notice The beacon every slot delegates to. Upgrading it upgrades all.
    UpgradeableBeacon public beacon;

    /// @notice May upgrade the beacon, upgrade this factory, and attest hooks.
    address public admin;

    /// @notice Slots this factory created. The event hub's guest list.
    mapping(address => bool) public isSlot;

    /// @notice Hooks the admin has attested.
    /// @dev Advisory, and deliberately so. A slot creator may point at any hook
    ///      with code; this records an opinion for clients to surface, not a
    ///      permission. Enforcing it would make the admin a gatekeeper on what
    ///      anyone may build, which is the opposite of the point.
    mapping(address => bool) public attestedHooks;

    uint256 public slotCount;

    event SlotCreated(
        address indexed slot,
        address indexed recipient,
        address indexed creator,
        address currency,
        address hook
    );
    event HookAttested(address indexed hook, bool attested);
    event AdminTransferred(address indexed from, address indexed to);
    event BeaconUpgraded(address indexed implementation);
    /// @notice Re-emitted from a slot so indexers watch one address, not 237.
    event SlotEvent(address indexed slot, bytes32 indexed topic, bytes data);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotManager();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin_, address implementation)
        external
        initializer
    {
        if (admin_ == address(0)) revert InvalidRecipient();
        admin = admin_;
        // The FACTORY owns the beacon, not the admin EOA. Handing beacon
        // ownership straight to `admin_` reads like the simpler thing and
        // breaks two ways: `upgradeBeacon` below can then never succeed, since
        // the caller OZ sees is this contract; and beacon ownership would be
        // frozen at whoever deployed, so `transferAdmin` would hand over an
        // admin role that silently no longer carries the power to upgrade.
        beacon = new UpgradeableBeacon(implementation, address(this));
        emit AdminTransferred(address(0), admin_);
    }

    function createSlot(SlotInit calldata init) external returns (address slot) {
        slot = address(
            new BeaconProxy(
                address(beacon),
                abi.encodeCall(Slot.initialize, (init))
            )
        );
        isSlot[slot] = true;
        unchecked {
            ++slotCount;
        }
        emit SlotCreated(
            slot,
            init.recipient,
            msg.sender,
            address(init.currency),
            init.hook
        );
    }

    /// @notice Republish a slot's event through this address.
    /// @dev Only a slot this factory made may call. An indexer that trusted an
    ///      arbitrary caller here would be indexing fiction.
    function emitEvent(bytes32 topic, bytes calldata data) external {
        if (!isSlot[msg.sender]) revert NotManager();
        emit SlotEvent(msg.sender, topic, data);
    }

    function attestHook(address hook, bool attested) external onlyAdmin {
        attestedHooks[hook] = attested;
        emit HookAttested(hook, attested);
    }

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert InvalidRecipient();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    /// @notice Point every slot at new code. The single most consequential
    ///         action in the protocol.
    function upgradeBeacon(address implementation) external onlyAdmin {
        beacon.upgradeTo(implementation);
        emit BeaconUpgraded(implementation);
    }

    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
