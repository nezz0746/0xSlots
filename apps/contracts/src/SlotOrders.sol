// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SlotAccounting} from "./SlotAccounting.sol";
import "./SlotErrors.sol";

/**
 * @title SlotOrders
 * @notice EIP-712 consent for `sell`.
 *
 * @dev `sell` moves a THIRD PARTY's money: it pulls from the buyer while the
 *      occupant is the one calling. An allowance authorises SPENDING; it never
 *      authorised a price the counterparty picks, and treating it as though it
 *      did meant any occupant could drain any approver.
 *
 *      Both `price` and `deposit` are in the digest, so the SPLIT is fixed by
 *      the party whose money it is. That pairing matters as much as the price:
 *      a buyer approving exactly `price + deposit` could otherwise be sold
 *      `price + deposit, 0` — the escrow half rebooked as seller proceeds, and
 *      the buyer seated insolvent on arrival.
 *
 *      `SignatureChecker` rather than raw ECDSA so contract wallets can bid via
 *      ERC-1271. Requiring an EOA signature would quietly exclude every Safe
 *      and every 4337 account.
 */
/// @notice One buyer's standing terms for one slot.
/// @dev File-level rather than nested in `SlotOrders` so periphery can name the
///      type without inheriting the core. An order book has to speak this
///      struct; making it reach through the implementation to do so would pull
///      storage and accounting into every contract that merely quotes a bid.
struct SellOrder {
    address slot;
    address buyer;
    uint256 price;
    uint256 deposit;
    uint256 nonce;
    uint64 deadline;
}

abstract contract SlotOrders is SlotAccounting {

    bytes32 internal constant SELL_ORDER_TYPEHASH =
        keccak256(
            "SellOrder(address slot,address buyer,uint256 price,uint256 deposit,uint256 nonce,uint64 deadline)"
        );

    event OrderCancelled(address indexed buyer, uint256 nonce);

    /// @notice Burn one of your own nonces, invalidating a signature you gave.
    /// @dev The escape hatch. A signed order is a standing authorisation that
    ///      lives wherever it was published; removing it from one order book
    ///      does not revoke it. Burning the nonce kills every copy at once.
    function cancelSellOrder(uint256 nonce) external {
        orderUsed[msg.sender][nonce] = true;
        if (nonce >= orderNonce[msg.sender]) {
            orderNonce[msg.sender] = nonce + 1;
        }
        emit OrderCancelled(msg.sender, nonce);
    }

    function sellOrderHash(SellOrder calldata order)
        public
        view
        returns (bytes32)
    {
        return
            MessageHashUtils.toTypedDataHash(
                _domainSeparator(),
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

    /// @dev Recomputed per call, never cached. These are beacon proxies: the
    ///      implementation's constructor runs once for every slot, so a cached
    ///      separator would carry the wrong `verifyingContract`. Recomputing
    ///      also survives a chain fork.
    function _domainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256("Slots"),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }

    /// @dev Validate and CONSUME. Reverts unless the buyer signed these exact
    ///      terms for this exact slot.
    function _consumeOrder(SellOrder calldata order, bytes calldata signature)
        internal
    {
        if (order.slot != address(this)) revert OrderWrongSlot();
        if (block.timestamp > order.deadline) revert OrderExpired();
        if (orderUsed[order.buyer][order.nonce]) revert OrderUsed();

        if (
            !SignatureChecker.isValidSignatureNow(
                order.buyer,
                sellOrderHash(order),
                signature
            )
        ) revert OrderBadSignature();

        // Consumed BEFORE the sale executes, so no reentrant path can spend the
        // same authorisation twice.
        orderUsed[order.buyer][order.nonce] = true;
        if (order.nonce >= orderNonce[order.buyer]) {
            orderNonce[order.buyer] = order.nonce + 1;
        }
    }
}
