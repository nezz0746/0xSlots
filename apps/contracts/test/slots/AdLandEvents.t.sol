// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test, Vm} from "forge-std/Test.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * The events the indexer reads, asserted from the outside.
 *
 * `packages/ponder/src/adland.ts` decodes `Published` and `Cleared` and writes
 * the `creative` table from them. Nothing in that package can fail if the
 * contract stops emitting one — a handler for an event that never fires simply
 * never runs, and the table stays empty while the chain is full. These tests
 * are the other side of that contract: they pin the signatures the indexer
 * parses and, more importantly, WHEN each one is emitted.
 */
contract AdLandEventsTest is Test {
    SlotFactory factory;
    AdLand adland;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    event Published(address indexed slot, string uri, uint64 tenureId);
    event Cleared(address indexed slot, uint64 fromTenure, uint64 toTenure);

    function setUp() public {
        SlotFactory factoryImpl = new SlotFactory();
        Slot slotImpl = new Slot();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(factoryImpl),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(slotImpl))
                    )
                )
            )
        );

        AdLand impl = new AdLand();
        adland = AdLand(
            address(
                new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(AdLand.initialize, (owner))
                )
            )
        );

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.warp(1_000_000);
    }

    function _slot() internal returns (Slot s) {
        return
            Slot(
                payable(
                    factory.createSlot(
                        SlotInit({
                            recipient: address(this),
                            currency: IERC20(address(0)),
                            manager: address(this),
                            hook: address(adland),
                            hookData: bytes32(0),
                            taxBps: 500,
                            minDepositSeconds: 1 days,
                            mutableTax: true,
                            mutableHook: true
                        })
                    )
                )
            );
    }

    function _take(Slot s, address who, uint256 price) internal {
        uint256 dep = s.minDepositForBuy(price);
        uint256 owed = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: owed}(who, price, dep, type(uint256).max);
    }

    /// @notice `Published` carries the tenure the indexer keys the creative by.
    function test_PublishEmitsTheTenureItBelongsTo() public {
        Slot s = _slot();
        _take(s, alice, 1 ether);

        vm.expectEmit(true, false, false, true, address(adland));
        emit Published(address(s), "data:text/plain,one", s.tenureId());

        vm.prank(alice);
        adland.publish(address(s), "data:text/plain,one");
    }

    /**
     * @notice A buy clears the creative, and says so.
     *
     * @dev The reason the indexer watches two events rather than one. Nobody
     *      publishes here — the outgoing advertiser's ad goes blank because the
     *      slot changed hands — so an indexer following `Published` alone would
     *      keep serving a creative the chain has already stopped returning.
     */
    function test_BuyEmitsClearedWithoutAnyPublish() public {
        Slot s = _slot();
        _take(s, alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(s), "data:text/plain,one");

        uint64 from = s.tenureId();

        vm.recordLogs();
        _take(s, bob, 2 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawCleared;
        for (uint256 i; i < logs.length; i++) {
            if (
                logs[i].emitter == address(adland) &&
                logs[i].topics[0] == Cleared.selector
            ) {
                sawCleared = true;
                (uint64 f, uint64 t) = abi.decode(
                    logs[i].data,
                    (uint64, uint64)
                );
                assertEq(f, from, "the tenure that lost its creative");
                assertEq(t, s.tenureId(), "and the one that replaced it");
            }
        }
        assertTrue(sawCleared, "a buy must announce the creative it wiped");
        assertEq(adland.creativeOf(address(s)), "", "and it is really gone");
    }

    /// @notice Republishing bumps the count the indexer keeps per advertiser.
    /// @dev Two publishes in ONE tenure. The count is per account per slot, so
    ///      this is the case that distinguishes it from counting tenures.
    function test_TwoPublishesInOneTenureAreTwoEvents() public {
        Slot s = _slot();
        _take(s, alice, 1 ether);

        vm.recordLogs();
        vm.startPrank(alice);
        adland.publish(address(s), "data:text/plain,one");
        adland.publish(address(s), "data:text/plain,two");
        vm.stopPrank();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 published;
        for (uint256 i; i < logs.length; i++) {
            if (
                logs[i].emitter == address(adland) &&
                logs[i].topics[0] == Published.selector
            ) published++;
        }
        assertEq(published, 2, "one event per publish, not per tenure");
        assertEq(adland.creativeOf(address(s)), "data:text/plain,two");
    }

    /// @notice A release clears it too — the other path into `Cleared`.
    function test_ReleaseAlsoClears() public {
        Slot s = _slot();
        _take(s, alice, 1 ether);
        vm.prank(alice);
        adland.publish(address(s), "data:text/plain,one");

        vm.prank(alice);
        s.release();

        assertEq(adland.creativeOf(address(s)), "", "vacated, so blank");
    }
}
