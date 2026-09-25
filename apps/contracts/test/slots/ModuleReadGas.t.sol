// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";
import {ISlotModule, SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {SlotMath} from "../../src/libraries/SlotMath.sol";
import {ModuleTooExpensive} from "../../src/errors/SlotErrors.sol";

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

/// @dev A healthy module whose configuration check is expensive but well inside
///      its stipend.
contract HeavyModule is AskModule {
    function checkSettings(bytes calldata) external pure {
        uint256 x;
        for (uint256 i; i < 700; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
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

/// @notice A queued module must never be erased by a caller tuning gas.
contract ModuleReadGasTest is Test {
    address sink = makeAddr("sink");
    address alice = makeAddr("alice");

    /// @dev Swept across gas limits, against a payout whose token transfer burns
    ///      more than a module read's whole stipend. An eviction carries no terms,
    ///      so whatever gas it is given, the queued module is neither attached nor
    ///      erased — there is no read on this path to starve.
    function test_AnEvictionNeitherAttachesNorErasesAQueuedModule() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        GasHog token = new GasHog(sink);
        HeavyModule heavy = new HeavyModule();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(token)),
            manager: address(this),
            mutableTax: false, mutableRecipient: false, mutableModule: true,
            taxTerms: TaxTerms({recipient: sink, rateBps: 1000, minRunwaySeconds: 1 days}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
        }))));

        token.mint(alice, 1_000 ether);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, SlotMath.depositFor(1 ether, 1000, 1 days), 0);
        vm.stopPrank();

        TaxTerms memory none;
        s.proposeTerms(none, ModuleTerms({target: address(heavy), settings: ""}), 8);
        vm.warp(block.timestamp + 30 days);
        assertTrue(s.isInsolvent());

        uint256 evicted;
        for (uint256 g = 400_000; g <= 1_600_000; g += 5_000) {
            uint256 snap = vm.snapshotState();
            (bool ok, ) = address(s).call{gas: g}(abi.encodeWithSignature("liquidate()"));
            if (ok) {
                assertEq(s.module(), address(0), "an eviction attaches nothing");
                assertEq(s.pending().mask & 8, 8, "and erases nothing");
                ++evicted;
            }
            vm.revertToState(snap);
        }
        assertGt(evicted, 0, "the eviction lands at ordinary gas limits");
    }
}

/// @notice A buyer cannot starve the module read to dodge the module that would
///         gate them.
///
/// @dev The claim under test: with the gas guard gone, a buyer picks a gas
///      limit that makes the incoming module's read fail, the slot detaches the
///      module as unreachable, and `beforeBuy` never runs. EIP-150 is what stops
///      it: the read is a `staticcall` with a fixed stipend, so starving it
///      means `63/64` of what is left is under that stipend — and the `1/64`
///      kept back is then far too little to finish the buy. The transaction
///      runs out of gas instead of seating anybody.
contract BuyGasStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheModuleReadAndBeSeatedUnguarded() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        VetoModule veto = new VetoModule();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, ModuleTerms({target: address(veto), settings: ""}), 8);
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
                assertEq(s.module(), address(veto), "seated only with the module attached");
            }
            vm.revertToState(snap);
        }
        // The module vetoes every buy, so no gas limit should ever seat anybody.
        assertEq(seated, 0, "no gas limit slips past the veto");
    }
}

/// @dev Refuses every buy, and costs little to read.
contract VetoModule is AskModule {
    error Vetoed();

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        o.scopes = ScopesLib.BEFORE_BUY;
    }

    function checkSettings(bytes calldata) external view {}
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
contract PricyModule is AskModule {
    function checkSettings(bytes calldata) external pure {
        uint256 x;
        for (uint256 i; i < 500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
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
 * A buyer cannot detach the module they are about to be seated under.
 *
 * The read that attaches a queued module fails open, so a starved read would
 * attach nothing and let the buy through unguarded. It cannot be starved: the
 * stipend is capped, so the only way to give the module less than it needs is to
 * enter the read with less than the cap — and a read that dies there burns
 * 63/64 of what was left, which is the gas the rest of the buy needed.
 */
contract QueuedModuleStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheReadThatAttachesAQueuedModule() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        PricyModule pricy = new PricyModule();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            moduleTerms: ModuleTerms({target: address(0), settings: ""})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, ModuleTerms({target: address(pricy), settings: ""}), 8);
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
                assertEq(s.module(), address(pricy), "a completed buy always attached the module");
                assertEq(s.occupant(), alice);
            }
            vm.revertToState(snap);
        }
        assertGt(seated, 0, "the sweep has to reach limits that do complete");
    }
}

/// @dev Answers honestly, but costs more than the stipend the slot reads it
///      under.
contract GluttonModule is AskModule {
    function checkSettings(bytes calldata) external pure {
        uint256 x;
        for (uint256 i; i < 1_500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
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
 * A module too expensive to read is refused where somebody can see it.
 *
 * The attach-time read is capped, and fails open: a module that cannot answer
 * inside its stipend is attached as nothing. Proposing is uncapped, so without
 * this the module would pass proposal and then quietly vanish a day later.
 */
contract ModuleStipendTest is Test {
    SlotFactory factory;
    address manager = makeAddr("manager");

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
    }

    function _init(address module) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableModule: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            moduleTerms: ModuleTerms({target: module, settings: ""})
        });
    }

    function test_ASlotCannotBeCreatedWithOne() public {
        GluttonModule glutton = new GluttonModule();
        vm.expectRevert(ModuleTooExpensive.selector);
        factory.createSlot(_init(address(glutton)));
    }

    function test_ItCannotBeQueuedEither() public {
        Slot s = Slot(payable(factory.createSlot(_init(address(0)))));
        GluttonModule glutton = new GluttonModule();

        TaxTerms memory none;
        vm.prank(manager);
        vm.expectRevert(ModuleTooExpensive.selector);
        s.proposeTerms(none, ModuleTerms({target: address(glutton), settings: ""}), 8);
    }

    /// @notice A module that fits is not caught by the same check.
    function test_AModuleInsideItsStipendIsFine() public {
        PricyModule pricy = new PricyModule();
        Slot s = Slot(payable(factory.createSlot(_init(address(pricy)))));
        assertEq(s.module(), address(pricy));
    }
}
