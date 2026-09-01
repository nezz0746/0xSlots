// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Slot} from "../Slot.sol";

/// @title SlotNameResolver — ENS resolver that reads from Slot contracts
/// @notice Resolves ENS names by reading the occupant and metadata from the linked Slot.
///         The occupant of a slot controls what the name resolves to by setting metadata.
///
/// @dev Resolution logic:
///   - addr(node) → reads "addr" from MetadataModule JSON, falls back to slot occupant
///   - name(node) → reverse resolution (optional)
///
///   Metadata is stored as a JSON URI in the MetadataModule. The resolver reads it on-chain
///   if the URI points to a contract-readable format, or clients resolve it off-chain.
///
///   For on-chain addr() resolution, the occupant can call setAddr() on this resolver directly.
contract SlotNameResolver {

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error NotOccupant();
    error SlotNotRegistered();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event AddrChanged(bytes32 indexed node, address addr);
    event TextChanged(bytes32 indexed node, string indexed key, string value);

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice node → slot contract address
    mapping(bytes32 => address) public nodeSlots;

    /// @notice node → resolved address (set by occupant)
    mapping(bytes32 => address) public addresses;

    /// @notice node → key → text record (set by occupant)
    mapping(bytes32 => mapping(string => string)) public texts;

    /// @notice Registry that can register node→slot mappings
    address public immutable registry;

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /// @param _registry The SlotNameRegistry address (only it can link nodes to slots)
    constructor(address _registry) {
        registry = _registry;
    }

    // ═══════════════════════════════════════════════════════════
    // REGISTRATION (called by SlotNameRegistry)
    // ═══════════════════════════════════════════════════════════

    /// @notice Link a node to a slot. Only callable by the registry.
    /// @param node The ENS node hash
    /// @param slot The slot contract address
    function setSlot(bytes32 node, address slot) external {
        require(msg.sender == registry, "only registry");
        nodeSlots[node] = slot;
    }

    // ═══════════════════════════════════════════════════════════
    // OCCUPANT CONTROLS
    // ═══════════════════════════════════════════════════════════

    /// @notice Set the address this name resolves to. Only the slot occupant can call.
    /// @param node The ENS node hash
    /// @param _addr The address to resolve to
    function setAddr(bytes32 node, address _addr) external {
        address slot = nodeSlots[node];
        if (slot == address(0)) revert SlotNotRegistered();
        if (msg.sender != Slot(slot).occupant()) revert NotOccupant();

        addresses[node] = _addr;
        emit AddrChanged(node, _addr);
    }

    /// @notice Set a text record for this name. Only the slot occupant can call.
    /// @param node The ENS node hash
    /// @param key The text record key (e.g. "avatar", "url", "description")
    /// @param value The text record value
    function setText(bytes32 node, string calldata key, string calldata value) external {
        address slot = nodeSlots[node];
        if (slot == address(0)) revert SlotNotRegistered();
        if (msg.sender != Slot(slot).occupant()) revert NotOccupant();

        texts[node][key] = value;
        emit TextChanged(node, key, value);
    }

    // ═══════════════════════════════════════════════════════════
    // ENS RESOLUTION (EIP-137 / EIP-634)
    // ═══════════════════════════════════════════════════════════

    /// @notice Resolve addr for a node
    /// @dev If no explicit addr set, falls back to the slot occupant
    function addr(bytes32 node) external view returns (address) {
        address resolved = addresses[node];
        if (resolved != address(0)) return resolved;

        // Fallback: return slot occupant
        address slot = nodeSlots[node];
        if (slot == address(0)) return address(0);

        address occupant = Slot(slot).occupant();
        return occupant;
    }

    /// @notice Resolve text record for a node
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice Get the slot contract for a node
    function getSlot(bytes32 node) external view returns (address) {
        return nodeSlots[node];
    }

    /// @notice Get the current occupant (name controller) for a node
    function getOccupant(bytes32 node) external view returns (address) {
        address slot = nodeSlots[node];
        if (slot == address(0)) return address(0);
        return Slot(slot).occupant();
    }

    /// @notice Check if a node has a registered slot
    function isRegistered(bytes32 node) external view returns (bool) {
        return nodeSlots[node] != address(0);
    }

    // ═══════════════════════════════════════════════════════════
    // ERC-165
    // ═══════════════════════════════════════════════════════════

    /// @notice ERC-165 interface detection
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x3b3b57de  // addr(bytes32)
            || interfaceId == 0x59d1d43c  // text(bytes32,string)
            || interfaceId == 0x01ffc9a7; // ERC-165
    }
}
