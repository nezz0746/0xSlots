// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFeed {
    function name() external view returns (string memory);
    function metadataURI() external view returns (string memory);
    function feedRecipient() external view returns (address);
    function getSlots() external view returns (address[] memory);
    function slotCount() external view returns (uint256);
}
