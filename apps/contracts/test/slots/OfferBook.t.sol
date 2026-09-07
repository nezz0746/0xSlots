// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import "../../src/periphery/book/OfferBookErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/**
 * @notice The book bound to a real slot, discovering bids AND filling them.
 *
 * @dev The core no longer has `sell`. A consensual sale is `selfAssess` then
 *      `buy`, performed by this book inside the occupant's own transaction —
 *      so these tests are as much about the authority the book does and does
 *      not have as about the board itself.
 */
contract OfferBookSlotsTest is Test {
    SlotFactory factory;
    OfferBook book;
    Tok token;
    Slot slot;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant PRICE = 100e18;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Tok();
        book = new OfferBook();

        slot = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(token)),
            manager: address(this),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: 500,
            minDepositSeconds: 1 days,
            mutableTax: true,
            mutableHook: true
        }))));

        address[3] memory who = [alice, bob, carol];
        for (uint256 i; i < 3; ++i) {
            token.mint(who[i], 10_000e18);
            vm.startPrank(who[i]);
            token.approve(address(slot), type(uint256).max);
            // The allowance a bid is backed by goes to the BOOK: `buy` charges
            // `msg.sender`, and on a fill that is the book.
            token.approve(address(book), type(uint256).max);
            vm.stopPrank();
        }

        uint256 dep = slot.minDepositForBuy(PRICE);
        vm.prank(alice);
        slot.buy(alice, PRICE, dep, 0);
    }

    function _post(address who, uint256 price) internal returns (uint256 id) {
        // Hoisted: `minDepositForBuy` is itself a call, and evaluating it in
        // the argument list would consume the prank — every offer would then
        // come from this test contract instead of `who`.
        uint256 dep = slot.minDepositForBuy(price);
        uint64 expiry = uint64(block.timestamp + 7 days);
        vm.prank(who);
        id = book.offer(address(slot), price, dep, expiry);
    }

    /// @dev The grant that lets the book reprice. Tenure-scoped on the far side.
    function _approveBook() internal {
        vm.prank(alice);
        slot.setOperator(address(book), true);
    }

    // ─── discovery ──────────────────────────────────────────────────────────

    function test_TheBookCountsAndListsStandingBids() public {
        assertEq(book.offerCount(address(slot)), 0);
        _post(bob, 70e18);
        _post(carol, 90e18);

        assertEq(book.offerCount(address(slot)), 2);
        assertEq(book.liveCount(address(slot)), 2, "both acceptable");
        OfferBook.Offer[] memory all = book.offers(address(slot));
        assertEq(all.length, 2);
        assertEq(all[0].bidder, bob);
        assertEq(all[1].bidder, carol);
    }

    /// @notice An unfunded bid is not a bid — allowance is read, not assumed.
    function test_AnUnfundedBidIsSkipped() public {
        _post(bob, 70e18);
        uint256 rich = _post(carol, 90e18);

        vm.prank(carol);
        token.approve(address(book), 0);

        assertFalse(book.isFundable(address(slot), rich));
        (bool found, , OfferBook.Offer memory o) = book.best(address(slot));
        assertTrue(found);
        assertEq(o.bidder, bob, "falls back to the funded bid");
    }

    function test_ABidderCanCancel() public {
        uint256 id = _post(bob, 70e18);
        vm.prank(bob);
        book.cancel(address(slot), id);
        assertEq(book.liveCount(address(slot)), 0);
        assertFalse(book.isLive(address(slot), id));
    }

    // ─── the fill ───────────────────────────────────────────────────────────

    /// @notice The whole point: the occupant accepts, and the bidder is seated
    ///         at the bid price with the seller paid.
    function test_TheOccupantAcceptsTheBestBid() public {
        _post(bob, 70e18);
        uint256 best_ = _post(carol, 90e18);
        _approveBook();

        (bool found, uint256 id, OfferBook.Offer memory o) =
            book.best(address(slot));
        assertTrue(found);
        assertEq(o.bidder, carol, "the higher funded bid wins");
        assertEq(id, best_);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        book.acceptOffer(address(slot), id);

        assertEq(slot.occupant(), carol, "carol took the slot");
        assertEq(slot.price(), 90e18, "at her bid");
        assertGt(token.balanceOf(alice), before, "alice was paid");
    }

    /// @notice A filled offer stops being offered, without a cleanup call.
    function test_AFilledOfferStopsBeingOffered() public {
        uint256 id = _post(bob, 70e18);
        _approveBook();

        vm.prank(alice);
        book.acceptOffer(address(slot), id);

        assertFalse(book.isLive(address(slot), id), "no longer acceptable");
        assertEq(book.liveCount(address(slot)), 0, "the count a UI renders");
        assertEq(book.offerCount(address(slot)), 1, "the raw row is still there");
        assertTrue(book.offerAt(address(slot), id).filled);
    }

    // ─── the authority the book does NOT have ───────────────────────────────

    /// @notice Nobody but the occupant may accept a bid on their slot.
    function test_OnlyTheOccupantCanAccept() public {
        uint256 id = _post(bob, 70e18);
        _approveBook();

        vm.prank(bob); // the bidder cannot force his own fill
        vm.expectRevert(NotOccupant.selector);
        book.acceptOffer(address(slot), id);

        vm.prank(carol);
        vm.expectRevert(NotOccupant.selector);
        book.acceptOffer(address(slot), id);
    }

    /// @notice Without the operator grant the book can do nothing at all.
    function test_TheBookCannotActWithoutTheOperatorGrant() public {
        uint256 id = _post(bob, 70e18);

        vm.prank(alice);
        vm.expectRevert(NotOperator.selector);
        book.acceptOffer(address(slot), id);
    }

    /// @notice The grant dies with the tenure, so it cannot be inherited.
    /// @dev `_operatorOf` is keyed by `tenureId` in the slot. After a fill the
    ///      seat has changed hands, and the new occupant has approved nobody.
    function test_TheGrantDoesNotSurviveTheTenure() public {
        uint256 id = _post(bob, 70e18);
        _approveBook();
        vm.prank(alice);
        book.acceptOffer(address(slot), id);

        assertEq(slot.occupant(), bob);
        assertFalse(
            slot.isOperator(address(book)),
            "the book's authority ended with alice's tenure"
        );

        uint256 next = _post(carol, 120e18);
        vm.prank(bob);
        vm.expectRevert(NotOperator.selector);
        book.acceptOffer(address(slot), next);
    }

    /// @notice A cancelled or expired bid cannot be filled.
    function test_ADeadOfferCannotBeFilled() public {
        uint256 id = _post(bob, 70e18);
        _approveBook();
        vm.prank(bob);
        book.cancel(address(slot), id);

        vm.prank(alice);
        vm.expectRevert(OfferNotLive.selector);
        book.acceptOffer(address(slot), id);
    }

    /// @notice Raising the price raises the escrow floor, and the slot enforces
    ///         it against the SELLER's deposit. Reported with the shortfall
    ///         rather than surfacing as a bare `InvalidDeposit`.
    function test_AHigherBidCanRequireTheSellerToTopUpFirst() public {
        // Alice is funded for 100e18 exactly; a 5000e18 bid needs far more.
        uint256 id = _post(bob, 5_000e18);
        _approveBook();

        uint256 floor_ = slot.minDepositForBuy(5_000e18);
        uint256 held = slot.deposit();
        assertGt(floor_, held, "the floor really is above what she holds");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(TopUpRequired.selector, floor_ - held)
        );
        book.acceptOffer(address(slot), id);

        // Topping up clears it, and the top-up comes back in the sale proceeds.
        vm.startPrank(alice);
        slot.topUp(floor_ - held);
        book.acceptOffer(address(slot), id);
        vm.stopPrank();
        assertEq(slot.occupant(), bob);
    }

    /// @notice Native slots are out of scope: the occupant sends the
    ///         transaction, so there is no way to reach the bidder's ETH.
    function test_ANativeSlotCannotBeFilled() public {
        Slot native_ = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(0)),
            manager: address(0),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: 500,
            minDepositSeconds: 1 days,
            mutableTax: false,
            mutableHook: false
        }))));
        vm.deal(alice, 100 ether);
        uint256 dep = native_.minDepositForBuy(1 ether);
        vm.prank(alice);
        native_.buy{value: dep}(alice, 1 ether, dep, 0);

        uint256 nativeDep = native_.minDepositForBuy(2 ether);
        uint64 nativeExpiry = uint64(block.timestamp + 7 days);
        vm.prank(bob);
        uint256 id = book.offer(address(native_), 2 ether, nativeDep, nativeExpiry);

        vm.prank(alice);
        native_.setOperator(address(book), true);
        vm.prank(alice);
        vm.expectRevert(OfferNotLive.selector); // `_fundable` refuses it first
        book.acceptOffer(address(native_), id);
    }
}
