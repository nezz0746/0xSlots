// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "../libraries/SlotMath.sol";

/**
 * @title SlotConstants
 * @notice The protocol's fixed numbers.
 *
 * @dev Public, so a client or another contract asks rather than keeping its
 *      own copy — a hardcoded copy of protocol arithmetic is exactly what
 *      drifted from `quoteBuy` and `minDepositForBuy` in this codebase
 *      already. `SlotLens.getSlotConstants` reads them all in one call.
 *
 *      Inherited by `SlotStorage`. It declares no state, so it costs no
 *      storage slot and moves nothing.
 */
abstract contract SlotConstants {
    // Ceiling on a self-assessed price, so `price * taxRateBps * elapsed`
    // cannot be driven to overflow. That product is computed on every settle,
    // and every entry point settles first, so an overflow there would revert
    // `liquidate()` and brick a slot permanently for the cost of gas. 2^128-1
    // is ~3.4e38, past any real valuation in a token's smallest unit.
    uint256 public constant MAX_PRICE = type(uint128).max;

    // Ceiling on the monthly rate, in basis points. The other factor in that
    // same product.
    uint256 public constant MAX_TAX_BPS = 10_000;

    // Ceiling on `minRunwaySeconds`: a year, the same bound a minimum tenure
    // has. The escrow floor is `price * rate * runway`, so at the top rate this
    // caps it near twelve times the price; left at `uint32` it reached ~1,657x,
    // which a manager could queue to price out every buyer and every sale.
    uint32 public constant MAX_MIN_RUNWAY = 365 days;

    uint256 public constant BASIS_POINTS = SlotMath.BASIS_POINTS;
    uint256 public constant MONTH = SlotMath.MONTH;

    // Gas handed to a module's `after` callbacks.
    // Bounded because these run inside `buy`, `release` and `liquidate`. A module must never be able to price out an eviction.
    uint256 public constant MODULE_CALLBACK_GAS_LIMIT = 500_000;

    // Gas for a native payout before it degrades to a claimable credit.
    // A native send runs the recipient's code, and this fires inside SOMEONE
    //      ELSE'S transaction — a buy, a liquidation. Uncapped, an outgoing
    //      occupant with a greedy `receive()` could make their own eviction
    //      expensive and unreliable. 30k covers an EOA and a typical Safe.
    uint256 public constant NATIVE_PAYOUT_GAS_LIMIT = 30_000;

    // How long a proposal must sit before it may be applied.
    //
    // Without this, `proposeTerms` in block N binds a buyer in block N: the
    // manager watches the mempool, raises the tax, and the incoming occupant is
    // seated on terms they never saw.
    uint64 public constant TERMS_DELAY = 1 hours;

    // Term bits for `proposeTerms` and `cancelTerms`. Mirrors `TermsLib`.
    // `TERM_SCOPES` is queued by `grant`, never proposed.
    uint16 public constant TERM_TAX_RATE = 1 << 0;
    uint16 public constant TERM_RECIPIENT = 1 << 1;
    uint16 public constant TERM_MIN_RUNWAY = 1 << 2;
    uint16 public constant TERM_MODULE = 1 << 3;
    uint16 public constant TERM_SCOPES = 1 << 4;
}
