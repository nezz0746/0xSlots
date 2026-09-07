// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../SlotMath.sol";
import {HookBounds} from "../IDescribedHook.sol";
import {SlotContext} from "../ISlotHook.sol";

/**
 * @title MinimumTenure
 * @notice The minimum-tenure rule, without a hook around it.
 *
 * @dev A slot has exactly one hook, so a work that wants BOTH a tenure window
 *      and something else — AdLand's creatives, say — cannot attach two. The
 *      protocol briefly had a fan-out hook for this and it is gone: one
 *      `bytes32` of `hookData` cannot configure two children, `_afterOn`'s
 *      500k gas cap does not divide cleanly, strictness is ambiguous when one
 *      child declares it and another does not, and a veto arrives wearing the
 *      forwarder's name instead of its own.
 *
 *      So the rule is a base rather than a peer. {MinimumTenureHook} is this
 *      plus the `ISlotHook` surface, for a slot that wants tenure alone; any
 *      other hook inherits the same code and answers for both behaviours in
 *      one contract, one attach, one revert reason.
 *
 *      ── Why namespaced storage ──────────────────────────────────────────
 *
 *      Because AdLand is a UUPS proxy that is already live. Ordinary state in
 *      a new base contract lands at a slot decided by C3 linearization, so
 *      inheriting this the wrong way round would move every variable under a
 *      deployed contract — silently, and catastrophically. ERC-7201 puts this
 *      mapping at a fixed address derived from a name, so it cannot collide
 *      with a host's own storage and cannot move when the inheritance list is
 *      reordered. The cost is one assembly block; the alternative is a class
 *      of bug that only appears in production.
 *
 *      ── What the rule is ────────────────────────────────────────────────
 *
 *      For `tenureOf(hookData)` seconds after acquiring, an occupant can only
 *      be bought out at {BUYOUT_PREMIUM_BPS} of the price they declared. Entry
 *      must be funded for the whole window, the price cannot be cut while
 *      protected, and whoever vacates cannot walk straight back in. Forced
 *      sale is delayed, never removed: liquidation is untouched, and this rule
 *      never subscribes to it.
 */
abstract contract MinimumTenure {
    /// @notice The family a consumer matches to know this rule is in force.
    /// @dev On the RULE, not on {MinimumTenureHook}, because the hook is no
    ///      longer the only contract that enforces it — AdLand does too, and a
    ///      client should recognise the behaviour wherever it is hosted.
    bytes32 public constant TENURE_FAMILY =
        keccak256("slots.hook.minimum-tenure");

    /// @notice Descriptor version for {TENURE_FAMILY}.
    /// @dev 2 — the window is not part of any contract's address or storage,
    ///      so the descriptor cannot name it. A consumer reads `Slot.hookData`
    ///      and calls {tenureOf}, the only source that can be right per slot.
    uint32 public constant TENURE_DESCRIPTOR_VERSION = 2;

    /// @dev Long enough for any real lease, short enough that
    ///      `occupiedSince + window` cannot overflow a uint64 timestamp.
    uint256 public constant MAX_TENURE = 365 days;

    /**
     * @notice What a buyer must DECLARE to take a slot inside its window, as
     *         bps of the price the occupant declared. 100_000 = 10x.
     *
     * @dev The window is a veto on being outbid, not on being bought. Absolute
     *      it made a slot unbuyable at any price, and a slot priced at dust
     *      accrues no tax — so its occupant held it for ever for the cost of
     *      gas. Bounded, protection scales with what the occupant is actually
     *      exposed to, which is the trade this protocol is made of.
     */
    uint256 public constant BUYOUT_PREMIUM_BPS = 100_000;

    error TenureNotConfigured();
    error TenureTooLong(uint256 maxTenure);
    error TenureUnderfunded(uint256 required);
    error TenureNotElapsed(uint256 allowedAt);
    error PriceCutDuringTenure();
    error BuyoutBelowPremium(uint256 required);

    /// @custom:storage-location erc7201:slots.storage.MinimumTenure
    struct TenureStorage {
        /// @dev When an account that just vacated may take a given slot again.
        ///      A record of what happened, never configuration — nothing here
        ///      decides a slot's rules; `ctx.hookData` does, and the slot owns
        ///      that.
        mapping(address slot => mapping(address account => uint256)) reentryAllowedAt;
    }

    // keccak256(abi.encode(uint256(keccak256("slots.storage.MinimumTenure")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant TENURE_STORAGE =
        0xf923bf7d07624871d662e2b606afa252ba51463ec8bccd5ae65c3ac454e6b600;

    function _tenure() private pure returns (TenureStorage storage $) {
        assembly ("memory-safe") {
            $.slot := TENURE_STORAGE
        }
    }

    /// @notice When `account` may take `slot` again, having vacated it.
    function reentryAllowedAt(
        address slot,
        address account
    ) public view returns (uint256) {
        return _tenure().reentryAllowedAt[slot][account];
    }

    /**
     * @notice The window this slot configured, in seconds.
     *
     * @dev Zero is not a short window, it is an unconfigured one, and it is
     *      rejected rather than read as "no protection". A slot that meant to
     *      have no minimum tenure attaches no hook; one that attached a hook
     *      carrying this rule and left the data empty has made a mistake.
     */
    function tenureOf(bytes32 data) public pure returns (uint256) {
        uint256 seconds_ = uint256(data);
        if (seconds_ == 0) revert TenureNotConfigured();
        if (seconds_ > MAX_TENURE) revert TenureTooLong(MAX_TENURE);
        return seconds_;
    }

    /**
     * @notice The ABI signature of this rule's share of a slot's `hookData`.
     *
     * @dev One value filling the word, so a client reads `uint256(hookData)`
     *      and writes `bytes32(value)` with no bit arithmetic. A future version
     *      that packs a per-slot premium beside the window would say
     *      `"uint64 window, uint32 premiumBps"` and bump the descriptor's
     *      version — the widths are in the types, so the signature is the
     *      layout.
     */
    function tenureSignature() public pure returns (string memory) {
        return "uint256 window";
    }

    /**
     * @notice What the value means, and what it is allowed to be.
     *
     * @dev Built from {MAX_TENURE} rather than a literal, so the form a client
     *      renders and the check {tenureOf} runs cannot disagree. Change the
     *      constant and both move together.
     *
     *      The minimum is 1 and not 0 because zero is not a short window, it is
     *      an unconfigured one and {tenureOf} refuses it. A host where the
     *      window is OPTIONAL — AdLand — says so by a slot leaving the word
     *      empty, not by a zero inside this range.
     */
    function tenureBounds() public pure returns (HookBounds[] memory b) {
        b = new HookBounds[](1);
        b[0] = HookBounds({
            name: "window",
            unit: "seconds",
            bounded: true,
            min: 1,
            max: MAX_TENURE
        });
    }

    /// @notice {tenureBounds} as a descriptor's `data` payload.
    function tenureBounds_() public pure returns (bytes memory) {
        return abi.encode(tenureBounds());
    }

    /// @notice The escrow a buy must post to fund a whole window at `price`.
    function requiredDeposit(
        uint256 price,
        uint256 taxBps,
        uint256 window
    ) public pure returns (uint256) {
        return SlotMath.depositFor(price, taxBps, window);
    }

    // ─── the rule ───────────────────────────────────────────────────────────

    /// @dev Refuse a buy that is underfunded, or that lands inside somebody
    ///      else's protection window. Call from `beforeBuy`.
    function _enforceTenureOnBuy(SlotContext calldata ctx) internal view {
        uint256 window = tenureOf(ctx.hookData);
        _requireFunded(ctx, window);

        // The account that just vacated cannot immediately retake it. This is
        // what closes the renewal loop: release-and-rebuy in one transaction
        // re-armed `occupiedSince` at no cost, and at a dust price the tax
        // floors to zero so liquidation never armed either.
        uint256 barred = reentryAllowedAt(ctx.slot, ctx.account);
        if (block.timestamp < barred) revert TenureNotElapsed(barred);

        // Vacant slots are otherwise always claimable — no tenure to protect.
        if (ctx.occupant == address(0)) return;

        // Out of the window: an ordinary buy, at any price.
        if (block.timestamp >= ctx.occupiedSince + window) return;

        // Inside it: only at the premium. `mulDiv` rather than `*`, so a price
        // near the top of the range cannot overflow the requirement into a
        // revert that reads as protection.
        uint256 required = Math.mulDiv(
            ctx.currentPrice,
            BUYOUT_PREMIUM_BPS,
            10_000
        );
        if (ctx.newPrice < required) revert BuyoutBelowPremium(required);
    }

    /// @dev No cutting your price while nobody is allowed to take it. Call
    ///      from `beforeSelfAssess`.
    function _enforceTenureOnSelfAssess(
        SlotContext calldata ctx
    ) internal view {
        uint256 window = tenureOf(ctx.hookData);
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + window) return;
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }

    /**
     * @dev Record who left, so they cannot walk straight back in. Call from
     *      `afterRelease` and `afterLiquidate`.
     *
     *      The slot calls those gas-capped and swallows a revert, so this must
     *      stay cheap and must not assume it succeeded — a missed write only
     *      means one account is not barred, never that a slot breaks.
     *
     *      `ctx.slot`, NOT `msg.sender`. The two hold the same address when
     *      the core calls directly, and diverged under the fan-out hook the
     *      protocol has since removed: the bar landed under the forwarder and
     *      the read found nothing. Keyed off the context on both sides, no
     *      caller can put them out of step again.
     */
    function _barReentry(SlotContext calldata ctx) internal {
        _tenure().reentryAllowedAt[ctx.slot][ctx.account] =
            block.timestamp +
            tenureOf(ctx.hookData);
    }

    function _requireFunded(
        SlotContext calldata ctx,
        uint256 window
    ) internal pure {
        uint256 basis = ctx.newPrice > ctx.currentPrice
            ? ctx.newPrice
            : ctx.currentPrice;
        uint256 required = requiredDeposit(basis, ctx.taxBps, window);
        if (ctx.depositAmount < required) revert TenureUnderfunded(required);
    }
}
