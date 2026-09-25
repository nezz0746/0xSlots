// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {SlotConstants} from "./SlotConstants.sol";
import {ISlotEvents} from "../interfaces/ISlotEvents.sol";
import {TaxTerms, InstalledModule, Pending} from "../types/SlotTypes.sol";
import "../errors/SlotErrors.sol";

/// @notice How the slot is governed. Fixed at birth except `manager`.
struct Settings {
    IERC20 currency;
    address manager;
    bool mutableTax;
    bool mutableRecipient;
    bool mutableModule;
}

/// @notice Who holds the slot, at what price, funded by how much.
struct Occupancy {
    address occupant;
    uint64 since;
    uint64 tenureId;
    uint64 lastSettled;
    /// Tax accrued below one whole unit of currency, in the numerator space
    /// of `SlotMath` (always < MONTH * BASIS_POINTS). Kept rather than dropped,
    /// so a settle never has to hold the clock back to stay honest. Packs into
    /// the same word as the two fields above: nothing below moves.
    uint64 taxCarry;
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
    /// @custom:storage-location erc7201:slots.module
    bytes32 private constant MODULE =
        0x1bc04e3ed307764572bc2803d48f03e84a9d12c612c8cd1e0b63fb12c6b2e200;
    /// @custom:storage-location erc7201:slots.pending
    bytes32 private constant PENDING =
        0x023ee9066f3621eea0977361a106ad8381ddaa4680323fb13aa296d0d00f5c00;
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

    /// @dev The installed module: target, settings, and the scopes and fee
    ///      this slot copied from it.
    function _module() internal pure returns (InstalledModule storage $) {
        assembly ("memory-safe") {
            $.slot := MODULE
        }
    }

    /// @dev The terms queued for the next buy, and the bookkeeping about them.
    function _pending() internal pure returns (Pending storage $) {
        assembly ("memory-safe") {
            $.slot := PENDING
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
