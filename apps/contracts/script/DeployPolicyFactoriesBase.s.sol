// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {IPolicyFactory} from "../src/v1/interfaces/IPolicyFactory.sol";
import {MinimumPricePolicyFactory} from "../src/v1/policies/MinimumPricePolicyFactory.sol";
import {MinimumTenurePolicyFactory} from "../src/v1/policies/MinimumTenurePolicyFactory.sol";

/**
 * @title DeployPolicyFactoriesBase
 * @notice Deploys the term-policy factories to Base mainnet, plus a starter set
 *         of policies through them.
 *
 * @dev Run AFTER `UpgradeBaseMainnet`. Policies are inert without a slot
 *      implementation that consults them, and a policy address deployed before
 *      the upgrade would be indistinguishable from one deployed after — better
 *      that the ordering is unambiguous.
 *
 *      ── Why mainnet gets its own script ───────────────────────────────────
 *      `DeployPolicyFactories` is pinned to Base Sepolia and to USDCf, a
 *      mintable test token that does not exist here. A price floor is a bare
 *      integer whose meaning comes entirely from its currency, so pointing the
 *      testnet script at mainnet would silently deploy floors denominated in
 *      the wrong token.
 *
 *      That script also documents an accepted cost — superseding a factory
 *      orphans every policy it deployed, because a factory is the CREATE2
 *      deployer and every predicted address moves with its bytecode. It calls
 *      Base Sepolia disposable and says that on a chain that is not, the answer
 *      is an adapter. This is that chain. These are the FIRST policy factories
 *      on mainnet, so nothing is orphaned today — but the addresses recorded
 *      here are the ones the SDK will vouch for, and superseding them later
 *      costs real users their policy badges.
 *
 *      ── After running ─────────────────────────────────────────────────────
 *      Add the printed factory and policy addresses to the SDK's vouched
 *      registry under chainId 8453. Until then the explorer renders these
 *      policies as bare addresses — which is honest, just unhelpful.
 */
contract DeployPolicyFactoriesBase is BaseScript {
    /// @notice Circle USDC on Base, 6 decimals. The default slot currency here.
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external broadcastOn(DeployementChain.Base) {
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

        // Price floors, in USDC (6 decimals): 1 and 10 dollars.
        uint256[2] memory floors = [uint256(1e6), 10e6];
        for (uint256 i = 0; i < floors.length; i++) {
            address p = priceF.getOrDeploy(USDC, floors[i]);
            require(priceF.verify(p), "price policy must verify");
            console2.log("  floor USDC", floors[i], p);
        }

        // The property the whole uniform-resolution design rests on: a factory
        // must not claim another factory's policies.
        require(
            !priceF.verify(tenureF.predict(1 days)),
            "price factory must reject a tenure policy"
        );
        require(
            !tenureF.verify(priceF.predict(USDC, 1e6)),
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
