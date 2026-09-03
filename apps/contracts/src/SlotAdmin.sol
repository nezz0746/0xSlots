// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SlotErrors.sol";
import {SlotEscrow} from "./SlotEscrow.sol";

/**
 * @title SlotAdmin
 * @notice The manager's surface, which is deliberately small.
 *
 * @dev Two functions, both of which only ever QUEUE. A manager cannot change
 *      anything under a sitting occupant: terms ripen for `TERMS_DELAY` and
 *      then land at the next occupancy transition. That is the whole of the
 *      manager's power over a slot, and keeping it in one short file is how
 *      you can check that claim.
 */
abstract contract SlotAdmin is SlotEscrow {
    // ─── manager ────────────────────────────────────────────────────────────

    /**
     * @notice Queue a change of terms, landing at the next occupancy change.
     *
     * @dev Both dimensions in one call, because they share one deferral and one
     *      apply. Pass `changeTax`/`changeHook` false to leave one alone.
     *
     *      The hook is validated NOW — a hook whose `hooks()` does not answer,
     *      or which rejects `newHookData`, is refused here rather than silently
     *      attached with no subscriptions or with a configuration it will veto
     *      on every callback.
     *
     *      `newHookData` is not a third dimension. It travels under
     *      `changeHook` because it is the same decision: swapping a hook and
     *      leaving the old configuration behind means handing the new hook a
     *      word meant for someone else.
     */
    function proposeTerms(
        uint256 newTax,
        address newHook,
        bytes32 newHookData,
        bool changeTax,
        bool changeHook
    ) external onlyManager {
        if (changeTax) {
            if (!mutableTax) revert NotMutable();
            if (newTax == 0 || newTax > MAX_TAX_BPS) revert InvalidTax();
            pending.taxPercentage = newTax;
            pending.hasTax = true;
        }
        if (changeHook) {
            if (!mutableHook) revert NotMutable();
            if (newHook != address(0)) {
                _readHookFlags(newHook, newHookData);
            } else if (newHookData != bytes32(0)) {
                revert InvalidHook();
            }
            pending.hook = newHook;
            pending.hookData = newHookData;
            pending.hasHook = true;
        }
        if (!changeTax && !changeHook) revert NoPendingUpdate();

        pending.proposedAt = uint64(block.timestamp);
        emit TermsProposed(
            newTax,
            newHook,
            newHookData,
            changeTax,
            changeHook
        );
    }

    /**
     * @notice Retract queued terms, one dimension at a time.
     *
     * @dev Two flags, mirroring `proposeTerms`, because the two dimensions are
     *      proposed independently and may belong to different people. A
     *      collective splits tax and hook across separate roles; an
     *      all-or-nothing cancel would let the hook manager destroy the tax
     *      manager's queued change as a side effect of retracting their own,
     *      with nothing to signal it happened. Cancelling must not reach
     *      further than proposing does.
     */
    function cancelProposal(bool cancelTax, bool cancelHook)
        external
        onlyManager
    {
        if (!cancelTax && !cancelHook) revert NoPendingUpdate();
        if (cancelTax && !pending.hasTax) revert NoPendingUpdate();
        if (cancelHook && !pending.hasHook) revert NoPendingUpdate();

        if (cancelTax) {
            pending.hasTax = false;
            pending.taxPercentage = 0;
        }
        if (cancelHook) {
            pending.hasHook = false;
            pending.hook = address(0);
            pending.hookData = bytes32(0);
        }
        if (!pending.hasTax && !pending.hasHook) pending.proposedAt = 0;

        emit ProposalCancelled(cancelTax, cancelHook);
    }

}
