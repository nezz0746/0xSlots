// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFT} from "../../src/hooks/nft/SlotBoundNFT.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";

contract GuardTest is Test {
    SlotFactory factory;
    function setUp() public {
        Slot impl = new Slot(); SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));
    }
    /// @notice A collection with no funded window is refused at DEPLOY.
    /// @dev `minDepositSeconds == 0` means a mint escrows nothing, and
    ///      `liquidate` refuses only while the deposit is non-zero — so every
    ///      token would be evictable in the block it was minted.
    function test_AZeroWindowIsRefusedAtDeploy() public {
        vm.expectRevert(ISlotBoundNFT.TermsCannotBeMinted.selector);
        new SlotBoundNFT(
            factory, "X", "X", 1, IERC20(address(0)),
            1000, 0, address(this), address(this), address(this)
        );
    }
}
