// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;


import {SlotInfo} from "../../slot/SlotViews.sol";
import {SlotInit} from "../../types/SlotTypes.sol";

/// @dev The slice of `Slot` AdLand calls. Narrow on purpose: declaring the
///      whole surface would recompile this on every unrelated change to it.
interface ISlotAd {
    function getSlotInfo() external view returns (SlotInfo memory);
    function occupant() external view returns (address);
    function tenureId() external view returns (uint64);
    function currency() external view returns (address);
    function price() external view returns (uint256);
    function manager() external view returns (address);
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

/**
 * @notice How a slot's manager screens creatives before they show.
 *
 * @dev Declared in this order on purpose, and it must stay in it. `Open` is
 *      the zero value, which is what every slot created before moderation
 *      existed reads back — so those slots behave exactly as they always did,
 *      and the upgrade changes nothing for anyone who never opts in.
 */
enum ModerationMode {
    /// @notice A published creative shows immediately. The behaviour before v4.
    Open,
    /// @notice Each tenure's first creative waits for approval. Once one has
    ///         been approved in a tenure, that occupant publishes directly.
    FirstPerTenure,
    /// @notice Every creative waits for approval. The last approved one keeps
    ///         showing until the next is approved.
    Every
}

/// @notice A slot's moderation mode, and a change scheduled for a later tenure.
struct Moderation {
    ModerationMode current;
    ModerationMode next;
    /// @dev The tenure `next` takes over from. Zero means nothing scheduled.
    uint64 nextFromTenure;
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

    /// @notice `mode` applies to `slot` from `fromTenure` on. Equal to the
    ///         current tenure when it applied immediately.
    event ModerationModeSet(address indexed slot, ModerationMode mode, uint64 fromTenure);
    /// @notice A creative is waiting for the manager. Not showing.
    event Submitted(address indexed slot, string uri, uint64 tenureId);
    /// @notice The manager approved a waiting creative. `Published` follows.
    event Approved(address indexed slot, string uri, uint64 tenureId);
    /// @notice The manager turned a waiting creative down.
    event Rejected(address indexed slot, string uri, uint64 tenureId);

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
    /// @notice Only the slot's manager moderates it.
    error NotSlotManager();
    /// @notice Nothing is waiting — or what was waiting belongs to an ended tenure.
    error NothingToModerate();
    /// @notice The waiting creative is no longer the one the manager reviewed.
    error SubmissionChanged();

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

/// @notice The one thing {AdLandCreate} needs of the protocol it deploys into.
interface ISlotFactory {
    function createSlot(SlotInit calldata init) external returns (address);
}
