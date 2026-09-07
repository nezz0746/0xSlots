// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ISlotHook, HookFlags, SlotContext} from "../../ISlotHook.sol";
import {SlotFactory} from "../../SlotFactory.sol";
import {SlotInit} from "../../Slot.sol";
import {SlotInfo} from "../../SlotViews.sol";
import {SlotMath} from "../../SlotMath.sol";
import {ISlotBoundNFT, ISlotOccupancy} from "./ISlotBoundNFT.sol";

/**
 * @title SlotBoundNFT
 * @notice One token per slot, owned by whoever occupies it.
 *
 * @dev Ownership is real ERC-721 storage moved in `afterBuy`, safe only because
 *      this hook declares `strict` — so the move cannot be starved, and the slot
 *      is only as evictable as this contract. Deriving `ownerOf` instead would
 *      avoid that but emit no {Transfer}, so no marketplace would ever see it.
 *
 *      Soulbound: occupancy is the only market for the position.
 */
contract SlotBoundNFT is
    ERC721,
    Ownable,
    ReentrancyGuard,
    ISlotHook,
    ISlotBoundNFT
{
    using SafeERC20 for IERC20;

    SlotFactory public immutable FACTORY;

    uint256 public immutable MAX_SUPPLY;

    SlotInit private _terms;

    mapping(uint256 tokenId => address slot) public slotOf;
    /// @dev Zero means the slot is not one of ours.
    mapping(address slot => uint256 tokenId) public tokenOf;

    uint256 public totalMinted;

    /// @dev Open only during {_sync}. Read by {_update} and nothing else.
    bool private _syncing;

    string private _uri;

    /// @param manager_ May change the rent later, on the slots directly. Zero
    ///        fixes it forever. @param owner Holds the metadata, nothing else.
    /// @dev `mutableHook` is false always: a detachable hook strands the token.
    constructor(
        SlotFactory factory_,
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        IERC20 currency_,
        uint256 taxBps_,
        uint256 minDepositSeconds_,
        address recipient_,
        address manager_,
        address owner
    ) ERC721(name_, symbol_) Ownable(owner) {
        FACTORY = factory_;
        MAX_SUPPLY = maxSupply_;

        _terms = SlotInit({
            recipient: recipient_,
            currency: currency_,
            manager: manager_,
            hook: address(this),
            hookData: bytes32(0),
            taxBps: taxBps_,
            minDepositSeconds: minDepositSeconds_,
            mutableTax: manager_ != address(0),
            mutableHook: false
        });

        if (minDepositSeconds_ == 0) revert TermsCannotBeMinted();
        if (maxSupply_ == 0) revert NoSupply();
    }

    function terms() external view returns (SlotInit memory) {
        return _terms;
    }

    function currency() public view returns (IERC20) {
        return _terms.currency;
    }

    /// @notice Mint at your own valuation. Costs {quoteMint}'s `total`.
    function mint(
        uint256 valuation
    ) external payable nonReentrant returns (uint256 tokenId, address slot) {
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();

        slot = FACTORY.createSlot(_terms);
        unchecked {
            tokenId = ++totalMinted;
        }
        // Before the buy: it calls `afterBuy` back mid-frame, and {_sync} reads
        // `tokenOf` to decide whether the slot is one of ours.
        slotOf[tokenId] = slot;
        tokenOf[slot] = tokenId;
        _mint(address(this), tokenId);
        emit SlotMinted(tokenId, slot, msg.sender);

        _seat(slot, valuation);
    }

    /// @dev Valuation to the recipient, escrow into the slot. `buy` charges
    ///      `msg.sender` — this contract — so funds arrive here first.
    function _seat(address slot, uint256 valuation) internal {
        // Asked of the slot, not computed here — it enforces the floor.
        uint256 deposit = ISlotOccupancy(slot).minDepositForBuy(valuation);
        uint256 total = deposit + valuation;
        address to = _terms.recipient;

        if (address(_terms.currency) == address(0)) {
            if (msg.value != total) revert WrongValue(total);
            ISlotOccupancy(slot).buy{value: deposit}(
                msg.sender,
                valuation,
                deposit,
                0
            );
            // After the seating, so a recipient cannot reenter a half-built mint.
            if (valuation > 0) Address.sendValue(payable(to), valuation);
            return;
        }

        if (msg.value != 0) revert WrongValue(0);
        IERC20 token = _terms.currency;

        // Measured, not assumed: a fee-on-transfer token delivers less than was
        // sent, leaving one of the two legs below unfunded.
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), total);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != total) revert CurrencyTakesACut(total, received);

        token.forceApprove(slot, deposit);
        ISlotOccupancy(slot).buy(msg.sender, valuation, deposit, 0);
        token.forceApprove(slot, 0);

        if (valuation > 0) token.safeTransfer(to, valuation);
    }

    /// @notice What a mint costs and how it splits. For a UI only — {mint}
    ///         asks the slot rather than trusting this.
    function quoteMint(
        uint256 valuation
    ) external view returns (uint256 total, uint256 price, uint256 deposit) {
        deposit = SlotMath.depositFor(
            valuation,
            _terms.taxBps,
            _terms.minDepositSeconds
        );
        return (valuation + deposit, valuation, deposit);
    }

    function getSlotInfoOf(
        uint256 tokenId
    ) external view returns (SlotInfo memory) {
        address slot = slotOf[tokenId];
        if (slot == address(0)) revert NoSuchToken(tokenId);
        return ISlotOccupancy(slot).getSlotInfo();
    }

    /// @notice The whole of what {Ownable} is for here; the owner holds no
    ///         power over the slots. Not one-way, because metadata moves.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _uri = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    function baseURI() external view returns (string memory) {
        return _uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _uri;
    }

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

        _syncing = true;

        _transfer(have, want, tokenId);
        _syncing = false;
    }

    /// @dev Mints pass, and so do {_sync}'s moves. Everything else is refused.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0) && !_syncing)
            revert NotTransferable();
        return super._update(to, tokenId, auth);
    }
}
