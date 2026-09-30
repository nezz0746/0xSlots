// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScopesLib} from "../libraries/ScopesLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../libraries/SlotMath.sol";
import {SlotModules} from "./SlotModules.sol";
import {ISlotModule, SlotContext} from "../interfaces/ISlotModule.sol";
import {TaxTerms, ModuleTerms, ModuleFee, Pending, InstalledModule} from "../types/SlotTypes.sol";
import {ModuleLib} from "../libraries/ModuleLib.sol";
import {Occupancy, Ledger} from "./SlotStorage.sol";
import {TermsLib} from "../libraries/TermsLib.sol";
import {InvalidDeposit, CurrencyTakesACut} from "../errors/SlotErrors.sol";

/**
 * @title SlotAccounting
 * @notice Tax accrual, payout, and the deferred-terms boundary.
 */
abstract contract SlotAccounting is SlotModules {
    using SafeERC20 for IERC20;
    using TermsLib for Pending;
    using ModuleLib for InstalledModule;

    event Settled(uint256 owed, uint256 paid, uint256 depositLeft);
    event TaxPaid(address indexed payer, uint256 owed, uint256 paid);
    event TaxCollected(address indexed recipient, uint256 amount);
    event ModuleFeePaid(address indexed module, address indexed recipient, uint256 amount);
    event Credited(address indexed account, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    /// @notice The occupant's debt from a shortfall this tenure was paid, out of
    ///         a top-up or out of what a buyout pays them.
    event DebtRepaid(address indexed account, uint256 amount);
    /// @notice Queued terms took effect. `taxTerms`, `moduleTerms`, `scopes` and
    ///         `fee` are what is now in force; `mask` says which terms changed.
    event TermsApplied(
        TaxTerms taxTerms, ModuleTerms moduleTerms, uint16 scopes, ModuleFee fee, uint16 mask
    );
    /// @notice A queued module could not be attached and was dropped instead of
    ///         being allowed to block the transition. The slot keeps the module
    ///         it had.
    event ModuleDropped(address indexed module);
    /// @notice Accepted scopes were not applied, because the module no
    ///         longer declares them. The slot keeps the scopes it had.
    event ScopesDropped(address indexed module, uint16 scopes);

    function _isNative() internal view returns (bool) {
        return address(_governance().currency) == address(0);
    }

    /// @notice Tax owed since the last settlement, capped by nothing — this is
    ///         the raw debt, which may exceed the deposit.
    function taxOwed() public view returns (uint256) {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) return 0;
        (uint256 owed,) = SlotMath.accrue(
            o.price, _taxTerms().rateBps, block.timestamp - o.lastSettled, o.taxCarry
        );
        return owed;
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
            // forge-lint: disable-next-line(unsafe-typecast)
            o.lastSettled = uint64(upTo); // a timestamp
            return;
        }

        // The clock always reaches now, and whatever fell short of a whole
        // unit is carried rather than dropped. That is the whole defence
        // against grinding: a free `topUp(0)` every block cannot shave a
        // fraction off each settle, because no fraction is ever discarded —
        // and no window is ever left open for a later price or rate to reach
        // back into, because there is none.
        (uint256 owed, uint256 carry) =
            SlotMath.accrue(o.price, _taxTerms().rateBps, upTo - o.lastSettled, o.taxCarry);
        // forge-lint: disable-next-line(unsafe-typecast)
        o.lastSettled = uint64(upTo); // a timestamp
        // forge-lint: disable-next-line(unsafe-typecast)
        o.taxCarry = uint64(carry); // < MONTH * BASIS_POINTS, see SlotMath.accrue

        uint256 paid;
        if (owed >= o.deposit) {
            // `owed == 0` here implies `deposit == 0`: no tax to take, no debt
            // to carry, and a `Settled` that would report zeros against an
            // escrow that did not move.
            if (owed == 0) return;

            paid = o.deposit;
            o.deposit = 0;
            // What the deposit could not cover is carried for the rest of the
            // tenure, not forgiven: a top-up pays it first, and so does the
            // price a buyer pays this occupant. It ends with the tenure,
            // because `buy` seats whoever the payer names — debt that outlived
            // the seat could be pinned on any address, for free.
            unchecked {
                if (owed > paid) _ledger().debtOf[o.occupant] += owed - paid;
            }
        } else {
            paid = owed;
            o.deposit -= owed;
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
        ctx.taxOwed = owed;
        ctx.taxPaid = paid;
        _after(ScopesLib.AFTER_SETTLE, abi.encodeCall(ISlotModule.afterSettle, (ctx)));
    }

    /// @notice Whether any queued terms have sat long enough to land. Tax
    ///         terms and the module each ripen on their own clock.
    /// @dev `buy` and `applyTerms` are WHERE terms land; the delay is WHEN they
    ///      may. Public because a buyer has to be able to ask: anything sizing a
    ///      deposit against queued terms has to agree with `_applyPending`
    ///      about whether they are going to apply.
    function hasRipeTerms() public view returns (bool) {
        return _pending().isRipe(TERMS_DELAY);
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
     *      reads the incoming module, and an eviction that reads a module is an
     *      eviction a module can make expensive. A vacated slot keeps the terms
     *      it had until the next buyer funds the new ones, which is when they
     *      matter.
     *
     *      ── Rent is paid out BEFORE anything changes ─────────────────────
     *
     *      Collected rent was earned under the outgoing terms: their recipient
     *      and their module fee. Flushing first means the pot only ever holds rent
     *      earned under the terms in force, so a fee or recipient change can
     *      never reach back into it, and no history needs keeping.
     */
    function _applyPending() internal returns (bool attached) {
        Pending storage q = _pending();
        // Only what is ripe lands; a group still inside its delay stays queued.
        uint16 ripe = q.ripe(TERMS_DELAY);
        if (ripe == 0) return false;

        bool moduleChanges = ripe & TermsLib.MODULE != 0;
        // Never both: a queued module brings its own scopes.
        bool scopesChange = ripe & TermsLib.SCOPES != 0;
        // What the manager reviewed: the whole proposed module, or only the
        // scopes accepted from the current one. Copied out before the queue
        // is emptied.
        InstalledModule memory next = q.nextModule;
        InstalledModule storage live = _module();

        _flush();

        // Read the module before anything moves. Re-read here rather than
        // trusted from proposal or acceptance: a module could have been
        // upgraded in the interval, and the copy has to describe the code that
        // will run. FAIL-OPEN: a module that stopped answering must not be
        // able to wedge the queue shut.
        bool ok;
        uint16 declaredScopes;
        ModuleFee memory declaredFee;
        if (moduleChanges) {
            (ok, declaredScopes, declaredFee) =
                _tryReadModule(ModuleTerms({module: next.module, settings: next.settings}));
        } else if (scopesChange) {
            (ok, declaredScopes,) = _tryReadModule(live.terms());
        }

        // Dropped rather than installed when the module no longer declares
        // what the manager reviewed. The re-read is what makes an upgraded
        // module honest; the comparison is what stops it being a second,
        // unreviewed proposal. A dropped change moves nothing: the slot keeps
        // the module it had, and that module is never told it was removed.
        bool dropped =
            moduleChanges && next.module != address(0)
            && (!ok || declaredScopes != next.scopes || !ModuleLib.sameFee(declaredFee, next.fee));

        // The outgoing module is told BEFORE anything moves, while the record
        // and the tax terms still describe the slot it served, so it is handed
        // its own settings. Never fatal.
        if (moduleChanges && !dropped) _onUninstall();

        uint16 applied = q.applyQueued(_taxTerms(), ripe);

        if (dropped) {
            applied &= ~TermsLib.MODULE;
            emit ModuleDropped(next.module);
        } else if (moduleChanges) {
            live.install(next);
            attached = next.module != address(0);
        } else if (scopesChange) {
            if (ok && declaredScopes == next.scopes) {
                live.scopes = next.scopes;
            } else {
                applied &= ~TermsLib.SCOPES;
                emit ScopesDropped(live.module, next.scopes);
            }
        }

        // A new module is told it was attached by the caller, not here: a buy
        // applies terms BEFORE it seats anybody, so a context built now would
        // hand the incoming module the outgoing occupant.
        emit TermsApplied(_taxTerms(), live.terms(), live.scopes, live.fee, applied);
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

        uint256 unpaid = amount;
        if (_isNative()) {
            (bool sent,) = to.call{value: amount, gas: NATIVE_PAYOUT_GAS_LIMIT}("");
            if (sent) unpaid = 0;
        } else {
            address token = address(_governance().currency);
            if (token.code.length > 0) {
                // MEASURED, not decoded. What a token answers and what it did
                // are two different facts, and trusting the answer fails in
                // both directions: a token that moves the funds and answers
                // `2` gets credited on top — paid twice, the second time out of
                // other occupants' escrow — while one that answers `2` and
                // moves nothing would be marked paid and the payee would lose
                // it. The balance delta is the only answer both agree on.
                (bool okBefore, uint256 before) = _selfBalance(token);
                (bool ok, bytes memory data) =
                    token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
                (bool okAfter, uint256 afterward) = _selfBalance(token);

                if (ok && okBefore && okAfter) {
                    uint256 moved = before > afterward ? before - afterward : 0;
                    unpaid = moved >= amount ? 0 : amount - moved;
                } else if (ok) {
                    // A currency whose `balanceOf` will not answer: fall back to
                    // the reply. Decoded by hand, because `abi.decode(data,
                    // (bool))` reverts on any word that is not 0 or 1 — and it
                    // would revert HERE, in a function whose whole contract is
                    // that it never does.
                    if (data.length == 0) {
                        unpaid = 0;
                    } else if (data.length >= 32 && abi.decode(data, (uint256)) == 1) {
                        unpaid = 0;
                    }
                }
            }
        }

        if (unpaid != 0) {
            _ledger().claimableOf[to] += unpaid;
            emit Credited(to, unpaid);
        }
    }

    /// @dev `balanceOf(this)` that cannot revert, for `_payOrCredit`.
    function _selfBalance(address token) private view returns (bool ok, uint256 bal) {
        bytes memory data;
        (ok, data) = token.staticcall(abi.encodeCall(IERC20.balanceOf, (address(this))));
        if (!ok || data.length < 32) return (false, 0);
        bal = abi.decode(data, (uint256));
    }

    /// @dev End the tenure. Always called straight after `_settle`, which has
    ///      already moved `lastSettled` to now. Any debt the occupant still
    ///      carries ends here with the seat.
    function _vacate() internal {
        Occupancy storage o = _occupancy();
        delete _ledger().debtOf[o.occupant];
        o.occupant = address(0);
        o.price = 0;
        o.deposit = 0;
        o.occupiedSince = 0;
        o.taxCarry = 0;
    }

    /**
     * @dev Pay out collected rent: the module's accepted fee to its fee
     *      recipient, the rest to the recipient. Both through `_payOrCredit`, so
     *      this never reverts and makes no call into the module itself.
     */
    function _flush() internal {
        Ledger storage l = _ledger();
        uint256 amount = l.collectedTax;
        if (amount == 0) return;
        l.collectedTax = 0;

        InstalledModule storage m = _module();
        uint256 fee = Math.mulDiv(amount, m.fee.bps, BASIS_POINTS);
        if (fee > 0) {
            _payOrCredit(m.fee.recipient, fee);
            emit ModuleFeePaid(m.module, m.fee.recipient, fee);
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
        IERC20 token = _governance().currency;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert CurrencyTakesACut(amount, received);
    }
}
