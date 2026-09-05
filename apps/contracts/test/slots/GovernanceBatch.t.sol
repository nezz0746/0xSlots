// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotCollective} from "../../src/collectives/SlotCollective.sol";
import {IManagedSlot} from "../../src/collectives/SlotGovernance.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";

/// @notice The batch relays, and the two failure policies they deliberately
///         do not share.
contract GovernanceBatchTest is Test {
    SlotFactory factory;
    SlotCollective gov;
    IManagedSlot[] slots;

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));

        SplitsWarehouse warehouse = new SplitsWarehouse("Ether", "ETH");
        SlotCollective c = new SlotCollective(address(warehouse));
        SlotCollective.InitialRoles memory roles;
        roles.admin = address(this);
        gov = SlotCollective(payable(address(new ERC1967Proxy(address(c),
            abi.encodeCall(
                SlotCollective.initializeCollective, (_split(), roles)
            )))));

        for (uint256 i; i < 3; ++i) {
            slots.push(IManagedSlot(factory.createSlot(SlotInit({
                recipient: address(gov), currency: IERC20(address(0)),
                manager: address(gov), hook: address(0), hookData: bytes32(0),
                taxBps: 1000, minDepositSeconds: 1 days,
                mutableTax: true, mutableHook: true
            }))));
        }
        vm.warp(1_000_000);
    }

    function _split() internal view returns (SplitV2Lib.Split memory sp) {
        address[] memory to = new address[](1);
        to[0] = address(this);
        uint256[] memory alloc = new uint256[](1);
        alloc[0] = 100;
        sp = SplitV2Lib.Split({
            recipients: to,
            allocations: alloc,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    // ── propose: all-or-nothing ─────────────────────────────────────────────

    function test_ATaxBatchMovesEverySlot() public {
        gov.proposeTaxBatch(slots, 2000);
        for (uint256 i; i < slots.length; ++i) {
            assertEq(Slot(payable(address(slots[i]))).getSlotInfo().pendingTaxBps, 2000);
        }
    }

    /// @notice One bad slot sinks the whole batch, on purpose.
    /// @dev A relay fails because this contract is not that slot's manager, or
    ///      the rate is invalid. Mistakes, not ordinary states - swallowing them
    ///      would report success for a portfolio that half moved.
    function test_ATaxBatchIsAllOrNothing() public {
        IManagedSlot[] memory withStranger = new IManagedSlot[](2);
        withStranger[0] = slots[0];
        withStranger[1] = IManagedSlot(factory.createSlot(SlotInit({
            recipient: address(this), currency: IERC20(address(0)),
            manager: address(this),          // not the collective
            hook: address(0), hookData: bytes32(0),
            taxBps: 1000, minDepositSeconds: 1 days,
            mutableTax: true, mutableHook: false
        })));

        vm.expectRevert();
        gov.proposeTaxBatch(withStranger, 2000);
        assertEq(
            Slot(payable(address(slots[0]))).getSlotInfo().pendingTaxBps,
            0,
            "and the good one did not move either"
        );
    }

    function test_AHookBatchMovesEverySlot() public {
        gov.proposeHookBatch(slots, address(0), bytes32(0));
        for (uint256 i; i < slots.length; ++i) {
            assertTrue(Slot(payable(address(slots[i]))).getSlotInfo().pendingHasHook);
        }
    }

    // ── cancel: tolerant ────────────────────────────────────────────────────

    /// @notice An already-clean slot does not sink a cancel batch.
    /// @dev "Nothing queued" IS an ordinary state, so the batch tolerates it -
    ///      otherwise a caller would need the exact state of every slot first.
    function test_ACancelBatchToleratesAnAlreadyCleanSlot() public {
        gov.proposeTax(slots[0], 2000);
        gov.proposeTax(slots[2], 2000);
        // slots[1] has nothing queued

        gov.cancelTaxProposalBatch(slots);
        for (uint256 i; i < slots.length; ++i) {
            assertFalse(Slot(payable(address(slots[i]))).getSlotInfo().pendingHasTax);
        }
    }

    function test_ACancelAllBatchClearsBothDimensions() public {
        gov.proposeTax(slots[0], 2000);
        gov.proposeHook(slots[0], address(0), bytes32(0));
        gov.cancelAllProposalsBatch(slots);

        assertFalse(Slot(payable(address(slots[0]))).getSlotInfo().pendingHasTax);
        assertFalse(Slot(payable(address(slots[0]))).getSlotInfo().pendingHasHook);
    }

    function test_AStrangerCannotBatch() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        gov.proposeTaxBatch(slots, 2000);
    }
}
