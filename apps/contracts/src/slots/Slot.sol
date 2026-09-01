// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SlotOrders} from "./SlotOrders.sol";
import {ISlotHook, SlotContext} from "./ISlotHook.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MAX_PRICE, MAX_TAX_BPS, MONTH, BASIS_POINTS} from "./SlotStorage.sol";
import "./SlotErrors.sol";

/// @notice Everything a slot needs at birth.
struct SlotInit {
    address recipient;
    IERC20 currency;
    address manager;
    address hook;
    uint256 taxPercentage;
    uint256 minDepositSeconds;
    bool mutableTax;
    bool mutableHook;
}

/**
 * @title Slot
 * @notice One Harberger-taxed position. Always for sale at a price its holder
 *         sets, taxed continuously on that price.
 *
 * @dev ── The two rules everything else serves ────────────────────────────
 *
 *      1. Liquidation is unconditional. An occupant whose deposit is empty can
 *         always be evicted, by anyone, and nothing — no hook, no recipient, no
 *         currency — may prevent it. Every capped call and swallowed revert in
 *         this codebase exists for that sentence.
 *
 *      2. Terms do not move under an occupant. Tax and hook changes are
 *         proposed by the manager and land at the next occupancy transition, so
 *         what you bought into holds for as long as you hold the slot.
 *
 *      ── Extension ───────────────────────────────────────────────────────
 *
 *      One `hook`. `before` decides and may refuse; `after` records and cannot.
 *      A slot wanting several behaviours points at a composite that fans out,
 *      which keeps the loop in userland and out of the eviction path.
 */
contract Slot is SlotOrders {
    using SafeERC20 for IERC20;

    event Initialized(address indexed recipient, address indexed currency);
    event Bought(
        address indexed buyer,
        address indexed from,
        uint256 price,
        uint256 deposit,
        uint256 paid
    );
    event Sold(
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 deposit
    );
    event Released(address indexed occupant, uint256 refund);
    event Liquidated(address indexed by, address indexed occupant);
    event PriceSet(address indexed by, uint256 oldPrice, uint256 newPrice);
    event Deposited(address indexed by, uint256 amount, uint256 total);
    event Withdrawn(address indexed occupant, uint256 amount, uint256 left);
    event OperatorSet(address indexed operator, bool allowed);
    event TermsProposed(uint256 taxPercentage, address hook, bool tax, bool hook_);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(SlotInit calldata p) external initializer {
        if (p.recipient == address(0)) revert InvalidRecipient();
        if (p.taxPercentage == 0 || p.taxPercentage > MAX_TAX_BPS)
            revert InvalidTax();
        if (address(p.currency) != address(0) && address(p.currency).code.length == 0)
            revert InvalidCurrency();
        // A manager is required exactly when something is mutable, and
        // forbidden otherwise — so "immutable" is a fact about the slot rather
        // than a promise about somebody's restraint.
        if (p.mutableTax || p.mutableHook) {
            if (p.manager == address(0)) revert NotManager();
        } else if (p.manager != address(0)) {
            revert NotManager();
        }

        recipient = p.recipient;
        currency = p.currency;
        manager = p.manager;
        taxPercentage = p.taxPercentage;
        minDepositSeconds = p.minDepositSeconds;
        mutableTax = p.mutableTax;
        mutableHook = p.mutableHook;
        lastSettled = uint64(block.timestamp);

        if (p.hook != address(0)) {
            _hookFlags = _readHookFlags(p.hook);
            hook = p.hook;
        }

        emit Initialized(p.recipient, address(p.currency));
    }

    // ─── reads ──────────────────────────────────────────────────────────────

    function occupant() public view returns (address) {
        return _occupant;
    }

    function price() public view returns (uint256) {
        return _price;
    }

    function deposit() public view returns (uint256) {
        return _deposit;
    }

    function isVacant() public view returns (bool) {
        return _occupant == address(0);
    }

    /// @notice True when the deposit can no longer cover what is owed.
    function isInsolvent() public view returns (bool) {
        return _occupant != address(0) && taxOwed() >= _deposit;
    }

    /// @notice Seconds until the deposit runs out. `type(uint256).max` if never.
    function secondsUntilLiquidation() external view returns (uint256) {
        if (_occupant == address(0)) return type(uint256).max;
        uint256 owed = taxOwed();
        if (owed >= _deposit) return 0;
        uint256 perSecond = Math.mulDiv(
            _price,
            taxPercentage,
            MONTH * BASIS_POINTS
        );
        if (perSecond == 0) return type(uint256).max;
        return (_deposit - owed) / perSecond;
    }

    // ─── occupancy ──────────────────────────────────────────────────────────

    /**
     * @notice Take the slot, naming your own price.
     *
     * @dev `account` is seated; `msg.sender` pays. Those are deliberately
     *      separable — it is what lets a contract acquire a slot on someone's
     *      behalf without any protocol permission.
     */
    function buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) external payable nonReentrant {
        _buy(account, depositAmount, selfAssessedPrice);
    }

    function _buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) internal {
        if (selfAssessedPrice == 0 || selfAssessedPrice > MAX_PRICE)
            revert InvalidPrice();
        if (account == address(0)) revert InvalidRecipient();

        _settle();

        address prev = _occupant;
        if (account == prev) revert CannotBuyFromYourself();

        uint256 owedToPrev = prev == address(0) ? 0 : _price;

        _before(
            F_BEFORE_BUY,
            abi.encodeCall(
                ISlotHook.beforeBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );

        _applyPending();
        _requireFunded(depositAmount, selfAssessedPrice);

        uint256 owed = owedToPrev + depositAmount;
        if (_isNative()) {
            if (msg.value != owed) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            _pull(msg.sender, owed);
        }

        uint256 refund = _deposit + owedToPrev;

        _occupant = account;
        _price = selfAssessedPrice;
        _deposit = depositAmount;
        occupiedSince = uint64(block.timestamp);
        lastSettled = uint64(block.timestamp);

        if (prev != address(0)) _payOrCredit(prev, refund);

        emit Bought(account, prev, selfAssessedPrice, depositAmount, owedToPrev);
        _after(
            F_AFTER_BUY,
            abi.encodeCall(
                ISlotHook.afterBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );
    }

    /**
     * @notice Hand the slot to a buyer on terms that buyer signed.
     *
     * @dev The missing half of `buy`. `buy` is "anyone may take this at the
     *      price the occupant set"; `sell` is "the occupant may hand it to a
     *      buyer who agreed to these terms". Without it the only exits were
     *      being bought at your own asking price, or walking away with nothing.
     *
     *      ERC-20 only: payment is pulled on the buyer's allowance, and native
     *      ETH has none.
     */
    function sell(SellOrder calldata order, bytes calldata signature)
        external
        nonReentrant
        onlyOccupant
    {
        if (_isNative()) revert SellNeedsErc20();
        if (order.price == 0 || order.price > MAX_PRICE) revert InvalidPrice();
        if (order.buyer == address(0)) revert InvalidRecipient();

        _consumeOrder(order, signature);
        _settle();

        address prev = _occupant;
        if (order.buyer == prev) revert CannotBuyFromYourself();

        _before(
            F_BEFORE_SELL,
            abi.encodeCall(
                ISlotHook.beforeSell,
                (_ctx(msg.sender, order.buyer, order.price, order.deposit))
            )
        );

        _applyPending();
        _requireFunded(order.deposit, order.price);

        _pull(order.buyer, order.price + order.deposit);

        uint256 proceeds = _deposit + order.price;

        _occupant = order.buyer;
        _price = order.price;
        _deposit = order.deposit;
        occupiedSince = uint64(block.timestamp);
        lastSettled = uint64(block.timestamp);

        _payOrCredit(prev, proceeds);

        emit Sold(prev, order.buyer, order.price, order.deposit);
        // `Bought` as well, deliberately: the occupancy transition IS a buy and
        // every indexer and feed already reads it that way. Emitting only
        // `Sold` would make slots silently vanish from anything watching.
        emit Bought(order.buyer, prev, order.price, order.deposit, order.price);
        _after(
            F_AFTER_SELL,
            abi.encodeCall(
                ISlotHook.afterSell,
                (_ctx(msg.sender, order.buyer, order.price, order.deposit))
            )
        );
    }

    /// @notice Give up the slot and take back what is left of your deposit.
    function release() external nonReentrant onlyOccupant {
        _settle();

        address prev = _occupant;
        uint256 refund = _deposit;

        _vacate();
        _applyPending();

        if (refund > 0) _payOrCredit(prev, refund);
        _flush();

        emit Released(prev, refund);
        _after(
            F_AFTER_RELEASE,
            abi.encodeCall(ISlotHook.afterRelease, (_ctx(msg.sender, prev, 0, 0)))
        );
    }

    /**
     * @notice Evict an occupant whose deposit is empty. Anyone may call.
     *
     * @dev No bounty. The reward is the slot: this leaves it vacant, and a
     *      vacant slot costs only the taker's own deposit — so whoever actually
     *      wants it can evict and take it atomically via `liquidateAndTake`.
     *      Paying keepers out of the recipient's accrued tax funded the
     *      incentive from the wrong pocket, and across tenures that were not
     *      even the defaulter's.
     */
    function liquidate() external nonReentrant {
        _liquidate();
    }

    function _liquidate() internal {
        if (_occupant == address(0)) revert Vacant();
        _settle();
        if (_deposit > 0) revert NotInsolvent();

        address prev = _occupant;
        _vacate();
        _applyPending();
        _flush();

        emit Liquidated(msg.sender, prev);
        _after(
            F_AFTER_LIQUIDATE,
            abi.encodeCall(ISlotHook.afterLiquidate, (_ctx(msg.sender, prev, 0, 0)))
        );
    }

    /**
     * @notice Evict an insolvent occupant and take the slot, in one call.
     *
     * @dev This is what makes "no bounty" honest. The rationale for paying
     *      keepers nothing is that whoever wants the slot can evict and take
     *      it, so the slot itself is the reward — but that only works if the
     *      two happen atomically, or the keeper does the eviction and loses
     *      the race for the vacancy to whoever is watching the mempool.
     *
     *      The inherited `multicall` almost does it, and silently does not:
     *      OZ's is non-payable, so `msg.value` is zero inside it and `buy`
     *      demands an exact amount. It works for ERC-20 slots and is
     *      unreachable for native ones — the promise held for half the
     *      protocol. Making `multicall` payable instead would be the classic
     *      mistake: every delegatecall sees the same `msg.value`, so one ETH
     *      payment would satisfy two `buy` calls and the second would be
     *      funded out of the contract's own balance.
     *
     *      A single guarded entry point costs one function and keeps `buy`'s
     *      exactness check intact.
     */
    function liquidateAndTake(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) external payable nonReentrant {
        _liquidate();
        _buy(account, depositAmount, selfAssessedPrice);
    }

    // ─── holding ────────────────────────────────────────────────────────────

    /// @notice Restate what you think the slot is worth. Raises or lowers tax.
    function selfAssess(uint256 newPrice)
        external
        nonReentrant
        onlyOccupantOrOperator
    {
        if (newPrice == 0 || newPrice > MAX_PRICE) revert InvalidPrice();
        _settle();

        _before(
            F_BEFORE_SELF_ASSESS,
            abi.encodeCall(
                ISlotHook.beforeSelfAssess,
                (_ctx(msg.sender, _occupant, newPrice, _deposit))
            )
        );

        _requireFunded(_deposit, newPrice);

        uint256 old = _price;
        _price = newPrice;
        emit PriceSet(msg.sender, old, newPrice);
    }

    /// @notice Add to the occupant's escrow. Permissionless — anyone may fund
    ///         a slot, which is what makes an external keeper possible with no
    ///         protocol permission at all.
    function topUp(uint256 amount) external payable nonReentrant {
        if (_occupant == address(0)) revert Vacant();
        if (_isNative()) {
            if (msg.value != amount) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            _pull(msg.sender, amount);
        }
        _settle();
        _deposit += amount;
        emit Deposited(msg.sender, amount, _deposit);
    }

    /// @notice Take back part of your escrow, keeping the required minimum.
    function withdraw(uint256 amount) external nonReentrant onlyOccupant {
        _settle();
        if (amount == 0 || amount > _deposit) revert NothingToWithdraw();
        uint256 left = _deposit - amount;
        _requireFunded(left, _price);
        _deposit = left;
        _payOrCredit(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, left);
    }

    function setOperator(address operator, bool allowed)
        external
        onlyOccupant
    {
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    // ─── money out ──────────────────────────────────────────────────────────

    /// @notice Flush accrued tax to the recipient. Anyone may call.
    function collect() external nonReentrant {
        _settle();
        if (collectedTax == 0) revert NothingToCollect();
        _flush();
    }

    /// @notice Take a payout that could not be pushed to you. Anyone may call
    ///         on anyone's behalf; the funds always go to `account`.
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
        emit Claimed(account, amount);
    }

    // ─── manager ────────────────────────────────────────────────────────────

    /**
     * @notice Queue a change of terms, landing at the next occupancy change.
     *
     * @dev Both dimensions in one call, because they share one deferral and one
     *      apply. Pass `changeTax`/`changeHook` false to leave one alone.
     *
     *      The hook is validated NOW — a hook whose `hooks()` does not answer
     *      is refused here rather than silently attached with no subscriptions.
     */
    function proposeTerms(
        uint256 newTax,
        address newHook,
        bool changeTax,
        bool changeHook
    ) external onlyManager {
        if (changeTax) {
            if (!mutableTax) revert NotMutable();
            if (newTax == 0 || newTax > MAX_TAX_BPS) revert InvalidTax();
            pending.taxPercentage = newTax;
            pending.hasTax = true;
        }
        if (changeHook) {
            if (!mutableHook) revert NotMutable();
            if (newHook != address(0)) _readHookFlags(newHook);
            pending.hook = newHook;
            pending.hasHook = true;
        }
        if (!changeTax && !changeHook) revert NoPendingUpdate();

        pending.proposedAt = uint64(block.timestamp);
        emit TermsProposed(newTax, newHook, changeTax, changeHook);
    }

    function cancelProposal() external onlyManager {
        if (!pending.hasTax && !pending.hasHook) revert NoPendingUpdate();
        delete pending;
    }

    // ─── internals ──────────────────────────────────────────────────────────

    function _vacate() internal {
        _occupant = address(0);
        _price = 0;
        _deposit = 0;
        occupiedSince = 0;
        lastSettled = uint64(block.timestamp);
    }

    function _flush() internal {
        uint256 amount = collectedTax;
        if (amount == 0) return;
        collectedTax = 0;
        // Straight to the recipient. No fee is carved out for the hook: every
        // module ever deployed under the previous design charged zero, and the
        // path that read a fee from an untrusted contract sat inside
        // `liquidate()` where nothing untrusted belongs.
        _payOrCredit(recipient, amount);
        emit TaxCollected(recipient, amount);
    }

    receive() external payable {
        revert InvalidValue();
    }
}
