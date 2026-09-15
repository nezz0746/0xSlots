// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "../../src/hooks/nft/ISlotBoundNFTWrapper.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";

contract MockNFT is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
}

/// @dev Re-enters `withdraw` from inside the underlying's own transfer.
contract ReentrantNFT is ERC721 {
    SlotBoundNFTWrapper public target;
    uint256 public reenterOn;
    bool public tried;

    constructor() ERC721("Re", "RE") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function arm(SlotBoundNFTWrapper t, uint256 id) external { target = t; reenterOn = id; }

    function transferFrom(address from, address to, uint256 id) public override {
        super.transferFrom(from, to, id);
        if (address(target) != address(0) && !tried) {
            tried = true;
            try target.withdraw(reenterOn) {} catch {}
        }
    }
}

contract SlotBoundNFTWrapperWithdrawTest is Test {
    SlotFactory factory;
    SlotBoundNFTWrapper wrapper;
    MockNFT nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant TAX = 1000;
    uint256 constant VALUATION = 1 ether;

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTWrapper wImpl = new SlotBoundNFTWrapper();
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(wImpl), address(this));
        wrapper = SlotBoundNFTWrapper(address(new BeaconProxy(address(beacon),
            abi.encodeCall(SlotBoundNFTWrapper.initialize,
                ("Wrapped Slots", "WSLOT", factory)))));

        nft = new MockNFT();
        for (uint256 i = 1; i <= 5; ++i) nft.mint(alice, i);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.warp(1_000_000);
    }

    function _dep(uint256 v) internal view returns (uint256) {
        return wrapper.quoteWrap(v, TAX);
    }

    function _wrap(uint256 id, Mode mode) internal returns (uint256 tokenId, Slot slot) {
        vm.startPrank(alice);
        nft.approve(address(wrapper), id);
        address s;
        (tokenId, s) = wrapper.wrap{value: _dep(VALUATION)}(
            IERC721(address(nft)), id, TAX, VALUATION, mode
        );
        vm.stopPrank();
        slot = Slot(payable(s));
    }

    function _buy(address who, Slot slot, uint256 price) internal {
        uint256 pay = slot.price() + _dep(price);
        uint256 dep = _dep(price);
        vm.prank(who);
        slot.buy{value: pay}(who, price, dep, 0);
    }

    // ── modes ───────────────────────────────────────────────────────────────

    function test_PermanentRefusesWithdrawalWhenVacant() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Permanent);
        vm.prank(alice);
        slot.release();

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.NotReclaimable.selector);
        wrapper.withdraw(id);
    }

    function test_ReclaimableAllowsWithdrawalWhenVacant() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        slot.release();

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(nft.ownerOf(1), alice, "the underlying went home");
        assertTrue(wrapper.wrapOf(id).retired);
    }

    /// @notice Closes the snipe race: release-then-withdraw in two transactions
    ///         lets anyone take the vacant slot in between.
    function test_TheDepositorMayWithdrawWhileTheyThemselvesOccupy() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(nft.ownerOf(1), alice);
        assertTrue(wrapper.wrapOf(id).retired);
    }

    function test_ReclaimableRefusesWithdrawalWhileAStrangerOccupies() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        _buy(bob, slot, 2 ether);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.Occupied.selector);
        wrapper.withdraw(id);
    }

    function test_ANonDepositorCannotWithdraw() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        slot.release();

        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.NotDepositor.selector);
        wrapper.withdraw(id);
    }

    /// @notice An insolvent occupant still reads as the occupant. The failure
    ///         is in the safe direction: blocked, never wrongly allowed.
    function test_AnInsolventOccupantBlocksWithdrawalUntilLiquidated() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        _buy(bob, slot, 2 ether);
        vm.warp(block.timestamp + 3650 days);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.Occupied.selector);
        wrapper.withdraw(id);

        slot.liquidate();

        vm.prank(alice);
        wrapper.withdraw(id);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_WithdrawingTwiceIsRefused() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.SlotRetired.selector);
        wrapper.withdraw(id);
    }

    // ── retirement: the two failure modes ───────────────────────────────────

    /// @notice FAILURE MODE ONE. Without a named veto in `beforeBuy`, someone
    ///         pays to occupy a slot with no asset and no token behind it.
    function test_BuyingARetiredSlotIsRefusedByName() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        // Both hoisted: an external call inside the guarded frame is what
        // expectRevert would catch. The value must be EXACT — the core's
        // `InvalidValue` check runs before any hook, so an approximate amount
        // never reaches the veto under test.
        uint256 dep = _dep(2 ether);
        uint256 pay = slot.price() + dep;

        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.SlotRetired.selector);
        slot.buy{value: pay}(bob, 2 ether, dep, 0);
    }

    /// @notice FAILURE MODE TWO. Without `_sync` returning early on a retired
    ///         token, `afterRelease` reverts on a burned token, `strict`
    ///         propagates it, and the depositor's escrow is stuck forever.
    function test_AWithdrawingOccupantCanStillReleaseAndGetTheirDepositBack() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);

        vm.prank(alice);
        wrapper.withdraw(id);

        uint256 before = alice.balance;
        vm.prank(alice);
        slot.release();

        assertGt(alice.balance, before, "escrow came back");
        assertEq(slot.occupant(), address(0));
    }

    /// @notice And a retired slot must still liquidate, for the same reason.
    function test_ARetiredSlotCanStillBeLiquidated() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.warp(block.timestamp + 3650 days);
        slot.liquidate(); // must not revert
        assertEq(slot.occupant(), address(0));
    }

    function test_ARetiredTokenIsBurned() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.expectRevert();
        wrapper.ownerOf(id);
    }

    function test_ARetiredTokenHasNoMetadata() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.expectRevert(abi.encodeWithSelector(ISlotBoundNFT.NoSuchToken.selector, id));
        wrapper.tokenURI(id);
    }

    // ── hostile underlyings ─────────────────────────────────────────────────

    function test_AReentrantUnderlyingCannotReenterWithdraw() public {
        ReentrantNFT bad = new ReentrantNFT();
        bad.mint(alice, 1);

        vm.startPrank(alice);
        bad.approve(address(wrapper), 1);
        (uint256 id, ) = wrapper.wrap{value: _dep(VALUATION)}(
            IERC721(address(bad)), 1, TAX, VALUATION, Mode.Reclaimable
        );
        vm.stopPrank();

        bad.arm(wrapper, id);

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(bad.ownerOf(1), alice, "out exactly once");
        assertTrue(wrapper.wrapOf(id).retired);
    }

    function test_AnUnsolicitedSafeTransferIsRefusedByName() public {
        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.UnsolicitedTransfer.selector);
        nft.safeTransferFrom(alice, address(wrapper), 3);
    }
}
