// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED, MAX_PRICE, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

/**
 * @title SlotStorage
 * @notice Every storage variable a `Slot` has, in the only order they may ever
 *         appear in.
 *
 * @dev This contract exists to be the FIRST base of `Slot`, and that position
 *      is load-bearing. Solidity allocates base storage before a derived
 *      contract's own, so holding all state in the first base reproduces
 *      exactly the layout `Slot` had when it declared these inline:
 *      `recipient` at slot 0 through `policyProposedAt` at slot 24.
 *
 *      Every other base must therefore be storage-FREE, or namespaced under
 *      ERC-7201 as `SlotModules` is. One ordinary state variable added to any
 *      of them shifts all 237+ live proxies by a slot and destroys them.
 *
 *      The gate for any change here is `forge inspect Slot storage` being
 *      byte-identical before and after. Not "looks right" — identical.
 */
abstract contract SlotStorage is ISlotEvents, Initializable, ReentrancyGuard, Multicall {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MONTH = 30 days;

    /// @notice Gas stipend for reading a utility's advertised fee terms.
    /// @dev Two `staticcall`s in `_distributeTax` used to forward everything.
    ///      They run inside `collect`/`release`/`liquidate`, so an unbounded
    ///      read there let an untrusted head inflate the cost of eviction.
    ///      A fee lookup is two SLOADs of work; 100k is generous.
    uint256 internal constant FEE_READ_GAS = 100_000;

    /// @notice The safety bounds, re-exposed so clients can read them.
    /// @dev Values live at file level in `ISlot.sol` so `SlotFactory` enforces
    ///      the identical numbers at slot creation.
    function maxPrice() external pure returns (uint256) { return MAX_PRICE; }

    function maxTaxBps() external pure returns (uint256) { return MAX_TAX_BPS; }


    // ═══════════════════════════════════════════════════════════
    // STORAGE — KEEP ORDER, APPEND ONLY
    // ═══════════════════════════════════════════════════════════

    // --- Slot 0-2: identity (set in initialize, never changed) ---
    address public recipient; // slot 0
    IERC20 public currency; // slot 1, offset 0
    bool public mutableTax; // slot 1, offset 20
    bool public mutableUtility; // slot 1, offset 21
    bool public mutablePolicy; // slot 1, offset 22 — the OCCUPANCY policy
    address public manager; // slot 2

    // --- Slot 3+: mutable state ---
    address internal _occupant; // slot 3
    uint256 internal _price; // slot 4
    uint256 public taxPercentage; // slot 5
    address public utility; // slot 6
    uint256 public liquidationBountyBps; // slot 7
    uint256 public minDepositSeconds; // slot 8

    uint256 internal _deposit; // slot 9
    uint256 public lastSettled; // slot 10
    uint256 public collectedTax; // slot 11

    PendingUpdate public pendingUpdate; // slots 12-13

    /// @dev INERT — a hand-rolled init flag that `reinitializer` replaced.
    ///      Unreadable and unwritten, but packed with `factory` below, so it
    ///      cannot be dropped without moving that.
    bool internal _legacyInitialized; // slot 14, offset 0

    address public factory; // slot 14, offset 1 (PACKED with the flag above)

    address public occupancyPolicy; // slot 15, offset 0
    /// @dev INERT — held an epoch length when a buy could be deferred to a
    ///      clock boundary. Nothing reads it; `initialize` cannot set it and
    ///      `SlotFactory` rejects a non-zero value. Six slots still carry one.
    uint64 public epochSeconds; // slot 15, offset 20
    uint256 public occupiedSince; // slot 16

    // struct PendingPolicyUpdate — declared in interfaces/ISlot.sol
    PendingPolicyUpdate public pendingPolicyUpdate; // slot 17

    /// @dev INERT — held a committed-but-not-yet-effective transfer. Every
    ///      outstanding one was drained before the code that completed them was
    ///      removed, so all four slots are permanently zero.
    ///
    ///      Occupies slots 18-21: `buyer`+`effectiveAt` packed in slot 18,
    ///      `deposit` 19, `newPrice` 20, `pricePaid` 21. Deleting the field would
    ///      shift `isOperator` (22) and `withdrawableOf` (23) on every live proxy,
    ///      silently voiding operator approvals and unclaimed refunds. Guarded by
    ///      `test_StorageLayout_SurvivesDrainRemoval`.
    ///
    ///      struct PendingTransfer — declared in interfaces/ISlot.sol.
    PendingTransfer public pendingTransfer;

    /// @notice occupant => operator => approved. Keyed by occupant so approvals
    ///         survive leaving and re-entering, matching setApprovalForAll.
    mapping(address => mapping(address => bool)) public isOperator; // slot 22

    /// @notice Refunds that could not be pushed, claimable with `claim()`.
    /// @dev Escape hatch for a refund recipient the currency refuses to pay —
    ///      a USDC-style blocklist, a contract that reverts on receipt, a token
    ///      returning false. A refund that reverts would otherwise brick the
    ///      entry point that owes it — locking the outgoing occupant's deposit
    ///      and the price paid. Crediting instead keeps the slot fully
    ///      functional and the blocked party whole once they can receive again.
    mapping(address => uint256) public withdrawableOf; // slot 23

    /// @notice When each pending update was queued, as a unix timestamp.
    /// @dev Appended at the end of the layout, and all three packed into ONE
    ///      fresh slot. Slot 13 has ten spare bytes and could have held two of
    ///      them, but a third would have spilled into slot 14 and shifted every
    ///      variable after it on 237 live proxies. Not worth one slot of gas.
    ///
    ///      Cleared back to zero whenever the matching update applies or is
    ///      cancelled, so a non-zero value always means "pending since". The
    ///      converse does not hold: an update queued before this upgrade reads
    ///      zero while its `has*` flag is set. Read the pair, not the timestamp.
    uint64 public taxProposedAt; // slot 24, offset 0
    uint64 public utilityProposedAt; // slot 24, offset 8
    uint64 public policyProposedAt; // slot 24, offset 16

    /// @notice The current occupant.
    /// @dev Declared here, implemented in `SlotViews`. The modifiers below need
    ///      it and they have to live beside the state they guard, so the base
    ///      states the shape and a later mixin supplies the body.
    function occupant() public view virtual returns (address);

    /// @notice The current self-assessed price.
    /// @dev Declared here for the same reason as `occupant()` above: the
    ///      accounting layer needs it and sits below the views that define it.
    function price() public view virtual returns (uint256);

    /// @notice The occupant's remaining tax escrow.
    function deposit() public view virtual returns (uint256);

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    modifier onlyOccupant() {
        if (msg.sender != occupant()) revert NotOccupant();
        _;
    }

    /// @dev Uses occupant(), not raw _occupant, so an epoch boundary that has
    ///      passed but not yet been materialised still resolves approvals
    ///      against the correct (incoming) occupant.
    modifier onlyOccupantOrOperator() {
        address occ = occupant();
        if (msg.sender != occ && !isOperator[occ][msg.sender])
            revert NotOccupant();
        _;
    }

}
