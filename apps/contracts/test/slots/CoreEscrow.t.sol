// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, HookTerms, HookOffer} from "../../src/types/SlotTypes.sol";

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, HookPermissions, SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../../src/libraries/HookPermissionsLib.sol";
import {SlotMath} from "../../src/libraries/SlotMath.sol";
import "../../src/errors/SlotErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev Burns 1% of every transfer.
contract Cut is ERC20 {
    constructor() ERC20("C", "C") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// @dev Refuses native ETH, so a push to it must degrade into a credit.
contract Deaf {
    receive() external payable { revert("no"); }
}

/// @dev Subscribes to `afterBuy` and always reverts there. The slot must
///      swallow it and say so.
contract BrokenAfter is ISlotHook {
    function validateHookConfig(bytes32) external pure {}
    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        HookPermissions memory f;
        f.afterBuy = true;
        o.permissions = HookPermissionsLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external pure { revert("nope"); }
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata) external {}
}

/**
 * @notice The escrow surface, and the guards nothing was asserting.
 *
 * @dev Written because an audit found `withdraw` and `claim` were never called
 *      by ANY test — `SlotEscrow` sat at 8.33% branch coverage — while
 *      `withdraw`'s deposit floor is the thing a minimum-tenure hook explicitly
 *      leans on to bound how far an occupant can drain their own escrow. The
 *      debt carry-forward had no test either, and it is what stops running a
 *      deposit dry being the cheapest way to hold a slot.
 */
contract CoreEscrowTest is Test {
    SlotFactory factory;
    Tok token;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address recipient = makeAddr("recipient");

    uint256 constant TAX_RATE = 1000;      // 10% / 30 days
    uint256 constant MIN_DEP = 1 days;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Tok();
        token.mint(alice, 1_000_000 ether);
        token.mint(bob, 1_000_000 ether);
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.warp(1_000_000);
    }

    function _slot(address currency) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(currency),
            manager: address(0),
            mutableTax: false, mutableRecipient: false, mutableHook: false,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(MIN_DEP)}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));
    }

    /// @dev No deposit floor, so an occupant can be seated on an empty escrow —
    ///      the state the debt-grind regression below turns on.
    function _slotNoFloor(address currency) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(currency),
            manager: address(0),
            mutableTax: false, mutableRecipient: false, mutableHook: false,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(0)}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));
    }

    function _take(Slot s, address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ─── withdraw: the floor a hook leans on ────────────────────────────────

    /// @notice You may take escrow back, but never below `minRunwaySeconds`.
    function test_WithdrawKeepsTheMinimumFunded() public {
        Slot s = _slot(address(token));
        uint256 floor_ = SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP);
        _take(s, alice, floor_ + 5 ether, 1 ether);

        // One wei past the floor is refused.
        vm.prank(alice);
        vm.expectRevert(InvalidDeposit.selector);
        s.withdraw(5 ether + 1);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        s.withdraw(5 ether);
        assertEq(token.balanceOf(alice) - before, 5 ether, "paid out");
        assertEq(s.deposit(), floor_, "left exactly at the floor");
    }

    /// @notice Withdrawing nothing, or more than is there, is refused.
    function test_WithdrawRejectsZeroAndOverdraw() public {
        Slot s = _slot(address(token));
        _take(s, alice, 10 ether, 1 ether);

        vm.prank(alice);
        vm.expectRevert(NothingToWithdraw.selector);
        s.withdraw(0);

        // Hoisted: `deposit()` is itself a call and would consume both the
        // prank and the expectRevert before `withdraw` ever ran.
        uint256 tooMuch = s.deposit() + 1;
        vm.prank(alice);
        vm.expectRevert(NothingToWithdraw.selector);
        s.withdraw(tooMuch);
    }

    /// @notice Only the occupant may withdraw.
    function test_WithdrawIsOccupantOnly() public {
        Slot s = _slot(address(token));
        _take(s, alice, 10 ether, 1 ether);

        vm.prank(bob);
        vm.expectRevert(NotOccupant.selector);
        s.withdraw(1);
    }

    /// @notice `withdraw` settles first, so it cannot hand back tax already owed.
    function test_WithdrawSettlesBeforeMeasuring() public {
        Slot s = _slot(address(token));
        _take(s, alice, 100 ether, 10 ether);
        uint256 seated = s.deposit();

        vm.warp(block.timestamp + 15 days);
        uint256 owed = s.taxOwed();
        assertGt(owed, 0, "tax has accrued");

        vm.prank(alice);
        s.withdraw(1 ether);
        assertEq(
            s.deposit(),
            seated - owed - 1 ether,
            "the accrual came off before the withdrawal did"
        );
    }

    // ─── claim: the payout that could not be pushed ─────────────────────────

    /// @notice A native payout to an address that refuses ETH becomes a credit,
    ///         and `claim` is how it is collected.
    /// @dev The whole reason `_payOrCredit` never reverts: a counterparty who
    ///      cannot receive must not be able to make themselves un-evictable.
    function test_ARefusedPayoutBecomesAClaimableCredit() public {
        Slot s = _slot(address(0));
        Deaf deaf = new Deaf();
        vm.deal(address(deaf), 10 ether);

        uint256 need = s.minDepositForBuy(1 ether);
        vm.prank(address(deaf));
        s.buy{value: need}(address(deaf), 1 ether, need, 0);

        // Bob buys it out. The seller cannot receive, so it is credited.
        uint256 bobDep = s.minDepositForBuy(2 ether);
        uint256 pay = s.quoteBuy(bob, bobDep);
        vm.prank(bob);
        s.buy{value: pay}(bob, 2 ether, bobDep, type(uint256).max);

        uint256 owedToDeaf = s.withdrawableOf(address(deaf));
        assertGt(owedToDeaf, 0, "the push failed and became a credit");

        // Anyone may claim on their behalf; the funds go to the account.
        uint256 before = address(deaf).balance;
        vm.prank(bob);
        vm.expectRevert(TransferFailed.selector); // it still refuses ETH
        s.claim(address(deaf));
        assertEq(address(deaf).balance, before, "nothing moved");
        assertEq(s.withdrawableOf(address(deaf)), owedToDeaf, "credit intact");
    }

    /// @notice Claiming nothing is refused rather than silently succeeding.
    function test_ClaimRejectsAnEmptyCredit() public {
        Slot s = _slot(address(token));
        vm.expectRevert(NothingToClaim.selector);
        s.claim(alice);
    }

    /// @notice Accrued tax reaches the recipient, and anyone may push it.
    function test_CollectPushesTaxToTheRecipient() public {
        Slot s = _slot(address(token));
        _take(s, alice, 10 ether, 1 ether);

        vm.warp(block.timestamp + 10 days);
        uint256 before = token.balanceOf(recipient);
        vm.prank(bob); // not the occupant, not the recipient
        s.collect();
        assertGt(token.balanceOf(recipient) - before, 0, "tax reached them");
    }

    /// @notice Collecting from a slot that has accrued nothing is refused.
    /// @dev On a fresh slot rather than straight after a `collect`: block time
    ///      advances between calls, so a just-collected slot has already
    ///      accrued its next wei by the time you ask again.
    function test_CollectOnASlotThatOwesNothingIsRefused() public {
        Slot s = _slot(address(token));
        vm.expectRevert(NothingToCollect.selector);
        s.collect();
    }

    // ─── debt: defaulting must not be cheap ─────────────────────────────────

    /**
     * @notice Tax that outran the deposit follows the ACCOUNT, not the seat.
     *
     * @dev Without this, running a deposit dry and retaking the vacated slot
     *      costs less than staying — which makes default the dominant strategy.
     */
    function test_DebtFollowsTheAccountAcrossTenures() public {
        Slot s = _slot(address(token));
        _take(s, alice, SlotMath.depositFor(100 ether, TAX_RATE, MIN_DEP), 100 ether);

        // Run her dry, well past what the escrow covers.
        vm.warp(block.timestamp + 90 days);
        s.liquidate();
        assertTrue(s.isVacant());

        uint256 debt = s.debtOf(alice);
        assertGt(debt, 0, "unpaid tax was recorded against her");

        // Retaking costs the debt on top of the deposit.
        uint256 dep = SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP);
        uint256 quoted = s.quoteBuy(alice, dep);
        assertEq(quoted, dep + debt, "the quote carries the debt");

        uint256 spent = token.balanceOf(alice);
        _take(s, alice, dep, 1 ether);
        assertEq(spent - token.balanceOf(alice), dep + debt, "and she paid it");
        assertEq(s.debtOf(alice), 0, "settled");
    }

    /// @notice Somebody else's debt is not charged to a new buyer.
    function test_DebtIsNotInheritedWithTheSeat() public {
        Slot s = _slot(address(token));
        _take(s, alice, SlotMath.depositFor(100 ether, TAX_RATE, MIN_DEP), 100 ether);
        vm.warp(block.timestamp + 90 days);
        s.liquidate();
        assertGt(s.debtOf(alice), 0);

        uint256 dep = SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP);
        assertEq(s.quoteBuy(bob, dep), dep, "bob owes only his own deposit");
        assertEq(s.debtOf(bob), 0);
    }

    /// @dev Alice seated at `price` with `dep`, then run past her escrow without
    ///      anyone settling, so the next settle records a debt.
    function _insolvent(uint256 price) internal returns (Slot s, uint256 debt) {
        s = _slot(address(token));
        _take(s, alice, SlotMath.depositFor(price, TAX_RATE, MIN_DEP), price);
        vm.warp(block.timestamp + 10 days);
        debt = s.taxOwed() - s.deposit();
        assertGt(debt, 0);
    }

    /// @notice Debt repaid at a buyout is paid out under the terms it was owed
    ///         under, not the ones the buyout brings in.
    function test_DebtRepaidAtATransitionGoesToTheOutgoingRecipient() public {
        address next = makeAddr("nextRecipient");
        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(token)),
            manager: address(this),
            mutableTax: false, mutableRecipient: true, mutableHook: false,
            taxTerms: TaxTerms({recipient: recipient, rateBps: uint16(TAX_RATE), minRunwaySeconds: uint32(MIN_DEP)}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));
        _take(s, alice, SlotMath.depositFor(100 ether, TAX_RATE, MIN_DEP), 100 ether);

        TaxTerms memory t;
        t.recipient = next;
        s.proposeTerms(t, HookTerms({target: address(0), config: bytes32(0)}), 2);
        vm.warp(block.timestamp + 10 days);

        uint256 owed = s.taxOwed();
        assertGt(owed, s.deposit(), "alice is insolvent");

        _take(s, bob, SlotMath.depositFor(100 ether, TAX_RATE, MIN_DEP), 100 ether);

        assertEq(s.recipient(), next, "the recipient changed at the buyout");
        assertEq(token.balanceOf(recipient), owed, "all of alice's tax, debt included, went to the old recipient");
        assertEq(token.balanceOf(next), 0);
    }

    /// @notice An insolvent occupant who is bought out pays their debt out of
    ///         the price, instead of walking away with all of it.
    function test_ABuyoutPaysTheSellersDebtFirst() public {
        (Slot s, uint256 debt) = _insolvent(100 ether);
        assertLt(debt, 100 ether);

        uint256 before = token.balanceOf(alice);
        _take(s, bob, SlotMath.depositFor(100 ether, TAX_RATE, MIN_DEP), 100 ether);

        assertEq(token.balanceOf(alice) - before, 100 ether - debt, "the price, less her debt");
        assertEq(s.debtOf(alice), 0, "settled");

        uint256 got = token.balanceOf(recipient);
        s.collect();
        assertGt(token.balanceOf(recipient) - got, debt, "and the recipient received it with the tax");
    }

    /// @notice A debt larger than the price keeps what the price did not cover.
    function test_ABuyoutSmallerThanTheDebtPaysWhatItCan() public {
        (Slot s, uint256 debt) = _insolvent(100 ether);
        vm.warp(block.timestamp + 3650 days);
        debt = s.taxOwed() - s.deposit();
        assertGt(debt, 100 ether);

        uint256 before = token.balanceOf(alice);
        _take(s, bob, SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP), 1 ether);

        assertEq(token.balanceOf(alice), before, "nothing left for her");
        assertEq(s.debtOf(alice), debt - 100 ether, "the rest still follows her");
    }

    /// @notice Topping up an empty escrow pays the debt before it funds the
    ///         seat, so a defaulter cannot buy back solvency for less.
    function test_ATopUpPaysDebtBeforeTheDeposit() public {
        (Slot s, uint256 debt) = _insolvent(100 ether);

        vm.prank(alice);
        s.topUp(debt + 5 ether);

        assertEq(s.debtOf(alice), 0);
        assertEq(s.deposit(), 5 ether, "only what is left over funds the seat");
    }

    /// @notice A top-up that does not cover the debt leaves the occupant
    ///         liquidatable.
    function test_ATopUpBelowTheDebtLeavesThemLiquidatable() public {
        (Slot s, uint256 debt) = _insolvent(100 ether);

        vm.prank(alice);
        s.topUp(debt / 2);

        assertEq(s.deposit(), 0);
        assertEq(s.debtOf(alice), debt - debt / 2);
        s.liquidate();
        assertTrue(s.isVacant());
    }

    /// @notice Settling every block charges what settling once does.
    /// @dev REGRESSION. `secondsFor` rounded the clock advance DOWN, so each
    ///      settle left a paid second on the clock to charge again. At a rate
    ///      of several wei per second, a settle per block overcharged by half.
    function test_SettlingEveryBlockChargesWhatSettlingOnceDoes() public {
        uint256 price = 1 ether;
        assertGt(SlotMath.taxFor(price, TAX_RATE, 1), 1, "several wei per second");
        uint256 dep = SlotMath.depositFor(price, TAX_RATE, 30 days);

        Slot ground = _slot(address(token));
        Slot honest = _slot(address(token));
        _take(ground, alice, dep, price);
        _take(honest, alice, dep, price);

        uint256 t = vm.getBlockTimestamp();
        uint256 calls = 1800;
        for (uint256 i = 0; i < calls; i++) {
            t += 2;
            vm.warp(t);
            vm.prank(bob);
            ground.topUp(0);
        }
        vm.prank(bob);
        honest.topUp(0);

        uint256 once = honest.collectedTax();
        uint256 grind = ground.collectedTax();
        assertLe(grind, once, "never more than settling once");
        assertGe(grind + calls, once, "short by under a wei per settle");
        assertEq(ground.lastSettled(), honest.lastSettled(), "and the clocks agree");
    }

    /// @notice A currency that takes a cut on transfer is refused, so no escrow
    ///         is ever credited with more than the slot received.
    function test_ACurrencyThatTakesACutIsRefused() public {
        Cut cut = new Cut();
        cut.mint(alice, 1_000 ether);
        Slot s = _slot(address(cut));
        uint256 dep = SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP);

        vm.startPrank(alice);
        cut.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(CurrencyTakesACut.selector, dep, dep - dep / 100));
        s.buy(alice, 1 ether, dep, 0);
        vm.stopPrank();
    }

    /**
     * @notice A settle that accrues nothing must not advance the clock, even
     *         when the escrow is empty.
     *
     * @dev REGRESSION. `owed >= _deposit` is true at `0 >= 0`, so once a deposit
     *      reached zero EVERY window took the insolvent branch — which set
     *      `lastSettled` to now unconditionally, discarding the window instead
     *      of carrying it. `topUp(0)` is a free, permissionless settle, so at a
     *      price low enough that one second floors to zero tax anyone could
     *      grind the clock forward a second at a time and the debt never
     *      accrued at all.
     *
     *      The price below is chosen so ONE second accrues zero while the whole
     *      window accrues something. That gap is the entire bug: without it,
     *      grinding and sitting still are indistinguishable.
     */
    function test_GrindingAnEmptyEscrowCannotEraseDebt() public {
        uint256 price = 1_000_000;
        assertEq(SlotMath.taxFor(price, TAX_RATE, 1), 0, "one second accrues nothing");
        assertGt(SlotMath.taxFor(price, TAX_RATE, 200), 0, "the whole window does");

        Slot ground = _slotNoFloor(address(token));
        Slot honest = _slotNoFloor(address(token));
        _take(ground, alice, 0, price);
        _take(honest, alice, 0, price);

        uint256 t = vm.getBlockTimestamp();
        for (uint256 i = 0; i < 200; i++) {
            t += 1;
            vm.warp(t);
            vm.prank(bob);
            ground.topUp(0);
        }

        vm.prank(bob);
        honest.topUp(0); // the same 200 seconds, settled once

        assertGt(honest.debtOf(alice), 0, "sitting still owes something");
        assertEq(
            ground.debtOf(alice),
            honest.debtOf(alice),
            "grinding the clock costs what sitting still costs"
        );
    }

    /// @notice The same grind against a FUNDED escrow — the branch that already
    ///         defended itself by converting `paid` back into seconds.
    function test_GrindingAFundedEscrowCollectsTheSameTax() public {
        uint256 price = 1_000_000;

        Slot ground = _slotNoFloor(address(token));
        Slot honest = _slotNoFloor(address(token));
        _take(ground, alice, 1 ether, price);
        _take(honest, alice, 1 ether, price);

        uint256 t = vm.getBlockTimestamp();
        for (uint256 i = 0; i < 200; i++) {
            t += 1;
            vm.warp(t);
            vm.prank(bob);
            ground.topUp(0);
        }

        vm.prank(bob);
        honest.topUp(0);

        assertGt(honest.collectedTax(), 0, "the window is taxable");
        assertEq(
            ground.collectedTax(),
            honest.collectedTax(),
            "grinding collects the same tax"
        );
    }

    // ─── the guards nothing was asserting ───────────────────────────────────

    function test_APriceMoveAboveMaxPaymentIsRefused() public {
        Slot s = _slot(address(token));
        _take(s, alice, 10 ether, 5 ether);

        // Funded for the price bob DECLARES — `_requireFunded` runs before the
        // payment cap, so an underfunded buy would revert for the wrong reason.
        uint256 dep = SlotMath.depositFor(6 ether, TAX_RATE, MIN_DEP);
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        // Alice's asking price is 5 ether; bob will not pay more than 1.
        vm.expectRevert(PaymentAboveMax.selector);
        s.buy(bob, 6 ether, dep, 1 ether);
        vm.stopPrank();
    }

    function test_YouCannotBuyFromYourself() public {
        Slot s = _slot(address(token));
        _take(s, alice, 10 ether, 1 ether);

        vm.startPrank(alice);
        vm.expectRevert(CannotBuyFromYourself.selector);
        s.buy(alice, 2 ether, 1 ether, type(uint256).max);
        vm.stopPrank();
    }

    function test_ASolventOccupantCannotBeLiquidated() public {
        Slot s = _slot(address(token));
        _take(s, alice, 100 ether, 1 ether);

        vm.expectRevert(NotInsolvent.selector);
        s.liquidate();
    }

    function test_AVacantSlotCannotBeLiquidated() public {
        Slot s = _slot(address(token));
        vm.expectRevert(Vacant.selector);
        s.liquidate();
    }
    /// @notice Native value sent to a slot outside `buy`/`deposit` is refused.
    function test_TheSlotRefusesStrayEther() public {
        Slot s = _slot(address(0));
        vm.prank(alice);
        (bool ok, ) = address(s).call{value: 1 ether}("");
        assertFalse(ok, "a bare transfer must not fund anything");
    }

    // ─── the initialisations the slot refuses ───────────────────────────────

    function _init() internal view returns (SlotInit memory i) {
        i.taxTerms.recipient = recipient;
        i.currency = IERC20(address(token));
        i.taxTerms.rateBps = uint16(TAX_RATE);
        i.taxTerms.minRunwaySeconds = uint32(MIN_DEP);
    }

    function test_AZeroTaxSlotIsRefused() public {
        SlotInit memory i = _init();
        i.taxTerms.rateBps = uint16(0);
        vm.expectRevert(InvalidTax.selector);
        factory.createSlot(i);
    }

    function test_ATaxAboveTheCeilingIsRefused() public {
        SlotInit memory i = _init();
        i.taxTerms.rateBps = uint16(10_001);
        vm.expectRevert(InvalidTax.selector);
        factory.createSlot(i);
    }

    /// @dev An EOA as the currency would make every `transfer` a silent success.
    function test_ACurrencyWithNoCodeIsRefused() public {
        SlotInit memory i = _init();
        i.currency = IERC20(alice);
        vm.expectRevert(InvalidCurrency.selector);
        factory.createSlot(i);
    }

    function test_AZeroRecipientIsRefused() public {
        SlotInit memory i = _init();
        i.taxTerms.recipient = address(0);
        vm.expectRevert(InvalidRecipient.selector);
        factory.createSlot(i);
    }

    /// @notice No manager means nothing can ever be proposed.
    function test_WithoutAManagerNothingCanBeProposed() public {
        SlotInit memory i = _init();
        i.manager = address(0);
        Slot s = Slot(payable(factory.createSlot(i)));
        vm.expectRevert(NotManager.selector);
        s.proposeTerms(i.taxTerms, i.hookTerms, 1);
    }

    // ─── a broken hook is swallowed, and reported ───────────────────────────

    /// @notice An `after` hook that reverts cannot change the outcome, and the
    ///         slot logs it rather than failing silently.
    function test_AFailingAfterHookIsSwallowedAndLogged() public {
        SlotInit memory i = _init();
        i.hookTerms.target = address(new BrokenAfter());
        Slot s = Slot(payable(factory.createSlot(i)));

        uint256 dep = SlotMath.depositFor(1 ether, TAX_RATE, MIN_DEP);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        vm.recordLogs();
        s.buy(alice, 1 ether, dep, 0);
        vm.stopPrank();

        assertEq(s.occupant(), alice, "the buy stood");
        bool logged;
        bytes32 sig = keccak256("HookCallFailed(address,bytes4)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 k; k < logs.length; ++k) {
            if (logs[k].topics[0] == sig) logged = true;
        }
        assertTrue(logged, "the failure was reported, not hidden");
    }
}
