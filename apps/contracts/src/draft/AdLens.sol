// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SlotRegistry} from "./SlotRegistry.sol";

/// @dev The slice of `Slot` a reader needs. Declared here rather than imported
///      from `interfaces/ISlot.sol` for the reason `MetadataModule` gives for
///      doing the same: that file carries structs and events, not a callable
///      surface, and a lens should depend on the getters it actually calls.
///
///      `module()` rather than `utility()`: the storage variable was renamed and
///      `module()` is the compatibility getter, which is what slots deployed on
///      either side of the rename both answer to.
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

/// @title AdLens
/// @notice One `eth_call` for everything rendering an ad needs.
///
/// @dev ── Why this is worth a contract ───────────────────────────────────
///
///      Rendering an ad in a browser costs three serial requests today, and
///      they are serial because each one's input is the last one's output:
///      `module()`, then `tokenURI(slot)`, then the metadata itself. Measured
///      against production that is roughly half a second before the image
///      element is even given a `src`. Multicall does not help — batching is
///      for calls that do not depend on each other, and these do.
///
///      Doing the hops inside a single `view` collapses them to one round trip.
///      With the ad now stored inline in `tokenURI` rather than behind an IPFS
///      CID, that one call returns the creative too: no gateway, no second
///      fetch, nothing off-chain on the render path at all.
///
///      Adding the registry lookup in front makes it one call *including* the
///      thing that used to be hardcoded in the publisher's HTML. So resolving a
///      slot by name is cheaper than reading a slot you already knew.
///
///      ── Why nothing here reverts ────────────────────────────────────────
///
///      Every hop is a `try`. A key that resolves to nothing, a slot with no
///      module attached, a module that does not implement `tokenURI`, a slot
///      address that is not a slot — all of them are states a publisher's page
///      can genuinely be in, and none of them should turn into a failed RPC
///      call that the SDK has to distinguish from a network error. They come
///      back as zero values, and `slot == address(0)` is the caller's cue that
///      there is nothing to draw.
///
///      Stateless and non-upgradeable. It holds nothing and decides nothing, so
///      redeploying it is free — and unlike the registry, its address is not a
///      promise to anybody.
contract AdLens {
    /// @notice Everything the render path reads, in one struct.
    struct AdView {
        address slot;
        address module;
        /// @dev The whole creative when stored inline as a `data:` URI, or the
        ///      `ipfs://` CID for ads published before that change.
        string uri;
        address occupant;
        bool vacant;
        uint256 price;
        uint256 deposit;
        /// @dev Accrued at the block this was read. A pure function of the
        ///      clock, so a client can tick it forward without asking again.
        uint256 taxOwed;
        uint256 collectedTax;
        uint256 taxPercentage;
        address currency;
        uint256 occupiedSince;
    }

    SlotRegistry public immutable registry;

    constructor(SlotRegistry registry_) {
        registry = registry_;
    }

    /// @notice Resolve a named slot and read it.
    /// @param key The registry key, e.g. `SlotRegistry.PRIMARY`.
    function adByKey(bytes32 key) external view returns (AdView memory view_) {
        return ad(registry.slotOf(key));
    }

    /// @notice Read a slot the caller already knows the address of.
    /// @dev Public and separate so a publisher running their own inventory gets
    ///      the same single-call read without going through our registry. The
    ///      indirection is a convenience, not a toll gate.
    function ad(address slot) public view returns (AdView memory view_) {
        if (slot == address(0)) return view_;

        // Probed before anything else: an address that is not a contract
        // answers every staticcall with success and empty returndata, which
        // decodes as zero and would report a healthy, vacant, free slot.
        if (slot.code.length == 0) return view_;

        view_.slot = slot;

        try ISlotRead(slot).module() returns (address m) {
            view_.module = m;
        } catch {
            // A slot with no module has no ad. The terms below are still real
            // and still worth returning — an empty space has a price.
        }

        if (view_.module != address(0)) {
            try IMetadataRead(view_.module).tokenURI(slot) returns (string memory u) {
                view_.uri = u;
            } catch {}
        }

        try ISlotRead(slot).occupant() returns (address o) {
            view_.occupant = o;
        } catch {}
        try ISlotRead(slot).isVacant() returns (bool v) {
            view_.vacant = v;
        } catch {}
        try ISlotRead(slot).price() returns (uint256 p) {
            view_.price = p;
        } catch {}
        try ISlotRead(slot).deposit() returns (uint256 d) {
            view_.deposit = d;
        } catch {}
        try ISlotRead(slot).taxOwed() returns (uint256 t) {
            view_.taxOwed = t;
        } catch {}
        try ISlotRead(slot).collectedTax() returns (uint256 c) {
            view_.collectedTax = c;
        } catch {}
        try ISlotRead(slot).taxPercentage() returns (uint256 t) {
            view_.taxPercentage = t;
        } catch {}
        try ISlotRead(slot).currency() returns (address c) {
            view_.currency = c;
        } catch {}
        try ISlotRead(slot).occupiedSince() returns (uint256 s) {
            view_.occupiedSince = s;
        } catch {}
    }
}
