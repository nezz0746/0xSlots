// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SlotSellOrder
 * @notice EIP-712 consent for `Slot.sell`.
 *
 * @dev ── The problem this exists to solve ──────────────────────────────────
 *
 *      `sell` moves a THIRD PARTY's money: it pulls `price + deposit` from
 *      `buyer` while the occupant — not the buyer — chooses both numbers. The
 *      original design treated a standing ERC-20 allowance as consent, and
 *      said so outright: "the allowance is also the buyer's ONLY consent, and
 *      it is enough."
 *
 *      It is not enough, in two distinct ways:
 *
 *      1. An allowance is granted to *spend*, not agreement to a *price*. The
 *         approval a buyer must grant in order to call `buy` themselves became
 *         a licence for whoever happens to occupy the slot to drain them. With
 *         the infinite approvals most interfaces default to, the loss is
 *         bounded only by the victim's balance.
 *
 *      2. Even an exact approval was not safe, because the SPLIT was
 *         unconstrained. A bidder approving 150 for `price=100, deposit=50`
 *         could be sold `price=150, deposit=0`: the whole allowance becomes
 *         seller proceeds, the escrow that was meant to be the buyer's own
 *         refundable runway is taken, and the buyer lands insolvent and
 *         immediately liquidatable. The offer book's safety argument — that a
 *         bidder only ever approves `price + deposit` — did not protect the
 *         bidder, because nothing bound `sell`'s arguments to the offer.
 *
 *      ── The fix ────────────────────────────────────────────────────────────
 *
 *      The buyer signs the exact terms. `price` and `deposit` are both in the
 *      digest, so the split is fixed by the party whose money it is. A nonce
 *      makes each order single-use and gives the buyer a cheap on-chain
 *      cancel; a deadline bounds how long a signature stays live.
 *
 *      Signing is free and off-chain, so the flow costs a bidder nothing
 *      beyond what it already cost: approve, then post the offer carrying the
 *      signature.
 *
 *      `SignatureChecker` is used rather than raw `ECDSA` so contract wallets
 *      (Safe, and every ERC-4337 account) can bid via ERC-1271. Requiring an
 *      EOA signature would have quietly excluded them.
 */
abstract contract SlotSellOrder {
    /// @notice Terms the buyer agrees to, signed off-chain.
    /// @dev `slot` is in the struct AND the domain: the domain binds a
    ///      signature to one slot, and the explicit field means a reader of
    ///      the raw order can see which slot it is for without reconstructing
    ///      the domain.
    struct SellOrder {
        address slot;
        address buyer;
        uint256 price;
        uint256 deposit;
        uint256 nonce;
        uint64 deadline;
    }

    bytes32 internal constant SELL_ORDER_TYPEHASH =
        keccak256(
            "SellOrder(address slot,address buyer,uint256 price,uint256 deposit,uint256 nonce,uint64 deadline)"
        );

    /// @custom:storage-location erc7201:slots.storage.SlotSellOrder
    struct SellOrderStorage {
        /// buyer => next unused nonce.
        mapping(address => uint256) nonces;
        /// buyer => nonce => consumed.
        mapping(address => mapping(uint256 => bool)) used;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("slots.storage.SlotSellOrder")) - 1)) & ~bytes32(uint256(0xff))
    ///      Namespaced so this can be inherited at any position without moving
    ///      a single one of the 237+ live proxies' storage slots.
    bytes32 private constant SELL_ORDER_STORAGE =
        0x7b8c187bdd8f0613a74d19104f0c28d03cc0ce66bb2d3473a22b952016980900;

    function _sellOrder$() private pure returns (SellOrderStorage storage $) {
        assembly {
            $.slot := SELL_ORDER_STORAGE
        }
    }

    error SellOrderExpired();
    error SellOrderWrongSlot();
    error SellOrderAlreadyUsed();
    error SellOrderBadSignature();
    error NotOrderBuyer();

    event SellOrderCancelled(address indexed buyer, uint256 nonce);

    /// @notice The next nonce a buyer should sign with.
    function sellOrderNonce(address buyer) external view returns (uint256) {
        return _sellOrder$().nonces[buyer];
    }

    function sellOrderUsed(address buyer, uint256 nonce)
        external
        view
        returns (bool)
    {
        return _sellOrder$().used[buyer][nonce];
    }

    /// @notice Burn one of your own nonces, invalidating a signature you gave.
    /// @dev The escape hatch. A signature is a standing authorisation; without
    ///      an on-chain cancel a bidder who changed their mind would have to
    ///      wait out the deadline or revoke their whole allowance.
    function cancelSellOrder(uint256 nonce) external {
        SellOrderStorage storage $ = _sellOrder$();
        $.used[msg.sender][nonce] = true;
        if (nonce >= $.nonces[msg.sender]) $.nonces[msg.sender] = nonce + 1;
        emit SellOrderCancelled(msg.sender, nonce);
    }

    /// @notice The EIP-712 digest a buyer signs.
    function sellOrderHash(SellOrder calldata order)
        public
        view
        returns (bytes32)
    {
        return
            MessageHashUtils.toTypedDataHash(
                _sellOrderDomainSeparator(),
                keccak256(
                    abi.encode(
                        SELL_ORDER_TYPEHASH,
                        order.slot,
                        order.buyer,
                        order.price,
                        order.deposit,
                        order.nonce,
                        order.deadline
                    )
                )
            );
    }

    /// @dev Recomputed per call rather than cached at construction. These are
    ///      beacon proxies: the implementation's constructor runs once for
    ///      every slot, so a cached separator would carry the wrong
    ///      `verifyingContract`. Recomputing also survives a chain fork.
    function _sellOrderDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256("0xSlots"),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }

    /// @dev Validate and CONSUME an order. Reverts unless the buyer really
    ///      signed these exact terms for this exact slot.
    function _consumeSellOrder(
        SellOrder calldata order,
        bytes calldata signature
    ) internal {
        if (order.slot != address(this)) revert SellOrderWrongSlot();
        if (block.timestamp > order.deadline) revert SellOrderExpired();

        SellOrderStorage storage $ = _sellOrder$();
        if ($.used[order.buyer][order.nonce]) revert SellOrderAlreadyUsed();

        if (
            !SignatureChecker.isValidSignatureNow(
                order.buyer,
                sellOrderHash(order),
                signature
            )
        ) revert SellOrderBadSignature();

        // Consumed BEFORE the sale executes, so a re-entrant path cannot spend
        // the same authorisation twice.
        $.used[order.buyer][order.nonce] = true;
        if (order.nonce >= $.nonces[order.buyer]) {
            $.nonces[order.buyer] = order.nonce + 1;
        }
    }
}
