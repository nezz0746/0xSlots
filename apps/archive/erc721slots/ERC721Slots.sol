// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721Upgradeable} from "@openzeppelin-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "./Slot.sol";
import {SlotFactory} from "./SlotFactory.sol";
import {SlotConfig, SlotInitParams, SlotInfo} from "./interfaces/ISlot.sol";

/// @title ERC721Slots — Harberger-taxed NFTs powered by 0xSlots
/// @notice Each token is backed by a Slot. Ownership = occupancy.
///         No transferFrom — buy the slot to own the NFT.
///         Tax flows to the collection creator (recipient) forever.
///         Deployed as BeaconProxy via ERC721SlotsFactory.
contract ERC721Slots is Initializable, ERC721Upgradeable {
    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error TransferDisabled();
    error NotCreator();
    error TokenDoesNotExist();
    error InvalidTokenURI();

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The 0xSlots factory used to deploy backing slots
    SlotFactory public factory;

    /// @notice Collection creator — receives all tax revenue
    address public creator;

    /// @notice Currency used for all slots in this collection
    IERC20 public currency;

    /// @notice Shared slot config for all tokens
    SlotConfig public slotConfig;

    /// @notice Shared initial params for all tokens
    SlotInitParams public slotInitParams;

    /// @notice Token ID → backing Slot address
    mapping(uint256 => address) public tokenSlot;

    /// @notice Backing Slot address → Token ID (reverse lookup)
    mapping(address => uint256) public slotToken;

    /// @notice Token ID → metadata URI
    mapping(uint256 => string) private _tokenURIs;

    /// @notice Next token ID to mint
    uint256 public nextTokenId;

    /// @notice Total minted
    uint256 public totalSupply;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event TokenMinted(
        uint256 indexed tokenId,
        address indexed slot,
        string uri
    );

    // ═══════════════════════════════════════════════════════════
    // INITIALIZER
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address factory_,
        address creator_,
        address currency_,
        SlotConfig memory config_,
        SlotInitParams memory initParams_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        factory = SlotFactory(factory_);
        creator = creator_;
        currency = IERC20(currency_);
        slotConfig = config_;
        slotInitParams = initParams_;
    }

    // ═══════════════════════════════════════════════════════════
    // MINT
    // ═══════════════════════════════════════════════════════════

    /// @notice Mint a new Harberger NFT. Deploys a backing slot.
    /// @param uri Token metadata URI
    function mint(
        string calldata uri
    ) external returns (uint256 tokenId, address slot) {
        if (msg.sender != creator) revert NotCreator();
        if (bytes(uri).length == 0) revert InvalidTokenURI();

        tokenId = nextTokenId++;
        totalSupply++;

        // Deploy a slot with creator as recipient
        slot = factory.createSlot(
            creator,
            currency,
            slotConfig,
            slotInitParams
        );

        tokenSlot[tokenId] = slot;
        slotToken[slot] = tokenId;
        _tokenURIs[tokenId] = uri;

        // Mint to the contract itself — NFT is "unowned" until someone buys the slot
        _mint(address(this), tokenId);

        emit TokenMinted(tokenId, slot, uri);
    }

    /// @notice Batch mint multiple tokens
    /// @param uris Array of metadata URIs
    function mintBatch(
        string[] calldata uris
    ) external returns (uint256[] memory tokenIds, address[] memory slots) {
        if (msg.sender != creator) revert NotCreator();

        uint256 count = uris.length;
        tokenIds = new uint256[](count);
        slots = new address[](count);

        // Batch deploy slots
        address[] memory deployedSlots = factory.createSlots(
            creator,
            currency,
            slotConfig,
            slotInitParams,
            count
        );

        for (uint256 i = 0; i < count; i++) {
            if (bytes(uris[i]).length == 0) revert InvalidTokenURI();

            uint256 tokenId = nextTokenId++;
            totalSupply++;

            tokenSlot[tokenId] = deployedSlots[i];
            slotToken[deployedSlots[i]] = tokenId;
            _tokenURIs[tokenId] = uris[i];

            _mint(address(this), tokenId);

            tokenIds[i] = tokenId;
            slots[i] = deployedSlots[i];

            emit TokenMinted(tokenId, deployedSlots[i], uris[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ERC721 OVERRIDES
    // ═══════════════════════════════════════════════════════════

    /// @notice Owner = slot occupant. If vacant, owner = this contract.
    function ownerOf(uint256 tokenId) public view override returns (address) {
        address slot = tokenSlot[tokenId];
        if (slot == address(0)) revert TokenDoesNotExist();

        address occupant = Slot(payable(slot)).occupant();
        if (occupant == address(0)) {
            return address(this);
        }
        return occupant;
    }

    /// @notice Balance based on how many slots an address occupies
    function balanceOf(
        address owner
    ) public view override returns (uint256 count) {
        for (uint256 i = 0; i < nextTokenId; i++) {
            address slot = tokenSlot[i];
            if (slot != address(0)) {
                address occupant = Slot(payable(slot)).occupant();
                if (occupant == owner) count++;
            }
        }
    }

    /// @notice Token URI from stored mapping
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        address slot = tokenSlot[tokenId];
        if (slot == address(0)) revert TokenDoesNotExist();
        return _tokenURIs[tokenId];
    }

    /// @dev Block all standard transfers. Ownership changes via slot buy/release/liquidate.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        // Allow minting (from == address(0))
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert TransferDisabled();
        }
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals are meaningless — ownership is slot-based
    function approve(address, uint256) public pure override {
        revert TransferDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert TransferDisabled();
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice Get full slot info for a token
    function getTokenSlotInfo(
        uint256 tokenId
    ) external view returns (SlotInfo memory) {
        address slot = tokenSlot[tokenId];
        if (slot == address(0)) revert TokenDoesNotExist();
        return Slot(payable(slot)).getSlotInfo();
    }

    /// @notice Check if a token is currently held (slot occupied)
    function isHeld(uint256 tokenId) external view returns (bool) {
        address slot = tokenSlot[tokenId];
        if (slot == address(0)) revert TokenDoesNotExist();
        return !Slot(payable(slot)).isVacant();
    }

    /// @notice Get the current price of a token
    function priceOf(uint256 tokenId) external view returns (uint256) {
        address slot = tokenSlot[tokenId];
        if (slot == address(0)) revert TokenDoesNotExist();
        return Slot(payable(slot)).price();
    }

    /// @notice ERC-165 interface support
    function supportsInterface(
        bytes4 interfaceId
    ) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice ERC721Receiver — accept NFTs minted to self
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
