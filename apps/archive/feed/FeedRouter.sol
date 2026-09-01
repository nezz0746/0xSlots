// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ═══════════════════════════════════════════════════════════
// FEED EVENT TYPES
// ═══════════════════════════════════════════════════════════

uint8 constant EVT_FEED_POSTED = 1;
uint8 constant EVT_FEED_METADATA_UPDATED = 2;
uint8 constant EVT_FEED_METADATA_CLEARED = 3;

interface ISlot {
    function buy(address account, uint256 depositAmount, uint256 selfAssessedPrice) external;
    function currency() external view returns (IERC20);
    function price() external view returns (uint256);
    function occupant() external view returns (address);
    /// Deprecated selector, deliberately. FeedRouter is deployed separately
    /// from the beacon, so it must keep calling something every slot answers
    /// both before and after the utility rename.
    function module() external view returns (address);
}

interface IFeedPostModule {
    function postFor(address account, address slot, string calldata uri) external;
}

/// @title FeedRouter
/// @notice UUPS-upgradeable router + event hub for The Feed.
/// @dev Handles atomic buy+post and acts as a centralized event emitter
///      (same pattern as SlotFactory.emitEvent for slot events).
contract FeedRouter is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event FeedEvent(address indexed slot, uint8 indexed eventType, bytes data);

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error SlotHasNoModule();
    error NotTrustedEmitter();

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice Contracts allowed to call emitEvent (e.g. FeedPostModule)
    mapping(address => bool) public trustedEmitters;

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /// @notice Add or remove a trusted emitter. Only owner.
    function setTrustedEmitter(address emitter, bool trusted) external onlyOwner {
        trustedEmitters[emitter] = trusted;
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT HUB
    // ═══════════════════════════════════════════════════════════

    /// @notice Emit a feed-wide event (called by trusted emitters like FeedPostModule)
    function emitEvent(address slot, uint8 eventType, bytes calldata data) external {
        if (!trustedEmitters[msg.sender]) revert NotTrustedEmitter();
        emit FeedEvent(slot, eventType, data);
    }

    // ═══════════════════════════════════════════════════════════
    // ROUTING
    // ═══════════════════════════════════════════════════════════

    /// @notice Buy a slot and post metadata in one transaction.
    /// @param slot The slot contract to buy
    /// @param depositAmount Amount to deposit for tax escrow
    /// @param selfAssessedPrice The price you're setting
    /// @param uri The metadata URI to post (e.g. ipfs://...)
    /// @dev Caller must have approved this router for (price + depositAmount) of the slot's currency.
    function buyAndPost(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        string calldata uri
    ) external nonReentrant {
        ISlot s = ISlot(slot);
        IERC20 token = s.currency();
        address mod = s.module();
        if (mod == address(0)) revert SlotHasNoModule();

        // Calculate total needed: current price (if occupied) + deposit
        uint256 currentPrice = s.occupant() != address(0) ? s.price() : 0;
        uint256 total = currentPrice + depositAmount;

        // Pull tokens from user -> router
        if (total > 0) {
            token.safeTransferFrom(msg.sender, address(this), total);
            token.forceApprove(slot, total);
        }

        // Buy: msg.sender becomes occupant
        s.buy(msg.sender, depositAmount, selfAssessedPrice);

        // Reset approval to 0 (in case slot consumed less than expected)
        token.forceApprove(slot, 0);

        // Sweep any leftover tokens back to caller
        uint256 remaining = token.balanceOf(address(this));
        if (remaining > 0) {
            token.safeTransfer(msg.sender, remaining);
        }

        // Post metadata via module
        IFeedPostModule(mod).postFor(msg.sender, slot, uri);

        // Emit centralized feed event
        emit FeedEvent(
            slot,
            EVT_FEED_POSTED,
            abi.encode(msg.sender, uri)
        );
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
