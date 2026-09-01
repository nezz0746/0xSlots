// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SellOrder} from "../../SlotOrders.sol";

/// @notice The slice of a slot the book talks to.
///
/// @dev Declared here rather than imported from `Slot`, so the book compiles
///      against a signature list and not against an implementation. The two
///      are deployed independently and only ever meet across an ABI boundary —
///      and the book is deliberately replaceable, so it must not drag the core
///      in behind it.
interface ISellableSlot {
    function sellOrderHash(SellOrder calldata order)
        external
        view
        returns (bytes32);

    function occupant() external view returns (address);
    function price() external view returns (uint256);
    function currency() external view returns (address);
    function sell(
        SellOrder calldata order,
        bytes calldata signature
    ) external;
    function orderNonce(address buyer) external view returns (uint256);
    function orderUsed(address buyer, uint256 nonce)
        external
        view
        returns (bool);
}
