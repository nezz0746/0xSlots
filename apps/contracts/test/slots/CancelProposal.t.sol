// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, HookTerms, PendingTerms} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
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
            currency: IERC20(address(0)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableHook: true,
            taxTerms: TaxTerms({recipient: address(0xF00D), rateBps: uint16(500), minRunwaySeconds: uint32(1 hours)}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));
        hookA = address(new MinimumTenureHook());
    }

    function _pending()
        internal
        view
        returns (uint256 tax, address hook, bool hasTax, bool hasHook)
    {
        PendingTerms memory __p1 = slot.pendingTerms();
        TaxTerms memory __r1 = __p1.taxTerms;
        HookTerms memory __h1 = __p1.hookTerms;
        uint8 __m1 = __p1.mask;
        uint64 __at1 = __p1.proposedAt;
        tax = __r1.rateBps;
        hook = __h1.target;
        hasTax = (__m1 & 1 != 0);
        hasHook = (__m1 & 8 != 0);
    }

    /// @notice The bug this replaced: one dimension's cancel wiping the other.
    function test_CancellingTheHookLeavesTheTaxProposalStanding() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), HookTerms({target: hookA, config: bytes32(uint256(7 days))}), uint8(8));

        slot.cancelTerms(uint8(8));

        (uint256 tax, address hook, bool hasTax, bool hasHook) = _pending();
        assertTrue(hasTax, "the tax manager's work must survive");
        assertEq(tax, 750);
        assertFalse(hasHook);
        assertEq(hook, address(0));
    }

    function test_CancellingTheTaxLeavesTheHookProposalStanding() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), HookTerms({target: hookA, config: bytes32(uint256(7 days))}), uint8(8));

        slot.cancelTerms(uint8(1));

        (uint256 tax, address hook, bool hasTax, bool hasHook) = _pending();
        assertFalse(hasTax);
        assertEq(tax, 0);
        assertTrue(hasHook, "the hook manager's work must survive");
        assertEq(hook, hookA);
    }

    function test_CancellingBothClearsEverything() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: hookA, config: bytes32(uint256(7 days))}), uint8(9));
        slot.cancelTerms(uint8(9));

        (, , bool hasTax, bool hasHook) = _pending();
        assertFalse(hasTax);
        assertFalse(hasHook);
    }

    /// @notice Cancelling something that was never proposed is a mistake worth
    ///         reporting, not a silent no-op — it usually means the caller
    ///         believes they queued something they did not.
    function test_CancellingWhatWasNeverProposedReverts() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));

        vm.expectRevert();
        slot.cancelTerms(uint8(8));

        vm.expectRevert();
        slot.cancelTerms(uint8(0));

        (, , bool hasTax, ) = _pending();
        assertTrue(hasTax, "a rejected cancel must not have touched anything");
    }

    /// @notice Only the manager may retract.
    function test_AStrangerCannotCancel() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        vm.prank(address(0xBAD));
        vm.expectRevert();
        slot.cancelTerms(uint8(1));
    }

    /// @notice A surviving proposal must still actually land.
    function test_TheSurvivingProposalStillApplies() public {
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), HookTerms({target: hookA, config: bytes32(uint256(7 days))}), uint8(8));
        slot.cancelTerms(uint8(8));

        // Terms are queued, ripen, then land at a transition.
        vm.warp(block.timestamp + 1 days + 1);

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        // Sized from the contract, not from taxRateBps(): the queued 750
        // lands on this very buy, so a deposit computed at the visible 500
        // would be refused.
        uint256 price = 0.01 ether;
        uint256 need = slot.minDepositForBuy(price);
        uint256 dep = slot.quoteBuy(buyer, need);
        vm.prank(buyer);
        slot.buy{value: dep}(buyer, price, need, 0);

        assertEq(slot.taxRateBps(), 750, "the tax change landed");
        assertEq(slot.hook(), address(0), "the cancelled hook did not");
    }

    /// @notice A pending tax rise lands on the buy that triggers it, so the
    ///         minimum deposit moves before anyone can see the new rate.
    function test_TheMinimumDepositAccountsForAPendingTaxRise() public {
        uint256 price = 0.01 ether;
        uint256 atCurrentTax = slot.minDepositForBuy(price);

        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(750), minRunwaySeconds: 0}), HookTerms({target: address(0), config: bytes32(0)}), uint8(1));
        // Not yet: a queued rise the transition will not apply must not be
        // priced in, or the quote asks for money the slot will not take.
        assertEq(slot.minDepositForBuy(price), atCurrentTax, "not ripe yet");

        vm.warp(block.timestamp + 1 days + 1);
        uint256 atPendingTax = slot.minDepositForBuy(price);

        assertGt(atPendingTax, atCurrentTax, "the queued rise must be priced in");
        assertEq(slot.taxRateBps(), 500, "and it has not applied yet");

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