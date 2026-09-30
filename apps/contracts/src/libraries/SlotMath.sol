// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SlotMath
 * @notice The common-ownership arithmetic, in one place.
 *
 * @dev ── Why a library and not a base contract ──────────────────────────
 *
 *      Because one caller cannot inherit. `MinimumTenureModule` sits outside the
 *      slot's chain by design — a module is a stranger — yet it has to size a
 *      deposit with exactly the formula the slot will charge against. It was
 *      computing that by hand, and the two agreeing was a coincidence
 *      maintained by nobody. When a module's funding check and the slot's
 *      disagree, the slot seats an occupant the module believed was funded.
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
     * @notice The smallest deposit that funds `window` seconds at `price`.
     *
     * @dev Rounds UP, and that direction is load-bearing: rounding down let a
     *      short window on a low price price to zero, so a minimum runway —
     *      or a module's protection window — could be bought for nothing.
     */
    function depositFor(
        uint256 price,
        uint256 taxRateBps,
        uint256 window
    ) internal pure returns (uint256) {
        if (window == 0) return 0;
        return Math.mulDiv(price, taxRateBps * window, DEN, Math.Rounding.Ceil);
    }

    /**
     * @notice Seconds until `amount` more whole units have accrued, when
     *         `carry` of the next unit already has.
     *
     * @dev The exact inverse of {accrue}: the first second at which a settle
     *      would take `amount` more units. Ignoring the carry reported a time
     *      up to one unit's worth of seconds too late.
     */
    function secondsUntilOwed(
        uint256 amount,
        uint256 carry,
        uint256 price,
        uint256 taxRateBps
    ) internal pure returns (uint256) {
        uint256 rate = price * taxRateBps;
        if (rate == 0 || amount > type(uint256).max / DEN) return type(uint256).max;
        return Math.ceilDiv(amount * DEN - carry, rate);
    }

    /**
     * @notice Tax accrued on `price` over `elapsed`, plus a remainder carried
     *         from before: whole units owed now, and the new remainder.
     *
     * @dev Nothing is rounded away:
     *      the part of the numerator below one unit is returned to be carried,
     *      so a settle can always move its clock to now. Converting paid tax
     *      back into seconds instead — the previous design — forgave up to a
     *      whole unit per settle, and with `topUp(0)` free and permissionless
     *      that was repeatable every block: up to half the rent, in the right
     *      price band, for gas.
     *
     *      Plain arithmetic, no `mulDiv`: `MAX_PRICE` and `MAX_TAX_BPS` bound
     *      `price * taxRateBps * elapsed` far below 2^256.
     */
    function accrue(
        uint256 price,
        uint256 taxRateBps,
        uint256 elapsed,
        uint256 carry
    ) internal pure returns (uint256 owed, uint256 remainder) {
        uint256 num = price * taxRateBps * elapsed + carry;
        owed = num / DEN;
        remainder = num % DEN;
    }
}
