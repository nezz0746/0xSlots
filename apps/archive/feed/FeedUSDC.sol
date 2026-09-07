// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title FeedUSDC (USDCf)
/// @notice Test ERC20 with public mint for Base Sepolia testing.
contract FeedUSDC is ERC20 {
    constructor() ERC20("Feed USDC", "USDCf") {}

    /// @notice Anyone can mint — test token only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 6 decimals like real USDC.
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
