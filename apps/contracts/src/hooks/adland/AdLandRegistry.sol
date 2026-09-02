// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AdLandStorage} from "./AdLandStorage.sol";
import {Pending} from "./IAdLand.sol";

/**
 * @title AdLandRegistry
 * @notice Names that outlive the addresses they point at.
 *
 * @dev A publisher pastes `<adland-slot slot="0xf872…">` into their page. That
 *      address lives in someone else's HTML with no mechanism by which it can
 *      ever be changed: redeploy the slot, migrate a chain, lose a key, and
 *      every page carrying it shows a dead space forever. It is the one
 *      dependency in the embed that shipping cannot repair.
 *
 *      A default in the SDK does not fix it — publishers pin an exact version on
 *      a CDN, so a new constant reaches only whoever upgrades, which is nobody.
 *      Our own API does not fix it either; that puts a host back in the render
 *      path that inline metadata took out.
 */
abstract contract AdLandRegistry is AdLandStorage {
    /// @notice Point a key at a slot.
    /// @dev Immediate the first time, delayed every time after, and the caller
    ///      does not choose which — an owner who picks whether their own change
    ///      is delayed provides no assurance at all. Nothing depends on a key
    ///      that has no value yet, so creating one needs no wait.
    function setSlot(bytes32 key, address slot) external onlyOwner {
        if (slot == address(0)) revert ZeroSlot();

        if (slotOf[key] == address(0)) {
            slotOf[key] = slot;
            emit SlotSet(key, address(0), slot);
            return;
        }

        uint64 readyAt = uint64(block.timestamp + CHANGE_DELAY);
        pendingOf[key] = Pending({slot: slot, readyAt: readyAt});
        emit SlotProposed(key, slot, readyAt);
    }

    /// @notice Apply a change once its delay has passed.
    /// @dev Callable by anyone. The delay is the protection; requiring the owner
    ///      to press a second button only adds a way for a change everybody has
    ///      already seen to sit unapplied.
    function commitSlot(bytes32 key) external {
        Pending memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        if (block.timestamp < p.readyAt) revert TooEarly(p.readyAt);

        address previous = slotOf[key];
        slotOf[key] = p.slot;
        delete pendingOf[key];
        emit SlotSet(key, previous, p.slot);
    }

    /// @notice Withdraw a proposed change.
    function cancelSlot(bytes32 key) external onlyOwner {
        Pending memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        delete pendingOf[key];
        emit SlotProposalCancelled(key, p.slot);
    }

    /// @notice The slot to render when the publisher named none.
    function primary() external view returns (address) {
        return slotOf[PRIMARY];
    }
}
