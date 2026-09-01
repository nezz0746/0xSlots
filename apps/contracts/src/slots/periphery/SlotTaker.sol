// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Slot} from "../Slot.sol";

/**
 * @title SlotTaker
 * @notice Evict an insolvent occupant and take the slot, in one transaction.
 *
 * @dev ── Why this is not in `Slot` ────────────────────────────────────────
 *
 *      It was, briefly, as `liquidateAndTake`. It should not have been.
 *
 *      "Evict, then buy" is a composition of two public entry points, and the
 *      core already composes: `multicall` does exactly this on an ERC-20 slot.
 *      The only gap was native ETH, because OZ's `Multicall` is non-payable —
 *      and the answer to one currency's plumbing problem is not a second
 *      seating path inside the slot, with its own quote, its own ordering, and
 *      its own set of invariants to keep in step with `buy`.
 *
 *      A periphery contract can be payable and forward value, which closes the
 *      gap without the core taking an opinion. Deploy another one that
 *      composes differently and it competes; the slot neither knows nor cares.
 *
 *      ── What this does not fix ─────────────────────────────────────────
 *
 *      Not a defence against a defaulter recycling their own seat. That was
 *      never about the entry point — the same sequence runs through
 *      `multicall` — and it is fixed where it belonged, by carrying arrears in
 *      `Slot` rather than forgiving them.
 *
 *      Holds nothing. Every value it receives goes straight out in the same
 *      call, and a slot it fails to seat reverts the whole transaction.
 */
contract SlotTaker {
    error NothingToRefund();

    /**
     * @notice Liquidate `slot` and buy it in the same transaction.
     *
     * @param maxPayment Passed through to `buy`. Zero disables the ceiling —
     *        pass a real one on an ERC-20 slot, where nothing else bounds what
     *        the sitting price can be raised to before this lands.
     */
    function liquidateAndTake(
        Slot slot,
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 maxPayment
    ) external payable {
        slot.liquidate();
        slot.buy{value: msg.value}(
            account,
            depositAmount,
            selfAssessedPrice,
            maxPayment
        );
    }

    /// @notice What `liquidateAndTake` will charge for `depositAmount`.
    /// @dev The eviction vacates the slot before the purchase reads the price,
    ///      so there is no occupant left to pay — the answer is the deposit,
    ///      plus any arrears `account` is carrying. `price()` still reads
    ///      non-zero until the call lands, so a client reasoning by analogy
    ///      with `buy` overpays: reverting on a native slot, and quietly
    ///      pulling the surplus on an ERC-20 one.
    function quote(
        Slot slot,
        address account,
        uint256 depositAmount
    ) external view returns (uint256) {
        return depositAmount + slot.arrearsOf(account);
    }
}
