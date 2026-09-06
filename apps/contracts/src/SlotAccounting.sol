// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SlotMath} from "./SlotMath.sol";
import {SlotHooks} from "./SlotHooks.sol";
import {ISlotHook, SlotContext} from "./ISlotHook.sol";
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
    event TermsApplied(
        uint256 taxBps,
        address indexed hook,
        bytes32 hookData
    );
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
        return SlotMath.taxFor(_price, taxBps, elapsed);
    }

    /// @notice The smallest deposit that funds `minDepositSeconds` at `price_`.
    function _minDepositFor(uint256 price_) internal view returns (uint256) {
        return SlotMath.depositFor(price_, taxBps, minDepositSeconds);
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
            // Nothing accrued, so there is nothing to realise — and moving the
            // clock anyway would destroy the window.
            //
            // This is the same grind the solvent branch below converts `paid`
            // back into seconds to prevent, and it was reachable here because
            // `owed >= _deposit` is TRUE at `0 >= 0`. Once a deposit hits zero,
            // every sub-threshold window took this branch and set `lastSettled`
            // to now, so at a price low enough that one second floors to zero
            // tax, `topUp(0)` — free and permissionless — ground the clock
            // forward for ever and the arrears never accrued at all.
            //
            // `owed == 0` here implies `_deposit == 0`, so everything skipped
            // is a no-op: no tax to take, no arrears to carry, and a `Settled`
            // that would report zeros against an escrow that did not move.
            if (owed == 0) return;

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
            uint256 secondsPaid = SlotMath.secondsFor(
                paid,
                _price,
                taxBps
            );

            // A charge must always advance the clock, or the same second is
            // chargeable for ever.
            //
            // Both roundings floor, in opposite directions: `taxFor` floors
            // the amount DOWN, so a fractional per-second rate charges one
            // wei for one second, and `secondsFor` then floors that one wei
            // back DOWN to zero seconds. Money moved, `lastSettled` did not,
            // and the guard at the top of this function never engaged — so
            // `topUp(0)`, which is free and permissionless, charged the same
            // second again on every call. Any slot whose per-second tax is
            // not a whole number of wei could have its escrow emptied at a
            // single timestamp and its occupant evicted fully funded.
            //
            // Only when something was actually taken. `paid == 0` must still
            // leave the clock alone: that is the window too short to price one
            // unit, and advancing it is the grind this conversion exists to
            // prevent.
            if (paid > 0 && secondsPaid == 0) secondsPaid = 1;

            uint256 elapsed = upTo - lastSettled;
            if (secondsPaid >= elapsed) lastSettled = uint64(upTo);
            else lastSettled += uint64(secondsPaid);
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
    function hasRipeTerms() public view returns (bool) {
        if (!pending.hasTax && !pending.hasHook) return false;
        return block.timestamp >= pending.proposedAt + TERMS_DELAY;
    }

    /**
     * @dev Apply terms queued by the manager.
     *
     *      Called at every occupancy transition — that boundary IS the
     *      guarantee. An occupant's terms cannot move under them; they change
     *      only when the seat does.
     */
    function _applyPending() internal {
        _applyPending(false);
    }

    /**
     * @param mustApply Revert rather than defer when the hook cannot be read.
     *
     *      TRUE only from `buy`. The early return below protects a manager's
     *      proposal from being erased by a starved read, and it was written
     *      with a griefer in mind — someone spending gas to destroy a change
     *      that constrains SOMEBODY ELSE. It does not hold when the caller is
     *      the party the new terms were meant to constrain.
     *
     *      `_applyPending` runs before `_before` in `buy`, so a buyer who
     *      would be vetoed by an incoming hook could pick a gas limit under
     *      the threshold, skip the application, and be seated under the old
     *      terms with the new hook never asked. Ripe terms became opt-in for
     *      the one person they were aimed at.
     *
     *      Refusing the buy is safe; the buyer retries with more gas. Refusing
     *      an eviction is not, which is why `release` and `liquidate` keep the
     *      early return — rule 1 says nothing may block a liquidation.
     */
    function _applyPending(bool mustApply) internal {
        if (!hasRipeTerms()) return;

        // Refuse to answer for a hook we cannot afford to ask.
        //
        // A starved read is indistinguishable from a misbehaving hook — both
        // return false — and the consequence was `delete pending`, permanently
        // discarding the manager's queued change. So anyone could destroy a
        // proposal by calling `liquidate()` or `release()` with a gas limit
        // tuned to leave just enough for the transition and not enough for the
        // hook. Cheap, repeatable, and it looked exactly like the hook's fault.
        //
        // The 64/63 is EIP-150: forwarding a stipend of X needs X * 64/63 in
        // hand, so checking for X alone would still starve the call it is
        // trying to protect. `HOOK_GAS` covers both halves of the read, since
        // `_tryReadHookFlags` splits one stipend across its two calls.
        //
        // Returning early leaves `pending` intact and ripe, so the terms land
        // at the next transition. The griefer can delay a change; they can no
        // longer erase it.
        if (
            pending.hasHook &&
            gasleft() < (HOOK_GAS * 64) / 63 + HOOK_READ_FLOOR
        ) {
            if (mustApply) revert InsufficientGasForTerms();
            return;
        }

        if (pending.hasTax) taxBps = pending.taxBps;
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
            (bool ok, uint8 flags) = _tryReadHookFlags(h, pending.hookData);
            if (ok) {
                _hookFlags = flags;
                hook = h;
                hookData = pending.hookData;
            } else {
                _hookFlags = 0;
                hook = address(0);
                hookData = bytes32(0);
                emit HookDetached(h);
            }
        }

        delete pending;
        emit TermsApplied(taxBps, hook, hookData);
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

    /// @dev Pull `amount` of the slot's currency from `from`.
    function _pull(address from, uint256 amount) internal {
        if (amount == 0) return;
        currency.safeTransferFrom(from, address(this), amount);
    }
}
