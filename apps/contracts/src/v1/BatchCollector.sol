// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISlot {
    function collect() external;
}

/// @title BatchCollector
/// @notice Utility to collect tax from multiple 0xSlots in a single transaction
contract BatchCollector {
    /// @notice Collect tax from an array of slot addresses
    /// @param slots Array of Slot contract addresses to collect from
    /// @dev Silently skips slots that revert (e.g. nothing to collect)
    function collectAll(address[] calldata slots) external {
        for (uint256 i = 0; i < slots.length; i++) {
            try ISlot(slots[i]).collect() {} catch {}
        }
    }
}
