// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, AppTerms, Manifest} from "../../src/types/SlotTypes.sol";
import {ISlotApp, SlotContext} from "../../src/interfaces/ISlotApp.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {SlotMath} from "../../src/libraries/SlotMath.sol";
import {ManifestTooExpensive} from "../../src/errors/SlotErrors.sol";

/// @dev Burns a lot of gas on every transfer to `sink`.
contract GasHog is ERC20 {
    address public immutable sink;

    constructor(address sink_) ERC20("H", "H") {
        sink = sink_;
    }

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (to == sink) {
            uint256 x;
            for (uint256 i; i < 2_000; ++i) x = uint256(keccak256(abi.encode(x, i)));
        }
        super._update(from, to, value);
    }
}

/// @dev A healthy app whose configuration check is expensive but well inside
///      its stipend.
contract HeavyApp is ISlotApp {
    function checkSettings(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 700; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function manifest(bytes32) external pure returns (Manifest memory o) {
        o.scopes = ScopesLib.AFTER_SETTLE;
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

/// @notice A queued app must never be erased by a caller tuning gas.
contract HookReadGasTest is Test {
    address sink = makeAddr("sink");
    address alice = makeAddr("alice");

    /// @dev Swept across gas limits, against a payout whose token transfer burns
    ///      more than an app read's whole stipend. An eviction carries no terms,
    ///      so whatever gas it is given, the queued app is neither attached nor
    ///      erased — there is no read on this path to starve.
    function test_AnEvictionNeitherAttachesNorErasesAQueuedApp() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        GasHog token = new GasHog(sink);
        HeavyApp heavy = new HeavyApp();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(token)),
            manager: address(this),
            mutableTax: false, mutableRecipient: false, mutableApp: true,
            taxTerms: TaxTerms({recipient: sink, rateBps: 1000, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: address(0), settings: bytes32(0)})
        }))));

        token.mint(alice, 1_000 ether);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, SlotMath.depositFor(1 ether, 1000, 1 days), 0);
        vm.stopPrank();

        TaxTerms memory none;
        s.proposeTerms(none, AppTerms({target: address(heavy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + 30 days);
        assertTrue(s.isInsolvent());

        uint256 evicted;
        for (uint256 g = 400_000; g <= 1_600_000; g += 5_000) {
            uint256 snap = vm.snapshotState();
            (bool ok, ) = address(s).call{gas: g}(abi.encodeWithSignature("liquidate()"));
            if (ok) {
                assertEq(s.app(), address(0), "an eviction attaches nothing");
                assertEq(s.pendingTerms().mask & 8, 8, "and erases nothing");
                ++evicted;
            }
            vm.revertToState(snap);
        }
        assertGt(evicted, 0, "the eviction lands at ordinary gas limits");
    }
}

/// @notice A buyer cannot starve the app read to dodge the app that would
///         gate them.
///
/// @dev The claim under test: with the gas guard gone, a buyer picks a gas
///      limit that makes the incoming app's read fail, the slot detaches the
///      app as unreachable, and `beforeBuy` never runs. EIP-150 is what stops
///      it: the read is a `staticcall` with a fixed stipend, so starving it
///      means `63/64` of what is left is under that stipend — and the `1/64`
///      kept back is then far too little to finish the buy. The transaction
///      runs out of gas instead of seating anybody.
contract BuyGasStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheAppReadAndBeSeatedUnguarded() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        VetoApp veto = new VetoApp();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: address(0), settings: bytes32(0)})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(veto), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        uint256 dep = s.minDepositForBuy(1 ether);
        vm.deal(alice, 1_000 ether);

        uint256 seated;
        for (uint256 g = 100_000; g <= 3_000_000; g += 20_000) {
            uint256 snap = vm.snapshotState();
            vm.prank(alice);
            (bool ok, ) = address(s).call{value: dep, gas: g}(
                abi.encodeWithSignature("buy(address,uint256,uint256,uint256)", alice, 1 ether, dep, 0)
            );
            if (ok) {
                ++seated;
                assertEq(s.app(), address(veto), "seated only with the app attached");
            }
            vm.revertToState(snap);
        }
        // The app vetoes every buy, so no gas limit should ever seat anybody.
        assertEq(seated, 0, "no gas limit slips past the veto");
    }
}

/// @dev Refuses every buy, and costs little to read.
contract VetoApp is ISlotApp {
    error Vetoed();

    function manifest(bytes32) external pure returns (Manifest memory o) {
        o.scopes = ScopesLib.BEFORE_BUY;
    }

    function checkSettings(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {
        revert Vetoed();
    }
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}

}

/// @dev Healthy, and expensive to read: the costlier the read, the wider the
///      window a caller tuning gas would have to aim at.
contract PricyApp is ISlotApp {
    function checkSettings(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function manifest(bytes32) external pure returns (Manifest memory o) {
        uint256 x;
        for (uint256 i; i < 500; ++i) x = uint256(keccak256(abi.encode(x, i)));
        o.scopes = ScopesLib.BEFORE_BUY;
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

/**
 * A buyer cannot detach the app they are about to be seated under.
 *
 * The read that attaches a queued app fails open, so a starved read would
 * attach nothing and let the buy through unguarded. It cannot be starved: the
 * stipend is capped, so the only way to give the app less than it needs is to
 * enter the read with less than the cap — and a read that dies there burns
 * 63/64 of what was left, which is the gas the rest of the buy needed.
 */
contract QueuedHookStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheReadThatAttachesAQueuedApp() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        PricyApp pricy = new PricyApp();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: address(0), settings: bytes32(0)})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, AppTerms({target: address(pricy), settings: bytes32(0)}), 8);
        vm.warp(block.timestamp + s.TERMS_DELAY() + 1);

        uint256 dep = s.minDepositForBuy(1 ether);
        vm.deal(alice, 1_000 ether);

        uint256 seated;
        for (uint256 g = 100_000; g <= 4_000_000; g += 10_000) {
            uint256 snap = vm.snapshotState();
            vm.prank(alice);
            (bool ok, ) = address(s).call{value: dep, gas: g}(
                abi.encodeWithSignature("buy(address,uint256,uint256,uint256)", alice, 1 ether, dep, 0)
            );
            if (ok) {
                ++seated;
                assertEq(s.app(), address(pricy), "a completed buy always attached the app");
                assertEq(s.occupant(), alice);
            }
            vm.revertToState(snap);
        }
        assertGt(seated, 0, "the sweep has to reach limits that do complete");
    }
}

/// @dev Answers honestly, but costs more than the stipend the slot reads it
///      under.
contract GluttonApp is ISlotApp {
    function checkSettings(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 1_500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function manifest(bytes32) external pure returns (Manifest memory o) {
        uint256 x;
        for (uint256 i; i < 1_500; ++i) x = uint256(keccak256(abi.encode(x, i)));
        o.scopes = ScopesLib.BEFORE_BUY;
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

/**
 * An app too expensive to read is refused where somebody can see it.
 *
 * The attach-time read is capped, and fails open: an app that cannot answer
 * inside its stipend is attached as nothing. Proposing is uncapped, so without
 * this the app would pass proposal and then quietly vanish a day later.
 */
contract HookStipendTest is Test {
    SlotFactory factory;
    address manager = makeAddr("manager");

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
    }

    function _init(address app) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableApp: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            appTerms: AppTerms({target: app, settings: bytes32(0)})
        });
    }

    function test_ASlotCannotBeCreatedWithOne() public {
        GluttonApp glutton = new GluttonApp();
        vm.expectRevert(ManifestTooExpensive.selector);
        factory.createSlot(_init(address(glutton)));
    }

    function test_ItCannotBeQueuedEither() public {
        Slot s = Slot(payable(factory.createSlot(_init(address(0)))));
        GluttonApp glutton = new GluttonApp();

        TaxTerms memory none;
        vm.prank(manager);
        vm.expectRevert(ManifestTooExpensive.selector);
        s.proposeTerms(none, AppTerms({target: address(glutton), settings: bytes32(0)}), 8);
    }

    /// @notice An app that fits is not caught by the same check.
    function test_AAppInsideItsStipendIsFine() public {
        PricyApp pricy = new PricyApp();
        Slot s = Slot(payable(factory.createSlot(_init(address(pricy)))));
        assertEq(s.app(), address(pricy));
    }
}
