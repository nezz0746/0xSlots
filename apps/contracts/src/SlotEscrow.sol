// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISlotHook} from "./ISlotHook.sol";
import "./SlotErrors.sol";
import {SlotOccupancy} from "./SlotOccupancy.sol";

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

    /**
     * @notice Let somebody else reprice on your behalf.
     *
     * @dev The approval is scoped to YOUR tenure and dies with it. An approval
     *      keyed by operator alone would outlive the occupancy that granted
     *      it: whoever took the slot next would inherit the previous
     *      occupant's bot as a co-signer on their own asking price, having
     *      never approved anybody. Nothing else in the contract would notice,
     *      because the operator's rights read as valid.
     *
     *      It does not resurrect either — retaking a slot you once held starts
     *      a fresh tenure, which approves nobody.
     */
    function setOperator(address operator, bool allowed)
        external
        onlyOccupant
    {
        _operatorOf[tenureId][operator] = allowed;
        emit OperatorSet(operator, allowed, tenureId);
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

}
