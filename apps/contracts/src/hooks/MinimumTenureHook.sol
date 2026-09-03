// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "../SlotMath.sol";
import {ISlotHook, HookFlags, SlotContext} from "../ISlotHook.sol";
import {IDescribedHook, HookDescriptor} from "../IDescribedHook.sol";

/**
 * @title MinimumTenureHook
 * @notice An occupant cannot be bought out for `tenureSeconds` after acquiring.
 *
 * @dev ── One deployment, every duration ─────────────────────────────────
 *
 *      The window used to be an `immutable` constructor argument, which made
 *      the configuration part of the ADDRESS: a seven-day hook and a thirty-day
 *      hook were different contracts, and a CREATE2 factory existed solely to
 *      derive and deploy one per setting. That factory carried its own problems
 *      — the predicted address depended on this contract's initcode, so it
 *      could never safely be upgraded — and it was a whole contract, a resolver
 *      UI and a deploy step to express a single number.
 *
 *      The number now comes from the slot, as `ctx.hookData`. One deployment
 *      serves every duration, the factory is gone, and this contract holds no
 *      per-slot state at all.
 *
 *      That the data lives on the SLOT and not here is the load-bearing part.
 *      Were the window kept in this contract's storage, a setter here could
 *      rewrite a slot's rules while the slot went on reporting `mutableHook ==
 *      false`. On the slot, both halves of the configuration — which hook, and
 *      how long — are frozen by the same flag.
 *
 *      ── Harberger impact: SOFT ──────────────────────────────────────────
 *
 *      Forced sale is delayed, not removed. A dishonestly low price is still
 *      punished, just `tenureSeconds` later. Two conditions keep that true and
 *      both are enforced here:
 *
 *        1. Entry is funded. The incoming occupant escrows the whole window's
 *           tax at the moment they take the slot — otherwise protection would
 *           be free.
 *        2. Price cannot be cut while protected. Without this an occupant
 *           declares high to win the slot, drops to dust on day one, and pays
 *           nothing for a window in which nobody can take it from them.
 *
 *      Liquidation is untouched. Insolvency always ends a tenure, and this hook
 *      does not subscribe to it at all.
 *
 *      ── What condition 1 does NOT guarantee ─────────────────────────────
 *
 *      It is checked at entry and never again. `withdraw` consults no hook —
 *      only the core's own `minDepositSeconds` floor — so the escrow binds
 *      exactly as far as that floor reaches. An occupant can escrow the full
 *      tenure, withdraw straight back to the floor, and keep the window.
 *
 *      That is a leak in the mechanism, not in the economics: liquidation is
 *      never vetoable, so an occupant who withdraws is removable the moment
 *      their runway ends. What the leak costs is the BUYOUT channel — for the
 *      rest of the window a rival must liquidate to vacancy rather than buy at
 *      the declared price. A slot wanting condition 1 to bind for its full term
 *      sets `minDepositSeconds >= tenureSeconds` at creation, which puts the
 *      floor in the core where `withdraw` enforces it.
 *
 *      ── `sell` does not run the tenure check ────────────────────────────
 *
 *      The window exists to stop the slot being taken FROM its occupant, and
 *      there is nobody to protect when they are the one handing it over.
 *      Funding and the price floor are still enforced on `sell`, so the channel
 *      cannot be used to seat someone underfunded or to restart protection at a
 *      price the tax rounds away.
 */
contract MinimumTenureHook is ISlotHook, IDescribedHook {
    error TenureNotElapsed(uint256 availableAt);
    error TenureUnderfunded(uint256 required);
    error PriceCutDuringTenure();
    error TenureNotConfigured();
    error TenureTooLong(uint256 max);

    bytes32 public constant FAMILY = keccak256("slots.hook.minimum-tenure");
    uint32 public constant DESCRIPTOR_VERSION = 2;

    /**
     * @notice The longest window this hook will accept. Ten years.
     *
     * @dev Not a view about how long protection should last — it is an encoding
     *      check. `hookData` is 32 bytes and only the low ones are a duration,
     *      so the characteristic mistake is a word that was never a number:
     *      `bytes32("7 days")` is left-aligned text and decodes to roughly
     *      1e76 seconds.
     *
     *      Left unbounded that value does not fail as "too long". It fails as
     *      `occupiedSince + window` OVERFLOWING inside a `view` the slot cannot
     *      ignore, which vetoes every buy on that slot for ever and says
     *      nothing about why. The bound turns it into one revert, at creation,
     *      naming the limit.
     */
    uint256 public constant MAX_TENURE = 3650 days;

    /// @notice When an account that just vacated may take a given slot again.
    /// @dev A window protects an occupant FROM the market. Letting the same
    ///      account start a fresh one the instant it ends turns protection into
    ///      tenure without end, which is the opposite of a forced-sale market.
    ///      Keyed by (slot, account) because one deployment serves every slot.
    ///
    ///      This is the hook's ONLY storage, and it is a record of what
    ///      happened rather than configuration. Nothing here decides a slot's
    ///      rules; `ctx.hookData` does, and the slot owns that.
    mapping(address => mapping(address => uint256)) public reentryAllowedAt;

    /**
     * @notice The window this slot configured, in seconds.
     *
     * @dev Zero is not a short window, it is an unconfigured one, and it is
     *      rejected rather than treated as "no protection". A slot that meant
     *      to have no minimum tenure attaches no hook; one that attached THIS
     *      hook and left the data empty has a configuration mistake.
     *
     *      Both ends are refused, and both are the same kind of refusal: a word
     *      that is not a duration. See {MAX_TENURE} for the upper one.
     */
    function tenureOf(bytes32 data) public pure returns (uint256) {
        uint256 seconds_ = uint256(data);
        if (seconds_ == 0) revert TenureNotConfigured();
        if (seconds_ > MAX_TENURE) revert TenureTooLong(MAX_TENURE);
        return seconds_;
    }

    /// @inheritdoc ISlotHook
    /// @dev The whole of this hook's configuration is one number, so
    ///      validation is {tenureOf} run for its revert.
    function validateHookData(bytes32 data) external pure {
        tenureOf(data);
    }

    /**
     * @notice What this hook claims to be.
     *
     * @dev version 2 — the window is no longer part of this contract, so the
     *      descriptor cannot name it. Version 1 encoded `tenureSeconds` here
     *      because the address WAS the configuration; a consumer that wants the
     *      window now reads `Slot.hookData` and calls {tenureOf}, which is the
     *      only source that can be right for a given slot.
     */
    function descriptors()
        external
        pure
        returns (HookDescriptor[] memory result)
    {
        result = new HookDescriptor[](1);
        result[0] = HookDescriptor({
            family: FAMILY,
            version: DESCRIPTOR_VERSION,
            data: "",
            metadataURI: ""
        });
    }

    function subscriptions() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
        f.beforeSell = true;
        f.beforeSelfAssess = true;
        // Subscribed so the hook can see the ONE transition the protected party
        // controls. Without them, an occupant releases and retakes the slot in a
        // single transaction and the window renews for ever.
        f.afterRelease = true;
        f.afterLiquidate = true;
    }

    /// @notice Refuse a buy that is underfunded, or that lands inside somebody
    ///         else's protection window.
    function beforeBuy(SlotContext calldata ctx) external view {
        uint256 window = tenureOf(ctx.hookData);
        _requireFunded(ctx, window);

        // The account that just vacated cannot immediately retake it. This is
        // what closes the renewal loop: release-and-rebuy in one transaction
        // used to re-arm `occupiedSince` at no cost, and at a dust price the tax
        // floors to zero so liquidation never armed either — the slot left
        // forced sale permanently, for one wei.
        uint256 barred = reentryAllowedAt[ctx.slot][ctx.account];
        if (block.timestamp < barred) revert TenureNotElapsed(barred);

        // Vacant slots are otherwise always claimable — no tenure to protect.
        if (ctx.occupant == address(0)) return;

        uint256 availableAt = ctx.occupiedSince + window;
        if (block.timestamp < availableAt) revert TenureNotElapsed(availableAt);
    }

    /// @notice A voluntary sale is allowed at any time, but it may not be used
    ///         to do what `selfAssess` is forbidden from doing.
    ///
    /// @dev `sell` also sets a price and restarts the clock, and it was the only
    ///      price-setting path this hook did not examine. An occupant could
    ///      enter high, sell to an address they control at price 1, and hold a
    ///      fresh window at a price the tax rounds to nothing — precisely the
    ///      manoeuvre `beforeSelfAssess` refuses. The buyer's signature is no
    ///      defence when the seller signs both sides.
    function beforeSell(SlotContext calldata ctx) external view {
        uint256 window = tenureOf(ctx.hookData);
        _requireFunded(ctx, window);
        _requireNoCutDuringTenure(ctx, window);
    }

    /// @notice No cutting your price while nobody is allowed to take it.
    function beforeSelfAssess(SlotContext calldata ctx) external view {
        _requireNoCutDuringTenure(ctx, tenureOf(ctx.hookData));
    }

    /// @notice Record who left, so they cannot walk straight back in.
    /// @dev The slot calls these gas-capped and swallows a revert, so this must
    ///      stay cheap and must not assume it succeeded — a missed write only
    ///      means one account is not barred, never that a slot breaks.
    ///
    ///      {tenureOf} rather than a raw cast, for the bound rather than the
    ///      revert: an unchecked huge value would overflow this addition, and
    ///      the swallowed revert would silently skip the bar. A slot that
    ///      attached this hook has already passed both checks, so in practice
    ///      this cannot revert at all.
    function afterRelease(SlotContext calldata ctx) external {
        reentryAllowedAt[msg.sender][ctx.account] =
            block.timestamp + tenureOf(ctx.hookData);
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        reentryAllowedAt[msg.sender][ctx.account] =
            block.timestamp + tenureOf(ctx.hookData);
    }

    // Not subscribed — declared to satisfy the interface, never called.
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    /// @notice Tax due on `price` over a window of `tenureSeconds`.
    /// @dev `ceilDiv`, not `/`. Rounding down let a short window on a low price
    ///      round to zero, which made the funding requirement vanish and the
    ///      slot claimable for nothing.
    function requiredDeposit(
        uint256 price,
        uint256 taxBps,
        uint256 tenureSeconds
    ) public pure returns (uint256) {
        // The slot's own formula, not a copy of it. A hook cannot inherit from
        // the slot, and a hand-written duplicate that drifts seats an occupant
        // this hook believed had funded the window.
        return SlotMath.depositFor(price, taxBps, tenureSeconds);
    }

    /// @dev Sized against the HIGHER of the incoming and sitting price.
    ///
    ///      The funding requirement used to be computed from the taker's own
    ///      declared price, so the party the window protects also set what the
    ///      window cost: enter at 1 wei and `ceilDiv` returns 1 wei for a slot
    ///      nobody may buy for the whole period. Anchoring to the price being
    ///      displaced means undercutting the market no longer buys protection
    ///      cheaply.
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

    function _requireNoCutDuringTenure(
        SlotContext calldata ctx,
        uint256 window
    ) internal view {
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + window) return;
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }
}
