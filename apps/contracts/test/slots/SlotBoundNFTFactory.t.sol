// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFT} from "../../src/hooks/nft/SlotBoundNFT.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";
import {
    SlotBoundNFTFactory,
    CollectionInit
} from "../../src/hooks/nft/SlotBoundNFTFactory.sol";

contract TF is ERC20 { constructor() ERC20("T","T"){} function mint(address t,uint256 a) external {_mint(t,a);} }

/// @dev A later factory, to prove an upgrade reaches new collections only.
contract SlotBoundNFTFactoryV2 is SlotBoundNFTFactory {
    function version() public pure override returns (uint64) { return 2; }
}

contract SlotBoundNFTFactoryTest is Test {
    SlotFactory slots;
    SlotBoundNFTFactory factory;
    TF token;

    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address owner = makeAddr("owner");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory sfi = new SlotFactory();
        slots = SlotFactory(address(new ERC1967Proxy(address(sfi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTFactory fi = new SlotBoundNFTFactory();
        factory = SlotBoundNFTFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotBoundNFTFactory.initialize, (admin, slots)))));

        token = new TF();
        token.mint(alice, 1e24);
        vm.warp(1_000_000);
    }

    function _init() internal view returns (CollectionInit memory c) {
        c = CollectionInit({
            name: "Bound", symbol: "BND", maxSupply: 3,
            currency: IERC20(address(token)), taxBps: 1000,
            minDepositSeconds: 7 days, recipient: recipient,
            manager: manager, owner: owner
        });
    }

    // ── creating ────────────────────────────────────────────────────────────

    function test_ItDeploysAWorkingCollection() public {
        SlotBoundNFT c = SlotBoundNFT(factory.createCollection(_init()));

        assertTrue(factory.isCollection(address(c)));
        assertEq(factory.collectionCount(), 1);
        assertEq(address(c.FACTORY()), address(slots), "wired to the slot factory");
        assertEq(c.owner(), owner);
        assertEq(c.terms().manager, manager);
        assertEq(c.terms().recipient, recipient);

        vm.startPrank(alice);
        token.approve(address(c), type(uint256).max);
        (uint256 id, address s) = c.mint(10 ether);
        vm.stopPrank();
        assertEq(c.ownerOf(id), alice, "and it mints, seats and mirrors");
        assertEq(Slot(payable(s)).occupant(), alice);
    }

    function test_AnyoneMayCreateOne() public {
        vm.prank(alice);
        factory.createCollection(_init());
        assertEq(factory.collectionCount(), 1);
    }

    /// @dev The collection checks its own terms; the factory re-checks nothing.
    function test_BadTermsAreRefusedByTheCollection() public {
        CollectionInit memory bad = _init();
        bad.maxSupply = 0;
        vm.expectRevert(ISlotBoundNFT.NoSupply.selector);
        factory.createCollection(bad);
    }

    // ── the asymmetry ───────────────────────────────────────────────────────

    /// @notice The collection is a plain contract, not a proxy.
    /// @dev The whole point: nobody can rewrite what `ownerOf` means for tokens
    ///      people already hold, and nobody can make `_sync` revert — which
    ///      under `strict` would freeze every slot in the collection.
    function test_ACollectionHasNoUpgradeKey() public {
        address c = factory.createCollection(_init());
        assertEq(
            vm.load(c, ERC1967Utils.IMPLEMENTATION_SLOT),
            bytes32(0),
            "no ERC-1967 implementation slot: not a proxy"
        );
        assertEq(vm.load(c, ERC1967Utils.ADMIN_SLOT), bytes32(0));
    }

    /// @notice Upgrading the factory changes the NEXT collection, never an
    ///         existing one.
    function test_AnUpgradeDoesNotReachDeployedCollections() public {
        address before = factory.createCollection(_init());
        bytes32 codeBefore = before.codehash;

        // Hoisted: an argument's CREATE consumes the pending prank.
        address v2 = address(new SlotBoundNFTFactoryV2());
        vm.prank(admin);
        factory.upgradeToAndCall(v2, "");
        assertEq(factory.version(), 2);

        assertEq(before.codehash, codeBefore, "already deployed, and untouched");
        assertEq(factory.collectionCount(), 1, "and the registry survived");
    }

    // ── admin ───────────────────────────────────────────────────────────────

    function test_OnlyTheAdminUpgrades() public {
        address v2 = address(new SlotBoundNFTFactoryV2());
        vm.prank(alice);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        factory.upgradeToAndCall(v2, "");
    }

    function test_AdminCanBeHandedOver() public {
        vm.prank(admin);
        factory.transferAdmin(alice);
        assertEq(factory.admin(), alice);

        vm.prank(admin);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        factory.transferAdmin(admin);
    }

    function test_TheImplementationCannotBeInitialized() public {
        SlotBoundNFTFactory bare = new SlotBoundNFTFactory();
        vm.expectRevert();
        bare.initialize(admin, slots);
    }
}
