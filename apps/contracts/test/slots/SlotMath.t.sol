// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../../src/SlotMath.sol";

/// @notice The arithmetic on its own, where the properties are visible.
contract SlotMathTest is Test {
    uint256 constant DEN = 30 days * 10_000;

    // ── the two rounding directions, and why each is what it is ───────────

    /// @notice Accrual floors: you are never charged for a second you did not
    ///         hold the slot.
    function test_TaxFloors() public pure {
        // one second at a price too small to price one unit
        assertEq(SlotMath.taxFor(1, 1, 1), 0);
        // and exactly a month at 100% is the price
        assertEq(SlotMath.taxFor(1e18, 10_000, 30 days), 1e18);
    }

    /// @notice The requirement ceils: a window can never be funded for nothing.
    ///         This is the direction that stops protection being free.
    function test_DepositCeilsAndNeverRoundsToZero() public pure {
        assertEq(SlotMath.depositFor(1, 1, 1), 1, "never zero for a real ask");
        assertGe(
            SlotMath.depositFor(1e18, 500, 7 days),
            SlotMath.taxFor(1e18, 500, 7 days),
            "the deposit must cover the tax it is sized against"
        );
    }

    function test_ZeroWindowNeedsNothing() public pure {
        assertEq(SlotMath.depositFor(1e30, 10_000, 0), 0);
    }

    // ── the inverse ───────────────────────────────────────────────────────

    /// @notice `secondsFor` inverts `taxFor` — the property the old
    ///         per-second rate broke by dividing before multiplying.
    function testFuzz_SecondsForInvertsTaxFor(
        uint128 price,
        uint16 taxBps,
        uint32 elapsed
    ) public pure {
        vm.assume(price > 0 && taxBps > 0 && taxBps <= 10_000);
        uint256 owed = SlotMath.taxFor(price, taxBps, elapsed);
        uint256 back = SlotMath.secondsFor(owed, price, taxBps);
        // Never claims MORE time than was paid for.
        assertLe(back, uint256(elapsed));
    }

    /// @notice The bug this replaced: a per-second rate floors to zero and
    ///         reports "never" for a position that is genuinely draining.
    function test_ANaiveRateWouldSayNeverHereAndThisDoesNot() public pure {
        uint256 price = 100e6;   // 100 USDC
        uint256 taxBps = 100;    // 1%/month
        assertEq(Math.mulDiv(price, taxBps, DEN), 0, "per-second rate is zero");

        uint256 runway = SlotMath.secondsFor(1e6, price, taxBps);
        assertLt(runway, type(uint256).max, "must be a real number");
        assertGt(SlotMath.taxFor(price, taxBps, runway + 1), 0, "and it drains");
    }

    function test_AZeroRateIsForever() public pure {
        assertEq(SlotMath.secondsFor(1e18, 0, 500), type(uint256).max);
        assertEq(SlotMath.secondsFor(1e18, 1e18, 0), type(uint256).max);
    }

    // ── overflow, the reason `mulDiv` is used at all ──────────────────────

    /// @notice At realistic bounds the plain product does NOT overflow — worth
    ///         stating, because it is why the old plain-multiply sites were a
    ///         latent asymmetry rather than a live bug.
    function test_TheNaiveProductIsFineAtRealisticBounds() public pure {
        uint256 price = type(uint128).max;   // MAX_PRICE
        uint256 taxBps = 10_000;             // MAX_TAX_BPS
        uint256 window = 3650 days;          // ten years

        unchecked {
            uint256 naive = price * taxBps * window;
            assertEq(naive / taxBps / window, price, "no wrap at these bounds");
        }
        assertGt(SlotMath.depositFor(price, taxBps, window), 0);
    }

    /// @notice But `mulDiv` survives where the plain form would wrap, and the
    ///         window is an unbounded constructor/init argument — so the
    ///         guarantee is worth having even though no sane config reaches it.
    function test_SurvivesAProductThatWouldOverflow() public pure {
        uint256 price = type(uint128).max;
        uint256 taxBps = 10_000;
        uint256 window = 1e35;               // past 2^256 / (price * taxBps)

        unchecked {
            uint256 naive = price * taxBps * window;
            assertTrue(naive / taxBps / window != price, "the plain form wraps");
        }

        assertGt(SlotMath.depositFor(price, taxBps, window), 0, "mulDiv does not");
        assertGt(SlotMath.taxFor(price, taxBps, window), 0);
    }

}
