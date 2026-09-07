// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {MinimumTenure} from "../../src/hooks/MinimumTenure.sol";
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
        hook = new MinimumTenureHook();
        vm.warp(1_000_000);
    }

    function _slot() internal returns (Slot) {
        return _slot(bytes32(TENURE));
    }

    function _slot(bytes32 hookData) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: address(hook),
            hookData: hookData,
            taxBps: TAX,
            minDepositSeconds: 0,
            mutableTax: false,
            mutableHook: false
        }))));
    }

    function _take(Slot s, address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ─── condition 1: entry is funded ───────────────────────────────────────

    function test_EntryMustFundTheWholeWindow() public {
        Slot s = _slot();
        uint256 need = hook.requiredDeposit(100 ether, TAX, TENURE);
        assertGt(need, 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumTenure.TenureUnderfunded.selector, need)
        );
        s.buy(alice, 100 ether, need - 1, 0);

        s.buy(alice, 100 ether, need, 0); // exactly enough
        vm.stopPrank();
        assertEq(s.occupant(), alice);
    }

    /// @notice The funding requirement rounds UP.
    /// @dev Rounding down let a short window on a low price round to zero,
    ///      which made protection free and the slot claimable for nothing.
    function test_TheRequirementRoundsUpAndNeverToZero() public view {
        // A price so low the exact figure is a fraction of one unit.
        uint256 need = hook.requiredDeposit(1, TAX, TENURE);
        assertEq(need, 1, "rounds up to one, not down to zero");
    }

    // ─── condition 2: no price cut while protected ──────────────────────────

    function test_CannotCutThePriceInsideTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(MinimumTenure.PriceCutDuringTenure.selector);
        s.selfAssess(1 ether);

        // Raising is always fine — it only costs the occupant more.
        vm.prank(alice);
        s.selfAssess(200 ether);
        assertEq(s.price(), 200 ether);
    }

    function test_CanCutThePriceOnceTheWindowHasPassed() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 100 ether, 100 ether);

        vm.warp(block.timestamp + TENURE + 1);
        vm.prank(alice);
        s.selfAssess(1 ether);
        assertEq(s.price(), 1 ether);
    }

    // ─── the protection itself ──────────────────────────────────────────────

    /// @notice Inside the window an ordinary bid is refused — even a doubling.
    function test_NobodyCanBuyInsideTheWindowBelowThePremium() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.BuyoutBelowPremium.selector,
                1000 ether // 10x of alice's 100
            )
        );
        s.buy(bob, 200 ether, 100 ether, 0);
        vm.stopPrank();
    }

    /// @notice But the premium is a real door, not a painted one.
    ///
    /// @dev The window is a veto on being OUTBID, not on being bought. Alice
    ///      still gets her 100 ether — buying pays the outgoing occupant their
    ///      declared price — and bob now carries a 1000 ether valuation he owes
    ///      tax on and can himself be taken at. That is what makes it a premium
    ///      rather than a fee.
    function test_ABuyerDeclaringThePremiumTakesItInsideTheWindow() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);
        uint256 aliceBefore = token.balanceOf(alice);

        uint256 dep = hook.requiredDeposit(1000 ether, TAX, TENURE) + 100 ether;
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        s.buy(bob, 1000 ether, dep, 0);
        vm.stopPrank();

        assertEq(s.occupant(), bob, "10x carries it, mid-window");
        assertEq(s.price(), 1000 ether, "and bob is now exposed at that number");
        assertEq(
            token.balanceOf(alice) - aliceBefore,
            100 ether + hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether,
            "alice is paid her price and refunded her escrow"
        );
    }

    /// @notice One wei under the premium is still refused. The edge is exact.
    function test_ThePremiumBoundaryIsExact() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);

        uint256 dep = hook.requiredDeposit(1000 ether, TAX, TENURE) + 100 ether;
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.BuyoutBelowPremium.selector, 1000 ether
            )
        );
        s.buy(bob, 1000 ether - 1, dep, 0);
        vm.stopPrank();
    }

    function test_AnyoneCanBuyOnceItElapses() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);

        vm.warp(block.timestamp + TENURE + 1);
        _take(s, bob, hook.requiredDeposit(200 ether, TAX, TENURE) + 10 ether, 200 ether);
        assertEq(s.occupant(), bob);
    }

    function test_AVacantSlotIsAlwaysClaimable() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether, 100 ether);
        vm.prank(alice);
        s.release();

        _take(s, bob, hook.requiredDeposit(50 ether, TAX, TENURE) + 10 ether, 50 ether);
        assertEq(s.occupant(), bob, "no tenure to protect on a vacant slot");
    }

    /// @notice And the account that just vacated cannot walk straight back in
    ///         to start a fresh window.
    function test_AVacatingAccountCannotImmediatelyRetake() public {
        Slot s = _slot();
        uint256 dep = hook.requiredDeposit(100 ether, TAX, TENURE) + 10 ether;
        _take(s, alice, dep, 100 ether);

        vm.prank(alice);
        s.release();
        assertTrue(s.isVacant());

        vm.prank(alice);
        vm.expectRevert();
        s.buy(alice, 100 ether, dep, 0);

        // Somebody else may take it immediately — only the leaver is barred.
        vm.prank(bob);
        token.approve(address(s), type(uint256).max);
        vm.prank(bob);
        s.buy(bob, 100 ether, dep, 0);
        assertEq(s.occupant(), bob);
    }
    /// @notice Liquidation is never vetoable, tenure or not.
    function test_LiquidationIgnoresTheWindowEntirely() public {
        Slot s = _slot();
        _take(s, alice, hook.requiredDeposit(1 ether, TAX, TENURE) + 1, 1 ether);

        // Run the escrow dry while still inside the protection window.
        vm.warp(block.timestamp + TENURE - 1);
        if (!s.isInsolvent()) {
            vm.warp(block.timestamp + 3650 days);
        }
        assertTrue(s.isInsolvent());

        s.liquidate();
        assertTrue(s.isVacant(), "insolvency always ends a tenure");
    }

    // ─── one deployment, every window ───────────────────────────────────────

    /// @notice The headline: two slots, two windows, ONE hook contract.
    ///
    /// @dev What the CREATE2 factory used to buy, and the reason it is gone.
    ///      Under the old design these two slots needed two deployments, since
    ///      the window was an immutable and therefore part of the address.
    function test_OneHookServesTwoDifferentWindows() public {
        Slot short_ = _slot(bytes32(uint256(1 days)));
        Slot long_ = _slot(bytes32(uint256(30 days)));
        assertEq(short_.hook(), long_.hook(), "the same contract governs both");

        _take(short_, alice, hook.requiredDeposit(100 ether, TAX, 30 days) + 10 ether, 100 ether);
        _take(long_, alice, hook.requiredDeposit(100 ether, TAX, 30 days) + 10 ether, 100 ether);

        // A week in: the one-day window is long over, the thirty-day one is not.
        vm.warp(block.timestamp + 7 days);

        vm.startPrank(bob);
        token.approve(address(short_), type(uint256).max);
        token.approve(address(long_), type(uint256).max);

        uint256 need = hook.requiredDeposit(100 ether, TAX, 30 days) + 10 ether;
        short_.buy(bob, 100 ether, need, type(uint256).max);
        assertEq(short_.occupant(), bob, "one day elapsed six days ago");

        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.BuyoutBelowPremium.selector,
                1000 ether
            )
        );
        long_.buy(bob, 100 ether, need, type(uint256).max);
        vm.stopPrank();
    }

    /// @notice The funding requirement is sized from the SLOT's window, so a
    ///         longer window costs more to enter at the same price.
    function test_TheWindowSetsWhatEntryCosts() public {
        Slot short_ = _slot(bytes32(uint256(1 days)));
        uint256 cheap = hook.requiredDeposit(100 ether, TAX, 1 days);
        uint256 dear = hook.requiredDeposit(100 ether, TAX, 30 days);
        assertGt(dear, cheap);

        vm.startPrank(alice);
        token.approve(address(short_), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.TenureUnderfunded.selector, cheap
            )
        );
        short_.buy(alice, 100 ether, cheap - 1, 0);
        short_.buy(alice, 100 ether, cheap, 0);
        vm.stopPrank();
    }

    // ─── the misconfiguration that used to be unexpressible ─────────────────

    /// @notice Zero is not a short window. A slot cannot attach this hook and
    ///         leave the window unset.
    ///
    /// @dev Refused at creation, which is the only moment it is fixable. Left
    ///      to the first callback it would be a slot whose every buy reverts —
    ///      and here, where `mutableHook` is false, one that could never be
    ///      repaired.
    function test_ASlotCannotAttachThisHookWithNoWindow() public {
        vm.expectRevert(MinimumTenure.TenureNotConfigured.selector);
        _slot(bytes32(0));
    }

    /// @notice A word that was never a number is refused at the other end, and
    ///         for the same reason.
    ///
    /// @dev The characteristic mistake: `bytes32("7 days")` is left-aligned
    ///      text, roughly 1e76 seconds. Unbounded it would not fail as "too
    ///      long" — it would overflow `occupiedSince + window` inside a view the
    ///      slot cannot ignore, vetoing every buy on the slot for ever.
    function test_ASlotCannotAttachAWordThatIsNotADuration() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.TenureTooLong.selector,
                hook.MAX_TENURE()
            )
        );
        _slot(bytes32("7 days"));

        // And the boundary itself is legal.
        Slot ok = _slot(bytes32(hook.MAX_TENURE()));
        assertEq(uint256(ok.hookData()), hook.MAX_TENURE());
    }

    /// @notice And the hook says so itself, for anyone asking before they
    ///         commit.
    function test_TheHookRejectsTheEmptyConfigurationDirectly() public {
        vm.expectRevert(MinimumTenure.TenureNotConfigured.selector);
        hook.validateHookData(bytes32(0));

        hook.validateHookData(bytes32(TENURE)); // no revert
        assertEq(hook.tenureOf(bytes32(TENURE)), TENURE);
    }





    function _slotWith(address h) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: h,
            hookData: bytes32(TENURE),
            taxBps: TAX,
            minDepositSeconds: 0,
            mutableTax: false,
            mutableHook: false
        }))));
    }
}
