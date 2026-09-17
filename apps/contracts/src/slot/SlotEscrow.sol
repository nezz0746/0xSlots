// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISlotHook} from "../interfaces/ISlotHook.sol";
import "../errors/SlotErrors.sol";
import {SlotOccupancy} from "./SlotOccupancy.sol";
import {Occupancy, Ledger} from "./SlotStorage.sol";

/**
 * @title SlotEscrow
 * @notice The occupant's own levers, and the money leaving the slot.
 *
 * @dev What a sitting occupant does that is not handing the slot over:
 *      restate the price, fund the deposit, draw it down, delegate repricing —
 *      plus `collect` and `claim`, which move money out to the recipient and
 *      to anyone a push payment could not reach.
 */
abstract contract SlotEscrow is SlotOccupancy {
    using SafeERC20 for IERC20;

    // ─── holding ────────────────────────────────────────────────────────────

    /// @notice Restate what you think the slot is worth. Raises or lowers tax.
    function selfAssess(uint256 newPrice)
        external
        nonReentrant
        onlyOccupantOrOperator
    {
        if (newPrice == 0 || newPrice > MAX_PRICE) revert InvalidPrice();
        _settle();

        Occupancy storage o = _occupancy();
        _before(
            F_BEFORE_SELF_ASSESS,
            abi.encodeCall(
                ISlotHook.beforeSelfAssess,
                (_ctx(msg.sender, o.occupant, newPrice, o.deposit))
            )
        );

        _requireFunded(o.deposit, newPrice);

        uint256 old = o.price;
        o.price = newPrice;
        emit PriceSet(msg.sender, old, newPrice);
    }

    /// @notice Add to the occupant's escrow. Permissionless — anyone may fund
    ///         a slot, which is what makes an external keeper possible with no
    ///         protocol permission at all.
    function topUp(uint256 amount) external payable nonReentrant {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) revert Vacant();
        if (_isNative()) {
            if (msg.value != amount) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            _pull(msg.sender, amount);
        }
        _settle();
        // Debt first. Without it, an occupant whose deposit ran dry could top
        // back up to solvency, keep the seat and never pay what they owe.
        amount -= _repayDebt(o.occupant, amount);
        o.deposit += amount;
        emit Deposited(msg.sender, amount, o.deposit);
    }

    /// @notice Take back part of your escrow, keeping the required minimum.
    function withdraw(uint256 amount) external nonReentrant onlyOccupant {
        _settle();
        Occupancy storage o = _occupancy();
        if (amount == 0 || amount > o.deposit) revert NothingToWithdraw();
        uint256 left = o.deposit - amount;
        _requireFunded(left, o.price);
        o.deposit = left;
        _payOrCredit(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, left);
    }

    /**
     * @notice Let somebody else reprice on your behalf.
     *
     * @dev The approval is scoped to YOUR tenure and dies with it, so whoever
     *      takes the slot next never inherits a previous occupant's operator.
     *      Retaking a slot you once held starts a fresh tenure, which approves
     *      nobody.
     */
    function setOperator(address operator, bool allowed)
        external
        onlyOccupant
    {
        uint64 tenure = _occupancy().tenureId;
        _ledger().operatorOf[tenure][operator] = allowed;
        emit OperatorSet(operator, allowed, tenure);
    }

    // ─── money out ──────────────────────────────────────────────────────────

    /// @notice Pay out collected rent: the hook fee, then the recipient.
    ///         Anyone may call.
    function collect() external nonReentrant {
        _settle();
        if (_ledger().collectedTax == 0) revert NothingToCollect();
        _flush();
    }

    /// @notice Take a payout that could not be pushed to you. Anyone may call
    ///         on anyone's behalf; the funds always go to `account`.
    function claim(address account) external nonReentrant {
        Ledger storage l = _ledger();
        uint256 amount = l.withdrawableOf[account];
        if (amount == 0) revert NothingToClaim();
        l.withdrawableOf[account] = 0;

        if (_isNative()) {
            (bool ok, ) = account.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            _settings().currency.safeTransfer(account, amount);
        }
        emit Claimed(account, amount);
    }
}
