// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {IPolicyFactory} from "../src/v1/interfaces/IPolicyFactory.sol";
import {MinimumPricePolicyFactory} from "../src/v1/policies/MinimumPricePolicyFactory.sol";
import {MinimumTenurePolicyFactory} from "../src/v1/policies/MinimumTenurePolicyFactory.sol";

/**
 * @title DeployPolicyFactories
 * @notice Deploys both term-policy factories, now that they implement
 *         `IPolicyFactory`, plus a starter set of policies through them.
 *
 * @dev ── Why this supersedes the previous factories ─────────────────────────
 *      Adding `policyKind()`/`verify()` changes each factory's bytecode, and a
 *      factory is the CREATE2 deployer for everything it makes — so every
 *      policy address it predicts changes with it. The old factories and the
 *      policies they made are still on-chain and still work; they are simply no
 *      longer verifiable against the new ones, and slots pointing at them read
 *      as unrecognised. That is the honest answer rather than a bug: the
 *      resolver is saying it cannot vouch for an address, which is true.
 *
 *      Accepted here because Base Sepolia is disposable. On a chain that is
 *      not, deploy an `IPolicyFactory` adapter that delegates to the existing
 *      factory's `predict()` instead — same uniform interface, nothing orphaned.
 *
 *      ── Starter policies ─────────────────────────────────────────────────
 *      Pure convenience: pre-paying the ~250k gas so the first user of common
 *      terms gets a one-transaction create instead of two. Any other terms
 *      remain reachable on demand through `getOrDeploy`.
 */
contract DeployPolicyFactories is BaseScript {
    // Feed USDC (USDCf), 6 decimals — the default currency on Base Sepolia.
    address constant USDCF = 0xFA28A416810e39a7142C7557e6e43407d765f627;

    function run() external broadcastOn(DeployementChain.BaseSepolia) {
        MinimumTenurePolicyFactory tenureF = new MinimumTenurePolicyFactory();
        MinimumPricePolicyFactory priceF = new MinimumPricePolicyFactory();

        console2.log("MinimumTenurePolicyFactory", address(tenureF));
        console2.log("MinimumPricePolicyFactory ", address(priceF));

        _saveDeployment(address(tenureF), "MinimumTenurePolicyFactory");
        _saveDeployment(address(priceF), "MinimumPricePolicyFactory");

        // Tenure: an hour for high-frequency use, a day and a week for holding.
        uint256[3] memory windows = [uint256(1 hours), 1 days, 7 days];
        for (uint256 i = 0; i < windows.length; i++) {
            address p = tenureF.getOrDeploy(windows[i]);
            require(tenureF.verify(p), "tenure policy must verify");
            console2.log("  tenure", windows[i], p);
        }

        // Price floors, in USDCf.
        uint256[2] memory floors = [uint256(1e6), 10e6];
        for (uint256 i = 0; i < floors.length; i++) {
            address p = priceF.getOrDeploy(USDCF, floors[i]);
            require(priceF.verify(p), "price policy must verify");
            console2.log("  floor USDCf", floors[i], p);
        }

        // The property the whole uniform-resolution design rests on: a factory
        // must not claim another factory's policies.
        require(
            !priceF.verify(tenureF.predict(1 days)),
            "price factory must reject a tenure policy"
        );
        require(
            !tenureF.verify(priceF.predict(USDCF, 1e6)),
            "tenure factory must reject a price policy"
        );

        require(
            keccak256(bytes(IPolicyFactory(address(tenureF)).policyKind())) ==
                keccak256("MinimumTenurePolicy"),
            "unexpected tenure kind"
        );
        console2.log("cross-factory verification checks passed");
    }
}
