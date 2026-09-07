// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../src/v1/Slot.sol";
import {SlotSellOrder} from "../src/v1/base/SlotSellOrder.sol";
import {OfferBook} from "../src/v1/periphery/OfferBook.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/v1/interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../src/v1/interfaces/IModuleMetadata.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../src/v1/interfaces/SlotErrors.sol";

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
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId
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
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

contract SlotSellTest is Test {
    SlotFactory internal factory;
    Tok internal token;

    address internal recipient = makeAddr("recipient");
    uint256 internal aliceKey;
    uint256 internal bobKey;
    uint256 internal carolKey;
    address internal alice;
    address internal bob;
    address internal carol;

    event Sold(address indexed seller, address indexed buyer, uint256 price, uint256 deposit);

    function setUp() public {
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");
        (carol, carolKey) = makeAddrAndKey("carol");
        Slot impl = new Slot();
        SlotFactory fImpl = new SlotFactory();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(address(fImpl), abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))
            )
        );
        token = new Tok();
        token.mint(alice, 1_000 ether);
        token.mint(bob, 1_000 ether);
        token.mint(carol, 1_000 ether);
    }

    function _slot(address policy, address currency) internal returns (Slot s) {
        s = Slot(
            factory.createSlot(
                recipient,
                IERC20(currency),
                SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
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

    // ─── signed sell orders ─────────────────────────────────────────────────

    /// @dev `sell` now requires the buyer's EIP-712 signature over the exact
    ///      terms, because a bare allowance authorises spending but never a
    ///      price the counterparty picks. These helpers keep the tests reading
    ///      the way they did while exercising the real consent path.
    ///
    ///      The digest is rebuilt locally rather than read from the slot: a
    ///      helper that made an external call would swallow the `vm.prank` the
    ///      caller set for `sell` itself.
    bytes32 internal constant _TYPEHASH =
        keccak256("SellOrder(address slot,address buyer,uint256 price,uint256 deposit,uint256 nonce,uint64 deadline)");

    mapping(address => uint256) internal _nextNonce;

    function _keyOf(address who) internal view returns (uint256) {
        if (who == alice) return aliceKey;
        if (who == bob) return bobKey;
        if (who == carol) return carolKey;
        revert("no key for actor");
    }

    function _digest(address slot, SlotSellOrder.SellOrder memory o) internal view returns (bytes32) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("0xSlots"),
                keccak256("1"),
                block.chainid,
                slot
            )
        );
        bytes32 structHash = keccak256(abi.encode(_TYPEHASH, o.slot, o.buyer, o.price, o.deposit, o.nonce, o.deadline));
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _signedOrder(Slot s, address buyer, uint256 price, uint256 dep)
        internal
        returns (SlotSellOrder.SellOrder memory o, bytes memory sig)
    {
        o = SlotSellOrder.SellOrder({
            slot: address(s),
            buyer: buyer,
            price: price,
            deposit: dep,
            nonce: _nextNonce[buyer],
            deadline: uint64(block.timestamp + 1 days)
        });
        _nextNonce[buyer] = o.nonce + 1;
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(_keyOf(buyer), _digest(address(s), o));
        sig = abi.encodePacked(r, ss, v);
    }

    /// @dev Post an offer carrying the bidder's signature over the exact terms.
    ///
    ///      Deliberately makes NO external call before `book.offer`, so it can
    ///      be invoked under an active `vm.prank`/`vm.startPrank` without
    ///      swallowing it. `vm.sign` is a cheatcode and does not consume one.
    function _offerAs(OfferBook book, address slotAddr, address bidder, uint256 price, uint256 dep, uint64 deadline)
        internal
        returns (uint256 id)
    {
        uint256 nonce = _nextNonce[bidder];
        _nextNonce[bidder] = nonce + 1;
        SlotSellOrder.SellOrder memory o = SlotSellOrder.SellOrder({
            slot: slotAddr, buyer: bidder, price: price, deposit: dep, nonce: nonce, deadline: deadline
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(_keyOf(bidder), _digest(slotAddr, o));
        return book.offer(slotAddr, price, dep, deadline, nonce, abi.encodePacked(r, ss, v));
    }

    /// @dev Sign as `buyer`, then execute under whatever prank the caller set.
    function _sellTo(Slot s, address buyer, uint256 price, uint256 dep) internal {
        (SlotSellOrder.SellOrder memory o, bytes memory sig) = _signedOrder(s, buyer, price, dep);
        s.sell(o, sig);
    }

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
        _sellTo(s, bob, 80 ether, 10 ether);

        assertEq(s.occupant(), bob);
        assertEq(s.price(), 80 ether);
        assertEq(s.deposit(), 10 ether);

        // Alice: sale price + her escrow back, less the tax she owed.
        assertApproxEqAbs(
            token.balanceOf(alice) - aliceBefore, 90 ether, 0.01 ether, "seller gets price + deposit back"
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
        _sellTo(s, bob, 1 ether, 10 ether);

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
        _sellTo(s, bob, 80 ether, 10 ether);

        // And reopening it lets exactly the same call through, so the revert
        // above was the policy and not some unrelated guard.
        policy.set(true);
        vm.prank(alice);
        _sellTo(s, bob, 80 ether, 10 ether);
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
                alice, // account = incoming occupant
                address(0), // occupant = vacant
                uint256(50 ether),
                alice // caller
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
        _sellTo(s, carol, 50 ether, 10 ether);
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
        _sellTo(s, bob, 200 ether, 10 ether);

        // The agreed terms still go through.
        vm.prank(alice);
        _sellTo(s, bob, 80 ether, 10 ether);
        assertEq(s.occupant(), bob);
    }

    function test_CannotSellToYourself() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(alice);
        vm.expectRevert(CannotBuyFromYourself.selector);
        _sellTo(s, alice, 50 ether, 10 ether);
    }

    function test_RejectsZeroPrice() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(alice);
        vm.expectRevert(InvalidPrice.selector);
        _sellTo(s, bob, 0, 10 ether);
    }

    /// @dev A zero buyer no longer needs its own check: nobody can produce a
    ///      signature for `address(0)`, so the consent gate rejects it first.
    ///      The guard stays in place regardless — it is one comparison, and it
    ///      documents the invariant rather than relying on ECDSA to imply it.
    function test_RejectsZeroBuyerAtTheSignatureGate() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        SlotSellOrder.SellOrder memory o = SlotSellOrder.SellOrder({
            slot: address(s),
            buyer: address(0),
            price: 50 ether,
            deposit: 10 ether,
            nonce: 0,
            deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(bobKey, s.sellOrderHash(o));

        vm.prank(alice);
        vm.expectRevert(SlotSellOrder.SellOrderBadSignature.selector);
        s.sell(o, abi.encodePacked(r, ss, v));
    }

    function test_EnforcesMinimumDepositForTheBuyer() public {
        Slot s = _slot(address(0), address(token));
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(InsufficientDeposit.selector);
        _sellTo(s, bob, 100 ether, 1); // a deposit that funds no runway
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
        _sellTo(s, bob, 50 ether, 10 ether);
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
        _sellTo(s, bob, 80 ether, 10 ether);

        bytes32 sold = keccak256("Sold(address,address,uint256,uint256)");
        bytes32 bought = keccak256("Bought(address,address,uint256,uint256,uint256)");
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
        _offerAs(book, address(s), carol, 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (bool found,, OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob, "best by price, not by arrival");
        assertEq(o.price, 80 ether);

        vm.prank(alice);
        _sellTo(s, o.bidder, o.price, o.deposit);

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
        _offerAs(book, address(s), carol, 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.prank(bob);
        uint256 bobId = _offerAs(book, address(s), carol, 90 ether, 10 ether, uint64(block.timestamp + 1 days));

        assertFalse(book.fundable(address(s), bobId), "no allowance, not fundable");

        (bool found,, OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, carol, "the higher but unfunded offer is skipped");
    }

    function test_CancelledAndExpiredOffersAreSkipped() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        uint256 id = _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        book.cancel(address(s), id);
        vm.stopPrank();

        (bool found,,) = book.best(address(s));
        assertFalse(found, "a cancelled offer is off the board");

        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        _offerAs(book, address(s), carol, 50 ether, 10 ether, uint64(block.timestamp + 100));
        vm.stopPrank();

        vm.warp(block.timestamp + 200);
        (found,,) = book.best(address(s));
        assertFalse(found, "an expired offer is off the board");
    }

    function test_OnlyTheBidderMayCancel() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();

        vm.prank(bob);
        uint256 id = _offerAs(book, address(s), carol, 80 ether, 10 ether, uint64(block.timestamp + 1 days));

        vm.prank(carol);
        vm.expectRevert(OfferBook.NotBidder.selector);
        book.cancel(address(s), id);
    }

    function test_EmptyBoardIsNotAnError() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        (bool found,,) = book.best(address(s));
        assertFalse(found);
    }

    /// @dev A native slot cannot be sold into, so no offer on one is fundable.
    function test_NativeSlotOffersAreNeverFundable() public {
        Slot s = _slot(address(0), address(0));
        OfferBook book = _book();

        vm.prank(bob);
        uint256 id = _offerAs(book, address(s), carol, 1 ether, 1 ether, uint64(block.timestamp + 1 days));
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
        _offerAs(book, address(s), carol, 90 ether, 10 ether, uint64(block.timestamp + 1 days));

        (bool found,,) = book.best(address(s));
        assertFalse(found, "the occupant's own offer is not an exit");

        // A real counterparty is.
        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        _offerAs(book, address(s), bob, 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        OfferBook.Offer memory o;
        (found,, o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob);

        vm.prank(alice);
        _sellTo(s, o.bidder, o.price, o.deposit);
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
        uint256 first = _offerAs(book, address(s), bob, 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        uint256 second = _offerAs(book, address(s), bob, 80 ether, 15 ether, uint64(block.timestamp + 2 days));
        vm.stopPrank();

        assertEq(second, first, "the same id is reused");
        assertEq(book.offerCount(address(s)), 1, "the board did not grow");

        (bool found,, OfferBook.Offer memory o) = book.best(address(s));
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
        _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        _offerAs(book, address(s), bob, 30 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (,, OfferBook.Offer memory o) = book.best(address(s));
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
        uint256 id = _offerAs(book, address(s), bob, 40 ether, 10 ether, uint64(block.timestamp + 1 days));
        book.cancel(address(s), id);

        uint256 again = _offerAs(book, address(s), bob, 60 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        assertEq(again, id, "the cancelled entry is reused");
        assertEq(book.offerCount(address(s)), 1);

        (bool found,, OfferBook.Offer memory o) = book.best(address(s));
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
        _offerAs(book, address(s), bob, 50 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        _offerAs(book, address(s), carol, 50 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        assertEq(book.offerCount(address(s)), 2, "separate bidders, separate offers");

        (bool found,, OfferBook.Offer memory o) = book.best(address(s));
        assertTrue(found);
        assertEq(o.bidder, bob, "first in at an equal price takes the tie");
    }

    /// @notice `offerOf` is what lets a client say "replace your 40" instead of
    ///         "make an offer", so replacement is never a surprise.
    function test_OfferOfReportsTheStandingOffer() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();

        (bool has,,) = book.offerOf(address(s), bob);
        assertFalse(has, "nothing standing to begin with");

        vm.startPrank(bob);
        uint256 id = _offerAs(book, address(s), bob, 40 ether, 10 ether, uint64(block.timestamp + 100));

        OfferBook.Offer memory o;
        uint256 reported;
        (has, reported, o) = book.offerOf(address(s), bob);
        assertTrue(has);
        assertEq(reported, id);
        assertEq(o.price, 40 ether);

        book.cancel(address(s), id);
        (has,,) = book.offerOf(address(s), bob);
        assertFalse(has, "cancelled is not standing");

        _offerAs(book, address(s), bob, 40 ether, 10 ether, uint64(block.timestamp + 100));
        vm.stopPrank();

        vm.warp(block.timestamp + 200);
        (has,,) = book.offerOf(address(s), bob);
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
        _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        (, bool[] memory live) = book.board(address(s));
        assertTrue(live[0], "live before the fill");

        vm.prank(alice);
        _sellTo(s, bob, 80 ether, 10 ether);

        OfferBook.Offer[] memory list;
        (list, live) = book.board(address(s));
        assertFalse(list[0].cancelled, "nothing on-chain marked it: that is the trap");
        assertFalse(live[0], "but the board must not call it live");
    }

    /// @notice A filled order stays dead — with no cleanup transaction.
    ///
    /// @dev This used to require a permissionless `retire` call, and a race to
    ///      send it: until someone did, the consumed offer was merely HIDDEN
    ///      (its author happened to be the occupant) and sprang back the moment
    ///      they were bought out. The slot now burns the bidder's nonce as it
    ///      executes, so the order is dead everywhere it was ever published.
    function test_AFilledOfferDoesNotResurrect() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);
        vm.prank(bob);
        _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 30 days));

        // Alice sells into THE ORDER ON THE BOARD — the real flow. Selling via
        // some other signed order would burn a different nonce and leave this
        // one standing, which is correct: they would be two separate offers.
        (, , SlotSellOrder.SellOrder memory order, bytes memory sig) =
            book.bestOrder(address(s));
        vm.prank(alice);
        s.sell(order, sig);
        assertEq(s.occupant(), bob, "bob now occupies");

        // Carol buys bob out, so bob is no longer the occupant — the exact
        // moment the old design let the consumed offer come back.
        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        s.buy(carol, 20 ether, 200 ether);
        vm.stopPrank();

        (bool found, , ) = book.best(address(s));
        assertFalse(found, "the consumed order stays dead");
    }


    /// @notice An unfilled order stays live. Nothing needs to retire it, and
    ///         nothing can: it dies only when its own nonce is burned — by
    ///         being executed, or by the bidder cancelling it.
    function test_AnUnfilledOrderStaysLive() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.stopPrank();
        vm.prank(bob);
        _offerAs(book, address(s), bob, 80 ether, 10 ether, uint64(block.timestamp + 1 days));

        (bool found, , ) = book.best(address(s));
        assertTrue(found, "bob's offer is untouched");
    }

    /// @notice The book cannot alter what the bidder agreed to. It forwards a
    ///         signed order; the slot re-verifies it, so a hostile book is
    ///         powerless rather than merely discouraged.
    function test_TheBookCannotChangeTheTerms() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);
        // `prank` above is spent by `approve`; re-prank for the offer itself.
        vm.prank(bob);
        _offerAs(book, address(s), bob, 70 ether, 10 ether, uint64(block.timestamp + 1 days));

        (SlotSellOrder.SellOrder memory order, bytes memory sig) =
            book.orderOf(address(s), 0);

        // Alice rewrites the split in her favour and submits it directly.
        order.price = 80 ether;
        order.deposit = 0;

        vm.prank(alice);
        vm.expectRevert(SlotSellOrder.SellOrderBadSignature.selector);
        s.sell(order, sig);
    }

    /// @notice A filled offer is dead ON ITS OWN — the slot burned the nonce,
    ///         so no cleanup call is needed and it cannot come back.
    function test_AFilledOfferDiesWithoutCleanup() public {
        Slot s = _slot(address(0), address(token));
        OfferBook book = _book();
        _seatAlice(s, 100 ether);

        vm.prank(bob);
        token.approve(address(s), type(uint256).max);
        vm.prank(bob);
        _offerAs(book, address(s), bob, 70 ether, 10 ether, uint64(block.timestamp + 30 days));

        (, , SlotSellOrder.SellOrder memory order, bytes memory sig) =
            book.bestOrder(address(s));
        vm.prank(alice);
        s.sell(order, sig);

        // Carol buys bob out, so bob is no longer the occupant.
        vm.startPrank(carol);
        token.approve(address(s), type(uint256).max);
        s.buy(carol, 20 ether, 200 ether);
        vm.stopPrank();

        (bool found, , ) = book.best(address(s));
        assertFalse(found, "the consumed order never returns");
    }
}
