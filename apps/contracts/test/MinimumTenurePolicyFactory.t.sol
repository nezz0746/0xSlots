// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MinimumTenurePolicy} from "../src/v1/policies/MinimumTenurePolicy.sol";
import {MinimumTenurePolicyFactory} from "../src/v1/policies/MinimumTenurePolicyFactory.sol";
import {IOccupancyPolicy} from "../src/v1/interfaces/IOccupancyPolicy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MinimumTenurePolicyFactoryTest is Test {
    MinimumTenurePolicyFactory factory;

    function setUp() public {
        factory = new MinimumTenurePolicyFactory();
    }

    function test_DeploysPolicyWithRequestedTenure() public {
        address p = factory.getOrDeploy(7 days);
        assertEq(MinimumTenurePolicy(p).tenureSeconds(), 7 days);
        assertTrue(
            IOccupancyPolicy(p).supportsInterface(
                type(IOccupancyPolicy).interfaceId
            )
        );
    }

    /// The whole point of CREATE2 here: the second slot wanting 7 days reuses
    /// the first slot's policy instead of paying for its own.
    function test_SameTenureReturnsSameAddress() public {
        address a = factory.getOrDeploy(7 days);
        address b = factory.getOrDeploy(7 days);
        assertEq(a, b);
    }

    function test_DifferentTenuresGetDifferentPolicies() public {
        address week = factory.getOrDeploy(7 days);
        address month = factory.getOrDeploy(30 days);
        assertTrue(week != month);
        assertEq(MinimumTenurePolicy(week).tenureSeconds(), 7 days);
        assertEq(MinimumTenurePolicy(month).tenureSeconds(), 30 days);
    }

    /// A client must be able to resolve the address without a transaction, so
    /// it can skip the deploy when the duration already exists.
    function test_PredictMatchesDeployedAddress() public {
        address predicted = factory.predict(3 days);
        assertFalse(factory.isDeployed(3 days));

        address actual = factory.getOrDeploy(3 days);
        assertEq(actual, predicted);
        assertTrue(factory.isDeployed(3 days));
    }

    function test_PredictIsStableBeforeAndAfterDeploy() public {
        address before = factory.predict(12 hours);
        factory.getOrDeploy(12 hours);
        assertEq(factory.predict(12 hours), before);
    }

    function test_RejectsZeroTenure() public {
        vm.expectRevert(MinimumTenurePolicyFactory.InvalidTenure.selector);
        factory.getOrDeploy(0);
    }

    /// Redeploying must not revert — a client that races another caller for the
    /// same duration should still get a usable address rather than a failed tx.
    function test_GetOrDeployIsIdempotentAcrossCallers() public {
        address a = factory.getOrDeploy(1 days);
        vm.prank(makeAddr("someoneElse"));
        address b = factory.getOrDeploy(1 days);
        assertEq(a, b);
    }

    function testFuzz_PredictAlwaysMatches(uint64 tenure) public {
        vm.assume(tenure > 0);
        address predicted = factory.predict(tenure);
        assertEq(factory.getOrDeploy(tenure), predicted);
        assertEq(MinimumTenurePolicy(predicted).tenureSeconds(), tenure);
    }
}
