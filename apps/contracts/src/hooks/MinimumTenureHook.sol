// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "../SlotMath.sol";
import {ISlotHook, HookFlags, SlotContext} from "../ISlotHook.sol";
import {IDescribedHook, HookDescriptor} from "../IDescribedHook.sol";
import {SlotConstants} from "../SlotConstants.sol";

/**
 * @title MinimumTenureHook
 * @notice An occupant cannot be bought out for `tenureSeconds` after acquiring.
 *
 * @dev Stateless singleton: the configuration is the address. One deployment
 *      serves any number of slots; deploy one per duration.
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
 *      ── A change from the policy this replaces ──────────────────────────
 *
 *      `sell` no longer runs the tenure check.
 *
 *      Under the old design `sell` shared `checkBuy`, so an occupant could not
 *      sell their own slot during their own protection window. That is a shield
 *      turned into a cage: the window exists to stop the slot being taken FROM
 *      them, and there is nobody to protect when they are the one handing it
 *      over — especially now that the buyer signs the terms too.
 *
 *      Funding is still enforced on `sell`, so the channel cannot be used to
 *      seat someone underfunded and restart protection on the cheap.
 */
contract MinimumTenureHook is ISlotHook, IDescribedHook, SlotConstants {
    /// @notice Protection window in seconds.
    uint256 public immutable tenureSeconds;

    error TenureNotElapsed(uint256 availableAt);
    error TenureUnderfunded(uint256 required);
    error PriceCutDuringTenure();

    /// @notice Identifies this behaviour to clients. See `IDescribedHook`.
    bytes32 public constant FAMILY = keccak256("slots.hook.minimum-tenure");

    /// @notice The encoding of `descriptors()[0].data`, and nothing else.
    uint32 public constant DESCRIPTOR_VERSION = 1;

    /// @notice Where the human half lives — label, units, copy. May be empty.
    /// @dev A constructor argument rather than a constant, so a deployment can
    ///      point at metadata that actually exists. A hardcoded URI would have
    ///      to be edited before every deploy, and the one that shipped
    ///      unedited would resolve to nothing while looking authoritative.
    string public metadataURI;

    constructor(uint256 tenureSeconds_, string memory metadataURI_) {
        tenureSeconds = tenureSeconds_;
        metadataURI = metadataURI_;
    }

    /**
     * @notice What this hook claims to be.
     *
     * @dev version 1 — `data` is `abi.encode(uint256 tenureSeconds)`.
     *
     *      One entry: this hook is one family. The array exists so a hook that
     *      honestly is several can say so, and so a composite's shape is the
     *      same shape.
     */
    function descriptors()
        external
        view
        returns (HookDescriptor[] memory result)
    {
        result = new HookDescriptor[](1);
        result[0] = HookDescriptor({
            family: FAMILY,
            version: DESCRIPTOR_VERSION,
            data: abi.encode(tenureSeconds),
            metadataURI: metadataURI
        });
    }

    function hooks() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
        f.beforeSell = true;
        f.beforeSelfAssess = true;
        // Subscribed so the hook can see the ONE transition the protected
        // party controls. Without them, an occupant releases and retakes the
        // slot in a single transaction and the window renews for ever.
        f.afterRelease = true;
        f.afterLiquidate = true;
    }

    /// @notice When an account that just vacated may take this slot again.
    /// @dev A window protects an occupant FROM the market. Letting the same
    ///      account start a fresh one the instant it ends turns protection
    ///      into tenure without end, which is the opposite of a forced-sale
    ///      market. Keyed by (slot, account) because one hook serves many.
    mapping(address => mapping(address => uint256)) public reentryAllowedAt;

    /// @notice Refuse a buy that is underfunded, or that lands inside somebody
    ///         else's protection window.
    function beforeBuy(SlotContext calldata ctx) external view {
        _requireFunded(ctx);

        // The account that just vacated cannot immediately retake it. This is
        // what closes the renewal loop: release-and-rebuy in one transaction
        // used to re-arm `occupiedSince` at no cost, and at a dust price the
        // tax floors to zero so liquidation never armed either — the slot left
        // forced sale permanently, for one wei.
        uint256 barred = reentryAllowedAt[ctx.slot][ctx.account];
        if (block.timestamp < barred) revert TenureNotElapsed(barred);

        // Vacant slots are otherwise always claimable — no tenure to protect.
        if (ctx.occupant == address(0)) return;

        uint256 availableAt = ctx.occupiedSince + tenureSeconds;
        if (block.timestamp < availableAt) revert TenureNotElapsed(availableAt);
    }

    /// @notice A voluntary sale is allowed at any time, but it may not be used
    ///         to do what `selfAssess` is forbidden from doing.
    ///
    /// @dev The occupant is not barred from selling inside their own window —
    ///      the window exists to stop the slot being taken FROM them, and
    ///      there is nobody to protect when they are the one handing it over.
    ///
    ///      But `sell` also sets a price and restarts the clock, and it was
    ///      the only price-setting path this hook did not examine. An occupant
    ///      could enter high, sell to an address they control at price 1, and
    ///      hold a fresh window at a price the tax rounds to nothing —
    ///      precisely the manoeuvre `beforeSelfAssess` refuses. The buyer's
    ///      signature is no defence when the seller signs both sides.
    function beforeSell(SlotContext calldata ctx) external view {
        _requireFunded(ctx);
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + tenureSeconds) return;
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }

    /// @notice No cutting your price while nobody is allowed to take it.
    function beforeSelfAssess(SlotContext calldata ctx) external view {
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + tenureSeconds) return;
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }

    /// @notice Record who left, so they cannot walk straight back in.
    /// @dev The slot calls these gas-capped and swallows a revert, so this
    ///      must stay cheap and must not assume it succeeded — a missed write
    ///      only means one account is not barred, never that a slot breaks.
    function afterRelease(SlotContext calldata ctx) external {
        reentryAllowedAt[msg.sender][ctx.account] =
            block.timestamp + tenureSeconds;
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        reentryAllowedAt[msg.sender][ctx.account] =
            block.timestamp + tenureSeconds;
    }

    // Not subscribed — declared to satisfy the interface, never called.
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    /// @notice Tax due on `price` over the full window.
    /// @dev `ceilDiv`, not `/`. Rounding down let a short window on a low price
    ///      round to zero, which made the funding requirement vanish and the
    ///      slot claimable for nothing.
    function requiredDeposit(uint256 price, uint256 taxPercentage)
        public
        view
        returns (uint256)
    {
        // The slot's own formula, not a copy of it. A hook cannot inherit
        // from the slot, and a hand-written duplicate that drifts seats an
        // occupant this hook believed had funded the window.
        return SlotMath.depositFor(price, taxPercentage, tenureSeconds);
    }

    /// @dev Sized against the HIGHER of the incoming and sitting price.
    ///
    ///      The funding requirement used to be computed from the taker's own
    ///      declared price, so the party the window protects also set what the
    ///      window cost: enter at 1 wei and `ceilDiv` returns 1 wei for a slot
    ///      nobody may buy for the whole period. Anchoring to the price being
    ///      displaced means undercutting the market no longer buys protection
    ///      cheaply.
    function _requireFunded(SlotContext calldata ctx) internal view {
        uint256 basis = ctx.newPrice > ctx.currentPrice
            ? ctx.newPrice
            : ctx.currentPrice;
        uint256 required = requiredDeposit(basis, ctx.taxPercentage);
        if (ctx.depositAmount < required) revert TenureUnderfunded(required);
    }
}
