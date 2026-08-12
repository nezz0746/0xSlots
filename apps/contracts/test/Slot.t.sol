// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, SlotInfo} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Minimal IUtility implementation used to test module wiring.
contract MockModule is IUtility {
    function name() external pure returns (string memory) { return "MockModule"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external view returns (address) { return address(this); }
    function moduleURI() external pure returns (string memory) { return ""; }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId || id == type(IERC165).interfaceId;
    }
}

contract SlotV3Test is Test {
    SlotFactory factory;
    MockERC20 token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address liquidator = makeAddr("liquidator");

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new MockERC20();

        // Fund users
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    function _defaultConfig() internal view returns (SlotConfig memory) {
        return SlotConfig({
            mutableTax: true,
            mutableUtility: false, mutablePolicy: false,
            manager: manager
        });
    }

    function _immutableConfig() internal pure returns (SlotConfig memory) {
        return SlotConfig({
            mutableTax: false,
            mutableUtility: false, mutablePolicy: false,
            manager: address(0)
        });
    }

    function _defaultInit() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100, // 1%
            utility: address(0),
            liquidationBountyBps: 500, // 5%
            minDepositSeconds: 86400, // 1 day
            occupancyPolicy: address(0)
        });
    }

    function _createSlot(SlotConfig memory config) internal returns (Slot) {
        address addr = factory.createSlot(recipient, IERC20(address(token)), config, _defaultInit());
        return Slot(addr);
    }

    function _createDefaultSlot() internal returns (Slot) {
        return _createSlot(_defaultConfig());
    }

    function _buySlot(Slot slot, address buyer, uint256 depositAmt, uint256 selfPrice) internal {
        vm.startPrank(buyer);
        token.approve(address(slot), depositAmt + slot.price());
        slot.buy(buyer, depositAmt, selfPrice);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // FACTORY TESTS
    // ═══════════════════════════════════════════════════════════

    function test_createSlot() public {
        Slot slot = _createDefaultSlot();

        assertEq(slot.recipient(), recipient);
        assertEq(address(slot.currency()), address(token));
        assertEq(slot.mutableTax(), true);
        assertEq(slot.mutableUtility(), false);
        assertEq(slot.manager(), manager);
        assertEq(slot.taxPercentage(), 100);
        assertEq(slot.occupant(), address(0));
        assertEq(slot.price(), 0);
        assertTrue(slot.isVacant());
    }

    function test_createDuplicateParams() public {
        // Should succeed — no uniqueness constraint
        Slot slot1 = _createDefaultSlot();
        Slot slot2 = _createDefaultSlot();
        assertTrue(address(slot1) != address(slot2));
    }

    function test_createSlotsBatch() public {
        address[] memory slots = factory.createSlots(
            recipient, IERC20(address(token)), _defaultConfig(), _defaultInit(), 5
        );
        assertEq(slots.length, 5);
        for (uint256 i = 0; i < 5; i++) {
            Slot slot = Slot(slots[i]);
            assertEq(slot.recipient(), recipient);
            assertEq(slot.taxPercentage(), 100);
            assertTrue(slot.isVacant());
            // All different addresses
            for (uint256 j = 0; j < i; j++) {
                assertTrue(slots[i] != slots[j]);
            }
        }
    }

    function test_createSlotsZeroReverts() public {
        vm.expectRevert(SlotFactory.InvalidCount.selector);
        factory.createSlots(recipient, IERC20(address(token)), _defaultConfig(), _defaultInit(), 0);
    }

    function test_immutableConfig_managerMustBeZero() public {
        SlotConfig memory config = SlotConfig({
            mutableTax: false,
            mutableUtility: false, mutablePolicy: false,
            manager: manager // should fail
        });
        vm.expectRevert(SlotFactory.InvalidConfig_ManagerMustBeZero.selector);
        factory.createSlot(recipient, IERC20(address(token)), config, _defaultInit());
    }

    function test_mutableConfig_managerRequired() public {
        SlotConfig memory config = SlotConfig({
            mutableTax: true,
            mutableUtility: false, mutablePolicy: false,
            manager: address(0) // should fail
        });
        vm.expectRevert(SlotFactory.InvalidConfig_ManagerRequired.selector);
        factory.createSlot(recipient, IERC20(address(token)), config, _defaultInit());
    }

    // ═══════════════════════════════════════════════════════════
    // BUY TESTS
    // ═══════════════════════════════════════════════════════════

    function test_buyVacant() public {
        Slot slot = _createDefaultSlot();

        _buySlot(slot, alice, 10 ether, 100 ether);

        assertEq(slot.occupant(), alice);
        assertEq(slot.price(), 100 ether);
        assertEq(slot.deposit(), 10 ether);
        assertFalse(slot.isVacant());
    }

    function test_buyOccupied() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        uint256 aliceBefore = token.balanceOf(alice);

        _buySlot(slot, bob, 15 ether, 200 ether);

        assertEq(slot.occupant(), bob);
        assertEq(slot.price(), 200 ether);

        // Alice should have received refund (deposit remainder + price)
        uint256 aliceAfter = token.balanceOf(alice);
        assertTrue(aliceAfter > aliceBefore);
    }

    function test_cannotBuyFromYourself() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.startPrank(alice);
        token.approve(address(slot), 200 ether);
        vm.expectRevert(CannotBuyFromYourself.selector);
        slot.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
    }

    function test_buyEnforcesMinDeposit() public {
        Slot slot = _createDefaultSlot();

        vm.startPrank(alice);
        token.approve(address(slot), 1 ether);
        vm.expectRevert(InsufficientDeposit.selector);
        slot.buy(alice, 1, 100 ether); // 1 wei deposit for 100 ETH price = way below min
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // RELEASE TESTS
    // ═══════════════════════════════════════════════════════════

    function test_release() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        uint256 aliceBefore = token.balanceOf(alice);

        vm.prank(alice);
        slot.release();

        assertTrue(slot.isVacant());
        assertEq(slot.price(), 0);

        // Alice gets deposit back (minus accrued tax)
        assertTrue(token.balanceOf(alice) > aliceBefore);
    }

    function test_releaseOnlyOccupant() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(bob);
        vm.expectRevert(NotOccupant.selector);
        slot.release();
    }

    // ═══════════════════════════════════════════════════════════
    // SELF-ASSESS TESTS
    // ═══════════════════════════════════════════════════════════

    function test_selfAssess() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        slot.selfAssess(50 ether);

        assertEq(slot.price(), 50 ether);
    }

    function test_selfAssessRejectsZero() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(InvalidPrice.selector);
        slot.selfAssess(0);
    }

    // ═══════════════════════════════════════════════════════════
    // TAX TESTS
    // ═══════════════════════════════════════════════════════════

    function test_taxAccrues() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        // Fast forward 30 days (1 month)
        vm.warp(block.timestamp + 30 days);

        // Tax owed = 100 * 100 / 10000 = 1% of 100 = 1 ether per month
        uint256 owed = slot.taxOwed();
        assertEq(owed, 1 ether);
    }

    function test_collect() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.warp(block.timestamp + 30 days);

        uint256 recipientBefore = token.balanceOf(recipient);
        slot.collect();
        uint256 recipientAfter = token.balanceOf(recipient);

        assertEq(recipientAfter - recipientBefore, 1 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // LIQUIDATION TESTS
    // ═══════════════════════════════════════════════════════════

    function test_liquidation() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 1 ether, 100 ether);

        // 1% of 100 = 1 ether/month. With 1 ether deposit, insolvent after 30 days.
        vm.warp(block.timestamp + 31 days);

        assertTrue(slot.isInsolvent());

        uint256 liquidatorBefore = token.balanceOf(liquidator);

        vm.prank(liquidator);
        slot.liquidate();

        assertTrue(slot.isVacant());

        // Liquidator should get 5% bounty
        uint256 bounty = token.balanceOf(liquidator) - liquidatorBefore;
        assertTrue(bounty > 0);
    }

    function test_cannotLiquidateSolvent() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(liquidator);
        vm.expectRevert(NotInsolvent.selector);
        slot.liquidate();
    }

    // ═══════════════════════════════════════════════════════════
    // DEPOSIT / WITHDRAW TESTS
    // ═══════════════════════════════════════════════════════════

    function test_topUp() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.startPrank(alice);
        token.approve(address(slot), 5 ether);
        slot.topUp(5 ether);
        vm.stopPrank();

        assertEq(slot.deposit(), 15 ether);
    }

    function test_withdraw() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        uint256 before = token.balanceOf(alice);

        vm.prank(alice);
        slot.withdraw(5 ether);

        assertEq(slot.deposit(), 5 ether);
        assertEq(token.balanceOf(alice) - before, 5 ether);
    }

    function test_withdrawRejectsBelowMinimum() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(InsufficientDeposit.selector);
        slot.withdraw(10 ether); // Would leave 0, below minimum
    }

    // ═══════════════════════════════════════════════════════════
    // PENDING UPDATE TESTS
    // ═══════════════════════════════════════════════════════════

    function test_proposeTaxUpdate() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(manager);
        slot.proposeTaxUpdate(200); // 2%

        PendingUpdate memory update = slot.getPendingUpdate();
        assertTrue(update.hasTaxUpdate);
        assertEq(update.newTaxPercentage, 200);

        // Tax rate hasn't changed yet
        assertEq(slot.taxPercentage(), 100);
    }

    function test_pendingTaxAppliedOnBuy() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(manager);
        slot.proposeTaxUpdate(200);

        // Bob buys — pending update applies
        _buySlot(slot, bob, 15 ether, 200 ether);

        assertEq(slot.taxPercentage(), 200); // Now 2%
        PendingUpdate memory update = slot.getPendingUpdate();
        assertFalse(update.hasTaxUpdate);
    }

    function test_pendingTaxAppliedOnRelease() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(manager);
        slot.proposeTaxUpdate(300);

        vm.prank(alice);
        slot.release();

        assertEq(slot.taxPercentage(), 300);
    }

    function test_pendingTaxAppliedOnLiquidation() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 1 ether, 100 ether);

        vm.prank(manager);
        slot.proposeTaxUpdate(500);

        vm.warp(block.timestamp + 31 days);

        vm.prank(liquidator);
        slot.liquidate();

        assertEq(slot.taxPercentage(), 500);
    }

    function test_cancelPendingUpdate() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(manager);
        slot.proposeTaxUpdate(200);

        vm.prank(manager);
        slot.cancelPendingUpdates();

        PendingUpdate memory update = slot.getPendingUpdate();
        assertFalse(update.hasTaxUpdate);
        assertEq(slot.taxPercentage(), 100); // Unchanged
    }

    function test_immutableSlotRejectsAnyProposal() public {
        Slot slot = _createSlot(_immutableConfig());

        // manager is address(0) on immutable slots, so any caller gets NotManager
        vm.prank(alice);
        vm.expectRevert(NotManager.selector);
        slot.proposeTaxUpdate(200);

        vm.prank(alice);
        vm.expectRevert(NotManager.selector);
        slot.proposeUtilityUpdate(makeAddr("module"));
    }

    function test_onlyManagerCanPropose() public {
        Slot slot = _createDefaultSlot();

        vm.prank(alice);
        vm.expectRevert(NotManager.selector);
        slot.proposeTaxUpdate(200);
    }

    // ═══════════════════════════════════════════════════════════
    // LIQUIDATION BOUNTY UPDATE
    // ═══════════════════════════════════════════════════════════

    function test_setLiquidationBounty() public {
        Slot slot = _createDefaultSlot();

        vm.prank(manager);
        slot.setLiquidationBounty(1000); // 10%

        assertEq(slot.liquidationBountyBps(), 1000);
    }

    function test_setLiquidationBountyOnlyManager() public {
        Slot slot = _createDefaultSlot();

        vm.prank(alice);
        vm.expectRevert(NotManager.selector);
        slot.setLiquidationBounty(1000);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW TESTS
    // ═══════════════════════════════════════════════════════════

    function test_secondsUntilLiquidation() public {
        Slot slot = _createDefaultSlot();
        _buySlot(slot, alice, 10 ether, 100 ether);

        uint256 secs = slot.secondsUntilLiquidation();
        // 10 ether deposit / (100 * 100 / 10000 / 30 days) per second
        // = 10 / (1 / 2592000) = 10 * 2592000 = 25920000 seconds ≈ 300 days
        assertTrue(secs > 250 days && secs < 310 days);
    }

    function test_vacantSlotMaxLiquidationTime() public {
        Slot slot = _createDefaultSlot();
        assertEq(slot.secondsUntilLiquidation(), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════
    // MODULE VALIDATION (regression tests for SLOT_NOT_FOUND_BUG_REPORT)
    // ═══════════════════════════════════════════════════════════

    function _initWithModule(address module) internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,
            utility: module,
            liquidationBountyBps: 500,
            minDepositSeconds: 86400,
            occupancyPolicy: address(0)
        });
    }

    function test_createSlot_rejectsCodelessModule() public {
        // EOA-style address with no deployed code (mirrors the Sepolia-on-mainnet bug).
        address eoa = makeAddr("noCodeModule");
        assertEq(eoa.code.length, 0);

        vm.expectRevert(SlotFactory.InvalidModule_NoCode.selector);
        factory.createSlot(
            recipient,
            IERC20(address(token)),
            _defaultConfig(),
            _initWithModule(eoa)
        );
    }

    function test_createSlots_batchRejectsCodelessModule() public {
        address eoa = makeAddr("noCodeModule");
        vm.expectRevert(SlotFactory.InvalidModule_NoCode.selector);
        factory.createSlots(
            recipient,
            IERC20(address(token)),
            _defaultConfig(),
            _initWithModule(eoa),
            3
        );
    }

    function test_createSlot_acceptsContractModule() public {
        MockModule mod = new MockModule();
        address addr = factory.createSlot(
            recipient,
            IERC20(address(token)),
            _defaultConfig(),
            _initWithModule(address(mod))
        );
        Slot slot = Slot(addr);
        assertEq(slot.utility(), address(mod));

        // getSlotInfo should not revert and should return the module metadata.
        SlotInfo memory info = slot.getSlotInfo();
        assertEq(info.utility, address(mod));
        assertEq(info.utilityName, "MockModule");
        assertEq(info.utilityVersion, "1.0.0");
    }

    function test_createSlot_acceptsZeroModule() public {
        // Sanity check: address(0) remains valid (means "no module").
        Slot slot = _createSlot(_defaultConfig());
        assertEq(slot.utility(), address(0));

        SlotInfo memory info = slot.getSlotInfo();
        assertEq(info.utility, address(0));
        assertEq(info.utilityName, "");
    }

    function test_proposeModuleUpdate_rejectsCodelessModule() public {
        SlotConfig memory config = SlotConfig({
            mutableTax: false,
            mutableUtility: true, mutablePolicy: false,
            manager: manager
        });
        Slot slot = _createSlot(config);

        address eoa = makeAddr("noCodeModule");
        vm.prank(manager);
        vm.expectRevert(InvalidModule_NoCode.selector);
        slot.proposeUtilityUpdate(eoa);
    }

    function test_proposeModuleUpdate_acceptsContractModule() public {
        SlotConfig memory config = SlotConfig({
            mutableTax: false,
            mutableUtility: true, mutablePolicy: false,
            manager: manager
        });
        Slot slot = _createSlot(config);
        MockModule mod = new MockModule();

        vm.prank(manager);
        slot.proposeUtilityUpdate(address(mod));

        PendingUpdate memory update = slot.getPendingUpdate();
        assertTrue(update.hasUtilityUpdate);
        assertEq(update.newUtility, address(mod));
    }

    function test_proposeModuleUpdate_acceptsZeroToClearModule() public {
        // Clearing the module (newUtility = address(0)) must remain allowed,
        // otherwise managers can't undo a module assignment.
        SlotConfig memory config = SlotConfig({
            mutableTax: false,
            mutableUtility: true, mutablePolicy: false,
            manager: manager
        });
        Slot slot = _createSlot(config);

        vm.prank(manager);
        slot.proposeUtilityUpdate(address(0));

        PendingUpdate memory update = slot.getPendingUpdate();
        assertTrue(update.hasUtilityUpdate);
        assertEq(update.newUtility, address(0));
    }

    function test_getSlotInfo_doesNotRevertWhenModuleCodeWiped() public {
        // Reproduces the production bug: a slot's module address ends up
        // codeless (e.g. selfdestruct, or wrong-chain address). Before the
        // extcodesize guard, getSlotInfo() reverted on ABI decode of empty
        // returndata. After the fix, it must return cleanly with empty
        // module metadata.
        MockModule mod = new MockModule();
        address modAddr = address(mod);
        address slotAddr = factory.createSlot(
            recipient,
            IERC20(address(token)),
            _defaultConfig(),
            _initWithModule(modAddr)
        );
        Slot slot = Slot(slotAddr);

        // Wipe the module's code to simulate a codeless module post-creation.
        vm.etch(modAddr, "");
        assertEq(modAddr.code.length, 0);

        // Must not revert.
        SlotInfo memory info = slot.getSlotInfo();
        assertEq(info.utility, modAddr);
        assertEq(info.utilityName, "");
        assertEq(info.utilityVersion, "");
        assertEq(info.utilityFeeBps, 0);
    }
}
