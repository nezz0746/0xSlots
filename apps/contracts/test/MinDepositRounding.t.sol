// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MinimumTenurePolicy} from "../src/policies/MinimumTenurePolicy.sol";

contract RoundingToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev PA-1 / PA-2 regression: the min-deposit floor and the tenure policy's
///      pre-payment both used truncating integer division, so below a threshold
///      price the requirement rounded to ZERO and a slot with a funding
///      requirement could be taken, repriced, or drained with no funding.
///
///      The threshold was in RAW UNITS, so what it was worth depended on the
///      currency's decimals — which neither contract reads. These tests pin the
///      guarantee that replaced it: "no deposit required" means
///      `minDepositSeconds == 0` and nothing else, in every currency.
contract MinDepositRoundingTest is Test {
    SlotFactory factory;
    RoundingToken token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    /// 2%/mo over 7 days truncated to zero for every price below 215 raw units.
    uint256 constant TAX_BPS = 200;
    uint256 constant RUNWAY = 7 days;
    uint256 constant THRESHOLD = 215;

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new RoundingToken();
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    function _slotWith(
        uint256 taxBps,
        uint256 minDepositSeconds,
        address policy
    ) internal returns (Slot) {
        SlotConfig memory config = SlotConfig({
            mutableTax: true, mutableUtility: false,
            mutablePolicy: false, manager: manager
        });
        SlotInitParams memory init = SlotInitParams({
            taxPercentage: taxBps,
            utility: address(0),
            liquidationBountyBps: 0,
            minDepositSeconds: minDepositSeconds,
            occupancyPolicy: policy
        });
        return Slot(factory.createSlot(recipient, IERC20(address(token)), config, init));
    }

    // ─── PA-1: the core floor ────────────────────────────────────────────

    /// Below the old threshold the floor used to vanish outright.
    function test_FloorHoldsBelowTheOldThreshold() public {
        Slot s = _slotWith(TAX_BPS, RUNWAY, address(0));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(InsufficientDeposit.selector);
        s.buy(alice, 0, THRESHOLD - 1); // 214: used to be free
        vm.stopPrank();
    }

    /// The floor is never zero, but it is not flatly "one unit" either: it is
    /// the exact requirement rounded up. At 214 the exact value is 0.9987, so
    /// the floor is 1. At 215 it is 1.0033, so the floor is 2 — the first price
    /// at which truncation would have said 1.
    function test_FloorIsTheExactRequirementRoundedUp() public {
        Slot below = _slotWith(TAX_BPS, RUNWAY, address(0));
        Slot at = _slotWith(TAX_BPS, RUNWAY, address(0));

        vm.startPrank(alice);
        token.approve(address(below), type(uint256).max);
        token.approve(address(at), type(uint256).max);

        below.buy(alice, 1, THRESHOLD - 1); // 214 → floor 1
        assertEq(below.deposit(), 1);

        vm.expectRevert(InsufficientDeposit.selector);
        at.buy(alice, 1, THRESHOLD); // 215 → floor 2, one unit no longer clears
        at.buy(alice, 2, THRESHOLD);
        assertEq(at.deposit(), 2);
        vm.stopPrank();
    }

    /// The core property: a funded slot never accepts a zero deposit, at ANY
    /// non-zero price. A vacant slot costs only the deposit, so this needs no
    /// balance — which is exactly what made the old behaviour free to exploit.
    function testFuzz_ZeroDepositNeverBuysAFundedSlot(uint256 price_) public {
        price_ = bound(price_, 1, 1e30);
        Slot s = _slotWith(TAX_BPS, RUNWAY, address(0));

        vm.prank(alice);
        vm.expectRevert(InsufficientDeposit.selector);
        s.buy(alice, 0, price_);
    }

    /// The escape hatch still works: `minDepositSeconds == 0` means no deposit,
    /// and it is now the ONLY thing that does.
    function test_ZeroMinDepositSecondsStillMeansNoDeposit() public {
        Slot s = _slotWith(TAX_BPS, 0, address(0));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 0, THRESHOLD - 1);
        vm.stopPrank();

        assertEq(s.occupant(), alice);
        assertEq(s.deposit(), 0);
    }

    /// Repricing to dust used to drop the floor to zero and free the whole
    /// escrow for withdrawal while still occupying.
    function test_WithdrawCannotEmptyALivePosition() public {
        Slot s = _slotWith(TAX_BPS, RUNWAY, address(0));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 0.01 ether, 1 ether);
        s.selfAssess(THRESHOLD - 1); // reprice to dust

        // Hoisted: `vm.expectRevert` arms the NEXT call, and an inline
        // `s.deposit()` would be it.
        uint256 everything = s.deposit();
        vm.expectRevert(InsufficientDeposit.selector);
        s.withdraw(everything);
        vm.stopPrank();

        assertGt(s.deposit(), 0, "a live occupancy keeps a funded floor");
    }

    // ─── PA-2: the same truncation in MinimumTenurePolicy ────────────────

    /// Isolated with `minDepositSeconds == 0`, so the policy's pre-payment is
    /// the only funding requirement in play.
    function test_TenurePolicyRequiresPrePaymentAtDustPrices() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(RUNWAY);
        Slot s = _slotWith(TAX_BPS, 0, address(p));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumTenurePolicy.TenureUnderfunded.selector, 1)
        );
        s.buy(alice, 0, THRESHOLD - 1);
        vm.stopPrank();
    }

    /// Without this the window itself became the weapon: a zero-funded buyer
    /// took the slot and tenure protection locked everyone else out of it.
    function test_TenureWindowCannotBeClaimedForFree() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(RUNWAY);
        Slot s = _slotWith(TAX_BPS, 0, address(p));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1, THRESHOLD - 1); // now costs at least a unit
        vm.stopPrank();

        assertEq(s.occupant(), alice);
        assertEq(s.deposit(), 1, "the window was paid for, however little");
    }

    // ─── Why the fix deliberately stops at the floors ────────────────────

    /// `_accrue` still truncates, and that is on purpose. `topUp(0)` is
    /// permissionless and has no zero-amount guard, so anyone can force a
    /// settle for the price of gas. Rounding accrual UP the way the floors now
    /// round would let an attacker charge the occupant a unit they do not owe
    /// on every one of those calls. If a future sweep "completes the pattern"
    /// here, this test is the reason not to.
    function test_AccrualStaysTruncating_becauseSettlesAreFreeToForce() public {
        Slot s = _slotWith(TAX_BPS, RUNWAY, address(0));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 0.01 ether, 1 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 1);
        uint256 settledBefore = s.lastSettled();

        vm.prank(makeAddr("stranger"));
        s.topUp(0); // a stranger, paying nothing, forcing an accrual

        assertEq(s.lastSettled(), block.timestamp, "settle is free to force");
        assertGt(s.lastSettled(), settledBefore);
    }
}
