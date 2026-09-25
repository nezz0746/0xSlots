// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AdLandModule} from "./AdLandModule.sol";
import {AdConfig, ISlotAd, PendingKey} from "./IAdLand.sol";

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
abstract contract AdLandRegistry is AdLandModule {
    /// @notice Point a key at a slot.
    /// @dev Immediate the first time, delayed every time after, and the caller
    ///      does not choose which — an owner who picks whether their own change
    ///      is delayed provides no assurance at all. Nothing depends on a key
    ///      that has no value yet, so creating one needs no wait.
    /// @dev The owner, or the key's holder ({keyOwner}). A holder may move
    ///      their own name and nothing else; the owner may move anyone's, and a
    ///      proposal the owner made cannot be displaced by the holder — which
    ///      is what makes a squatted key cost two days rather than being gone.
    ///      A key nobody has claimed has no holder, so it stays owner-only here.
    function setSlot(bytes32 key, address slot) external {
        bool byOwner = msg.sender == owner();
        if (!byOwner && msg.sender != keyOwner(key)) revert NotKeyOwner(key);
        if (slot == address(0)) revert ZeroSlot();

        if (slotOf[key] == address(0)) {
            slotOf[key] = slot;
            emit SlotSet(key, address(0), slot);
            return;
        }

        if (!byOwner && pendingOf[key].byOwner) revert OwnerProposalPending(key);

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 readyAt = uint64(block.timestamp + CHANGE_DELAY); // a timestamp
        pendingOf[key] = PendingKey({slot: slot, readyAt: readyAt, byOwner: byOwner});
        emit SlotProposed(key, slot, readyAt);
    }

    /**
     * @notice Who may repoint `key` besides the owner: the manager of the slot
     *         it resolves to today, if it was claimed.
     *
     * @dev Read live, so it follows `Slot.setManager` — a name belongs to
     *      whoever runs the slot behind it, not to whoever ran it on the day it
     *      was claimed. Zero for a key the owner set (including `primary`), and
     *      for a slot that will not say who manages it.
     */
    function keyOwner(bytes32 key) public view returns (address) {
        if (_claimedFor[key] == address(0)) return address(0);
        address slot = slotOf[key];
        if (slot == address(0)) return address(0);
        try ISlotAd(slot).manager() returns (address m) {
            return m;
        } catch {
            return address(0);
        }
    }

    /**
     * @notice Claim the key `slot` asks for in its AdLand configuration.
     *
     * @dev Permissionless, and first come first served. What it trusts is the
     *      SLOT: the key is read from the slot's own module configuration, and
     *      only a slot that actually attached this module can be claimed for. The
     *      claim goes to that slot, and its manager becomes the holder.
     */
    function claimKey(address slot) external {
        AdConfig memory c = adConfig(slot);
        if (c.key == bytes32(0)) revert ZeroSlot();
        // The default render target is not a first-come name. Claimable, it
        // went to whoever created a slot asking for it before the deploy
        // script ran, and every embed that named no slot rendered theirs.
        if (c.key == PRIMARY) revert ReservedKey(c.key);
        if (ISlotAd(slot).module() != address(this)) revert ZeroSlot();
        if (slotOf[c.key] != address(0)) revert KeyTaken(c.key);

        slotOf[c.key] = slot;
        _claimedFor[c.key] = slot;
        emit SlotSet(c.key, address(0), slot);
    }

    /// @notice Apply a change once its delay has passed.
    /// @dev Callable by anyone. The delay is the protection; requiring the owner
    ///      to press a second button only adds a way for a change everybody has
    ///      already seen to sit unapplied.
    function commitSlot(bytes32 key) external {
        PendingKey memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        if (block.timestamp < p.readyAt) revert TooEarly(p.readyAt);

        address previous = slotOf[key];
        slotOf[key] = p.slot;
        delete pendingOf[key];
        emit SlotSet(key, previous, p.slot);
    }

    /// @notice Withdraw a proposed change.
    /// @dev The owner may withdraw any; the holder only one the owner did not
    ///      make, for the same reason they cannot overwrite it.
    function cancelSlot(bytes32 key) external {
        PendingKey memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        if (msg.sender != owner()) {
            if (msg.sender != keyOwner(key)) revert NotKeyOwner(key);
            if (p.byOwner) revert OwnerProposalPending(key);
        }
        delete pendingOf[key];
        emit SlotProposalCancelled(key, p.slot);
    }

    /// @notice The slot to render when the publisher named none.
    function primary() external view returns (address) {
        return slotOf[PRIMARY];
    }
}
