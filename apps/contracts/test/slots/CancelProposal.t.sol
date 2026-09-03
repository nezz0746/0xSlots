// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";

/**
 * @notice Cancelling must not reach further than proposing does. The two
 *         dimensions are proposed independently and, under a collective, by
 *         different people.
 */
contract CancelProposalTest is Test {
    SlotFactory factory;
    Slot slot;
    address hookA;

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
            hookData: bytes32(0),
            taxBps: 500,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
        hookA = address(new MinimumTenureHook());
    }

    function _pending()
        internal
        view
        returns (uint256 tax, address hook, bool hasTax, bool hasHook)
    {
        (tax, hook, hasTax, hasHook, , ) = slot.pending();
    }

    /// @notice The bug this replaced: one dimension's cancel wiping the other.
    function test_CancellingTheHookLeavesTheTaxProposalStanding() public {
        slot.proposeTerms(750, address(0), bytes32(0), true, false);
        slot.proposeTerms(0, hookA, bytes32(uint256(7 days)), false, true);

        slot.cancelTerms(false, true);

        (uint256 tax, address hook, bool hasTax, bool hasHook) = _pending();
        assertTrue(hasTax, "the tax manager's work must survive");
        assertEq(tax, 750);
        assertFalse(hasHook);
        assertEq(hook, address(0));
    }

    function test_CancellingTheTaxLeavesTheHookProposalStanding() public {
        slot.proposeTerms(750, address(0), bytes32(0), true, false);
        slot.proposeTerms(0, hookA, bytes32(uint256(7 days)), false, true);

        slot.cancelTerms(true, false);

        (uint256 tax, address hook, bool hasTax, bool hasHook) = _pending();
        assertFalse(hasTax);
        assertEq(tax, 0);
        assertTrue(hasHook, "the hook manager's work must survive");
        assertEq(hook, hookA);
    }

    function test_CancellingBothClearsEverything() public {
        slot.proposeTerms(750, hookA, bytes32(uint256(7 days)), true, true);
        slot.cancelTerms(true, true);

        (, , bool hasTax, bool hasHook) = _pending();
        assertFalse(hasTax);
        assertFalse(hasHook);
    }

    /// @notice Cancelling something that was never proposed is a mistake worth
    ///         reporting, not a silent no-op — it usually means the caller
    ///         believes they queued something they did not.
    function test_CancellingWhatWasNeverProposedReverts() public {
        slot.proposeTerms(750, address(0), bytes32(0), true, false);

        vm.expectRevert();
        slot.cancelTerms(false, true);

        vm.expectRevert();
        slot.cancelTerms(false, false);

        (, , bool hasTax, ) = _pending();
        assertTrue(hasTax, "a rejected cancel must not have touched anything");
    }

    /// @notice Only the manager may retract.
    function test_AStrangerCannotCancel() public {
        slot.proposeTerms(750, address(0), bytes32(0), true, false);
        vm.prank(address(0xBAD));
        vm.expectRevert();
        slot.cancelTerms(true, false);
    }

    /// @notice A surviving proposal must still actually land.
    function test_TheSurvivingProposalStillApplies() public {
        slot.proposeTerms(750, address(0), bytes32(0), true, false);
        slot.proposeTerms(0, hookA, bytes32(uint256(7 days)), false, true);
        slot.cancelTerms(false, true);

        // Terms are queued, ripen, then land at a transition.
        vm.warp(block.timestamp + 1 days + 1);

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        // Sized from the contract, not from taxBps(): the queued 750
        // lands on this very buy, so a deposit computed at the visible 500
        // would be refused.
        uint256 price = 0.01 ether;
        uint256 need = slot.minDepositForBuy(price);
        uint256 dep = slot.quoteBuy(buyer, need);
        vm.prank(buyer);
        slot.buy{value: dep}(buyer, price, need, 0);

        assertEq(slot.taxBps(), 750, "the tax change landed");
        assertEq(slot.hook(), address(0), "the cancelled hook did not");
    }

    /// @notice A pending tax rise lands on the buy that triggers it, so the
    ///         minimum deposit moves before anyone can see the new rate.
    function test_TheMinimumDepositAccountsForAPendingTaxRise() public {
        uint256 price = 0.01 ether;
        uint256 atCurrentTax = slot.minDepositForBuy(price);

        slot.proposeTerms(750, address(0), bytes32(0), true, false);
        // Not yet: a queued rise the transition will not apply must not be
        // priced in, or the quote asks for money the slot will not take.
        assertEq(slot.minDepositForBuy(price), atCurrentTax, "not ripe yet");

        vm.warp(block.timestamp + 1 days + 1);
        uint256 atPendingTax = slot.minDepositForBuy(price);

        assertGt(atPendingTax, atCurrentTax, "the queued rise must be priced in");
        assertEq(slot.taxBps(), 500, "and it has not applied yet");

        // The naive number — sized from the visible rate — is refused.
        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert();
        slot.buy{value: atCurrentTax}(buyer, price, atCurrentTax, 0);

        vm.prank(buyer);
        slot.buy{value: atPendingTax}(buyer, price, atPendingTax, 0);
        assertEq(slot.occupant(), buyer);
    }
}