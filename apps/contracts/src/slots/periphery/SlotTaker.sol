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
    /// @notice This slot is an ERC-20 slot; use the slot's own `multicall`.
    /// @dev `Slot.buy` pulls from `msg.sender`, which here is this contract,
    ///      and it holds nothing and grants no allowance. Rather than let the
    ///      call fail deep inside a transfer, say so at the door — and say
    ///      where to go instead, because the ERC-20 path genuinely does exist
    ///      and needs no periphery at all.
    error UseMulticallForErc20();

    /**
     * @notice Liquidate `slot` and buy it in the same transaction.
     *
     * @dev NATIVE SLOTS ONLY. An ERC-20 slot needs no periphery: the slot's
     *      inherited `multicall` already composes `liquidate()` and `buy()`,
     *      and the allowance goes to the slot where it belongs. This contract
     *      exists solely because OZ's `Multicall` is non-payable, so the same
     *      composition cannot carry ETH.
     *
     * @param maxPayment Passed through to `buy`. Zero disables the ceiling.
     *        On a native slot `buy`'s exact-`msg.value` check already bounds
     *        the payment, so the ceiling matters less here than on the ERC-20
     *        path — where it is the only bound there is.
     */
    function liquidateAndTake(
        Slot slot,
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 maxPayment
    ) external payable {
        if (address(slot.currency()) != address(0)) {
            revert UseMulticallForErc20();
        }
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
    /// @dev Currency-agnostic, unlike `liquidateAndTake` — the arithmetic is
    ///      the same either way, and a client on the ERC-20 path still needs
    ///      the number before it builds its `multicall`.
    function quote(
        Slot slot,
        address account,
        uint256 depositAmount
    ) external view returns (uint256) {
        return depositAmount + slot.arrearsOf(account);
    }
}
