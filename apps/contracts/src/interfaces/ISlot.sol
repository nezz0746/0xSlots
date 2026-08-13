// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ═══════════════════════════════════════════════════════════
// PROTOCOL EVENT TYPES (used by SlotFactory.emitEvent)
// ═══════════════════════════════════════════════════════════

uint8 constant EVT_BOUGHT = 1;
uint8 constant EVT_RELEASED = 2;
uint8 constant EVT_LIQUIDATED = 3;
uint8 constant EVT_PRICE_UPDATED = 4;
uint8 constant EVT_DEPOSITED = 5;
uint8 constant EVT_WITHDRAWN = 6;
uint8 constant EVT_TAX_COLLECTED = 7;
uint8 constant EVT_SETTLED = 8;

// ═══════════════════════════════════════════════════════════
// STRUCTS
// ═══════════════════════════════════════════════════════════

/// @notice Immutable identity config — determines CREATE2 address
/// @notice What, if anything, a manager may change after creation.
/// @dev Three independent flags because they gate three different kinds of
///      promise. `mutableUtility` covers the utility — what the slot
///      does. `mutablePolicy` covers the OCCUPANCY policy — whether forced sale
///      applies and on what terms. Someone may reasonably want a swappable ad
///      utility on immutable occupancy terms; conflating the two would make that
///      inexpressible, and would let a slot advertising "utility can change"
///      silently also reserve the right to change who can take it.
struct SlotConfig {
    bool mutableTax;
    bool mutableUtility;
    bool mutablePolicy;
    address manager; // address(0) if every flag is false
}

/// @notice Initial values set at creation
struct SlotInitParams {
    uint256 taxPercentage;        // basis points (100 = 1%)
    address utility;              // hook contract, address(0) for none
    uint256 liquidationBountyBps; // basis points, default 0
    uint256 minDepositSeconds;    // minimum deposit to cover N seconds of tax
    address occupancyPolicy;      // IOccupancyPolicy, address(0) for instant buy
}

/// @notice Complete slot state returned by getSlotInfo()
struct SlotInfo {
    // Identity (immutable)
    address recipient;
    address currency;
    address manager;
    bool mutableTax;
    bool mutableUtility;
    bool mutablePolicy;
    // State
    address occupant;
    uint256 price;
    uint256 taxPercentage;
    address utility;
    uint256 liquidationBountyBps;
    uint256 minDepositSeconds;
    // Financials (live-computed)
    uint256 deposit;
    uint256 collectedTax;
    uint256 taxOwed;
    /// @dev When tax was last charged. `taxOwed` accrues from here, and it is
    ///      the one financial fact a caller cannot derive from the others.
    uint256 lastSettled;
    uint256 secondsUntilLiquidation;
    bool insolvent;
    // Utility info (populated if utility != address(0))
    string utilityName;
    string utilityVersion;
    uint256 utilityFeeBps;
    address utilityFeeRecipient;
    string utilityURI;
    // Pending updates
    bool hasPendingTax;
    uint256 pendingTaxPercentage;
    bool hasPendingUtility;
    address pendingUtility;
    // Occupancy
    //
    // `epochSeconds` is deliberately absent. Six slots still carry a non-zero
    // value in storage, nothing reads it, and surfacing a delay that is not
    // applied would mislead rather than inform.
    address occupancyPolicy;
    uint256 occupiedSince;
    bool hasPendingPolicy;
    address pendingPolicy;
    // When each pending update was queued, as a unix timestamp.
    //
    // A buyer cannot tell a routine change queued last week from one timed
    // against the transaction they are about to send, and those deserve very
    // different treatment in a UI. The `has*` flags above say only THAT
    // something is pending; these say how long it has been true.
    //
    // Zero means nothing is pending for that kind — or, for the handful of
    // updates queued before this field existed, that the time is unknown.
    // Read them together with the matching `has*` flag to tell those apart.
    uint64 taxProposedAt;
    uint64 utilityProposedAt;
    uint64 policyProposedAt;
}

/// @notice Pending update for tax or utility (applied on next ownership transition)
struct PendingUpdate {
    uint256 newTaxPercentage;
    address newUtility;
    bool hasTaxUpdate;
    bool hasUtilityUpdate;
}

/// @notice A queued occupancy-policy swap, applied on the next transition.
/// @dev Its own struct rather than a field on `PendingUpdate` because it lands
///      at a different storage offset (see `Slot`), fixed on every live proxy.
///      The two fields pack into one slot.
struct PendingPolicyUpdate {
    address newPolicy;
    bool hasPolicyUpdate;
}

/// @notice INERT — a committed-but-not-yet-effective transfer, retained only to
///         hold its storage offsets.
/// @dev Every outstanding transfer was drained before the code that completed
///      them was removed, so all five fields are permanently zero on every live
///      proxy. The type cannot be dropped: doing so would shift `isOperator` and
///      `withdrawableOf` on every proxy, voiding operator approvals and unclaimed
///      refunds. Guarded by `test_StorageLayout_SurvivesDrainRemoval`. The field
///      order and packing (`buyer`+`effectiveAt` share one slot) are load-bearing
///      and must not change.
struct PendingTransfer {
    address buyer;
    uint96 effectiveAt;
    uint256 deposit;
    uint256 newPrice;
    uint256 pricePaid;
}

/// @notice Which of a slot's three governable dimensions a pending update targets.
/// @dev The storage behind them is still two structs — `PendingUpdate` carries
///      tax and utility, `PendingPolicyUpdate` carries policy — because those
///      offsets are fixed on every live proxy. This enum is the vocabulary the
///      API and the logs speak in, so callers address one dimension at a time
///      without knowing which struct it happens to live in.
///
///      A slot holds at most one pending update per kind: three in total,
///      last-write-wins within a kind. There is deliberately no queue — ordering
///      semantics and unbounded apply-time gas buy nothing here.
enum UpdateKind {
    Tax,
    Utility,
    Policy
}

// ═══════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════

interface ISlotEvents {
    event SlotCreated(
        address indexed slot,
        address indexed recipient,
        address indexed currency,
        SlotConfig config,
        SlotInitParams initParams
    );

    event Bought(
        address indexed buyer,
        address indexed previousOccupant,
        uint256 price,
        uint256 deposit,
        uint256 selfAssessedPrice
    );

    event Released(address indexed occupant, uint256 refund);

    event Liquidated(
        address indexed liquidator,
        address indexed occupant,
        uint256 bounty
    );

    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    event Deposited(address indexed depositor, uint256 amount);

    event Withdrawn(address indexed occupant, uint256 amount);

    event TaxCollected(address indexed recipient, uint256 amount);

    event ModuleFeePaid(address indexed utility, uint256 amount, uint256 feeBps);

    event Settled(uint256 taxOwed, uint256 taxPaid, uint256 depositRemaining);

    /// @notice Tax actually taken from an occupant's deposit, attributed to them.
    /// @dev `Settled` carries the same amounts but not WHO paid, so it cannot be
    ///      reduced into a per-address ledger. This can.
    ///
    ///      Emitted as a NEW event rather than by extending `Settled`, because
    ///      changing an existing event's signature changes its topic0 and would
    ///      split historical indexing across two shapes.
    ///
    ///      `taxPaid` is the number that matters for accounting: it is capped by
    ///      the remaining deposit, so it can be far less than `taxOwed` when an
    ///      occupant is going insolvent. Anything reconstructing contributions
    ///      from `price x time` computes `taxOwed` and will over-credit.
    ///
    ///      Gross of the utility fee, which is skimmed later in `_distributeTax`.
    event TaxPaid(
        address indexed occupant,
        uint256 taxOwed,
        uint256 taxPaid
    );

    event TaxUpdateProposed(uint256 newPercentage);

    event ModuleUpdateProposed(address newUtility);

    event PendingUpdateCancelled();

    event PendingUpdateApplied(uint256 newTaxPercentage, address newUtility);

    // ── per-kind pending-update log ──────────────────────────────
    //
    // One shape for all three dimensions, replacing five events that between
    // them could not answer "what is pending right now, and what changed".
    //
    // `PendingUpdateApplied` emits BOTH tax and utility on every apply, filling
    // in the current value for whichever did not change — so a reader cannot
    // tell "utility became X" from "utility was already X". `PendingUpdateCancelled`
    // carries nothing at all, and policy has its own separate pair. Reducing
    // that into per-slot pending state is not possible from the logs alone.
    //
    // Emitted ALONGSIDE the five originals rather than replacing them.
    // Changing an existing event's signature changes its topic0 and splits
    // historical indexing across two shapes — the same reasoning that made
    // `TaxPaid` a new event above.
    //
    // `value` is the proposed value widened to 32 bytes: the raw basis points
    // for `Tax`, the left-padded address for `Utility` and `Policy`.

    /// @notice A pending update was queued for `kind`, replacing any it held.
    event UpdateProposed(UpdateKind indexed kind, bytes32 value, uint64 proposedAt);

    /// @notice A pending update for `kind` was dropped without ever applying.
    event UpdateCancelled(UpdateKind indexed kind);

    /// @notice A pending update for `kind` took effect at an ownership transition.
    event UpdateApplied(UpdateKind indexed kind, bytes32 value);

    event LiquidationBountyUpdated(uint256 newBps);

    event ModuleCallFailed(string callbackName);

    event PolicyUpdateProposed(address newPolicy);

    event PolicyUpdateApplied(address newPolicy);

    event OperatorSet(address indexed occupant, address indexed operator, bool approved);

    /// @notice A refund could not be pushed and was credited for later `claim()`.
    event RefundCredited(address indexed account, uint256 amount);

    /// @notice A previously credited refund was claimed.
    event RefundClaimed(address indexed account, uint256 amount);
}
