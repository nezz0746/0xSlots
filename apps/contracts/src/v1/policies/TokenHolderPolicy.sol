// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";

/// @title TokenHolderPolicy
/// @notice Only holders of an ERC-721 collection may take this slot.
/// @dev Stateless singleton — configuration lives in the address itself, so one
///      deployment serves every slot gated on the same collection. Deploy one
///      per collection.
///
///      ── What it is for ────────────────────────────────────────────────────
///      A membership gate. The slot stays a Harberger slot in every other
///      respect — priced by its occupant, taxed continuously, takeable at any
///      moment — but the set of people who may take it is the collection's
///      holders rather than everyone. A DAO's banner, a club's noticeboard, a
///      game's billboard: places where the right to advertise is part of what
///      the token confers.
///
///      ── Membership at ENTRY, not continuously ─────────────────────────────
///      `checkBuy` is gated and `checkPriceUpdate` is deliberately NOT. An
///      occupant who sells their token afterwards keeps the slot until somebody
///      takes it from them.
///
///      That asymmetry is the design, not an oversight. Gating repricing would
///      mean an occupant who has parted with their token can no longer LOWER
///      their price — and lowering is how an occupant reduces their tax and
///      exits gracefully. The gate would quietly convert into an obligation to
///      keep paying at a price they can no longer change, until the deposit
///      runs dry and they are liquidated. A membership rule must not be able to
///      do that.
///
///      Nothing is lost by it. Occupancy still turns over only through `buy`,
///      which IS gated, so the slot can never pass to a non-holder. What an
///      ex-holder retains is the right to be bought out on ordinary terms.
///
///      ── Harberger impact: PURE ON PRICE, NARROWED ON DEMAND ───────────────
///      Forced sale is not delayed by one second and no price is constrained.
///      What changes is who may exercise it.
///
///      That is a real cost and worth stating plainly: the tax's truth-serum
///      property leans on somebody being willing to take the slot at the
///      declared price. Restrict the buyer set to a collection with ten active
///      holders and a low declaration is far less likely to be punished — the
///      occupant is disciplined by the holders' interest, not the market's. On
///      a large, liquid collection the effect is negligible; on a small one
///      this is closer to a lease than to a Harberger slot, and pairing it with
///      `MinimumPricePolicy` is the usual answer.
///
///      Liquidation and release are unaffected — the core never routes either
///      through a policy — so a gate can never trap an occupant, and a slot
///      whose collection is abandoned still drains and reopens normally.
///
///      ── The check is on `account`, never `caller` ─────────────────────────
///      `OccupancyContext` carries both, and they are routinely different. A
///      module that buys on a user's behalf — `SlotData.buyAndWrite`,
///      `MetadataModule.buyAndUpdate`, `FeedRouter.buyAndPost` — is `caller`
///      while the user is `account` and becomes the occupant. Gating on
///      `caller` would reject every one of those paths while letting a module
///      hold the slot on behalf of anyone at all: strictly worse in both
///      directions.
///
///      ── Known property: the gate is a snapshot ────────────────────────────
///      Ownership is read at the instant of the buy, so a token borrowed for
///      one transaction satisfies it. ERC-721 exposes no holding duration and
///      no historical balance, so there is nothing cheap to check against —
///      a `held since` rule needs the collection itself to record it.
///
///      Whether that matters is a question about the collection, not this
///      contract. Where it does, the gate belongs on a wrapper that records
///      entry time and this policy points at the wrapper.
contract TokenHolderPolicy is IOccupancyPolicy {
    /// @notice The collection whose holders may occupy.
    IERC721 public immutable collection;

    error NotAHolder(address account);
    error NotAContract();

    constructor(IERC721 _collection) {
        // A staticcall to an address with no code SUCCEEDS and returns nothing,
        // which decodes as a zero balance — so a mistyped collection would not
        // fail loudly, it would silently refuse every buyer forever and read as
        // a slot nobody wants. Checked once, here, where it is still cheap to
        // get right.
        if (address(_collection).code.length == 0) revert NotAContract();
        collection = _collection;
    }

    /// @dev `balanceOf` rather than `ownerOf(id)`: membership is the rule, and
    ///      binding a slot to one specific token would make the gate
    ///      untransferable in practice — that token's holder could never sell
    ///      without also surrendering their claim on every slot gated by it.
    ///
    ///      A reverting `balanceOf` propagates and blocks the buy, which is the
    ///      correct direction for a fail-closed policy: an unreadable
    ///      collection is not evidence of membership.
    function checkBuy(OccupancyContext calldata ctx) external view {
        if (collection.balanceOf(ctx.account) == 0) {
            revert NotAHolder(ctx.account);
        }
    }

    /// @notice Unconstrained. See the note on entry-versus-continuous above.
    function checkPriceUpdate(OccupancyContext calldata) external view {}

    function name() external pure returns (string memory) {
        return "TokenHolderPolicy";
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function metadataURI() external pure returns (string memory) {
        return "";
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return
            id == type(IOccupancyPolicy).interfaceId ||
            id == type(IModuleMetadata).interfaceId ||
            id == type(IERC165).interfaceId;
    }
}
