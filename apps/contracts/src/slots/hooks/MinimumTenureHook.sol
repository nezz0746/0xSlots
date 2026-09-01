// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISlotHook, HookFlags, SlotContext} from "../ISlotHook.sol";
import {IDescribedHook, HookDescriptor} from "../IDescribedHook.sol";
import {BASIS_POINTS, MONTH} from "../SlotStorage.sol";

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
contract MinimumTenureHook is ISlotHook, IDescribedHook {
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
    }

    /// @notice Refuse a buy that is underfunded, or that lands inside somebody
    ///         else's protection window.
    function beforeBuy(SlotContext calldata ctx) external view {
        _requireFunded(ctx);

        // Vacant slots are always claimable — there is no tenure to protect.
        if (ctx.occupant == address(0)) return;

        uint256 availableAt = ctx.occupiedSince + tenureSeconds;
        if (block.timestamp < availableAt) revert TenureNotElapsed(availableAt);
    }

    /// @notice A voluntary sale is allowed at any time, but the incoming
    ///         occupant must still fund the window they are about to receive.
    function beforeSell(SlotContext calldata ctx) external view {
        _requireFunded(ctx);
    }

    /// @notice No cutting your price while nobody is allowed to take it.
    function beforeSelfAssess(SlotContext calldata ctx) external view {
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + tenureSeconds) return;
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }

    // Not subscribed — declared to satisfy the interface, never called.
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
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
        return
            Math.ceilDiv(
                price * taxPercentage * tenureSeconds,
                MONTH * BASIS_POINTS
            );
    }

    function _requireFunded(SlotContext calldata ctx) internal view {
        uint256 required = requiredDeposit(ctx.newPrice, ctx.taxPercentage);
        if (ctx.depositAmount < required) revert TenureUnderfunded(required);
    }
}
