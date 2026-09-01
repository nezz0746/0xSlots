// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlotConfig, SlotInitParams, SlotInfo} from "../interfaces/ISlot.sol";
import {IFeed} from "../interfaces/IFeed.sol";

interface ISlotFactory {
    function createSlots(
        address recipient,
        IERC20 currency,
        SlotConfig memory config,
        SlotInitParams memory initParams,
        uint256 count
    ) external returns (address[] memory);
}

interface ISlotView {
    function getSlotInfo() external view returns (SlotInfo memory);
}

/// @title Feed
/// @notice Feed identity (name, updateable metadataURI, declared non-custodial
///         recipient) plus its slot set. Initial tiers are minted at
///         `initialize` time; further slots are minted only by the hub (via
///         the paid `mintSlots` path) — never directly by the feed owner —
///         each minted slot carries the feed module (injected by the hub,
///         immutable) and is module-verified; arbitrary addresses can never
///         be added. Batching keeps each tx under RPC gas caps.
contract Feed is Initializable, OwnableUpgradeable, IFeed {
    struct SlotTier {
        uint256 taxPercentage;
        uint256 liquidationBountyBps;
        uint256 minDepositSeconds;
        uint256 count;
    }

    string private _name;
    string private _metadataURI;
    address private _feedRecipient;
    address public slotFactory;
    address public feedModule;
    address public currency;
    address[] private _slots;
    address public hub;

    event NameUpdated(string name);
    event MetadataURIUpdated(string uri);
    event RecipientUpdated(address indexed recipient);
    event SlotAdded(address indexed slot);
    event SlotRemoved(address indexed slot);

    error ZeroRecipient();
    error NoTiers();
    error ModuleMismatch(address slot, address got, address expected);
    error SlotNotInFeed(address slot);
    error NotHub();

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        string calldata name_,
        string calldata metadataURI_,
        address recipient_,
        address slotFactory_,
        address feedModule_,
        address currency_,
        address hub_,
        SlotTier[] calldata initialTiers
    ) external initializer {
        __Ownable_init(owner_);
        if (recipient_ == address(0)) revert ZeroRecipient();
        _name = name_;
        _metadataURI = metadataURI_;
        _feedRecipient = recipient_;
        slotFactory = slotFactory_;
        feedModule = feedModule_;
        currency = currency_;
        hub = hub_;
        if (initialTiers.length > 0) {
            _mintSlots(initialTiers);
        }
    }

    /// @notice Mint slots (with the feed module) and append them. Gated to
    ///         the hub — the hub collects payment (feedCreationPrice /
    ///         slotPrice) before invoking this.
    function mintSlots(SlotTier[] calldata tiers) external {
        if (msg.sender != hub) revert NotHub();
        _mintSlots(tiers);
    }

    /// @dev Shared mint+verify loop used by both `initialize` (initial tiers)
    ///      and `mintSlots` (hub-gated paid additions).
    function _mintSlots(SlotTier[] calldata tiers) internal {
        if (tiers.length == 0) revert NoTiers();
        for (uint256 t = 0; t < tiers.length; t++) {
            if (tiers[t].count == 0) continue;
            address[] memory created = ISlotFactory(slotFactory).createSlots(
                _feedRecipient,
                IERC20(currency),
                SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
                SlotInitParams({
                    taxPercentage: tiers[t].taxPercentage,
                    utility: feedModule,
                    liquidationBountyBps: tiers[t].liquidationBountyBps,
                    minDepositSeconds: tiers[t].minDepositSeconds,
            occupancyPolicy: address(0)
                }),
                tiers[t].count
            );
            for (uint256 j = 0; j < created.length; j++) {
                address got = ISlotView(created[j]).getSlotInfo().utility;
                if (got != feedModule) revert ModuleMismatch(created[j], got, feedModule);
                _slots.push(created[j]);
                emit SlotAdded(created[j]);
            }
        }
    }

    /// @notice Delist a slot from this feed (order-preserving). The Slot contract
    ///         itself is untouched — this only removes it from the feed's list.
    function removeSlot(address slot) external onlyOwner {
        uint256 len = _slots.length;
        for (uint256 i = 0; i < len; i++) {
            if (_slots[i] == slot) {
                for (uint256 j = i; j < len - 1; j++) {
                    _slots[j] = _slots[j + 1];
                }
                _slots.pop();
                emit SlotRemoved(slot);
                return;
            }
        }
        revert SlotNotInFeed(slot);
    }

    function name() external view returns (string memory) { return _name; }
    function metadataURI() external view returns (string memory) { return _metadataURI; }
    function feedRecipient() external view returns (address) { return _feedRecipient; }
    function getSlots() external view returns (address[] memory) { return _slots; }
    function slotCount() external view returns (uint256) { return _slots.length; }

    function setName(string calldata name_) external onlyOwner {
        _name = name_;
        emit NameUpdated(name_);
    }

    function setMetadataURI(string calldata uri_) external onlyOwner {
        _metadataURI = uri_;
        emit MetadataURIUpdated(uri_);
    }

    function setFeedRecipient(address recipient_) external onlyOwner {
        if (recipient_ == address(0)) revert ZeroRecipient();
        _feedRecipient = recipient_;
        emit RecipientUpdated(recipient_);
    }
}
