// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IENSRegistry} from "./IENSRegistry.sol";
import {SlotConfig, SlotInitParams} from "../interfaces/ISlot.sol";
import {SlotFactory} from "../SlotFactory.sol";
import {Slot} from "../Slot.sol";
import {SlotNameResolver} from "./SlotNameResolver.sol";

/// @title SlotNameRegistry — Harberger-taxed ENS subdomains
/// @notice Registers ENS subdomains under a parent name (e.g. *.slots.eth).
///         Each subdomain maps to a Slot contract. The occupant controls name resolution.
///         Squatting is economically irrational — you pay tax on your self-assessed name value.
///
/// @dev Flow:
///   1. Admin sets this contract as owner of the parent ENS node (e.g. namehash("slots.eth"))
///   2. User calls register("nike") → deploys a Slot + sets ENS subnode to point at SlotNameResolver
///   3. Slot occupant = name controller. Force-buy the slot → you control the name.
///   4. SlotNameResolver reads occupant + metadata from the Slot for addr()/text() resolution.
contract SlotNameRegistry is Ownable {

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error NameAlreadyRegistered();
    error NameTooShort();
    error InvalidCharacter();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event NameRegistered(string indexed nameHash, string name, address indexed slot, address indexed registrant);

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice ENS registry
    IENSRegistry public immutable ens;

    /// @notice The parent ENS node (e.g. namehash("slots.eth"))
    bytes32 public immutable parentNode;

    /// @notice SlotFactory for deploying slot contracts
    SlotFactory public immutable factory;

    /// @notice Resolver set on all registered subdomains
    address public resolver;

    /// @notice Default slot config for name slots
    address public taxRecipient;        // tax revenue destination
    IERC20 public currency;             // tax currency
    uint256 public taxPercentage;       // basis points (e.g. 500 = 5%)
    address public metadataModule;      // MetadataModule for storing resolution data
    uint256 public liquidationBountyBps;
    uint256 public minDepositSeconds;

    /// @notice label hash → slot address
    mapping(bytes32 => address) public nameSlots;

    /// @notice slot address → label hash (reverse lookup)
    mapping(address => bytes32) public slotNames;

    /// @notice Total names registered
    uint256 public nameCount;

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /// @param _ens ENS registry address
    /// @param _parentNode The namehash of the parent domain (e.g. namehash("slots.eth"))
    /// @param _factory SlotFactory address
    /// @param _resolver SlotNameResolver address
    /// @param _taxRecipient Where tax revenue flows
    /// @param _currency ERC-20 used for tax payments
    /// @param _taxPercentage Tax rate in basis points per month
    /// @param _metadataModule MetadataModule address for storing ENS records
    constructor(
        address _ens,
        bytes32 _parentNode,
        address _factory,
        address _resolver,
        address _taxRecipient,
        IERC20 _currency,
        uint256 _taxPercentage,
        address _metadataModule
    ) Ownable(msg.sender) {
        ens = IENSRegistry(_ens);
        parentNode = _parentNode;
        factory = SlotFactory(_factory);
        resolver = _resolver;
        taxRecipient = _taxRecipient;
        currency = _currency;
        taxPercentage = _taxPercentage;
        metadataModule = _metadataModule;
        liquidationBountyBps = 100; // 1% default
        minDepositSeconds = 7 days;
    }

    // ═══════════════════════════════════════════════════════════
    // REGISTRATION
    // ═══════════════════════════════════════════════════════════

    /// @notice Register a subdomain. Deploys a Slot contract and links the ENS subnode.
    /// @param name The subdomain label (e.g. "nike" for nike.slots.eth)
    /// @return slot The deployed Slot contract address
    function register(string calldata name) external returns (address slot) {
        _validateName(name);

        bytes32 label = keccak256(bytes(name));
        if (nameSlots[label] != address(0)) revert NameAlreadyRegistered();

        // Deploy slot via factory
        slot = factory.createSlot(
            taxRecipient,
            currency,
            SlotConfig({
                mutableTax: false,
                mutableUtility: false, mutablePolicy: false,
                manager: address(0)
            }),
            SlotInitParams({
                taxPercentage: taxPercentage,
                utility: metadataModule,
                liquidationBountyBps: liquidationBountyBps,
                minDepositSeconds: minDepositSeconds,
            occupancyPolicy: address(0)
            })
        );

        // Record mapping
        nameSlots[label] = slot;
        slotNames[slot] = label;
        nameCount++;

        // Set ENS subnode: parent owner (this contract) → subnode owner = this contract
        // Resolver = SlotNameResolver which reads from the slot
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, label));
        ens.setSubnodeRecord(parentNode, label, address(this), resolver, 0);

        // Link the node to the slot in the resolver
        SlotNameResolver(resolver).setSlot(subnode, slot);

        emit NameRegistered(name, name, slot, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice Get the slot address for a name
    function getSlot(string calldata name) external view returns (address) {
        return nameSlots[keccak256(bytes(name))];
    }

    /// @notice Get the subnode hash for a name
    function getSubnode(string calldata name) external view returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(name))));
    }

    /// @notice Check if a name is available
    function available(string calldata name) external view returns (bool) {
        return nameSlots[keccak256(bytes(name))] == address(0);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setResolver(address _resolver) external onlyOwner {
        resolver = _resolver;
    }

    function setTaxRecipient(address _taxRecipient) external onlyOwner {
        taxRecipient = _taxRecipient;
    }

    function setCurrency(IERC20 _currency) external onlyOwner {
        currency = _currency;
    }

    function setTaxPercentage(uint256 _taxPercentage) external onlyOwner {
        taxPercentage = _taxPercentage;
    }

    function setMetadataModule(address _metadataModule) external onlyOwner {
        metadataModule = _metadataModule;
    }

    function setLiquidationBountyBps(uint256 _bps) external onlyOwner {
        liquidationBountyBps = _bps;
    }

    function setMinDepositSeconds(uint256 _seconds) external onlyOwner {
        minDepositSeconds = _seconds;
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    /// @dev Validate name: min 3 chars, lowercase alphanumeric + hyphens only
    function _validateName(string calldata name) internal pure {
        bytes memory b = bytes(name);
        if (b.length < 3) revert NameTooShort();
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool valid = (c >= 0x30 && c <= 0x39) || // 0-9
                         (c >= 0x61 && c <= 0x7a) || // a-z
                         c == 0x2d;                    // hyphen
            if (!valid) revert InvalidCharacter();
        }
    }
}
