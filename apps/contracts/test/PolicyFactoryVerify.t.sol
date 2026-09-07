// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPolicyFactory} from "../src/v1/interfaces/IPolicyFactory.sol";
import {IOccupancyPolicy} from "../src/v1/interfaces/IOccupancyPolicy.sol";
import {MinimumTenurePolicy} from "../src/v1/policies/MinimumTenurePolicy.sol";
import {MinimumTenurePolicyFactory} from "../src/v1/policies/MinimumTenurePolicyFactory.sol";
import {MinimumPricePolicy} from "../src/v1/policies/MinimumPricePolicy.sol";
import {MinimumPricePolicyFactory} from "../src/v1/policies/MinimumPricePolicyFactory.sol";

contract PFToken is ERC20 {
    constructor() ERC20("T", "T") {}
}

/// @dev The forgery: exposes exactly the getters a factory reads, with values
///      that would produce a flattering label. It is not at the CREATE2 address
///      those values imply, which is the only thing that matters.
contract FakeTenurePolicy {
    function tenureSeconds() external pure returns (uint256) {
        return 7 days;
    }
}

contract FakePricePolicy {
    address public immutable c;
    constructor(address _c) { c = _c; }
    function minPrice() external pure returns (uint256) { return 100e6; }
    function currency() external view returns (address) { return c; }
}

/// @notice Draft: does a uniform `verify` actually discriminate?
contract PolicyFactoryVerifyTest is Test {
    MinimumTenurePolicyFactory tenureF;
    MinimumPricePolicyFactory priceF;
    PFToken token;

    function setUp() public {
        tenureF = new MinimumTenurePolicyFactory();
        priceF = new MinimumPricePolicyFactory();
        token = new PFToken();
    }

    function test_Verify_AcceptsGenuine() public {
        address t = tenureF.getOrDeploy(7 days);
        address p = priceF.getOrDeploy(address(token), 100e6);

        assertTrue(tenureF.verify(t), "genuine tenure policy");
        assertTrue(priceF.verify(p), "genuine price policy");
    }

    /// The point of the CREATE2 comparison: a contract can claim anything.
    function test_Verify_RejectsForgery() public {
        address fakeT = address(new FakeTenurePolicy());
        address fakeP = address(new FakePricePolicy(address(token)));

        assertFalse(tenureF.verify(fakeT), "forged tenure must not verify");
        assertFalse(priceF.verify(fakeP), "forged price must not verify");
    }

    /// A factory must not claim another factory's policies.
    function test_Verify_RejectsOtherKinds() public {
        address t = tenureF.getOrDeploy(7 days);
        address p = priceF.getOrDeploy(address(token), 100e6);

        assertFalse(priceF.verify(t), "price factory must reject a tenure policy");
        assertFalse(tenureF.verify(p), "tenure factory must reject a price policy");
    }

    /// Must return false, never revert — callers loop over factories.
    function test_Verify_ReturnsFalseForNonContracts() public {
        assertFalse(tenureF.verify(makeAddr("eoa")));
        assertFalse(priceF.verify(makeAddr("eoa")));
        assertFalse(tenureF.verify(address(0)));
        assertFalse(priceF.verify(address(0)));
    }

    /// policyKind() must match what the policies themselves report, so a client
    /// can key a formatter off either.
    function test_PolicyKind_MatchesPolicyName() public {
        address t = tenureF.getOrDeploy(7 days);
        address p = priceF.getOrDeploy(address(token), 100e6);

        assertEq(tenureF.policyKind(), IOccupancyPolicy(t).name());
        assertEq(priceF.policyKind(), IOccupancyPolicy(p).name());
    }

    /// The uniform loop a client would run, with no per-kind knowledge.
    function test_UniformResolutionLoop() public {
        address p = priceF.getOrDeploy(address(token), 100e6);

        IPolicyFactory[] memory factories = new IPolicyFactory[](2);
        factories[0] = IPolicyFactory(address(tenureF));
        factories[1] = IPolicyFactory(address(priceF));

        string memory kind = "";
        for (uint256 i = 0; i < factories.length; i++) {
            if (factories[i].verify(p)) {
                kind = factories[i].policyKind();
                break;
            }
        }
        assertEq(kind, "MinimumPricePolicy");
    }
}
