// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice What happens to the underlying when nobody wants the seat. Chosen
///         once, at wrap, and never again.
enum Mode {
    /// The underlying never leaves. The wrapper is its final owner.
    Permanent,
    /// The depositor may take it back when nobody is occupying.
    Reclaimable
}

/// @dev One deposit. Packed: `underlying` + `mode` + `retired` share a slot.
struct Wrap {
    address underlying;
    Mode mode;
    bool retired;
    address depositor;
    uint256 underlyingId;
}

/**
 * @title ISlotBoundNFTWrapper
 * @notice What a wrapper emits and refuses.
 *
 * @dev Split out so the SDK and the indexer can import the vocabulary without
 *      pulling in the implementation. Same reason as {ISlotBoundNFT}.
 */
interface ISlotBoundNFTWrapper {
    // ─── events ─────────────────────────────────────────────────────────────

    event Wrapped(
        uint256 indexed tokenId,
        address indexed slot,
        address indexed depositor,
        address underlying,
        uint256 underlyingId,
        Mode mode,
        uint256 taxBps
    );

    event Withdrawn(
        uint256 indexed tokenId,
        address indexed slot,
        address indexed depositor,
        address underlying,
        uint256 underlyingId
    );

    // ─── errors ─────────────────────────────────────────────────────────────

    /// @dev The token is soulbound to occupancy. Only {_sync} and a retirement
    ///      burn may move it.
    error NotTransferable();
    /// @dev The slot's underlying has been withdrawn. Nothing backs it.
    error SlotRetired();
    error NotDepositor();
    error NotReclaimable();
    /// @dev Someone other than the depositor holds the slot.
    error Occupied();
    /// @dev Reached this contract other than through {wrap}.
    error UnsolicitedTransfer();
    error InvalidFactory();
}
