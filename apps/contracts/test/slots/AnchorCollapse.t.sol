// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";

contract TT is ERC20 { constructor() ERC20("T","T"){} function mint(address t,uint256 a) external {_mint(t,a);} }

contract AnchorCollapseTest is Test {
    SlotFactory factory; TT token; MinimumTenureHook hook; Slot s;
    uint256 constant TENURE = 7 days; uint256 constant TAX = 1000;
    address alice = makeAddr("alice"); address sybil = makeAddr("sybil"); address bob = makeAddr("bob");

    function setUp() public {
        Slot impl = new Slot(); SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));
        token = new TT(); hook = new MinimumTenureHook();
        token.mint(alice,1e24); token.mint(bob,1e24); vm.warp(1_000_000);
        s = Slot(payable(factory.createSlot(SlotInit({recipient:address(this),
            currency:IERC20(address(token)), manager:address(0), hook:address(hook),
            hookData:bytes32(TENURE), taxBps:TAX, minDepositSeconds:0,
            mutableTax:false, mutableHook:false}))));
    }

    /// @dev H-04: `release()` zeroes `_price`, so a rebuy anchors to max(1,0)=1.
    ///      Alice escapes her 100-ether commitment for 1 wei. Still true. The
    ///      question is whether it still BUYS her anything.
    function test_H04_AnchorStillCollapsesButIsNowSelfDefeating() public {
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 100 ether, hook.requiredDeposit(100 ether,TAX,TENURE)+10 ether, 0);
        // Cutting is forbidden inside the window...
        vm.expectRevert(MinimumTenureHook.PriceCutDuringTenure.selector);
        s.selfAssess(1);
        // ...but release + rebuy through a sybil does it for 1 wei.
        s.release();
        s.buy(sybil, 1, 1, 0);
        vm.stopPrank();

        assertEq(s.occupant(), sybil, "anchor collapsed: fresh window at 1 wei");
        assertEq(s.price(), 1, "and the 100 ether commitment is gone");

        // But the shield collapsed with it. Bob takes it immediately.
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        s.buy(bob, 10 ether, 1 ether, 0);
        vm.stopPrank();
        assertEq(s.occupant(), bob, "escaping the price now costs the slot");
    }
}
