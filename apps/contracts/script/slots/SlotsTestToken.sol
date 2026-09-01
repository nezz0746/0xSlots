// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SlotsTestToken
 * @notice An openly mintable ERC-20 for local chains, so an ERC-20 slot can be
 *         exercised without bridging or faucets.
 * @dev    Deployed by `SeedSlots`. Never deploy this anywhere real — `mint` has
 *         no access control at all.
 */
contract SlotsTestToken is ERC20 {
    constructor() ERC20("Slots Test USD", "USDX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
