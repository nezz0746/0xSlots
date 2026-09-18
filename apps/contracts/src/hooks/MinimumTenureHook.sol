// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook, HookPermissions, SlotContext} from "../interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../libraries/HookPermissionsLib.sol";
import {HookOffer} from "../types/SlotTypes.sol";
import {IDescribedHook, HookDescriptor} from "../interfaces/IDescribedHook.sol";
import {MinimumTenure} from "./MinimumTenure.sol";

/**
 * @title MinimumTenureHook
 * @notice For `tenureSeconds` after acquiring, an occupant can only be bought
 *         out at a large multiple of the price they declared.
 *
 * @dev ── One deployment, every duration ─────────────────────────────────
 *
 *      The window comes from the slot, as `ctx.hookTerms.config`, so one
 *      deployment serves every duration and this contract holds no per-slot
 *      state at all. Kept in an `immutable` instead, the configuration would be
 *      part of the ADDRESS: a seven-day hook and a thirty-day hook would be
 *      different contracts, deployed by a factory whose predicted address
 *      depends on this initcode and so can never safely be upgraded.
 *
 *      That the data lives on the SLOT and not here is the load-bearing part.
 *      Were the window kept in this contract's storage, a setter here could
 *      rewrite a slot's rules while the slot went on reporting a locked hook. On
 *      the slot, both halves of the configuration — which hook, and how long —
 *      are frozen by the same flag.
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
 *      only the core's own `minRunwaySeconds` floor — so the escrow binds
 *      exactly as far as that floor reaches. An occupant can escrow the full
 *      tenure, withdraw straight back to the floor, and keep the window.
 *
 *      That is a leak in the mechanism, not in the economics: liquidation is
 *      never vetoable, so an occupant who withdraws is removable the moment
 *      their runway ends. What the leak costs is the BUYOUT channel — for the
 *      rest of the window a rival must liquidate to vacancy rather than buy at
 *      the declared price. A slot wanting condition 1 to bind for its full term
 *      sets `minRunwaySeconds >= tenureSeconds` at creation, which puts the
 *      floor in the core where `withdraw` enforces it.
 *
 *      ── A sale the occupant arranges is not a buyout ────────────────────
 *
 *      The window exists to stop the slot being taken FROM its occupant, and
 *      there is nobody to protect when they are the one handing it over. An
 *      occupant selling through the OfferBook reprices to the bid first, so the
 *      buy that follows clears the floor and the check never bites.
 */
contract MinimumTenureHook is MinimumTenure, ISlotHook, IDescribedHook {

    /// @dev Kept as this contract's own names for consumers that already read
    ///      them; the values are the rule's, so a slot cannot tell the two
    ///      hosts apart by family.
    bytes32 public constant FAMILY = TENURE_FAMILY;
    uint32 public constant DESCRIPTOR_VERSION = TENURE_DESCRIPTOR_VERSION;

    /**
     * @notice The longest window this hook will accept. Ten years.
     *
     * @dev Not a view about how long protection should last — it is an encoding
     *      check. The hook `config` is 32 bytes and only the low ones are a duration,
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
    /**
     * ── Known shape of this curve, and where it could go next ───────────────
     *
     * A flat multiple gives protection three regimes, and only the first is
     * designed:
     *
     *   - at dust, worthless — which is the point, and what closed the lockout;
     *   - at ordinary prices, proportionate;
     *   - at high prices, near-absolute. Ten times a large number is a number
     *     nobody reaches.
     *
     * The top end is self-limiting rather than free: a buyer escaping at 10x is
     * BOUND by that declaration. They owe tax on it, they are takeable at it,
     * and {beforeSelfAssess} forbids them cutting it for the whole of their own
     * fresh window. Buying a large shield costs in proportion to its size,
     * which is the trade this protocol is made of.
     *
     * What is NOT designed is the ratchet. Each escape both multiplies the
     * price and re-arms the clock, so escapes compound: 100 -> 1_000 -> 10_000,
     * each with a full window behind it. Tax terminates the sequence quickly,
     * but two in a row put a valuable slot somewhere nobody follows.
     *
     * The evolution worth trying is not a smaller multiple — it is a different
     * curve. DECAY the premium across the window: 10x on the first block,
     * sliding to 1x at expiry. Protection is then strongest when it is most
     * deserved (the occupant has just paid, just published) and fades as the
     * claim ages, instead of ending at a cliff. It also kills the ratchet,
     * because escaping late costs almost nothing and so never overshoots.
     *
     * That is a few lines here, not a core change — and it is the shape of
     * hook worth writing as its own contract rather than a flag on this one, so
     * a slot picks the curve it wants by picking its hook.
     */

    /// @inheritdoc ISlotHook
    /// @dev The whole of this hook's configuration is one number, so
    ///      validation is {tenureOf} run for its revert.
    function validateHookConfig(bytes32 data) external pure {
        tenureOf(data);
    }

    /**
     * @notice What this hook claims to be.
     *
     * @dev The window is the slot's, not this contract's, so the descriptor
     *      cannot name it. A consumer reads `Slot.hookTerms().config` and calls
     *      {tenureOf}.
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
            signature: tenureSignature(),
            // The window's layout and bounds, from the same constants the
            // check enforces. A client renders the field and validates against
            // `validateHookConfig` before anything is attached.
            data: tenureBounds_(),
            metadataURI: ""
        });
    }

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        HookPermissions memory f;
        f.beforeBuy = true;
        f.beforeSelfAssess = true;
        // Subscribed so the hook can see the ONE transition the protected party
        // controls. Without them, an occupant releases and retakes the slot in a
        // single transaction and the window renews for ever.
        f.afterRelease = true;
        f.afterLiquidate = true;
        o.permissions = HookPermissionsLib.pack(f);
    }

    // ─── the rule, which lives in {MinimumTenure} ───────────────────────────
    //
    // This contract is now the hook SURFACE and nothing else: the window, the
    // premium, the re-entry bar and the funding check are the base's, so a
    // hook that needs tenure alongside something else inherits the same code
    // rather than a second contract standing behind a fan-out.

    /// @notice Refuse a buy that is underfunded, or that lands inside somebody
    ///         else's protection window.
    function beforeBuy(SlotContext calldata ctx) external view {
        _enforceTenureOnBuy(ctx);
    }

    /// @notice No cutting your price while nobody is allowed to take it.
    function beforeSelfAssess(SlotContext calldata ctx) external view {
        _enforceTenureOnSelfAssess(ctx);
    }

    /// @notice Record who left, so they cannot walk straight back in.
    function afterRelease(SlotContext calldata ctx) external {
        _barReentry(ctx);
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        _barReentry(ctx);
    }

    // Not subscribed — declared to satisfy the interface, never called.
    function afterBuy(SlotContext calldata) external {}

    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata) external {}
}
