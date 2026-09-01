// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotOrders, SellOrder} from "../../src/SlotOrders.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import "../../src/SlotErrors.sol";

contract T is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract MinimumTenureHookTest is Test {
    SlotFactory factory;
    T token;
    MinimumTenureHook hook;

    uint256 constant TENURE = 7 days;
    uint256 constant TAX = 1000; // 10% / month

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob;
    uint256 bobKey;

    function setUp() public {
        (bob, bobKey) = makeAddrAndKey("bob");
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));
        token = new T();
        token.mint(alice, 1_000_000 ether);
        token.mint(bob, 1_000_000 ether);
        hook = new MinimumTenureHook(TENURE, "");
        vm.warp(1_000_000);
    }

    function _slot() internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: address(hook),
            taxPercentage: TAX,
            minDepositSeconds: 0,
            mutableTax: false,
            mutableHook: false
        }))));
    }

    function _take(Slot s, address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, dep, price, 0);
        vm.stopPrank();
    }

    // ─── condition 1: entry is funded ───────────────────────────────────────

    function test_EntryMustFundTheWholeWindow() public {
        Slot s = _slot();
        uint256 need = hook.requiredDeposit(100 ether, TAX);
        assertGt(need, 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumTenureHook.TenureUnderfunded.selector, need)
        );
        s.buy(alice, need - 1, 100 ether, 0);

        s.buy(alice, need, 100 ether, 0); // exactly enough
        vm.stopPrank();
        assertEq(s.occupant(), alice);
    }

    /// @notice The funding requirement rounds UP.
    /// @dev Rounding down let a short window on a low price round to zero,
    ///      which made protection free and the slot claimable for nothing.
    function test_TheRequirementRoundsUpAndNeverToZero() public view {
        // A price so low the exact figure is a fraction of one unit.
        uint256 need = hook.requiredDeposit(1, TAX);
        assertEq(need, 1, "rounds up to one, not down to zero");
    }

    // ─── condition 2: no price cut while protected ──────────────────────────

    function test_CannotCutThePriceInsideTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(MinimumTenureHook.PriceCutDuringTenure.selector);
        s.selfAssess(1 ether);

        // Raising is always fine — it only costs the occupant more.
        vm.prank(alice);
        s.selfAssess(200 ether);
        assertEq(s.price(), 200 ether);
    }

    function test_CanCutThePriceOnceTheWindowHasPassed() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 100 ether, 100 ether);

        vm.warp(block.timestamp + TENURE + 1);
        vm.prank(alice);
        s.selfAssess(1 ether);
        assertEq(s.price(), 1 ether);
    }

    // ─── the protection itself ──────────────────────────────────────────────

    function test_NobodyCanBuyInsideTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenureHook.TenureNotElapsed.selector,
                block.timestamp + TENURE
            )
        );
        s.buy(bob, 100 ether, 200 ether, 0);
        vm.stopPrank();
    }

    function test_AnyoneCanBuyOnceItElapses() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.warp(block.timestamp + TENURE + 1);
        _take(s, bob, hook.requiredDeposit(200 ether, TAX) + 10 ether, 200 ether);
        assertEq(s.occupant(), bob);
    }

    function test_AVacantSlotIsAlwaysClaimable() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);
        vm.prank(alice);
        s.release();

        _take(s, bob, hook.requiredDeposit(50 ether, TAX) + 10 ether, 50 ether);
        assertEq(s.occupant(), bob, "no tenure to protect on a vacant slot");
    }

    /// @notice Protection is a shield, not a cage.
    /// @dev The policy this replaces shared `checkBuy` with `sell`, so an
    ///      occupant could not sell their own slot during their own window.
    ///      The window exists to stop the slot being taken FROM them; there is
    ///      nobody to protect when they are the one handing it over.
    function test_TheOccupantMayStillSellInsideTheirOwnWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        // At or above the sitting price: the window protects the occupant
        // FROM the market, and there is nobody to protect when they are the
        // one handing it over.
        uint256 dep = hook.requiredDeposit(120 ether, TAX) + 5 ether;
        SellOrder memory o = SellOrder({
            slot: address(s), buyer: bob, price: 120 ether, deposit: dep,
            nonce: s.orderNonce(bob), deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(bobKey, s.sellOrderHash(o));

        vm.prank(alice);
        s.sell(o, abi.encodePacked(r, ss, v)); // well inside alice's window

        assertEq(s.occupant(), bob, "a voluntary sale is not blocked");
    }

    /// @notice But a sale may not do what `selfAssess` is forbidden from
    ///         doing. Selling to an address you control at a dust price was
    ///         the way to restart the window for nothing: the tax on 1 wei
    ///         floors to zero, so the slot left forced sale entirely.
    function test_ASaleCannotCutThePriceInsideTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        uint256 dep = hook.requiredDeposit(100 ether, TAX) + 5 ether;
        SellOrder memory o = SellOrder({
            slot: address(s), buyer: bob, price: 1, deposit: dep,
            nonce: s.orderNonce(bob), deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(bobKey, s.sellOrderHash(o));

        vm.prank(alice);
        vm.expectRevert(MinimumTenureHook.PriceCutDuringTenure.selector);
        s.sell(o, abi.encodePacked(r, ss, v));

        assertEq(s.occupant(), alice, "the dust self-deal is refused");
    }

    /// @notice And the account that just vacated cannot walk straight back in
    ///         to start a fresh window.
    function test_AVacatingAccountCannotImmediatelyRetake() public {
        Slot s = _slot();
        uint256 dep = hook.requiredDeposit(100 ether, TAX) + 10 ether;
        _take(s, alice, dep, 100 ether);

        vm.prank(alice);
        s.release();
        assertTrue(s.isVacant());

        vm.prank(alice);
        vm.expectRevert();
        s.buy(alice, dep, 100 ether, 0);

        // Somebody else may take it immediately — only the leaver is barred.
        vm.prank(bob);
        token.approve(address(s), type(uint256).max);
        vm.prank(bob);
        s.buy(bob, dep, 100 ether, 0);
        assertEq(s.occupant(), bob);
    }

    /// @notice ...but a sale cannot seat someone underfunded.
    function test_ASaleStillHasToFundTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX) + 10 ether, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        SellOrder memory o = SellOrder({
            slot: address(s), buyer: bob, price: 70 ether, deposit: 0,
            nonce: s.orderNonce(bob), deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(bobKey, s.sellOrderHash(o));

        vm.prank(alice);
        vm.expectRevert();
        s.sell(o, abi.encodePacked(r, ss, v));
    }

    /// @notice Liquidation is never vetoable, tenure or not.
    function test_LiquidationIgnoresTheWindowEntirely() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(1 ether, TAX) + 1, 1 ether);

        // Run the escrow dry while still inside the protection window.
        vm.warp(block.timestamp + TENURE - 1);
        if (!s.isInsolvent()) {
            vm.warp(block.timestamp + 3650 days);
        }
        assertTrue(s.isInsolvent());

        s.liquidate();
        assertTrue(s.isVacant(), "insolvency always ends a tenure");
    }
}
