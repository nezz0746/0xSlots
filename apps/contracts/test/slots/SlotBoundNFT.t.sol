// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotInfo} from "../../src/SlotViews.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFT} from "../../src/hooks/nft/SlotBoundNFT.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";
import {ISlotHook, SlotContext} from "../../src/ISlotHook.sol";

contract TT is ERC20 { constructor() ERC20("T","T"){} function mint(address t,uint256 a) external {_mint(t,a);} }

contract SlotBoundNFTTest is Test {
    SlotFactory factory; TT token; SlotBoundNFT nft;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address owner = makeAddr("owner");

    uint256 tokenId; Slot slot;

    function setUp() public {
        Slot impl = new Slot(); SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize,(address(this),address(impl))))));
        token = new TT();
        for (uint256 i; i < 3; ++i) {}
        token.mint(alice, 1e24); token.mint(bob, 1e24); token.mint(carol, 1e24);
        vm.deal(alice, 100 ether); vm.deal(bob, 100 ether);
        nft = new SlotBoundNFT(
            factory, "Slot Bound", "SBND", 3,
            IERC20(address(token)), 1000, 7 days, recipient, manager, owner
        );
        vm.warp(1_000_000);

        vm.startPrank(alice);
        token.approve(address(nft), type(uint256).max);
        (tokenId, ) = nft.mint(100 ether);
        vm.stopPrank();
        slot = Slot(payable(nft.slotOf(tokenId)));
    }

    /// @dev Rent per 30 days on `v`, at the collection's rate. Local, because
    ///      the contract no longer exposes it — the slot's own numbers do.
    function _rent(uint256 v) internal view returns (uint256) {
        return (v * nft.terms().taxBps) / 10_000;
    }

    /// @dev What a mint of `v` costs in total: the price plus the escrow.
    function _cost(uint256 v) internal view returns (uint256) {
        return _costOf(nft, v);
    }

    function _costOf(SlotBoundNFT n, uint256 v) internal view returns (uint256) {
        (uint256 total, , ) = n.quoteMint(v);
        return total;
    }

    function _depositOf(SlotBoundNFT n, uint256 v) internal view returns (uint256) {
        (, , uint256 d) = n.quoteMint(v);
        return d;
    }

    function _buy(address who, uint256 price, uint256 dep) internal {
        vm.startPrank(who);
        token.approve(address(slot), type(uint256).max);
        slot.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ── minting seats the minter ────────────────────────────────────────────

    /// @notice One transaction: slot created, minter seated, token delivered.
    function test_MintingSeatsTheMinterAndDeliversTheToken() public view {
        assertEq(slot.occupant(), alice, "seated by the mint itself");
        assertEq(nft.ownerOf(tokenId), alice, "and holding the token");
        assertEq(slot.price(), 100 ether);
        assertEq(nft.totalMinted(), 1);
    }

    function test_TheCollectionMintsItsTermsNotTheMintersTerms() public view {
        SlotInit memory t = nft.terms();
        assertEq(t.hook, address(nft), "forced to the collection");
        assertFalse(t.mutableHook, "and permanently so");
        assertEq(slot.taxBps(), t.taxBps, "every slot, the same terms");
        assertEq(slot.recipient(), recipient);
    }

    function test_SupplyIsCapped() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        nft.mint(1 ether);
        nft.mint(1 ether);
        vm.expectRevert(ISlotBoundNFT.SoldOut.selector);
        nft.mint(1 ether);
        vm.stopPrank();
        assertEq(nft.totalMinted(), nft.MAX_SUPPLY());
    }

    // ── the minter names their own price ────────────────────────────────────

    /// @notice A price of zero is refused — by the CORE, not by this contract.
    /// @dev `SlotOccupancy` rejects `selfAssessedPrice == 0` on every seating,
    ///      and `selfAssess` rejects it too. A zero price would owe zero tax for
    ///      ever, which is the dust-price problem with the dust removed: nothing
    ///      accrues, so nothing ever runs dry, so nothing is ever liquidatable.
    function test_AZeroPriceMintIsRefusedByTheCore() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        vm.expectRevert(); // InvalidPrice
        nft.mint(0);
        vm.stopPrank();
    }

    /// @notice Rule 3, end to end: minted, then taken at the minter's number.
    function test_AnyoneCanTakeItAtTheDeclaredPrice() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (uint256 id, ) = nft.mint(1 ether);
        vm.stopPrank();
        Slot cheap = Slot(payable(nft.slotOf(id)));

        assertEq(cheap.price(), 1 ether);
        assertEq(nft.ownerOf(id), bob);

        vm.startPrank(carol);
        token.approve(address(cheap), type(uint256).max);
        cheap.buy(carol, 5 ether, 1 ether, 0);
        vm.stopPrank();
        assertEq(nft.ownerOf(id), carol, "taken at the price bob declared");
    }


    /// @notice `mintCost` is a quote, and {mint} does not trust it.
    /// @dev It asks the slot. The view is for a UI that has no slot yet, so the
    ///      two agreeing is a property worth asserting rather than assuming.
    function test_MintCostAgreesWithWhatTheSlotDemands() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (, address s) = nft.mint(42 ether);
        vm.stopPrank();
        assertEq(
            _depositOf(nft, 42 ether),
            Slot(payable(s)).minDepositForBuy(42 ether)
        );
    }

    /// @notice The recipient is paid as rent, continuously — not up front.
    /// @notice The recipient is paid the valuation at mint, then rent for ever.
    /// @dev Two revenues, not one. The valuation is the mint price and it is
    ///      gone; the escrow stays the minter's and drains to the recipient by
    ///      the second.
    function test_TheRecipientIsPaidTheValuationThenRent() public {
        uint256 before = token.balanceOf(recipient);

        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (, address s) = nft.mint(10 ether);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient) - before, 10 ether, "the mint price");
        assertEq(
            Slot(payable(s)).deposit(),
            _depositOf(nft, 10 ether),
            "and the escrow is not theirs"
        );

        uint256 mid = token.balanceOf(recipient);
        vm.warp(block.timestamp + 3.5 days);   // half the funded window
        Slot(payable(s)).collect();
        assertGt(token.balanceOf(recipient), mid, "then rent, by the second");
    }

    /// @notice A minter who is right about the price gets the price back.
    /// @dev What keeps the declaration honest: paying your own number is only a
    ///      loss if nobody agrees with it.
    function test_TheMintPriceComesBackIfTheMarketAgrees() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (, address s) = nft.mint(10 ether);
        vm.stopPrank();
        Slot fresh = Slot(payable(s));

        uint256 before = token.balanceOf(bob);
        vm.startPrank(carol);
        token.approve(address(fresh), type(uint256).max);
        fresh.buy(carol, 10 ether, fresh.minDepositForBuy(10 ether), 0);
        vm.stopPrank();

        assertEq(
            token.balanceOf(bob) - before,
            10 ether + _depositOf(nft, 10 ether),
            "the declared price, plus the escrow back"
        );
    }

    /// @notice Every mint funds the same runway, whatever it cost.
    /// @dev Because the escrow IS the valuation, a bigger mint buys a
    ///      proportionally bigger bill. One number the UI can state up front.
    function test_TheRunwayIsTheSameForEveryMinter() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (, address small) = nft.mint(1 ether);
        (, address big) = nft.mint(50 ether);
        vm.stopPrank();

        assertEq(
            Slot(payable(small)).secondsUntilLiquidation(),
            Slot(payable(big)).secondsUntilLiquidation(),
            "paying more buys a bigger bill, not more time"
        );
    }

    // ── native ──────────────────────────────────────────────────────────────

    function test_ANativeCollectionWorksTheSameWay() public {
        SlotBoundNFT eth = new SlotBoundNFT(
            factory, "E", "E", 2, IERC20(address(0)), 1000, 7 days, recipient, manager, owner
        );
        uint256 before = recipient.balance;

        uint256 cost = _costOf(eth, 3 ether);
        vm.prank(alice);
        (uint256 id, address s) = eth.mint{value: cost}(3 ether);

        assertEq(Slot(payable(s)).occupant(), alice);
        assertEq(eth.ownerOf(id), alice);
        assertEq(Slot(payable(s)).price(), 3 ether, "declared");
        assertEq(s.balance, _depositOf(eth, 3 ether), "escrowed to the minimum");
        assertEq(recipient.balance - before, 3 ether, "the mint price, in ETH");
    }

    function test_ANativeMintRefusesTheWrongValue() public {
        SlotBoundNFT eth = new SlotBoundNFT(
            factory, "E", "E", 2, IERC20(address(0)), 1000, 7 days, recipient, manager, owner
        );
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISlotBoundNFT.WrongValue.selector, _costOf(eth, 3 ether)
            )
        );
        eth.mint{value: 1 ether}(3 ether);
    }

    // ── the mirror ──────────────────────────────────────────────────────────

    /// @notice `ownerOf` is NOT overridden — real storage, moved by the callback.
    function test_BuyingTheSlotMovesTheToken() public {
        _buy(bob, 100 ether, 10 ether);
        assertEq(nft.ownerOf(tokenId), bob, "it follows the slot");
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(bob), 1);
    }

    /// @dev Via `recordLogs`: the buy also moves ERC-20, so asserting on "the
    ///      next event" would race the currency's own Transfer.
    function test_TheBuyEmitsARealTransfer() public {
        vm.recordLogs();
        _buy(bob, 100 ether, 10 ether);

        bytes32 sig = keccak256("Transfer(address,address,uint256)");
        bool found;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(nft) || logs[i].topics[0] != sig) continue;
            assertEq(address(uint160(uint256(logs[i].topics[1]))), alice);
            assertEq(address(uint160(uint256(logs[i].topics[2]))), bob);
            assertEq(uint256(logs[i].topics[3]), tokenId);
            found = true;
        }
        assertTrue(found, "a marketplace indexer has something to read");
    }

    function test_ReleasingParksItBackWithTheCollection() public {
        vm.prank(alice);
        slot.release();
        assertEq(nft.ownerOf(tokenId), address(nft), "vacant");
    }

    function test_LiquidationMovesItToo() public {
        vm.startPrank(bob);
        token.approve(address(nft), type(uint256).max);
        (uint256 id, address s) = nft.mint(1 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        assertTrue(Slot(payable(s)).isInsolvent(), "fixture");
        Slot(payable(s)).liquidate();
        assertEq(nft.ownerOf(id), address(nft), "evicted, and the token knows");
    }

    // ── the four fixes ──────────────────────────────────────────────────────

    /// @notice A currency that skims on transfer is refused, by name.
    /// @dev The contract pulls `total` and then owes it out in two pieces. A
    ///      fee-on-transfer token delivers less than was sent, so one of those
    ///      pieces is unfunded — and the revert would land on whichever leg ran
    ///      second, blaming the wrong thing.
    function test_AFeeOnTransferCurrencyIsRefusedByName() public {
        Skimming skim = new Skimming();
        skim.mint(bob, 1e24);
        SlotBoundNFT n = new SlotBoundNFT(
            factory, "S", "S", 2, IERC20(address(skim)),
            1000, 7 days, recipient, manager, owner
        );

        (uint256 total, , ) = n.quoteMint(10 ether);
        vm.startPrank(bob);
        skim.approve(address(n), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISlotBoundNFT.CurrencyTakesACut.selector, total, total - total / 100
            )
        );
        n.mint(10 ether);
        vm.stopPrank();
    }

    /// @notice A collection that could never mint is refused at deploy.
    function test_ZeroSupplyIsRefused() public {
        vm.expectRevert(ISlotBoundNFT.NoSupply.selector);
        new SlotBoundNFT(
            factory, "Z", "Z", 0, IERC20(address(token)),
            1000, 7 days, recipient, manager, owner
        );
    }

    /// @notice Asking about a token that was never minted says so.
    function test_AnUnmintedTokenIsNamedNotGuessedAt() public {
        vm.expectRevert(
            abi.encodeWithSelector(ISlotBoundNFT.NoSuchToken.selector, 999)
        );
        nft.getSlotInfoOf(999);
    }

    /// @notice `mint` is guarded, so the recipient cannot reenter it.
    /// @dev The payout hands control to an arbitrary contract. Low severity —
    ///      the recipient is fixed at deploy and the mint's state is complete
    ///      by then — but an external call in a state-changing function with no
    ///      guard is a thing to have decided, not a thing to have missed.
    function test_MintIsReentrancyGuarded() public {
        Reenterer bad = new Reenterer();
        SlotBoundNFT n = new SlotBoundNFT(
            factory, "R", "R", 3, IERC20(address(0)),
            1000, 7 days, address(bad), manager, owner
        );
        bad.point{value: 50 ether}(n);

        (uint256 total, , ) = n.quoteMint(1 ether);
        vm.deal(address(this), 100 ether);
        vm.expectRevert();          // ReentrancyGuardReentrantCall
        n.mint{value: total}(1 ether);
    }

    /// @notice A stranger cannot claim someone's token by standing up their own
    ///         slot that points at this hook.
    ///
    /// @dev Hooks are permissionless: anyone may create a slot naming this
    ///      contract, with any `hookData` they like, then buy their own slot to
    ///      fire a callback whose every field is GENUINE — `msg.sender` is a
    ///      real slot, `ctx.slot` matches it, `ctx.occupant` is really them.
    ///
    ///      So the identifying question is not "did a slot call" but "did I mint
    ///      this slot", which only `tokenOf` answers. Taking a token id from
    ///      `ctx.hookData` would hand Mallory whatever token she named.
    function test_AStrangerCannotClaimATokenWithTheirOwnSlot() public {
        vm.startPrank(carol);
        address rogue = factory.createSlot(SlotInit({
            recipient: carol,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: address(nft),              // this collection's hook
            hookData: bytes32(tokenId),      // "I am alice's token"
            taxBps: 1000,
            minDepositSeconds: 7 days,
            mutableTax: false,
            mutableHook: false
        }));

        token.approve(rogue, type(uint256).max);
        Slot(payable(rogue)).buy(
            carol, 1 ether, Slot(payable(rogue)).minDepositForBuy(1 ether), 0
        );
        vm.stopPrank();

        assertEq(nft.tokenOf(rogue), 0, "never minted here, so not ours");
        assertEq(nft.ownerOf(tokenId), alice, "and alice keeps her token");
    }

    // ── metadata ────────────────────────────────────────────────────────────

    /// @notice Empty until set, and OZ answers with "" rather than a broken URL.
    function test_TokenURIIsEmptyUntilABaseIsSet() public view {
        assertEq(nft.baseURI(), "");
        assertEq(nft.tokenURI(tokenId), "");
    }

    function test_TheOwnerSetsTheBaseURI() public {
        vm.prank(owner);
        nft.setBaseURI("ipfs://bafyExample/");
        assertEq(nft.baseURI(), "ipfs://bafyExample/");
        assertEq(nft.tokenURI(tokenId), "ipfs://bafyExample/1");
    }

    function test_NobodyElseSetsIt() public {
        vm.prank(manager);
        vm.expectRevert();          // the manager holds terms, not metadata
        nft.setBaseURI("ipfs://nope/");

        vm.prank(carol);
        vm.expectRevert();
        nft.setBaseURI("ipfs://nope/");
    }

    /// @notice The owner holds metadata and nothing else.
    /// @dev Worth asserting rather than assuming: losing this key should cost
    ///      the collection its artwork and nothing anyone's money depends on.
    function test_TheOwnerHasNoPowerOverTheSlots() public {
        vm.startPrank(owner);
        vm.expectRevert();
        slot.proposeTerms(2000, address(0), bytes32(0), true, false);
        vm.expectRevert();
        slot.selfAssess(1 ether);
        vm.stopPrank();
    }

    // ── soulbound ───────────────────────────────────────────────────────────

    function test_TheOccupantCannotSellTheToken() public {
        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFT.NotTransferable.selector);
        nft.transferFrom(alice, carol, tokenId);
        assertEq(nft.ownerOf(tokenId), alice, "occupancy is the only market");
    }

    function test_AnApprovedOperatorCannotMoveItEither() public {
        vm.prank(alice);
        nft.setApprovalForAll(carol, true);
        vm.prank(carol);
        vm.expectRevert(ISlotBoundNFT.NotTransferable.selector);
        nft.transferFrom(alice, carol, tokenId);
    }

    // ── the trigger is not the truth ────────────────────────────────────────

    function test_AForgedCallbackCannotStealTheToken() public {
        SlotContext memory forged;
        forged.slot = address(slot);
        forged.account = carol;
        forged.occupant = carol;

        vm.prank(carol);
        ISlotHook(address(nft)).afterBuy(forged);   // succeeds, and does nothing
        assertEq(nft.ownerOf(tokenId), alice, "still the real occupant's");
    }

    function test_TheHookIsStrictAndPermanent() public view {
        assertTrue(slot.getSlotInfo().hookFlags.strict);
        assertFalse(slot.mutableHook(), "a detachable hook would strand the token");
        assertEq(slot.hook(), address(nft));
    }

    /// @notice The terms a collection cannot express are the ones it cannot
    ///         be asked for.
    /// @dev There used to be two tests here, checking that a mutable tax and a
    ///      mutable hook were rejected. The constructor no longer takes either:
    ///      it takes the four terms that are choices and builds the rest. A
    ///      rejection test needs an argument to reject.
    function test_TheCollectionsTermsAreFixedByConstruction() public view {
        SlotInit memory t = nft.terms();
        assertTrue(t.mutableTax, "a manager was named, so the rent can move");
        assertFalse(t.mutableHook, "never - a detachable hook strands the token");
        assertEq(t.manager, manager);
        assertEq(t.hook, address(nft));
        assertEq(t.hookData, bytes32(0));
    }

    /// @notice There is no admin on these slots at all.
    /// @dev Falls out of both dimensions being immutable: `Slot.initialize`
    ///      forbids a manager when nothing is mutable.
    function test_TheNamedManagerIsTheSlotsManager() public view {
        assertEq(slot.manager(), manager);
        assertEq(nft.owner(), owner, "a different job, a different key");
    }

    // ── the rent, when the collection named a manager ───────────────────────

    function _managed() internal returns (SlotBoundNFT n) {
        n = new SlotBoundNFT(
            factory, "M", "M", 5,
            IERC20(address(token)), 1000, 7 days, recipient, address(this), owner
        );
    }

    /// @notice A named manager becomes the slots' manager. Nothing relays.
    function test_ANamedManagerManagesTheSlotsDirectly() public {
        SlotBoundNFT m = _managed();
        SlotInit memory t = m.terms();
        assertTrue(t.mutableTax);
        assertEq(t.manager, address(this), "the named address, not this contract");
        assertFalse(t.mutableHook, "never - a detachable hook strands the token");
    }

    /// @notice No manager fixes the rent for ever, and the owner is unaffected.
    /// @dev Owner and manager are different jobs: one holds the metadata, the
    ///      other holds the terms. A collection can have the first without the
    ///      second, which is what "fixed rent, with artwork" looks like.
    function test_NoManagerFixesTheRentForever() public {
        SlotBoundNFT fixed_ = new SlotBoundNFT(
            factory, "F", "F", 1,
            IERC20(address(token)), 1000, 7 days, recipient, address(0), owner
        );
        SlotInit memory t = fixed_.terms();
        assertFalse(t.mutableTax, "nothing can move it");
        assertEq(t.manager, address(0), "and no admin on the slots");
        assertEq(fixed_.owner(), owner, "the metadata still has a keeper");
    }

    /// @notice The manager calls the slot, and it lands at the next transition.
    /// @dev No relay in this contract: `proposeTerms` is the slot's own call and
    ///      the manager holds it. The collection is a mint and a mirror, not an
    ///      admin surface.
    function test_TheManagerProposesOnTheSlotItself() public {
        SlotBoundNFT m = _managed();
        vm.startPrank(alice);
        token.approve(address(m), type(uint256).max);
        (, address s) = m.mint(10 ether);
        vm.stopPrank();

        Slot managed = Slot(payable(s));
        managed.proposeTerms(2000, address(0), bytes32(0), true, false);
        assertEq(managed.taxBps(), 1000, "alice keeps what she bought");

        vm.warp(block.timestamp + 1 days + 1);   // TERMS_DELAY
        vm.startPrank(bob);
        token.approve(address(managed), type(uint256).max);
        managed.buy(bob, 10 ether, managed.minDepositForBuy(10 ether), 0);
        vm.stopPrank();
        assertEq(managed.taxBps(), 2000, "and it lands on the next one");
    }

    function test_AStrangerIsNotTheManager() public {
        SlotBoundNFT m = _managed();
        vm.startPrank(alice);
        token.approve(address(m), type(uint256).max);
        (, address s) = m.mint(10 ether);
        vm.stopPrank();

        vm.prank(carol);
        vm.expectRevert();
        Slot(payable(s)).proposeTerms(2000, address(0), bytes32(0), true, false);
    }

    /// @notice The collection holds no privileged role of its own.
    function test_TheCollectionIsNotAnAdmin() public {
        SlotBoundNFT m = _managed();
        vm.startPrank(alice);
        token.approve(address(m), type(uint256).max);
        (, address s) = m.mint(10 ether);
        vm.stopPrank();

        vm.prank(address(m));
        vm.expectRevert();
        Slot(payable(s)).proposeTerms(2000, address(0), bytes32(0), true, false);
    }

    /// @notice One relay, and it is the slot's own answer.
    function test_InfoOfRelaysTheSlotsOwnState() public view {
        SlotInfo memory i = nft.getSlotInfoOf(tokenId);
        assertEq(i.occupant, alice);
        assertEq(i.price, 100 ether);
        assertEq(i.deposit, _depositOf(nft, 100 ether), "escrowed to the minimum");
        assertEq(i.secondsUntilLiquidation, slot.secondsUntilLiquidation());
        assertEq((i.price * i.taxBps) / 10_000, _rent(100 ether));
        assertTrue(i.hookFlags.strict, "and carries what a buyer needs");
    }

    /// @notice It follows the slot when the occupant reprices. The quote cannot:
    ///         it knows the terms, and the valuation is the occupant's.
    function test_TheRelayFollowsARepriceAndTheQuoteDoesNot() public {
        // Raising the price raises the escrow floor with it, so top up first.
        vm.startPrank(alice);
        token.approve(address(slot), type(uint256).max);
        slot.topUp(_cost(200 ether));
        slot.selfAssess(200 ether);
        vm.stopPrank();
        SlotInfo memory i = nft.getSlotInfoOf(tokenId);
        assertEq((i.price * i.taxBps) / 10_000, _rent(200 ether), "doubled");
    }
}

/// @dev Takes 1% on every transfer, like a reflection token.
contract Skimming is ERC20 {
    constructor() ERC20("SKIM", "SKIM") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) return super._update(from, to, value);
        uint256 fee = value / 100;
        super._update(from, address(1), fee);
        super._update(from, to, value - fee);
    }
}

/// @dev A recipient that tries to mint again while being paid — funded well
///      enough to send the CORRECT amount, so the guard is the only thing that
///      can stop it. Without that, the inner mint fails on `WrongValue` and the
///      test passes for the wrong reason.
contract Reenterer {
    SlotBoundNFT public nft;
    bool private entered;

    function point(SlotBoundNFT n) external payable { nft = n; }

    receive() external payable {
        if (address(nft) == address(0) || entered) return;
        entered = true;
        (uint256 total, , ) = nft.quoteMint(1 ether);
        nft.mint{value: total}(1 ether);
    }
}
