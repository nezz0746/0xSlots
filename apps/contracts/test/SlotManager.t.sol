// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {SlotManager, IManagedSlot} from "../src/SlotManager.sol";
import {SlotManagerFactory} from "../src/SlotManagerFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UpdateKind} from "../src/interfaces/ISlot.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";
import {Wallet} from "splits-v2/utils/Wallet.sol";
import {Ownable} from "splits-v2/utils/Ownable.sol";

/// @dev Records what the manager relayed, and reverts like the real slot does
///      when the caller is not the manager.
contract MockSlot {
    address public manager;

    uint256 public taxPct;
    address public utility;
    address public policy;
    uint256 public bountyBps;
    uint256 public cancelCount;

    error NotManager();

    constructor(address _manager) {
        manager = _manager;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    function proposeTaxUpdate(uint256 v) external onlyManager {
        taxPct = v;
    }

    function proposeUtilityUpdate(address v) external onlyManager {
        utility = v;
    }

    function proposePolicyUpdate(address v) external onlyManager {
        policy = v;
    }

    function setLiquidationBounty(uint256 v) external onlyManager {
        bountyBps = v;
    }

    function cancelPendingUpdates() external onlyManager {
        cancelCount++;
    }

    /// @dev Records which dimension each cancel targeted, which is the whole
    ///      point of the per-role relays above it.
    function cancelPendingUpdate(UpdateKind kind) external onlyManager {
        cancelledKind[kind]++;
    }

    mapping(UpdateKind => uint256) public cancelledKind;

    function collect() external {}

    function claim(address) external {}
}

contract SlotManagerTest is Test {
    SlotManager internal mgr;
    SlotManagerFactory internal factory;
    MockSlot internal slot;
    SplitsWarehouse internal warehouse;

    address internal admin = makeAddr("admin");
    address internal factoryAdmin = makeAddr("factoryAdmin");
    address internal taxMgr = makeAddr("taxMgr");
    address internal policyMgr = makeAddr("policyMgr");
    address internal utilityMgr = makeAddr("utilityMgr");
    address internal splitMgr = makeAddr("splitMgr");
    address internal stranger = makeAddr("stranger");

    address internal payeeA = makeAddr("payeeA");
    address internal payeeB = makeAddr("payeeB");

    function setUp() public {
        warehouse = new SplitsWarehouse("Ether", "ETH");

        // Managers are proxies now, so every test below exercises the real
        // deployment path rather than a directly-constructed manager that no
        // longer resembles what ships.
        SlotManager impl = new SlotManager(address(warehouse));
        SlotManagerFactory factoryImpl = new SlotManagerFactory();
        factory = SlotManagerFactory(
            address(
                new ERC1967Proxy(
                    address(factoryImpl),
                    abi.encodeCall(
                        SlotManagerFactory.initialize,
                        (factoryAdmin, address(impl))
                    )
                )
            )
        );

        mgr = SlotManager(payable(factory.createManager(_split(), _roles())));
        slot = new MockSlot(address(mgr));
    }

    function _split() internal view returns (SplitV2Lib.Split memory s) {
        address[] memory recipients = new address[](2);
        recipients[0] = payeeA;
        recipients[1] = payeeB;

        uint256[] memory allocations = new uint256[](2);
        allocations[0] = 60;
        allocations[1] = 40;

        s = SplitV2Lib.Split({
            recipients: recipients,
            allocations: allocations,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    function _roles() internal view returns (SlotManager.InitialRoles memory r) {
        r.admin = admin;
        r.taxManagers = _one(taxMgr);
        r.policyManagers = _one(policyMgr);
        r.utilityManagers = _one(utilityMgr);
        r.splitManagers = _one(splitMgr);
    }

    function _one(address a) internal pure returns (address[] memory out) {
        out = new address[](1);
        out[0] = a;
    }

    // ── the invariant the whole design rests on ──────────────────────────────

    function test_ownerIsTheContractItself() public view {
        assertEq(mgr.owner(), address(mgr));
    }

    function test_transferOwnershipAlwaysReverts() public {
        vm.expectRevert(SlotManager.OwnershipIsSelfBound.selector);
        vm.prank(admin);
        mgr.transferOwnership(admin);
    }

    /// @dev The reason `owner` is self-bound. If this ever passes for a human
    ///      caller, every role in this contract is decorative.
    function test_execCallsCannotBypassRoles() public {
        Wallet.Call[] memory calls = new Wallet.Call[](1);
        calls[0] = Wallet.Call({
            to: address(slot),
            value: 0,
            data: abi.encodeCall(MockSlot.proposeTaxUpdate, (9999))
        });

        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(admin);
        mgr.execCalls(calls);

        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(stranger);
        mgr.execCalls(calls);

        assertEq(slot.taxPct(), 0);
    }

    // ── relays: specific role works, admin works, everyone else is out ───────

    function test_taxManagerCanRelayTax() public {
        vm.prank(taxMgr);
        mgr.proposeTaxUpdate(IManagedSlot(address(slot)), 500);
        assertEq(slot.taxPct(), 500);
    }

    function test_adminCanRelayAllThree() public {
        vm.startPrank(admin);
        mgr.proposeTaxUpdate(IManagedSlot(address(slot)), 250);
        mgr.proposeUtilityUpdate(IManagedSlot(address(slot)), address(0xBEEF));
        mgr.proposePolicyUpdate(IManagedSlot(address(slot)), address(0xCAFE));
        vm.stopPrank();

        assertEq(slot.taxPct(), 250);
        assertEq(slot.utility(), address(0xBEEF));
        assertEq(slot.policy(), address(0xCAFE));
    }

    /// @dev Role reads are hoisted out of `expectRevert`'s arguments on purpose:
    ///      evaluating `mgr.TAX_MANAGER_ROLE()` inline would consume the prank
    ///      and the assertion would silently test the wrong caller.
    function test_rolesDoNotLeakAcrossDomains() public {
        bytes32 taxRole = mgr.TAX_MANAGER_ROLE();
        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();

        vm.prank(policyMgr);
        vm.expectRevert(_unauthorized(policyMgr, taxRole));
        mgr.proposeTaxUpdate(IManagedSlot(address(slot)), 500);

        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.proposePolicyUpdate(IManagedSlot(address(slot)), address(1));

        vm.prank(utilityMgr);
        vm.expectRevert(_unauthorized(utilityMgr, taxRole));
        mgr.setLiquidationBounty(IManagedSlot(address(slot)), 100);
    }

    /// @dev The gap the per-kind cancel closed. A role holder could always
    ///      propose; until the slot could cancel one dimension at a time, only
    ///      the admin could retract, because retracting meant destroying every
    ///      other role's queued work too.
    function test_eachRoleCancelsItsOwnKind() public {
        vm.prank(taxMgr);
        mgr.cancelTaxUpdate(IManagedSlot(address(slot)));

        vm.prank(utilityMgr);
        mgr.cancelUtilityUpdate(IManagedSlot(address(slot)));

        vm.prank(policyMgr);
        mgr.cancelPolicyUpdate(IManagedSlot(address(slot)));

        assertEq(slot.cancelledKind(UpdateKind.Tax), 1);
        assertEq(slot.cancelledKind(UpdateKind.Utility), 1);
        assertEq(slot.cancelledKind(UpdateKind.Policy), 1);
        assertEq(slot.cancelCount(), 0, "no blanket cancel was used");
    }

    /// @dev And the boundary holds in the cancel direction too — a tax manager
    ///      still cannot reach a policy manager's proposal.
    function test_cancelRolesDoNotLeakAcrossDomains() public {
        bytes32 taxRole = mgr.TAX_MANAGER_ROLE();
        bytes32 policyRole = mgr.POLICY_MANAGER_ROLE();
        bytes32 utilityRole = mgr.UTILITY_MANAGER_ROLE();

        vm.prank(policyMgr);
        vm.expectRevert(_unauthorized(policyMgr, taxRole));
        mgr.cancelTaxUpdate(IManagedSlot(address(slot)));

        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, policyRole));
        mgr.cancelPolicyUpdate(IManagedSlot(address(slot)));

        vm.prank(taxMgr);
        vm.expectRevert(_unauthorized(taxMgr, utilityRole));
        mgr.cancelUtilityUpdate(IManagedSlot(address(slot)));

        assertEq(slot.cancelledKind(UpdateKind.Tax), 0);
        assertEq(slot.cancelledKind(UpdateKind.Policy), 0);
        assertEq(slot.cancelledKind(UpdateKind.Utility), 0);
    }

    function test_adminCanCancelAnySingleKind() public {
        vm.startPrank(admin);
        mgr.cancelTaxUpdate(IManagedSlot(address(slot)));
        mgr.cancelUtilityUpdate(IManagedSlot(address(slot)));
        mgr.cancelPolicyUpdate(IManagedSlot(address(slot)));
        vm.stopPrank();

        assertEq(slot.cancelledKind(UpdateKind.Tax), 1);
        assertEq(slot.cancelledKind(UpdateKind.Utility), 1);
        assertEq(slot.cancelledKind(UpdateKind.Policy), 1);
    }

    /// @dev The blanket cancel stays admin-only. It is no longer the ONLY way
    ///      to cancel, so the restriction is now policy rather than damage
    ///      control — but it is still the restriction.
    function test_cancelIsAdminOnly() public {
        bytes32 adminRole = mgr.DEFAULT_ADMIN_ROLE();

        address[] memory managers = new address[](3);
        managers[0] = taxMgr;
        managers[1] = policyMgr;
        managers[2] = utilityMgr;

        for (uint256 i; i < managers.length; ++i) {
            vm.prank(managers[i]);
            vm.expectRevert(_unauthorized(managers[i], adminRole));
            mgr.cancelPendingUpdates(IManagedSlot(address(slot)));
        }

        vm.prank(admin);
        mgr.cancelPendingUpdates(IManagedSlot(address(slot)));
        assertEq(slot.cancelCount(), 1);
    }

    function _unauthorized(address account, bytes32 role) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, account, role
        );
    }

    // ── split management ─────────────────────────────────────────────────────

    function test_splitManagerCanRewriteSplitViaSelfCall() public {
        SplitV2Lib.Split memory next = _split();
        next.allocations[0] = 10;
        next.allocations[1] = 90;

        bytes32 before = mgr.splitHash();

        vm.prank(splitMgr);
        mgr.setSplit(next);

        assertTrue(mgr.splitHash() != before);
        assertEq(mgr.splitHash(), keccak256(abi.encode(next)));
    }

    function test_inheritedUpdateSplitIsUnreachableDirectly() public {
        vm.expectRevert(Ownable.Unauthorized.selector);
        vm.prank(admin);
        mgr.updateSplit(_split());
    }

    function test_pauseIsSplitManagerGated() public {
        bytes32 splitRole = mgr.SPLIT_MANAGER_ROLE();

        vm.prank(stranger);
        vm.expectRevert(_unauthorized(stranger, splitRole));
        mgr.setPaused(true);

        vm.prank(splitMgr);
        mgr.setPaused(true);
        assertTrue(mgr.paused());
    }

    // ── receiving native tax ─────────────────────────────────────────────────

    /// @dev `Slot._payOrCredit` sends native tax with `call{gas: 30_000}`. If
    ///      this fails the tax silently becomes a credit needing a manual claim.
    function test_acceptsNativeWithinSlotsGasCap() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(mgr).call{value: 1 ether, gas: 30_000}("");
        assertTrue(ok);
        assertEq(address(mgr).balance, 1 ether);
    }

    function test_distributesNativeOverTheSplit() public {
        vm.deal(address(mgr), 1 ether);

        mgr.distribute(_split(), mgr.NATIVE_TOKEN(), address(this));

        // PushSplit leaves 1 wei behind as a gas optimisation.
        assertEq(payeeA.balance, 0.6 ether - 1);
        assertEq(payeeB.balance, 0.4 ether - 1);
    }

    // ── sealed ERC-1271 ──────────────────────────────────────────────────────

    /// @dev Inherited `getSigner()` returns `owner` == address(this), which would
    ///      make `SignatureChecker` recurse into this contract until out of gas.
    ///      Capped low so runaway recursion would fail the assert, not the test.
    function test_isValidSignatureReturnsFalseWithoutRecursing() public view {
        bytes4 result = mgr.isValidSignature{gas: 100_000}(keccak256("x"), hex"1234");
        assertEq(result, bytes4(0xffffffff));
    }

    // ── initializer guards ───────────────────────────────────────────────────

    function test_rejectsZeroAdmin() public {
        SlotManager.InitialRoles memory r = _roles();
        r.admin = address(0);
        vm.expectRevert(SlotManager.AdminRequired.selector);
        factory.createManager(_split(), r);
    }

    function test_rejectsSplitThatCouldNeverDistribute() public {
        SplitV2Lib.Split memory bad = _split();
        bad.allocations[0] = 0;
        bad.allocations[1] = 0;
        bad.totalAllocation = 0;

        vm.expectRevert(SlotManager.EmptySplit.selector);
        factory.createManager(bad, _roles());
    }

    function test_rejectsEmptyRecipients() public {
        SplitV2Lib.Split memory bad = SplitV2Lib.Split({
            recipients: new address[](0),
            allocations: new uint256[](0),
            totalAllocation: 0,
            distributionIncentive: 0
        });

        vm.expectRevert(SlotManager.EmptySplit.selector);
        factory.createManager(bad, _roles());
    }

    receive() external payable {}
}
