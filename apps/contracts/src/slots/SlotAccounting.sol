// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotHooks} from "./SlotHooks.sol";
import {ISlotHook, SlotContext} from "./ISlotHook.sol";
import {BASIS_POINTS, MONTH, PAYOUT_GAS} from "./SlotStorage.sol";
import "./SlotErrors.sol";

/**
 * @title SlotAccounting
 * @notice Tax accrual, payout, and the deferred-terms boundary.
 */
abstract contract SlotAccounting is SlotHooks {
    using SafeERC20 for IERC20;

    event Settled(uint256 owed, uint256 paid, uint256 depositLeft);
    event TaxPaid(address indexed payer, uint256 owed, uint256 paid);
    event TaxCollected(address indexed recipient, uint256 amount);
    event Credited(address indexed account, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    event TermsApplied(uint256 taxPercentage, address hook);

    function _isNative() internal view returns (bool) {
        return address(currency) == address(0);
    }

    /// @notice Tax owed since the last settlement, capped by nothing — this is
    ///         the raw debt, which may exceed the deposit.
    function taxOwed() public view returns (uint256) {
        if (_occupant == address(0)) return 0;
        uint256 elapsed = block.timestamp - lastSettled;
        // `mulDiv`, not `a * b / c`. The plain form multiplies before it
        // divides, so a large price overflowed uint256 and reverted — and
        // because every entry point settles first, that reverted `liquidate()`
        // too and bricked the slot permanently. The quotient always fitted.
        return Math.mulDiv(_price, taxPercentage * elapsed, MONTH * BASIS_POINTS);
    }

    /// @notice The smallest deposit that funds `minDepositSeconds` at `price_`.
    function _minDepositFor(uint256 price_) internal view returns (uint256) {
        if (minDepositSeconds == 0) return 0;
        return
            Math.ceilDiv(
                price_ * taxPercentage * minDepositSeconds,
                MONTH * BASIS_POINTS
            );
    }

    function _requireFunded(uint256 depositAmount, uint256 price_) internal view {
        if (depositAmount < _minDepositFor(price_)) revert InvalidDeposit();
    }

    /**
     * @dev Realise tax up to now.
     *
     *      Called first by every entry point, so that a policy is asked about
     *      current rather than stale state, and so an occupant who has run dry
     *      is visibly insolvent before anything else happens.
     */
    function _settle() internal {
        uint256 upTo = block.timestamp;
        if (upTo <= lastSettled) return;

        if (_occupant == address(0)) {
            lastSettled = uint64(upTo);
            return;
        }

        uint256 owed = taxOwed();
        uint256 paid;
        if (owed >= _deposit) {
            paid = _deposit;
            _deposit = 0;
        } else {
            paid = owed;
            _deposit -= owed;
        }
        collectedTax += paid;
        lastSettled = uint64(upTo);

        emit Settled(owed, paid, _deposit);

        if (paid == 0) return;

        // Attributed to the CURRENT occupant, who is still the payer here:
        // every entry point settles before it reassigns occupancy, so a buy
        // charges the outgoing occupant for their own tenure.
        address payer = _occupant;
        emit TaxPaid(payer, owed, paid);

        SlotContext memory ctx = _ctx(msg.sender, payer, _price, _deposit);
        ctx.owed = owed;
        ctx.paid = paid;
        _after(F_AFTER_SETTLE, abi.encodeCall(ISlotHook.afterSettle, (ctx)));
    }

    /**
     * @dev Apply terms queued by the manager.
     *
     *      Called at every occupancy transition — that boundary IS the
     *      guarantee. An occupant's terms cannot move under them; they change
     *      only when the seat does.
     */
    function _applyPending() internal {
        if (!pending.hasTax && !pending.hasHook) return;

        if (pending.hasTax) taxPercentage = pending.taxPercentage;
        if (pending.hasHook) {
            address h = pending.hook;
            // Re-read the subscriptions here rather than at proposal time: a
            // hook could have been upgraded in the interval, and the flags must
            // describe the code that will actually run.
            _hookFlags = _readHookFlags(h);
            hook = h;
        }

        delete pending;
        emit TermsApplied(taxPercentage, hook);
    }

    /**
     * @dev Pay `to`, or credit them if paying fails.
     *
     *      Never reverts. That is the whole point: this runs inside evictions,
     *      and a counterparty who cannot receive must not be able to make
     *      themselves un-evictable by refusing payment.
     */
    function _payOrCredit(address to, uint256 amount) internal {
        if (amount == 0) return;

        bool paid;
        if (_isNative()) {
            (paid, ) = to.call{value: amount, gas: PAYOUT_GAS}("");
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
            emit Credited(to, amount);
        }
    }

    /// @dev Pull `amount` of the slot's currency from `from`.
    function _pull(address from, uint256 amount) internal {
        if (amount == 0) return;
        currency.safeTransferFrom(from, address(this), amount);
    }
}
