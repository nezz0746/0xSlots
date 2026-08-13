// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/interfaces/IOccupancyPolicy.sol";
import {MinimumTenurePolicy} from "../src/policies/MinimumTenurePolicy.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { _mint(msg.sender, 1_000_000 ether); }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Policy that blocks everything. Proves the veto is wired and fail-closed.
contract DenyAllPolicy is IOccupancyPolicy {
    error Denied();
    function checkBuy(OccupancyContext calldata) external pure { revert Denied(); }
    function checkPriceUpdate(OccupancyContext calldata) external pure { revert Denied(); }
    function name() external pure returns (string memory) { return "DenyAll"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @dev Permits buying, denies repricing. Lets a test reach checkPriceUpdate.
contract DenyPriceUpdatePolicy is IOccupancyPolicy {
    error NoReprice();
    function checkBuy(OccupancyContext calldata) external pure {}
    function checkPriceUpdate(OccupancyContext calldata) external pure { revert NoReprice(); }
    function name() external pure returns (string memory) { return "DenyReprice"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @dev Allows everything, but asserts the slot populated the context.
contract AllowAllPolicy is IOccupancyPolicy {
    function checkBuy(OccupancyContext calldata ctx) external view {
        require(ctx.slot == msg.sender, "ctx.slot must be the caller");
    }
    function checkPriceUpdate(OccupancyContext calldata) external pure {}
    function name() external pure returns (string memory) { return "AllowAll"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

contract OccupancyPolicyTest is Test {
    SlotFactory factory;
    MockERC20 token;
    Slot slotImplRef;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new MockERC20();
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    /// @dev Same terms, plus a policy. A slot's policy is part of its founding
    ///      tuple now, so a test that wants one passes it at creation.
    function _initWith(address policy) internal pure returns (SlotInitParams memory p) {
        p = _init();
        p.occupancyPolicy = policy;
    }

    function _init() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,
            utility: address(0),
            liquidationBountyBps: 500,
            minDepositSeconds: 86400,
            occupancyPolicy: address(0)
        });
    }

    function _immutableConfig() internal pure returns (SlotConfig memory) {
        return SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)});
    }

    /// No policy attached — behaviour must be byte-for-byte as today.
    function test_NoPolicy_BuyWorks() public {
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupant(), alice);
    }

    function test_Policy_BlocksBuy() public {
        DenyAllPolicy policy = new DenyAllPolicy();
        address s = factory.createSlot(
            recipient, IERC20(address(token)), _immutableConfig(), _initWith(address(policy)));
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        vm.expectRevert(DenyAllPolicy.Denied.selector);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
    }

    function test_AllowAllPolicy_ReceivesPopulatedContext() public {
        AllowAllPolicy allow = new AllowAllPolicy();
        address s = factory.createSlot(
            recipient, IERC20(address(token)), _immutableConfig(), _initWith(address(allow)));
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupant(), alice);
    }

    /// @dev `selfAssess` is `onlyOccupant`, and modifiers run before the body,
    ///      so the caller must genuinely occupy the slot for the policy to be
    ///      reached. Hence a policy that permits buying but denies repricing.
    function test_Policy_BlocksSelfAssess() public {
        DenyPriceUpdatePolicy p = new DenyPriceUpdatePolicy();
        address s = factory.createSlot(
            recipient, IERC20(address(token)), _immutableConfig(), _initWith(address(p)));
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.expectRevert(DenyPriceUpdatePolicy.NoReprice.selector);
        Slot(s).selfAssess(50 ether);
        vm.stopPrank();
    }

    function test_Factory_VerifiesPolicy() public {
        DenyAllPolicy p = new DenyAllPolicy();
        factory.setPolicyVerified(address(p), true);
        assertTrue(factory.verifiedPolicies(address(p)));
    }

    function test_OccupiedSince_SetOnBuy() public {
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());
        vm.warp(1_000_000);
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupiedSince(), 1_000_000);
    }

    function test_ProposePolicyUpdate_AppliesOnTransition() public {
        // mutablePolicy, not mutableUtility — the two are separate promises.
        SlotConfig memory cfg = SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: true, manager: manager});
        address s = factory.createSlot(recipient, IERC20(address(token)), cfg, _init());

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        vm.stopPrank();

        DenyAllPolicy policy = new DenyAllPolicy();
        vm.prank(manager);
        Slot(s).proposePolicyUpdate(address(policy));

        // Not applied yet — still no policy
        assertEq(Slot(s).occupancyPolicy(), address(0));

        // Transition applies it
        vm.startPrank(bob);
        token.approve(s, type(uint256).max);
        Slot(s).buy(bob, 10 ether, 100 ether);
        vm.stopPrank();

        assertEq(Slot(s).occupancyPolicy(), address(policy));
    }

    function test_ProposePolicyUpdate_RevertsWhenNotMutable() public {
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());
        DenyAllPolicy policy = new DenyAllPolicy();
        vm.expectRevert(NotManager.selector);
        Slot(s).proposePolicyUpdate(address(policy));
    }

    function _tenureSlot(MinimumTenurePolicy p) internal returns (address) {
        return factory.createSlot(
            recipient, IERC20(address(token)), _immutableConfig(), _initWith(address(p)));
    }

    /// 1% monthly on 100 ether over 7 days = 100e18 * 100 * 604800 / (2592000 * 10000)
    /// @dev Rounds UP, mirroring `Slot._minDepositFor`. This helper doubles as
    ///      the expected core floor, so a truncating copy here would assert a
    ///      floor one wei below the one the contract actually enforces.
    function _tenureCost(uint256 price_, uint256 tenure) internal pure returns (uint256) {
        return Math.ceilDiv(price_ * 100 * tenure, 30 days * 10_000);
    }

    function test_Tenure_BlocksBuyInsideWindow() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need, 100 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 3 days);
        vm.startPrank(bob);
        token.approve(s, type(uint256).max);
        vm.expectRevert();
        Slot(s).buy(bob, need, 100 ether);
        vm.stopPrank();
    }

    function test_Tenure_AllowsBuyAfterWindow() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need * 4, 100 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days + 1);
        vm.startPrank(bob);
        token.approve(s, type(uint256).max);
        Slot(s).buy(bob, need, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupant(), bob);
    }

    /// @dev Pins the documented limit of condition 1. The tenure escrow is
    ///      checked at entry and never again, and `Slot.withdraw` consults no
    ///      policy — only the core's own `minDepositSeconds` floor. So the
    ///      escrow binds exactly as far as that floor reaches and no further:
    ///      here Alice funds 7 days of protection, withdraws back down to the
    ///      1-day floor, and keeps all 7 days of it.
    ///
    ///      Asserted rather than fixed because the economics survive it.
    ///      Protection outlives solvency, but liquidation is never vetoable, so
    ///      from day 1 onward Alice can be removed by anyone. What the leak
    ///      actually costs is the BUYOUT channel: days 1–7 a rival must
    ///      liquidate to vacancy instead of buying at the declared price. A
    ///      slot that needs the escrow to bind for its whole term sets
    ///      `minDepositSeconds >= tenureSeconds`, moving the floor into the
    ///      core where `withdraw` does enforce it.
    function test_Tenure_ProtectionOutlivesTheEscrowDownToTheCoreFloor() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);
        uint256 floor = _tenureCost(100 ether, 1 days); // == minDepositSeconds

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need, 100 ether);
        // The core floor is the only thing stopping a full withdrawal.
        vm.expectRevert(InsufficientDeposit.selector);
        Slot(s).withdraw(need);
        Slot(s).withdraw(need - floor);
        vm.stopPrank();
        assertEq(Slot(s).deposit(), floor, "escrow drained to the core floor");

        // One day funded, seven days protected. Past the runway Alice is
        // insolvent — and still cannot be bought out.
        vm.warp(block.timestamp + 2 days);
        assertTrue(Slot(s).isInsolvent(), "runway exhausted");

        vm.startPrank(bob);
        token.approve(s, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenurePolicy.TenureNotElapsed.selector,
                Slot(s).occupiedSince() + 7 days
            )
        );
        Slot(s).buy(bob, need, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupant(), alice, "protection outlived the escrow");

        // The backstop that keeps this sound: liquidation ignores the policy.
        vm.prank(bob);
        Slot(s).liquidate();
        assertEq(Slot(s).occupant(), address(0), "liquidated inside the window");
    }

    function test_Tenure_RejectsUnderfundedBuy() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        vm.expectRevert();
        Slot(s).buy(alice, need - 1, 100 ether);
        vm.stopPrank();
    }

    function test_Tenure_RejectsPriceCutInsideWindow() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need * 4, 100 ether);
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(MinimumTenurePolicy.PriceCutDuringTenure.selector);
        Slot(s).selfAssess(1 ether);
        vm.stopPrank();
    }

    function test_Tenure_AllowsPriceRaiseInsideWindow() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need * 8, 100 ether);
        vm.warp(block.timestamp + 1 days);
        Slot(s).selfAssess(200 ether);
        vm.stopPrank();
        assertEq(Slot(s).price(), 200 ether);
    }

    /// Insolvency must always end tenure — this is the safety invariant.
    /// @dev The deposit is sized to exactly cover the tenure, so it cannot run
    ///      out before the window closes on its own. Alice therefore RAISES her
    ///      price mid-window (permitted by checkPriceUpdate), which burns the
    ///      escrow ~100x faster and makes her insolvent while still deep inside
    ///      the protection window. Warping past the tenure instead would prove
    ///      nothing — liquidation is trivially allowed once protection lapses.
    function test_Tenure_LiquidationWorksInsideWindow() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(365 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 365 days);

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need, 100 ether);
        uint256 start = block.timestamp;

        vm.warp(start + 1 days);
        Slot(s).selfAssess(10_000 ether);
        vm.stopPrank();

        vm.warp(start + 30 days);
        assertLt(block.timestamp, start + 365 days, "must still be inside tenure");
        assertTrue(Slot(s).isInsolvent(), "escrow must be exhausted");

        Slot(s).liquidate();
        assertEq(Slot(s).occupant(), address(0));
    }

    /// Vacant slots are always claimable.
    function test_Tenure_VacantAlwaysClaimable() public {
        MinimumTenurePolicy p = new MinimumTenurePolicy(7 days);
        address s = _tenureSlot(p);
        uint256 need = _tenureCost(100 ether, 7 days);
        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, need, 100 ether);
        vm.stopPrank();
        assertEq(Slot(s).occupant(), alice);
    }

    function test_Operator_CanSelfAssess() public {
        address agent = makeAddr("agent");
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        Slot(s).setOperator(agent, true);
        vm.stopPrank();

        vm.prank(agent);
        Slot(s).selfAssess(150 ether);
        assertEq(Slot(s).price(), 150 ether);
    }

    function test_Operator_CannotWithdraw() public {
        address agent = makeAddr("agent");
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        Slot(s).setOperator(agent, true);
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert(NotOccupant.selector);
        Slot(s).withdraw(1 ether);
    }

    function test_Operator_CannotRelease() public {
        address agent = makeAddr("agent");
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        Slot(s).setOperator(agent, true);
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert(NotOccupant.selector);
        Slot(s).release();
    }

    function test_Operator_RevokedCannotAct() public {
        address agent = makeAddr("agent");
        address s = factory.createSlot(recipient, IERC20(address(token)), _immutableConfig(), _init());

        vm.startPrank(alice);
        token.approve(s, type(uint256).max);
        Slot(s).buy(alice, 10 ether, 100 ether);
        Slot(s).setOperator(agent, true);
        Slot(s).setOperator(agent, false);
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert(NotOccupant.selector);
        Slot(s).selfAssess(150 ether);
    }
}
