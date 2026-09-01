// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotHooks} from "./SlotHooks.sol";
import {ISlotHook, SlotContext} from "./ISlotHook.sol";
import {BASIS_POINTS, MONTH, PAYOUT_GAS, TERMS_DELAY} from "./SlotStorage.sol";
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
    /// @notice A queued hook could not be attached and was dropped instead of
    ///         being allowed to block the transition.
    event HookDetached(address indexed hook);

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
            // What the deposit could not cover is carried, not forgiven.
            // Forgiving it made defaulting the cheapest way to hold a slot.
            unchecked {
                if (owed > paid) arrearsOf[_occupant] += owed - paid;
            }
            lastSettled = uint64(upTo);
        } else {
            paid = owed;
            _deposit -= owed;
            // Advance the clock only over the time actually paid for.
            //
            // `taxOwed` floors, so a window too short to price one unit of
            // currency accrues zero — and moving `lastSettled` to `now`
            // anyway destroyed that window's tax. `topUp(0)` is a free,
            // permissionless settle, so anyone could grind the clock forward
            // in sub-unit steps and pay nothing at all, for ever, while
            // staying solvent and therefore un-evictable.
            //
            // Converting `paid` back into seconds keeps the unpaid remainder
            // owed. It is exact when it divides evenly and rounds in the
            // occupant's favour by at most one second when it does not.
            uint256 rate = _price * taxPercentage;
            if (rate == 0) {
                lastSettled = uint64(upTo);
            } else {
                uint256 secondsPaid = Math.mulDiv(
                    paid,
                    MONTH * BASIS_POINTS,
                    rate
                );
                uint256 elapsed = upTo - lastSettled;
                if (secondsPaid >= elapsed) lastSettled = uint64(upTo);
                else lastSettled += uint64(secondsPaid);
            }
        }
        collectedTax += paid;

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
    /// @notice Whether queued terms are ripe enough to land on the next
    ///         occupancy transition.
    /// @dev A transition is WHERE terms land; the delay is WHEN they may.
    ///      Without it a manager proposes and the very next buyer in the same
    ///      block is seated on terms they never saw.
    ///
    ///      Public because a buyer has to be able to ask. Anything sizing a
    ///      deposit against the pending rate has to agree with `_applyPending`
    ///      about whether that rate is going to apply — disagreeing in either
    ///      direction quotes a number the transaction will not accept.
    function pendingApplies() public view returns (bool) {
        if (!pending.hasTax && !pending.hasHook) return false;
        return block.timestamp >= pending.proposedAt + TERMS_DELAY;
    }

    function _applyPending() internal {
        if (!pendingApplies()) return;

        if (pending.hasTax) taxPercentage = pending.taxPercentage;
        if (pending.hasHook) {
            address h = pending.hook;
            // Re-read the subscriptions here rather than at proposal time: a
            // hook could have been upgraded in the interval, and the flags must
            // describe the code that will actually run.
            //
            // FAIL-OPEN, unlike `proposeTerms`, and the difference is the
            // whole point. This runs inside `_liquidate`. `_readHookFlags`
            // reverts — on the hook's own revert, on all-false flags, or by
            // burning an uncapped frame — and every other untrusted call
            // reachable from an eviction is capped and swallowed for exactly
            // that reason. Left fail-closed, a hook that stopped answering
            // made an insolvent occupant permanently un-evictable: the one
            // thing rule 1 says nothing may do.
            //
            // A hook that will not say what it wants is attached as nothing.
            (bool ok, uint8 flags) = _tryReadHookFlags(h);
            if (ok) {
                _hookFlags = flags;
                hook = h;
            } else {
                _hookFlags = 0;
                hook = address(0);
                emit HookDetached(h);
            }
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
                // Decoded by hand, because `abi.decode(data, (bool))` reverts
                // on any word that is not 0 or 1 — and it reverts HERE, in a
                // function whose whole contract is that it never does. A
                // token that returns something odd must be treated as "did
                // not pay" and credited, exactly like one that reverted.
                if (ok) {
                    if (data.length == 0) paid = true;
                    else if (data.length >= 32) {
                        paid = abi.decode(data, (uint256)) == 1;
                    }
                }
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
