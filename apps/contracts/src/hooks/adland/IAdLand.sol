// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SlotInfo} from "../../SlotViews.sol";

/// @dev The slice of `Slot` AdLand calls. Narrow on purpose: declaring the
///      whole surface would recompile this on every unrelated change to it.
interface ISlotAd {
    function getSlotInfo() external view returns (SlotInfo memory);
    function occupant() external view returns (address);
    function tenureId() external view returns (uint64);
    function currency() external view returns (address);
    function price() external view returns (uint256);
    function buy(
        address account,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) external payable;
}

/**
 * @title IAdLand
 * @notice The shapes AdLand speaks in: what a creative is, what a key is, and
 *         what one call gives a publisher's page.
 *
 * @dev Split out so the SDK, the indexer and the embed can import the types
 *      without pulling in the implementation — and so a reader can see the
 *      whole vocabulary on one screen.
 */

/// @notice A published creative, and the tenure it belongs to.
/// @dev The stamp is the whole correctness argument. See `AdLandHook`.
struct Creative {
    string uri;
    uint64 tenureId;
}

/// @notice A key change waiting out its delay.
struct Pending {
    address slot;
    /// @dev Zero means nothing proposed, so a timed change TO the zero address
    ///      is not expressible. Deliberate: retiring a key is `cancelSlot` and
    ///      leaving it, not a scheduled erase.
    uint64 readyAt;
}

/// @notice Everything the render path reads, in one call.
/// @dev `info` is the slot's own `SlotInfo` verbatim rather than a flattened
///      copy. V1's lens declared eleven fields of its own and probed each with
///      a separate `try`, which meant the struct drifted every time `Slot`
///      gained a getter. Embedding it means this grows for free and cannot
///      disagree.
struct AdView {
    /// @dev Zero is the cue that there is nothing to draw. Nothing here
    ///      reverts, so the SDK never has to tell a bad address apart from a
    ///      network error.
    address slot;
    /// @dev The creative currently applying, already resolved against the
    ///      tenure — empty when the slot turned over or stands vacant.
    string uri;
    /// @dev True when `slot` points at THIS contract as its hook. False means
    ///      the terms below are real but no creative can be published here.
    bool managed;
    SlotInfo info;
}

interface IAdLand {
    // ─── events ─────────────────────────────────────────────────────────────

    event Published(address indexed slot, string uri, uint64 tenureId);
    event Cleared(address indexed slot, uint64 fromTenure, uint64 toTenure);

    event SlotSet(
        bytes32 indexed key,
        address indexed previous,
        address indexed slot
    );
    event SlotProposed(
        bytes32 indexed key,
        address indexed slot,
        uint64 readyAt
    );
    event SlotProposalCancelled(bytes32 indexed key, address indexed slot);

    // ─── errors ─────────────────────────────────────────────────────────────

    error NotOccupant();
    error ZeroSlot();
    /// @notice That key already resolves to a slot.
    error KeyTaken(bytes32 key);
    /// @notice Not the contract owner, and not the holder of this key.
    error NotKeyOwner(bytes32 key);
    error NothingPending();
    error TooEarly(uint64 readyAt);
    error NativeSlotHasNoPermit();
    error UnexpectedValue();

    // ─── publishing ─────────────────────────────────────────────────────────

    function publish(address slot, string calldata uri) external;

    function buyAndPublish(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 maxPayment,
        string calldata uri
    ) external payable;

    // ─── reading ────────────────────────────────────────────────────────────

    function ad(address slot) external view returns (AdView memory);

    function adByKey(bytes32 key) external view returns (AdView memory);

    function creativeOf(address slot) external view returns (string memory);

    // ─── registry ───────────────────────────────────────────────────────────

    function slotOf(bytes32 key) external view returns (address);

    function primary() external view returns (address);
}

/**
 * The two things {AdLandCreate} needs of the protocol it deploys into.
 *
 * Declared here rather than imported from `Slot.sol` and `SlotFactory.sol`,
 * which would pull the whole core into this hook's compilation unit — and with
 * it every one of the core's imports into the initcode hash that decides this
 * contract's CREATE2 address.
 */
struct SlotInit {
    address recipient;
    IERC20 currency;
    address manager;
    address hook;
    bytes32 hookData;
    uint256 taxBps;
    uint256 minDepositSeconds;
    bool mutableTax;
    bool mutableHook;
}

interface ISlotFactory {
    function createSlot(SlotInit calldata init) external returns (address);
}
