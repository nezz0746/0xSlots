// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IOccupancyPolicy} from "../src/interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";
import {TokenHolderPolicy} from "../src/policies/TokenHolderPolicy.sol";

contract THMockERC20 is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract THMockERC721 is ERC721 {
    uint256 public next = 1;
    constructor() ERC721("Members", "MEMBER") {}
    function mint(address to) external returns (uint256 id) {
        id = next++;
        _mint(to, id);
    }
}

/// @notice A module buying on a user's behalf — the shape `SlotData.buyAndWrite`
///         and `FeedRouter.buyAndPost` take. It is `caller`; the user it names
///         is `account` and becomes the occupant.
contract THBuyingModule {
    function buyFor(Slot s, IERC20 currency, address account, uint256 dep, uint256 px) external {
        currency.transferFrom(msg.sender, address(this), dep);
        currency.approve(address(s), dep);
        s.buy(account, dep, px);
    }
}

/**
 * @title TokenHolderPolicyTest
 * @notice Only holders of an ERC-721 collection may take the slot.
 *
 * @dev Two design calls carry the weight here, and both are the kind that rot
 *      silently if nothing pins them:
 *
 *        1. The gate reads `ctx.account`, never `ctx.caller`. Buying through a
 *           module is the normal path in this protocol, and gating the caller
 *           would reject every module while letting one hold a slot for anybody.
 *
 *        2. `checkPriceUpdate` is deliberately open. Gating it would stop an
 *           ex-holder LOWERING their price, which is how an occupant reduces
 *           tax and exits — turning a membership rule into a debt.
 */
contract TokenHolderPolicyTest is Test {
    SlotFactory factory;
    THMockERC20 usdc;
    THMockERC721 members;
    TokenHolderPolicy policy;

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");     // holder
    address bob = makeAddr("bob");         // holder
    address carol = makeAddr("carol");     // never a holder

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));

        usdc = new THMockERC20();
        members = new THMockERC721();
        policy = new TokenHolderPolicy(IERC721(address(members)));

        usdc.mint(alice, 1e12);
        usdc.mint(bob, 1e12);
        usdc.mint(carol, 1e12);
        members.mint(alice);
        members.mint(bob);

        vm.warp(1_000_000);
    }

    function _slot() internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(usdc)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(0),
                liquidationBountyBps: 500,
                minDepositSeconds: 0,
                occupancyPolicy: address(policy)
            })
        ));
    }

    function _buy(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        usdc.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    // ── The gate ────────────────────────────────────────────────────────────

    function test_HolderCanTakeTheSlot() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);
        assertEq(s.occupant(), alice);
    }

    function test_NonHolderIsRefused() public {
        Slot s = _slot();
        vm.startPrank(carol);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TokenHolderPolicy.NotAHolder.selector, carol));
        s.buy(carol, 10e6, 100e6);
        vm.stopPrank();
    }

    function test_HolderCanTakeItFromAnotherHolder() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);
        _buy(s, bob, 10e6, 120e6);
        assertEq(s.occupant(), bob);
    }

    /// @dev Forced sale is not delayed at all — only the buyer set is narrowed.
    function test_NonHolderCannotForceSaleEither() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);

        vm.startPrank(carol);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TokenHolderPolicy.NotAHolder.selector, carol));
        s.buy(carol, 10e6, 200e6);
        vm.stopPrank();
    }

    // ── account, not caller ─────────────────────────────────────────────────

    /// @dev The case that breaks a naive implementation. The module is `caller`
    ///      and holds nothing; the holder it buys for is `account`.
    function test_ModuleMayBuyForAHolder() public {
        Slot s = _slot();
        THBuyingModule mod = new THBuyingModule();

        vm.startPrank(alice);
        usdc.approve(address(mod), type(uint256).max);
        mod.buyFor(s, IERC20(address(usdc)), alice, 10e6, 100e6);
        vm.stopPrank();

        assertEq(s.occupant(), alice, "the holder occupies, not the module");
        assertEq(members.balanceOf(address(mod)), 0, "module holds no token");
    }

    /// @dev And the converse: a module cannot be used to smuggle a non-holder in.
    function test_ModuleCannotBuyForANonHolder() public {
        Slot s = _slot();
        THBuyingModule mod = new THBuyingModule();

        vm.startPrank(carol);
        usdc.approve(address(mod), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TokenHolderPolicy.NotAHolder.selector, carol));
        mod.buyFor(s, IERC20(address(usdc)), carol, 10e6, 100e6);
        vm.stopPrank();
    }

    // ── Entry, not continuous ───────────────────────────────────────────────

    /// @dev The occupant sells their token and keeps the slot. Deliberate: see
    ///      the contract's note on why gating repricing would be a debt trap.
    function test_SellingTheTokenDoesNotEndOccupancy() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);

        vm.prank(alice);
        members.transferFrom(alice, carol, 1);
        assertEq(members.balanceOf(alice), 0);

        assertEq(s.occupant(), alice, "still holds the slot");
    }

    /// @dev The reason the above is safe: an ex-holder can still LOWER their
    ///      price, which is how they shed tax and leave.
    function test_ExHolderCanStillLowerTheirPrice() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);

        vm.prank(alice);
        members.transferFrom(alice, carol, 1);

        vm.prank(alice);
        s.selfAssess(1e6);
        assertEq(s.price(), 1e6);
    }

    /// @dev And they can leave outright — release is never routed through a
    ///      policy, so no gate can hold anyone in.
    function test_ExHolderCanRelease() public {
        Slot s = _slot();
        _buy(s, alice, 10e6, 100e6);

        vm.prank(alice);
        members.transferFrom(alice, carol, 1);

        vm.prank(alice);
        s.release();
        assertEq(s.occupant(), address(0));
    }

    /// @dev Ownership is read at the instant of the buy, so a token held for
    ///      one transaction satisfies it. Pinned as a KNOWN PROPERTY rather
    ///      than a bug — ERC-721 exposes no holding duration to check against.
    function test_KnownProperty_ABorrowedTokenSatisfiesTheGate() public {
        Slot s = _slot();

        vm.prank(bob);
        members.transferFrom(bob, carol, 2);   // carol borrows

        _buy(s, carol, 10e6, 100e6);

        vm.prank(carol);
        members.transferFrom(carol, bob, 2);   // and returns it

        assertEq(s.occupant(), carol);
        assertEq(members.balanceOf(carol), 0);
    }

    // ── Wiring ──────────────────────────────────────────────────────────────

    function test_RejectsACollectionWithNoCode() public {
        vm.expectRevert(TokenHolderPolicy.NotAContract.selector);
        new TokenHolderPolicy(IERC721(makeAddr("nothing")));
    }

    function test_AdvertisesBothInterfaceIds() public view {
        assertTrue(policy.supportsInterface(type(IOccupancyPolicy).interfaceId));
        assertTrue(policy.supportsInterface(type(IModuleMetadata).interfaceId));
        assertTrue(policy.supportsInterface(type(IERC165).interfaceId));
    }

    function test_OnePolicyServesManySlots() public {
        Slot a = _slot();
        Slot b = _slot();
        _buy(a, alice, 10e6, 100e6);
        _buy(b, bob, 10e6, 100e6);
        assertEq(a.occupancyPolicy(), b.occupancyPolicy());
    }
}
