// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Versioned
 * @notice A number every upgradeable contract in this protocol carries.
 *
 * @dev ── What it is for ─────────────────────────────────────────────────
 *
 *      An upgrade is one transaction that replaces the code behind every
 *      proxy pointing at it. There is no undo, and the failure modes are
 *      quiet: shipping the same implementation twice, shipping an OLDER one
 *      because a branch was stale, or shipping the right code to the wrong
 *      chain. None of those revert on their own.
 *
 *      So the upgrade script reads `version()` off the deployed proxy, reads
 *      it off the candidate, and refuses anything that does not strictly
 *      increase. That turns three silent mistakes into a failed script.
 *
 *      ── Why a constant and not storage ──────────────────────────────────
 *
 *      Because it must describe the CODE, not the deployment. Held in
 *      storage it would be a number somebody remembers to bump; as a
 *      constant it is part of the implementation, so `version()` read
 *      through a proxy answers "which code is behind me right now" — which
 *      is the only question worth asking during an incident.
 *
 *      ── The rule ────────────────────────────────────────────────────────
 *
 *      Bump it in the same commit as the change. CI enforces this: a PR that
 *      alters an upgradeable contract's bytecode without raising its version
 *      fails, because the alternative is discovering it at upgrade time.
 */
abstract contract Versioned {
    /// @notice The implementation's version. Strictly increasing, forever.
    ///
    /// @dev Distinct from OpenZeppelin's `Initializable._initialized`, which
    ///      this protocol also exposes where it applies. They answer different
    ///      questions and our architecture needs both:
    ///
    ///        version()            which CODE is behind me
    ///        initializedVersion() which MIGRATION has run here
    ///
    ///      For a UUPS singleton the two can be kept in step by giving every
    ///      upgrade a `reinitializer(N)`, and OZ then enforces monotonicity
    ///      for free — better than a constant somebody remembers to bump.
    ///
    ///      For `Slot` it cannot. A slot is a BEACON implementation behind
    ///      hundreds of proxies: upgrading the beacon replaces the code for
    ///      all of them in one transaction and touches no proxy's storage, so
    ///      no reinitializer runs and every `_initialized` stays where it was.
    ///      Nothing in storage can tell you which code a slot is running.
    ///      Only a constant compiled into the implementation can.
    function version() public pure virtual returns (uint64);
}
