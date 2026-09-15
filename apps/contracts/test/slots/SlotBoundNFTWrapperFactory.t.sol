// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTFactory, CollectionInit, WrapperInit}
    from "../../src/hooks/nft/SlotBoundNFTFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";

contract SlotBoundNFTWrapperFactoryTest is Test {
    SlotFactory slots;
    SlotBoundNFTFactory nftFactory;
    address admin = makeAddr("admin");
    address stranger = makeAddr("stranger");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        slots = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTFactory fImpl = new SlotBoundNFTFactory();
        nftFactory = SlotBoundNFTFactory(address(new ERC1967Proxy(address(fImpl),
            abi.encodeCall(SlotBoundNFTFactory.initialize, (admin, slots)))));
    }

    function _enableWrappers() internal returns (address wrapperImpl) {
        wrapperImpl = address(new SlotBoundNFTWrapper());
        vm.prank(admin);
        nftFactory.initializeWrappers(wrapperImpl);
    }

    function test_TheVersionAnnouncesTheNewCode() public view {
        assertEq(nftFactory.version(), 3);
    }

    /// @dev A `reinitializer` on an external function is otherwise callable by
    ///      anyone, and the caller would be choosing the implementation behind
    ///      every wrapper.
    function test_OnlyTheAdminCanEnableWrappers() public {
        address wrapperImpl = address(new SlotBoundNFTWrapper());
        vm.prank(stranger);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        nftFactory.initializeWrappers(wrapperImpl);
    }

    function test_EnablingWrappersTwiceIsRefused() public {
        _enableWrappers();
        address second = address(new SlotBoundNFTWrapper());
        vm.prank(admin);
        vm.expectRevert();
        nftFactory.initializeWrappers(second);
    }

    function test_TheFactoryDeploysAWorkingWrapper() public {
        _enableWrappers();
        address w = nftFactory.createWrapper(WrapperInit({name: "Wrapped", symbol: "WRP", owner: admin, wrapFeeWei: 0}));

        assertTrue(nftFactory.isWrapper(w));
        assertEq(nftFactory.wrapperCount(), 1);
        assertEq(SlotBoundNFTWrapper(w).name(), "Wrapped", "initialized through the proxy");
        assertEq(SlotBoundNFTWrapper(w).symbol(), "WRP");
        assertEq(address(SlotBoundNFTWrapper(w).slotFactory()), address(slots));
        assertEq(SlotBoundNFTWrapper(w).version(), 1);
    }

    /// @notice The fee config reaches the wrapper through the factory.
    function test_TheFactorySetsTheWrapperOwnerAndFee() public {
        _enableWrappers();
        address w = nftFactory.createWrapper(WrapperInit({
            name: "Paid", symbol: "PAID", owner: admin, wrapFeeWei: 0.02 ether
        }));

        assertEq(SlotBoundNFTWrapper(w).owner(), admin);
        assertEq(SlotBoundNFTWrapper(w).wrapFeeWei(), 0.02 ether);
    }

    /// @notice A fee nobody can collect would be burnt on every wrap, so the
    ///         wrapper refuses the combination at construction.
    function test_AFeeWithNoOwnerIsRefused() public {
        _enableWrappers();
        vm.expectRevert();
        nftFactory.createWrapper(WrapperInit({
            name: "Bad", symbol: "BAD", owner: address(0), wrapFeeWei: 1 ether
        }));
    }

    function test_TwoWrappersGetTwoAddresses() public {
        _enableWrappers();
        address a = nftFactory.createWrapper(WrapperInit({name: "A", symbol: "A", owner: admin, wrapFeeWei: 0}));
        address b = nftFactory.createWrapper(WrapperInit({name: "B", symbol: "B", owner: admin, wrapFeeWei: 0}));
        assertTrue(a != b);
    }

    /// @notice The upgrade key is hot by design; it is at least gated.
    function test_OnlyTheAdminUpgradesTheWrapperBeacon() public {
        _enableWrappers();
        address next = address(new SlotBoundNFTWrapper());

        vm.prank(stranger);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        nftFactory.upgradeWrapperBeacon(next);

        vm.prank(admin);
        nftFactory.upgradeWrapperBeacon(next);
    }

    /// @notice Collections are untouched: still a plain `new`, still immutable.
    function test_CollectionsStillWork() public {
        _enableWrappers();
        address c = nftFactory.createCollection(CollectionInit({
            name: "Coll", symbol: "C", maxSupply: 3,
            currency: IERC20(address(0)), taxBps: 1000, minDepositSeconds: 7 days,
            recipient: makeAddr("r"), manager: address(0), owner: makeAddr("o")
        }));
        assertTrue(nftFactory.isCollection(c));
        assertFalse(nftFactory.isWrapper(c), "the two registries are separate");
    }
}
