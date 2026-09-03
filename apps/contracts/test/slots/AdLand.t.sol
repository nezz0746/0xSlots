// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";
import {AdView} from "../../src/hooks/adland/IAdLand.sol";

/// @dev Smoke coverage for the draft: the stamp, the wipe, the lens, the key.
contract AdLandTest is Test {
    SlotFactory factory;
    AdLand adland;
    Slot slot;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // `new` hoisted out of the argument list: an argument's CREATE would
        // consume a pending prank or expectRevert before the call under test.
        SlotFactory factoryImpl = new SlotFactory();
        Slot slotImpl = new Slot();
        bytes memory fInit = abi.encodeCall(
            SlotFactory.initialize,
            (address(this), address(slotImpl))
        );
        ERC1967Proxy fProxy = new ERC1967Proxy(address(factoryImpl), fInit);
        factory = SlotFactory(address(fProxy));

        AdLand adImpl = new AdLand();
        bytes memory aInit = abi.encodeCall(AdLand.initialize, (owner));
        ERC1967Proxy aProxy = new ERC1967Proxy(address(adImpl), aInit);
        adland = AdLand(address(aProxy));

        factory.attestHook(address(adland), true);

        slot = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(this),
            currency: IERC20(address(0)),
            manager: address(this),
            hook: address(adland),
            hookData: bytes32(0),
            taxBps: 500,
            minDepositSeconds: 7 days,
            mutableTax: true,
            mutableHook: true
        }))));

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _seat(address who, uint256 price) internal {
        uint256 dep = slot.minDepositForBuy(price);
        vm.prank(who);
        slot.buy{value: dep + (slot.occupant() == address(0) ? 0 : slot.price())}(
            who, price, dep, type(uint256).max
        );
    }

    function test_OccupantPublishesAndItReads() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "data:text/plain,hello");
        assertEq(adland.creativeOf(address(slot)), "data:text/plain,hello");
    }

    function test_ANonOccupantCannotPublish() public {
        _seat(alice, 1 ether);
        vm.prank(bob);
        vm.expectRevert(); // NotOccupant
        adland.publish(address(slot), "nope");
    }

    function test_TheCreativeDoesNotSurviveTheNextOccupant() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        _seat(bob, 1 ether);

        assertEq(adland.creativeOf(address(slot)), "", "bob must not inherit it");
        (string memory raw, ) = adland.rawCreativeOf(address(slot));
        assertEq(raw, "", "afterBuy wiped it");
    }

    /// @dev The whole point of the stamp: even with the wipe defeated, the
    ///      creative must not apply to the new tenure.
    function test_TheStampAloneIsEnoughWhenTheWipeIsSwallowed() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        // Detach the hook, so no `afterBuy` can possibly run, then reseat.
        slot.proposeTerms(0, address(0), bytes32(0), false, true);
        vm.warp(block.timestamp + 8 days);
        _seat(bob, 1 ether);

        (string memory raw, ) = adland.rawCreativeOf(address(slot));
        assertEq(raw, "alice's ad", "fixture: the wipe must not have run");
        assertEq(
            adland.creativeOf(address(slot)),
            "",
            "the stamp alone must retire it"
        );
    }

    function test_AVacatedSlotShowsNothing() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        vm.prank(alice);
        slot.release();

        assertEq(adland.creativeOf(address(slot)), "", "vacant shows nothing");
    }

    function test_BuyAndPublishIsOneCall() public {
        uint256 dep = slot.minDepositForBuy(1 ether);
        vm.prank(bob);
        adland.buyAndPublish{value: dep}(
            address(slot), 1 ether, dep, type(uint256).max, "bob's ad"
        );

        assertEq(slot.occupant(), bob, "bob is seated");
        assertEq(adland.creativeOf(address(slot)), "bob's ad");
    }

    function test_TheLensReadsEverythingInOneCall() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        AdView memory v = adland.ad(address(slot));
        assertEq(v.slot, address(slot));
        assertTrue(v.managed, "this slot points at us");
        assertEq(v.uri, "alice's ad");
        assertEq(v.info.occupant, alice);
        assertEq(v.info.price, 1 ether);
        assertEq(v.info.taxBps, 500);
    }

    function test_TheLensNeverRevertsOnRubbish() public {
        AdView memory zero = adland.ad(address(0));
        assertEq(zero.slot, address(0), "zero address draws nothing");

        AdView memory eoa = adland.ad(alice);
        assertEq(eoa.slot, address(0), "a codeless address draws nothing");

        AdView memory notASlot = adland.ad(address(factory));
        assertEq(notASlot.slot, address(factory), "there, but unreadable");
        assertEq(notASlot.uri, "");
    }

    function test_AKeyResolvesAndTheFirstSetIsImmediate() public {
        // Hoisted: an external call in the argument list consumes the prank
        // before the call under test ever runs.
        bytes32 k = adland.PRIMARY();
        vm.prank(owner);
        adland.setSlot(k, address(slot));
        assertEq(adland.primary(), address(slot));

        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        AdView memory v = adland.adByKey(k);
        assertEq(v.uri, "alice's ad", "one call: key to creative");
    }

    function test_ChangingAnExistingKeyWaitsOutTheDelay() public {
        bytes32 k = adland.PRIMARY();
        vm.startPrank(owner);
        adland.setSlot(k, address(slot));
        adland.setSlot(k, bob);
        vm.stopPrank();

        assertEq(adland.primary(), address(slot), "not applied yet");

        vm.expectRevert();
        adland.commitSlot(k);

        vm.warp(block.timestamp + adland.CHANGE_DELAY());
        adland.commitSlot(k);
        assertEq(adland.primary(), bob, "applied after the delay");
    }

    function test_AStrangerCannotSetAKey() public {
        bytes32 k = adland.PRIMARY();
        vm.prank(bob);
        vm.expectRevert();
        adland.setSlot(k, address(slot));
    }
}
