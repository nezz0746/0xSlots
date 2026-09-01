// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import "./SlotErrors.sol";

// Ceiling on a self-assessed price.
// So `price * taxPercentage * elapsed` cannot be driven to overflow. That
//      product is computed on every settle, and every entry point settles
//      first — so an overflow there used to revert `liquidate()` and brick a
//      slot permanently, for the cost of gas. 2^128-1 is ~3.4e38, past any
//      real valuation in a token's smallest unit.
uint256 constant MAX_PRICE = type(uint128).max;

// Ceiling on the monthly rate, in basis points. The other factor in
//         that same product.
uint256 constant MAX_TAX_BPS = 10_000;

uint256 constant BASIS_POINTS = 10_000;
uint256 constant MONTH = 30 days;

// Gas handed to a hook's `after` callbacks.
// Bounded because these run inside `buy`, `sell`, `release` and
//      `liquidate`. A hook must never be able to price out an eviction.
uint256 constant HOOK_GAS = 500_000;

// Gas for a native payout before it degrades to a claimable credit.
// A native send runs the recipient's code, and this fires inside SOMEONE
//      ELSE'S transaction — a buy, a liquidation. Uncapped, an outgoing
//      occupant with a greedy `receive()` could make their own eviction
//      expensive and unreliable. 30k covers an EOA and a typical Safe.
uint256 constant PAYOUT_GAS = 30_000;

// How long a proposal must sit before an occupancy transition may apply it.
//
// Without this, `proposeTerms` in block N binds a buyer in block N: the
// manager watches the mempool, raises the tax, and the incoming occupant is
// seated on terms they never saw. The deferral to a transition was only ever
// half the guarantee; this is the other half, and it is what
// `pending.proposedAt` was recorded for and never used.
uint64 constant TERMS_DELAY = 1 days;

/**
 * @title SlotStorage
 * @notice Everything a slot remembers.
 *
 * @dev Slots run behind a beacon, so this layout is APPEND-ONLY once anything
 *      is live. It is written fresh here with nothing inherited: no epoch
 *      machinery, no pending-transfer struct, no hand-rolled init flag, no
 *      liquidation bounty, no separate policy and utility addresses. Each of
 *      those was a dead slot in the previous layout, and one of them —
 *      `pendingUpdate` being unextendable — forced a second pending struct to
 *      be bolted on at a different offset.
 *
 *      Packing is deliberate: the four addresses and three flags below occupy
 *      three slots rather than seven.
 */
abstract contract SlotStorage is
    Initializable,
    ReentrancyGuard,
    Multicall
{
    // ─── identity ───────────────────────────────────────────────────────────
    //
    // Declaration order is packing order in Solidity, so the small types sit
    // beside the addresses that leave 12 bytes spare rather than after them.
    // Grouped by what they mean where that is free, by what they fit next to
    // where it is not — each comment states the real offset.

    /// @notice Where tax goes.
    address public recipient; // slot 0, offset 0

    /// @notice Which of this slot's terms the manager may change.
    bool public mutableTax; // slot 0, offset 20
    bool public mutableHook; // slot 0, offset 21

    /// @notice The hook's declared subscriptions, snapshotted when it was set.
    /// @dev Snapshotted rather than re-read, so a hook cannot widen its own
    ///      reach mid-tenure and start spending an occupant's gas on callbacks
    ///      they never agreed to.
    uint8 internal _hookFlags; // slot 0, offset 22

    /// @notice The token tax and price are denominated in. Zero means native.
    IERC20 public currency; // slot 1, offset 0

    /// @notice When the current occupancy began. Zero when vacant.
    uint64 public occupiedSince; // slot 1, offset 20

    /// @notice May change what this slot allows. Zero on a fully immutable slot.
    address public manager; // slot 2, offset 0

    /// @notice Last time tax was realised out of the deposit.
    uint64 public lastSettled; // slot 2, offset 20

    /// @notice What holding this slot grants, and who may take it. One address
    ///         for both — see ISlotHook.
    address public hook; // slot 3, offset 0

    /// @notice Which tenure is current. Increments every time somebody is
    ///         seated, and never repeats.
    /// @dev A counter rather than `occupiedSince`, because two tenures can
    ///      share a timestamp — release and reseat in one block — and an
    ///      identity that collides is not an identity. It rides in `hook`'s
    ///      spare 12 bytes, so it costs no storage slot.
    uint64 public tenureId; // slot 3, offset 20

    // ─── occupancy ──────────────────────────────────────────────────────────

    address internal _occupant; // slot 4
    uint256 internal _price; // slot 5
    uint256 internal _deposit; // slot 6

    // ─── economics ──────────────────────────────────────────────────────────

    /// @notice Basis points per 30 days.
    uint256 public taxPercentage; // slot 7

    /// @notice Tax taken from deposits and not yet flushed to `recipient`.
    uint256 public collectedTax; // slot 8

    /// @notice Minimum runway, in seconds, a buyer must fund.
    /// @dev Zero is legal and means "no minimum". Note it also removes the
    ///      multiplication in `_minDepositFor`, which is the only thing that
    ///      would reject an absurd price early — `MAX_PRICE` is what actually
    ///      guards the arithmetic. This is a product choice, not a safety one.
    uint256 public minDepositSeconds; // slot 9

    // ─── deferred changes ───────────────────────────────────────────────────

    /// @notice Terms proposed by the manager, applied on the next occupancy
    ///         transition rather than immediately.
    /// @dev The deferral is the occupant's guarantee: the terms they bought
    ///      into hold for their whole tenure. One struct covers both
    ///      dimensions. Its predecessor could not be extended without moving
    ///      every variable after it, so a second pending struct had to be
    ///      bolted on at a different offset — the shape below exists so that
    ///      cannot happen again.
    struct Pending {
        uint256 taxPercentage; // struct slot 0
        address hook; // struct slot 1, offset 0
        bool hasTax; // struct slot 1, offset 20
        bool hasHook; // struct slot 1, offset 21
        uint64 proposedAt; // struct slot 1, offset 22
    }

    Pending public pending; // slots 10-11

    // ─── payouts and delegation ─────────────────────────────────────────────

    /// @notice Owed to an address that could not be paid directly.
    /// @dev Every payout pushes and falls back to crediting here. `recipient`
    ///      is chosen at creation and never validated beyond being non-zero, so
    ///      a contract that reverts on receipt — or a blocklisting currency —
    ///      would otherwise make every path that flushes tax revert forever,
    ///      and an insolvent occupant could neither be removed nor leave.
    ///      Crediting is what keeps liquidation unconditional.
    mapping(address => uint256) public withdrawableOf; // slot 12

    /// @notice Addresses the occupant has delegated repricing to.
    /// @dev Keyed by tenure, so an approval expires with the tenure that gave
    ///      it. Read it through `isOperator`.
    mapping(uint64 => mapping(address => bool)) internal _operatorOf; // slot 13

    // ─── signed sell orders ─────────────────────────────────────────────────

    /// @notice buyer => nonce => consumed.
    /// @dev Burned when an order executes, which is what makes a filled order
    ///      dead everywhere it was published rather than merely hidden while
    ///      its author happens to occupy the slot.
    mapping(address => mapping(uint256 => bool)) public orderUsed; // slot 14

    /// @notice buyer => next unused nonce.
    mapping(address => uint256) public orderNonce; // slot 15

    /// @notice Tax an occupancy could not pay, carried rather than forgiven.
    /// @dev `_settle` can only take what the deposit holds. The remainder used
    ///      to be dropped on the floor, which made defaulting cheaper than
    ///      paying: run the deposit dry, then retake the vacated seat at
    ///      vacancy pricing with the arrears gone. Recorded here and charged on
    ///      re-entry, so the seat costs the same whether you left it politely
    ///      or were evicted from it.
    mapping(address => uint256) public arrearsOf; // slot 16

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
