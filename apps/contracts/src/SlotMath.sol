// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SlotMath
 * @notice The Harberger arithmetic, in one place.
 *
 * @dev ── Why a library and not a base contract ──────────────────────────
 *
 *      Because one caller cannot inherit. `MinimumTenureHook` sits outside the
 *      slot's chain by design — a hook is a stranger — yet it has to size a
 *      deposit with exactly the formula the slot will charge against. It was
 *      computing that by hand, and the two agreeing was a coincidence
 *      maintained by nobody. When a hook's funding check and the slot's
 *      disagree, the slot seats an occupant the hook believed was funded.
 *
 *      `internal` functions, so every call is inlined: no deployment, no
 *      library linking, no delegatecall, no storage. This is a shared spelling
 *      of an equation, not a component.
 *
 *      ── The asymmetry this closes ───────────────────────────────────────
 *
 *      `taxOwed` was deliberately `mulDiv`: the plain `a * b / c` multiplies
 *      before it divides, and a large price overflowed — reverting every entry
 *      point, all of which settle first, and bricking the slot permanently.
 *      The deposit requirement kept the plain product in three places and was
 *      never converted. Same product, same risk, one of them fixed. Both go
 *      through `mulDiv` here.
 */
library SlotMath {
    /// @notice Basis points. Tax is quoted per 30 days, in these.
    uint256 internal constant BASIS_POINTS = 10_000;

    /// @notice The tax period. Not a calendar month — a fixed 30 days, so the
    ///         rate means the same thing in every month of the year.
    uint256 internal constant MONTH = 30 days;

    /// @dev The shared denominator. Named once so no call site can mistype it.
    uint256 private constant DEN = MONTH * BASIS_POINTS;

    /**
     * @notice Tax accrued on `price` over `elapsed` seconds.
     *
     * @dev Rounds DOWN, and the caller must not treat the shortfall as paid:
     *      a window too short to price one unit of currency accrues zero, so
     *      advancing a settlement clock to `now` regardless destroys that
     *      window's tax. See `secondsFor` for the inverse a settler needs.
     */
    function taxFor(
        uint256 price,
        uint256 taxBps,
        uint256 elapsed
    ) internal pure returns (uint256) {
        return Math.mulDiv(price, taxBps * elapsed, DEN);
    }

    /**
     * @notice The smallest deposit that funds `window` seconds at `price`.
     *
     * @dev Rounds UP, and that direction is load-bearing: rounding down let a
     *      short window on a low price price to zero, so a minimum runway —
     *      or a hook's protection window — could be bought for nothing.
     */
    function depositFor(
        uint256 price,
        uint256 taxBps,
        uint256 window
    ) internal pure returns (uint256) {
        if (window == 0) return 0;
        return Math.mulDiv(price, taxBps * window, DEN, Math.Rounding.Ceil);
    }

    /**
     * @notice How many seconds `amount` of tax buys at `price`.
     *
     * @dev The inverse of `taxFor`, in the same numerator space rather than
     *      via a per-second rate. A rate divides before it multiplies, so it
     *      floors to zero whenever `price * taxBps < MONTH * BASIS_POINTS` —
     *      and a caller then reads "never runs out" for a position that is
     *      insolvent inside the month.
     *
     *      A zero rate really is forever: nothing accrues, so nothing expires.
     */
    function secondsFor(
        uint256 amount,
        uint256 price,
        uint256 taxBps
    ) internal pure returns (uint256) {
        uint256 rate = price * taxBps;
        if (rate == 0) return type(uint256).max;
        return Math.mulDiv(amount, DEN, rate);
    }
}
