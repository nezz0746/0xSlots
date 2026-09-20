// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../libraries/SlotMath.sol";
import {AppSchemaLib} from "../libraries/AppSchemaLib.sol";
import {SlotContext} from "../interfaces/ISlotApp.sol";

/**
 * @title MinimumTenure
 * @notice The minimum-tenure rule, without an app around it.
 *
 * @dev A slot has exactly one app, so a work that wants BOTH a tenure window
 *      and something else — AdLand's creatives, say — cannot attach two. A
 *      fan-out app forwarding to both does not work: one `bytes32` of app data
 *      cannot configure two children, the 500k gas cap on a callback does not
 *      divide cleanly, strictness is ambiguous when one child declares it and
 *      another does not, and a veto arrives wearing the forwarder's name
 *      instead of its own.
 *
 *      So the rule is a base rather than a peer. {MinimumTenureApp} is this
 *      plus the `ISlotApp` surface, for a slot that wants tenure alone; any
 *      other app inherits the same code and answers for both behaviours in
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
 *      For `tenureOf(settings)` seconds after acquiring, an occupant can only
 *      be bought out at {BUYOUT_PREMIUM_BPS} of the price they declared. Entry
 *      must be funded for the whole window, the price cannot be cut while
 *      protected, and whoever vacates cannot walk straight back in. Forced
 *      sale is delayed, never removed: liquidation is untouched, and this rule
 *      never subscribes to it.
 */
abstract contract MinimumTenure {
    using AppSchemaLib for AppSchemaLib.Field;

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
    error NotTheSlot();

    /// @custom:storage-location erc7201:slots.storage.MinimumTenure
    struct TenureStorage {
        /// @dev When an account that just vacated may take a given slot again.
        ///      A record of what happened, never configuration — nothing here
        ///      decides a slot's rules; `ctx.appTerms.settings` does, and the slot owns
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
     *      have no minimum tenure attaches no app; one that attached an app
     *      carrying this rule and left the data empty has made a mistake.
     */
    function tenureOf(bytes32 data) public pure returns (uint256) {
        uint256 seconds_ = uint256(data);
        if (seconds_ == 0) revert TenureNotConfigured();
        if (seconds_ > MAX_TENURE) revert TenureTooLong(MAX_TENURE);
        return seconds_;
    }

    /**
     * @notice The window, as a field of an app's configuration schema.
     *
     * @dev Bounded by {MAX_TENURE} rather than by a literal, so the form a
     *      client renders and the check {tenureOf} runs cannot disagree: change
     *      the constant and both move together.
     *
     *      The minimum is 1 and not 0 because zero is not a short window, it is
     *      an unconfigured one and {tenureOf} refuses it. A host where the
     *      window is OPTIONAL — AdLand — says so by a slot leaving the whole
     *      configuration out, not by a zero inside this range.
     *
     *      `x-semantic` is what lets an application say "this slot protects its
     *      occupant" without knowing which app is enforcing the rule, or where
     *      in that app's configuration the number sits.
     */
    function tenureField(
        string memory name,
        string memory abiType
    ) internal pure returns (AppSchemaLib.Field memory) {
        return
            AppSchemaLib
                .number(name, abiType, "Minimum tenure", "seconds", 1, MAX_TENURE)
                .explain("How long an occupant is protected from being bought out.")
                .means("minimum-tenure");
    }

    /// @notice The escrow a buy must post to fund a whole window at `price`.
    function requiredDeposit(
        uint256 price,
        uint256 taxRateBps,
        uint256 window
    ) public pure returns (uint256) {
        return SlotMath.depositFor(price, taxRateBps, window);
    }

    // ─── the rule ───────────────────────────────────────────────────────────

    /// @dev How this host reads a slot's window out of its configuration.
    ///      The word IS the window here; a host whose configuration holds more
    ///      overrides this.
    function _windowOf(bytes32 settings) internal view virtual returns (uint256) {
        return tenureOf(settings);
    }

    /// @dev Refuse a buy that is underfunded, or that lands inside somebody
    ///      else's protection window. Call from `beforeBuy`.
    function _enforceTenureOnBuy(SlotContext calldata ctx) internal view {
        uint256 window = _windowOf(ctx.appTerms.settings);
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
        uint256 window = _windowOf(ctx.appTerms.settings);
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
     *      Only the slot itself may write its bar. The `after` entry points are
     *      world-callable, and a forged context would otherwise bar any account
     *      from any slot. `ctx.slot` then keys the write and the read alike.
     */
    function _barReentry(SlotContext calldata ctx) internal {
        if (msg.sender != ctx.slot) revert NotTheSlot();
        _tenure().reentryAllowedAt[ctx.slot][ctx.account] =
            block.timestamp +
            _windowOf(ctx.appTerms.settings);
    }

    function _requireFunded(
        SlotContext calldata ctx,
        uint256 window
    ) internal pure {
        uint256 basis = ctx.newPrice > ctx.currentPrice
            ? ctx.newPrice
            : ctx.currentPrice;
        uint256 required = requiredDeposit(basis, ctx.taxRateBps, window);
        if (ctx.depositAmount < required) revert TenureUnderfunded(required);
    }
}
