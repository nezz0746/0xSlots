// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";
import {IOccupancyPolicy} from "../src/v1/interfaces/IOccupancyPolicy.sol";
import {MinimumPricePolicy} from "../src/v1/policies/MinimumPricePolicy.sol";
import {MinimumPricePolicyFactory} from "../src/v1/policies/MinimumPricePolicyFactory.sol";

contract MPMockERC20 is ERC20 {
    uint8 private immutable _dec;
    constructor(string memory n, uint8 d) ERC20(n, n) { _dec = d; _mint(msg.sender, 1e30); }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/**
 * @title MinimumPricePolicyTest
 * @notice A reserve price for a slot: nobody may declare below the floor.
 *
 * @dev This is a RECIPIENT-side rule, not occupant comfort. It guarantees a
 *      minimum tax base so a slot cannot be parked on at dust valuation.
 *
 *      It is sound where a *relative* floor ("beat the current price by 10%")
 *      would not be: the value is fixed at deployment, identical for everyone,
 *      and known before anyone enters, so it never lets an incumbent inflate
 *      what the next buyer must declare. Price-setting stays with the buyer.
 */
contract MinimumPricePolicyTest is Test {
    SlotFactory factory;
    MinimumPricePolicyFactory policyFactory;
    MPMockERC20 usdc;   // 6 decimals
    MPMockERC20 weth;   // 18 decimals

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant FLOOR = 100e6; // 100 USDC

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        policyFactory = new MinimumPricePolicyFactory();

        usdc = new MPMockERC20("USDC", 6);
        weth = new MPMockERC20("WETH", 18);
        usdc.mint(alice, 1e15);
        usdc.mint(bob, 1e15);
        vm.warp(1_000_000);
    }

    function _slot(IERC20 currency, address policy) internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            currency,
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(0),
                liquidationBountyBps: 500,
                minDepositSeconds: 0,
            occupancyPolicy: policy
            })));
    }

    function _buy(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        usdc.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    // ── The floor ───────────────────────────────────────────────────────────

    function test_Buy_AtOrAboveFloor_Succeeds() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);

        _buy(s, alice, 10e6, FLOOR); // exactly at the floor
        assertEq(s.occupant(), alice);
        assertEq(s.price(), FLOOR);
    }

    function test_Buy_BelowFloor_Reverts() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);

        vm.startPrank(alice);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumPricePolicy.PriceBelowFloor.selector, FLOOR)
        );
        s.buy(alice, 10e6, FLOOR - 1);
        vm.stopPrank();
    }

    /// The floor must hold on updates too, or a buyer enters above it and then
    /// immediately cuts to dust — the whole point defeated in one transaction.
    function test_SelfAssess_BelowFloor_Reverts() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);
        _buy(s, alice, 10e6, FLOOR * 2);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumPricePolicy.PriceBelowFloor.selector, FLOOR)
        );
        s.selfAssess(FLOOR - 1);
    }

    function test_SelfAssess_AboveFloor_Succeeds() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);
        _buy(s, alice, 10e6, FLOOR * 2);

        vm.prank(alice);
        s.selfAssess(FLOOR);
        assertEq(s.price(), FLOOR);
    }

    /// Forced sale is NOT delayed — anyone can take the slot at any moment, as
    /// long as they declare at least the floor. This is what separates a price
    /// floor from minimum tenure.
    function test_ForcedSale_StaysImmediate() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);
        _buy(s, alice, 10e6, FLOOR);

        _buy(s, bob, 10e6, FLOOR); // same block, no waiting
        assertEq(s.occupant(), bob);
    }

    // ── Nobody gets trapped ─────────────────────────────────────────────────

    /// An occupant who does not want the floor can always leave: `release` is
    /// never routed through a policy.
    function test_Release_IsNeverBlocked() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);
        _buy(s, alice, 10e6, FLOOR);

        vm.prank(alice);
        s.release();
        assertEq(s.occupant(), address(0));
    }

    /// Insolvency always ends occupancy, floor or no floor.
    function test_Liquidate_IsNeverBlocked() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(usdc, p);
        _buy(s, alice, 1, FLOOR); // 1 unit of deposit — insolvent almost at once

        vm.warp(block.timestamp + 365 days);
        assertTrue(s.isInsolvent());
        s.liquidate();
        assertEq(s.occupant(), address(0));
    }

    // ── Currency binding ────────────────────────────────────────────────────

    /// @dev The reason the currency is bound at all: 100e6 is 100 USDC but
    ///      0.0000000001 WETH. Without this check the same policy address
    ///      installed on an 18-decimal slot would impose a floor of dust while
    ///      the UI reported "100". Fail closed instead.
    function test_WrongCurrency_Reverts() public {
        address p = policyFactory.getOrDeploy(address(usdc), FLOOR);
        Slot s = _slot(weth, p); // WETH slot, USDC-bound policy

        weth.mint(alice, 1e24);
        vm.startPrank(alice);
        weth.approve(address(s), type(uint256).max);
        vm.expectRevert(MinimumPricePolicy.WrongCurrency.selector);
        s.buy(alice, 1e18, 1e21);
        vm.stopPrank();
    }

    // ── Factory ─────────────────────────────────────────────────────────────

    function test_Factory_PredictMatchesDeploy() public {
        address predicted = policyFactory.predict(address(usdc), FLOOR);
        assertFalse(policyFactory.isDeployed(address(usdc), FLOOR));

        address deployed = policyFactory.getOrDeploy(address(usdc), FLOOR);
        assertEq(deployed, predicted, "CREATE2 address must be predictable");
        assertTrue(policyFactory.isDeployed(address(usdc), FLOOR));
    }

    /// Idempotent: the second slot wanting the same terms reuses the first
    /// slot's policy instead of deploying its own.
    function test_Factory_IsIdempotent() public {
        address a = policyFactory.getOrDeploy(address(usdc), FLOOR);
        address b = policyFactory.getOrDeploy(address(usdc), FLOOR);
        assertEq(a, b);
    }

    /// Different currency or different amount => different address. This is
    /// what makes a policy's terms readable from its address alone.
    function test_Factory_DistinctPerCombination() public {
        address a = policyFactory.getOrDeploy(address(usdc), FLOOR);
        address b = policyFactory.getOrDeploy(address(usdc), FLOOR * 2);
        address c = policyFactory.getOrDeploy(address(weth), FLOOR);
        assertTrue(a != b && b != c && a != c);
    }

    function test_Factory_RejectsZeroFloor() public {
        vm.expectRevert(MinimumPricePolicyFactory.InvalidFloor.selector);
        policyFactory.getOrDeploy(address(usdc), 0);
    }

    /// @dev `address(0)` used to be rejected here. It is now the native-ETH
    ///      sentinel, and it denotes 18 decimals unambiguously — which is the
    ///      only thing binding a currency to the floor was ever protecting
    ///      against, so the guarantee survives rather than being dropped.
    function test_Factory_AcceptsNativeCurrency() public {
        address policy = policyFactory.getOrDeploy(address(0), FLOOR);
        assertEq(address(MinimumPricePolicy(policy).currency()), address(0));
        assertEq(MinimumPricePolicy(policy).minPrice(), FLOOR);
    }

    /// @dev The rejection that replaced it: a non-zero currency must be a real
    ///      contract. This case previously slipped through.
    function test_Factory_RejectsCodelessCurrency() public {
        vm.expectRevert(MinimumPricePolicyFactory.InvalidCurrency.selector);
        policyFactory.getOrDeploy(makeAddr("notAToken"), FLOOR);
    }

    // ── Introspection ───────────────────────────────────────────────────────

    function test_Policy_ExposesItsTerms() public {
        MinimumPricePolicy p = MinimumPricePolicy(
            policyFactory.getOrDeploy(address(usdc), FLOOR)
        );
        assertEq(p.minPrice(), FLOOR);
        assertEq(address(p.currency()), address(usdc));
        assertTrue(p.supportsInterface(type(IOccupancyPolicy).interfaceId));
        assertTrue(p.supportsInterface(type(IERC165).interfaceId));
    }
}
