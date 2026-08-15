// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import "../src/interfaces/SlotErrors.sol";

contract Token is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice `Slot` inherits OpenZeppelin's `Multicall`, and the holder path in
///         the mini app depends on it.
///
/// @dev Topping up and repricing are two calls that CANNOT be reordered:
///      `selfAssess` ends in `_enforceMinDepositExisting(newPrice)`, so raising
///      a valuation needs the deposit already standing. Sent as two separate
///      transactions that is fragile in a way unit tests do not show — tax keeps
///      accruing between them, so a top-up sized to the exact shortfall is short
///      by the time the reprice lands, and the wallet's RPC may not even have
///      seen the first one when it estimates the second.
///
///      `multicall` makes them one transaction. These tests pin the two
///      properties the client relies on: that the pair works through it, and
///      that it CANNOT be used to carry native value.
contract SlotMulticallTest is Test {
    SlotFactory factory;
    Token token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");

    uint256 constant PRICE = 100 ether;
    uint256 constant DEPOSIT = 10 ether;

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
        token = new Token();
        token.mint(alice, 1000 ether);
        vm.deal(alice, 1000 ether);
    }

    function _slot(IERC20 currency) internal returns (Slot) {
        return
            Slot(
                factory.createSlot(
                    recipient,
                    currency,
                    SlotConfig({
                        mutableTax: true,
                        mutableUtility: true,
                        mutablePolicy: false,
                        manager: manager
                    }),
                    SlotInitParams({
                        // The production rate. At 1% the minimum deposit is so
                        // small that a tenfold reprice still clears a standing
                        // deposit, and the ordering these tests are about never
                        // bites — they passed without proving anything.
                        taxPercentage: 5000,
                        utility: address(0),
                        liquidationBountyBps: 500,
                        minDepositSeconds: 86400,
                        occupancyPolicy: address(0)
                    })
                )
            );
    }

    /// @dev The whole point: one transaction, and the reprice sees the deposit
    ///      the top-up just added.
    function test_multicall_topUpThenSelfAssess() public {
        Slot slot = _slot(IERC20(address(token)));

        vm.startPrank(alice);
        token.approve(address(slot), type(uint256).max);
        slot.buy(alice, DEPOSIT, PRICE);

        // Ten times the price needs ten times the minimum deposit, which the
        // standing one does not cover — so this reverts if the top-up is not
        // applied first, in the same call.
        uint256 newPrice = PRICE * 10;
        uint256 addition = DEPOSIT * 10;

        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(Slot.topUp, (addition));
        calls[1] = abi.encodeCall(Slot.selfAssess, (newPrice));
        slot.multicall(calls);
        vm.stopPrank();

        assertEq(slot.price(), newPrice, "reprice did not take");
        assertEq(slot.deposit(), DEPOSIT + addition, "top-up did not take");
        assertEq(slot.occupant(), alice, "still alice's slot");
    }

    /// @dev The ordering the panel exists to enforce, proved from the other
    ///      side: the same two calls the wrong way round revert.
    function test_multicall_selfAssessBeforeTopUpReverts() public {
        Slot slot = _slot(IERC20(address(token)));

        vm.startPrank(alice);
        token.approve(address(slot), type(uint256).max);
        slot.buy(alice, DEPOSIT, PRICE);

        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeCall(Slot.selfAssess, (PRICE * 10));
        calls[1] = abi.encodeCall(Slot.topUp, (DEPOSIT * 10));

        vm.expectRevert(InsufficientDeposit.selector);
        slot.multicall(calls);
        vm.stopPrank();
    }

    /// @dev `nonReentrant` sits on both, and `multicall` reaches them by
    ///      delegatecall. Sequential entries are fine — nested ones would not
    ///      be — and this is what says so.
    function test_multicall_reentrancyGuardAllowsSequentialCalls() public {
        Slot slot = _slot(IERC20(address(token)));

        vm.startPrank(alice);
        token.approve(address(slot), type(uint256).max);
        slot.buy(alice, DEPOSIT, PRICE);

        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeCall(Slot.topUp, (1 ether));
        calls[1] = abi.encodeCall(Slot.topUp, (1 ether));
        calls[2] = abi.encodeCall(Slot.selfAssess, (PRICE + 1));
        slot.multicall(calls);
        vm.stopPrank();

        assertEq(slot.deposit(), DEPOSIT + 2 ether);
        assertEq(slot.price(), PRICE + 1);
    }

    /// @dev The constraint that keeps native slots on the old path.
    ///
    ///      `Multicall.multicall` is not payable, so there is no value to
    ///      forward and `topUp` sees `msg.value == 0` against a non-zero amount.
    ///      Worth pinning: a client that assumed otherwise would build a
    ///      transaction that always reverts.
    function test_multicall_cannotCarryNativeValue() public {
        Slot slot = _slot(IERC20(address(0)));

        vm.startPrank(alice);
        slot.buy{value: DEPOSIT}(alice, DEPOSIT, PRICE);

        bytes[] memory calls = new bytes[](1);
        calls[0] = abi.encodeCall(Slot.topUp, (1 ether));

        vm.expectRevert(InvalidValue.selector);
        slot.multicall(calls);
        vm.stopPrank();
    }
}
