// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test} from "forge-std/Test.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";
import {AdLandCreate} from "../../src/hooks/adland/AdLandCreate.sol";

contract AdLandCreateTest is Test {
    SlotFactory factory;
    AdLand adland;
    address owner = makeAddr("owner");
    address pub = makeAddr("publisher");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        SlotFactory fi = new SlotFactory();
        Slot si = new Slot();
        factory = SlotFactory(
            address(new ERC1967Proxy(address(fi), abi.encodeCall(SlotFactory.initialize, (address(this), address(si)))))
        );
        AdLand ai = new AdLand();
        adland = AdLand(address(new ERC1967Proxy(address(ai), abi.encodeCall(AdLand.initialize, (owner)))));
        vm.prank(owner);
        adland.setSlotFactory(address(factory));
    }

    /// @notice The slot it makes runs AdLand and can never stop.
    function test_CreatesAnAdSlotThatCannotLeave() public {
        vm.prank(pub);
        address s = adland.createAdSlot(pub, IERC20(address(0)), 500, 1 days, 7 days, pub, bytes32(0));

        assertEq(Slot(payable(s)).hook(), address(adland), "runs this hook");
        assertEq(uint256(Slot(payable(s)).hookData()), 7 days, "seconds, encoded for them");
        assertFalse(Slot(payable(s)).mutableHook(), "and can never point elsewhere");
        assertTrue(Slot(payable(s)).mutableTax(), "rent stays adjustable");
    }

    /// @notice No manager means terms fixed at birth, which the core demands.
    function test_NoManagerMeansImmutable() public {
        vm.prank(pub);
        address s = adland.createAdSlot(pub, IERC20(address(0)), 500, 1 days, 0, address(0), bytes32(0));
        assertFalse(Slot(payable(s)).mutableTax());
        assertEq(Slot(payable(s)).manager(), address(0));
        assertEq(uint256(Slot(payable(s)).hookData()), 0, "zero window is allowed here");
    }

    /// @notice A window the hook refuses takes the creation down with it.
    function test_AnImpossibleWindowRevertsAtCreation() public {
        vm.prank(pub);
        vm.expectRevert();
        adland.createAdSlot(pub, IERC20(address(0)), 500, 1 days, 400 days, pub, bytes32(0));
    }

    /// @notice An unset factory says so rather than deploying nothing.
    function test_WithoutAFactoryItSaysSo() public {
        AdLand fresh =
            AdLand(address(new ERC1967Proxy(address(new AdLand()), abi.encodeCall(AdLand.initialize, (owner)))));
        vm.expectRevert(AdLandCreate.NoFactory.selector);
        fresh.createAdSlot(pub, IERC20(address(0)), 500, 1 days, 0, address(0), bytes32(0));
    }

    // ─── claiming a key at creation ─────────────────────────────────────────

    /// @notice Alice takes a free name in the same transaction as her space.
    function test_AliceClaimsAFreeKeyWhenSheCreates() public {
        vm.prank(alice);
        address s = adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        assertEq(adland.slotOf("ethereum"), s, "resolves immediately");
        assertEq(adland.keyOwner("ethereum"), alice, "and she owns the name");
    }

    /// @notice A virgin key writes straight through — no pending, no delay.
    function test_AFreshKeyDoesNotWait() public {
        vm.prank(alice);
        adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        (address pendingSlot, uint64 readyAt) = adland.pendingOf("ethereum");
        assertEq(pendingSlot, address(0), "nothing queued");
        assertEq(readyAt, 0, "nothing to wait for");
    }

    /// @notice Passing no key creates a slot and touches the registry not at all.
    function test_CreatingWithoutAKeyClaimsNothing() public {
        vm.prank(alice);
        address s = adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, bytes32(0));

        assertEq(Slot(payable(s)).hook(), address(adland), "still a real slot");
        assertEq(adland.keyOwner(bytes32(0)), address(0), "no name taken");
    }

    /// @notice Bob cannot take Alice's name — and gets no slot for trying.
    /// @dev The whole transaction reverts rather than creating the slot and
    ///      silently skipping the claim, which would hand Bob a space he
    ///      believes is named and is not.
    function test_BobCannotTakeAliceKeyAndGetsNoSlot() public {
        vm.prank(alice);
        adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        uint256 before = vm.getNonce(address(adland));

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("KeyTaken(bytes32)", bytes32("ethereum")));
        adland.createAdSlot(bob, IERC20(address(0)), 500, 1 days, 0, bob, "ethereum");

        assertEq(adland.slotOf("ethereum"), adland.slotOf("ethereum"), "unchanged");
        assertEq(adland.keyOwner("ethereum"), alice, "still hers");
        assertEq(vm.getNonce(address(adland)), before, "and bob deployed nothing");
    }

    // ─── repointing a key you own ───────────────────────────────────────────

    /// @notice Alice may move her own name, through the ordinary delay.
    function test_AliceRepointsHerOwnKeyAfterTheDelay() public {
        vm.prank(alice);
        adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        vm.prank(alice);
        address second = adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, bytes32(0));

        vm.prank(alice);
        adland.setSlot("ethereum", second);

        vm.warp(block.timestamp + 2 days);
        adland.commitSlot("ethereum");

        assertEq(adland.slotOf("ethereum"), second, "points at her new slot");
    }

    /// @notice Bob may not move a name he does not hold.
    function test_BobCannotRepointAliceKey() public {
        vm.prank(alice);
        address s = adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        vm.prank(bob);
        vm.expectRevert();
        adland.setSlot("ethereum", bob);

        assertEq(adland.slotOf("ethereum"), s, "untouched");
    }

    /// @notice Owning a key is not owning the contract.
    function test_HoldingAKeyGrantsNothingElse() public {
        vm.prank(alice);
        adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        vm.prank(alice);
        vm.expectRevert();
        adland.setSlotFactory(address(1));
    }

    // ─── the owner still outranks everyone ──────────────────────────────────

    /// @notice The contract owner can take a squatted name back.
    function test_OwnerCanDesquatAKeyAliceHolds() public {
        vm.prank(alice);
        adland.createAdSlot(alice, IERC20(address(0)), 500, 1 days, 0, alice, "ethereum");

        vm.prank(owner);
        address proper = adland.createAdSlot(owner, IERC20(address(0)), 500, 1 days, 0, owner, bytes32(0));

        vm.prank(owner);
        adland.setSlot("ethereum", proper);

        vm.warp(block.timestamp + 2 days);
        adland.commitSlot("ethereum");

        assertEq(adland.slotOf("ethereum"), proper, "owner outranks the holder");
    }

    /// @notice Nobody may claim `primary` by creating, because it is already set.
    function test_PrimaryCannotBeClaimedOnceSet() public {
        vm.prank(owner);
        address mine = adland.createAdSlot(owner, IERC20(address(0)), 500, 1 days, 0, owner, bytes32(0));
        // Hoisted: `PRIMARY()` is itself an external call, and `vm.prank`
        // applies to the next one — reading it inline consumes the prank and
        // `setSlot` then runs as the test contract.
        bytes32 primaryKey = adland.PRIMARY();
        vm.prank(owner);
        adland.setSlot(primaryKey, mine);

        vm.prank(bob);
        vm.expectRevert();
        adland.createAdSlot(bob, IERC20(address(0)), 500, 1 days, 0, bob, "primary");
    }
}
