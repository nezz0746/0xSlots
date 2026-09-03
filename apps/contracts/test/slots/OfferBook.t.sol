// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SellOrder} from "../../src/SlotOrders.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/**
 * @notice The book bound to a REAL hook-based slot.
 *
 * @dev A signed order is the settlement mechanism; the book is the DISCOVERY
 *      mechanism. Without it an order is a blob one buyer hands one occupant
 *      out of band — nobody can see what a slot has been bid, and there is no
 *      "best" to accept. These tests are about that difference.
 */
contract OfferBookSlotsTest is Test {
    SlotFactory factory;
    OfferBook book;
    Tok token;
    Slot slot;

    uint256 aliceKey = 0xA11CE;
    uint256 bobKey = 0xB0B;
    uint256 carolKey = 0xCAC01;
    address alice = vm.addr(0xA11CE);
    address bob = vm.addr(0xB0B);
    address carol = vm.addr(0xCAC01);

    uint256 constant PRICE = 100e18;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        token = new Tok();
        book = OfferBook(address(new ERC1967Proxy(address(new OfferBook()), abi.encodeCall(OfferBook.initialize, (address(this))))));

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

        for (uint256 i; i < 3; ++i) {
            address who = [alice, bob, carol][i];
            token.mint(who, 10_000e18);
            vm.prank(who);
            token.approve(address(slot), type(uint256).max);
        }

        // Alice sits on the slot.
        uint256 dep = slot.minDepositForBuy(PRICE);
        vm.prank(alice);
        slot.buy(alice, PRICE, dep, 0);
    }

    function _sign(uint256 key, uint256 price, uint256 deposit, uint256 nonce, uint64 deadline)
        internal view returns (SellOrder memory o, bytes memory sig)
    {
        o = SellOrder({
            slot: address(slot),
            buyer: vm.addr(key),
            price: price,
            deposit: deposit,
            nonce: nonce,
            deadline: deadline
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, slot.sellOrderHash(o));
        sig = abi.encodePacked(r, s, v);
    }

    function _post(uint256 key, uint256 price) internal returns (uint256 id) {
        uint256 dep = slot.minDepositForBuy(price);
        uint64 deadline = uint64(block.timestamp + 7 days);
        (, bytes memory sig) = _sign(key, price, dep, 0, deadline);
        vm.prank(vm.addr(key));
        id = book.offer(address(slot), price, dep, deadline, 0, sig);
    }

    /// @notice The count the UI needs — and it is on-chain, not in a browser.
    function test_TheBookCountsAndListsStandingBids() public {
        assertEq(book.offerCount(address(slot)), 0);
        _post(bobKey, 70e18);
        _post(carolKey, 90e18);

        assertEq(book.offerCount(address(slot)), 2);
        assertEq(book.liveCount(address(slot)), 2, "both acceptable");
        OfferBook.Offer[] memory all = book.offers(address(slot));
        assertEq(all.length, 2);
        assertEq(all[0].bidder, bob);
        assertEq(all[1].bidder, carol);
    }

    /// @notice And a best to accept.
    function test_TheOccupantAcceptsTheBestBid() public {
        _post(bobKey, 70e18);
        _post(carolKey, 90e18);

        (bool found, , OfferBook.Offer memory o) = book.best(address(slot));
        assertTrue(found);
        assertEq(o.bidder, carol, "the higher funded bid wins");
        assertEq(o.price, 90e18);

        (bool ok, , SellOrder memory order, bytes memory sig) =
            book.bestOrder(address(slot));
        assertTrue(ok);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        slot.sell(order, sig);

        assertEq(slot.occupant(), carol, "carol took the slot");
        assertEq(slot.price(), 90e18);
        assertGt(token.balanceOf(alice), before, "alice was paid");
    }

    /// @notice An unfunded bid is not a bid. The book reads allowance and
    ///         balance rather than trusting the signature.
    function test_AnUnfundedBidIsSkipped() public {
        _post(bobKey, 70e18);
        uint256 rich = _post(carolKey, 90e18);

        vm.prank(carol);
        token.approve(address(slot), 0);

        assertFalse(book.isFundable(address(slot), rich));
        (bool found, , OfferBook.Offer memory o) = book.best(address(slot));
        assertTrue(found);
        assertEq(o.bidder, bob, "falls back to the funded bid");
    }

    /// @notice Filling burns the nonce, so the book stops offering a dead order.
    function test_AFilledOrderStopsBeingOffered() public {
        uint256 id = _post(bobKey, 70e18);
        assertTrue(book.isFundable(address(slot), id));

        (, , SellOrder memory order, bytes memory sig) = book.bestOrder(address(slot));
        vm.prank(alice);
        slot.sell(order, sig);

        assertTrue(slot.orderUsed(bob, 0), "nonce burned on the slot");

        // `isFundable` asks only whether the bidder can pay, and bob still can —
        // liveness is the separate question, and the one a list must ask.
        assertTrue(book.isFundable(address(slot), id), "still funded");
        assertFalse(book.isLive(address(slot), id), "but no longer acceptable");
        assertEq(book.liveCount(address(slot)), 0, "the count a UI renders");
        assertEq(book.offerCount(address(slot)), 1, "the raw row is still there");

        (bool found, , ) = book.best(address(slot));
        assertFalse(found, "nothing live is left");
    }

    /// @notice A bidder may retract.
    function test_ABidderCanCancel() public {
        uint256 id = _post(bobKey, 70e18);
        vm.prank(bob);
        book.cancel(address(slot), id);
        assertEq(book.liveCount(address(slot)), 0);
        assertFalse(book.isLive(address(slot), id));
        (bool found, , ) = book.best(address(slot));
        assertFalse(found);
    }
}
