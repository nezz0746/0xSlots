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
}

/// @notice A queued hook must never be erased by a caller tuning gas.
contract HookReadGasTest is Test {
    address sink = makeAddr("sink");
    address alice = makeAddr("alice");

    /// @dev Swept across gas limits, against a payout whose token transfer burns
    ///      more than a hook read's whole stipend. Every liquidation that lands
    ///      either attaches the healthy hook or leaves it queued; none detaches it.
    function test_AnExpensivePayoutCannotStarveTheQueuedHookRead() public {
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

        uint256 attached;
        uint256 deferred;
        for (uint256 g = 400_000; g <= 1_600_000; g += 5_000) {
            uint256 snap = vm.snapshotState();
            (bool ok, ) = address(s).call{gas: g}(abi.encodeWithSignature("liquidate()"));
            if (ok) {
                if (s.hook() == address(heavy)) {
                    ++attached;
                } else {
                    assertEq(s.pendingTerms().mask & 8, 8, "the queued hook was erased");
                    ++deferred;
                }
            }
            vm.revertToState(snap);
        }
        assertGt(attached, 0, "enough gas attaches the hook");
    }
}
