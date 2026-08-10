// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {MinimumTenurePolicy} from "../src/policies/MinimumTenurePolicy.sol";
import {MinimumTenurePolicyFactory} from "../src/policies/MinimumTenurePolicyFactory.sol";

/**
 * @title RedeployTenurePolicyFactory
 * @notice Ships the tenure policy whose pre-payment requirement rounds UP, so
 *         it cannot round to zero and let a slot be claimed for nothing.
 *
 * @dev ── Why the FACTORY has to move, not just the policy ─────────────────
 *      `MinimumTenurePolicyFactory` deploys its policies with
 *      `new MinimumTenurePolicy{salt: ...}(...)`, which bakes that contract's
 *      creation code into the FACTORY's own bytecode at compile time. The
 *      factory already on chain therefore deploys the OLD, truncating policy
 *      and always will — there is no way to make it produce the fixed one.
 *      Changing `MinimumTenurePolicy` changes the factory's bytecode, so the
 *      factory lands at a new address and every tenure it predicts moves with
 *      it. The require below is what proves that actually happened.
 *
 *      ── The cost, which is known and accepted ────────────────────────────
 *      `RedeployPricePolicyFactory` declined to touch this factory precisely
 *      because doing so "would orphan the three mainnet tenure policies the
 *      SDK vouches for — 1h, 1d and 7d". That is the price of the fix, and it
 *      is now being paid deliberately.
 *
 *      The old policies keep working on every slot already pointing at one:
 *      those contracts are unchanged and still deployed. What they lose is
 *      derivability — `resolvePolicy`'s CREATE2 provenance check verifies
 *      against the factories in `POLICY_FACTORIES`, so once the new factory is
 *      current the old tenures resolve only if the OLD factory stays in that
 *      list. Keep it there, and mark the three vouched entries `superseded`.
 *
 *      Note what this does NOT fix: a slot created with `mutablePolicy: false`
 *      that already points at an old tenure policy can never be repointed. It
 *      keeps the truncating pre-payment for good. The core floor in `Slot`
 *      still protects it — that half ships by beacon and reaches every slot —
 *      but only when the slot sets `minDepositSeconds > 0`.
 *
 *      ── Ordering ─────────────────────────────────────────────────────────
 *      Run AFTER `UpgradeSlotImplementation`. The core floor is the backstop
 *      that makes a slot safe even while it points at an old policy, so it
 *      should be in place first.
 */
contract RedeployTenurePolicyFactory is BaseScript {
    /// @dev The starter set the SDK vouches for on mainnet: 1h, 1d, 7d.
    function _tenures() internal pure returns (uint256[3] memory) {
        return [uint256(1 hours), 1 days, 7 days];
    }

    /// @notice Base Sepolia. `forge script ... RedeployTenurePolicyFactory`
    function run() external broadcastOn(DeployementChain.BaseSepolia) {
        _redeploy();
    }

    /// @notice Base mainnet. `forge script ... --sig "runBase()"`
    function runBase() external broadcastOn(DeployementChain.Base) {
        _redeploy();
    }

    function _redeploy() internal {
        address old = _readDeployment("MinimumTenurePolicyFactory");
        console2.log("old factory   ", old);

        MinimumTenurePolicyFactory tenureF = new MinimumTenurePolicyFactory();
        console2.log("new factory   ", address(tenureF));

        // The whole premise of this script. If the address did not move, the
        // policy's creation code did not change, and nothing here is needed.
        require(
            address(tenureF) != old,
            "bytecode unchanged: nothing to redeploy"
        );

        uint256[3] memory tenures = _tenures();
        for (uint256 i = 0; i < tenures.length; i++) {
            address p = tenureF.getOrDeploy(tenures[i]);
            require(tenureF.verify(p), "tenure policy must verify");
            require(
                MinimumTenurePolicy(p).tenureSeconds() == tenures[i],
                "tenure policy carries the wrong duration"
            );
            console2.log("  tenure      ", tenures[i], p);
        }

        _saveDeployment(address(tenureF), "MinimumTenurePolicyFactory");

        console2.log("");
        console2.log("NEXT: update both registries, and keep the OLD factory listed");
        console2.log("  packages/contracts/src/addresses.ts");
        console2.log("    MINIMUM_TENURE_POLICY_FACTORY -> the new address above");
        console2.log("    POLICY_FACTORIES              -> ADD the new one, KEEP the old");
        console2.log("  packages/sdk/src/policies/vouched.ts");
        console2.log("    mark the three existing tenure entries superseded: true");
        console2.log("    add the three new addresses above so the picker has current ones");
    }
}
