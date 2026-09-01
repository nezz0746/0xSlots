// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IUtility} from "../interfaces/IUtility.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";

interface ISlotBuy {
    function buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) external payable;

    function currency() external view returns (address);

    function occupant() external view returns (address);

    function price() external view returns (uint256);
}

/// @title SlotData — one utility, any number of services
///
/// @notice Arbitrary data attached to a slot, writable only by its occupant and
///         gone the moment the slot changes hands. Every application that wants
///         to hang something off a slot registers a *service* — a named ABI
///         signature — and writes bytes against it.
///
/// @dev ── WHY THIS REPLACES A FAMILY OF MODULES ─────────────────────────
///      `MetadataModule` and `FeedPostModule` are the same contract twice:
///
///          mapping(slot => payload)     the data
///          write gated on occupant()    the permission
///          cleared on transfer/release  the lifetime
///          an event carrying it         the read surface
///
///      What differs is the payload type. That is not enough to justify two
///      deployments, and it costs something real, because a slot names exactly
///      ONE `utility` address. Choosing the metadata module today EXCLUDES the
///      feed module — not because they conflict, but because there is one
///      pointer. Here a slot points at this once and carries as many services
///      as anyone cares to register.
///
///      ── WHAT IS GENERIC IS THE LIFECYCLE, NOT THE STORAGE ──────────────
///      `mapping(address => bytes)` is the boring half. The half worth sharing
///      is: permission derived from live occupancy, data that cannot outlive
///      the tenancy, and the `IUtility` wiring that makes the slot call back on
///      transfer. Get that wrong once and every module built on it is wrong.
///
///      ── THE SCHEMA LIVES ON CHAIN ──────────────────────────────────────
///      `Service.schema` holds the ABI signature — `"string uri"`,
///      `"string text,string[] medias"` — so anything with an RPC can decode
///      any write without the author's repo, their website, or their
///      permission. A registry whose schemas live in a file somewhere makes
///      every third party depend on whoever hosts that file; putting the string
///      in storage is what keeps "build on top" from meaning "ask us first".
///
///      Off-chain descriptors are still useful — renderer hints, docs, icons —
///      which is what `metadataURI` is for. Optional polish, never required for
///      correctness.
///
///      ── REGISTRATION IS PERMISSIONLESS ─────────────────────────────────
///      Deliberately not owner-gated. An admin-gated schema registry is a
///      whitelist wearing a registry's clothes: it makes the operator the
///      arbiter of what may be built, which is the thing this contract exists
///      to avoid. Registration is cheap, ids are sequential, and a junk service
///      costs its registrant gas and everyone else nothing — clients render the
///      services they know and ignore the rest.
/// @dev `IUtility` already extends `IModuleMetadata`, so listing both would put
///      a derived interface ahead of its own base and refuse to linearize.
contract SlotData is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IUtility
{
    using SafeERC20 for IERC20;

    /// @notice A kind of data anyone can write against.
    ///
    /// @dev Held in a MAPPING, never an array. Struct fields may be appended in
    ///      a future upgrade — each mapping entry lives at its own hashed base
    ///      slot, so growing the struct moves nothing. In an array the entries
    ///      are adjacent and the same edit would shred every one of them.
    ///      That is the whole reason `serviceCount` exists alongside the map.
    struct Service {
        /// @dev ABI signature of the payload, e.g. `"string uri"`. Not
        ///      validated on chain — there is no cheap way to check a string
        ///      parses as a signature, and a wrong one only breaks the
        ///      registrant's own decoding.
        string schema;
        string name;
        /// @dev Informational. Does NOT gate writes: anyone may write against
        ///      any service, on any slot they occupy. A service is a shape, not
        ///      a permission.
        address registrar;
        /// @dev Optional off-chain descriptor — docs, renderer hints, an icon.
        string metadataURI;
    }

    uint256 public constant MAX_SCHEMA = 512;
    uint256 public constant MAX_NAME = 64;
    uint256 public constant MAX_URI = 256;
    uint256 public constant MAX_DATA = 4096;

    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════

    /// @notice Service ids run 1..serviceCount. `0` means "no service".
    uint256 public serviceCount;

    mapping(uint256 => Service) internal _services;

    /// @notice Which tenancy a slot is currently on.
    ///
    /// @dev The trick that makes clearing O(1). Data is keyed by
    ///      `(slot, generation, service)`, so ending a tenancy is one increment
    ///      rather than a loop over every service that was written.
    ///
    ///      This matters because `onTransfer` runs inside the slot's own
    ///      transfer under a gas cap. A module that looped to clear would work
    ///      fine with two services and silently start failing at twenty — and a
    ///      failing utility hook is swallowed by the slot, so the data would
    ///      just quietly survive into someone else's tenancy.
    ///
    ///      Old generations stay in storage, unreadable. "Cleared" means "no
    ///      longer this tenancy's", not "erased from the chain" — which was
    ///      never on offer anyway, since every write is in the logs forever.
    mapping(address => uint256) public generationOf;

    /// @dev slot => generation => serviceId => payload
    mapping(address => mapping(uint256 => mapping(uint256 => bytes)))
        internal _data;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event ServiceRegistered(
        uint256 indexed id,
        address indexed registrar,
        string schema,
        string name,
        string metadataURI
    );

    /// @notice A payload was written.
    ///
    /// @dev `generation` is in the data rather than a topic because a reader
    ///      filtering by slot wants the whole history and then compares against
    ///      the current generation once. Making it a topic would cost the
    ///      `writer` slot, which is the one an author's own feed needs.
    event Wrote(
        address indexed slot,
        uint256 indexed serviceId,
        address indexed writer,
        uint256 generation,
        bytes data
    );

    /// @notice A tenancy ended; everything written under it is now stale.
    event Cleared(address indexed slot, uint256 generation);

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error NotOccupant(address slot);
    error NoSuchService(uint256 id);
    error EmptySchema();
    error TooLong();
    error LengthMismatch();
    error UnexpectedValue();
    error NativeSlotHasNoPermit();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    // ═══════════════════════════════════════════════════════════
    // SERVICES
    // ═══════════════════════════════════════════════════════════

    /// @notice Register a kind of data. Anyone may call this.
    /// @return id The new service id.
    function registerService(
        string calldata schema,
        string calldata serviceName,
        string calldata descriptorURI
    ) external returns (uint256 id) {
        if (bytes(schema).length == 0) revert EmptySchema();
        if (
            bytes(schema).length > MAX_SCHEMA ||
            bytes(serviceName).length > MAX_NAME ||
            bytes(descriptorURI).length > MAX_URI
        ) revert TooLong();

        id = ++serviceCount;
        _services[id] = Service({
            schema: schema,
            name: serviceName,
            registrar: msg.sender,
            metadataURI: descriptorURI
        });

        emit ServiceRegistered(id, msg.sender, schema, serviceName, descriptorURI);
    }

    function serviceOf(uint256 id) external view returns (Service memory) {
        return _services[id];
    }

    // ═══════════════════════════════════════════════════════════
    // WRITING
    // ═══════════════════════════════════════════════════════════

    /// @notice Attach `data` to `slot` under `serviceId`.
    /// @dev Occupancy is read live, so being outbid stops the next write in the
    ///      very next block rather than at some checkpoint.
    function write(
        address slot,
        uint256 serviceId,
        bytes calldata data
    ) external {
        _requireOccupant(slot);
        _write(slot, serviceId, data);
    }

    /// @notice Write several services in one transaction.
    /// @dev The direct payoff of one utility carrying many services: an app
    ///      that spans three of them publishes once instead of three times.
    function writeMany(
        address slot,
        uint256[] calldata serviceIds,
        bytes[] calldata datas
    ) external {
        if (serviceIds.length != datas.length) revert LengthMismatch();
        _requireOccupant(slot);
        for (uint256 i; i < serviceIds.length; ++i) {
            _write(slot, serviceIds[i], datas[i]);
        }
    }

    /// @notice Take the slot and publish in one transaction.
    ///
    /// @dev The reason this lives in the module rather than the caller: between
    ///      a separate `buy` and `write` the slot is held with nothing on it,
    ///      and anyone can outbid into that gap. Atomic is the only version
    ///      that is actually usable.
    ///
    ///      The slot sees THIS CONTRACT as `msg.sender` during the buy while
    ///      the occupant becomes the caller. An occupancy policy that gates on
    ///      the caller will see the module here and must allow for it.
    function buyAndWrite(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 serviceId,
        bytes calldata data
    ) external payable {
        _buy(slot, depositAmount, selfAssessedPrice);
        _write(slot, serviceId, data);
    }

    /// @notice `buyAndWrite`, preceded by an EIP-2612 permit.
    /// @dev The one that reaches a SINGLE transaction for a plain EOA —
    ///      `buyAndWrite` alone still needs an `approve` before it, and a permit
    ///      is a signature rather than a transaction.
    function buyAndWriteWithPermit(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 serviceId,
        bytes calldata data,
        uint256 permitValue,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        address currency = ISlotBuy(slot).currency();
        if (currency == address(0)) revert NativeSlotHasNoPermit();

        // Swallow a failed permit rather than revert on it. A permit is a public
        // signature: anyone watching the mempool can submit it first, and the
        // second use reverts on the spent nonce. That front-run is not an attack
        // on the buy — it does the same work, and grants the same allowance.
        // Whether the allowance is actually there is decided below by
        // `safeTransferFrom`, with the token's own error.
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

        _buy(slot, depositAmount, selfAssessedPrice);
        _write(slot, serviceId, data);
    }

    // ═══════════════════════════════════════════════════════════
    // READING
    // ═══════════════════════════════════════════════════════════

    /// @notice The current tenancy's payload, or empty.
    function read(
        address slot,
        uint256 serviceId
    ) public view returns (bytes memory) {
        return _data[slot][generationOf[slot]][serviceId];
    }

    /// @notice Several services at once, for a client rendering one slot.
    function readMany(
        address slot,
        uint256[] calldata serviceIds
    ) external view returns (bytes[] memory out) {
        uint256 gen = generationOf[slot];
        out = new bytes[](serviceIds.length);
        for (uint256 i; i < serviceIds.length; ++i) {
            out[i] = _data[slot][gen][serviceIds[i]];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SLOT HOOKS
    // ═══════════════════════════════════════════════════════════

    /// @dev One storage write, whatever was attached. See `generationOf`.
    function onTransfer(uint256, address, address) external override {
        _endTenancy(msg.sender);
    }

    function onRelease(uint256, address) external override {
        _endTenancy(msg.sender);
    }

    function onPriceUpdate(uint256, uint256, uint256) external override {}

    function onSettle(uint256, address, uint256, uint256) external override {}

    // ═══════════════════════════════════════════════════════════
    // MODULE METADATA
    // ═══════════════════════════════════════════════════════════

    function name() external pure override returns (string memory) {
        return "SlotData";
    }

    function version() external pure virtual override returns (string memory) {
        return "1.0.0";
    }

    function feeBps() external pure override returns (uint256) {
        return 0;
    }

    function feeRecipient() external pure override returns (address) {
        return address(0);
    }

    function metadataURI() external pure override returns (string memory) {
        return "";
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            interfaceId == type(IUtility).interfaceId ||
            interfaceId == type(IModuleMetadata).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _requireOccupant(address slot) internal view {
        if (ISlotBuy(slot).occupant() != msg.sender) revert NotOccupant(slot);
    }

    function _write(
        address slot,
        uint256 serviceId,
        bytes calldata data
    ) internal {
        if (serviceId == 0 || serviceId > serviceCount) {
            revert NoSuchService(serviceId);
        }
        if (data.length > MAX_DATA) revert TooLong();

        uint256 gen = generationOf[slot];
        _data[slot][gen][serviceId] = data;
        emit Wrote(slot, serviceId, msg.sender, gen, data);
    }

    /// @dev Called by the SLOT, so `msg.sender` is the slot itself. Nothing
    ///      else can reach it, and nothing needs to: an impostor could only
    ///      bump its own generation.
    function _endTenancy(address slot) internal {
        uint256 next = ++generationOf[slot];
        emit Cleared(slot, next);
    }

    function _buy(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) internal {
        address currency = ISlotBuy(slot).currency();

        if (currency == address(0)) {
            // Native. `Slot.buy` requires `msg.value` to equal what is owed
            // EXACTLY and works that out itself, after settling and after the
            // occupancy policy has run. Forwarding verbatim keeps the
            // arithmetic in the one place that already reverts loudly when it
            // is wrong.
            ISlotBuy(slot).buy{value: msg.value}(
                msg.sender,
                depositAmount,
                selfAssessedPrice
            );
            return;
        }

        if (msg.value != 0) revert UnexpectedValue();

        // Mirrors `owedByBuyer` in `Slot.buy`: a vacant slot costs the deposit
        // alone, an occupied one its standing price too.
        uint256 owed = ISlotBuy(slot).occupant() == address(0)
            ? depositAmount
            : ISlotBuy(slot).price() + depositAmount;

        uint256 held = IERC20(currency).balanceOf(address(this));

        if (owed > 0) {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), owed);
            // `forceApprove`: USDC-style tokens refuse a non-zero-to-non-zero
            // allowance change, and a buy that reverted after approving would
            // leave exactly that behind.
            IERC20(currency).forceApprove(slot, owed);
        }

        ISlotBuy(slot).buy(msg.sender, depositAmount, selfAssessedPrice);

        if (owed > 0) {
            IERC20(currency).forceApprove(slot, 0);

            // Nothing stranded. `owed` is this module's reading of a `Slot`
            // that sits behind an upgradeable beacon; if that reading ever
            // becomes an over-estimate the difference belongs to the buyer.
            // Measured as a delta so a stray donation is not handed to whoever
            // buys next.
            uint256 residue = IERC20(currency).balanceOf(address(this));
            if (residue > held) {
                IERC20(currency).safeTransfer(msg.sender, residue - held);
            }
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
