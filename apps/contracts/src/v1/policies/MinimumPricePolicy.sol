// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {Slot} from "../Slot.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";

/// @title MinimumPricePolicy
/// @notice A reserve price: nobody may declare below `minPrice` on this slot.
/// @dev Stateless singleton — configuration lives in the address itself, so one
///      deployment can serve any number of slots. Deploy one per
///      (currency, minPrice) pair.
///
///      ── What it is for ────────────────────────────────────────────────────
///      This is a RECIPIENT-side rule, not occupant comfort. The core has no
///      floor at all — `selfAssess` rejects only zero — so a slot can be parked
///      on at dust valuation, paying almost no tax, and forced sale does not
///      correct it if nobody else happens to want the slot. A floor guarantees
///      a minimum tax base.
///
///      ── Why a FIXED floor is sound where a relative one is not ────────────
///      A rule like "beat the current price by 10%" reads as a similar idea and
///      is not: it is anchored to the incumbent's declaration, so it ratchets on
///      every trade and lets whoever holds the slot inflate what the next buyer
///      must declare. That is price-setting migrating into the module, and it
///      breaks the tax's truth-serum role.
///
///      This floor is a constant chosen before anyone enters, identical for
///      every participant, and it never moves. It is a participation
///      requirement of the same kind as `minDepositSeconds`, not a bid
///      mechanism. Above it, the buyer still sets their own number.
///
///      ── Harberger impact: NEAR-PURE ───────────────────────────────────────
///      Forced sale is not delayed by one second. Anyone may take the slot at
///      any moment, at the occupant's declared price, provided they declare at
///      least the floor themselves. Nobody is ever made to wait — which is the
///      whole difference from MinimumTenurePolicy.
///
///      ── The cliff, stated plainly ─────────────────────────────────────────
///      A floor set above what the slot is actually worth makes it unownable:
///      no honest declaration clears it, so the slot sits vacant and the
///      recipient earns nothing at all rather than a little. `minDepositSeconds`
///      degrades gracefully; this does not. Choose it like a reserve price.
///
///      Liquidation and release are unaffected — the core never routes either
///      through a policy — so a floor can never trap an occupant or keep an
///      insolvent one in place.
contract MinimumPricePolicy is IOccupancyPolicy {
    /// @notice The currency this floor is denominated in.
    /// @dev Bound because the floor is a bare integer and its meaning depends
    ///      entirely on the token's decimals: 100e6 is 100 USDC but a
    ///      ten-billionth of an 18-decimal token. Without this, one policy
    ///      address installed on slots of different currencies would impose
    ///      wildly different terms while every UI reported the same number.
    IERC20 public immutable currency;

    /// @notice Lowest price that may be declared on a slot using this policy.
    uint256 public immutable minPrice;

    error PriceBelowFloor(uint256 floor);
    error WrongCurrency();

    constructor(IERC20 _currency, uint256 _minPrice) {
        currency = _currency;
        minPrice = _minPrice;
    }

    /// @dev Both hooks enforce the floor. Gating only `checkBuy` would let a
    ///      buyer enter above it and cut to dust in the next transaction;
    ///      gating only `checkPriceUpdate` would let them enter below it. The
    ///      floor leaks unless both are covered.
    function checkBuy(OccupancyContext calldata ctx) external view {
        _assertCurrency(ctx.slot);
        if (ctx.newPrice < minPrice) revert PriceBelowFloor(minPrice);
    }

    function checkPriceUpdate(OccupancyContext calldata ctx) external view {
        _assertCurrency(ctx.slot);
        if (ctx.newPrice < minPrice) revert PriceBelowFloor(minPrice);
    }

    /// @dev Checked on every call rather than once at install time: a policy can
    ///      be swapped onto a live slot through `proposePolicyUpdate`, so there
    ///      is no install hook to validate in, and `OccupancyContext` does not
    ///      carry the currency. Fail closed on a mismatch — a slot whose terms
    ///      cannot be stated correctly should refuse rather than quietly impose
    ///      a floor of dust.
    function _assertCurrency(address slot) internal view {
        if (address(Slot(slot).currency()) != address(currency))
            revert WrongCurrency();
    }

    function name() external pure returns (string memory) { return "MinimumPricePolicy"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}
