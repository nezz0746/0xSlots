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
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

import {SlotAccounting} from "./SlotAccounting.sol";

/**
 * @title SlotEscrow
 * @notice Where money leaves the slot.
 *
 * @dev `withdraw`, `liquidate`, `claim`, `collect`.
 *
 *      Grouped because they share one invariant: liquidation must be
 *      unconditional. A recipient that cannot receive is credited rather than
 *      transferred to, so nobody can make themselves un-evictable by refusing
 *      payment.
 */
abstract contract SlotEscrow is SlotAccounting {
    using SafeERC20 for IERC20;

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

        // No bounty. The reward for evicting a defaulter is the SLOT: this
        // function leaves it vacant, and a vacant slot costs only the taker's
        // own deposit — so anyone who actually wants it can evict and take it
        // in one `multicall`. The incentive is the asset, not a subsidy.
        //
        // The old carve-out paid keepers out of `collectedTax`, which is the
        // recipient's revenue accumulated across EVERY tenure — so evicting
        // Bob was funded partly by tax Alice paid months earlier. It also gave
        // the manager, an address independent of the recipient, a one-call
        // route to that money, and made `collect()` and `liquidate()` race to
        // strip each other.
        //
        // Nobody is worse off for its absence: once a deposit is empty no
        // further tax accrues, and `collect()` is permissionless, so a
        // recipient can always flush what they are owed without evicting.
        uint256 bounty = 0;

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
            TOPIC_RELEASE,
            "onRelease",
            abi.encodeCall(
                IUtility.onRelease, (0, prev))
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

}
