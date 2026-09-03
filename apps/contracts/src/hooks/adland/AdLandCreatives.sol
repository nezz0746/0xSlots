// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {ISlotHook, HookFlags, SlotContext} from "../../ISlotHook.sol";
import {AdLandStorage} from "./AdLandStorage.sol";
import {Creative, ISlotAd} from "./IAdLand.sol";

/**
 * @title AdLandCreatives
 * @notice Publishing a creative, and retiring it when the slot turns over.
 *
 * @dev ── Why a creative stops applying ────────────────────────────────────
 *
 *      V1 wiped the entry from `onTransfer`/`onRelease`. Those calls were gas-
 *      capped and their failure swallowed, so a creative COULD outlive a
 *      transition and the next occupant inherited the last advertiser's ad. The
 *      `after` hooks here are capped and swallowed identically, so porting that
 *      design would port the bug with it.
 *
 *      Instead every creative carries the `tenureId` it was published for and
 *      reads resolve against it, so a wipe that never lands changes no answer.
 *      The wipe still runs — it refunds storage and it EMITS, which is the only
 *      way an indexer learns a creative ended without reconstructing the slot's
 *      tenure counter for itself. Neither half is load-bearing alone: the stamp
 *      cannot announce, and the wipe cannot be trusted.
 *
 *      That also makes this work as a plain registry for a slot whose hook is
 *      something else. No callback ever arrives, the stamp does all the work,
 *      and `ad()` reports `managed: false`.
 *
 *      ── Why vacancy is tested separately ─────────────────────────────────
 *
 *      `tenureId` increments in `_buy` and `sell` — the paths that SEAT an
 *      occupant. `release` and `liquidate` vacate without touching it. A stamp
 *      comparison alone would keep showing the departed occupant's creative on
 *      an empty slot, which is the one state where a stale ad is worst.
 */
abstract contract AdLandCreatives is AdLandStorage, ISlotHook {
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
    ///      between — and V1 found the gap was not even an honest failure: the
    ///      wallet's own RPC still held the old occupant, so `eth_estimateGas`
    ///      on the metadata write reverted as a bare "internal error".
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

    function _publish(address slot, string calldata uri) internal {
        uint64 t = ISlotAd(slot).tenureId();
        _creative[slot] = Creative({uri: uri, tenureId: t});
        emit Published(slot, uri, t);
    }

    /// @dev Reentrant by construction and safe by inspection: `Slot.buy` calls
    ///      `afterBuy` back into this contract mid-frame. That callback only
    ///      deletes `_creative[msg.sender]`, where `msg.sender` is the slot —
    ///      and the publish that follows runs after it, which is the order
    ///      wanted.
    function _buy(
        address slot,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) internal {
        address currency = ISlotAd(slot).currency();

        if (currency == address(0)) {
            // Forward the value verbatim. `Slot.buy` works out what is owed
            // itself — after settling, after the hook has run — and reverts
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

        // Mirrors what the buy will pull: a vacant slot costs the deposit alone,
        // an occupied one its standing price too. Safe to read ahead of the
        // call — settling moves the deposit, the collected tax and the settle
        // timestamp, and nothing else.
        uint256 owed = ISlotAd(slot).occupant() == address(0)
            ? depositAmount
            : ISlotAd(slot).price() + depositAmount;

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

    // ─── hook surface ───────────────────────────────────────────────────────

    function subscriptions() external pure returns (HookFlags memory f) {
        // Every path that ends a tenure. `afterSettle` is tax moving under a
        // tenure that has not ended, and a `before` hook here would let AdLand
        // veto a buy — which it has no business doing.
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
    }

    /// @dev AdLand takes no configuration: what it needs it reads from the
    ///      slot itself. Indifferent rather than unimplemented, so it can sit
    ///      in a composite beside a hook that does take one.
    function validateHookData(bytes32) external view {}

    function beforeBuy(SlotContext calldata) external view {}

    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata) external {
        _clear();
    }

        function afterRelease(SlotContext calldata) external {
        _clear();
    }

    function afterLiquidate(SlotContext calldata) external {
        _clear();
    }

    function afterSettle(SlotContext calldata) external {}

    /// @dev Keyed on `msg.sender`, never on `ctx.slot`. They hold the same value
    ///      when the core calls, but this registry is shared and every entry
    ///      point is world-callable — trusting the argument would let anyone
    ///      clear anyone else's creative by calling `afterBuy` with a forged
    ///      context.
    function _clear() internal {
        Creative storage c = _creative[msg.sender];
        if (bytes(c.uri).length == 0) return;

        uint64 from = c.tenureId;
        delete _creative[msg.sender];
        emit Cleared(msg.sender, from, ISlotAd(msg.sender).tenureId());
    }
}
