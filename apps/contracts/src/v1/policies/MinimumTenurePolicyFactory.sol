// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IPolicyFactory} from "../interfaces/IPolicyFactory.sol";
import {MinimumTenurePolicy} from "./MinimumTenurePolicy.sol";

/// @title MinimumTenurePolicyFactory
/// @notice Deploys one `MinimumTenurePolicy` per tenure duration, at an address
///         determined solely by that duration.
///
/// @dev `MinimumTenurePolicy` stores its window in an immutable constructor arg
///      rather than in storage, so the policy is a stateless singleton whose
///      configuration IS its address. That is what makes it safe: there is no
///      setter, so nobody — not the slot's manager, not this factory — can
///      lengthen protection while an occupant is sitting behind it.
///
///      The cost of that design is one deployment per duration. This factory
///      pays it once, protocol-wide: CREATE2 with the duration as the salt
///      means a given tenure always lands at the same address, so the second
///      slot to want 7 days reuses the first slot's policy rather than
///      deploying its own.
///
///      `predict` is a pure address computation, so a client can resolve the
///      policy for any duration without a transaction and skip `getOrDeploy`
///      entirely when that address already has code.
contract MinimumTenurePolicyFactory is IPolicyFactory {
    event TenurePolicyDeployed(
        address indexed policy,
        uint256 indexed tenureSeconds
    );

    error InvalidTenure();

    /// @notice Deploy the policy for `tenureSeconds`, or return the existing one.
    /// @dev Idempotent and permissionless — calling it for an already-deployed
    ///      duration is a no-op that still returns the right address.
    function getOrDeploy(
        uint256 tenureSeconds
    ) external returns (address policy) {
        if (tenureSeconds == 0) revert InvalidTenure();

        policy = predict(tenureSeconds);
        if (policy.code.length != 0) return policy;

        policy = address(
            new MinimumTenurePolicy{salt: bytes32(tenureSeconds)}(tenureSeconds)
        );
        emit TenurePolicyDeployed(policy, tenureSeconds);
    }

    /// @notice The address the policy for `tenureSeconds` has, or would have.
    function predict(uint256 tenureSeconds) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(tenureSeconds),
                keccak256(
                    abi.encodePacked(
                        type(MinimumTenurePolicy).creationCode,
                        abi.encode(tenureSeconds)
                    )
                )
            );
    }

    /// @notice Whether the policy for `tenureSeconds` is already deployed.
    /// @dev Lets a client decide between one transaction and two.
    function isDeployed(uint256 tenureSeconds) external view returns (bool) {
        return predict(tenureSeconds).code.length != 0;
    }

    // ─── IPolicyFactory ─────────────────────────────────────────────────────

    /// @inheritdoc IPolicyFactory
    function policyKind() external pure returns (string memory) {
        return "MinimumTenurePolicy";
    }

    /// @inheritdoc IPolicyFactory
    /// @dev Reading `tenureSeconds()` off an untrusted address proves nothing on
    ///      its own — anything can return a number. The proof is that
    ///      `predict()` of that number lands back on the address we were asked
    ///      about, which only a real deployment from this factory can do.
    function verify(address policy) external view returns (bool) {
        // `try` does NOT catch this: for a call to an address with no code the
        // compiler's extcodesize check reverts before the call is even made, and
        // that revert lands outside the try/catch. The interface requires false,
        // not a revert, because callers loop over factories.
        if (policy.code.length == 0) return false;

        try MinimumTenurePolicy(policy).tenureSeconds() returns (uint256 s) {
            if (s == 0) return false;
            return predict(s) == policy;
        } catch {
            return false;
        }
    }
}
