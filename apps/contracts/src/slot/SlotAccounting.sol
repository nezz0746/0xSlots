// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../libraries/SlotMath.sol";
import {SlotHooks} from "./SlotHooks.sol";
import {ISlotHook, SlotContext} from "../interfaces/ISlotHook.sol";
import {TaxTerms, HookTerms, HookOffer} from "../types/SlotTypes.sol";
import {Occupancy, Ledger} from "./SlotStorage.sol";
import {TermsLib, TermsQueue} from "../libraries/TermsLib.sol";
import "../errors/SlotErrors.sol";

/**
 * @title SlotAccounting
 * @notice Tax accrual, payout, and the deferred-terms boundary.
 */
abstract contract SlotAccounting is SlotHooks {
    using SafeERC20 for IERC20;
    using TermsLib for TermsQueue;

    event Settled(uint256 owed, uint256 paid, uint256 depositLeft);
    event TaxPaid(address indexed payer, uint256 owed, uint256 paid);
    event TaxCollected(address indexed recipient, uint256 amount);
    event HookFeePaid(address indexed hook, address indexed recipient, uint256 amount);
    event Credited(address indexed account, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    /// @notice Debt from an earlier shortfall was paid, out of a buy, a buyout
    ///         or a top-up.
    event DebtRepaid(address indexed account, uint256 amount);
    /// @notice Queued terms took effect. `taxTerms`, `hookTerms` and `hookOffer`
    ///         are what is now in force; `mask` says which terms changed.
    event TermsApplied(TaxTerms taxTerms, HookTerms hookTerms, HookOffer hookOffer, uint8 mask);
    /// @notice A queued hook could not be attached and was dropped instead of
    ///         being allowed to block the transition.
    event HookDetached(address indexed hook);
    /// @notice Accepted permissions were not applied, because the hook no
    ///         longer declares them. The slot keeps the permissions it had.
    event HookPermissionsDropped(address indexed hook, uint8 permissions);

    function _isNative() internal view returns (bool) {
        return address(_settings().currency) == address(0);
    }

    /// @notice Tax owed since the last settlement, capped by nothing — this is
    ///         the raw debt, which may exceed the deposit.
    function taxOwed() public view returns (uint256) {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) return 0;
        return SlotMath.taxFor(o.price, _taxTerms().rateBps, block.timestamp - o.lastSettled);
    }

    /// @notice The smallest deposit that funds `minRunwaySeconds` at `price_`.
    function _minDepositFor(uint256 price_) internal view returns (uint256) {
        TaxTerms storage r = _taxTerms();
        return SlotMath.depositFor(price_, r.rateBps, r.minRunwaySeconds);
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
        Occupancy storage o = _occupancy();
        uint256 upTo = block.timestamp;
        if (upTo <= o.lastSettled) return;

        if (o.occupant == address(0)) {
            o.lastSettled = uint64(upTo);
            return;
        }

        uint256 owed = taxOwed();
        uint256 paid;
        if (owed >= o.deposit) {
            // Nothing accrued, so there is nothing to realise — and moving the
            // clock anyway would destroy the window. This branch is taken at
            // `0 >= 0` too, so without the guard a price low enough that one
            // second floors to zero tax could be ground forward for ever with
            // free, permissionless `topUp(0)` calls, and the debt would never
            // accrue: the same grind the solvent branch below converts `paid`
            // back into seconds to prevent.
            //
            // `owed == 0` here implies `deposit == 0`, so everything skipped
            // is a no-op: no tax to take, no debt to carry, and a `Settled`
            // that would report zeros against an escrow that did not move.
            if (owed == 0) return;

            paid = o.deposit;
            o.deposit = 0;
            // What the deposit could not cover is carried, not forgiven.
            // Forgiving it made defaulting the cheapest way to hold a slot.
            unchecked {
                if (owed > paid) _ledger().debtOf[o.occupant] += owed - paid;
            }
            o.lastSettled = uint64(upTo);
        } else {
            paid = owed;
            o.deposit -= owed;
            // Advance the clock only over the time actually paid for.
            //
            // `taxOwed` floors, so a window too short to price one unit of
            // currency accrues zero, and moving `lastSettled` to `now` anyway
            // would destroy that window's tax: `topUp(0)` is a free settle, so
            // anyone could grind the clock forward paying nothing. Converting
            // `paid` back into seconds keeps the unpaid remainder owed.
            //
            // Rounded UP. The paid time is short of `elapsed` by less than one
            // wei's worth, and rounding down left a whole paid second on the
            // clock, charged again by the next settle. A settle every block
            // then overcharged the occupant by a second per block. Up, the
            // clock never passes `elapsed`, a non-zero `paid` always moves it,
            // and the occupant is forgiven under one wei per settle.
            uint256 secondsPaid = SlotMath.secondsPaidFor(
                paid,
                o.price,
                _taxTerms().rateBps
            );

            uint256 elapsed = upTo - o.lastSettled;
            if (secondsPaid >= elapsed) o.lastSettled = uint64(upTo);
            else o.lastSettled += uint64(secondsPaid);
        }
        _ledger().collectedTax += paid;

        emit Settled(owed, paid, o.deposit);

        if (paid == 0) return;

        // Attributed to the CURRENT occupant, who is still the payer here:
        // every entry point settles before it reassigns occupancy, so a buy
        // charges the outgoing occupant for their own tenure.
        address payer = o.occupant;
        emit TaxPaid(payer, owed, paid);

        SlotContext memory ctx = _ctx(msg.sender, payer, o.price, o.deposit);
        ctx.owed = owed;
        ctx.paid = paid;
        _after(F_AFTER_SETTLE, abi.encodeCall(ISlotHook.afterSettle, (ctx)));
    }

    /// @notice Whether queued terms have sat long enough to land.
    /// @dev `buy` and `applyTerms` are WHERE terms land; the delay is WHEN they
    ///      may. Public because a buyer has to be able to ask: anything sizing a
    ///      deposit against queued terms has to agree with `_applyPending`
    ///      about whether they are going to apply.
    function hasRipeTerms() public view returns (bool) {
        return _queue().isRipe(TERMS_DELAY);
    }

    /**
     * @dev Apply terms queued by the manager.
     *
     *      Called when the seat is TAKEN — from `buy`, and from `applyTerms`
     *      when somebody entitled to asks. That boundary is the guarantee: an
     *      occupant's terms cannot move under them, because the only automatic
     *      application seats somebody new under them.
     *
     *      Deliberately NOT called from `release` or `liquidate`. Applying
     *      reads the incoming hook, and an eviction that reads a hook is an
     *      eviction a hook can make expensive. A vacated slot keeps the terms
     *      it had until the next buyer funds the new ones, which is when they
     *      matter.
     *
     *      ── Rent is paid out BEFORE anything changes ─────────────────────
     *
     *      Collected rent was earned under the outgoing terms: their recipient
     *      and their hook fee. Flushing first means the pot only ever holds rent
     *      earned under the terms in force, so a fee or recipient change can
     *      never reach back into it, and no history needs keeping.
     */
    function _applyPending() internal returns (bool attached) {
        TermsQueue storage q = _queue();
        if (!q.isRipe(TERMS_DELAY)) return false;

        HookTerms memory next = _nextHookTerms();
        HookTerms memory current = _hookTerms();
        bool hookChanges = q.mask & TermsLib.HOOK != 0;
        // A queued hook brings its own offer, permissions included.
        bool permissionsChange = !hookChanges && q.mask & TermsLib.HOOK_PERMISSIONS != 0;
        address reading = hookChanges ? next.target : permissionsChange ? current.target : address(0);

        _flush();

        // Read the hook before the copy clears the queue. Re-read here rather
        // than trusted from proposal or acceptance: a hook could have been
        // upgraded in the interval, and the copy has to describe the code that
        // will run.
        //
        // FAIL-OPEN, unlike `proposeTerms`: a hook that stopped answering must
        // not be able to wedge the queue shut. An incoming hook that will not
        // say what it wants is attached as nothing; accepted permissions it no
        // longer declares are dropped.
        bool ok;
        HookOffer memory offer;
        if (reading != address(0)) {
            (ok, offer) = _tryReadHook(hookChanges ? next : current);
        }
        uint8 acceptedPermissions = q.hookPermissions;

        uint8 applied = q.applyQueued(_taxTerms(), _hookTerms(), _nextTaxTerms(), _nextHookTerms());
        HookOffer storage live = _hookOffer();

        if (hookChanges) {
            applied &= ~TermsLib.HOOK_PERMISSIONS;
            if (next.target != address(0) && !ok) {
                _hookTerms().target = address(0);
                _hookTerms().config = bytes32(0);
                emit HookDetached(next.target);
                offer = HookOffer(0, 0, address(0));
            }
            live.permissions = offer.permissions;
            live.feeBps = offer.feeBps;
            live.feeRecipient = offer.feeRecipient;
        } else if (permissionsChange) {
            if (ok && offer.permissions == acceptedPermissions) {
                live.permissions = acceptedPermissions;
            } else {
                applied &= ~TermsLib.HOOK_PERMISSIONS;
                emit HookPermissionsDropped(current.target, acceptedPermissions);
            }
        }

        emit TermsApplied(_taxTerms(), _hookTerms(), live, applied);

        // Told to the caller rather than sent from here: a buy applies terms
        // BEFORE it seats anybody, so a context built now would hand the
        // incoming hook the outgoing occupant. The caller tells it once the
        // seat is settled.
        attached = hookChanges && _hookTerms().target != address(0);
    }

    /// @dev Tell a newly attached hook, if it asked to be told. Only ever
    ///      called where a seat is taken, never on an eviction.
    function _afterAttach(
        address account,
        uint256 price_,
        uint256 depositAmount
    ) internal {
        _after(
            F_AFTER_ATTACH,
            abi.encodeCall(
                ISlotHook.afterAttach,
                (_ctx(msg.sender, account, price_, depositAmount))
            )
        );
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
            address token = address(_settings().currency);
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
            _ledger().withdrawableOf[to] += amount;
            emit Credited(to, amount);
        }
    }

    function _vacate() internal {
        Occupancy storage o = _occupancy();
        o.occupant = address(0);
        o.price = 0;
        o.deposit = 0;
        o.since = 0;
        o.lastSettled = uint64(block.timestamp);
    }

    /**
     * @dev Pay out collected rent: the hook's accepted fee to its fee
     *      recipient, the rest to the recipient. Both through `_payOrCredit`, so
     *      this never reverts and makes no call into the hook itself.
     */
    function _flush() internal {
        Ledger storage l = _ledger();
        uint256 amount = l.collectedTax;
        if (amount == 0) return;
        l.collectedTax = 0;

        HookOffer storage h = _hookOffer();
        uint256 fee = Math.mulDiv(amount, h.feeBps, BASIS_POINTS);
        if (fee > 0) {
            _payOrCredit(h.feeRecipient, fee);
            emit HookFeePaid(_hookTerms().target, h.feeRecipient, fee);
        }

        address recipient = _taxTerms().recipient;
        _payOrCredit(recipient, amount - fee);
        emit TaxCollected(recipient, amount - fee);
    }

    /// @dev Pay `account`'s debt out of `available`, as collected tax. Returns
    ///      what was taken.
    function _repayDebt(address account, uint256 available) internal returns (uint256 taken) {
        Ledger storage l = _ledger();
        uint256 debt = l.debtOf[account];
        if (debt == 0 || available == 0) return 0;
        taken = debt < available ? debt : available;
        unchecked {
            l.debtOf[account] = debt - taken;
        }
        l.collectedTax += taken;
        emit DebtRepaid(account, taken);
    }

    /// @dev Pull `amount` of the slot's currency from `from`, and refuse a
    ///      token that delivers anything else. Every caller credits `amount` to
    ///      somebody's escrow or to the recipient; a fee-on-transfer token would
    ///      leave those credits backed by less than they say, paid out of the
    ///      next depositor's money.
    function _pull(address from, uint256 amount) internal {
        if (amount == 0) return;
        IERC20 token = _settings().currency;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert CurrencyTakesACut(amount, received);
    }
}
