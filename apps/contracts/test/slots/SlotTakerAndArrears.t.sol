// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/slots/Slot.sol";
import {SlotFactory} from "../../src/slots/SlotFactory.sol";
import {SlotTaker} from "../../src/slots/periphery/SlotTaker.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/**
 * @notice Evicting and taking in one transaction, from OUTSIDE the slot — and
 *         the arrears rule that stops a defaulter recycling their own seat.
 */
contract SlotTakerAndArrearsTest is Test {
    SlotFactory factory;
    SlotTaker taker;
    Tok token;

    address defaulter = address(0xCAFE);
    address keeper = address(0xBEEF);
    address recipient = address(0xF00D);

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        taker = new SlotTaker();
        token = new Tok();
        vm.deal(keeper, 100 ether);
        vm.deal(defaulter, 100 ether);
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

    function _dep(uint256 price) internal pure returns (uint256) {
        return (price * 1_000 * 1 hours) / (uint256(30 days) * 10_000) + 1;
    }

    // ── the periphery replaces the entry point that was in core ────────────

    function test_TheTakerEvictsAndSeatsOnANativeSlot() public {
        Slot s = _slot(address(0));
        uint256 dep = _dep(0.01 ether);
        vm.prank(defaulter);
        s.buy{value: dep}(defaulter, dep, 0.01 ether, 0);

        vm.warp(block.timestamp + 2 hours);
        assertTrue(s.isInsolvent());

        uint256 cost = taker.quote(s, keeper, dep);
        vm.prank(keeper);
        taker.liquidateAndTake{value: cost}(s, keeper, dep, 0.01 ether, cost);

        assertEq(s.occupant(), keeper, "seated atomically, from outside");
    }

    function test_TheInheritedMulticallStillDoesItForErc20() public {
        Slot s = _slot(address(token));
        uint256 dep = _dep(0.01e18);
        token.mint(defaulter, 1e18);
        vm.startPrank(defaulter);
        token.approve(address(s), type(uint256).max);
        s.buy(defaulter, dep, 0.01e18, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);

        token.mint(keeper, 1e18);
        vm.startPrank(keeper);
        token.approve(address(s), type(uint256).max);
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(Slot.liquidate, ());
        calls[1] = abi.encodeCall(Slot.buy, (keeper, dep, 0.01e18, 0));
        (bool ok, ) = address(s).call(
            abi.encodeWithSignature("multicall(bytes[])", calls)
        );
        vm.stopPrank();

        assertTrue(ok, "core already composes; no special entry point needed");
        assertEq(s.occupant(), keeper);
    }

    // ── the fix that actually mattered ─────────────────────────────────────

    /// @notice Arrears the deposit could not cover follow the ACCOUNT, so
    ///         defaulting stops being the cheapest way to hold a slot.
    function test_ADefaulterCannotWipeArrearsByRetakingTheSeat() public {
        Slot s = _slot(address(token));
        token.mint(defaulter, 1e24);
        vm.startPrank(defaulter);
        token.approve(address(s), type(uint256).max);
        uint256 thin = _dep(50_000e18);
        s.buy(defaulter, thin, 50_000e18, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        uint256 owed = s.taxOwed();
        assertGt(owed, thin, "arrears far exceed the deposit");

        // Anyone evicts them; the shortfall is stranded on the account.
        s.liquidate();
        assertTrue(s.isVacant(), "evicted");
        uint256 debt = s.arrearsOf(defaulter);
        assertGt(debt, 0, "the shortfall is carried, not forgiven");
        emit log_named_uint("arrears carried", debt);

        // Retaking the vacated seat now costs the arrears too.
        uint256 quoted = s.quoteBuy(defaulter, thin);
        assertEq(quoted, thin + debt, "quote includes the debt");

        uint256 before = token.balanceOf(defaulter);
        vm.prank(defaulter);
        s.buy(defaulter, thin, 50_000e18, 0);
        assertEq(before - token.balanceOf(defaulter), thin + debt, "paid it");
        assertEq(s.arrearsOf(defaulter), 0, "and it is cleared once");
    }

    /// @notice A buyer with no history pays no debt.
    function test_AFreshAccountCarriesNoArrears() public {
        Slot s = _slot(address(token));
        assertEq(s.arrearsOf(keeper), 0);
        assertEq(s.quoteBuy(keeper, 500), 500);
    }

    // ── the ceiling ────────────────────────────────────────────────────────

    /// @notice The occupant cannot raise the price into a buyer's pending
    ///         transaction and take their whole allowance.
    function test_MaxPaymentStopsAPriceRaiseFrontRun() public {
        Slot s = _slot(address(token));
        token.mint(defaulter, 1e24);
        token.mint(keeper, 1e30);
        vm.startPrank(defaulter);
        token.approve(address(s), type(uint256).max);
        s.buy(defaulter, _dep(1e18), 1e18, 0);
        vm.stopPrank();

        vm.startPrank(keeper);
        token.approve(address(s), type(uint256).max);
        vm.stopPrank();

        uint256 dep = _dep(1e18);
        uint256 quoted = s.quoteBuy(keeper, dep);

        // The occupant front-runs, restating the slot at 1,000,000x.
        vm.startPrank(defaulter);
        s.topUp(_dep(1e24));
        s.selfAssess(1e24);
        vm.stopPrank();

        vm.prank(keeper);
        vm.expectRevert();
        s.buy(keeper, dep, 1e18, quoted);

        // Without a ceiling the same call goes through at the new price.
        vm.prank(keeper);
        s.buy(keeper, dep, 1e18, 0);
        assertEq(s.occupant(), keeper);
    }
}
