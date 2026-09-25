// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotModule, Scopes, SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import "../../src/errors/SlotErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev A module that records everything and refuses nothing.
contract Recorder is AskModule {
    uint256 public buys;
    uint256 public releases;
    uint256 public liquidations;
    uint256 public settles;
    uint256 public lastPaid;

    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.afterSettle = true;
        o.scopes = ScopesLib.pack(f);
    }

    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata) external {
        buys++;
    }

    function afterRelease(SlotContext calldata) external {
        releases++;
    }

    function afterLiquidate(SlotContext calldata) external {
        liquidations++;
    }

    function afterSettle(SlotContext calldata c) external {
        settles++;
        lastPaid = c.paid;
    }

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata c) external {}
}

/// @dev Refuses every buy. The canonical `before` module.
contract DenyBuys is AskModule {
    error Denied();
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }

    function beforeBuy(SlotContext calldata) external view {
        revert Denied();
    }
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}
}

/// @dev Reverts in every `after`. Must never affect an outcome.
contract Hostile is AskModule {
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.afterSettle = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata) external pure {
        revert("no");
    }

    function afterSell(SlotContext calldata) external pure {
        revert("no");
    }

    function afterRelease(SlotContext calldata) external pure {
        revert("no");
    }

    function afterLiquidate(SlotContext calldata) external pure {
        revert("no");
    }

    function afterSettle(SlotContext calldata) external pure {
        revert("no");
    }

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external pure {}
}

/// @dev Burns every unit of gas it is handed.
contract GasBurner is AskModule {
    uint256 public sink;
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.afterLiquidate = true;
        f.afterSettle = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}

    function afterLiquidate(SlotContext calldata) external {
        while (true) sink++;
    }

    function afterSettle(SlotContext calldata) external {
        while (true) sink++;
    }

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}
}

contract SlotsTest is Test {
    SlotFactory factory;
    Tok token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice;
    uint256 aliceKey;
    address bob;
    uint256 bobKey;
    address carol = makeAddr("carol");

    function setUp() public {
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");

        Slot impl = new Slot();
        SlotFactory fImpl = new SlotFactory();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(fImpl),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(impl)))
                )
            )
        );

        token = new Tok();
        token.mint(alice, 1_000_000 ether);
        token.mint(bob, 1_000_000 ether);
        token.mint(carol, 1_000_000 ether);
        vm.warp(1_000_000);
    }

    function _init(address module, uint256 minDep) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(token)),
            manager: manager,
            mutableTax: true,
            mutableRecipient: true,
            mutableModule: true,
            taxTerms: TaxTerms({
                recipient: recipient, rateBps: uint16(1000), minRunwaySeconds: uint32(minDep)
            }),
            moduleTerms: ModuleTerms({target: module, settings: ""})
        });
    }

    function _slot(address module) internal returns (Slot) {
        return Slot(payable(factory.createSlot(_init(module, 0))));
    }

    function _take(Slot s, address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // The two guarantees
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice GUARANTEE 1: liquidation is unconditional.
    /// @dev A module that reverts in every `after` cannot stop an eviction. This
    ///      is the sentence every capped call and swallowed revert exists for.
    function test_AHostileModuleCannotBlockLiquidation() public {
        Hostile h = new Hostile();
        Slot s = _slot(address(h));
        _take(s, alice, 1 ether, 100 ether);

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "alice ran dry");

        vm.prank(carol);
        s.liquidate();

        assertTrue(s.isVacant(), "evicted anyway");
    }

    /// @notice ...and cannot do it by burning gas either.
    function test_AGasBurningModuleCannotBlockLiquidation() public {
        GasBurner h = new GasBurner();
        Slot s = _slot(address(h));
        _take(s, alice, 1 ether, 100 ether);
        vm.warp(block.timestamp + 3650 days);

        // A normal budget, not a generous one.
        (bool ok,) = address(s).call{gas: 2_000_000}(abi.encodeWithSignature("liquidate()"));
        assertTrue(ok, "eviction completes on a normal budget");
        assertTrue(s.isVacant());
    }

    /// @notice GUARANTEE 2: terms cannot move under an occupant.
    function test_ProposedTermsLandOnlyAtATransition() public {
        Slot s = _slot(address(0));
        _take(s, alice, 100 ether, 100 ether);

        vm.prank(manager);
        s.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: uint16(2000), minRunwaySeconds: 0}),
            ModuleTerms({target: address(0), settings: ""}),
            uint16(1)
        );

        vm.warp(block.timestamp + 10 days);
        assertEq(s.taxRateBps(), 1000, "alice's rate is untouched mid-tenure");

        _take(s, bob, 100 ether, 200 ether); // the transition
        assertEq(s.taxRateBps(), 2000, "and lands when the seat turns over");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // before decides, after records
    // ═══════════════════════════════════════════════════════════════════════

    function test_ABeforeModuleCanVetoAndSaysWhy() public {
        DenyBuys h = new DenyBuys();
        Slot s = _slot(address(h));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        // The module's own error surfaces, not a generic "call failed" — a vetoed
        // buy should say which rule refused it.
        vm.expectRevert(DenyBuys.Denied.selector);
        s.buy(alice, 100 ether, 1 ether, 0);
        vm.stopPrank();
    }

    function test_AnAfterModuleSeesEveryTransition() public {
        Recorder h = new Recorder();
        Slot s = _slot(address(h));

        _take(s, alice, 100 ether, 100 ether);
        assertEq(h.buys(), 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        s.release();
        assertEq(h.releases(), 1);
        assertGt(h.settles(), 0, "and settlements, with the amounts");
        assertGt(h.lastPaid(), 0);
    }

    /// @notice A module is skipped entirely for callbacks it did not declare.
    function test_UndeclaredCallbacksAreNeverCalled() public {
        // Recorder declares no `before*` at all.
        Recorder h = new Recorder();
        Slot s = _slot(address(h));

        // If beforeBuy were called despite not being declared, this would still
        // pass — so assert on the flags too.
        _take(s, alice, 1 ether, 100 ether);
        Scopes memory f = s.scopes();
        assertFalse(f.beforeBuy, "not declared");
        assertTrue(f.afterBuy, "declared");
    }

    /// @notice A module that answers `scopes` with nothing is refused outright.
    /// @dev The one place a bad module is NOT tolerated. It happens once, while
    ///      attaching, in a call the manager sent on purpose — attaching a module
    ///      that can never fire is a silent, permanent mistake.
    function test_AModuleSubscribingToNothingIsRefused() public {
        Slot s = _slot(address(0));
        // Deployed BEFORE the prank: a CREATE consumes `vm.prank` just like a
        // call would, so inlining it would send `proposeTerms` from the test
        // contract instead of the manager.
        address useless = address(new Nothing());

        vm.prank(manager);
        vm.expectRevert(InvalidModule.selector);
        s.proposeTerms(
            TaxTerms({recipient: address(0), rateBps: uint16(0), minRunwaySeconds: 0}),
            ModuleTerms({target: useless, settings: ""}),
            uint16(8)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Signed sell orders — REMOVED WITH `sell`
    //
    // Three tests lived here: that the occupant could not repartition the
    // buyer's approval, that an order was single-use, and that a cancelled
    // nonce could not be filled. All three tested `Slot.sell`, which is gone —
    // a consensual sale is now `selfAssess` then `buy`, performed by the
    // OfferBook. What they were defending against goes with the mechanism: the
    // book pulls exactly `quoteBuy` and spends it in the same transaction, so
    // there is no approval to repartition and no nonce to replay.
    //
    // The book's own coverage is in `OfferBook.t.sol`.
    // ═══════════════════════════════════════════════════════════════════════
    // Arithmetic
    // ═══════════════════════════════════════════════════════════════════════

    function test_AnAbsurdPriceIsRefusedRatherThanBrickingTheSlot() public {
        Slot s = _slot(address(0));
        vm.prank(alice);
        vm.expectRevert(InvalidPrice.selector);
        s.buy(alice, type(uint256).max, 0, 0);
        assertTrue(s.isVacant(), "and the slot is untouched");
    }

    function test_ARealisticPriceSettlesFine() public {
        Slot s = _slot(address(0));
        _take(s, alice, 1000 ether, 1_000_000_000 ether);
        vm.warp(block.timestamp + 365 days);
        s.collect();
        assertGt(token.balanceOf(recipient), 0, "recipient was paid");
    }
}

/// @dev Declares no subscriptions at all.
contract Nothing is AskModule {
    function checkSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}
}
