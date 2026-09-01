// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Feed} from "./Feed.sol";

interface IFeedOwned {
    function owner() external view returns (address);
    function mintSlots(Feed.SlotTier[] calldata tiers) external;
}

/// @title FeedHub (UUPS)
/// @notice Upgradeable factory + registry for beacon-proxy Feeds, with pricing.
contract FeedHub is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public constant INCLUDED_SLOTS = 10;

    // UUPS storage — APPEND ONLY. Never reorder or insert vars in an upgrade;
    // add new state strictly after `feeds` to preserve the live layout.
    UpgradeableBeacon public beacon;
    address public slotFactory;
    address public feedModule;
    address public currency;
    address public feeRecipient;
    uint256 public feedCreationPrice;
    uint256 public slotPrice;
    address[] public feeds;

    event FeedCreated(uint256 indexed index, address indexed feed, address indexed owner);
    event SlotsAdded(address indexed feed, uint256 count);
    event FeeRecipientUpdated(address recipient);
    event FeedCreationPriceUpdated(uint256 price);
    event SlotPriceUpdated(uint256 price);
    event Withdrawn(address to, uint256 amount);

    error InsufficientPayment(uint256 required, uint256 provided);
    error NotFeedOwner();
    error ZeroFeeRecipient();
    error WithdrawFailed();

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address feedImplementation_,
        address slotFactory_,
        address feedModule_,
        address currency_,
        address feeRecipient_,
        uint256 feedCreationPrice_,
        uint256 slotPrice_
    ) external initializer {
        __Ownable_init(owner_);
        if (feeRecipient_ == address(0)) revert ZeroFeeRecipient();
        beacon = new UpgradeableBeacon(feedImplementation_, address(this));
        slotFactory = slotFactory_;
        feedModule = feedModule_;
        currency = currency_;
        feeRecipient = feeRecipient_;
        feedCreationPrice = feedCreationPrice_;
        slotPrice = slotPrice_;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // --- admin ---
    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroFeeRecipient();
        feeRecipient = r;
        emit FeeRecipientUpdated(r);
    }

    function setFeedCreationPrice(uint256 p) external onlyOwner {
        feedCreationPrice = p;
        emit FeedCreationPriceUpdated(p);
    }

    function setSlotPrice(uint256 p) external onlyOwner {
        slotPrice = p;
        emit SlotPriceUpdated(p);
    }

    function upgradeFeedImplementation(address newImplementation) external onlyOwner {
        beacon.upgradeTo(newImplementation);
    }

    // --- feed creation (payable) ---
    function createFeed(
        address owner_,
        string calldata name_,
        string calldata metadataURI_,
        address recipient_,
        Feed.SlotTier[] calldata tiers
    ) external payable returns (address feed, uint256 index) {
        uint256 total = _totalCount(tiers);
        uint256 extra = total > INCLUDED_SLOTS ? total - INCLUDED_SLOTS : 0;
        uint256 required = feedCreationPrice + slotPrice * extra;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        bytes memory initData = abi.encodeCall(
            Feed.initialize,
            (owner_, name_, metadataURI_, recipient_, slotFactory, feedModule, currency, address(this), tiers)
        );
        feed = address(new BeaconProxy(address(beacon), initData));
        index = feeds.length;
        feeds.push(feed);
        emit FeedCreated(index, feed, owner_);
    }

    // --- paid slot additions (feed owner only) ---
    function addSlots(address feed, Feed.SlotTier[] calldata tiers) external payable {
        if (IFeedOwned(feed).owner() != msg.sender) revert NotFeedOwner();
        uint256 total = _totalCount(tiers);
        uint256 required = slotPrice * total;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);
        IFeedOwned(feed).mintSlots(tiers);
        emit SlotsAdded(feed, total);
    }

    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok, ) = feeRecipient.call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(feeRecipient, bal);
    }

    function feedCount() external view returns (uint256) {
        return feeds.length;
    }

    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    function _totalCount(Feed.SlotTier[] calldata tiers) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < tiers.length; i++) {
            total += tiers[i].count;
        }
    }
}
