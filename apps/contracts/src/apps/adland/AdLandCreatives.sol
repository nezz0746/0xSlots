// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {AdLandModeration} from "./AdLandModeration.sol";
import {AdLandStorage} from "./AdLandStorage.sol";
import {Creative, ISlotAd} from "./IAdLand.sol";

/**
 * @title AdLandCreatives
 * @notice Publishing a creative, and retiring it when the slot turns over.
 *
 * @dev The advertising half, with no `ISlotApp` surface on it: what a slot's
 *      app does with any of this is {AdLandApp}'s, so this reads as a
 *      registry of creatives and nothing else.
 *
 * @dev ── Why a creative stops applying ────────────────────────────────────
 *
 *      A wipe driven from an `after` callback cannot be relied on: those calls
 *      are gas-capped and their failure swallowed, so a creative would outlive
 *      the transition and the next occupant would inherit the last advertiser's
 *      ad.
 *
 *      Instead every creative carries the `tenureId` it was published for and
 *      reads resolve against it, so a wipe that never lands changes no answer.
 *      The wipe still runs — it refunds storage and it EMITS, which is the only
 *      way an indexer learns a creative ended without reconstructing the slot's
 *      tenure counter for itself. Neither half is load-bearing alone: the stamp
 *      cannot announce, and the wipe cannot be trusted.
 *
 *      That also makes this work as a plain registry for a slot whose app is
 *      something else. No callback ever arrives, the stamp does all the work,
 *      and `ad()` reports `managed: false`.
 *
 *      ── Why vacancy is tested separately ─────────────────────────────────
 *
 *      `tenureId` increments in `_buy` — the path that SEATS an occupant.
 *      `release` and `liquidate` vacate without touching it. A stamp
 *      comparison alone would keep showing the departed occupant's creative on
 *      an empty slot, which is the one state where a stale ad is worst.
 */
abstract contract AdLandCreatives is AdLandStorage, AdLandModeration {
    using SafeERC20 for IERC20;

    // ─── publishing ─────────────────────────────────────────────────────────

    /// @notice Set the creative for a slot you occupy.
    function publish(address slot, string calldata uri) external {
        if (msg.sender != ISlotAd(slot).occupant()) revert NotOccupant();
        _publish(slot, uri);
    }

    /// @notice Take `slot` and publish `uri` in one transaction.
    ///
    /// @dev Buying and publishing cannot be reordered or interleaved: `publish`
    ///      is occupant-only, and the buy clears the previous creative on its
    ///      way through. Two transactions leave the slot showing nothing in
    ///      between, and the gap is not even an honest failure: the wallet's own
    ///      RPC still holds the old occupant, so `eth_estimateGas` on the
    ///      publish reverts as a bare "internal error".
    ///
    ///      A wallet implementing EIP-5792 can batch and needs none of this. A
    ///      plain browser extension cannot, and that is who this is for.
    ///
    ///      No authorisation check on the publish that follows: the buy seated
    ///      `msg.sender`, so this frame has already proved what `publish` asks.
    function buyAndPublish(
        address slot,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment,
        string calldata uri
    ) external payable {
        _buy(slot, selfAssessedPrice, depositAmount, maxPayment);
        _publish(slot, uri);
    }

    /// @notice `buyAndPublish`, preceded by an EIP-2612 permit.
    /// @dev The one path that reaches a SINGLE transaction for a plain EOA — a
    ///      permit is a signature, not a transaction, so it folds in. USDC on
    ///      Base implements 2612, which is what makes it worth carrying.
    function buyAndPublishWithPermit(
        address slot,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment,
        string calldata uri,
        uint256 permitValue,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        address currency = ISlotAd(slot).currency();
        if (currency == address(0)) revert NativeSlotHasNoPermit();

        // Swallowed deliberately. A permit is a public signature: anyone
        // watching the mempool can submit it first, and the second use reverts
        // on the spent nonce. That front-run is not an attack — it does the
        // same work and grants the same allowance this call was going to use.
        // What matters is whether the allowance is THERE, which the transfer
        // below decides; a permit that failed for any other reason fails again
        // there, with the token's own error rather than a signature one.
        try
            IERC20Permit(currency).permit(
                msg.sender,
                address(this),
                permitValue,
                deadline,
                v,
                r,
                s
            )
        {} catch {}

        _buy(slot, selfAssessedPrice, depositAmount, maxPayment);
        _publish(slot, uri);
    }

    /**
     * @dev Live, or waiting for the manager — see {AdLandModeration}.
     *
     *      An EMPTY uri always goes live, whatever the mode. It is the occupant
     *      taking their own ad down, which is never content anyone needs to
     *      screen, and making it wait would leave an advertiser unable to stop
     *      advertising. It also discards anything they had waiting: somebody who
     *      has just cleared their space should not have an older submission
     *      approved into it afterwards.
     */
    function _publish(address slot, string calldata uri) internal {
        uint64 t = ISlotAd(slot).tenureId();

        if (bytes(uri).length == 0) {
            delete _pendingCreative[slot];
        } else if (_requiresApproval(slot, t)) {
            _pendingCreative[slot] = Creative({uri: uri, tenureId: t});
            emit Submitted(slot, uri, t);
            return;
        }

        _creative[slot] = Creative({uri: uri, tenureId: t});
        emit Published(slot, uri, t);
    }

    /// @dev Reentrant by construction and safe by inspection: `Slot.buy` calls
    ///      `afterBuy` back into this contract mid-frame. That callback only
    ///      deletes `_creative[ctx.slot]` — the slot being bought, and only if
    ///      the stamp on it has already been retired — and the publish that
    ///      follows runs after it, which is the order wanted.
    function _buy(
        address slot,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) internal {
        address currency = ISlotAd(slot).currency();

        if (currency == address(0)) {
            // Forward the value verbatim. `Slot.buy` works out what is owed
            // itself — after settling, after the app has run — and reverts
            // loudly when the value is wrong. Recomputing it here would be a
            // second copy of that arithmetic, free to drift from the first.
            ISlotAd(slot).buy{value: msg.value}(
                msg.sender,
                selfAssessedPrice,
                depositAmount,
                maxPayment
            );
            return;
        }

        if (msg.value != 0) revert UnexpectedValue();

        // Exactly what the buy will pull, from the slot itself: the standing
        // price when occupied, the deposit, and any debt the buyer owes. Safe
        // to read ahead of the call — settling moves the deposit, the collected
        // tax and the settle timestamp, and none of those are in the quote.
        uint256 owed = ISlotAd(slot).quoteBuy(msg.sender, depositAmount);

        uint256 held = IERC20(currency).balanceOf(address(this));

        if (owed > 0) {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), owed);
            // `forceApprove`: USDC-style tokens refuse a non-zero-to-non-zero
            // allowance change, and a buy that reverted after approving would
            // leave exactly that behind.
            IERC20(currency).forceApprove(slot, owed);
        }

        ISlotAd(slot).buy(
            msg.sender,
            selfAssessedPrice,
            depositAmount,
            maxPayment
        );

        if (owed > 0) {
            // Leave no allowance standing between calls.
            IERC20(currency).forceApprove(slot, 0);

            // And nothing stranded. `owed` is computed from THIS contract's
            // reading of a `Slot` that sits behind an upgradeable beacon; if
            // that reading ever over-estimates, the difference belongs to the
            // buyer. Measured as a delta so a stray donation is not handed out.
            uint256 residue = IERC20(currency).balanceOf(address(this));
            if (residue > held) {
                IERC20(currency).safeTransfer(msg.sender, residue - held);
            }
        }
    }

    /// @dev Keyed on `ctx.slot`, and the argument is not trusted to say so.
    ///
    ///      Every entry point here is world-callable, so the caller is not
    ///      authenticated; the STATE is. This refuses any
    ///      entry the lens would still serve — see {AdLandLens-ad}, whose test
    ///      this mirrors exactly. A forged call can therefore only retire a row
    ///      that is already invisible, which is the whole of what an honest one
    ///      does. There is nothing left to steal, so there is nothing left to
    ///      authenticate.
    ///
    ///      That the honest path passes the test is ordering, not luck:
    ///      `afterBuy` fires after `++tenureId`, and `afterRelease` and
    ///      `afterLiquidate` both fire after `_vacate` has zeroed the occupant.
    ///      By the time any of them arrive the old creative is already retired
    ///      by the stamp, and this only makes it official.
    ///
    ///      The other half of the trade: a wipe that WAS swallowed is now
    ///      anyone's to land late. It changes no answer — the stamp retired the
    ///      row when the tenure ended — but it emits {Cleared}, which is the
    ///      only way an indexer learns a creative ended without reconstructing
    ///      the slot's tenure counter for itself.
    function _clear(address slot) internal {
        Creative storage c = _creative[slot];
        if (bytes(c.uri).length == 0) return;

        // Non-empty means `publish` once succeeded for this address, which
        // means it answered `occupant()` — so there is code here to call.
        uint64 live = ISlotAd(slot).tenureId();
        if (ISlotAd(slot).occupant() != address(0) && c.tenureId == live) return;

        uint64 from = c.tenureId;
        delete _creative[slot];
        emit Cleared(slot, from, live);
    }
}
