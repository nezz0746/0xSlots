// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

interface IBatchCollector {
    function collectAll(address[] calldata slots) external;
}

contract BatchCollector {
    function collectAll(address[] calldata slots) external {
        for (uint256 i = 0; i < slots.length; i++) {
            try Slot(slots[i]).collect() {} catch {}
        }
    }
}

contract BatchCollectTest is Test {
    SlotFactory factory;
    Slot implementation;
    MockUSDC usdc;
    BatchCollector batchCollector;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address buyer = makeAddr("buyer");

    SlotConfig config;
    SlotInitParams initParams;

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        usdc = new MockUSDC();
        batchCollector = new BatchCollector();

        config = SlotConfig({
            mutableTax: false,
            mutableUtility: false, mutablePolicy: false,
            manager: address(0)
        });

        initParams = SlotInitParams({
            taxPercentage: 1000, // 10%
            utility: address(0),
            liquidationBountyBps: 0,
            minDepositSeconds: 86400, // 1 day
            occupancyPolicy: address(0)
        });

        // Fund buyer
        usdc.mint(buyer, 100e6);
    }

    function _createSlot() internal returns (address) {
        address slot = factory.createSlot(
            recipient,
            IERC20(address(usdc)),
            config,
            initParams
        );
        // Buyer approves the slot
        vm.prank(buyer);
        usdc.approve(slot, type(uint256).max);
        return slot;
    }

    /// @notice Reproduces the scenario: buy 2 slots, wait, collectAll — both should collect
    function test_collectAll_bothSlots() public {
        address slot1 = _createSlot();
        address slot2 = _createSlot();

        // Buyer buys both slots at 1 USDC, 2 USDC deposit each
        vm.startPrank(buyer);
        Slot(slot1).buy(buyer, 2e6, 1e6);
        Slot(slot2).buy(buyer, 2e6, 1e6);
        vm.stopPrank();

        // Verify both bought — collectedTax should be 0
        assertEq(Slot(slot1).collectedTax(), 0, "slot1 collectedTax should be 0 after buy");
        assertEq(Slot(slot2).collectedTax(), 0, "slot2 collectedTax should be 0 after buy");

        // Advance time 1 hour
        vm.warp(block.timestamp + 1 hours);

        // Both should have tax owed
        uint256 owed1 = Slot(slot1).taxOwed();
        uint256 owed2 = Slot(slot2).taxOwed();
        assertGt(owed1, 0, "slot1 should have tax owed");
        assertGt(owed2, 0, "slot2 should have tax owed");

        // collectAll
        uint256 recipientBefore = usdc.balanceOf(recipient);
        address[] memory slots = new address[](2);
        slots[0] = slot1;
        slots[1] = slot2;
        batchCollector.collectAll(slots);

        uint256 recipientAfter = usdc.balanceOf(recipient);
        uint256 collected = recipientAfter - recipientBefore;

        // Both should have been collected
        assertEq(Slot(slot1).collectedTax(), 0, "slot1 collectedTax should be 0 after collect");
        assertEq(Slot(slot2).collectedTax(), 0, "slot2 collectedTax should be 0 after collect");
        assertGt(collected, 0, "recipient should have received tax");

        emit log_named_uint("owed1", owed1);
        emit log_named_uint("owed2", owed2);
        emit log_named_uint("total collected", collected);
    }

    /// @notice Edge case: collectAll immediately after buy — nothing to collect
    function test_collectAll_immediatelyAfterBuy_reverts() public {
        address slot1 = _createSlot();
        address slot2 = _createSlot();

        vm.startPrank(buyer);
        Slot(slot1).buy(buyer, 2e6, 1e6);
        Slot(slot2).buy(buyer, 2e6, 1e6);
        vm.stopPrank();

        // No time passed — collect should silently skip both (NothingToCollect)
        address[] memory slots = new address[](2);
        slots[0] = slot1;
        slots[1] = slot2;

        uint256 recipientBefore = usdc.balanceOf(recipient);
        batchCollector.collectAll(slots); // should not revert
        uint256 recipientAfter = usdc.balanceOf(recipient);

        assertEq(recipientAfter, recipientBefore, "nothing should be collected immediately after buy");
    }

    /// @notice Edge case: one slot bought at different time — only newer slot has 0 tax
    function test_collectAll_staggeredBuys() public {
        address slot1 = _createSlot();
        address slot2 = _createSlot();

        // Buy slot1
        vm.prank(buyer);
        Slot(slot1).buy(buyer, 2e6, 1e6);

        // Wait 1 hour
        vm.warp(block.timestamp + 1 hours);

        // Buy slot2 (slot1 has been accruing tax for 1h)
        vm.prank(buyer);
        Slot(slot2).buy(buyer, 2e6, 1e6);

        // Immediately collectAll — slot1 has tax, slot2 was JUST bought
        address[] memory slots = new address[](2);
        slots[0] = slot1;
        slots[1] = slot2;

        uint256 recipientBefore = usdc.balanceOf(recipient);
        batchCollector.collectAll(slots);
        uint256 recipientAfter = usdc.balanceOf(recipient);
        uint256 collected = recipientAfter - recipientBefore;

        emit log_named_uint("collected (only slot1 expected)", collected);

        // slot1 should have been collected, slot2 skipped
        assertGt(collected, 0, "slot1 tax should have been collected");
        assertEq(Slot(slot2).collectedTax(), 0, "slot2 should still have 0 collected");
    }

    /// @notice The REAL bug: buy() resets collectedTax to 0
    function test_buy_resetsCollectedTax() public {
        address slot1 = _createSlot();

        // Buy slot1
        vm.prank(buyer);
        Slot(slot1).buy(buyer, 2e6, 1e6);

        // Wait 1 hour — tax accrues
        vm.warp(block.timestamp + 1 hours);

        uint256 owedBefore = Slot(slot1).taxOwed();
        assertGt(owedBefore, 0);

        // Now settle (via collect) — collectedTax should be > 0
        Slot(slot1).collect();

        emit log_named_uint("taxOwed after 1h", owedBefore);
        emit log_named_uint("collectedTax after collect", Slot(slot1).collectedTax());
    }

    /// @notice Verify: collectedTax is preserved after a force buy (C-1 fix)
    function test_forceBuy_preservesUncollectedTax() public {
        address slot1 = _createSlot();
        address forceBuyer = makeAddr("forceBuyer");

        // First buyer buys
        vm.prank(buyer);
        Slot(slot1).buy(buyer, 2e6, 1e6);

        // Wait 1 hour — tax accrues
        vm.warp(block.timestamp + 1 hours);

        uint256 owedBefore = Slot(slot1).taxOwed();
        emit log_named_uint("taxOwed before force buy", owedBefore);

        // Force buyer buys
        usdc.mint(forceBuyer, 100e6);
        vm.startPrank(forceBuyer);
        usdc.approve(slot1, type(uint256).max);
        Slot(slot1).buy(forceBuyer, 2e6, 1e6);
        vm.stopPrank();

        uint256 collectedAfter = Slot(slot1).collectedTax();
        emit log_named_uint("collectedTax after force buy", collectedAfter);

        // C-1 FIX: collectedTax is preserved — tax accrued before force buy is still collectable
        assertEq(collectedAfter, owedBefore, "collectedTax should equal accrued tax from previous occupant");
    }
}
