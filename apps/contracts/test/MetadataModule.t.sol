// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Minimal mock that returns a configurable occupant address.
contract MockSlot {
    address public occupant;

    function setOccupant(address _occupant) external {
        occupant = _occupant;
    }
}

contract MetadataModuleTest is Test {
    MetadataModule module;
    MetadataModule moduleImpl;
    MockSlot mockSlot;

    SlotFactory factory;
    MockERC20 token;

    address owner;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");

    function setUp() public {
        owner = address(this);

        // Deploy MetadataModule behind a UUPS proxy
        moduleImpl = new MetadataModule();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(moduleImpl),
            abi.encodeCall(MetadataModule.initialize, (address(this)))
        );
        module = MetadataModule(address(proxy));

        // Mock slot for unit tests
        mockSlot = new MockSlot();

        // Real factory + token for integration tests
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy factoryProxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(factoryProxy));
        token = new MockERC20();
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    function _createSlotWithModule() internal returns (Slot) {
        SlotConfig memory config = SlotConfig({
            mutableTax: true,
            mutableUtility: true, mutablePolicy: false,
            manager: manager
        });
        SlotInitParams memory init = SlotInitParams({
            taxPercentage: 100,
            utility: address(module),
            liquidationBountyBps: 500,
            minDepositSeconds: 86400,
            occupancyPolicy: address(0)
        });
        address addr = factory.createSlot(recipient, IERC20(address(token)), config, init);
        return Slot(addr);
    }

    function _buySlot(Slot slot, address buyer, uint256 depositAmt, uint256 selfPrice) internal {
        vm.startPrank(buyer);
        token.approve(address(slot), depositAmt + slot.price());
        slot.buy(buyer, depositAmt, selfPrice);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    function test_initialize() public view {
        assertEq(module.owner(), owner);
    }

    function test_cannotInitializeTwice() public {
        vm.expectRevert();
        module.initialize(address(this));
    }

    function test_implementationCannotBeInitialized() public {
        vm.expectRevert();
        moduleImpl.initialize(address(this));
    }

    // ═══════════════════════════════════════════════════════════
    // ERC-165 & IDENTITY
    // ═══════════════════════════════════════════════════════════

    function test_name() public view {
        assertEq(module.name(), "AdLandModule");
    }

    function test_version() public view {
        assertEq(module.version(), "2.1.0");
    }

    function test_supportsISlotsModule() public view {
        assertTrue(module.supportsInterface(type(IUtility).interfaceId));
    }

    function test_supportsIERC165() public view {
        assertTrue(module.supportsInterface(type(IERC165).interfaceId));
    }

    function test_doesNotSupportRandomInterface() public view {
        assertFalse(module.supportsInterface(0xdeadbeef));
    }

    // ═══════════════════════════════════════════════════════════
    // updateMetadata — UNIT TESTS (MockSlot)
    // ═══════════════════════════════════════════════════════════

    function test_updateMetadata_occupantCanSet() public {
        mockSlot.setOccupant(alice);

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://Qm123");

        assertEq(module.tokenURI(address(mockSlot)), "ipfs://Qm123");
    }

    function test_updateMetadata_emitsEvent() public {
        mockSlot.setOccupant(alice);

        vm.expectEmit(true, false, false, true);
        emit MetadataModule.MetadataUpdated(address(mockSlot), "ipfs://Qm456");

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://Qm456");
    }

    function test_updateMetadata_occupantCanOverwrite() public {
        mockSlot.setOccupant(alice);

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://first");

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://second");

        assertEq(module.tokenURI(address(mockSlot)), "ipfs://second");
    }

    function test_updateMetadata_nonOccupantReverts() public {
        mockSlot.setOccupant(alice);

        vm.prank(bob);
        vm.expectRevert(MetadataModule.NotOccupant.selector);
        module.updateMetadata(address(mockSlot), "ipfs://evil");
    }

    function test_updateMetadata_emptyURI() public {
        mockSlot.setOccupant(alice);

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "");

        assertEq(module.tokenURI(address(mockSlot)), "");
    }

    // ═══════════════════════════════════════════════════════════
    // onRelease — UNIT TESTS
    // ═══════════════════════════════════════════════════════════

    function test_onRelease_deletesTokenURI() public {
        mockSlot.setOccupant(alice);

        // Set metadata first
        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://toBeCleared");

        // Simulate the slot calling onRelease (msg.sender = slot)
        vm.prank(address(mockSlot));
        module.onRelease(0, alice);

        assertEq(module.tokenURI(address(mockSlot)), "");
    }

    function test_onRelease_emitsEmptyURI() public {
        mockSlot.setOccupant(alice);

        vm.prank(alice);
        module.updateMetadata(address(mockSlot), "ipfs://willClear");

        vm.expectEmit(true, false, false, true);
        emit MetadataModule.MetadataUpdated(address(mockSlot), "");

        vm.prank(address(mockSlot));
        module.onRelease(0, alice);
    }

    // ═══════════════════════════════════════════════════════════
    // Hook no-ops
    // ═══════════════════════════════════════════════════════════

    function test_onTransfer_doesNotRevert() public {
        module.onTransfer(0, alice, bob);
    }

    function test_onPriceUpdate_doesNotRevert() public {
        module.onPriceUpdate(0, 100, 200);
    }

    // ═══════════════════════════════════════════════════════════
    // INTEGRATION — Real Slot + MetadataModule
    // ═══════════════════════════════════════════════════════════

    function test_integration_occupantSetsMetadata() public {
        Slot slot = _createSlotWithModule();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        module.updateMetadata(address(slot), "ipfs://QmReal");

        assertEq(module.tokenURI(address(slot)), "ipfs://QmReal");
    }

    function test_integration_nonOccupantCannotSetMetadata() public {
        Slot slot = _createSlotWithModule();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(bob);
        vm.expectRevert(MetadataModule.NotOccupant.selector);
        module.updateMetadata(address(slot), "ipfs://nope");
    }

    function test_integration_releaseClearsMetadata() public {
        Slot slot = _createSlotWithModule();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        module.updateMetadata(address(slot), "ipfs://QmClear");

        assertEq(module.tokenURI(address(slot)), "ipfs://QmClear");

        // Release triggers onRelease hook → clears metadata
        vm.prank(alice);
        slot.release();

        assertEq(module.tokenURI(address(slot)), "");
    }

    function test_integration_liquidationClearsMetadata() public {
        Slot slot = _createSlotWithModule();
        _buySlot(slot, alice, 1 ether, 100 ether);

        vm.prank(alice);
        module.updateMetadata(address(slot), "ipfs://QmLiquidate");

        // Fast-forward past insolvency
        vm.warp(block.timestamp + 31 days);
        assertTrue(slot.isInsolvent());

        slot.liquidate();

        assertEq(module.tokenURI(address(slot)), "");
    }

    function test_integration_newOccupantCanSetOwnMetadata() public {
        Slot slot = _createSlotWithModule();
        _buySlot(slot, alice, 10 ether, 100 ether);

        vm.prank(alice);
        module.updateMetadata(address(slot), "ipfs://alice");

        // Bob buys the slot from Alice
        _buySlot(slot, bob, 15 ether, 200 ether);

        // Metadata cleared on transfer
        assertEq(module.tokenURI(address(slot)), "");

        // Bob sets his own
        vm.prank(bob);
        module.updateMetadata(address(slot), "ipfs://bob");

        assertEq(module.tokenURI(address(slot)), "ipfs://bob");

        // Alice can no longer update
        vm.prank(alice);
        vm.expectRevert(MetadataModule.NotOccupant.selector);
        module.updateMetadata(address(slot), "ipfs://alice-again");
    }
}
