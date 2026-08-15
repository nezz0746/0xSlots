// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUtility} from "../interfaces/IUtility.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";

/// @dev The slice of `Slot` this module calls. Declared here rather than
///      imported because `interfaces/ISlot.sol` carries the structs and events,
///      not a callable surface, and a module should depend on the four
///      functions it actually uses.
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

/// @title MetadataModule
/// @notice UUPS-upgradeable module that stores a URI per slot. Only the slot's occupant can update.
/// @dev msg.sender in hooks = the slot contract calling the module.
contract MetadataModule is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IUtility
{
    using SafeERC20 for IERC20;

    /// @notice slot address => URI
    mapping(address => string) public tokenURI;

    event MetadataUpdated(address indexed slot, string uri);

    error NotOccupant();
    /// @dev An ERC-20 slot is paid by allowance; value sent with one is a
    ///      mistake worth refusing rather than trapping in this contract.
    error UnexpectedValue();
    /// @dev EIP-2612 is a token extension. A native slot has no token.
    error NativeSlotHasNoPermit();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    modifier onlyOccupant(address slot) {
        if (msg.sender != _slotOccupant(slot)) revert NotOccupant();
        _;
    }

    /// @notice Update the URI for a slot. Only callable by the current occupant.
    /// @param slot The slot contract address
    /// @param uri The new URI (e.g. ipfs://...)
    function updateMetadata(
        address slot,
        string calldata uri
    ) external onlyOccupant(slot) {
        _setMetadata(slot, uri);
    }

    // ── Buy and publish in one call ───────────────────────────
    //
    // Taking a slot and putting something in it is two calls that CANNOT be
    // reordered or interleaved: `updateMetadata` is occupant-only, and `buy`
    // clears the previous creative on its way through, so the gap between them
    // is a slot showing nothing. A wallet that implements EIP-5792 closes that
    // gap by bundling. A plain browser extension does not — and the failure it
    // produced was not even honest: each receipt was awaited, but the wallet's
    // own RPC still had the old occupant, so `eth_estimateGas` on the metadata
    // write reverted and surfaced as a bare "internal error".
    //
    // Moving the sequencing on-chain removes the class of bug rather than
    // retrying it. One call frame, one occupant, nothing to observe in between.

    /// @notice Buy `slot` for `msg.sender` and set its URI in the same call.
    /// @dev The buy pays from `msg.sender` and seats `msg.sender`, so the write
    ///      that follows is the occupant's own — see `_setMetadata`.
    ///
    ///      NOTE for future occupancy policies: `Slot` passes its own
    ///      `msg.sender` as `OccupancyContext.caller`, which through this path
    ///      is THIS MODULE, not the buyer. `ctx.account` is still the buyer, and
    ///      neither shipped policy reads `caller` — but a policy that gates on
    ///      it would see the module here and must allow for that.
    ///
    /// @param slot The slot contract to buy
    /// @param depositAmount Deposit to fund the tax escrow
    /// @param selfAssessedPrice The new self-assessed price
    /// @param uri The URI to publish once the slot is held
    function buyAndUpdate(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        string calldata uri
    ) external payable {
        _buy(slot, depositAmount, selfAssessedPrice);
        _setMetadata(slot, uri);
    }

    /// @notice `buyAndUpdate`, preceded by an EIP-2612 permit.
    /// @dev This is the one that reaches a SINGLE transaction for a plain EOA.
    ///      `buyAndUpdate` alone still needs an `approve` before it; a permit is
    ///      a signature rather than a transaction, so it folds into this one.
    ///      USDC on Base implements 2612, which is what makes it worth having.
    function buyAndUpdateWithPermit(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        string calldata uri,
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
        // second use reverts on the spent nonce. That front-run is not an
        // attack on the buy — it does the same work, and the allowance it grants
        // is the one this call was going to use. What matters is whether the
        // allowance is there, which `safeTransferFrom` below decides for us; a
        // permit that failed for any other reason fails again there, with the
        // token's own error rather than a signature one.
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
        _setMetadata(slot, uri);
    }

    // ── Module hooks ──────────────────────────────────────────

    function onTransfer(uint256, address, address) external override {
        _clearMetadata(msg.sender);
    }

    function onPriceUpdate(uint256, uint256, uint256) external override {}

    function onRelease(uint256, address) external override {
        _clearMetadata(msg.sender);
    }

    /// @dev Not an accounting module — nothing to record when tax moves.
    function onSettle(uint256, address, uint256, uint256) external override {}

    /// @notice No fee for metadata module
    function feeBps() external pure override returns (uint256) {
        return 0;
    }

    /// @notice Fee recipient
    function feeRecipient() external pure override returns (address) {
        return 0x78a9e2891a47bAa6Ac9D541317b1278f9628dFf7;
    }

    /// @notice Module metadata URI
    function metadataURI() external pure override returns (string memory) {
        return "";
    }

    // ── ERC-165 ───────────────────────────────────────────────

    function name() external pure override returns (string memory) {
        return "AdLandModule";
    }

    function version() external pure override returns (string memory) {
        return "2.1.0";
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            interfaceId == type(IUtility).interfaceId ||
            interfaceId == type(IModuleMetadata).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // ── INTERNALS ─────────────────────────────────────────────

    /// @dev The write itself, with NO occupancy check.
    ///
    ///      `updateMetadata` does the checking in its modifier. `buyAndUpdate`
    ///      does not need to: `Slot.buy` seats `msg.sender` as occupant or
    ///      reverts, and this runs in the same call frame, so by the time it is
    ///      reached the caller demonstrably holds the slot. That is why this is
    ///      internal and why nothing else may call it — the modifier is not
    ///      being bypassed, it is being satisfied by other means.
    ///
    ///      Ordering matters and already works: `Slot.buy` fires `onTransfer` at
    ///      this module partway through, which CLEARS the URI. The write lands
    ///      after the buy returns, so it survives.
    function _setMetadata(address slot, string calldata uri) internal {
        tokenURI[slot] = uri;
        emit MetadataUpdated(slot, uri);
    }

    /// @dev Buy `slot` on behalf of `msg.sender`, funding it from them.
    function _buy(
        address slot,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) internal {
        address currency = ISlotBuy(slot).currency();

        if (currency == address(0)) {
            // Native. `Slot.buy` requires `msg.value` to equal what is owed
            // EXACTLY, and works that figure out itself, after settling and
            // after the occupancy policy has run. Forwarding the value verbatim
            // keeps the arithmetic in the one place that already reverts loudly
            // when it is wrong; recomputing it here would be a second copy free
            // to drift from the first.
            ISlotBuy(slot).buy{value: msg.value}(
                msg.sender,
                depositAmount,
                selfAssessedPrice
            );
            return;
        }

        if (msg.value != 0) revert UnexpectedValue();

        // Mirrors `owedByBuyer` in `Slot.buy`: a vacant slot costs the deposit
        // alone, an occupied one its standing price too. Safe to read ahead of
        // the call because `_settle()` moves the deposit, the collected tax and
        // the settle timestamp — and nothing else. Neither `_price` nor
        // `_occupant` can change between this read and the buy's own.
        uint256 owed = ISlotBuy(slot).occupant() == address(0)
            ? depositAmount
            : ISlotBuy(slot).price() + depositAmount;

        uint256 held = IERC20(currency).balanceOf(address(this));

        if (owed > 0) {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), owed);
            // `forceApprove`, not `approve`: USDC-style tokens refuse a
            // non-zero-to-non-zero allowance change, and a buy that reverted
            // after approving would leave exactly that behind.
            IERC20(currency).forceApprove(slot, owed);
        }

        ISlotBuy(slot).buy(msg.sender, depositAmount, selfAssessedPrice);

        if (owed > 0) {
            // Leave nothing standing. This module has no reason to hold an
            // allowance to anything between calls.
            IERC20(currency).forceApprove(slot, 0);

            // And nothing stranded. `owed` should be exactly what the slot
            // pulled, but it is computed from this module's reading of `Slot`,
            // and `Slot` sits behind an upgradeable beacon. If that reading ever
            // becomes an over-estimate, the difference belongs to the buyer, not
            // to this contract. Measured as a delta so a stray donation sitting
            // in the module is not handed to whoever buys next.
            uint256 residue = IERC20(currency).balanceOf(address(this));
            if (residue > held) {
                IERC20(currency).safeTransfer(msg.sender, residue - held);
            }
        }
    }

    function _clearMetadata(address slot) internal {
        delete tokenURI[slot];
        emit MetadataUpdated(slot, "");
    }

    function _slotOccupant(address slot) internal view returns (address) {
        (bool ok, bytes memory data) = slot.staticcall(
            abi.encodeWithSignature("occupant()")
        );
        require(ok, "occupant() call failed");
        return abi.decode(data, (address));
    }

    // ── UUPS ──────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
