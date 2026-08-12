// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IModuleMetadata} from "./IModuleMetadata.sol";

/// @notice Everything a policy needs to decide, passed by value so policies
///         never have to call back into the slot.
struct OccupancyContext {
    address slot;           // the calling slot
    address caller;         // msg.sender on the slot
    address account;        // incoming occupant (buy) / current occupant (price update)
    address occupant;       // current occupant, address(0) if vacant
    uint256 occupiedSince;  // when current occupancy began; 0 = unknown (legacy slot)
    uint256 taxPercentage;  // bps per 30 days
    uint256 currentPrice;
    uint256 newPrice;
    uint256 depositAmount;
}

/// @title IOccupancyPolicy
/// @notice Authoritative, fail-closed veto over slot occupancy transitions.
/// @dev Contrast with IUtility, which is advisory and fail-open. A policy
///      that reverts BLOCKS the action. A policy may never move funds, change
///      the price, or redirect the buyer — it answers yes/no and nothing else.
///      `liquidate()` and `release()` are never routed through a policy.
///      Self-description (`name`, `version`, `metadataURI`) lives in
///      `IModuleMetadata`, shared with `IUtility` — the two describe themselves
///      identically even though they behave nothing alike. As with `IUtility`,
///      inheriting NARROWS this interface's ERC165 id to its own two checks, so
///      `SlotFactory.setPolicyVerified` asserts both ids.
interface IOccupancyPolicy is IModuleMetadata {
    /// @notice Revert to block an occupancy transfer.
    function checkBuy(OccupancyContext calldata ctx) external view;

    /// @notice Revert to block a self-assessment.
    function checkPriceUpdate(OccupancyContext calldata ctx) external view;
}
