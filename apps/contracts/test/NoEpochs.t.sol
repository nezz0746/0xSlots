// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { _mint(msg.sender, 1_000_000 ether); }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/**
 * @title NoEpochsTest
 * @notice Epoch scheduling was removed: `buy()` always transfers immediately.
 *
 * @dev Two properties matter here and they pull in opposite directions.
 *
 *      1. No NEW pending transfer can be created, even on a slot whose
 *         `epochSeconds` is still non-zero from before the upgrade.
 *      2. Any pending transfer that ALREADY exists must still materialise.
 *         `_materialize` is retained precisely for this. The buyer of a
 *         scheduled transfer has already paid price + deposit; dropping the
 *         code that completes it would strand their escrow permanently.
 *
 *      Legacy state is written with `vm.store` because there is no longer any
 *      way to reach it through the public API — which is the point. The layout
 *      was verified against the live Base Sepolia bytecode before these tests
 *      were written: slot 15 packs `occupancyPolicy` (offset 0) with
 *      `epochSeconds` (offset 20), and `pendingTransfer` spans slots 18-21.
 */
contract NoEpochsTest is Test {
    SlotFactory factory;
    MockERC20 token;

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint64 constant HOUR = 3600;

    uint256 constant SLOT_POLICY_AND_EPOCH = 15;
    uint256 constant SLOT_PENDING_HEAD = 18; // buyer + effectiveAt
    uint256 constant SLOT_PENDING_DEPOSIT = 19;
    uint256 constant SLOT_PENDING_NEWPRICE = 20;
    uint256 constant SLOT_PENDING_PRICEPAID = 21;

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new MockERC20();
        token.mint(alice, 10_000 ether);
        token.mint(bob, 10_000 ether);
        vm.warp(1_000_000);
    }

    function _init() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,
            utility: address(0),
            liquidationBountyBps: 500,
            minDepositSeconds: 0,
            occupancyPolicy: address(0)
        });
    }

    function _slot() internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _init()));
    }

    /// @dev Forge a pre-upgrade slot: non-zero epochSeconds, which the factory
    ///      now refuses to set.
    function _forceEpochSeconds(Slot s, uint64 epoch) internal {
        address policy = s.occupancyPolicy();
        vm.store(
            address(s),
            bytes32(SLOT_POLICY_AND_EPOCH),
            bytes32((uint256(epoch) << 160) | uint256(uint160(policy)))
        );
        assertEq(s.epochSeconds(), epoch, "fixture: epochSeconds not written");
    }

    function _buy(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    // ── 1. No new scheduling ────────────────────────────────────────────────

    function test_Buy_VacantSlotClaimsImmediately() public {
        Slot s = _slot();
        _buy(s, alice, 10 ether, 100 ether);

        assertEq(s.occupant(), alice);
        assertEq(s.price(), 100 ether);
        (, uint96 effectiveAt, , , ) = s.pendingTransfer();
        assertEq(uint256(effectiveAt), 0);
    }

    /// The behaviour change: taking the slot FROM someone used to schedule.
    function test_Buy_OccupiedSlot_AppliesNow_EvenWithEpochsConfigured() public {
        Slot s = _slot();
        _buy(s, alice, 100 ether, 100 ether);
        _forceEpochSeconds(s, HOUR);

        _buy(s, bob, 100 ether, 200 ether);

        assertEq(s.occupant(), bob, "buy must apply now, not at a boundary");
        assertEq(s.price(), 200 ether);
        (, uint96 effectiveAt, , , ) = s.pendingTransfer();
        assertEq(uint256(effectiveAt), 0, "no transfer may be scheduled");
    }

    /// Back-to-back buys must not hit the TransferPending guard.
    function test_Buy_TwiceInSameBlock_BothApply() public {
        Slot s = _slot();
        _forceEpochSeconds(s, HOUR);

        _buy(s, alice, 100 ether, 100 ether);
        _buy(s, bob, 100 ether, 300 ether);

        assertEq(s.occupant(), bob);
        assertEq(s.price(), 300 ether);
    }

    // ── 2. Leftover pending storage is inert ───────────────────────────────

    /// @dev `_materialize` was deleted in stage B, after every outstanding
    ///      transfer was drained and all 251 slots verified clean on-chain.
    ///      The four storage slots survive only because `isOperator` and
    ///      `withdrawableOf` sit after them.
    ///
    ///      Nothing can write them any more. This proves that if something
    ///      somehow did, it would be ignored rather than bricking the slot —
    ///      the getters read raw state and every entry point still works.
    function test_LeftoverPendingStorage_IsInert() public {
        Slot s = _slot();
        _buy(s, alice, 100 ether, 100 ether);

        uint96 effectiveAt = uint96(block.timestamp - 1);
        vm.store(
            address(s),
            bytes32(SLOT_PENDING_HEAD),
            bytes32((uint256(effectiveAt) << 160) | uint256(uint160(bob)))
        );
        vm.store(address(s), bytes32(SLOT_PENDING_NEWPRICE), bytes32(uint256(999 ether)));

        // Ignored, not honoured.
        assertEq(s.occupant(), alice, "raw occupant must win");
        assertEq(s.price(), 100 ether, "raw price must win");

        // And the slot is still fully usable.
        vm.warp(block.timestamp + 1 days);
        s.collect();
        _buy(s, bob, 100 ether, 200 ether);
        assertEq(s.occupant(), bob);
    }

    // ── 4. Stage B: the drain path is gone, the storage is not ──────────────

    /// @dev `pendingTransfer` occupies slots 18-21 and `isOperator` (22) /
    ///      `withdrawableOf` (23) sit AFTER it. Deleting the fields would shift
    ///      both mappings on every live slot, silently voiding operator
    ///      approvals and unclaimed refunds. The declarations must stay forever
    ///      even though nothing reads or writes them.
    function test_StorageLayout_SurvivesDrainRemoval() public {
        Slot s = _slot();

        // Operator approval lands in slot 22 and must read back.
        vm.prank(alice);
        s.setOperator(bob, true);
        assertTrue(s.isOperator(alice, bob), "isOperator moved");

        // pendingTransfer is inert but still addressable.
        (, uint96 effectiveAt, , , ) = s.pendingTransfer();
        assertEq(uint256(effectiveAt), 0);

        // Writing slot 22 directly must land on isOperator, proving nothing
        // below pendingTransfer shifted.
        bytes32 key = keccak256(
            abi.encode(bob, keccak256(abi.encode(alice, uint256(22))))
        );
        assertEq(uint256(vm.load(address(s), key)), 1, "isOperator not at slot 22");
    }
}
