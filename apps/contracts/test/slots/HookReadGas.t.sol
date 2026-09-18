// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, HookTerms, HookOffer} from "../../src/types/SlotTypes.sol";
import {ISlotHook, SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {HookPermissionsLib} from "../../src/libraries/HookPermissionsLib.sol";
import {SlotMath} from "../../src/libraries/SlotMath.sol";
import {HookReadTooExpensive} from "../../src/errors/SlotErrors.sol";

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

/// @dev A healthy hook whose configuration check is expensive but well inside
///      its stipend.
contract HeavyHook is ISlotHook {
    function validateHookConfig(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 700; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        o.permissions = HookPermissionsLib.AFTER_SETTLE;
    }

    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function afterAttach(SlotContext calldata) external {}
}

/// @notice A queued hook must never be erased by a caller tuning gas.
contract HookReadGasTest is Test {
    address sink = makeAddr("sink");
    address alice = makeAddr("alice");

    /// @dev Swept across gas limits, against a payout whose token transfer burns
    ///      more than a hook read's whole stipend. An eviction carries no terms,
    ///      so whatever gas it is given, the queued hook is neither attached nor
    ///      erased — there is no read on this path to starve.
    function test_AnEvictionNeitherAttachesNorErasesAQueuedHook() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        GasHog token = new GasHog(sink);
        HeavyHook heavy = new HeavyHook();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(token)),
            manager: address(this),
            mutableTax: false, mutableRecipient: false, mutableHook: true,
            taxTerms: TaxTerms({recipient: sink, rateBps: 1000, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));

        token.mint(alice, 1_000 ether);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, SlotMath.depositFor(1 ether, 1000, 1 days), 0);
        vm.stopPrank();

        TaxTerms memory none;
        s.proposeTerms(none, HookTerms({target: address(heavy), config: bytes32(0)}), 8);
        vm.warp(block.timestamp + 30 days);
        assertTrue(s.isInsolvent());

        uint256 evicted;
        for (uint256 g = 400_000; g <= 1_600_000; g += 5_000) {
            uint256 snap = vm.snapshotState();
            (bool ok, ) = address(s).call{gas: g}(abi.encodeWithSignature("liquidate()"));
            if (ok) {
                assertEq(s.hook(), address(0), "an eviction attaches nothing");
                assertEq(s.pendingTerms().mask & 8, 8, "and erases nothing");
                ++evicted;
            }
            vm.revertToState(snap);
        }
        assertGt(evicted, 0, "the eviction lands at ordinary gas limits");
    }
}

/// @notice A buyer cannot starve the hook read to dodge the hook that would
///         gate them.
///
/// @dev The claim under test: with the gas guard gone, a buyer picks a gas
///      limit that makes the incoming hook's read fail, the slot detaches the
///      hook as unreachable, and `beforeBuy` never runs. EIP-150 is what stops
///      it: the read is a `staticcall` with a fixed stipend, so starving it
///      means `63/64` of what is left is under that stipend — and the `1/64`
///      kept back is then far too little to finish the buy. The transaction
///      runs out of gas instead of seating anybody.
contract BuyGasStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheHookReadAndBeSeatedUnguarded() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        VetoHook veto = new VetoHook();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableHook: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(veto), config: bytes32(0)}), 8);
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
                assertEq(s.hook(), address(veto), "seated only with the hook attached");
            }
            vm.revertToState(snap);
        }
        // The hook vetoes every buy, so no gas limit should ever seat anybody.
        assertEq(seated, 0, "no gas limit slips past the veto");
    }
}

/// @dev Refuses every buy, and costs little to read.
contract VetoHook is ISlotHook {
    error Vetoed();

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        o.permissions = HookPermissionsLib.BEFORE_BUY;
    }

    function validateHookConfig(bytes32) external view {}
    function beforeBuy(SlotContext calldata) external view {
        revert Vetoed();
    }
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function afterAttach(SlotContext calldata) external {}
}

/// @dev Healthy, and expensive to read: the costlier the read, the wider the
///      window a caller tuning gas would have to aim at.
contract PricyHook is ISlotHook {
    function validateHookConfig(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        uint256 x;
        for (uint256 i; i < 500; ++i) x = uint256(keccak256(abi.encode(x, i)));
        o.permissions = HookPermissionsLib.BEFORE_BUY;
    }

    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function afterAttach(SlotContext calldata) external {}
}

/**
 * A buyer cannot detach the hook they are about to be seated under.
 *
 * The read that attaches a queued hook fails open, so a starved read would
 * attach nothing and let the buy through unguarded. It cannot be starved: the
 * stipend is capped, so the only way to give the hook less than it needs is to
 * enter the read with less than the cap — and a read that dies there burns
 * 63/64 of what was left, which is the gas the rest of the buy needed.
 */
contract QueuedHookStarvationTest is Test {
    address alice = makeAddr("alice");
    address manager = makeAddr("manager");

    function test_ABuyerCannotStarveTheReadThatAttachesAQueuedHook() public {
        SlotFactory factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        PricyHook pricy = new PricyHook();

        Slot s = Slot(payable(factory.createSlot(SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableHook: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: address(0), config: bytes32(0)})
        }))));

        TaxTerms memory none;
        vm.prank(manager);
        s.proposeTerms(none, HookTerms({target: address(pricy), config: bytes32(0)}), 8);
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
                assertEq(s.hook(), address(pricy), "a completed buy always attached the hook");
                assertEq(s.occupant(), alice);
            }
            vm.revertToState(snap);
        }
        assertGt(seated, 0, "the sweep has to reach limits that do complete");
    }
}

/// @dev Answers honestly, but costs more than the stipend the slot reads it
///      under.
contract GluttonHook is ISlotHook {
    function validateHookConfig(bytes32) external pure {
        uint256 x;
        for (uint256 i; i < 1_500; ++i) x = uint256(keccak256(abi.encode(x, i)));
    }

    function hookOffer(bytes32) external pure returns (HookOffer memory o) {
        uint256 x;
        for (uint256 i; i < 1_500; ++i) x = uint256(keccak256(abi.encode(x, i)));
        o.permissions = HookPermissionsLib.BEFORE_BUY;
    }

    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function afterAttach(SlotContext calldata) external {}
}

/**
 * A hook too expensive to read is refused where somebody can see it.
 *
 * The attach-time read is capped, and fails open: a hook that cannot answer
 * inside its stipend is attached as nothing. Proposing is uncapped, so without
 * this the hook would pass proposal and then quietly vanish a day later.
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

    function _init(address hook) internal view returns (SlotInit memory) {
        return SlotInit({
            currency: IERC20(address(0)),
            manager: manager,
            mutableTax: true, mutableRecipient: true, mutableHook: true,
            taxTerms: TaxTerms({recipient: address(this), rateBps: 500, minRunwaySeconds: 1 days}),
            hookTerms: HookTerms({target: hook, config: bytes32(0)})
        });
    }

    function test_ASlotCannotBeCreatedWithOne() public {
        GluttonHook glutton = new GluttonHook();
        vm.expectRevert(HookReadTooExpensive.selector);
        factory.createSlot(_init(address(glutton)));
    }

    function test_ItCannotBeQueuedEither() public {
        Slot s = Slot(payable(factory.createSlot(_init(address(0)))));
        GluttonHook glutton = new GluttonHook();

        TaxTerms memory none;
        vm.prank(manager);
        vm.expectRevert(HookReadTooExpensive.selector);
        s.proposeTerms(none, HookTerms({target: address(glutton), config: bytes32(0)}), 8);
    }

    /// @notice A hook that fits is not caught by the same check.
    function test_AHookInsideItsStipendIsFine() public {
        PricyHook pricy = new PricyHook();
        Slot s = Slot(payable(factory.createSlot(_init(address(pricy)))));
        assertEq(s.hook(), address(pricy));
    }
}
