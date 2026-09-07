// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MetadataModule} from "./MetadataModule.sol";

/// @dev The slice of `Slot` a reader needs. `module()` rather than `utility()`:
///      the storage variable was renamed and `module()` is the compatibility
///      getter, which slots on either side of the rename both answer to.
interface ISlotRead {
    function module() external view returns (address);
    function occupant() external view returns (address);
    function price() external view returns (uint256);
    function deposit() external view returns (uint256);
    function taxOwed() external view returns (uint256);
    function isVacant() external view returns (bool);
    function taxPercentage() external view returns (uint256);
    function currency() external view returns (address);
    function collectedTax() external view returns (uint256);
    function occupiedSince() external view returns (uint256);
}

interface IMetadataRead {
    function tokenURI(address slot) external view returns (string memory);
}

/// @title AdModule
/// @notice `MetadataModule`, plus the two things a publisher's page needs to
///         stop hardcoding: a name for the slot, and one call to read it.
///
/// @dev ── Why one contract ─────────────────────────────────────────────────
///
///      Drafted first as three — module, registry, lens — on the reasoning that
///      a registry cannot be a module, since a module is reached by asking a
///      slot for it and the registry has to answer before any slot is known.
///      That reasoning was about DISCOVERY, and it stops applying the moment the
///      address is a constant in the SDK. Called directly, this contract answers
///      as a registry; called by a slot, it behaves as that slot's module; and
///      the lens reads both. Nothing is circular because nothing has to be
///      found.
///
///      Merging is also what makes the lens cheap. `tokenURI` is this
///      contract's own storage, so for every slot using this module the read is
///      a mapping lookup rather than a cross-contract call.
///
///      ── The problem being solved ─────────────────────────────────────────
///
///      A publisher pastes `<adland-slot slot="0xf872…">` into their page. That
///      address lives in someone else's HTML with no mechanism by which it can
///      ever be changed: redeploy the slot, migrate a chain, lose a key, and
///      every page carrying it shows a dead space forever. It is the one
///      dependency in the embed that shipping cannot repair.
///
///      A default in the SDK does not fix it — publishers pin an exact version
///      on a CDN, so a new constant reaches only whoever upgrades, which is
///      nobody. Our own API does not fix it either; that reintroduces the host
///      the inline-metadata work removed from the render path.
///
///      ── What merging costs, stated plainly ───────────────────────────────
///
///      A standalone registry could be non-upgradeable, which is a real
///      assurance: read it once and know what it will do forever. This is UUPS,
///      because `MetadataModule` is and this is an upgrade of it. So the
///      `CHANGE_DELAY` below binds the ordinary path and not the owner, who can
///      upgrade past it.
///
///      That is a smaller loss than it looks, because the trust already exists.
///      This contract's owner can already rewrite `tokenURI` for every slot in
///      the protocol by upgrading — the ad content itself. Handing them the
///      pointer as well grants no power they were not already holding, and it
///      is one address to deploy, verify and bake in rather than three.
///
///      If the assurance is wanted later, it is `_authorizeUpgrade` that has to
///      change, not this. A timelock there, or renouncing upgradeability
///      outright, would make the delay below mean what it says.
contract AdModule is MetadataModule {
    // ─── Registry ────────────────────────────────────────────────────────
    //
    // Appended after `MetadataModule`'s single `tokenURI` mapping at slot 0.
    // Inheritance rather than a rewritten copy precisely so that ordering is
    // guaranteed by the compiler rather than by review — this is an upgrade
    // behind live proxies, and a reordered slot is a silently corrupted one.

    /// @notice How long a change to an EXISTING key must sit before it applies.
    /// @dev Two days: slow enough to be noticed, fast enough to be an incident
    ///      response. A slot that has genuinely been lost is an outage, and a
    ///      week of it to satisfy a delay nobody is watching helps no one.
    uint256 public constant CHANGE_DELAY = 2 days;

    /// @notice The key an SDK resolves when the publisher named no slot.
    bytes32 public constant PRIMARY = "primary";

    /// @notice What each key resolves to right now.
    mapping(bytes32 key => address slot) public slotOf;

    struct Pending {
        address slot;
        /// @dev Zero means nothing proposed, so a timed change TO the zero
        ///      address is not expressible. Deliberate: retiring a key is
        ///      `cancel` and leaving it, not a scheduled erase.
        uint64 readyAt;
    }

    /// @notice Changes waiting out `CHANGE_DELAY`.
    mapping(bytes32 key => Pending) public pendingOf;

    event SlotSet(bytes32 indexed key, address indexed previous, address indexed slot);
    event SlotProposed(bytes32 indexed key, address indexed slot, uint64 readyAt);
    event SlotProposalCancelled(bytes32 indexed key, address indexed slot);

    error ZeroSlot();
    error NothingPending();
    error TooEarly(uint64 readyAt);

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

    /// @dev Bumped from 2.1.0. Additive — `buyAndUpdate`, `updateMetadata` and
    ///      `tokenURI` are untouched, so nothing that reads or writes an ad
    ///      today has to change. The upgrade scripts assert on this to prove
    ///      the proxy pointer moved; `name()` deliberately does not change,
    ///      because the SDK verifies identity against it before it will write.
    function version() external pure override returns (string memory) {
        return "2.2.0";
    }

    // ─── Lens ────────────────────────────────────────────────────────────

    /// @notice Everything the render path reads, in one struct.
    struct AdView {
        address slot;
        address module;
        /// @dev The whole creative when stored inline as a `data:` URI, or an
        ///      `ipfs://` CID for ads published before that change.
        string uri;
        address occupant;
        bool vacant;
        uint256 price;
        uint256 deposit;
        /// @dev Accrued as of this block. A pure function of the clock, so a
        ///      client can tick it forward without asking again.
        uint256 taxOwed;
        uint256 collectedTax;
        uint256 taxPercentage;
        address currency;
        uint256 occupiedSince;
    }

    /// @notice Resolve a named slot and read it, in one call.
    function adByKey(bytes32 key) external view returns (AdView memory v) {
        return ad(slotOf[key]);
    }

    /// @notice Read a slot the caller already knows the address of.
    /// @dev Public and separate so a publisher running their own inventory gets
    ///      the same single-call read without going through the registry. The
    ///      indirection is a convenience, not a toll gate.
    ///
    ///      Nothing here reverts. A key resolving to nothing, a slot with no
    ///      module, a module without `tokenURI`, an address that is not a slot
    ///      — all are states a publisher's page can genuinely be in, and none
    ///      should become a failed RPC the SDK has to tell apart from a network
    ///      error. They come back as zero, and `slot == address(0)` is the cue
    ///      that there is nothing to draw.
    function ad(address slot) public view returns (AdView memory v) {
        if (slot == address(0)) return v;

        // Probed first: a staticcall to an address with no code SUCCEEDS and
        // returns nothing, which decodes as zero — so without this, any typo'd
        // address reports a healthy, vacant, free ad space that does not exist.
        if (slot.code.length == 0) return v;

        v.slot = slot;

        try ISlotRead(slot).module() returns (address m) {
            v.module = m;
        } catch {
            // A slot with no module has no ad. Its terms are still real and
            // still worth returning — an empty space has a price, and that
            // price is what makes it buyable.
        }

        if (v.module == address(this)) {
            // Our own storage. No call, no gas, and it cannot fail.
            v.uri = tokenURI[slot];
        } else if (v.module != address(0)) {
            try IMetadataRead(v.module).tokenURI(slot) returns (string memory u) {
                v.uri = u;
            } catch {}
        }

        try ISlotRead(slot).occupant() returns (address o) {
            v.occupant = o;
        } catch {}
        try ISlotRead(slot).isVacant() returns (bool b) {
            v.vacant = b;
        } catch {}
        try ISlotRead(slot).price() returns (uint256 p) {
            v.price = p;
        } catch {}
        try ISlotRead(slot).deposit() returns (uint256 d) {
            v.deposit = d;
        } catch {}
        try ISlotRead(slot).taxOwed() returns (uint256 t) {
            v.taxOwed = t;
        } catch {}
        try ISlotRead(slot).collectedTax() returns (uint256 c) {
            v.collectedTax = c;
        } catch {}
        try ISlotRead(slot).taxPercentage() returns (uint256 t) {
            v.taxPercentage = t;
        } catch {}
        try ISlotRead(slot).currency() returns (address c) {
            v.currency = c;
        } catch {}
        try ISlotRead(slot).occupiedSince() returns (uint256 s) {
            v.occupiedSince = s;
        } catch {}
    }
}
