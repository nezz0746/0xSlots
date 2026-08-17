// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {SlotStreamCollective} from "../../src/draft/SlotStreamCollective.sol";
import {SlotGovernance, IManagedSlot} from "../../src/SlotGovernance.sol";
import {ISuperfluidPool, ISuperToken} from "../../src/draft/interfaces/ISuperfluid.sol";
import {UpdateKind} from "../../src/interfaces/ISlot.sol";

/// @dev Same shape as the mock in `SlotCollective.t.sol`. Duplicated rather
///      than shared because its job here is to prove the governance half works
///      identically under a DIFFERENT payout engine — a shared fixture would
///      quietly assume the thing under test.
contract MockSlot {
    address public manager;
    uint256 public taxPct;
    address public policy;
    uint256 public bountyBps;

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

    function proposeUtilityUpdate(address) external onlyManager {}

    function proposePolicyUpdate(address v) external onlyManager {
        policy = v;
    }

    function setLiquidationBounty(uint256 v) external onlyManager {
        bountyBps = v;
    }

    function cancelPendingUpdates() external onlyManager {}

    function cancelPendingUpdate(UpdateKind) external onlyManager {}

    function collect() external {}

    function claim(address) external {}
}

/// @notice `SlotStreamCollective` against the REAL Superfluid deployment.
///
/// @dev Deliberately a fork test rather than a mocked one. The contract talks
///      to Superfluid through hand-written interfaces in
///      `src/interfaces/ISuperfluid.sol` — chosen over vendoring the protocol
///      monorepo — and the whole risk of that choice is a signature being
///      subtly wrong: a selector that does not exist, a return tuple decoded in
///      the wrong order, a decimals convention misread. A mock would be written
///      from the same misunderstanding as the interface and would agree with it.
///      Only the real contracts can disagree.
///
///      Skipped automatically when no RPC is configured, so `forge test` stays
///      offline by default. Run with:
///          forge test --match-contract SlotStreamCollective -vv
contract SlotStreamCollectiveTest is Test {
    // Verified live on Base (chainid 8453) before this test was written:
    // codesize 5919 / 1444, and ETHx.getHost() == the Superfluid host.
    address constant GDA_FORWARDER = 0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08;
    address constant ETHX = 0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93;

    SlotStreamCollective internal collective;
    MockSlot internal slot;

    address internal admin = makeAddr("admin");
    address internal poolMgr = makeAddr("poolMgr");
    address internal taxMgr = makeAddr("taxMgr");
    address internal stranger = makeAddr("stranger");

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    /// @dev An explicit clock. `vm.warp(block.timestamp + d)` is NOT safe in
    ///      this repo: `via_ir` + the optimizer hoist `block.timestamp` into a
    ///      local, so a second warp in the same function re-reads the stale
    ///      value and jumps to the instant the first one already set. Time
    ///      silently stops, and any assertion about elapsed time passes for the
    ///      wrong reason.
    uint256 internal clock;

    function _skip(uint256 d) internal {
        if (clock == 0) clock = block.timestamp;
        clock += d;
        vm.warp(clock);
    }

    /// @dev Returns false when there is no usable RPC, so every test can bail
    ///      out identically instead of each one re-implementing the skip.
    function _fork() internal returns (bool) {
        try vm.createSelectFork(vm.rpcUrl("base")) {
            clock = block.timestamp;
            return true;
        } catch {
            vm.skip(true);
            return false;
        }
    }

    function _deploy(uint128 aliceUnits, uint128 bobUnits) internal {
        SlotStreamCollective impl =
            new SlotStreamCollective(GDA_FORWARDER, ETHX, true);

        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        uint128[] memory units = new uint128[](2);
        units[0] = aliceUnits;
        units[1] = bobUnits;

        address[] memory taxManagers = new address[](1);
        taxManagers[0] = taxMgr;
        address[] memory poolManagers = new address[](1);
        poolManagers[0] = poolMgr;

        SlotStreamCollective.InitialRoles memory roles = SlotStreamCollective
            .InitialRoles({
            admin: admin,
            taxManagers: taxManagers,
            policyManagers: new address[](0),
            utilityManagers: new address[](0),
            poolManagers: poolManagers
        });

        collective = SlotStreamCollective(
            payable(
                address(
                    new ERC1967Proxy(
                        address(impl),
                        abi.encodeCall(
                            SlotStreamCollective.initializeStreamCollective,
                            (members, units, roles)
                        )
                    )
                )
            )
        );

        slot = new MockSlot(address(collective));
    }

    // ═══════════════════════════════════════════════════════════
    // WIRING — proves the hand-written interfaces match reality
    // ═══════════════════════════════════════════════════════════

    function test_Fork_CreatesPoolOwnedByTheCollective() public {
        if (!_fork()) return;
        _deploy(60, 40);

        ISuperfluidPool p = collective.pool();
        assertTrue(address(p) != address(0), "pool was not created");
        assertEq(p.admin(), address(collective), "collective must be pool admin");
        assertEq(p.superToken(), ETHX, "pool must be denominated in ETHx");

        assertEq(collective.unitsOf(alice), 60);
        assertEq(collective.unitsOf(bob), 40);
        assertEq(collective.totalUnits(), 100);

        // The immutables the constructor derived from the live token.
        assertTrue(collective.NATIVE_WRAPPER());
        assertEq(collective.UNDERLYING(), address(0), "ETHx has no ERC-20 underlying");
        assertEq(collective.UPGRADE_SCALE(), 1);
    }

    // ═══════════════════════════════════════════════════════════
    // LUMP-SUM PAYOUT — the split's behaviour
    // ═══════════════════════════════════════════════════════════

    function test_Fork_DistributeSplitsProRataByUnits() public {
        if (!_fork()) return;
        _deploy(60, 40);

        // Tax arriving as native ETH, the way `Slot._payOrCredit` pushes it.
        vm.deal(address(collective), 1 ether);

        // Permissionless, like `PushSplit.distribute`.
        vm.prank(stranger);
        uint256 distributed = collective.distribute();

        assertGt(distributed, 0, "nothing was distributed");
        // The pool keeps the remainder of amount/totalUnits, so allow the dust.
        assertApproxEqAbs(distributed, 1 ether, 100, "should distribute ~the whole balance");

        int256 aliceClaim = collective.claimableOf(alice);
        int256 bobClaim = collective.claimableOf(bob);

        assertGt(aliceClaim, 0, "alice accrued nothing");
        assertGt(bobClaim, 0, "bob accrued nothing");

        // 60:40. Exact, because instant distribution divides once by total units.
        assertEq(
            uint256(aliceClaim) * 40,
            uint256(bobClaim) * 60,
            "payout must follow the unit ratio"
        );

        // And it is really theirs — claim moves it to the wallet.
        uint256 before = ISuperToken(ETHX).balanceOf(alice);
        collective.pool().claimAll(alice);
        assertEq(
            ISuperToken(ETHX).balanceOf(alice) - before,
            uint256(aliceClaim),
            "claimAll must pay exactly what was claimable"
        );
    }

    function test_Fork_DistributeWrapsNativeIntoSuperToken() public {
        if (!_fork()) return;
        _deploy(50, 50);

        vm.deal(address(collective), 3 ether);
        assertEq(ISuperToken(ETHX).balanceOf(address(collective)), 0);

        collective.distribute();

        // The native balance became ETHx and left for the pool.
        assertEq(address(collective).balance, 0, "native should be fully wrapped");
    }

    // ═══════════════════════════════════════════════════════════
    // STREAMING — the capability the split does not have
    // ═══════════════════════════════════════════════════════════

    function test_Fork_FlowStreamsContinuouslyWithoutFurtherCalls() public {
        if (!_fork()) return;
        _deploy(60, 40);

        // A stream needs a buffer locked up front, so the collective must be
        // funded before opening one.
        vm.deal(address(collective), 10 ether);
        collective.wrap();

        // ~0.0001 ETH per second.
        int96 rate = int96(int256(uint256(1e14)));

        vm.prank(poolMgr);
        collective.setFlowRate(rate);

        assertEq(collective.flowRate(), rate, "stream did not open at the requested rate");

        // Nobody touches the contract for an hour.
        _skip(1 hours);

        int256 aliceClaim = collective.claimableOf(alice);
        int256 bobClaim = collective.claimableOf(bob);

        assertGt(aliceClaim, 0, "alice accrued nothing over the hour");
        assertGt(bobClaim, 0, "bob accrued nothing over the hour");

        // The whole point: value moved with no transaction in between.
        uint256 expectedTotal = uint256(uint96(rate)) * 1 hours;
        assertApproxEqRel(
            uint256(aliceClaim + bobClaim),
            expectedTotal,
            0.01e18,
            "streamed total should match rate x elapsed"
        );
        assertApproxEqRel(
            uint256(aliceClaim) * 40,
            uint256(bobClaim) * 60,
            0.01e18,
            "stream must follow the unit ratio"
        );
    }

    function test_Fork_ClosingTheStreamStopsAccrual() public {
        if (!_fork()) return;
        _deploy(50, 50);

        vm.deal(address(collective), 10 ether);
        collective.wrap();

        vm.startPrank(poolMgr);
        collective.setFlowRate(int96(int256(uint256(1e14))));
        _skip(1 hours);
        collective.setFlowRate(0);
        vm.stopPrank();

        assertEq(collective.flowRate(), 0, "stream should be closed");

        collective.pool().claimAll(alice);
        uint256 afterClose = ISuperToken(ETHX).balanceOf(alice);

        _skip(7 days);
        collective.pool().claimAll(alice);

        assertEq(
            ISuperToken(ETHX).balanceOf(alice),
            afterClose,
            "a closed stream must not keep paying"
        );
    }

    // ═══════════════════════════════════════════════════════════
    // ROLES — the payout half
    // ═══════════════════════════════════════════════════════════

    function test_Fork_OnlyPoolManagerCanMoveUnits() public {
        if (!_fork()) return;
        _deploy(60, 40);

        // Read the role FIRST. Inside `expectRevert(...)` this is a call like
        // any other and would consume the prank, sending `setMemberUnits` from
        // the test contract instead of from `stranger`.
        bytes32 role = collective.POOL_MANAGER_ROLE();

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                stranger,
                role
            )
        );
        collective.setMemberUnits(stranger, 1000);

        vm.prank(poolMgr);
        collective.setMemberUnits(alice, 10);
        assertEq(collective.unitsOf(alice), 10);
    }

    /// @dev The tax manager governs slots, not money. Proving the boundary
    ///      holds on this engine too is the point of a second implementation.
    function test_Fork_TaxManagerCannotTouchThePool() public {
        if (!_fork()) return;
        _deploy(60, 40);

        vm.prank(taxMgr);
        vm.expectRevert();
        collective.setMemberUnits(taxMgr, 999);
    }

    function test_Fork_PauseStopsDistribution() public {
        if (!_fork()) return;
        _deploy(50, 50);

        vm.prank(poolMgr);
        collective.setPaused(true);

        vm.deal(address(collective), 1 ether);
        vm.expectRevert(SlotStreamCollective.DistributionPaused.selector);
        collective.distribute();
    }

    // ═══════════════════════════════════════════════════════════
    // SHARED GOVERNANCE — identical behaviour to SlotCollective
    // ═══════════════════════════════════════════════════════════

    function test_Fork_GovernanceRelaysWorkUnderTheStreamEngine() public {
        if (!_fork()) return;
        _deploy(50, 50);

        vm.prank(taxMgr);
        collective.proposeTaxUpdate(IManagedSlot(address(slot)), 750);
        assertEq(slot.taxPct(), 750, "tax relay did not reach the slot");

        vm.prank(taxMgr);
        collective.setLiquidationBounty(IManagedSlot(address(slot)), 200);
        assertEq(slot.bountyBps(), 200);

        // And the separation of powers still holds: a pool manager runs money,
        // not the slot's policy.
        vm.prank(poolMgr);
        vm.expectRevert();
        collective.proposePolicyUpdate(IManagedSlot(address(slot)), address(0xBEEF));

        // The admin reaches everything, as on the split engine.
        vm.prank(admin);
        collective.proposePolicyUpdate(IManagedSlot(address(slot)), address(0xBEEF));
        assertEq(slot.policy(), address(0xBEEF));
    }

    function test_Fork_RejectsEmptyPool() public {
        if (!_fork()) return;

        SlotStreamCollective impl =
            new SlotStreamCollective(GDA_FORWARDER, ETHX, true);

        address[] memory members = new address[](1);
        members[0] = alice;
        uint128[] memory units = new uint128[](1);
        units[0] = 0; // totals zero — a recipient that could never pay anyone

        SlotStreamCollective.InitialRoles memory roles = SlotStreamCollective
            .InitialRoles({
            admin: admin,
            taxManagers: new address[](0),
            policyManagers: new address[](0),
            utilityManagers: new address[](0),
            poolManagers: new address[](0)
        });

        vm.expectRevert(SlotStreamCollective.EmptyPool.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                SlotStreamCollective.initializeStreamCollective,
                (members, units, roles)
            )
        );
    }

    function test_Fork_RejectsZeroAdmin() public {
        if (!_fork()) return;

        SlotStreamCollective impl =
            new SlotStreamCollective(GDA_FORWARDER, ETHX, true);

        address[] memory members = new address[](1);
        members[0] = alice;
        uint128[] memory units = new uint128[](1);
        units[0] = 100;

        SlotStreamCollective.InitialRoles memory roles = SlotStreamCollective
            .InitialRoles({
            admin: address(0),
            taxManagers: new address[](0),
            policyManagers: new address[](0),
            utilityManagers: new address[](0),
            poolManagers: new address[](0)
        });

        vm.expectRevert(SlotGovernance.AdminRequired.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                SlotStreamCollective.initializeStreamCollective,
                (members, units, roles)
            )
        );
    }
}
