// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {SlotConstants} from "./SlotConstants.sol";
import {ISlotEvents} from "../interfaces/ISlotEvents.sol";
import {TaxTerms, HookTerms, HookOffer} from "../types/SlotTypes.sol";
import {TermsQueue} from "../libraries/TermsLib.sol";
import "../errors/SlotErrors.sol";

/// @notice How the slot is governed. Fixed at birth except `manager`.
struct Settings {
    IERC20 currency;
    address manager;
    bool mutableTax;
    bool mutableRecipient;
    bool mutableHook;
}

/// @notice Who holds the slot, at what price, funded by how much.
struct Occupancy {
    address occupant;
    uint64 since;
    uint64 tenureId;
    uint64 lastSettled;
    uint256 price;
    uint256 deposit;
}

/// @notice Tax taken, and what could not be paid in either direction.
struct Ledger {
    uint256 collectedTax;
    mapping(address => uint256) withdrawableOf;
    mapping(address => uint256) debtOf;
    mapping(uint64 tenureId => mapping(address operator => bool)) operatorOf;
}

/**
 * @title SlotStorage
 * @notice Everything a slot remembers.
 *
 * @dev ERC-7201 namespaced storage, one location per concern, so any group can
 *      grow in an upgrade without moving another. The rule is the whole rule:
 *      append fields at the end of a struct, and never reorder, retype or
 *      reuse a namespace.
 *
 *      Locations are `keccak256(abi.encode(uint256(keccak256(id)) - 1)) &
 *      ~bytes32(uint256(0xff))`, with `id` in each constant's comment.
 */
abstract contract SlotStorage is
    ISlotEvents,
    SlotConstants,
    Initializable,
    ReentrancyGuard,
    Multicall
{
    /// @custom:storage-location erc7201:slots.settings
    bytes32 private constant SETTINGS =
        0xbf320a74cef9fbdc82fa0ef1191ba8006c03393c33ff9c5048e07e826f3f9700;
    /// @custom:storage-location erc7201:slots.terms.tax
    bytes32 private constant TAX_TERMS =
        0x9ced1b0fc58b3fce277f0e66820898812467bac04a43b3f7986c99b5a310c200;
    /// @custom:storage-location erc7201:slots.terms.hook
    bytes32 private constant HOOK =
        0xa720ce30f2f76ea33fe161ca5c8b954c1897ab42629cd4818e7b51fd9afede00;
    /// @custom:storage-location erc7201:slots.hook.offer
    bytes32 private constant HOOK_OFFER =
        0x7091cf4ba863a5a9b217219464dfd46ef26b30975ee445b73741b197c3a9e400;
    /// @custom:storage-location erc7201:slots.next.tax
    bytes32 private constant NEXT_TAX_TERMS =
        0x1e619fe027dd60ed86eac21a27ef124c5a4e8d3dd02b3b53f9082a4582fc8a00;
    /// @custom:storage-location erc7201:slots.next.hook
    bytes32 private constant NEXT_HOOK =
        0xd2dc278a1156089438bcf43efefbda76c5b02638aff18ea42826dc4b74055b00;
    /// @custom:storage-location erc7201:slots.queue
    bytes32 private constant QUEUE =
        0xe9f1ac798b7198349ced27e440d004066b641454823f46f5452894d62d456d00;
    /// @custom:storage-location erc7201:slots.occupancy
    bytes32 private constant OCCUPANCY =
        0xd2b9f20f136b9d84887a054e10c7bff548205b499752039bfaf6e0a10e3d5e00;
    /// @custom:storage-location erc7201:slots.ledger
    bytes32 private constant LEDGER =
        0x00ad3db4016d1b422971826df42227f88ab7704e4f4548ce9d63b5964b276400;

    function _settings() internal pure returns (Settings storage $) {
        assembly ("memory-safe") {
            $.slot := SETTINGS
        }
    }

    function _taxTerms() internal pure returns (TaxTerms storage $) {
        assembly ("memory-safe") {
            $.slot := TAX_TERMS
        }
    }

    function _hookTerms() internal pure returns (HookTerms storage $) {
        assembly ("memory-safe") {
            $.slot := HOOK
        }
    }

    /// @dev The hook's offer as this slot accepted it.
    function _hookOffer() internal pure returns (HookOffer storage $) {
        assembly ("memory-safe") {
            $.slot := HOOK_OFFER
        }
    }

    function _nextTaxTerms() internal pure returns (TaxTerms storage $) {
        assembly ("memory-safe") {
            $.slot := NEXT_TAX_TERMS
        }
    }

    function _nextHookTerms() internal pure returns (HookTerms storage $) {
        assembly ("memory-safe") {
            $.slot := NEXT_HOOK
        }
    }

    function _queue() internal pure returns (TermsQueue storage $) {
        assembly ("memory-safe") {
            $.slot := QUEUE
        }
    }

    function _occupancy() internal pure returns (Occupancy storage $) {
        assembly ("memory-safe") {
            $.slot := OCCUPANCY
        }
    }

    function _ledger() internal pure returns (Ledger storage $) {
        assembly ("memory-safe") {
            $.slot := LEDGER
        }
    }

    modifier onlyManager() {
        if (msg.sender != _settings().manager) revert NotManager();
        _;
    }

    modifier onlyOccupant() {
        if (msg.sender != _occupancy().occupant) revert NotOccupant();
        _;
    }

    /// @notice Whether `operator` may act for the CURRENT occupant.
    function isOperator(address operator) public view returns (bool) {
        Occupancy storage o = _occupancy();
        return o.occupant != address(0) && _ledger().operatorOf[o.tenureId][operator];
    }

    modifier onlyOccupantOrOperator() {
        if (msg.sender != _occupancy().occupant && !isOperator(msg.sender)) {
            revert NotOccupantOrOperator();
        }
        _;
    }
}
