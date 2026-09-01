// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BASIS_POINTS, MONTH} from "./SlotStorage.sol";
import "./SlotErrors.sol";
import {SlotOrders} from "./SlotOrders.sol";

/**
 * @title SlotViews
 * @notice Everything you can ask a slot without changing it.
 *
 * @dev Split out because reads are the half of this contract that other
 *      people build against, and they were buried among the transitions that
 *      move the state they report. Nothing here writes; if a function in this
 *      file is not `view`, it is in the wrong file.
 */
abstract contract SlotViews is SlotOrders {
    // ─── reads ──────────────────────────────────────────────────────────────

    function occupant() public view returns (address) {
        return _occupant;
    }

    function price() public view returns (uint256) {
        return _price;
    }

    function deposit() public view returns (uint256) {
        return _deposit;
    }

    function isVacant() public view returns (bool) {
        return _occupant == address(0);
    }

    /// @notice True when the deposit can no longer cover what is owed.
    function isInsolvent() public view returns (bool) {
        return _occupant != address(0) && taxOwed() >= _deposit;
    }

    /// @notice Seconds until the deposit runs out. `type(uint256).max` if never.
    function secondsUntilLiquidation() external view returns (uint256) {
        if (_occupant == address(0)) return type(uint256).max;
        uint256 owed = taxOwed();
        if (owed >= _deposit) return 0;
        // Inverted from the same numerator space `taxOwed` uses, rather than
        // via a per-second rate. A rate divides before it multiplies, so it
        // floors to zero for any price x tax below MONTH * BASIS_POINTS — and
        // the function then answered "never" for a position that was genuinely
        // insolvent within the month. That is the wrong direction to be wrong
        // in: it is keepers and UIs that read this.
        uint256 rate = _price * taxPercentage;
        if (rate == 0) return type(uint256).max;
        return Math.mulDiv(_deposit - owed, MONTH * BASIS_POINTS, rate);
    }

    /**
     * @notice The smallest deposit `buy` or `sell` will accept at `price_`.
     *
     * @dev Reads the PENDING tax when one is queued, because entry is an
     *      occupancy transition and `_applyPending` runs before the funding
     *      check — so a buyer funds the terms they are buying into, not the
     *      ones they can see today. A client sizing the deposit from
     *      `taxPercentage()` underquotes through exactly that window and the
     *      buy reverts `InvalidDeposit`.
     *
     *      `selfAssess` is deliberately not covered here: it is not a
     *      transition, applies nothing, and is checked against current terms.
     */
    function minDepositForBuy(uint256 price_) public view returns (uint256) {
        if (minDepositSeconds == 0) return 0;
        uint256 tax = (pending.hasTax && pendingApplies())
            ? pending.taxPercentage
            : taxPercentage;
        return Math.ceilDiv(price_ * tax * minDepositSeconds, MONTH * BASIS_POINTS);
    }

    /**
     * @notice What `buy` will charge for `depositAmount`.
     *
     * @dev The payment rule is not obvious and it is not stable across entry
     *      points, so the contract states it rather than leaving every client
     *      to re-derive it. A taker pays the sitting occupant's asking price
     *      plus their own deposit; a taker of a vacant slot pays only the
     *      deposit, because `_vacate` zeroes the price.
     *
     *      For a native slot this is exactly the `msg.value` to send — `buy`
     *      checks it for equality, not for sufficiency.
     */
    function quoteBuy(address account, uint256 depositAmount)
        public
        view
        returns (uint256)
    {
        return
            (_occupant == address(0) ? 0 : _price) +
            depositAmount +
            arrearsOf[account];
    }


}
