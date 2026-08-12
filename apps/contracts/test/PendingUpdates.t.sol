// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams, SlotInfo, UpdateKind, ISlotEvents} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/interfaces/IOccupancyPolicy.sol";

contract PUToken is ERC20 {
    constructor() ERC20("Mock", "MCK") { _mint(msg.sender, 1_000_000 ether); }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract PUUtility is IUtility {
    function name() external pure returns (string memory) { return "PUUtility"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external view returns (address) { return address(this); }
    function moduleURI() external pure returns (string memory) { return ""; }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @dev Allows everything. Only its address matters here.
contract PUPolicy is IOccupancyPolicy {
    function checkBuy(OccupancyContext calldata) external pure {}
    function checkPriceUpdate(OccupancyContext calldata) external pure {}
    function name() external pure returns (string memory) { return "AllowAll"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function policyURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @notice The pending-update lifecycle, one dimension at a time.
///
/// @dev A slot holds at most three pending updates — tax, utility, policy — and
///      until now they could only be cancelled as a set. These cover the
///      granular API that replaced that, plus the two things the old event log
///      could not express: WHEN something was queued, and WHICH dimension
///      actually moved when it applied.
contract PendingUpdatesTest is Test, ISlotEvents {
    SlotFactory factory;
    PUToken token;
    PUUtility utility;
    PUPolicy policy;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl)))
        );
        factory = SlotFactory(address(proxy));
        token = new PUToken();
        utility = new PUUtility();
        policy = new PUPolicy();

        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    // ── helpers ─────────────────────────────────────────────────

    function _init() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,
            utility: address(0),
            liquidationBountyBps: 500,
            minDepositSeconds: 86400,
            occupancyPolicy: address(0)
        });
    }

    /// @dev Every dimension mutable — the only shape in which all three kinds
    ///      can be pending at once, which is what these tests are about.
    function _slot() internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({
                mutableTax: true,
                mutableUtility: true,
                mutablePolicy: true,
                manager: manager
            }),
            _init()
        ));
    }

    function _slot(SlotConfig memory config) internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient, IERC20(address(token)), config, _init()
        ));
    }

    function _buy(Slot s, address buyer, uint256 dep, uint256 p) internal {
        vm.startPrank(buyer);
        token.approve(address(s), dep + s.price());
        s.buy(buyer, dep, p);
        vm.stopPrank();
    }

    function _proposeAll(Slot s) internal {
        vm.startPrank(manager);
        s.proposeTaxUpdate(250);
        s.proposeUtilityUpdate(address(utility));
        s.proposePolicyUpdate(address(policy));
        vm.stopPrank();
    }

    function _asValue(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    // ═══════════════════════════════════════════════════════════
    // THREE KINDS, INDEPENDENTLY
    // ═══════════════════════════════════════════════════════════

    /// @dev All three coexist and land together on the next transition. This was
    ///      already true — two structs, three flags — but nothing asserted it.
    function test_AllThreeKinds_CoexistAndApplyTogether() public {
        Slot s = _slot();
        _buy(s, alice, 10 ether, 100 ether);
        _proposeAll(s);

        SlotInfo memory before = s.getSlotInfo();
        assertTrue(before.hasPendingTax, "tax pending");
        assertTrue(before.hasPendingUtility, "utility pending");
        assertTrue(before.hasPendingPolicy, "policy pending");
        assertEq(before.taxPercentage, 100, "tax not applied early");
        assertEq(before.utility, address(0), "utility not applied early");
        assertEq(before.occupancyPolicy, address(0), "policy not applied early");

        _buy(s, bob, 15 ether, 200 ether);

        SlotInfo memory afterBuy = s.getSlotInfo();
        assertEq(afterBuy.taxPercentage, 250, "tax applied");
        assertEq(afterBuy.utility, address(utility), "utility applied");
        assertEq(afterBuy.occupancyPolicy, address(policy), "policy applied");
        assertFalse(afterBuy.hasPendingTax);
        assertFalse(afterBuy.hasPendingUtility);
        assertFalse(afterBuy.hasPendingPolicy);
    }

    /// @dev The headline: cancelling one kind must not disturb the other two.
    ///      Under the old all-or-nothing `cancelPendingUpdates` this was
    ///      inexpressible, which is why `SlotCollective` had to gate cancelling on
    ///      `DEFAULT_ADMIN_ROLE`.
    function test_CancelOneKind_LeavesTheOthersStanding() public {
        Slot s = _slot();
        _buy(s, alice, 10 ether, 100 ether);
        _proposeAll(s);

        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Tax);

        SlotInfo memory info = s.getSlotInfo();
        assertFalse(info.hasPendingTax, "tax dropped");
        assertTrue(info.hasPendingUtility, "utility survives");
        assertTrue(info.hasPendingPolicy, "policy survives");

        // And the survivors still apply.
        _buy(s, bob, 15 ether, 200 ether);
        assertEq(s.taxPercentage(), 100, "cancelled tax never applied");
        assertEq(s.utility(), address(utility));
        assertEq(s.occupancyPolicy(), address(policy));
    }

    function test_CancelEachKind_Independently() public {
        Slot s = _slot();

        _proposeAll(s);
        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Utility);
        SlotInfo memory a = s.getSlotInfo();
        assertTrue(a.hasPendingTax);
        assertFalse(a.hasPendingUtility);
        assertTrue(a.hasPendingPolicy);

        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Policy);
        SlotInfo memory b = s.getSlotInfo();
        assertTrue(b.hasPendingTax);
        assertFalse(b.hasPendingPolicy);

        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Tax);
        SlotInfo memory c = s.getSlotInfo();
        assertFalse(c.hasPendingTax);
    }

    /// @dev Cancelling the utility must not clear a pending tax that shares its
    ///      storage struct — the failure mode a naive `delete pendingUpdate`
    ///      would have.
    function test_CancelUtility_DoesNotClobberTaxInSameStruct() public {
        Slot s = _slot();

        vm.startPrank(manager);
        s.proposeTaxUpdate(777);
        s.proposeUtilityUpdate(address(utility));
        s.cancelPendingUpdate(UpdateKind.Utility);
        vm.stopPrank();

        (bool isSet, bytes32 value, ) = s.pendingUpdateOf(UpdateKind.Tax);
        assertTrue(isSet, "tax survived");
        assertEq(uint256(value), 777, "tax value intact");

        _buy(s, alice, 10 ether, 100 ether);
        assertEq(s.taxPercentage(), 777);
        assertEq(s.utility(), address(0), "cancelled utility never applied");
    }

    function test_CancelKind_RevertsWhenNothingPending() public {
        Slot s = _slot();

        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.prank(manager);
        vm.expectRevert(NoPendingUpdate.selector);
        s.cancelPendingUpdate(UpdateKind.Policy);
    }

    function test_CancelKind_RevertsForImmutableDimension() public {
        Slot s = _slot(SlotConfig({
            mutableTax: true,
            mutableUtility: false,
            mutablePolicy: false,
            manager: manager
        }));

        vm.prank(manager);
        vm.expectRevert(ModuleNotMutable.selector);
        s.cancelPendingUpdate(UpdateKind.Utility);

        vm.prank(manager);
        vm.expectRevert(PolicyNotMutable.selector);
        s.cancelPendingUpdate(UpdateKind.Policy);
    }

    function test_CancelKind_OnlyManager() public {
        Slot s = _slot();
        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.prank(alice);
        vm.expectRevert(NotManager.selector);
        s.cancelPendingUpdate(UpdateKind.Tax);
    }

    // ═══════════════════════════════════════════════════════════
    // PROPOSED-AT
    // ═══════════════════════════════════════════════════════════

    /// @dev The timestamp is what lets a UI separate a change queued last week
    ///      from one queued against the transaction a buyer is about to send.
    function test_ProposedAt_RecordsQueueTimePerKind() public {
        Slot s = _slot();

        vm.warp(1_000_000);
        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.warp(1_000_500);
        vm.prank(manager);
        s.proposePolicyUpdate(address(policy));

        SlotInfo memory info = s.getSlotInfo();
        assertEq(info.taxProposedAt, 1_000_000, "tax stamped when queued");
        assertEq(info.policyProposedAt, 1_000_500, "policy stamped separately");
        assertEq(info.utilityProposedAt, 0, "nothing queued for utility");
    }

    function test_ProposedAt_ClearsOnApply() public {
        Slot s = _slot();
        _buy(s, alice, 10 ether, 100 ether);

        vm.warp(2_000_000);
        _proposeAll(s);

        _buy(s, bob, 15 ether, 200 ether);

        SlotInfo memory info = s.getSlotInfo();
        assertEq(info.taxProposedAt, 0);
        assertEq(info.utilityProposedAt, 0);
        assertEq(info.policyProposedAt, 0);
    }

    function test_ProposedAt_ClearsOnCancel() public {
        Slot s = _slot();
        vm.warp(3_000_000);
        _proposeAll(s);

        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Utility);

        SlotInfo memory info = s.getSlotInfo();
        assertEq(info.utilityProposedAt, 0, "cleared for the cancelled kind");
        assertEq(info.taxProposedAt, 3_000_000, "untouched for the others");
        assertEq(info.policyProposedAt, 3_000_000);

        vm.prank(manager);
        s.cancelPendingUpdates();

        SlotInfo memory afterAll = s.getSlotInfo();
        assertEq(afterAll.taxProposedAt, 0);
        assertEq(afterAll.policyProposedAt, 0);
    }

    /// @dev Re-proposing overwrites both the value and the clock. A manager who
    ///      changes their mind restarts the "how long has this been pending"
    ///      signal rather than inheriting the old one.
    function test_Repropose_OverwritesValueAndRestampsTime() public {
        Slot s = _slot();

        vm.warp(4_000_000);
        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.warp(4_009_999);
        vm.prank(manager);
        s.proposeTaxUpdate(900);

        (bool isSet, bytes32 value, uint64 at) = s.pendingUpdateOf(UpdateKind.Tax);
        assertTrue(isSet);
        assertEq(uint256(value), 900, "last write wins");
        assertEq(at, 4_009_999, "clock restarted");
    }

    // ═══════════════════════════════════════════════════════════
    // PER-KIND EVENT LOG
    // ═══════════════════════════════════════════════════════════

    function test_Propose_EmitsPerKindEvent() public {
        Slot s = _slot();
        vm.warp(5_000_000);

        vm.expectEmit(true, false, false, true, address(s));
        emit UpdateProposed(UpdateKind.Tax, bytes32(uint256(200)), 5_000_000);
        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.expectEmit(true, false, false, true, address(s));
        emit UpdateProposed(UpdateKind.Utility, _asValue(address(utility)), 5_000_000);
        vm.prank(manager);
        s.proposeUtilityUpdate(address(utility));

        vm.expectEmit(true, false, false, true, address(s));
        emit UpdateProposed(UpdateKind.Policy, _asValue(address(policy)), 5_000_000);
        vm.prank(manager);
        s.proposePolicyUpdate(address(policy));
    }

    function test_CancelKind_EmitsPerKindEvent() public {
        Slot s = _slot();
        vm.prank(manager);
        s.proposeTaxUpdate(200);

        vm.expectEmit(true, false, false, false, address(s));
        emit UpdateCancelled(UpdateKind.Tax);
        vm.prank(manager);
        s.cancelPendingUpdate(UpdateKind.Tax);
    }

    /// @dev Cancel-all must still narrate each kind it dropped, so an indexer
    ///      following only the per-kind log never misses a clear.
    function test_CancelAll_EmitsOneEventPerDroppedKind() public {
        Slot s = _slot();

        vm.startPrank(manager);
        s.proposeTaxUpdate(200);
        s.proposePolicyUpdate(address(policy));
        vm.stopPrank();

        vm.expectEmit(true, false, false, false, address(s));
        emit UpdateCancelled(UpdateKind.Tax);
        vm.expectEmit(true, false, false, false, address(s));
        emit UpdateCancelled(UpdateKind.Policy);
        vm.expectEmit(false, false, false, false, address(s));
        emit PendingUpdateCancelled();

        vm.prank(manager);
        s.cancelPendingUpdates();
    }

    /// @dev The reason the per-kind applied event exists. `PendingUpdateApplied`
    ///      carries BOTH fields on every apply, filling the unchanged one from
    ///      current state — so a reader sees the utility "change" to the value
    ///      it already had. Only tax moves here, and only tax is narrated.
    function test_Apply_PerKindEventsFireOnlyForWhatMoved() public {
        Slot s = _slot();
        _buy(s, alice, 10 ether, 100 ether);

        // Give the slot a utility so the flat event has something misleading
        // to report.
        vm.prank(manager);
        s.proposeUtilityUpdate(address(utility));
        vm.prank(alice);
        s.release();
        assertEq(s.utility(), address(utility), "utility now live");

        // Only tax is queued this time.
        vm.prank(manager);
        s.proposeTaxUpdate(400);

        vm.recordLogs();
        _buy(s, bob, 15 ether, 200 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 appliedTopic = keccak256("UpdateApplied(uint8,bytes32)");
        uint256 taxApplied;
        uint256 utilityApplied;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(s)) continue;
            if (logs[i].topics[0] != appliedTopic) continue;
            uint256 kind = uint256(logs[i].topics[1]);
            if (kind == uint256(UpdateKind.Tax)) taxApplied++;
            if (kind == uint256(UpdateKind.Utility)) utilityApplied++;
        }

        assertEq(taxApplied, 1, "tax moved and was narrated");
        assertEq(
            utilityApplied,
            0,
            "utility did not move and must not be narrated"
        );
        assertEq(s.utility(), address(utility), "utility genuinely unchanged");
        assertEq(s.taxPercentage(), 400);
    }

    // ═══════════════════════════════════════════════════════════
    // UNIFORM READ
    // ═══════════════════════════════════════════════════════════

    function test_PendingUpdateOf_CoversAllThreeKinds() public {
        Slot s = _slot();
        vm.warp(6_000_000);
        _proposeAll(s);

        (bool taxSet, bytes32 taxValue, uint64 taxAt) =
            s.pendingUpdateOf(UpdateKind.Tax);
        assertTrue(taxSet);
        assertEq(uint256(taxValue), 250);
        assertEq(taxAt, 6_000_000);

        (bool utilSet, bytes32 utilValue, ) =
            s.pendingUpdateOf(UpdateKind.Utility);
        assertTrue(utilSet);
        assertEq(address(uint160(uint256(utilValue))), address(utility));

        (bool polSet, bytes32 polValue, ) =
            s.pendingUpdateOf(UpdateKind.Policy);
        assertTrue(polSet);
        assertEq(address(uint160(uint256(polValue))), address(policy));
    }

    function test_PendingUpdateOf_ReportsNothingWhenClean() public {
        Slot s = _slot();
        (bool isSet, bytes32 value, uint64 at) = s.pendingUpdateOf(UpdateKind.Tax);
        assertFalse(isSet);
        assertEq(uint256(value), 0);
        assertEq(at, 0);
    }

    // ═══════════════════════════════════════════════════════════
    // STORAGE LAYOUT
    // ═══════════════════════════════════════════════════════════

    /// @dev The three timestamps are appended at slot 24 and packed into it.
    ///      237 live proxies hold state at every offset below that, so this
    ///      pins both facts: nothing moved, and the addition cost one slot
    ///      rather than three.
    function test_StorageLayout_TimestampsPackIntoOneAppendedSlot() public {
        Slot s = _slot();

        vm.warp(7_000_000);
        _proposeAll(s);

        // isOperator still hashes from slot 22.
        vm.prank(alice);
        s.setOperator(bob, true);
        bytes32 operatorKey = keccak256(
            abi.encode(bob, keccak256(abi.encode(alice, uint256(22))))
        );
        assertEq(
            uint256(vm.load(address(s), operatorKey)),
            1,
            "isOperator moved off slot 22"
        );

        // All three timestamps share slot 24, low to high.
        bytes32 packed = vm.load(address(s), bytes32(uint256(24)));
        assertEq(uint64(uint256(packed)), 7_000_000, "tax at offset 0");
        assertEq(uint64(uint256(packed) >> 64), 7_000_000, "utility at offset 8");
        assertEq(uint64(uint256(packed) >> 128), 7_000_000, "policy at offset 16");
        assertEq(uint256(packed) >> 192, 0, "nothing else in slot 24");
    }
}
