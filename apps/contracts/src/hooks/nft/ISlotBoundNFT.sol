// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInfo} from "../../SlotViews.sol";

/// @dev The slice of `Slot` this collection calls. Narrow on purpose: declaring
///      the whole surface would recompile it on every unrelated change.
interface ISlotOccupancy {
    function occupant() external view returns (address);

    function minDepositForBuy(uint256 price) external view returns (uint256);

    function getSlotInfo() external view returns (SlotInfo memory);

    function buy(
        address account,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) external payable;
}

/**
 * @title ISlotBoundNFT
 * @notice What a slot-bound collection emits and refuses.
 *
 * @dev Split out so the SDK and the indexer can import the vocabulary without
 *      pulling in the implementation.
 */
interface ISlotBoundNFT {
    // ─── events ─────────────────────────────────────────────────────────────

    event BaseURISet(string uri);
    event SlotMinted(
        uint256 indexed tokenId,
        address indexed slot,
        address indexed creator
    );

    // ─── errors ─────────────────────────────────────────────────────────────

    error NotTransferable();
    error SoldOut();
    error WrongValue(uint256 expected);
    error TermsCannotBeMinted();
    error NoSupply();
    error NoSuchToken(uint256 tokenId);
    error CurrencyTakesACut(uint256 sent, uint256 received);
}
