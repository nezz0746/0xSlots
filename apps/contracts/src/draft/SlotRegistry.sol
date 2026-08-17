// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SlotRegistry
/// @notice Names slots, so the things that embed them do not have to.
///
/// @dev ── The problem this exists for ─────────────────────────────────────
///
///      A publisher pastes `<adland-slot slot="0xf872…">` into their page. That
///      address then lives in someone else's HTML, on someone else's server,
///      and there is no mechanism by which it can ever be changed. Redeploy the
///      slot, migrate a chain, lose a key — every page carrying it shows a dead
///      space forever, and no amount of shipping fixes reaches them.
///
///      A constant in the SDK does not solve it: publishers pin the embed
///      package to an exact version on a CDN, so a new default only reaches
///      whoever upgrades, which is nobody. Indirection through our own API does not
///      solve it either — it reintroduces the one host the inline-metadata work
///      just removed from the render path.
///
///      An address does solve it, provided the address never changes. That is
///      the entire design: this contract is deployed once, its address is baked
///      into the SDK, and everything mutable sits behind it.
///
///      ── Why this is not a slot module ───────────────────────────────────
///
///      A module hangs off a slot — you reach it by asking a slot for its
///      `utility()`. This has to answer the question *before* a slot is known,
///      so it cannot be one. It is also not part of `MetadataModule` for the
///      same reason: finding that module requires the slot you are trying to
///      look up.
///
///      ── Why it is not upgradeable ───────────────────────────────────────
///
///      Every other contract here is UUPS. This one must not be. Its whole
///      value is that a publisher can read it once and know what it will do
///      forever; an upgradeable registry lets the owner change what "resolve"
///      means, which is precisely the assurance being sold. The mapping is
///      mutable. The rules about the mapping are not.
///
///      ── The power this concentrates, and the delay that bounds it ───────
///
///      Whoever owns this can repoint every publisher's ad space. That is real,
///      and it is new: today the publisher's own HTML is the authority. Two
///      things bound it. Publishers keep the `slot` attribute and can pass an
///      address explicitly, opting out of trusting us at all. And a key that
///      already resolves cannot be changed without `CHANGE_DELAY` passing in
///      public, so a repoint is something anyone watching can see coming rather
///      than something they discover afterwards.
///
///      Creating a key is immediate. There is nothing to protect until a key
///      has a value somebody might be depending on.
contract SlotRegistry is Ownable2Step {
    /// @notice How long a change to an EXISTING key must sit before it applies.
    /// @dev Two days rather than a governance-length window: this has to be
    ///      slow enough to be noticed and fast enough to be an incident
    ///      response. A slot that has genuinely been lost is an outage, and a
    ///      week of it to satisfy a delay nobody is watching helps no one.
    uint256 public constant CHANGE_DELAY = 2 days;

    /// @notice The key the SDK resolves when a publisher passes no slot.
    bytes32 public constant PRIMARY = "primary";

    /// @notice What each key resolves to right now.
    /// @dev Public, so the whole read is `registry.slotOf(key)` with no ABI
    ///      beyond a mapping getter — the cheapest possible thing for an
    ///      embedded SDK to depend on.
    mapping(bytes32 key => address slot) public slotOf;

    struct Pending {
        address slot;
        /// @dev Zero means "nothing proposed". A proposal to set a key to the
        ///      zero address is therefore not expressible, which is deliberate:
        ///      retiring a key is `cancel` plus leaving it, not a timed erase.
        uint64 readyAt;
    }

    /// @notice Changes waiting out `CHANGE_DELAY`.
    mapping(bytes32 key => Pending) public pendingOf;

    /// @notice A key resolved to a slot for the first time, or a change landed.
    event SlotSet(bytes32 indexed key, address indexed previous, address indexed slot);

    /// @notice A change to an existing key was proposed and is now visible.
    event SlotProposed(bytes32 indexed key, address indexed slot, uint64 readyAt);

    /// @notice A proposal was withdrawn before it landed.
    event SlotProposalCancelled(bytes32 indexed key, address indexed slot);

    error ZeroSlot();
    error NothingPending();
    error TooEarly(uint64 readyAt);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Point a key at a slot.
    /// @dev Immediate the first time, delayed every time after. The caller does
    ///      not choose which — a registry where the owner picks whether their
    ///      own change is delayed provides no assurance at all.
    function set(bytes32 key, address slot) external onlyOwner {
        if (slot == address(0)) revert ZeroSlot();

        address current = slotOf[key];
        if (current == address(0)) {
            slotOf[key] = slot;
            emit SlotSet(key, address(0), slot);
            return;
        }

        uint64 readyAt = uint64(block.timestamp + CHANGE_DELAY);
        pendingOf[key] = Pending({slot: slot, readyAt: readyAt});
        emit SlotProposed(key, slot, readyAt);
    }

    /// @notice Apply a change once its delay has passed.
    /// @dev Deliberately callable by anyone. The delay is the protection; making
    ///      the owner return to press a second button only adds a way for a
    ///      change everyone has already seen to sit unapplied.
    function commit(bytes32 key) external {
        Pending memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        if (block.timestamp < p.readyAt) revert TooEarly(p.readyAt);

        address previous = slotOf[key];
        slotOf[key] = p.slot;
        delete pendingOf[key];
        emit SlotSet(key, previous, p.slot);
    }

    /// @notice Withdraw a proposed change.
    function cancel(bytes32 key) external onlyOwner {
        Pending memory p = pendingOf[key];
        if (p.readyAt == 0) revert NothingPending();
        delete pendingOf[key];
        emit SlotProposalCancelled(key, p.slot);
    }

    /// @notice The slot an SDK should render when the publisher named none.
    function primary() external view returns (address) {
        return slotOf[PRIMARY];
    }
}
