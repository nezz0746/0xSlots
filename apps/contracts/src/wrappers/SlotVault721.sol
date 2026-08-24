// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {IUtility} from "../interfaces/IUtility.sol";

interface ISlotOccupancy {
    function occupant() external view returns (address);
    function isVacant() external view returns (bool);
}

/// @title SlotVault721 — idle NFTs, rented under Harberger terms
///
/// @notice Deposit an ERC-721; it is bound to a slot, and whoever occupies that
///         slot is its USER for as long as they hold it. The depositor keeps
///         title as a transferable receipt and collects the slot's tax.
///
/// @dev ── THE DISTINCTION THE WHOLE DESIGN TURNS ON ───────────────────────
///      Owning an NFT bundles several separable things: the right to SELL it,
///      the utility it confers (token-gated access, governance, a mint list),
///      the right to display it, and any cash flows it attracts. A rental
///      market should move the middle two and never the first.
///
///      So occupying a slot here does NOT make you the owner of the deposited
///      token. If it did, this would not be a rental at all — it would be a
///      sale with extra steps, and the depositor would lose the asset the first
///      time anybody took the slot. What the occupant gets is `userOf`, and
///      what the depositor keeps is `ownerOf` on the receipt.
///
///      That split is exactly ERC-4907's, which is why this implements its
///      shape: `ownerOf` is title, `userOf` is the renter. The only difference
///      is that no one calls `setUser` — the user is whoever a Harberger slot
///      says it is, priced continuously and takeable at any moment.
///
///      ── WHY `userOf` IS DERIVED AND NEVER STORED ────────────────────────
///      `Slot._notifyUtility` calls hooks with a 500k gas cap and SWALLOWS
///      failures. A vault that moved usage rights inside `onTransfer` would,
///      on any hook failure, leave the previous occupant holding rights to an
///      asset somebody else is now paying for — silently, with only a
///      `ModuleCallFailed` event to show for it.
///
///      So nothing is pushed. `userOf` reads `occupant()` from the slot at call
///      time, which cannot desync because there is no second copy. The hooks
///      below exist only to emit events; losing one costs an index entry and
///      nothing else.
///
///      ── WITHDRAWAL, AND WHY IT IS NOT A RUG ──────────────────────────────
///      The obvious failure of a rental vault is the depositor pulling the
///      asset out from under a paying tenant. The rule here is that a
///      withdrawal needs the receipt AND the slot — either it is vacant, or you
///      are its occupant.
///
///      Which means the way to reclaim your own NFT mid-tenancy is to buy the
///      slot at the price its occupant declared. That is not a special case
///      bolted on; it is the protocol's own rule applied to the depositor, and
///      it is self-financing: the higher the occupant declares, the more tax
///      the depositor has been collecting, and the more it costs to take back.
///
///      ── WHAT THIS DOES NOT SOLVE ─────────────────────────────────────────
///      Token-gated apps read `ownerOf` on the ORIGINAL collection, and that
///      answers this vault's address for as long as the deposit lasts. They
///      will not see the occupant. Making that work end to end needs a
///      delegation registry write, which is a per-chain external dependency and
///      deliberately not in this draft — see `syncHint` below for the seam.
contract SlotVault721 is ERC721, IERC721Receiver, IUtility {
    struct Deposit {
        address collection;
        uint256 tokenId;
        /// @dev The slot whose occupant is this token's user.
        address slot;
        address depositor;
    }

    uint256 public nextReceiptId = 1;

    mapping(uint256 receiptId => Deposit) internal _deposits;

    /// @dev Guards against the same (collection, tokenId) being bound twice,
    ///      which custody makes impossible in practice but which a rescued or
    ///      rebasing token could otherwise smuggle in.
    mapping(address collection => mapping(uint256 tokenId => uint256 receiptId))
        public receiptOf;

    event Deposited(
        uint256 indexed receiptId,
        address indexed collection,
        uint256 indexed tokenId,
        address slot,
        address depositor
    );
    event Withdrawn(uint256 indexed receiptId, address indexed to);
    event UserChanged(uint256 indexed receiptId, address indexed user);

    error NotReceiptOwner();
    error SlotIsOccupied();
    error NoSuchReceipt();
    error NotASlot();
    error AlreadyDeposited();
    error DirectTransfersNotAccepted();

    constructor() ERC721("Slot Vault Receipt", "SVR") {}

    // ═══════════════════════════════════════════════════════════
    // DEPOSIT / WITHDRAW
    // ═══════════════════════════════════════════════════════════

    /// @notice Bind an ERC-721 to a slot and take custody of it.
    /// @dev The caller keeps title as receipt `receiptId`, which is itself an
    ///      ERC-721 and therefore sellable — a depositor can exit their
    ///      position without disturbing the tenant.
    ///
    ///      The slot's `recipient` is NOT set here and cannot be: it is fixed at
    ///      slot creation. Deposit into a slot whose recipient is already you,
    ///      or the tax accrues to somebody else. Checked by nobody, because the
    ///      protocol has no notion of a "wrong" recipient — stated here because
    ///      it is the one way to lose money silently.
    function deposit(
        address collection,
        uint256 tokenId,
        address slot
    ) external returns (uint256 receiptId) {
        if (slot.code.length == 0) revert NotASlot();
        // Probes the slot before taking custody: a non-slot address would leave
        // the token bound to something with no occupant and no way to rent it.
        ISlotOccupancy(slot).occupant();

        if (receiptOf[collection][tokenId] != 0) revert AlreadyDeposited();

        receiptId = nextReceiptId++;
        _deposits[receiptId] = Deposit({
            collection: collection,
            tokenId: tokenId,
            slot: slot,
            depositor: msg.sender
        });
        receiptOf[collection][tokenId] = receiptId;

        _safeMint(msg.sender, receiptId);

        // Custody last, so a reverting collection cannot leave a receipt minted
        // against a token this vault does not hold.
        IERC721(collection).transferFrom(msg.sender, address(this), tokenId);

        emit Deposited(receiptId, collection, tokenId, slot, msg.sender);
    }

    /// @notice Take the token back. Burns the receipt.
    /// @dev Requires the slot to be free of a paying tenant — see the note on
    ///      withdrawal above. This is the anti-rug rule and the only place the
    ///      vault constrains the depositor at all.
    function withdraw(uint256 receiptId, address to) external {
        Deposit memory d = _deposits[receiptId];
        if (d.collection == address(0)) revert NoSuchReceipt();
        if (ownerOf(receiptId) != msg.sender) revert NotReceiptOwner();

        ISlotOccupancy s = ISlotOccupancy(d.slot);
        address who = s.occupant();
        if (who != address(0) && who != msg.sender) revert SlotIsOccupied();

        delete _deposits[receiptId];
        delete receiptOf[d.collection][d.tokenId];
        _burn(receiptId);

        IERC721(d.collection).transferFrom(address(this), to, d.tokenId);
        emit Withdrawn(receiptId, to);
    }

    // ═══════════════════════════════════════════════════════════
    // READING
    // ═══════════════════════════════════════════════════════════

    /// @notice Who currently holds the rights this token confers.
    /// @dev ERC-4907's `userOf`, resolved live from the slot rather than stored.
    ///      Zero while the slot is vacant, which is the honest answer: nobody is
    ///      paying, so nobody has the rights.
    function userOf(uint256 receiptId) public view returns (address) {
        Deposit memory d = _deposits[receiptId];
        if (d.collection == address(0)) return address(0);
        return ISlotOccupancy(d.slot).occupant();
    }

    /// @notice ERC-4907 compatibility. Harberger tenancy has no clock.
    /// @dev `max` while occupied rather than a real timestamp: the tenancy ends
    ///      when somebody buys it out, not when a term runs down. Returning a
    ///      near-future expiry would be a lie tooling would act on.
    function userExpires(uint256 receiptId) external view returns (uint256) {
        return userOf(receiptId) == address(0) ? 0 : type(uint64).max;
    }

    function depositOf(uint256 receiptId) external view returns (Deposit memory) {
        return _deposits[receiptId];
    }

    // ═══════════════════════════════════════════════════════════
    // SLOT HOOKS — events only
    // ═══════════════════════════════════════════════════════════

    /// @dev Installing this vault as the slot's utility is OPTIONAL. Rights do
    ///      not depend on it; these fire an event so indexers see a turnover
    ///      without diffing occupancy themselves. A swallowed hook costs that
    ///      event and nothing more.
    ///
    ///      The slot is `msg.sender`, and this vault may hold many deposits
    ///      against it, so there is deliberately no lookup here — the event
    ///      carries the slot and a reader resolves the rest.
    function onTransfer(uint256, address, address to) external override {
        emit UserChanged(0, to);
    }

    function onRelease(uint256, address) external override {
        emit UserChanged(0, address(0));
    }

    function onPriceUpdate(uint256, uint256, uint256) external override {}

    function onSettle(uint256, address, uint256, uint256) external override {}

    // ═══════════════════════════════════════════════════════════
    // WIRING
    // ═══════════════════════════════════════════════════════════

    /// @dev Refuses tokens pushed in with `safeTransferFrom`. A token arriving
    ///      that way has no receipt and no slot, so it would be stuck here with
    ///      nobody able to claim it. `deposit` uses `transferFrom`, which does
    ///      not route through this.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert DirectTransfersNotAccepted();
    }

    function name() public pure override(ERC721, IModuleMetadata) returns (string memory) {
        return "SlotVault721";
    }

    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    function metadataURI() external pure override returns (string memory) {
        return "";
    }

    function feeBps() external pure override returns (uint256) {
        return 0;
    }

    function feeRecipient() external pure override returns (address) {
        return address(0);
    }

    function supportsInterface(
        bytes4 id
    ) public view override(ERC721, IERC165) returns (bool) {
        return
            id == type(IUtility).interfaceId ||
            id == type(IModuleMetadata).interfaceId ||
            super.supportsInterface(id);
    }
}
