// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUtility} from "../interfaces/IUtility.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {EVT_FEED_METADATA_UPDATED, EVT_FEED_METADATA_CLEARED} from "../FeedRouter.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";

interface IFeedRouter {
    function emitEvent(address slot, uint8 eventType, bytes calldata data) external;
}

/// @title FeedPostModule
/// @notice UUPS-upgradeable module that stores a URI per slot for The Feed.
/// @dev Supports trusted routers for atomic buy+post flows.
contract FeedPostModule is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IUtility
{
    /// @notice slot address => URI
    mapping(address => string) public tokenURI;

    /// @notice Trusted routers that can call postFor
    mapping(address => bool) public trustedRouters;

    /// @notice FeedRouter used as event hub
    address public router;

    event MetadataUpdated(address indexed slot, address indexed updatedBy, string uri);
    event RouterUpdated(address indexed router, bool trusted);

    error NotOccupant();
    error NotTrustedRouter();
    error NotActualOccupant();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    // ── Router management ─────────────────────────────────────

    /// @notice Add or remove a trusted router. Only owner.
    function setTrustedRouter(address _router, bool trusted) external onlyOwner {
        trustedRouters[_router] = trusted;
        emit RouterUpdated(_router, trusted);
    }

    /// @notice Set the FeedRouter event hub address. Only owner.
    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    // ── Metadata ──────────────────────────────────────────────

    modifier onlyOccupant(address slot) {
        if (msg.sender != _slotOccupant(slot)) revert NotOccupant();
        _;
    }

    /// @notice Update the URI for a slot. Only callable by the current occupant.
    function updateMetadata(
        address slot,
        string calldata uri
    ) external onlyOccupant(slot) {
        tokenURI[slot] = uri;
        emit MetadataUpdated(slot, msg.sender, uri);
        _emitFeedEvent(slot, EVT_FEED_METADATA_UPDATED, abi.encode(msg.sender, uri));
    }

    /// @notice Update metadata on behalf of `account`. Only callable by the occupant.
    /// @dev The occupant (e.g. a FeedSocialGroup contract) calls this to attribute
    ///      the post to `account` while retaining slot occupancy.
    ///      updatedBy in the event = account, not msg.sender.
    /// @param account The address to attribute the post to
    /// @param slot The slot to update
    /// @param uri The metadata URI
    function updateMetadataFor(
        address account,
        address slot,
        string calldata uri
    ) external onlyOccupant(slot) {
        tokenURI[slot] = uri;
        emit MetadataUpdated(slot, account, uri);
        _emitFeedEvent(slot, EVT_FEED_METADATA_UPDATED, abi.encode(account, uri));
    }

    /// @notice Post metadata on behalf of a user. Only callable by trusted routers.
    /// @dev Verifies that `account` is actually the current occupant of the slot.
    function postFor(
        address account,
        address slot,
        string calldata uri
    ) external {
        if (!trustedRouters[msg.sender]) revert NotTrustedRouter();
        if (account != _slotOccupant(slot)) revert NotActualOccupant();

        tokenURI[slot] = uri;
        emit MetadataUpdated(slot, account, uri);
    }

    // ── Module hooks ──────────────────────────────────────────

    function onTransfer(uint256, address, address) external override {
        _clearMetadata(msg.sender);
    }

    function onPriceUpdate(uint256, uint256, uint256) external override {}

    function onRelease(uint256, address) external override {
        _clearMetadata(msg.sender);
    }

    /// @dev Not an accounting module — nothing to record when tax moves.
    function onSettle(uint256, address, uint256, uint256) external override {}

    /// @notice No fee for feed post module
    function feeBps() external pure override returns (uint256) {
        return 0;
    }

    /// @notice Fee recipient
    function feeRecipient() external pure override returns (address) {
        return 0x78a9e2891a47bAa6Ac9D541317b1278f9628dFf7;
    }

    /// @notice Module metadata URI
    function metadataURI() external pure override returns (string memory) {
        return "";
    }

    // ── ERC-165 ───────────────────────────────────────────────

    function name() external pure override returns (string memory) {
        return "FeedPostModule";
    }

    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            interfaceId == type(IUtility).interfaceId ||
            interfaceId == type(IModuleMetadata).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // ── INTERNALS ─────────────────────────────────────────────

    function _clearMetadata(address slot) internal {
        delete tokenURI[slot];
        emit MetadataUpdated(slot, address(0), "");
        _emitFeedEvent(slot, EVT_FEED_METADATA_CLEARED, abi.encode(slot));
    }

    function _emitFeedEvent(address slot, uint8 eventType, bytes memory data) internal {
        if (router == address(0)) return;
        try IFeedRouter(router).emitEvent(slot, eventType, data) {} catch {}
    }

    function _slotOccupant(address slot) internal view returns (address) {
        (bool ok, bytes memory data) = slot.staticcall(
            abi.encodeWithSignature("occupant()")
        );
        require(ok, "occupant() call failed");
        return abi.decode(data, (address));
    }

    // ── UUPS ──────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
