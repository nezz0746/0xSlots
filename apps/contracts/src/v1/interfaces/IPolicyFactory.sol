// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPolicyFactory
/// @notice One question every policy factory can answer: did I make this?
///
/// @dev ── Why this exists ──────────────────────────────────────────────────
///      `IOccupancyPolicy` already standardises what a policy DOES. Nothing
///      standardises how you check that a given address is a genuine one.
///
///      Today a client has to know each factory's salt scheme to verify a
///      policy — `predict(uint256)` for tenure, `predict(address,uint256)` for
///      price — so every new policy kind adds a branch to the security-critical
///      path in every consumer. That does not scale, and the branch that
///      matters most is the one nobody notices is missing.
///
///      Moving the check behind `verify` makes resolution uniform:
///
///          for (f of factoriesForChain(chainId))
///              if (await f.verify(policy)) return format(await f.policyKind())
///
///      A factory knows its own salt scheme; the client never does. Adding a
///      kind becomes "deploy a factory, list its address" with no change to
///      the verification logic anywhere.
///
///      ── What stays off-chain ─────────────────────────────────────────────
///      Turning params into a sentence — "7d minimum tenure" — deliberately
///      does NOT live here. It is presentation: safe to get wrong, wants to be
///      translatable, and would bake English into an immutable contract. The
///      split is uniform verification on-chain, per-kind formatting off-chain.
interface IPolicyFactory {
    /// @notice Stable identifier for the kind of policy this factory makes.
    /// @dev Matches `IOccupancyPolicy.name()` on everything it verifies, so a
    ///      client can key a formatter off either and get the same answer.
    ///      Returned as a string rather than a hash so it is legible in a block
    ///      explorer without a lookup table.
    function policyKind() external pure returns (string memory);

    /// @notice Whether `policy` is a genuine deployment from THIS factory.
    /// @dev MUST return false rather than revert for any address that is not —
    ///      an EOA, an unrelated contract, or one that merely mimics the
    ///      getters. Callers loop over factories and a revert would abort the
    ///      loop on the first miss.
    ///
    ///      Implementations recompute the CREATE2 address from the policy's own
    ///      immutable terms and compare. That is what makes it unforgeable:
    ///      CREATE2 binds an address to the deployer, the init code AND the
    ///      salt, so only the real policy for those exact terms can sit there.
    ///      Reading the terms from an untrusted address is safe precisely
    ///      because the comparison, not the read, is what is trusted.
    function verify(address policy) external view returns (bool);
}
