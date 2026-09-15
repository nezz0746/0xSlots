// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "../../src/hooks/nft/ISlotBoundNFTWrapper.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";
import {SlotContext} from "../../src/ISlotHook.sol";

contract MockNFT is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function tokenURI(uint256) public pure override returns (string memory) {
        return "ipfs://underlying";
    }
}

contract RevertingURINFT is ERC721 {
    constructor() ERC721("Bad", "BAD") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function tokenURI(uint256) public pure override returns (string memory) {
        revert("no metadata for you");
    }
}

contract SlotBoundNFTWrapperTest is Test {
    SlotFactory factory;
    SlotBoundNFTWrapper wrapper;
    MockNFT nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant TAX = 1000; // 10%
    uint256 constant VALUATION = 1 ether;

    uint256 tokenId;
    Slot slot;

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTWrapper wImpl = new SlotBoundNFTWrapper();
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(wImpl), address(this));
        wrapper = SlotBoundNFTWrapper(address(new BeaconProxy(address(beacon),
            abi.encodeCall(SlotBoundNFTWrapper.initialize,
                ("Wrapped Slots", "WSLOT", factory)))));

        nft = new MockNFT();
        nft.mint(alice, 1);
        nft.mint(alice, 2);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.warp(1_000_000);

        tokenId = _wrap(alice, 1, Mode.Permanent);
        slot = Slot(payable(wrapper.slotOf(tokenId)));
    }

    function _deposit(uint256 valuation) internal view returns (uint256) {
        return wrapper.quoteWrap(valuation, TAX);
    }

    function _wrap(address who, uint256 id, Mode mode) internal returns (uint256 newId) {
        vm.startPrank(who);
        nft.approve(address(wrapper), id);
        (newId, ) = wrapper.wrap{value: _deposit(VALUATION)}(
            IERC721(address(nft)), id, TAX, VALUATION, mode
        );
        vm.stopPrank();
    }

    // ── the wrap itself ─────────────────────────────────────────────────────

    /// @notice One transaction: escrowed, slot created, depositor seated,
    ///         token delivered.
    function test_WrappingEscrowsTheUnderlyingAndSeatsTheDepositor() public view {
        assertEq(nft.ownerOf(1), address(wrapper), "underlying is escrowed");
        assertEq(slot.occupant(), alice, "seated by the wrap itself");
        assertEq(wrapper.ownerOf(tokenId), alice, "and holding the token");
        assertEq(slot.price(), VALUATION);
        assertEq(wrapper.totalWrapped(), 1);
    }

    /// @notice The depositor keeps the economics of their own asset.
    function test_TheDepositorIsTheRecipientAndTheManager() public view {
        assertEq(slot.recipient(), alice, "earns the rent on their own asset");
        assertEq(slot.manager(), alice, "and may re-rate it");
        assertEq(slot.taxBps(), TAX, "at the rate they chose");
    }

    /// @notice The hook cannot be detached; detaching it would strand the token.
    function test_TheHookIsThisContractAndPermanent() public view {
        assertEq(slot.hook(), address(wrapper));
        assertFalse(slot.mutableHook(), "and permanently so");
        assertTrue(slot.mutableTax(), "but the rate can still move");
    }

    /// @notice The wrap records what backs the token.
    function test_TheWrapRecordsItsUnderlying() public view {
        Wrap memory w = wrapper.wrapOf(tokenId);
        assertEq(w.underlying, address(nft));
        assertEq(w.underlyingId, 1);
        assertEq(w.depositor, alice);
        assertFalse(w.retired);
        assertTrue(w.mode == Mode.Permanent);
    }

    /// @notice Ids start at one, so `tokenOf`'s zero-means-not-ours holds.
    function test_IdsStartAtOneSoZeroStaysMeaningful() public view {
        assertEq(tokenId, 1);
        assertEq(wrapper.tokenOf(address(slot)), 1);
        assertEq(wrapper.tokenOf(address(0xdead)), 0, "a stranger is not ours");
    }

    /// @notice `msg.value` funds the escrow and nothing else — the depositor
    ///         IS the recipient, so a valuation leg would be their own money
    ///         going in a circle.
    function test_TheWrapCostsTheDepositOnly() public {
        uint256 before = alice.balance;
        _wrap(alice, 2, Mode.Permanent);
        assertEq(before - alice.balance, _deposit(VALUATION));
    }

    /// @notice The floor is the slot's to enforce, not the wrapper's.
    function test_AnUnderfundedWrapIsRefusedByTheCore() public {
        // Hoisted. `_deposit` is an external call, and an argument expression
        // is evaluated AFTER `expectRevert` arms — inline, the quote itself
        // becomes "the next call" and the assertion catches the wrong frame.
        uint256 short = _deposit(VALUATION) - 1;

        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);
        vm.expectRevert();
        wrapper.wrap{value: short}(
            IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();
    }

    /// @notice Over-funding is longer runway, not an error.
    function test_OverfundingBuysRunway() public {
        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);
        (uint256 id2, address s2) = wrapper.wrap{value: _deposit(VALUATION) * 2}(
            IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();
        assertEq(Slot(payable(s2)).deposit(), _deposit(VALUATION) * 2);
        assertEq(wrapper.ownerOf(id2), alice);
    }

    /// @notice Zero price and a zero or excessive rate are the core's to refuse.
    function test_TheCoreRefusesADegenerateWrap() public {
        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, TAX, 0, Mode.Permanent);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, 0, VALUATION, Mode.Permanent);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, 10_001, VALUATION, Mode.Permanent);

        vm.stopPrank();
    }

    /// @notice You cannot wrap what you do not hold.
    function test_WrappingSomeoneElsesTokenIsRefused() public {
        vm.prank(bob);
        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent);
    }

    // ── the lifecycle, inherited wholesale ──────────────────────────────────

    function test_BuyingTheSlotMovesTheToken() public {
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);
        assertEq(wrapper.ownerOf(tokenId), bob, "ownership follows occupancy");
        assertEq(slot.occupant(), bob);
    }

    function test_ReleasingParksItBackWithTheWrapper() public {
        vm.prank(alice);
        slot.release();
        assertEq(slot.occupant(), address(0));
        assertEq(wrapper.ownerOf(tokenId), address(wrapper), "parked, not burned");
    }

    function test_LiquidationMovesItToo() public {
        vm.warp(block.timestamp + 3650 days);
        slot.liquidate();
        assertEq(slot.occupant(), address(0));
        assertEq(wrapper.ownerOf(tokenId), address(wrapper));
    }

    function test_TheOccupantCannotSellTheToken() public {
        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.NotTransferable.selector);
        wrapper.transferFrom(alice, bob, tokenId);
    }

    function test_AnApprovedOperatorCannotMoveItEither() public {
        vm.prank(alice);
        wrapper.setApprovalForAll(bob, true);
        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.NotTransferable.selector);
        wrapper.transferFrom(alice, bob, tokenId);
    }

    /// @dev `_sync` reads `occupant()` live and never the context. The `after`
    ///      entry points are world-callable by design, so a context someone
    ///      invented must be able to change nothing.
    function test_AForgedCallbackCannotStealTheToken() public {
        SlotContext memory forged;
        forged.slot = address(slot);
        forged.caller = bob;
        forged.account = bob;
        forged.occupant = bob;

        vm.prank(bob);
        wrapper.afterBuy(forged);

        assertEq(wrapper.ownerOf(tokenId), alice, "the live occupant is alice");
    }

    /// @notice A real {Transfer}, so marketplaces and indexers see the move.
    ///         Deriving `ownerOf` instead would emit nothing.
    function test_TheBuyEmitsARealTransfer() public {
        vm.expectEmit(true, true, true, true, address(wrapper));
        emit IERC721.Transfer(alice, bob, tokenId);
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);
    }

    /// @dev Someone stands up their own slot pointing at this hook and fires
    ///      the callback. `tokenOf` is zero for it, so nothing happens — and
    ///      it must not revert either: never revert on a stranger.
    function test_AStrangerCannotClaimATokenWithTheirOwnSlot() public {
        vm.prank(bob);
        address rogue = factory.createSlot(SlotInit({
            recipient: bob, currency: IERC20(address(0)), manager: bob,
            hook: address(wrapper), hookData: bytes32(0),
            taxBps: TAX, minDepositSeconds: 7 days,
            mutableTax: true, mutableHook: false
        }));
        assertEq(wrapper.tokenOf(rogue), 0, "not ours");
        assertEq(wrapper.ownerOf(tokenId), alice, "and alice keeps her token");
    }

    /// @notice The property this whole design leans on. The depositor manages
    ///         their own slot, and a manager can change NOTHING under a
    ///         sitting occupant — terms ripen for `TERMS_DELAY` and land at the
    ///         next occupancy transition. Without this, depositor-as-manager
    ///         plus depositor-as-withdrawer is a rug.
    function test_ARerateCannotTouchASittingOccupant() public {
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);

        vm.prank(alice);
        slot.proposeTerms(5000, address(0), bytes32(0), true, false);

        vm.warp(block.timestamp + 2 days); // well past TERMS_DELAY
        assertEq(slot.taxBps(), TAX, "still the rate bob bought under");

        vm.prank(bob);
        slot.release();
        assertEq(slot.taxBps(), 5000, "lands at the transition, never before");
    }

    /// @notice The retirement veto cannot be added later. The slot packs these
    ///         flags into `_hookFlags` at its own `initialize` and reads the
    ///         bit thereafter, so a wrapper shipped without `beforeBuy` leaves
    ///         every slot it ever creates permanently unable to refuse a buy —
    ///         and no beacon upgrade can retrofit it.
    function test_TheRetirementVetoIsSubscribedFromTheFirstWrap() public view {
        assertTrue(wrapper.subscriptions().beforeBuy, "or the veto is dead code");
        assertTrue(slot.hookFlags().beforeBuy, "and the slot cached it at creation");
    }

    function test_TheHookIsStrict() public view {
        assertTrue(wrapper.subscriptions().strict, "so the move cannot be starved");
        assertTrue(wrapper.subscriptions().afterBuy);
        assertTrue(wrapper.subscriptions().afterRelease);
        assertTrue(wrapper.subscriptions().afterLiquidate);
    }

    // ── finding a wrapper token from its underlying ─────────────────────────

    /// @notice The integration path: "I hold this NFT — which wrapper token is
    ///         it?" One call, no index, no event replay.
    function test_TokenIdOfFindsTheWrapperToken() public view {
        assertEq(wrapper.tokenIdOf(IERC721(address(nft)), 1), tokenId);
    }

    /// @notice Zero for something never wrapped — the same sentinel `tokenOf`
    ///         uses, and sound for the same reason: ids start at one.
    function test_TokenIdOfIsZeroForSomethingNeverWrapped() public view {
        assertEq(wrapper.tokenIdOf(IERC721(address(nft)), 2), 0);
    }

    // ── metadata ────────────────────────────────────────────────────────────

    /// @notice A wrapper token shows what it wraps.
    function test_TokenURIProxiesToTheUnderlying() public view {
        assertEq(wrapper.tokenURI(tokenId), "ipfs://underlying");
    }

    /// @notice The underlying is arbitrary and may misbehave. A token that
    ///         cannot render beats one that cannot be read at all.
    function test_ARevertingUnderlyingRendersEmptyRatherThanReverting() public {
        RevertingURINFT bad = new RevertingURINFT();
        bad.mint(alice, 7);

        vm.startPrank(alice);
        bad.approve(address(wrapper), 7);
        (uint256 badId, ) = wrapper.wrap{value: _deposit(VALUATION)}(
            IERC721(address(bad)), 7, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();

        assertEq(wrapper.tokenURI(badId), "");
    }

    function test_AnUnwrappedTokenIsNamedNotGuessedAt() public {
        vm.expectRevert(abi.encodeWithSelector(ISlotBoundNFT.NoSuchToken.selector, uint256(99)));
        wrapper.tokenURI(99);
    }

    /// @notice There is no privileged party at all — no owner, no base URI.
    function test_TheWrapperHasNoOwner() public {
        (bool ok, ) = address(wrapper).staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(ok, "no Ownable surface");
    }
}
