// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/slots/Slot.sol";
import {SlotFactory} from "../../src/slots/SlotFactory.sol";

/**
 * @notice An operator approval is authority over a TENURE, not over an address.
 *         These pin that down, because the natural implementation gets it wrong
 *         in a way nothing else in the suite would notice.
 */
contract OperatorTenureTest is Test {
    SlotFactory factory;
    Slot slot;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address aliceBot = address(0xB07);

    uint256 constant PRICE = 0.01 ether;
    uint256 dep;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        slot = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(0)),
            manager: address(this),
            hook: address(0),
            taxPercentage: 1_000,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
        dep = PRICE * 1_000 * 1 hours / (30 days * 10_000) + 1;
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _seat(address who) internal {
        vm.prank(who);
        slot.buy{value: slot.quoteBuy(dep)}(who, dep, PRICE);
    }

    /// @notice The ordinary case: your operator can reprice for you.
    function test_AnOperatorMayRepriceForTheOccupantWhoApprovedThem() public {
        _seat(alice);
        vm.prank(alice);
        slot.setOperator(aliceBot, true);

        // Downward: raising it would need a bigger deposit, which is a
        // different rule and not what this test is about.
        vm.prank(aliceBot);
        slot.selfAssess(0.005 ether);
        assertEq(slot.price(), 0.005 ether);
    }

    /// @notice The bug. Alice's bot must not keep authority over BOB's tenure.
    function test_AnOperatorDoesNotSurviveIntoTheNextOccupancy() public {
        _seat(alice);
        vm.prank(alice);
        slot.setOperator(aliceBot, true);
        assertTrue(slot.isOperator(aliceBot));

        _seat(bob); // bob buys the slot out from under alice
        assertEq(slot.occupant(), bob);

        assertFalse(slot.isOperator(aliceBot), "alice's bot must not govern bob");
        vm.prank(aliceBot);
        vm.expectRevert();
        slot.selfAssess(0.9 ether);
        assertEq(slot.price(), PRICE, "bob's price is bob's to set");
    }

    /// @notice Same, via the vacancy path rather than a direct buy.
    function test_AnOperatorDoesNotSurviveReleaseAndReseat() public {
        _seat(alice);
        vm.prank(alice);
        slot.setOperator(aliceBot, true);

        vm.prank(alice);
        slot.release();
        _seat(bob);

        assertFalse(slot.isOperator(aliceBot));
        vm.prank(aliceBot);
        vm.expectRevert();
        slot.selfAssess(0.9 ether);
    }

    /// @notice And an approval does not come back from the dead when the same
    ///         person retakes the slot — a new tenure starts with nobody
    ///         approved, whoever it belongs to.
    function test_AnApprovalDoesNotResurrectWhenTheSameOccupantRetakes() public {
        _seat(alice);
        vm.prank(alice);
        slot.setOperator(aliceBot, true);

        vm.prank(alice);
        slot.release();
        _seat(alice);

        assertFalse(slot.isOperator(aliceBot), "a new tenure approves nobody");
    }

    /// @notice Two tenures inside one block must still be distinct — a
    ///         timestamp cannot tell them apart, so the identity must not be
    ///         a timestamp.
    function test_TwoTenuresInTheSameBlockAreStillDistinct() public {
        _seat(alice);
        vm.prank(alice);
        slot.setOperator(aliceBot, true);

        vm.prank(alice);
        slot.release();
        _seat(bob); // same block, so occupiedSince is identical

        assertEq(slot.occupiedSince(), block.timestamp);
        assertFalse(slot.isOperator(aliceBot), "same-block reseat is still a new tenure");
    }
}
