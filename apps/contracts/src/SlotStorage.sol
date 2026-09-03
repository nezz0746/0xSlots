// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {SlotConstants} from "./SlotConstants.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {ISlot} from "./interfaces/ISlot.sol";
import "./SlotErrors.sol";

/**
 * @title SlotStorage
 * @notice Everything a slot remembers.
 *
 * @dev Slots run behind a beacon, so this layout is APPEND-ONLY once anything is
 *      live. Written fresh, with nothing inherited: no epoch machinery, no
 *      pending-transfer struct, no hand-rolled init flag, no liquidation bounty,
 *      no separate policy and utility addresses.
 *
 *      ── Grouped, with a reserved gap after each group ───────────────────
 *
 *      Append-only growth does not merely look untidy; it compounds. A field
 *      added three upgrades from now sits nowhere near what it configures, and
 *      the layout stops describing the design — which for a beacon
 *      implementation copied across every slot is a safety property, not a
 *      style one. `hookData` is the case in point: appended, it would land
 *      twelve slots from the `hook` it configures.
 *
 *      Each group therefore ends in a reserved gap, and a new field REPLACES
 *      gap space rather than being appended. It lands beside its neighbours and
 *      nothing below it moves.
 *
 *      The rule, and it is the whole rule: shrink the group's gap by EXACTLY
 *      the slots the new field occupies. A `bytes32` costs the gap one. A small
 *      value packed into a slot that already has room costs it nothing. Get it
 *      wrong and every group below shifts — which is why the per-chain layout
 *      records, not this comment, are what actually enforce it.
 *
 *      Gaps are fifty slots each. Sized to never be the reason a field goes to
 *      the end rather than beside its neighbours — an unwritten slot costs
 *      nothing to deploy and nothing to carry, so the only thing a small gap
 *      buys is the chance of running out, and the only thing a large one costs
 *      is address space there is no shortage of.
 *
 *      ── Why not ERC-7201 namespaces ─────────────────────────────────────
 *
 *      They solve the same problem permanently rather than by estimate, and
 *      cost a keccak constant plus an assembly accessor per group. The
 *      expensive part is that every `public` variable loses its generated
 *      getter, and there are more than a dozen here. Worth it if this grew
 *      several more concerns; not worth it for the shape below.
 */
abstract contract SlotStorage is
    ISlot,
    SlotConstants,
    Initializable,
    ReentrancyGuard,
    Multicall
{
    // ═══ terms ═══════════════════════════════════════════════════════════════
    //
    // What the slot IS, fixed at creation unless a mutability flag says
    // otherwise.

    address public recipient;
    bool public mutableTax;
    bool public mutableHook;
    IERC20 public currency;
    address public manager;
    uint256 public taxPercentage;
    uint256 public minDepositSeconds;

    uint256[50] private __gapTerms;

    // ═══ hooks ═══════════════════════════════════════════════════════════════
    //
    // The extension point and its configuration. `hookData` lives here, on the
    // slot, rather than in the hook — so the hook stays stateless and
    // `mutableHook == false` freezes both halves of the configuration.

    address public hook;
    uint8 internal _hookFlags;
    bytes32 public hookData;

    uint256[50] private __gapHooks;

    // ═══ occupancy ═══════════════════════════════════════════════════════════
    //
    // Who holds it, at what price, funded by how much.

    address internal _occupant;
    uint64 public occupiedSince;
    uint256 internal _price;
    uint256 internal _deposit;
    uint64 public tenureId;

    uint256[50] private __gapOccupancy;

    // ═══ economics ═══════════════════════════════════════════════════════════
    //
    // Tax owed, tax taken, and what could not be paid in either direction.

    uint256 public collectedTax;
    uint64 public lastSettled;
    mapping(address => uint256) public withdrawableOf;
    mapping(address => uint256) public arrearsOf;

    uint256[50] private __gapEconomics;

    // ═══ deferred changes ════════════════════════════════════════════════════
    //
    // Terms the manager has proposed, applied on the next occupancy transition
    // rather than immediately — so the terms an occupant bought into hold for
    // their whole tenure. `hook` and `hookData` travel together.

    struct Pending {
        uint256 taxPercentage;
        address hook;
        bool hasTax;
        bool hasHook;
        uint64 proposedAt;
        bytes32 hookData;
    }

    Pending public pending;

    uint256[50] private __gapPending;

    // ═══ delegation and orders ═══════════════════════════════════════════════
    //
    // Repricing delegated by the occupant, and the nonces that retire signed
    // sell orders.

    mapping(uint64 => mapping(address => bool)) internal _operatorOf;
    mapping(address => mapping(uint256 => bool)) public orderUsed;
    mapping(address => uint256) public orderNonce;

    uint256[50] private __gapOrders;

    // ═══════════════════════════════════════════════════════════════════════
    // APPEND BELOW THIS LINE ONLY.
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    modifier onlyOccupant() {
        if (msg.sender != _occupant) revert NotOccupant();
        _;
    }

    /// @notice Whether `operator` may act for the CURRENT occupant.
    /// @dev Lives here rather than in `Slot` because the modifier below is the
    ///      only enforcement point and reads nothing else.
    function isOperator(address operator) public view returns (bool) {
        return _occupant != address(0) && _operatorOf[tenureId][operator];
    }

    modifier onlyOccupantOrOperator() {
        if (msg.sender != _occupant && !isOperator(msg.sender))
            revert NotOccupantOrOperator();
        _;
    }
}
