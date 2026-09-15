// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from
    "@openzeppelin-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from
    "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ISlotHook, HookFlags, SlotContext} from "../../ISlotHook.sol";
import {SlotFactory} from "../../SlotFactory.sol";
import {SlotInit} from "../../Slot.sol";
import {SlotMath} from "../../SlotMath.sol";
import {Versioned} from "../../Versioned.sol";
import {ISlotOccupancy, ISlotBoundNFT} from "./ISlotBoundNFT.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "./ISlotBoundNFTWrapper.sol";

/**
 * @title SlotBoundNFTWrapper
 * @notice An ERC-721 you already own, put under common ownership.
 *
 * @dev {SlotBoundNFT} mints a token backed by nothing. This escrows a real one
 *      and keeps the identical lifecycle: ownership is real ERC-721 storage
 *      moved in `afterBuy`, safe only because this hook declares `strict`.
 *
 *      Monolithic and permissionless — any ERC-721, any depositor, terms per
 *      wrap. The depositor is the recipient and the manager of their own slot;
 *      that is safe only because {SlotAdmin} can never change anything under a
 *      sitting occupant. If that ever stops being true, this contract is a rug.
 *
 *      The occupant never redeems. This is a market in occupancy, not a way to
 *      buy the asset.
 */
contract SlotBoundNFTWrapper is
    ERC721Upgradeable,
    ReentrancyGuard,
    Versioned,
    ISlotHook,
    ISlotBoundNFTWrapper,
    IERC721Receiver
{
    /// @dev Native ETH, always. A constant so a beacon upgrade could only ever
    ///      change it for FUTURE wraps — every slot holds its own copy.
    IERC20 internal constant CURRENCY = IERC20(address(0));

    uint256 public constant MIN_DEPOSIT_SECONDS = 7 days;

    SlotFactory public slotFactory;

    mapping(uint256 tokenId => Wrap) internal _wrapped;
    mapping(uint256 tokenId => address slot) public slotOf;
    /// @dev Zero means the slot is not one of ours.
    mapping(address slot => uint256 tokenId) public tokenOf;

    uint256 public totalWrapped;

    /// @dev Open only while THIS contract moves or burns a token of its own.
    ///      Read by {_update} and nothing else.
    bool private _moving;

    /// @dev Locks the IMPLEMENTATION. Only a proxy delegating in runs `initialize`.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc Versioned
    function version() public pure override returns (uint64) {
        return 1;
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        SlotFactory factory_
    ) external initializer {
        if (address(factory_) == address(0)) revert InvalidFactory();
        __ERC721_init(name_, symbol_);
        slotFactory = factory_;
    }

    /// @notice Escrow an ERC-721, open a slot on your own terms, and take the
    ///         first seat at `valuation`.
    /// @dev Costs the escrow deposit only. Unlike {SlotBoundNFT.mint} there is
    ///      no valuation leg: the depositor IS the recipient, so paying it
    ///      would be their own money in a circle.
    function wrap(
        IERC721 underlying,
        uint256 underlyingId,
        uint256 taxBps,
        uint256 valuation,
        Mode mode
    ) external payable nonReentrant returns (uint256 tokenId, address slot) {
        // Plain `transferFrom`: no receiver callback, so no arbitrary code runs
        // inside this frame. See {onERC721Received}.
        underlying.transferFrom(msg.sender, address(this), underlyingId);

        // Nothing below is re-validated here. `taxBps`, `valuation` and the
        // deposit floor are the slot's to enforce, and one validation means one
        // authority.
        slot = slotFactory.createSlot(
            SlotInit({
                recipient: msg.sender,
                currency: CURRENCY,
                manager: msg.sender,
                hook: address(this),
                hookData: bytes32(0),
                taxBps: taxBps,
                minDepositSeconds: MIN_DEPOSIT_SECONDS,
                mutableTax: true,
                mutableHook: false
            })
        );

        unchecked {
            tokenId = ++totalWrapped;
        }

        // Before the buy: it calls `afterBuy` back mid-frame, and {_sync} reads
        // `tokenOf` to decide whether the slot is one of ours.
        slotOf[tokenId] = slot;
        tokenOf[slot] = tokenId;
        _wrapped[tokenId] = Wrap({
            underlying: address(underlying),
            mode: mode,
            retired: false,
            depositor: msg.sender,
            underlyingId: underlyingId
        });

        _mint(address(this), tokenId);
        emit Wrapped(
            tokenId,
            slot,
            msg.sender,
            address(underlying),
            underlyingId,
            mode,
            taxBps
        );

        ISlotOccupancy(slot).buy{value: msg.value}(
            msg.sender,
            valuation,
            msg.value,
            0
        );
    }

    /// @notice What a wrap costs. For a UI: the slot enforces the real floor.
    /// @dev Exists because the slot does not yet exist when a caller needs this.
    function quoteWrap(
        uint256 valuation,
        uint256 taxBps
    ) external pure returns (uint256 deposit) {
        return SlotMath.depositFor(valuation, taxBps, MIN_DEPOSIT_SECONDS);
    }

    function wrapOf(uint256 tokenId) external view returns (Wrap memory) {
        Wrap memory w = _wrapped[tokenId];
        if (w.underlying == address(0)) revert ISlotBoundNFT.NoSuchToken(tokenId);
        return w;
    }

    // ─── hook ───────────────────────────────────────────────────────────────

    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.strict = true; // why this contract can hold real ownership state
    }

    function validateHookData(bytes32) external view {}

    function beforeBuy(SlotContext calldata) external view {}

    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterRelease(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterSettle(SlotContext calldata) external {}

    /// @dev Reads `occupant()` live, never `ctx`: the `after` entry points are
    ///      world-callable, so a forged context must be able to change nothing.
    function _sync(address slot) internal {
        uint256 tokenId = tokenOf[slot];
        if (tokenId == 0) return; // not ours; never revert on a stranger

        address want = ISlotOccupancy(slot).occupant();
        if (want == address(0)) want = address(this);

        address have = _ownerOf(tokenId);
        if (have == want) return;

        _moving = true;
        _transfer(have, want, tokenId);
        _moving = false;
    }

    /// @dev Mints pass, and so do this contract's own moves. Everything else
    ///      is refused: the token is soulbound to occupancy.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0) && !_moving) revert NotTransferable();
        return super._update(to, tokenId, auth);
    }

    /// @dev Nothing reaches this contract except through {wrap}, which uses
    ///      plain `transferFrom`. An escrow that accepts unsolicited transfers
    ///      strands what it is sent, and it has no rescue path by design.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert UnsolicitedTransfer();
    }
}
