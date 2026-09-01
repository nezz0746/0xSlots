// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "./SlotMath.sol";

/**
 * @title SlotConstants
 * @notice The protocol's fixed numbers, readable on-chain.
 *
 * @dev Contract-level rather than file-level, which is a difference in
 *      VISIBILITY and nothing else — a `constant` occupies no storage either
 *      way and is inlined at every use.
 *
 *      What contract level buys is an ABI entry. A file-level constant cannot
 *      be read by a client or by another contract, so every consumer keeps its
 *      own copy of the number — and a hardcoded copy of protocol arithmetic is
 *      exactly what drifted from `quoteBuy` and `minDepositForBuy` in this
 *      codebase already. A caller that can ask does not have to guess.
 *
 *      Inherited by `SlotStorage` and by the hooks, which sit outside the
 *      slot's chain and would otherwise import the same numbers by hand. It
 *      declares no state, so it costs no storage slot and moves nothing.
 */
abstract contract SlotConstants {
    // Ceiling on a self-assessed price.
    // So `price * taxPercentage * elapsed` cannot be driven to overflow. That
    //      product is computed on every settle, and every entry point settles
    //      first — so an overflow there used to revert `liquidate()` and brick a
    //      slot permanently, for the cost of gas. 2^128-1 is ~3.4e38, past any
    //      real valuation in a token's smallest unit.
    uint256 public constant MAX_PRICE = type(uint128).max;

    // Ceiling on the monthly rate, in basis points. The other factor in
    //         that same product.
    uint256 public constant MAX_TAX_BPS = 10_000;

    uint256 public constant BASIS_POINTS = SlotMath.BASIS_POINTS;
    uint256 public constant MONTH = SlotMath.MONTH;

    // Gas handed to a hook's `after` callbacks.
    // Bounded because these run inside `buy`, `sell`, `release` and
    //      `liquidate`. A hook must never be able to price out an eviction.
    uint256 public constant HOOK_GAS = 500_000;

    // Gas for a native payout before it degrades to a claimable credit.
    // A native send runs the recipient's code, and this fires inside SOMEONE
    //      ELSE'S transaction — a buy, a liquidation. Uncapped, an outgoing
    //      occupant with a greedy `receive()` could make their own eviction
    //      expensive and unreliable. 30k covers an EOA and a typical Safe.
    uint256 public constant PAYOUT_GAS = 30_000;

    // How long a proposal must sit before an occupancy transition may apply it.
    //
    // Without this, `proposeTerms` in block N binds a buyer in block N: the
    // manager watches the mempool, raises the tax, and the incoming occupant is
    // seated on terms they never saw. The deferral to a transition was only ever
    // half the guarantee; this is the other half, and it is what
    // `pending.proposedAt` was recorded for and never used.
    uint64 public constant TERMS_DELAY = 1 days;
}
