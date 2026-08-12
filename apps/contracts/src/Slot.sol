// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUtility} from "./interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "./interfaces/IOccupancyPolicy.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED} from "./interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "./interfaces/SlotErrors.sol";
import {SlotFactory} from "./SlotFactory.sol";

/// @title Slot — Immutable & modular Harberger-taxed slot
/// @notice One slot = one contract. Deployed deterministically via SlotFactory.
///
/// @dev All slots share one implementation behind a beacon, so the storage
///      layout below is APPEND-ONLY and permanent: 237 live proxies hold state
///      at these exact offsets. Some of it is inert. It still cannot move.
///
///      Versioning lives in `reinitializer(n)` and nowhere else — not in
///      function names, not in comments. The history of how the layout got this
///      way is in git; what the chain still depends on is here.
contract Slot is ISlotEvents, Initializable, ReentrancyGuard, Multicall {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MONTH = 30 days;

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
    address private _occupant; // slot 3
    uint256 private _price; // slot 4
    uint256 public taxPercentage; // slot 5
    address public utility; // slot 6
    uint256 public liquidationBountyBps; // slot 7
    uint256 public minDepositSeconds; // slot 8

    uint256 private _deposit; // slot 9
    uint256 public lastSettled; // slot 10
    uint256 public collectedTax; // slot 11

    PendingUpdate public pendingUpdate; // slots 12-13

    /// @dev INERT — a hand-rolled init flag that `reinitializer` replaced.
    ///      Unreadable and unwritten, but packed with `factory` below, so it
    ///      cannot be dropped without moving that.
    bool private _legacyInitialized; // slot 14, offset 0

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

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Set up a slot. Called by `SlotFactory` in the proxy constructor.
    /// @dev The only initializer, and the only place a slot's terms are set.
    ///      Everything arrives at once — recipient, currency, tax, utility,
    ///      occupancy policy, factory — so there is no window in which a slot
    ///      exists half-configured and no version to track.
    ///
    ///      A slot's policy is therefore part of its founding terms. One created
    ///      without a policy is a plain-Harberger slot; it can still gain one
    ///      later through `proposePolicyUpdate`, but only if its creator chose
    ///      mutability. Nobody can install one retroactively over that choice.
    function initialize(
        address _recipient,
        IERC20 _currency,
        SlotConfig memory _config,
        SlotInitParams memory _init,
        address _factory
    ) external initializer {
        if (_recipient == address(0)) revert InvalidRecipient();
        // `address(0)` is the native-ETH sentinel — deliberately valid. Any
        // other address must actually be a contract: a codeless non-zero
        // currency used to pass this check and produce a slot whose every
        // transfer silently no-ops.
        if (
            address(_currency) != address(0) &&
            address(_currency).code.length == 0
        ) revert InvalidCurrency();
        if (_init.taxPercentage == 0) revert InvalidTaxPercentage();
        if (_init.liquidationBountyBps > BASIS_POINTS)
            revert InvalidLiquidationBounty();
        if (
            _init.occupancyPolicy != address(0) &&
            _init.occupancyPolicy.code.length == 0
        ) revert InvalidModule_NoCode();

        recipient = _recipient;
        currency = _currency;
        mutableTax = _config.mutableTax;
        mutableUtility = _config.mutableUtility;
        mutablePolicy = _config.mutablePolicy;
        manager = _config.manager;

        taxPercentage = _init.taxPercentage;
        utility = _init.utility;
        liquidationBountyBps = _init.liquidationBountyBps;
        minDepositSeconds = _init.minDepositSeconds;
        occupancyPolicy = _init.occupancyPolicy;

        factory = _factory;
        lastSettled = block.timestamp;
    }

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

    // ═══════════════════════════════════════════════════════════
    // CORE
    // ═══════════════════════════════════════════════════════════

    /// @notice Buy the slot. `account` becomes the new occupant, `msg.sender` pays.
    /// @param account The address that will occupy the slot
    /// @param depositAmount Deposit to fund the tax escrow
    /// @param selfAssessedPrice The new self-assessed price
    function buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) external payable nonReentrant {
        if (selfAssessedPrice == 0) revert InvalidPrice();
        if (account == address(0)) revert InvalidRecipient();

        // Fails fast: the ERC-20 case needs no computed amount, and letting a
        // stray-value call run the policy check first would only waste gas.
        if (!_isNative() && msg.value != 0) revert InvalidValue();

        // Settle first so the policy is asked about current, not stale, state.
        // Stage 2 relies on this ordering too — see Task 6.
        _settle();

        if (account == _occupant) revert CannotBuyFromYourself();

        if (occupancyPolicy != address(0)) {
            IOccupancyPolicy(occupancyPolicy).checkBuy(
                _occupancyCtx(account, selfAssessedPrice, depositAmount)
            );
        }

        uint256 currentPrice = _price;
        address prev = _occupant;

        _applyPendingUpdates();

        _enforceMinDeposit(depositAmount, selfAssessedPrice);

        // Pull what the buyer owes. Vacant slots cost only the deposit.
        uint256 owedByBuyer = prev == address(0)
            ? depositAmount
            : currentPrice + depositAmount;
        if (_isNative()) {
            // The value is already held by this contract; there is nothing to
            // pull. This check cannot move to the top of the function because
            // `owedByBuyer` is only known after `_settle()` and the policy.
            if (msg.value != owedByBuyer) revert InvalidValue();
        } else if (owedByBuyer > 0) {
            currency.safeTransferFrom(msg.sender, address(this), owedByBuyer);
        }

        // Epoch scheduling was removed here. A buy used to be deferred to the
        // next clock boundary when `epochSeconds > 0`, on the theory that it
        // stopped an occupant being sniped by whoever's infrastructure was
        // fastest. It did not: the first commit after a boundary locked
        // everyone else out until the next one, so a two-second latency edge
        // bought a full epoch of exclusivity at a price fixed before that
        // epoch's news — a worse dynamic than the one it replaced.
        //
        // Occupancy timing now lives entirely in IOccupancyPolicy vetoes, which
        // is where it can be expressed without a second phase — MinimumTenure
        // for "not yet", MinimumPrice for "not below this".
        //
        // A buy applies immediately. Timing lives in IOccupancyPolicy vetoes,
        // which express it without a second phase — MinimumTenure for "not
        // yet", MinimumPrice for "not below this".

        // Refund the outgoing occupant. Computed here, paid
        // after the state writes, and never allowed to revert: an outgoing
        // occupant the currency refuses to pay must not be able to veto their
        // own forced sale.
        uint256 refund = prev == address(0) ? 0 : _deposit + currentPrice;

        _occupant = account;
        _price = selfAssessedPrice;
        _deposit = depositAmount;
        occupiedSince = block.timestamp;
        lastSettled = block.timestamp;

        if (refund > 0) _payOrCredit(prev, refund);

        _notifyUtility(
            "onTransfer",
            abi.encodeCall(IUtility.onTransfer, (0, prev, account))
        );

        emit Bought(
            account,
            prev,
            currentPrice,
            depositAmount,
            selfAssessedPrice
        );
        _emitProtocolEvent(
            EVT_BOUGHT,
            abi.encode(
                account,
                prev,
                currentPrice,
                depositAmount,
                selfAssessedPrice
            )
        );
    }

    /// @notice Occupant releases the slot (voluntary exit)
    function release() external nonReentrant onlyOccupant {
        _settle();

        address prev = _occupant;
        uint256 refund = _deposit;

        // Flush collected tax to recipient. Routed through `_distributeTax` so
        // a utility fee is honoured here exactly as it is in `collect()` and
        // `liquidate()` — a voluntary exit is not a fee holiday.
        uint256 pendingTax = collectedTax;
        if (pendingTax > 0) {
            collectedTax = 0;
            _distributeTax(pendingTax);
        }

        // Clear slot
        _occupant = address(0);
        _price = 0;
        occupiedSince = 0;
        _deposit = 0;
        lastSettled = block.timestamp;

        // Apply pending updates (slot is now vacant)
        _applyPendingUpdates();

        if (refund > 0) _payOrCredit(prev, refund);

        _notifyUtility(
            "onRelease",
            abi.encodeCall(IUtility.onRelease, (0, prev))
        );

        emit Released(prev, refund);
        _emitProtocolEvent(EVT_RELEASED, abi.encode(prev, refund));
    }

    /// @notice Delegate slot management to an operator (e.g. an agent).
    /// @dev Operators may selfAssess and topUp. They may NOT withdraw or
    ///      release — those move the position's principal and stay
    ///      occupant-only. Bounded authority is the point.
    function setOperator(address operator, bool approved) external {
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    /// @notice Occupant (or an approved operator) self-assesses a new price
    function selfAssess(
        uint256 newPrice
    ) external nonReentrant onlyOccupantOrOperator {
        if (newPrice == 0) revert InvalidPrice();

        // Settle first: materialises any matured transfer, so the guard below
        // only rejects a genuinely still-pending one and the policy sees
        // current state.
        _settle();

        if (occupancyPolicy != address(0)) {
            IOccupancyPolicy(occupancyPolicy).checkPriceUpdate(
                _occupancyCtx(occupant(), newPrice, deposit())
            );
        }

        uint256 oldPrice = _price;
        _price = newPrice;

        // Ensure remaining deposit still meets minimum after price change
        _enforceMinDepositExisting(newPrice);

        _notifyUtility(
            "onPriceUpdate",
            abi.encodeCall(IUtility.onPriceUpdate, (0, oldPrice, newPrice))
        );

        emit PriceUpdated(oldPrice, newPrice);
        _emitProtocolEvent(EVT_PRICE_UPDATED, abi.encode(oldPrice, newPrice));
    }

    // ═══════════════════════════════════════════════════════════
    // ESCROW
    // ═══════════════════════════════════════════════════════════

    /// @notice Top up the occupant's deposit. Anyone can pay.
    /// @dev Gates on the RESOLVING `occupant()`, not raw `_occupant`. On an
    ///      epoch slot a matured-but-unmaterialised transfer leaves
    ///      `_occupant` stale (possibly address(0), when the slot was bought
    ///      out of vacancy), so a raw read would refuse to fund an occupancy
    ///      that every getter already reports as live.
    function topUp(uint256 amount) external payable nonReentrant {
        if (occupant() == address(0)) revert NotOccupant();
        if (msg.value != (_isNative() ? amount : 0)) revert InvalidValue();
        _settle();
        if (!_isNative()) {
            currency.safeTransferFrom(msg.sender, address(this), amount);
        }
        _deposit += amount;
        emit Deposited(msg.sender, amount);
        _emitProtocolEvent(EVT_DEPOSITED, abi.encode(msg.sender, amount));
    }

    /// @notice Occupant withdraws excess deposit
    function withdraw(uint256 amount) external nonReentrant onlyOccupant {
        _settle();
        if (amount > _deposit) revert InsufficientDeposit();

        uint256 remaining = _deposit - amount;
        uint256 minDep = _minDepositFor(_price);
        if (remaining < minDep) revert InsufficientDeposit();

        _deposit = remaining;
        // Uncapped and revert-on-failure: this is caller-initiated, so a
        // failure affects only the caller. It is also what makes the 30k cap
        // in `_payOrCredit` safe — a recipient too gas-hungry for the capped
        // push is credited, then collects here with all the gas it needs.
        if (_isNative()) {
            (bool ok, ) = msg.sender.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            currency.safeTransfer(msg.sender, amount);
        }
        emit Withdrawn(msg.sender, amount);
        _emitProtocolEvent(EVT_WITHDRAWN, abi.encode(msg.sender, amount));
    }

    /// @notice Liquidate an insolvent occupant
    /// @dev Gates on the RESOLVING `occupant()`. Reading raw `_occupant` here
    ///      made a whole class of occupancy unliquidatable: buying a VACANT
    ///      epoch slot with `minDepositSeconds == 0` and a zero deposit leaves
    ///      `_occupant == address(0)` behind a pending transfer, so past the
    ///      boundary `isInsolvent()` was true while `liquidate()` still
    ///      reverted NotInsolvent — a free, unremovable occupancy. The spec's
    ///      first invariant is that liquidation is never vetoable: insolvency
    ///      always ends occupancy.
    function liquidate() external nonReentrant {
        if (occupant() == address(0)) revert NotInsolvent();
        _settle();
        if (_deposit > 0) revert NotInsolvent();

        // Read AFTER _settle(): materialisation has by now written the
        // incoming buyer into `_occupant`, which is who is being liquidated.
        address prev = _occupant;

        // Calculate bounty from collected tax
        uint256 bounty = 0;
        if (liquidationBountyBps > 0 && collectedTax > 0) {
            bounty = (collectedTax * liquidationBountyBps) / BASIS_POINTS;
            collectedTax -= bounty;
        }

        // Flush remaining collected tax to recipient (minus utility fee if any)
        uint256 remainingTax = collectedTax;
        if (remainingTax > 0) {
            collectedTax = 0;
            _distributeTax(remainingTax);
        }

        // Clear slot
        _occupant = address(0);
        _price = 0;
        occupiedSince = 0;
        lastSettled = block.timestamp;

        // Apply pending updates
        _applyPendingUpdates();

        // Pay bounty. Credited rather than pushed for the same reason as the
        // tax legs: a liquidator the currency refuses must not be able to fail
        // the liquidation itself.
        if (bounty > 0) _payOrCredit(msg.sender, bounty);

        _notifyUtility(
            "onRelease",
            abi.encodeCall(IUtility.onRelease, (0, prev))
        );

        emit Liquidated(msg.sender, prev, bounty);
        _emitProtocolEvent(
            EVT_LIQUIDATED,
            abi.encode(msg.sender, prev, bounty)
        );
    }

    /// @notice Withdraw a refund that could not be pushed at the time.
    /// @dev Permissionless in who may CALL it, but the funds always go to
    ///      `account` — a keeper or the account itself can trigger it, nobody
    ///      can redirect it.
    function claim(address account) external nonReentrant {
        uint256 amount = withdrawableOf[account];
        if (amount == 0) revert NothingToClaim();
        withdrawableOf[account] = 0;
        if (_isNative()) {
            (bool ok, ) = account.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            currency.safeTransfer(account, amount);
        }
        emit RefundClaimed(account, amount);
    }

    /// @notice Flush accumulated tax to recipient (minus utility fee if any)
    function collect() external nonReentrant {
        _settle();
        uint256 amount = collectedTax;
        if (amount == 0) revert NothingToCollect();
        collectedTax = 0;
        _distributeTax(amount);
        emit TaxCollected(recipient, amount);
        _emitProtocolEvent(EVT_TAX_COLLECTED, abi.encode(recipient, amount));
    }

    // ═══════════════════════════════════════════════════════════
    // MANAGER: PENDING UPDATES
    // ═══════════════════════════════════════════════════════════

    /// @notice Propose a new tax rate (applied on next ownership transition)
    function proposeTaxUpdate(uint256 newPct) external onlyManager {
        if (!mutableTax) revert TaxNotMutable();
        if (newPct == 0) revert InvalidTaxPercentage();

        pendingUpdate.newTaxPercentage = newPct;
        pendingUpdate.hasTaxUpdate = true;
        taxProposedAt = uint64(block.timestamp);

        emit TaxUpdateProposed(newPct);
        emit UpdateProposed(
            UpdateKind.Tax,
            bytes32(newPct),
            uint64(block.timestamp)
        );
    }

    /// @notice Propose a new utility (applied on next ownership transition)
    function proposeUtilityUpdate(address newUtility) public onlyManager {
        if (!mutableUtility) revert ModuleNotMutable();
        if (newUtility != address(0) && newUtility.code.length == 0)
            revert InvalidModule_NoCode();

        pendingUpdate.newUtility = newUtility;
        pendingUpdate.hasUtilityUpdate = true;
        utilityProposedAt = uint64(block.timestamp);

        emit ModuleUpdateProposed(newUtility);
        emit UpdateProposed(
            UpdateKind.Utility,
            _asValue(newUtility),
            uint64(block.timestamp)
        );
    }

    /// @notice Deprecated name for `proposeUtilityUpdate`. Kept so the selector
    ///         deployed callers hold keeps working across the upgrade.
    function proposeModuleUpdate(address newUtility) external {
        proposeUtilityUpdate(newUtility);
    }

    /// @notice Propose a new occupancy policy (applied on next ownership transition)
    /// @dev Gated on `mutablePolicy`, NOT `mutableUtility`. Swapping what a slot
    ///      does and swapping whether it can be taken from you are different
    ///      promises, and a holder who accepted the first has not accepted the
    ///      second.
    function proposePolicyUpdate(address newPolicy) external onlyManager {
        if (!mutablePolicy) revert PolicyNotMutable();
        if (newPolicy != address(0) && newPolicy.code.length == 0)
            revert InvalidModule_NoCode();
        pendingPolicyUpdate.newPolicy = newPolicy;
        pendingPolicyUpdate.hasPolicyUpdate = true;
        policyProposedAt = uint64(block.timestamp);

        emit PolicyUpdateProposed(newPolicy);
        emit UpdateProposed(
            UpdateKind.Policy,
            _asValue(newPolicy),
            uint64(block.timestamp)
        );
    }

    /// @notice Cancel the pending update for ONE dimension, leaving the others.
    ///
    /// @dev The reason this exists is `SlotManager`, where tax, utility and
    ///      policy are three separate roles. While cancelling was all-or-nothing
    ///      the manager had to gate it on `DEFAULT_ADMIN_ROLE` — a tax manager
    ///      retracting their own proposal would otherwise have destroyed the
    ///      policy manager's queued one. So a role holder could propose but not
    ///      take it back, and the only address that could was the one the role
    ///      split exists to avoid needing.
    ///
    ///      Gated on the same mutability flag as the matching `propose`. That is
    ///      belt-and-braces — an immutable dimension can never hold a pending
    ///      update to cancel — but it keeps one rule per dimension rather than
    ///      two, so a future flag change cannot leave the pair disagreeing.
    function cancelPendingUpdate(UpdateKind kind) external onlyManager {
        if (kind == UpdateKind.Tax) {
            if (!mutableTax) revert TaxNotMutable();
            if (!pendingUpdate.hasTaxUpdate) revert NoPendingUpdate();
            pendingUpdate.newTaxPercentage = 0;
            pendingUpdate.hasTaxUpdate = false;
            taxProposedAt = 0;
        } else if (kind == UpdateKind.Utility) {
            if (!mutableUtility) revert ModuleNotMutable();
            if (!pendingUpdate.hasUtilityUpdate) revert NoPendingUpdate();
            pendingUpdate.newUtility = address(0);
            pendingUpdate.hasUtilityUpdate = false;
            utilityProposedAt = 0;
        } else {
            if (!mutablePolicy) revert PolicyNotMutable();
            if (!pendingPolicyUpdate.hasPolicyUpdate) revert NoPendingUpdate();
            delete pendingPolicyUpdate;
            policyProposedAt = 0;
        }

        emit UpdateCancelled(kind);
    }

    /// @notice Cancel every pending update at once.
    /// @dev Kept as the blunt instrument beside `cancelPendingUpdate`. Emits a
    ///      per-kind `UpdateCancelled` for each one it actually drops, so an
    ///      indexer following only the per-kind log never misses a clear.
    function cancelPendingUpdates() external onlyManager {
        bool hadTax = pendingUpdate.hasTaxUpdate;
        bool hadUtility = pendingUpdate.hasUtilityUpdate;
        bool hadPolicy = pendingPolicyUpdate.hasPolicyUpdate;

        if (!hadTax && !hadUtility && !hadPolicy) revert NoPendingUpdate();

        delete pendingUpdate;
        delete pendingPolicyUpdate;
        taxProposedAt = 0;
        utilityProposedAt = 0;
        policyProposedAt = 0;

        if (hadTax) emit UpdateCancelled(UpdateKind.Tax);
        if (hadUtility) emit UpdateCancelled(UpdateKind.Utility);
        if (hadPolicy) emit UpdateCancelled(UpdateKind.Policy);

        emit PendingUpdateCancelled();
    }

    /// @notice Update liquidation bounty (immediate, doesn't affect current occupant terms)
    function setLiquidationBounty(uint256 newBps) external onlyManager {
        if (newBps > BASIS_POINTS) revert InvalidLiquidationBounty();
        liquidationBountyBps = newBps;
        emit LiquidationBountyUpdated(newBps);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════

    /// @notice Current occupant. Hand-written rather than an auto-getter
    ///         because `_occupant` is internal.
    function occupant() public view returns (address) {
        return _occupant;
    }

    function price() public view returns (uint256) {
        return _price;
    }

    function deposit() public view returns (uint256) {
        return _deposit;
    }

    function taxOwed() public view returns (uint256) {
        address occ = occupant();
        if (occ == address(0)) return 0;
        uint256 elapsed = block.timestamp - lastSettled;
        return (price() * taxPercentage * elapsed) / (MONTH * BASIS_POINTS);
    }

    function secondsUntilLiquidation() public view returns (uint256) {
        if (occupant() == address(0)) return type(uint256).max;
        uint256 owed = taxOwed();
        uint256 dep = deposit();
        uint256 remaining = dep > owed ? dep - owed : 0;
        uint256 taxNumerator = price() * taxPercentage;
        if (taxNumerator == 0) return type(uint256).max;
        return (remaining * MONTH * BASIS_POINTS) / taxNumerator;
    }

    function isInsolvent() public view returns (bool) {
        if (occupant() == address(0)) return false;
        return taxOwed() >= deposit();
    }

    function isVacant() public view returns (bool) {
        return occupant() == address(0);
    }

    function getPendingUpdate() external view returns (PendingUpdate memory) {
        return pendingUpdate;
    }

    /// @notice The pending update for one dimension, in the shape the per-kind
    ///         events use.
    /// @dev Reaches across both storage structs so a caller can ask about any
    ///      kind uniformly. `getPendingUpdate()` still returns the raw
    ///      tax-and-utility struct and has no policy equivalent — this is the
    ///      one that covers all three.
    /// @return isSet Whether anything is queued for `kind`.
    /// @return value The proposed value: raw basis points for `Tax`, the
    ///         left-padded address for `Utility` and `Policy`.
    /// @return proposedAt When it was queued. Zero with `isSet` true means it
    ///         predates the timestamp being recorded.
    function pendingUpdateOf(
        UpdateKind kind
    ) external view returns (bool isSet, bytes32 value, uint64 proposedAt) {
        if (kind == UpdateKind.Tax) {
            return (
                pendingUpdate.hasTaxUpdate,
                bytes32(pendingUpdate.newTaxPercentage),
                taxProposedAt
            );
        }
        if (kind == UpdateKind.Utility) {
            return (
                pendingUpdate.hasUtilityUpdate,
                _asValue(pendingUpdate.newUtility),
                utilityProposedAt
            );
        }
        return (
            pendingPolicyUpdate.hasPolicyUpdate,
            _asValue(pendingPolicyUpdate.newPolicy),
            policyProposedAt
        );
    }

    // ── deprecated getters ──────────────────────────────────────
    // The storage moved to clearer names (`utility`, `mutableUtility`); these
    // keep the selectors that deployed callers and old ABIs hold. Remove in
    // the next major version.

    /// @notice Deprecated name for `utility()`.
    function module() external view returns (address) {
        return utility;
    }

    /// @notice Deprecated name for `mutableUtility()`.
    function mutableModule() external view returns (bool) {
        return mutableUtility;
    }

    /// @notice Returns complete slot state in a single call
    function getSlotInfo() external view returns (SlotInfo memory info) {
        info.recipient = recipient;
        info.currency = address(currency);
        info.manager = manager;
        info.mutableTax = mutableTax;
        info.mutableUtility = mutableUtility;
        info.mutablePolicy = mutablePolicy;

        info.occupant = occupant();
        info.price = price();
        info.taxPercentage = taxPercentage;
        info.utility = utility;
        info.liquidationBountyBps = liquidationBountyBps;
        info.minDepositSeconds = minDepositSeconds;

        info.deposit = deposit();
        info.collectedTax = collectedTax;
        info.taxOwed = taxOwed();
        info.lastSettled = lastSettled;
        info.secondsUntilLiquidation = secondsUntilLiquidation();
        info.insolvent = isInsolvent();

        // Utility info — guard with code-size check to avoid reverts when
        // the utility address has no deployed code (try/catch does not catch
        // ABI-decode failures from empty returndata).
        if (utility != address(0) && utility.code.length > 0) {
            IUtility mod = IUtility(utility);
            try mod.name() returns (string memory n) {
                info.utilityName = n;
            } catch {}
            try mod.version() returns (string memory v) {
                info.utilityVersion = v;
            } catch {}
            try mod.feeBps() returns (uint256 f) {
                info.utilityFeeBps = f;
            } catch {}
            try mod.feeRecipient() returns (address r) {
                info.utilityFeeRecipient = r;
            } catch {}
            try mod.moduleURI() returns (string memory u) {
                info.utilityURI = u;
            } catch {}
        }

        info.hasPendingTax = pendingUpdate.hasTaxUpdate;
        info.pendingTaxPercentage = pendingUpdate.newTaxPercentage;
        info.hasPendingUtility = pendingUpdate.hasUtilityUpdate;
        info.pendingUtility = pendingUpdate.newUtility;

        info.occupancyPolicy = occupancyPolicy;
        info.occupiedSince = occupiedSince;
        info.hasPendingPolicy = pendingPolicyUpdate.hasPolicyUpdate;
        info.pendingPolicy = pendingPolicyUpdate.newPolicy;

        info.taxProposedAt = taxProposedAt;
        info.utilityProposedAt = utilityProposedAt;
        info.policyProposedAt = policyProposedAt;
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _occupancyCtx(
        address account,
        uint256 newPrice,
        uint256 depositAmount
    ) internal view returns (OccupancyContext memory) {
        return
            OccupancyContext({
                slot: address(this),
                caller: msg.sender,
                account: account,
                occupant: occupant(),
                occupiedSince: occupiedSince,
                taxPercentage: taxPercentage,
                currentPrice: price(),
                newPrice: newPrice,
                depositAmount: depositAmount
            });
    }

    /// @dev Accrue tax for the current occupant up to `upTo`.
    function _accrue(uint256 upTo) internal {
        if (upTo <= lastSettled) return;

        if (_occupant == address(0)) {
            lastSettled = upTo;
            return;
        }

        uint256 elapsed = upTo - lastSettled;
        uint256 owed = (_price * taxPercentage * elapsed) /
            (MONTH * BASIS_POINTS);

        uint256 paid;
        if (owed >= _deposit) {
            paid = _deposit;
            collectedTax += _deposit;
            _deposit = 0;
        } else {
            paid = owed;
            _deposit -= owed;
            collectedTax += owed;
        }
        lastSettled = upTo;

        emit Settled(owed, paid, _deposit);

        if (paid > 0) {
            // Attributed to `_occupant`, which is still the payer here: every
            // entry point calls `_settle()` before it reassigns occupancy, so
            // a buy charges the OUTGOING occupant for their own tenure.
            address payer = _occupant;
            emit TaxPaid(payer, owed, paid);
            _notifyUtility(
                "onSettle",
                abi.encodeCall(IUtility.onSettle, (0, payer, owed, paid))
            );
        }
    }

    function _settle() internal {
        _accrue(block.timestamp);
    }

    function _applyPendingUpdates() internal {
        if (pendingPolicyUpdate.hasPolicyUpdate) {
            address newPolicy = pendingPolicyUpdate.newPolicy;
            occupancyPolicy = newPolicy;
            delete pendingPolicyUpdate;
            policyProposedAt = 0;
            emit PolicyUpdateApplied(newPolicy);
            emit UpdateApplied(UpdateKind.Policy, _asValue(newPolicy));
        }

        if (!pendingUpdate.hasTaxUpdate && !pendingUpdate.hasUtilityUpdate)
            return;

        uint256 newTax = taxPercentage;
        address newMod = utility;

        // The per-kind events fire only for what actually changed, which is the
        // distinction `PendingUpdateApplied` cannot draw: it carries both
        // fields on every apply, filling the unchanged one in from current
        // state, so a reader sees a utility "change" to the value it already
        // had. Both are emitted — the flat one for existing indexers, the
        // per-kind ones for anything that needs to know what moved.
        if (pendingUpdate.hasTaxUpdate) {
            newTax = pendingUpdate.newTaxPercentage;
            taxPercentage = newTax;
            taxProposedAt = 0;
            emit UpdateApplied(UpdateKind.Tax, bytes32(newTax));
        }
        if (pendingUpdate.hasUtilityUpdate) {
            newMod = pendingUpdate.newUtility;
            utility = newMod;
            utilityProposedAt = 0;
            emit UpdateApplied(UpdateKind.Utility, _asValue(newMod));
        }

        delete pendingUpdate;

        emit PendingUpdateApplied(newTax, newMod);
    }

    /// @dev Widens an address to the `bytes32` the per-kind events carry, so
    ///      one event shape can describe a rate and two contract addresses.
    function _asValue(address a) private pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    function _minDepositFor(uint256 price_) internal view returns (uint256) {
        if (minDepositSeconds == 0) return 0;
        return
            Math.ceilDiv(
                price_ * taxPercentage * minDepositSeconds,
                MONTH * BASIS_POINTS
            );
    }

    function _enforceMinDeposit(
        uint256 depositAmount,
        uint256 price_
    ) internal view {
        uint256 minDep = _minDepositFor(price_);
        if (depositAmount < minDep) revert InsufficientDeposit();
    }

    function _enforceMinDepositExisting(uint256 price_) internal view {
        uint256 minDep = _minDepositFor(price_);
        if (_deposit < minDep) revert InsufficientDeposit();
    }

    /// @dev True when this slot's market is denominated in native ETH.
    ///      `address(0)` is a sound sentinel because `initialize` rejected it
    ///      outright before native support existed, so no slot predating this
    ///      change can be holding it.
    function _isNative() internal view returns (bool) {
        return address(currency) == address(0);
    }

    /// @dev Pay `to`, and if the currency refuses, credit them instead so the
    ///      slot itself never becomes unusable.
    ///
    ///      This is a try-push-then-credit, not a bare pull payment: the happy
    ///      path (any well-behaved token, any unblocked recipient) still
    ///      settles atomically, which is what every caller and integrator
    ///      already expects, while a blocklisting token or a reverting
    ///      recipient degrades to a claimable credit instead of bricking every
    ///      entry point through `_settle()`.
    ///
    ///      Deliberately a raw `call` rather than `safeTransfer`: SafeERC20
    ///      reverts internally and an internal library call cannot be
    ///      try/caught. The success condition mirrors SafeERC20's — the call
    ///      must succeed AND either return nothing or return true — with the
    ///      extra requirement that the currency actually has code, so a
    ///      codeless address can never be mistaken for a successful payment.
    function _payOrCredit(address to, uint256 amount) internal {
        if (amount == 0) return;

        bool paid;
        if (_isNative()) {
            // Gas-capped deliberately. Unlike an ERC-20 transfer, a native send
            // runs the recipient's code — and this fires inside SOMEONE ELSE'S
            // transaction (a buy, a liquidation). Uncapped, an outgoing occupant
            // with a gas-burning `receive()` could make their own eviction
            // expensive and unreliable. 30k covers an EOA (2300) and a typical
            // Safe (~20k); anything greedier degrades to a claimable credit,
            // which `claim()` then delivers at full gas.
            (paid, ) = to.call{value: amount, gas: 30_000}("");
        } else {
            address token = address(currency);
            if (token.code.length > 0) {
                (bool ok, bytes memory data) = token.call(
                    abi.encodeCall(IERC20.transfer, (to, amount))
                );
                paid = ok && (data.length == 0 || abi.decode(data, (bool)));
            }
        }

        if (!paid) {
            withdrawableOf[to] += amount;
            emit RefundCredited(to, amount);
        }
    }

    /// @dev Query the utility fee and split tax between utility and recipient.
    ///
    ///      Both legs pay through `_payOrCredit`. `recipient` is chosen by
    ///      whoever creates the slot and is never validated beyond being
    ///      non-zero, so a plain `safeTransfer` here handed the creator a trap:
    ///      point `recipient` at a contract that reverts on receipt (or let a
    ///      blocklisting currency freeze it) and every path that flushes tax —
    ///      `collect`, `release`, `liquidate` — reverts forever. An insolvent
    ///      occupant then cannot be removed and cannot leave, because
    ///      `release` flushes tax too. Crediting instead keeps liquidation
    ///      unconditional, which is this protocol's first invariant, and leaves
    ///      the recipient whole via `claim()` whenever they can receive again.
    function _distributeTax(uint256 amount) internal {
        uint256 utilityFee = 0;
        uint256 feeBps_ = 0;
        if (utility != address(0)) {
            (bool ok, bytes memory data) = utility.staticcall(
                abi.encodeWithSignature("feeBps()")
            );
            if (ok && data.length >= 32) {
                uint256 bps = abi.decode(data, (uint256));
                if (bps > 0 && bps <= BASIS_POINTS) {
                    feeBps_ = bps;
                    utilityFee = (amount * bps) / BASIS_POINTS;
                }
            }
        }
        if (utilityFee > 0) {
            // Send fee to the utility's designated recipient
            address feeTarget = address(0);
            (bool recipientOk, bytes memory recipientData) = utility.staticcall(
                abi.encodeWithSignature("feeRecipient()")
            );
            if (recipientOk && recipientData.length >= 32) {
                feeTarget = abi.decode(recipientData, (address));
            }
            if (feeTarget == address(0)) {
                // No valid recipient — skip fee, send all to recipient
                utilityFee = 0;
            } else {
                _payOrCredit(feeTarget, utilityFee);
                emit ModuleFeePaid(utility, utilityFee, feeBps_);
            }
        }
        _payOrCredit(recipient, amount - utilityFee);
    }

    function _notifyUtility(string memory name, bytes memory data) internal {
        if (utility == address(0)) return;
        (bool ok, ) = utility.call{gas: 500_000}(data);
        if (!ok) emit ModuleCallFailed(name);
    }

    function _emitProtocolEvent(uint8 eventType, bytes memory data) internal {
        if (factory == address(0)) return;
        try SlotFactory(factory).emitEvent(eventType, data) {} catch {}
    }
}
