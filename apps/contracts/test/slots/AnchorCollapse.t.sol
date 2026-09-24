// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureModule} from "../../src/modules/MinimumTenureModule.sol";
import {MinimumTenure} from "../../src/modules/MinimumTenure.sol";

contract TT is ERC20 { constructor() ERC20("T","T"){} function mint(address t,uint256 a) external {_mint(t,a);} }

contract AnchorCollapseTest is Test {
    SlotFactory factory; TT token; MinimumTenureModule module; Slot s;
    uint256 constant TENURE = 7 days; uint256 constant TAX_RATE = 1000;
    address alice = makeAddr("alice"); address sybil = makeAddr("sybil"); address bob = makeAddr("bob");

    function setUp() public {
        Slot impl = new Slot(); SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));
        token = new TT(); module = new MinimumTenureModule();
        token.mint(alice,1e24); token.mint(bob,1e24); vm.warp(1_000_000);
        s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(token)),
            manager: address(0),
            mutableTax: false, mutableRecipient: false, mutableModule: false,
            taxTerms: TaxTerms({recipient: address(this), rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(0)}),
            moduleTerms: ModuleTerms({target: address(module), settings: abi.encode(TENURE)})
        }))));
    }

    /// @dev H-04: `release()` zeroes `_price`, so a rebuy anchors to max(1,0)=1
    ///      and Alice escapes her 100-ether commitment for 1 wei. She used to
    ///      reach that through a sybil — the bar named the SEAT, and she named a
    ///      fresh one. It now names the payer too, so the rotation is refused
    ///      until her own window has run.
    function test_H04_TheAnchorCannotCollapseThroughASybil() public {
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 100 ether, module.requiredDeposit(100 ether,TAX_RATE,TENURE)+10 ether, 0);
        // Cutting is forbidden inside the window...
        vm.expectRevert(MinimumTenure.PriceCutDuringTenure.selector);
        s.selfAssess(1);

        // ...and so is releasing and rebuying under another name, in the same
        // transaction or any other, for as long as the window she armed lasts.
        s.release();
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.TenureNotElapsed.selector,
                block.timestamp + TENURE
            )
        );
        s.buy(sybil, 1, 1, 0);
        vm.stopPrank();

        assertEq(s.occupant(), address(0), "the slot is vacant, not re-anchored");

        // A party who armed nothing is not barred: the released slot is open.
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        s.buy(bob, 10 ether, 1 ether, 0);
        vm.stopPrank();
        assertEq(s.occupant(), bob, "and anyone else may take it at once");
    }

    /// @dev The bar is a delay, not a ban: once the window she armed has run,
    ///      Alice may seat whoever she likes again.
    function test_H04_TheBarLapsesWithTheWindow() public {
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 100 ether, module.requiredDeposit(100 ether,TAX_RATE,TENURE)+10 ether, 0);
        s.release();
        skip(TENURE);
        s.buy(sybil, 1, 1, 0);
        vm.stopPrank();

        assertEq(s.occupant(), sybil, "the bar lapsed with the window");
    }
}
