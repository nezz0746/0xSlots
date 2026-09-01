// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin-upgradeable/contracts/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFeedPostModule {
    function updateMetadataFor(
        address account,
        address slot,
        string calldata uri
    ) external;
}

interface ISlot {
    function release() external;
    function withdraw(uint256 amount) external;
    function selfAssess(uint256 newPrice) external;
}

/// @title FeedSocialGroup
/// @notice UUPS-upgradeable relay for group-owned slots with three posting modes:
///         - post: anyone can post, attributed to msg.sender
///         - postAdmin: POSTING_MANAGER force-posts on behalf of a poster
///         - postWithSignature: POSTING_MANAGER relays, poster proven via EIP-712 signature
contract FeedSocialGroup is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error InvalidSignature();
    error NonceAlreadyUsed();

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    bytes32 public constant POSTING_MANAGER =
        keccak256("POSTING_MANAGER");

    /// @notice Manages slot positions held by this contract: release, withdraw, selfAssess
    bytes32 public constant SLOT_MANAGER =
        keccak256("SLOT_MANAGER");

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    IFeedPostModule public feedModule;

    /// @notice Replay protection for signature-based posts
    mapping(bytes32 => bool) public usedNonces;

    // ═══════════════════════════════════════════════════════════
    // EIP-712
    // ═══════════════════════════════════════════════════════════

    bytes32 public constant POST_TYPEHASH =
        keccak256("Post(address slot,string uri,bytes32 nonce)");

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address _feedModule
    ) external initializer {
        __AccessControl_init();
        __EIP712_init("FeedSocialGroup", "1");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        feedModule = IFeedPostModule(_feedModule);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setFeedModule(address _feedModule) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feedModule = IFeedPostModule(_feedModule);
    }

    // ═══════════════════════════════════════════════════════════
    // POSTING
    // ═══════════════════════════════════════════════════════════

    /// @notice Regular post — anyone can call, attributed to msg.sender.
    function post(
        address slot,
        string calldata uri
    ) external {
        feedModule.updateMetadataFor(msg.sender, slot, uri);
    }

    /// @notice Force post by a POSTING_MANAGER — poster passed in args, no user signature.
    ///         Backend is trusted to attribute correctly.
    function postAdmin(
        address poster,
        address slot,
        string calldata uri
    ) external onlyRole(POSTING_MANAGER) {
        feedModule.updateMetadataFor(poster, slot, uri);
    }

    /// @notice Relayed post — POSTING_MANAGER submits, but the poster is
    ///         cryptographically proven via EIP-712 signature from the poster.
    /// @param slot The slot to post to
    /// @param uri The metadata URI
    /// @param nonce Unique nonce for replay protection
    /// @param signature EIP-712 signature from the poster
    function postWithSignature(
        address slot,
        string calldata uri,
        bytes32 nonce,
        bytes calldata signature
    ) external onlyRole(POSTING_MANAGER) {
        if (usedNonces[nonce]) revert NonceAlreadyUsed();
        usedNonces[nonce] = true;

        bytes32 structHash = keccak256(
            abi.encode(POST_TYPEHASH, slot, keccak256(bytes(uri)), nonce)
        );
        address poster = ECDSA.recover(_hashTypedDataV4(structHash), signature);

        feedModule.updateMetadataFor(poster, slot, uri);
    }

    // ═══════════════════════════════════════════════════════════
    // SLOT MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Voluntarily exit a slot occupied by this contract.
    /// @dev Refund (remaining deposit) lands on this contract; use sweep to extract.
    function releaseSlot(address slot) external onlyRole(SLOT_MANAGER) {
        ISlot(slot).release();
    }

    /// @notice Withdraw excess deposit from a slot occupied by this contract.
    /// @dev Withdrawn tokens land on this contract; use sweep to extract.
    function withdrawFromSlot(address slot, uint256 amount) external onlyRole(SLOT_MANAGER) {
        ISlot(slot).withdraw(amount);
    }

    /// @notice Re-self-assess the price of a slot occupied by this contract.
    function selfAssessSlot(address slot, uint256 newPrice) external onlyRole(SLOT_MANAGER) {
        ISlot(slot).selfAssess(newPrice);
    }

    /// @notice Recover ERC-20 tokens held by this contract (refunds, withdrawals, accidental sends).
    function sweep(IERC20 token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        token.safeTransfer(to, amount);
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
