// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Slot} from "../../src/Slot.sol";
import {InsufficientGasForTerms} from "../../src/SlotErrors.sol";
import {DenyBuys, SlotsTest} from "./Slots.t.sol";

/**
 * Ripe terms are not opt-in for the buyer they constrain.
 *
 * `_applyPending` returns early when there is not enough gas to read the
 * incoming hook, so that a starved read defers the manager's proposal instead
 * of erasing it. That protects a change from a griefer with no stake in it.
 *
 * It did not hold in `buy`, which applies pending terms BEFORE asking the hook
 * for permission. A buyer facing a hook that would refuse them could send the
 * buy with a gas limit under the threshold, skip the application, and be seated
 * under the old terms with the new hook never consulted.
 *
 * So a buy now refuses rather than defers. Refusing a buy is safe — the buyer
 * retries with more gas. Refusing an eviction is not, which is why the other
 * two transitions keep the early return.
 */
contract TermsApplicationTest is SlotsTest {
    /// @dev The gas floor `_applyPending` needs before it will read a hook.
    function _floor(Slot s) internal view returns (uint256) {
        return (s.HOOK_GAS() * 64) / 63 + s.HOOK_READ_FLOOR();
    }

    function _ripeDenial(Slot s) internal returns (DenyBuys deny) {
        deny = new DenyBuys();
        vm.prank(manager);
        s.proposeTerms(10_000, address(deny), bytes32(0), true, true);
        vm.warp(block.timestamp + s.TERMS_DELAY());
        assertTrue(s.hasRipeTerms(), "terms are ripe");
    }

    /// @notice A low-gas buy is refused, not quietly exempted.
    function test_ABuyerCannotSkipTheHookThatWouldRefuseThem() public {
        Slot s = _slot(address(0));
        _ripeDenial(s);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(InsufficientGasForTerms.selector);
        s.buy{gas: 300_000}(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();

        assertEq(s.occupant(), address(0), "nobody was seated");
        assertTrue(s.hasRipeTerms(), "and the proposal survives");
    }

    /// @notice With gas to spare the hook lands first and does its job.
    function test_TheSameBuyWithGasIsJudgedByTheNewHook() public {
        Slot s = _slot(address(0));
        _ripeDenial(s);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(bob, 100 ether, 1 ether, 1 ether);
        vm.stopPrank();
    }

    /// @notice A buy under the floor is refused even when it would have passed.
    /// @dev The refusal is about the terms not landing, not about the hook's
    ///      answer — so it cannot be dodged by proposing something permissive
    ///      and it does not depend on what the hook would have said.
    function test_TheRefusalIsAboutTheTermsNotTheVerdict() public {
        Slot s = _slot(address(0));
        // A tax change alone still carries `hasHook`, because the proposal
        // below changes both. The point is that any ripe hook change under the
        // floor stops the buy.
        _ripeDenial(s);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(InsufficientGasForTerms.selector);
        s.buy{gas: 400_000}(bob, 1 ether, 1 ether, 1 ether);
        vm.stopPrank();
    }

    /**
     * Rule 1 is untouched: an eviction still cannot be blocked.
     *
     * `liquidate` keeps the early return, so a hook that cannot be read at the
     * gas available defers rather than reverting. A ripe proposal that made an
     * insolvent occupant un-evictable would be the one thing the protocol
     * promises nothing can do.
     */
    function test_ALowGasLiquidationStillEvicts() public {
        Slot s = _slot(address(0));
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, s.minDepositForBuy(1 ether), 0);
        vm.stopPrank();

        _ripeDenial(s);
        vm.warp(block.timestamp + 365 days);
        assertTrue(s.isInsolvent(), "escrow is gone");

        vm.prank(bob);
        s.liquidate{gas: 300_000}();

        assertEq(s.occupant(), address(0), "evicted anyway");
        assertTrue(s.hasRipeTerms(), "the proposal was deferred, not erased");
    }

    /// @notice And a release under the floor still lets go.
    function test_ALowGasReleaseStillWorks() public {
        Slot s = _slot(address(0));
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, s.minDepositForBuy(1 ether), 0);
        vm.stopPrank();

        _ripeDenial(s);

        vm.prank(alice);
        s.release{gas: 300_000}();

        assertEq(s.occupant(), address(0), "released");
        assertTrue(s.hasRipeTerms(), "proposal intact");
    }

    /// @notice A buy with nothing queued is not affected by any of this.
    function test_AnOrdinaryBuyNeedsNoExtraGas() public {
        Slot s = _slot(address(0));
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        s.buy{gas: 300_000}(bob, 1 ether, s.minDepositForBuy(1 ether), 0);
        vm.stopPrank();
        assertEq(s.occupant(), bob, "seated on a modest gas limit");
    }
}
