// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SlotRegistry} from "../../src/draft/SlotRegistry.sol";

contract SlotRegistryTest is Test {
    SlotRegistry registry;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);
    address slotA = address(0xAAA1);
    address slotB = address(0xBBB2);

    /**
     * Cached, not read inline.
     *
     * `registry.PRIMARY()` is itself an external call, so writing it as an
     * argument makes it the "next call" that `vm.prank` and `vm.expectRevert`
     * apply to — the cheat consumed by the getter, and the call under test
     * running unpranked. Six of these failed that way before the constants
     * were hoisted, and every one of them looked like a contract bug.
     */
    bytes32 KEY;
    uint256 DELAY;

    function setUp() public {
        registry = new SlotRegistry(owner);
        KEY = registry.PRIMARY();
        DELAY = registry.CHANGE_DELAY();
    }

    // ── The first value ──────────────────────────────────────────────────

    function test_FirstSetIsImmediate() public {
        vm.prank(owner);
        registry.set(KEY, slotA);

        assertEq(registry.primary(), slotA);
    }

    function test_OnlyOwnerCanSet() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.set(KEY, slotA);
    }

    function test_RejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(SlotRegistry.ZeroSlot.selector);
        registry.set(KEY, address(0));
    }

    // ── Changing one, which is the part that matters ─────────────────────

    /**
     * The property the whole design rests on.
     *
     * If an existing key could be repointed in one transaction, this contract
     * would offer a publisher nothing they do not already have by pasting an
     * address — worse, in fact, since they would have handed over the ability
     * to change it. The delay is what makes "you can stop passing a slot" a
     * claim rather than a request for trust.
     */
    function test_ChangingAnExistingKeyDoesNotApplyImmediately() public {
        vm.startPrank(owner);
        registry.set(KEY, slotA);
        registry.set(KEY, slotB);
        vm.stopPrank();

        assertEq(registry.primary(), slotA, "change must not be live yet");

        (address pendingSlot, uint64 readyAt) = registry.pendingOf(KEY);
        assertEq(pendingSlot, slotB);
        assertEq(readyAt, uint64(block.timestamp + DELAY));
    }

    function test_CommitTooEarlyReverts() public {
        vm.startPrank(owner);
        registry.set(KEY, slotA);
        registry.set(KEY, slotB);
        vm.stopPrank();

        skip(DELAY - 1);

        vm.expectRevert(abi.encodeWithSelector(SlotRegistry.TooEarly.selector, uint64(block.timestamp + 1)));
        registry.commit(KEY);
    }

    function test_CommitAfterDelayApplies() public {
        vm.startPrank(owner);
        registry.set(KEY, slotA);
        registry.set(KEY, slotB);
        vm.stopPrank();

        skip(DELAY);
        // Anyone may commit — the delay is the protection, not a second key.
        vm.prank(stranger);
        registry.commit(KEY);

        assertEq(registry.primary(), slotB);
        (, uint64 readyAt) = registry.pendingOf(KEY);
        assertEq(readyAt, 0, "pending must be cleared");
    }

    function test_CancelStopsIt() public {
        vm.startPrank(owner);
        registry.set(KEY, slotA);
        registry.set(KEY, slotB);
        registry.cancel(KEY);
        vm.stopPrank();

        skip(DELAY * 10);
        vm.expectRevert(SlotRegistry.NothingPending.selector);
        registry.commit(KEY);

        assertEq(registry.primary(), slotA);
    }

    function test_CommitWithNothingPendingReverts() public {
        vm.expectRevert(SlotRegistry.NothingPending.selector);
        registry.commit(KEY);
    }

    // ── More than one key ────────────────────────────────────────────────

    function test_KeysAreIndependent() public {
        bytes32 other = "feed";
        vm.startPrank(owner);
        registry.set(KEY, slotA);
        registry.set(other, slotB);
        vm.stopPrank();

        // A second key is new, so it lands immediately even though the first
        // key already had a value.
        assertEq(registry.slotOf(other), slotB);
        assertEq(registry.primary(), slotA);
    }

    function test_UnknownKeyIsZero() public view {
        assertEq(registry.slotOf("nothing-here"), address(0));
    }

    // ── Ownership ────────────────────────────────────────────────────────

    function test_OwnershipTransferIsTwoStep() public {
        vm.prank(owner);
        registry.transferOwnership(stranger);
        // Not theirs until accepted — a mistyped address cannot strand this
        // contract, which matters more here than anywhere else because it can
        // never be redeployed without invalidating every embed.
        assertEq(registry.owner(), owner);

        vm.prank(stranger);
        registry.acceptOwnership();
        assertEq(registry.owner(), stranger);
    }
}
