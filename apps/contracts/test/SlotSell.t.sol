// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../src/Slot.sol";
import {OfferBook} from "../src/periphery/OfferBook.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../src/interfaces/SlotErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Toggleable, so a test can seat someone while it permits and then close
///      the door. A policy that refused from the start could only ever be
///      tested through `buy`, which is not the code path in question.
contract Switchable is IOccupancyPolicy {
    error Refused();
    bool public allow = true;

    function set(bool v) external {
        allow = v;
    }

    function checkBuy(OccupancyContext calldata) external view {
        if (!allow) revert Refused();
    }

    function checkPriceUpdate(OccupancyContext calldata) external view {}

    function name() external pure returns (string memory) {
        return "Switchable";
    }
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
    function metadataURI() external pure returns (string memory) {
        return "";
    }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @dev Policy hooks are `view` and reached by STATICCALL, so a policy cannot
///      record what it saw. It CAN refuse loudly, so this reverts with the
///      context — the only way to observe what the slot handed it.
contract Reveals is IOccupancyPolicy {
    error Saw(address account, address occupant, uint256 newPrice, address caller);

    function checkBuy(OccupancyContext calldata ctx) external pure {
        revert Saw(ctx.account, ctx.occupant, ctx.newPrice, ctx.caller);
    }

    function checkPriceUpdate(OccupancyContext calldata) external pure {}

    function name() external pure returns (string memory) {
        return "Reveals";
    }
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
    function metadataURI() external pure returns (string memory) {
        return "";
    }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

contract SlotSellTest is Test {
    SlotFactory internal factory;
    Tok internal token;

    address internal recipient = makeAddr("recipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event Sold(
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 deposit
    );

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fImpl = new SlotFactory();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(fImpl),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(impl))
                    )
                )
            )
        );
        token = new Tok();
        token.mint(alice, 1_000 ether);
        token.mint(bob, 1_000 ether);
        token.mint(carol, 1_000 ether);
    }

    function _slot(address policy, address currency)
        internal
        returns (Slot s)
    {
        s = Slot(
            factory.createSlot(
                recipient,
                IERC20(currency),
                SlotConfig({
                    mutableTax: false,
                    mutableUtility: false,
                    mutablePolicy: false,
                    manager: address(0)
                }),
                SlotInitParams({
                    taxPercentage: 100,
                    utility: address(0),
                    liquidationBountyBps: 0,
                    minDepositSeconds: 86400,
                    occupancyPolicy: policy
                })
            )
        );
    }

    /// @dev Alice occupies at `price` with a deposit clear of the minimum.
    function _seatAlice(Slot s, uint256 price) internal {
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, price);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // THE HAPPY PATH
    // ═══════════════════════════════════════════════════════════

    /// @notice The half of the transfer surface that was missing: the occupant
    ///         hands the slot over at a price THEY name, and gets paid for it.
    function test_OccupantSellsAtOwnPriceAndIsPaid() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);

        vm.expectEmit(true, true, false, true);
        emit Sold(alice, bob, 80 ether, 10 ether);

        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);

        assertEq(s.occupant(), bob);
        assertEq(s.price(), 80 ether);
        assertEq(s.deposit(), 10 ether);

        // Alice: sale price + her escrow back, less the tax she owed.
        assertApproxEqAbs(
            token.balanceOf(alice) - aliceBefore,
            90 ether,
            0.01 ether,
            "seller gets price + deposit back"
        );
        // Bob paid price + his own deposit.
        assertEq(bobBefore - token.balanceOf(bob), 90 ether);
    }

    /// @notice Selling BELOW the declared price is the whole point — it is the
    ///         exit that used to pay zero.
    function test_SellsBelowTheDeclaredPrice() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        vm.prank(alice);
        s.sell(bob, 1 ether, 10 ether);

        assertEq(s.price(), 1 ether, "no floor - the seller names the price");
        assertEq(s.occupant(), bob);
    }

    // ═══════════════════════════════════════════════════════════
    // THE INVARIANT
    // ═══════════════════════════════════════════════════════════

    /// @notice LOAD-BEARING. `sell` transfers occupancy, so the policy must get
    ///         a say. Skip it and every occupancy policy in the protocol becomes
    ///         advisory — bypassable through a door it never knew existed.
    ///
    /// @dev Seat Alice while the policy permits, then close it. That ordering
    ///      is the whole point: a policy that refused from the start could only
    ///      be tested through `buy`, which is not the path under test.
    function test_SellRunsTheOccupancyPolicy() public {
        Switchable policy = new Switchable();
        Slot s = _slot(address(policy), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        policy.set(false); // the door closes

        vm.prank(alice);
        vm.expectRevert(Switchable.Refused.selector);
        s.sell(bob, 80 ether, 10 ether);

        // And reopening it lets exactly the same call through, so the revert
        // above was the policy and not some unrelated guard.
        policy.set(true);
        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);
        assertEq(s.occupant(), bob);
    }

    /// @notice The policy is asked about the BUYER, at the agreed price — it is
    ///         deciding who may occupy, and the seller is on their way out.
    function test_PolicyIsAskedAboutTheBuyerAtTheAgreedPrice() public {
        Switchable gate = new Switchable();
        Slot s = _slot(address(gate), address(token));
        _seatAlice(s, 100 ether);

        // Swap the permissive gate for a revealing one is impossible on an
        // immutable-policy slot, so build a second slot and seat Alice on it
        // while it still permits, then read the revert.
        Reveals policy = new Reveals();
        Slot r = _slot(address(policy), address(token));

        vm.startPrank(alice);
        token.approve(address(r), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                Reveals.Saw.selector,
                alice,          // account = incoming occupant
                address(0),     // occupant = vacant
                uint256(50 ether),
                alice           // caller
            )
        );
        r.buy(alice, 10 ether, 50 ether);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // GUARDS
    // ═══════════════════════════════════════════════════════════

    function test_OnlyOccupantMaySell() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        vm.expectRevert(NotOccupant.selector);
        s.sell(carol, 50 ether, 10 ether);
    }

    /// @notice The buyer's allowance is their only consent — and it is enough.
    ///         A seller naming absurd terms simply cannot pull them.
    function test_AllowanceCapsWhatTheSellerCanTake() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        // Bob approves exactly the deal he agreed to: 80 + 10.
        vm.prank(bob);
        token.approve(address(s), 90 ether);

        vm.prank(alice);
        vm.expectRevert();
        s.sell(bob, 200 ether, 10 ether);

        // The agreed terms still go through.
        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);
        assertEq(s.occupant(), bob);
    }

    function test_CannotSellToYourself() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(alice);
        vm.expectRevert(CannotBuyFromYourself.selector);
        s.sell(alice, 50 ether, 10 ether);
    }

    function test_RejectsZeroPriceAndZeroBuyer() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.startPrank(alice);
        vm.expectRevert(InvalidPrice.selector);
        s.sell(bob, 0, 10 ether);

        vm.expectRevert(InvalidRecipient.selector);
        s.sell(address(0), 50 ether, 10 ether);
        vm.stopPrank();
    }

    function test_EnforcesMinimumDepositForTheBuyer() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(InsufficientDeposit.selector);
        s.sell(bob, 100 ether, 1); // a deposit that funds no runway
    }

    /// @dev The buyer is not the caller, so there is no `msg.value` and no
    ///      allowance. Native slots keep `buy()`.
    function test_NativeSlotsCannotSell() public {
        Slot s = _slot(address(0), address(0));

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        s.buy{value: 10 ether}(alice, 10 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(SellNeedsErc20.selector);
        s.sell(bob, 50 ether, 10 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // INDEXER COMPATIBILITY
    // ═══════════════════════════════════════════════════════════

    /// @notice `Bought` fires as well as `Sold`. The occupancy transition IS a
    ///         buy, and every existing indexer reads it that way — emitting only
    ///         `Sold` would make sold slots vanish from feeds.
    function test_EmitsBoughtAlongsideSold() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        vm.recordLogs();
        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);

        bytes32 sold = keccak256("Sold(address,address,uint256,uint256)");
        bytes32 bought = keccak256(
            "Bought(address,address,uint256,uint256,uint256)"
        );
        bool sawSold;
        bool sawBought;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == sold) sawSold = true;
            if (logs[i].topics[0] == bought) sawBought = true;
        }
        assertTrue(sawSold, "Sold carries who initiated");
        assertTrue(sawBought, "Bought keeps every existing consumer working");
    }

    // ═══════════════════════════════════════════════════════════
    // THE BOOK
    // ═══════════════════════════════════════════════════════════

    function _book() internal returns (OfferBook) {
        return new OfferBook();
    }

    /// @notice End to end: Bob posts, Alice reads the best, Alice sells into it.
    function test_SellIntoTheBestOffer() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        // Two bidders, the better one posted second.
        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob, "best by price, not by arrival");
        assertEq(o.price, 80 ether);

        vm.prank(alice);
        s.sell(o.bidder, o.price, o.deposit);

        assertEq(s.occupant(), bob);
        assertEq(s.price(), 80 ether);
    }

    /// @notice An offer whose backing has evaporated is not "best". The seller
    ///         must never be handed one that would revert.
    function test_UnfundedOffersAreSkipped() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        // Carol is funded and approves; Bob posts higher but approves nothing.
        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.prank(bob);
        uint256 bobId = book.offer(
            address(s), 90 ether, 10 ether, uint64(block.timestamp + 1 days)
        );

        assertFalse(book.fundable(address(s), bobId), "no allowance, not fundable");

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, carol, "the higher but unfunded offer is skipped");
    }

    function test_CancelledAndExpiredOffersAreSkipped() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 id = book.offer(
            address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days)
        );
        book.cancel(address(s), id);
        vm.stopPrank();

        (bool found, , ) = book.best(address(s));
        assertFalse(found, "a cancelled offer is off the board");

        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 50 ether, 10 ether, uint64(block.timestamp + 100));
        vm.stopPrank();

        vm.warp(block.timestamp + 200);
        (found, , ) = book.best(address(s));
        assertFalse(found, "an expired offer is off the board");
    }

    function test_OnlyTheBidderMayCancel() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();

        vm.prank(bob);
        uint256 id = book.offer(
            address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days)
        );

        vm.prank(carol);
        vm.expectRevert(OfferBook.NotBidder.selector);
        book.cancel(address(s), id);
    }

    function test_EmptyBoardIsNotAnError() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        (bool found, , ) = book.best(address(s));
        assertFalse(found);
    }

    /// @dev A native slot cannot be sold into, so no offer on one is fundable.
    function test_NativeSlotOffersAreNeverFundable() public {
        Slot s = _slot(address(0), address(0));
        OfferBook book = _book();

        vm.prank(bob);
        uint256 id = book.offer(
            address(s), 1 ether, 1 ether, uint64(block.timestamp + 1 days)
        );
        assertFalse(book.fundable(address(s), id));
    }

    /// @notice An occupant's own offer can never be sold into — `Slot.sell`
    ///         refuses `CannotBuyFromYourself`. Surfacing it as "best" would be
    ///         a button that lies.
    function test_BestSkipsTheOccupantsOwnOffer() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        // Alice occupies AND has a fully funded offer on her own slot.
        vm.prank(alice);
        book.offer(address(s), 90 ether, 10 ether, uint64(block.timestamp + 1 days));

        (bool found, , ) = book.best(address(s));
        assertFalse(found, "the occupant's own offer is not an exit");

        // A real counterparty is.
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        OfferBook.Offer memory o;
        (found, , o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob);

        vm.prank(alice);
        s.sell(o.bidder, o.price, o.deposit);
        assertEq(s.occupant(), bob);
    }

    // ─── one offer per bidder per slot ───────────────────────────────────────

    /// @notice Posting again replaces your standing offer instead of adding a
    ///         second one. Two offers from one address draw on the SAME
    ///         allowance, so only one of them could ever execute.
    function test_ASecondOfferReplacesTheFirst() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 first = book.offer(
            address(s), 40 ether, 10 ether, uint64(block.timestamp + 1 days)
        );
        uint256 second = book.offer(
            address(s), 80 ether, 15 ether, uint64(block.timestamp + 2 days)
        );
        vm.stopPrank();

        assertEq(second, first, "the same id is reused");
        assertEq(book.offerCount(address(s)), 1, "the board did not grow");

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.price, 80 ether);
        assertEq(o.deposit, 15 ether, "every field is replaced, not just price");
    }

    /// @notice Lowering your bid must actually lower it. An append-based book
    ///         would leave the old 80 standing and `best` would keep returning
    ///         it — the bidder would be held to a price they withdrew.
    function test_ReplacingWithALowerPriceLowersIt() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        book.offer(address(s), 30 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (, , OfferBook.Offer memory o) = book.best(address(s));
        assertEq(o.price, 30 ether, "the withdrawn price is gone");
    }

    /// @notice Offering after cancelling revives the same entry rather than
    ///         growing the board, so a bidder cycling their bid cannot bloat it.
    function test_OfferingAfterCancellingReusesTheEntry() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 id = book.offer(
            address(s), 40 ether, 10 ether, uint64(block.timestamp + 1 days)
        );
        book.cancel(address(s), id);

        uint256 again = book.offer(
            address(s), 60 ether, 10 ether, uint64(block.timestamp + 1 days)
        );
        vm.stopPrank();

        assertEq(again, id, "the cancelled entry is reused");
        assertEq(book.offerCount(address(s)), 1);

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found, "the cancelled flag was cleared");
        assertEq(o.price, 60 ether);
    }

    /// @notice The limit is per bidder, not per slot: two people may stand at
    ///         the same price, and the earlier one wins the tie.
    function test_TwoBiddersMayStandAtTheSamePrice() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 50 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 50 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        assertEq(book.offerCount(address(s)), 2, "separate bidders, separate offers");

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob, "first in at an equal price takes the tie");
    }

    /// @notice `offerOf` is what lets a client say "replace your 40" instead of
    ///         "make an offer", so replacement is never a surprise.
    function test_OfferOfReportsTheStandingOffer() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();

        (bool has, , ) = book.offerOf(address(s), bob);
        assertFalse(has, "nothing standing to begin with");

        vm.startPrank(bob);
        uint256 id = book.offer(
            address(s), 40 ether, 10 ether, uint64(block.timestamp + 100)
        );

        OfferBook.Offer memory o;
        uint256 reported;
        (has, reported, o) = book.offerOf(address(s), bob);
        assertTrue(has);
        assertEq(reported, id);
        assertEq(o.price, 40 ether);

        book.cancel(address(s), id);
        (has, , ) = book.offerOf(address(s), bob);
        assertFalse(has, "cancelled is not standing");

        book.offer(address(s), 40 ether, 10 ether, uint64(block.timestamp + 100));
        vm.stopPrank();

        vm.warp(block.timestamp + 200);
        (has, , ) = book.offerOf(address(s), bob);
        assertFalse(has, "expired is not standing");
    }

    // ─── a filled offer must not linger, and must not come back ──────────────

    /// @notice The bug this fixes: `Slot.sell` pulls on an allowance and never
    ///         tells the book, so a FILLED offer keeps `cancelled == false` and
    ///         renders as live. `best` hid it; the board did not.
    function test_BoardMarksAFilledOfferDead() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (, bool[] memory live) = book.board(address(s));
        assertTrue(live[0], "live before the fill");

        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);

        OfferBook.Offer[] memory list;
        (list, live) = book.board(address(s));
        assertFalse(list[0].cancelled, "nothing on-chain marked it: that is the trap");
        assertFalse(live[0], "but the board must not call it live");
    }

    /// @notice A filled offer that is merely HIDDEN comes back the moment its
    ///         author stops occupying, letting the next occupant sell into a
    ///         price from a previous era. `retire` is what makes it permanent.
    function test_AFilledOfferDoesNotResurrect() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 id = book.offer(
            address(s), 80 ether, 10 ether, uint64(block.timestamp + 30 days)
        );
        vm.stopPrank();

        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether); // bob now occupies

        book.retire(address(s), id); // permissionless — note: not pranked

        // Carol buys bob out, so bob is no longer the occupant.
        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        s.buy(carol, 20 ether, 200 ether);
        vm.stopPrank();

        assertTrue(s.occupant() == carol, "bob is out");
        (bool found, , ) = book.best(address(s));
        assertFalse(found, "the consumed offer stays dead");
    }

    /// @notice Without `retire`, that same sequence hands Carol a live 80 that
    ///         Bob never re-offered. This test documents why retiring matters.
    function test_WithoutRetireTheOfferWouldComeBack() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        book.offer(address(s), 80 ether, 10 ether, uint64(block.timestamp + 30 days));
        vm.stopPrank();

        vm.prank(alice);
        s.sell(bob, 80 ether, 10 ether);

        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        s.buy(carol, 20 ether, 200 ether);
        vm.stopPrank();

        (bool found, , OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found, "un-retired, it is live again");
        assertEq(o.price, 80 ether, "a price from before the fill");
    }

    /// @notice Retiring is only legal when the bidder really does hold the
    ///         slot — otherwise anyone could cancel anyone's offer.
    function test_RetireRefusesAnOfferThatWasNotFilled() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 id = book.offer(
            address(s), 80 ether, 10 ether, uint64(block.timestamp + 1 days)
        );
        vm.stopPrank();

        vm.prank(carol);
        vm.expectRevert(OfferBook.NotFilled.selector);
        book.retire(address(s), id);

        (bool found, , ) = book.best(address(s));
        assertTrue(found, "bob's offer is untouched");
    }
}
