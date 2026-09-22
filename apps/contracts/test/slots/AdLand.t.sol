// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SlotMath} from "../../src/libraries/SlotMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/modules/adland/AdLand.sol";
import {AdView} from "../../src/modules/adland/IAdLand.sol";
import {ISlotModule, Scopes, SlotContext} from "../../src/interfaces/ISlotModule.sol";

contract AdTok is ERC20 {
    constructor() ERC20("A", "A") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev Smoke coverage for the draft: the stamp, the wipe, the lens, the key.
contract AdLandTest is Test {
    event Cleared(address indexed slot, uint64 fromTenure, uint64 toTenure);

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


        slot = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: uint16(500), minRunwaySeconds: uint32(7 days)}),
            moduleTerms: ModuleTerms({target: address(adland), settings: bytes32(0)})
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

        // Detach the module, so no `afterBuy` can possibly run, then reseat.
        slot.proposeTerms(TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}), ModuleTerms({target: address(0), settings: bytes32(0)}), uint8(8));
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
        assertEq(v.info.terms.taxTerms.rateBps, 500);
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

    // ─── the wipe is keyed by the slot, not by the caller ───────────────────


    /// @notice And a forged context still cannot clear a creative that is live.
    ///
    /// @dev The reason the wipe was keyed on `msg.sender` in the first place.
    ///      Keying on `ctx.slot` reopens that door unless something else holds
    ///      it shut — here, the wipe refuses any entry the lens is still
    ///      serving, so a forged call can only collect one that is already
    ///      dead. Which is all an honest call ever does.
    function test_AForgedContextCannotClearALiveCreative() public {
        _seat(alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(slot), "alice's ad");

        SlotContext memory forged;
        forged.slot = address(slot);
        forged.caller = bob;
        forged.account = bob;

        vm.prank(bob);
        adland.afterBuy(forged);
        vm.prank(bob);
        adland.afterRelease(forged);
        vm.prank(bob);
        adland.afterLiquidate(forged);

        assertEq(
            adland.creativeOf(address(slot)),
            "alice's ad",
            "a stranger must not be able to pull a live creative"
        );
    }

    /// @notice A stale entry is collectable by anyone, which is the point.
    ///
    /// @dev The trade the new keying makes. Two ways a row outlives its tenure:
    ///      the wipe is gas-capped and swallowed so it CAN be missed, and a slot
    ///      may use AdLand as a plain registry with some other module — in which
    ///      case no callback ever arrives at all. This is that second case.
    ///
    ///      Landing it late changes no answer, because the stamp retired the row
    ///      the moment the tenure ended. What it does is emit {Cleared}, which
    ///      is the event an indexer needs.
    function test_AStaleCreativeCanBeCollectedLate() public {
        Slot un = _unmanagedSlot();
        _seatOn(un, alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(un), "alice's ad");

        vm.prank(alice);
        un.release();

        // No module, so nothing was called and the row is still sitting there —
        // already invisible to the lens, and still costing storage.
        (string memory raw, ) = adland.rawCreativeOf(address(un));
        assertEq(raw, "alice's ad", "fixture: no callback can have run");
        assertEq(adland.creativeOf(address(un)), "", "but the stamp retired it");

        SlotContext memory ctx;
        ctx.slot = address(un);

        vm.expectEmit(true, false, false, false, address(adland));
        emit Cleared(address(un), 0, 0);
        vm.prank(bob);
        adland.afterRelease(ctx);

        (string memory after_, ) = adland.rawCreativeOf(address(un));
        assertEq(after_, "", "a dead row is anybody's to collect");
    }


    /// @dev AdLand as a plain registry: the slot's module is nobody, so no
    ///      callback ever arrives and the stamp does all the work.
    function _unmanagedSlot() internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: uint16(500), minRunwaySeconds: uint32(7 days)}),
            moduleTerms: ModuleTerms({target: address(0), settings: bytes32(0)})
        }))));
    }

    function _seatOn(Slot s, address who, uint256 price) internal {
        uint256 dep = s.minDepositForBuy(price);
        vm.prank(who);
        s.buy{value: dep + (s.occupant() == address(0) ? 0 : s.price())}(
            who, price, dep, type(uint256).max
        );
    }

    /// @notice Buy-and-publish approves what the slot will actually charge,
    ///         debt included, so an advertiser who owes debt can still use it.
    function test_BuyAndPublishCoversTheBuyersDebt() public {
        AdTok tok = new AdTok();
        tok.mint(alice, 1_000 ether);
        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(tok)),
            manager: address(this),
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: uint16(500), minRunwaySeconds: uint32(7 days)}),
            moduleTerms: ModuleTerms({target: address(adland), settings: bytes32(0)})
        }))));
        uint256 dep = SlotMath.depositFor(1 ether, 500, 7 days);

        vm.startPrank(alice);
        tok.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, dep, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        s.liquidate();
        uint256 debt = s.debtOf(alice);
        assertGt(debt, 0);

        vm.startPrank(alice);
        tok.approve(address(adland), dep + debt);
        adland.buyAndPublish(address(s), 1 ether, dep, 0, "data:text/plain,back");
        vm.stopPrank();

        assertEq(s.occupant(), alice);
        assertEq(s.debtOf(alice), 0, "her debt was paid through AdLand");
        assertEq(adland.creativeOf(address(s)), "data:text/plain,back");
    }
}
