// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, HookFlags, SlotContext} from "../../src/ISlotHook.sol";
import "../../src/SlotErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/**
 * @dev Reverts in `afterSettle` and declares `strict`, so the revert is NOT
 *      swallowed by the slot's stipend — it propagates out of `collect()`.
 *      That is the one way a healthy-looking slot can fail a collection, and
 *      the case the batch has to survive.
 */
contract StrictBreaker is ISlotHook {
    function validateHookData(bytes32) external pure {}
    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterSettle = true;
        f.strict = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external pure { revert("nope"); }
}

/**
 * @notice `SlotFactory.collectAll` — the batch, and what it refuses to let one
 *         slot do to the rest of it.
 *
 * @dev The interesting assertions are not that collection works; `collect()`
 *      is tested elsewhere. They are that the RETURNED AMOUNTS are the amounts
 *      that actually moved — the previous generation's batch collector read
 *      `collectedTax()` after the flush had zeroed it, and reported zero for
 *      every collection that succeeded — and that a slot which reverts leaves
 *      the others paid.
 */
contract CollectAllTest is Test {
    SlotFactory factory;
    Tok token;

    address alice = makeAddr("alice");
    address recipientA = makeAddr("recipientA");
    address recipientB = makeAddr("recipientB");

    uint256 constant TAX = 1000;      // 10% / 30 days
    uint256 constant MIN_DEP = 1 days;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Tok();
        token.mint(alice, 1_000_000 ether);
        vm.warp(1_000_000);
    }

    function _slot(address recipient_, address hook) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: recipient_,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: hook,
            hookData: bytes32(0),
            taxBps: TAX,
            minDepositSeconds: MIN_DEP,
            mutableTax: false,
            mutableHook: false
        }))));
    }

    function _take(Slot s, uint256 price) internal {
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, price, 10 ether, 0);
        vm.stopPrank();
    }

    // ─── the happy path, and the amounts ────────────────────────────────────

    /// @notice One transaction pays every recipient, and says what each got.
    function test_CollectsFromEverySlotAndReportsWhatMoved() public {
        Slot a = _slot(recipientA, address(0));
        Slot b = _slot(recipientB, address(0));
        _take(a, 1 ether);
        _take(b, 4 ether);

        vm.warp(block.timestamp + 10 days);

        address[] memory slots = new address[](2);
        slots[0] = address(a);
        slots[1] = address(b);

        uint256[] memory collected = factory.collectAll(slots);

        // The returned figure IS the payment. This is the assertion the old
        // batch collector would have failed: it read the counter after the
        // flush had zeroed it and reported nothing for a transfer that happened.
        assertGt(collected[0], 0, "a collected something");
        assertEq(token.balanceOf(recipientA), collected[0], "and it is what a paid");
        assertEq(token.balanceOf(recipientB), collected[1], "and what b paid");

        // Four times the price at the same rate for the same time. Within a
        // few wei: `taxFor` floors, so four times a floored figure is not the
        // floor of four times it.
        assertApproxEqAbs(collected[1], collected[0] * 4, 4, "proportional to the valuation");
    }

    /**
     * @notice Collecting a slot that owes nothing is a zero, not a failure.
     *
     * @dev Two passes, not one, and the reason is a real property of settlement
     *      rather than test scaffolding. `_settle` advances `lastSettled` only
     *      over the seconds it was actually PAID for, and `secondsFor` floors —
     *      so when the per-second rate is not a whole number of wei the clock
     *      can land one second short of now, and an immediate second collection
     *      legitimately takes that second's tax. It converges: by the third
     *      pass there is nothing left, `collect()` reverts `NothingToCollect`,
     *      and the batch has to report that as zero rather than fail.
     */
    function test_ASlotWithNothingOwedReportsZeroWithoutFailing() public {
        Slot a = _slot(recipientA, address(0));
        _take(a, 1 ether);
        vm.warp(block.timestamp + 10 days);

        address[] memory slots = new address[](1);
        slots[0] = address(a);

        uint256 first = factory.collectAll(slots)[0];
        assertGt(first, 0);

        // At most the one second the flooring can leave behind.
        uint256 second = factory.collectAll(slots)[0];
        assertLe(second, 38_580_246_914, "no more than a second of residue");

        assertEq(factory.collectAll(slots)[0], 0, "and then nothing at all");
        assertEq(
            token.balanceOf(recipientA),
            first + second,
            "the recipient has exactly what was reported"
        );
    }

    /**
     * @notice An insolvent slot pays what it has, and reports what it paid.
     *
     * @dev The case that made the first version of `collectFrom` wrong. It
     *      added the raw `taxOwed()`, which for a slot whose debt has outrun
     *      its escrow is larger than anything `_settle` will hand over — the
     *      excess is carried as arrears against the occupant, not paid to the
     *      recipient. So the batch reported a payment that never happened, on
     *      precisely the slots a sweep exists to find.
     */
    function test_AnInsolventSlotReportsOnlyWhatItCouldPay() public {
        Slot a = _slot(recipientA, address(0));
        _take(a, 1 ether);

        // Far past the point the escrow can cover.
        vm.warp(block.timestamp + 3650 days);
        assertTrue(a.isInsolvent(), "the premise");
        assertGt(a.taxOwed(), a.deposit(), "the debt has outrun the escrow");

        address[] memory slots = new address[](1);
        slots[0] = address(a);

        uint256 before = token.balanceOf(recipientA);
        uint256 reported = factory.collectAll(slots)[0];

        assertEq(
            token.balanceOf(recipientA) - before,
            reported,
            "reported exactly what moved, not the uncollectable debt"
        );
    }

    // ─── isolation ──────────────────────────────────────────────────────────

    /**
     * @notice A slot that reverts must not cost the others their rent.
     *
     * @dev `strict` is what makes this reachable: without it the slot caps the
     *      hook's gas and swallows the revert, so `collect()` succeeds anyway.
     *      With it, the hook's revert comes all the way out of `collect()`.
     */
    function test_OneRevertingSlotDoesNotSinkTheBatch() public {
        Slot broken = _slot(recipientA, address(new StrictBreaker()));
        Slot fine = _slot(recipientB, address(0));
        _take(broken, 1 ether);
        _take(fine, 1 ether);

        vm.warp(block.timestamp + 10 days);

        // It really does revert on its own.
        vm.expectRevert();
        broken.collect();

        address[] memory slots = new address[](2);
        slots[0] = address(broken);
        slots[1] = address(fine);

        uint256[] memory collected = factory.collectAll(slots);

        assertEq(collected[0], 0, "the broken one reports nothing");
        assertEq(token.balanceOf(recipientA), 0, "and paid nothing");
        assertGt(collected[1], 0, "the healthy one was still collected");
        assertEq(token.balanceOf(recipientB), collected[1], "and was paid");
    }

    /// @notice An address this factory never created is skipped, not fatal.
    function test_AForeignAddressIsSkipped() public {
        Slot a = _slot(recipientA, address(0));
        _take(a, 1 ether);
        vm.warp(block.timestamp + 10 days);

        address[] memory slots = new address[](3);
        slots[0] = makeAddr("not a slot");
        slots[1] = address(a);
        slots[2] = address(token); // a real contract, just not one of ours

        uint256[] memory collected = factory.collectAll(slots);

        assertEq(collected[0], 0);
        assertGt(collected[1], 0, "the real slot between them still collected");
        assertEq(collected[2], 0);
    }

    /// @notice Called on its own, the single-slot form says why it refused.
    function test_CollectFromRejectsAnAddressTheFactoryDidNotCreate() public {
        vm.expectRevert(NotASlot.selector);
        factory.collectFrom(makeAddr("stranger"));
    }

    /// @notice An empty batch is a no-op rather than a revert.
    function test_AnEmptyBatchDoesNothing() public {
        assertEq(factory.collectAll(new address[](0)).length, 0);
    }

    /// @notice Anyone may call it — the money still goes where it was owed.
    function test_AnyoneMayCollectAndTheMoneyGoesToTheRecipient() public {
        Slot a = _slot(recipientA, address(0));
        _take(a, 1 ether);
        vm.warp(block.timestamp + 10 days);

        address[] memory slots = new address[](1);
        slots[0] = address(a);

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        uint256[] memory collected = factory.collectAll(slots);

        assertGt(collected[0], 0);
        assertEq(token.balanceOf(stranger), 0, "the caller takes nothing");
        assertEq(token.balanceOf(recipientA), collected[0], "the recipient takes it all");
    }

    /// @dev The doc says to bump it with any change to this contract.
    ///      4 is the move from CREATE to CREATE2 in `createSlot`.
    function test_TheFactoryVersionWasBumped() public view {
        assertEq(factory.version(), 4);
    }
}
