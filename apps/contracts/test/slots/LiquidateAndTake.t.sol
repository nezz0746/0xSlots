// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/slots/Slot.sol";
import {SlotFactory} from "../../src/slots/SlotFactory.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/**
 * @notice `liquidate()` promises that whoever wants the slot can "evict and
 *         take it in one multicall". This asks whether that is true.
 */
contract MulticallLiquidateTest is Test {
    SlotFactory factory;
    Tok token;

    address keeper = address(0xBEEF);
    address defaulter = address(0xCAFE);
    address recipient = address(0xF00D);

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(new Slot()))
                    )
                )
            )
        );
        token = new Tok();
        vm.deal(keeper, 100 ether);
        vm.deal(defaulter, 100 ether);
    }

    function _minDeposit(uint256 price) internal pure returns (uint256) {
        uint256 num = price * 1_000 * 1 hours;
        uint256 den = 30 days * 10_000;
        return num / den + 1;
    }

    function _slot(address currency) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(currency),
            manager: address(this),
            hook: address(0),
            taxPercentage: 1_000,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
    }

    /// @notice On an ERC-20 slot the promise holds.
    function test_TheMulticallPromiseHoldsForErc20() public {
        Slot s = _slot(address(token));
        uint256 dep = _minDeposit(0.01e18);

        token.mint(defaulter, 1e18);
        vm.startPrank(defaulter);
        token.approve(address(s), type(uint256).max);
        s.buy(defaulter, dep, 0.01e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);
        assertTrue(s.isInsolvent());

        token.mint(keeper, 1e18);
        vm.startPrank(keeper);
        token.approve(address(s), type(uint256).max);
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(Slot.liquidate, ());
        calls[1] = abi.encodeCall(Slot.buy, (keeper, dep, 0.01e18));
        s.multicall(calls);
        vm.stopPrank();

        assertEq(s.occupant(), keeper, "keeper should hold the slot");
    }

    /// @notice On a NATIVE slot it does not: `multicall` is non-payable, so
    ///         `msg.value` is zero inside it and `buy` demands an exact amount.
    function test_TheMulticallPromiseIsUnreachableForNativeEth() public {
        Slot s = _slot(address(0));
        uint256 dep = _minDeposit(0.01 ether);

        vm.prank(defaulter);
        s.buy{value: dep}(defaulter, dep, 0.01 ether);

        vm.warp(block.timestamp + 2 hours);
        assertTrue(s.isInsolvent());

        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(Slot.liquidate, ());
        calls[1] = abi.encodeCall(Slot.buy, (keeper, dep, 0.01 ether));

        // Not "it reverts if you get the value wrong" — there is no value to
        // get right. `s.multicall{value: dep}(calls)` does not even compile:
        //   Cannot set option "value" on a non-payable function type.
        // So the only way to ask the question is a low-level call, and the
        // non-payable dispatcher rejects the ETH outright.
        vm.prank(keeper);
        (bool sentWithValue, ) = address(s).call{value: dep}(
            abi.encodeWithSignature("multicall(bytes[])", calls)
        );
        assertFalse(sentWithValue, "multicall is non-payable; ETH cannot reach buy");

        // And with no value, `buy` fails its exactness check: msg.value is 0
        // but it demands owedToPrev + depositAmount.
        vm.prank(keeper);
        (bool sentBare, ) = address(s).call(
            abi.encodeWithSignature("multicall(bytes[])", calls)
        );
        assertFalse(sentBare, "buy requires msg.value == owed exactly");

        assertEq(s.occupant(), defaulter, "still seated; multicall cannot do it");

        // `liquidateAndTake` is the entry point that keeps the promise.
        vm.prank(keeper);
        s.liquidateAndTake{value: dep}(keeper, dep, 0.01 ether);
        assertEq(s.occupant(), keeper, "keeper evicted and took it atomically");
    }

    /// @notice The same path on an ERC-20 slot, so one entry point covers both
    ///         currencies rather than each having its own idiom.
    function test_LiquidateAndTakeAlsoWorksForErc20() public {
        Slot s = _slot(address(token));
        uint256 dep = _minDeposit(0.01e18);

        token.mint(defaulter, 1e18);
        vm.startPrank(defaulter);
        token.approve(address(s), type(uint256).max);
        s.buy(defaulter, dep, 0.01e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);

        token.mint(keeper, 1e18);
        vm.startPrank(keeper);
        token.approve(address(s), type(uint256).max);
        s.liquidateAndTake(keeper, dep, 0.01e18);
        vm.stopPrank();

        assertEq(s.occupant(), keeper);
    }

    /// @notice It is not a way around solvency: a solvent occupant is safe.
    function test_LiquidateAndTakeCannotEvictASolventOccupant() public {
        Slot s = _slot(address(0));
        uint256 dep = _minDeposit(0.01 ether);

        vm.prank(defaulter);
        s.buy{value: dep}(defaulter, dep, 0.01 ether);

        assertFalse(s.isInsolvent());
        vm.prank(keeper);
        vm.expectRevert();
        s.liquidateAndTake{value: dep}(keeper, dep, 0.01 ether);
        assertEq(s.occupant(), defaulter);
    }

    /// @notice And it is not a way around the exactness check either.
    function test_LiquidateAndTakeStillDemandsExactValue() public {
        Slot s = _slot(address(0));
        uint256 dep = _minDeposit(0.01 ether);

        vm.prank(defaulter);
        s.buy{value: dep}(defaulter, dep, 0.01 ether);
        vm.warp(block.timestamp + 2 hours);

        vm.prank(keeper);
        vm.expectRevert();
        s.liquidateAndTake{value: dep - 1}(keeper, dep, 0.01 ether);

        vm.prank(keeper);
        vm.expectRevert();
        s.liquidateAndTake{value: dep + 1}(keeper, dep, 0.01 ether);
    }

    /// @notice The quotes are the payment rule, so they must BE the payment.
    function test_QuoteBuyIsExactlyWhatBuyCharges() public {
        Slot s = _slot(address(0));
        uint256 dep = _minDeposit(0.01 ether);

        // vacant: the price is not owed to anyone
        assertEq(s.quoteBuy(dep), dep);
        vm.prank(defaulter);
        s.buy{value: s.quoteBuy(dep)}(defaulter, dep, 0.01 ether);
        assertEq(s.occupant(), defaulter);

        // occupied: the sitting occupant's asking price, plus your deposit
        assertEq(s.quoteBuy(dep), 0.01 ether + dep);
        vm.deal(keeper, 10 ether);
        vm.prank(keeper);
        s.buy{value: s.quoteBuy(dep)}(keeper, dep, 0.01 ether);
        assertEq(s.occupant(), keeper);
    }

    /// @notice And the liquidation quote is NOT the buy quote — the whole
    ///         reason it exists as its own function.
    function test_QuoteLiquidateAndTakeIsTheDepositAloneAndDiffersFromBuy()
        public
    {
        Slot s = _slot(address(0));
        uint256 dep = _minDeposit(0.01 ether);

        vm.prank(defaulter);
        s.buy{value: dep}(defaulter, dep, 0.01 ether);
        vm.warp(block.timestamp + 2 hours);

        assertEq(s.quoteLiquidateAndTake(dep), dep);
        assertTrue(
            s.quoteBuy(dep) != s.quoteLiquidateAndTake(dep),
            "the two quotes must differ while an occupant is still seated"
        );

        // Hoisted, and not inlined into the call below. `vm.expectRevert`
        // arms the NEXT call, and an external read in the argument list is
        // that call — it would be consumed by the staticcall and the test
        // would pass while asserting nothing.
        uint256 buyQuote = s.quoteBuy(dep);
        uint256 takeQuote = s.quoteLiquidateAndTake(dep);

        // the quote pays; reasoning by analogy with buy does not
        vm.prank(keeper);
        vm.expectRevert();
        s.liquidateAndTake{value: buyQuote}(keeper, dep, 0.01 ether);

        vm.prank(keeper);
        s.liquidateAndTake{value: takeQuote}(keeper, dep, 0.01 ether);
        assertEq(s.occupant(), keeper);
    }
}