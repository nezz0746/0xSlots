// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {SlotVault721} from "../src/wrappers/SlotVault721.sol";

contract VMockERC20 is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract VPunks is ERC721 {
    uint256 public next = 1;
    constructor() ERC721("Punks", "PUNK") {}
    function mint(address to) external returns (uint256 id) { id = next++; _mint(to, id); }
}

/**
 * @title SlotVault721Test
 * @notice Idle NFTs made productive: deposit, and whoever occupies the bound
 *         slot becomes the token's USER while the depositor keeps title.
 *
 * @dev Two properties carry the design and both are easy to break later:
 *
 *        1. `userOf` is DERIVED from the slot, never stored. Utility hooks are
 *           gas-capped and swallowed, so any pushed copy could desync and leave
 *           an ex-occupant holding rights somebody else is paying for.
 *
 *        2. Withdrawal needs the receipt AND the slot. Otherwise the depositor
 *           can pull the asset out from under a paying tenant.
 */
contract SlotVault721Test is Test {
    SlotFactory factory;
    VMockERC20 usdc;
    VPunks punks;
    SlotVault721 vault;
    Slot slot;

    address depositor = makeAddr("depositor");
    address renter = makeAddr("renter");
    address other = makeAddr("other");

    uint256 punkId;
    uint256 receiptId;

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));

        usdc = new VMockERC20();
        punks = new VPunks();
        vault = new SlotVault721();

        usdc.mint(renter, 1e12);
        usdc.mint(other, 1e12);
        usdc.mint(depositor, 1e12);

        // The depositor is the slot's recipient, so the tax accrues to them.
        slot = Slot(factory.createSlot(
            depositor,
            IERC20(address(usdc)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(vault),
                liquidationBountyBps: 500,
                minDepositSeconds: 0,
                occupancyPolicy: address(0)
            })
        ));

        vm.startPrank(depositor);
        punkId = punks.mint(depositor);
        punks.approve(address(vault), punkId);
        receiptId = vault.deposit(address(punks), punkId, address(slot));
        vm.stopPrank();

        vm.warp(1_000_000);
    }

    function _buy(address who, uint256 px) internal {
        vm.startPrank(who);
        usdc.approve(address(slot), type(uint256).max);
        slot.buy(who, 10e6, px);
        vm.stopPrank();
    }

    // ── Title and custody ───────────────────────────────────────────────────

    function test_VaultHoldsTheTokenAndDepositorHoldsTitle() public view {
        assertEq(punks.ownerOf(punkId), address(vault), "vault has custody");
        assertEq(vault.ownerOf(receiptId), depositor, "depositor has title");
    }

    /// @dev The receipt is itself an ERC-721, so a depositor can sell their
    ///      yield-bearing position without disturbing the tenant.
    function test_TitleIsTransferableWithoutDisturbingTheTenant() public {
        _buy(renter, 100e6);
        assertEq(vault.userOf(receiptId), renter);

        vm.prank(depositor);
        vault.transferFrom(depositor, other, receiptId);

        assertEq(vault.ownerOf(receiptId), other, "title moved");
        assertEq(vault.userOf(receiptId), renter, "tenant untouched");
    }

    // ── Usage follows occupancy ─────────────────────────────────────────────

    function test_VacantMeansNobodyHoldsTheRights() public view {
        assertEq(vault.userOf(receiptId), address(0));
        assertEq(vault.userExpires(receiptId), 0);
    }

    function test_OccupantBecomesTheUser() public {
        _buy(renter, 100e6);
        assertEq(vault.userOf(receiptId), renter);
        assertEq(vault.userExpires(receiptId), type(uint64).max);
    }

    function test_UsageMovesWithTheSlot() public {
        _buy(renter, 100e6);
        _buy(other, 120e6);
        assertEq(vault.userOf(receiptId), other, "forced sale moved the rights");
    }

    function test_ReleasingReturnsTheRightsToNobody() public {
        _buy(renter, 100e6);
        vm.prank(renter);
        slot.release();
        assertEq(vault.userOf(receiptId), address(0));
    }

    /// @dev The reason nothing is pushed. Utility hooks are called with a gas
    ///      cap and their failure is swallowed, so a stored user could desync.
    ///      Starving the hook must not affect who holds the rights.
    function test_UsageSurvivesAFailingHook() public {
        // A hook that reverts is indistinguishable from one that ran out of gas;
        // both are swallowed by `Slot._notifyUtility`.
        vm.mockCallRevert(
            address(vault),
            abi.encodeWithSelector(IUtility.onTransfer.selector),
            "hook down"
        );

        _buy(renter, 100e6);

        vm.clearMockedCalls();
        assertEq(slot.occupant(), renter, "the buy still landed");
        assertEq(vault.userOf(receiptId), renter, "rights derived, not pushed");
    }

    // ── Withdrawal is not a rug ──────────────────────────────────────────────

    function test_DepositorMayWithdrawWhileVacant() public {
        vm.prank(depositor);
        vault.withdraw(receiptId, depositor);
        assertEq(punks.ownerOf(punkId), depositor);
    }

    function test_DepositorCannotPullItFromUnderATenant() public {
        _buy(renter, 100e6);

        vm.prank(depositor);
        vm.expectRevert(SlotVault721.SlotIsOccupied.selector);
        vault.withdraw(receiptId, depositor);

        assertEq(punks.ownerOf(punkId), address(vault));
    }

    /// @dev The way back in is the protocol's own rule applied to the
    ///      depositor: buy the slot at the price its occupant declared.
    function test_DepositorReclaimsByBuyingTheSlot() public {
        _buy(renter, 100e6);

        _buy(depositor, 100e6);          // pays the occupant's declared price
        assertEq(slot.occupant(), depositor);

        vm.prank(depositor);
        vault.withdraw(receiptId, depositor);
        assertEq(punks.ownerOf(punkId), depositor);
    }

    function test_TenantCannotWithdraw() public {
        _buy(renter, 100e6);
        vm.prank(renter);
        vm.expectRevert(SlotVault721.NotReceiptOwner.selector);
        vault.withdraw(receiptId, renter);
    }

    function test_WithdrawalNeedsTheReceipt() public {
        vm.prank(other);
        vm.expectRevert(SlotVault721.NotReceiptOwner.selector);
        vault.withdraw(receiptId, other);
    }

    function test_WithdrawnReceiptIsGone() public {
        vm.prank(depositor);
        vault.withdraw(receiptId, depositor);

        assertEq(vault.userOf(receiptId), address(0));
        assertEq(vault.receiptOf(address(punks), punkId), 0);

        vm.prank(depositor);
        vm.expectRevert(SlotVault721.NoSuchReceipt.selector);
        vault.withdraw(receiptId, depositor);
    }

    function test_CanBeRedepositedAfterWithdrawal() public {
        vm.startPrank(depositor);
        vault.withdraw(receiptId, depositor);
        punks.approve(address(vault), punkId);
        uint256 second = vault.deposit(address(punks), punkId, address(slot));
        vm.stopPrank();

        assertGt(second, receiptId);
        assertEq(punks.ownerOf(punkId), address(vault));
    }

    // ── Wiring ───────────────────────────────────────────────────────────────

    function test_RejectsANonSlot() public {
        vm.startPrank(depositor);
        uint256 id = punks.mint(depositor);
        punks.approve(address(vault), id);
        vm.expectRevert(SlotVault721.NotASlot.selector);
        vault.deposit(address(punks), id, makeAddr("nothing"));
        vm.stopPrank();
    }

    /// @dev A token pushed in with `safeTransferFrom` would have no receipt and
    ///      no slot — stuck, with nobody able to claim it.
    function test_RefusesTokensPushedInDirectly() public {
        vm.startPrank(depositor);
        uint256 id = punks.mint(depositor);
        vm.expectRevert(SlotVault721.DirectTransfersNotAccepted.selector);
        punks.safeTransferFrom(depositor, address(vault), id);
        vm.stopPrank();
    }

    function test_AdvertisesItselfAsAUtility() public view {
        assertTrue(vault.supportsInterface(type(IUtility).interfaceId));
    }
}
