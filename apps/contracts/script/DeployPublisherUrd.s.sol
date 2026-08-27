// SPDX-License-Identifier: MIT
// The URD pins `=0.8.19` exactly, so this unit must intersect with it.
pragma solidity ^0.8.19;

import {BaseScript, console2} from "./Base.s.sol";
import {UrdFactory} from "urd/UrdFactory.sol";
// The concrete type, not `IUniversalRewardsDistributor`: at tag v1.0.0 —
// the audited release — `createUrd` returns the contract. (On `main` it
// returns the interface. Another reason to build against the tag.)
import {UniversalRewardsDistributor} from "urd/UniversalRewardsDistributor.sol";

/**
 * @title DeployPublisherUrd
 * @notice Ships Morpho's UrdFactory to a chain, then creates the one URD that
 *         pays adland's publishers.
 *
 * Usage:
 *   forge script script/DeployPublisherUrd.s.sol:DeployPublisherUrd \
 *     --sig "base()" --broadcast
 *
 * ── WHY MORPHO'S CONTRACT AND NOT ONE OF OURS ────────────────────────────────
 *
 * We wrote one (`src/periphery/PublisherDistributor.sol`) and it is not the one
 * to deploy. Morpho's `UniversalRewardsDistributor` has the same cumulative
 * leaf — byte for byte, `keccak256(bytes.concat(keccak256(abi.encode(account,
 * reward, claimable))))` — the same assignment-not-increment accounting, and
 * three audits: Cantina on the URD itself, OpenZeppelin on Morpho Blue
 * periphery, and a public Cantina competition. Ours has 23 tests and no audit.
 *
 * Ours stays in the tree as the written spec of the ONE thing Morpho's does not
 * do: refuse a root that promises more than the contract holds. That check
 * moves into the off-chain epoch job, and its tests are what the job has to
 * reproduce.
 *
 * The dependency is pinned to tag v1.0.0 — the audited release, not `main`.
 *
 * ── LICENSING ────────────────────────────────────────────────────────────────
 *
 * The URD is GPL-2.0-or-later and every contract under `src/` here is MIT. That
 * is why it is a submodule under `lib/` rather than vendored into `src/`: `lib/`
 * is third-party territory, each dependency under its own licence, and nothing
 * of ours derives from it. This script imports it; it does not extend it.
 *
 * ── WHY THE TIMELOCK IS SET AT CREATION ──────────────────────────────────────
 *
 * `createUrd` takes the timelock as a constructor argument, so the URD is never
 * briefly live with a zero timelock. That window matters: with `timelock == 0`
 * the URD's own guard
 *
 *     require(timelock == 0 || msg.sender == owner, UNAUTHORIZED_ROOT_CHANGE)
 *
 * lets ANY updater call `setRoot` and have it take effect immediately. Setting
 * it afterwards would mean the protection depends on a second transaction
 * landing, which is exactly the kind of assumption that turns into an incident.
 *
 * No updater is granted here, deliberately. The owner adds the API's key from
 * the admin panel once it exists, so the hot key is never in a deploy script.
 */
contract DeployPublisherUrd is BaseScript {
    /// nezzar.eth, resolved on mainnet. Owner of the URD.
    address internal constant OWNER =
        0x26bBec292e5080ecFD36F38FF1619FF35826b113;

    /// How long a root submitted by an updater waits before it can be accepted.
    /// Long enough to notice a bad tree and revoke it; short enough that a
    /// publisher is not waiting a week to be paid.
    uint256 internal constant TIMELOCK = 1 days;

    /// Deterministic, so the URD's address can be computed before it exists —
    /// which is what lets the collective's split be pointed at it and frozen in
    /// the same sitting.
    bytes32 internal constant URD_SALT = keccak256("adland.publishers.v1");

    function base() external {
        _deploy(DeployementChain.Base);
    }

    function baseSepolia() external {
        _deploy(DeployementChain.BaseSepolia);
    }

    function _deploy(DeployementChain chain) internal broadcastOn(chain) {
        console2.log("=== adland publisher URD deploy ===");
        console2.log("chainid:", block.chainid);
        console2.log("deployer:", vm.addr(deployerPrivateKey));
        console2.log("owner (nezzar.eth):", OWNER);
        console2.log("timelock (seconds):", TIMELOCK);

        UrdFactory factory = new UrdFactory();
        console2.log("UrdFactory:", address(factory));

        UniversalRewardsDistributor urd = factory.createUrd({
            initialOwner: OWNER,
            initialTimelock: TIMELOCK,
            // No root and no IPFS hash yet. The first epoch sets both, and
            // `claim` reverts on a zero root until then, so an empty URD is
            // inert rather than dangerous.
            initialRoot: bytes32(0),
            initialIpfsHash: bytes32(0),
            salt: URD_SALT
        });
        console2.log("URD:", address(urd));

        // Read back rather than trust the call. A URD owned by the deployer —
        // because an argument was mis-ordered — is a contract someone else can
        // rewrite the payouts of, and it would look exactly like success here.
        require(urd.owner() == OWNER, "URD owner is not nezzar.eth");
        require(urd.timelock() == TIMELOCK, "URD timelock not set");
        require(factory.isUrd(address(urd)), "factory did not index the URD");

        console2.log("");
        console2.log("Record these in deployments/%s/", vm.toString(block.chainid));
        console2.log("  UrdFactory       ", address(factory));
        console2.log("  PublisherUrd     ", address(urd));
    }
}
