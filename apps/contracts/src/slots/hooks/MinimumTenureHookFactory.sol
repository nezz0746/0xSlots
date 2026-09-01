// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {MinimumTenureHook} from "./MinimumTenureHook.sol";

/**
 * @title MinimumTenureHookFactory
 * @notice Deploys one `MinimumTenureHook` per configuration, at an address
 *         determined solely by that configuration.
 *
 * @dev `MinimumTenureHook` stores its window in an immutable constructor arg
 *      rather than in storage, so the hook is a stateless singleton whose
 *      configuration IS its address. That is what makes it safe: there is no
 *      setter, so nobody — not the slot's manager, not this factory — can
 *      lengthen protection while an occupant is sitting behind it.
 *
 *      The cost of that design is one deployment per configuration. This
 *      factory pays it once, protocol-wide: CREATE2 with the configuration as
 *      the salt means a given configuration always lands at the same address,
 *      so the second slot to want 7 days reuses the first slot's hook rather
 *      than deploying its own.
 *
 *      `predict` is a pure address computation, so a client can resolve the
 *      hook for any configuration without a transaction and skip `getOrDeploy`
 *      entirely when that address already has code.
 *
 *      ── What "configuration" means, and why there are two entry points ─────
 *
 *      The policy this replaces took only the duration, so the duration alone
 *      keyed the address. `MinimumTenureHook` takes `(tenureSeconds,
 *      metadataURI)`, and both are constructor args — so both are in the
 *      initcode, and both move the address. `predict(tenureSeconds)` is not
 *      well-defined on its own any more.
 *
 *      Resolved by keying the salt on the whole constructor argument tuple:
 *
 *          salt = keccak256(abi.encode(tenureSeconds, metadataURI))
 *
 *      A custom `metadataURI` is a genuinely different deployment — different
 *      initcode, different code on chain — and it correctly lands at a
 *      different address. Salting on the duration alone would have been a
 *      trap: two callers asking for 7 days with different URIs would compute
 *      the same salt, the second `getOrDeploy` would see code at the predicted
 *      address and hand back the FIRST caller's hook, and the caller would
 *      believe their URI shipped. Better to give them their own address than a
 *      silent substitution.
 *
 *      The one-argument overloads exist so the common case still collapses to
 *      ONE address per duration: they fill in the empty URI, so every slot that
 *      just wants "7 days" converges on the same hook.
 *
 *      ── Why the default is a constant and not a constructor argument ─────
 *
 *      The rule that a URI should not be hardcoded applies to a URI. It does
 *      not apply to the empty string, which is not a placeholder that ships
 *      unedited and resolves to nothing — it is the honest statement that
 *      nothing has been published, which `IDescribedHook` already defines as
 *      legal and leaves the family id as the lookup key.
 *
 *      Making it configurable would buy nothing and cost the property this
 *      overload exists for. `predict(7 days)` would mean "at this factory,
 *      given the default it happened to be deployed with" rather than simply
 *      "7 days" — the canonical path made relative to a deployment choice, for
 *      a value that is inert. Description is not configuration; the two-argument
 *      overload is where a caller says otherwise, and it correctly lands
 *      somewhere else when they do.
 */
contract MinimumTenureHookFactory {
    /// @notice The family `MinimumTenureHook` reports from `descriptors()`.
    /// @dev Mirrored here so a client can filter hooks without first having an
    ///      address to read it off. See `verify` for what it is and is not
    ///      worth as a check.
    bytes32 public constant FAMILY = keccak256("slots.hook.minimum-tenure");

    /// @notice The `metadataURI` the one-argument overloads deploy with.
    /// @dev Immutable in effect — there is no setter — but a `string` cannot
    ///      carry the `immutable` keyword, so it is a plain storage variable
    ///      written once in the constructor.
    /// @notice The URI the one-argument overloads assume. Deliberately empty
    ///         and deliberately constant — see the note above.
    string public constant DEFAULT_METADATA_URI = "";

    event TenureHookDeployed(
        address indexed hook,
        uint256 indexed tenureSeconds,
        string metadataURI
    );

    error InvalidTenure();

    // ─── Deploy ─────────────────────────────────────────────────────────────

    /// @notice Deploy the hook for `tenureSeconds` with `metadataURI`, or
    ///         return the existing one.
    /// @dev Idempotent and permissionless — calling it for an already-deployed
    ///      configuration is a no-op that still returns the right address, and
    ///      emits nothing, because nothing was deployed.
    function getOrDeploy(
        uint256 tenureSeconds,
        string calldata metadataURI
    ) external returns (address hook) {
        return _getOrDeploy(tenureSeconds, metadataURI);
    }

    /// @notice Deploy the hook for `tenureSeconds` with this factory's
    ///         `DEFAULT_METADATA_URI`, or return the existing one.
    /// @dev The path a UI should take when the creator picked a duration and
    ///      nothing else. One address per duration, protocol-wide.
    function getOrDeploy(uint256 tenureSeconds) external returns (address hook) {
        return _getOrDeploy(tenureSeconds, DEFAULT_METADATA_URI);
    }

    // ─── Resolve without a transaction ──────────────────────────────────────

    /// @notice The address the hook for this configuration has, or would have.
    function predict(
        uint256 tenureSeconds,
        string calldata metadataURI
    ) external view returns (address) {
        return _predict(tenureSeconds, metadataURI);
    }

    /// @notice The address the hook for `tenureSeconds` has, or would have,
    ///         under this factory's default metadata.
    function predict(uint256 tenureSeconds) external view returns (address) {
        return _predict(tenureSeconds, DEFAULT_METADATA_URI);
    }

    /// @notice Whether the hook for this configuration is already deployed.
    /// @dev Lets a client decide between one transaction and none.
    function isDeployed(
        uint256 tenureSeconds,
        string calldata metadataURI
    ) external view returns (bool) {
        return _predict(tenureSeconds, metadataURI).code.length != 0;
    }

    /// @notice Whether the hook for `tenureSeconds` under the default metadata
    ///         is already deployed.
    function isDeployed(uint256 tenureSeconds) external view returns (bool) {
        return _predict(tenureSeconds, DEFAULT_METADATA_URI).code.length != 0;
    }

    // ─── Provenance ─────────────────────────────────────────────────────────

    /**
     * @notice Whether `hook` really is one of this factory's hooks.
     *
     * @dev ── What is authoritative, and what is decoration ─────────────────
     *
     *      Address derivation is the proof. Everything a hook says about
     *      itself — `FAMILY()`, `descriptors()`, `tenureSeconds()` — is
     *      self-reported by an untrusted contract, and an impostor that
     *      returns the right family and the right duration costs nothing to
     *      write. What an impostor cannot do is arrange to SIT at the address
     *      CREATE2 assigns to the configuration it claims: that address is
     *      fixed by this factory, this salt, and this exact initcode, so
     *      landing on it is only possible by having actually been deployed
     *      here. So the answer is decided by
     *
     *          _predict(tenureSeconds(), metadataURI()) == hook
     *
     *      and by nothing else. The family check below is a cheap early-out,
     *      not evidence: once derivation passes, the family is guaranteed by
     *      construction — the code at that address is `MinimumTenureHook`'s,
     *      whose `FAMILY` is a compile-time constant. It can only ever make
     *      this function reject sooner, never accept something derivation
     *      would have refused.
     *
     *      `FAMILY()` is read rather than `descriptors()` deliberately: it
     *      returns a bounded 32 bytes, where `descriptors()` returns an
     *      unbounded array from a contract we have no reason to trust.
     *
     *      Returns false rather than reverting, in every failure mode,
     *      including on an address with no code — callers loop over
     *      candidates, and one hostile entry must not abort the loop.
     */
    function verify(address hook) external view returns (bool) {
        // `try` does NOT catch this: for a call to an address with no code the
        // compiler's extcodesize check reverts before the call is even made,
        // and that revert lands outside the try/catch.
        if (hook.code.length == 0) return false;

        try MinimumTenureHook(hook).FAMILY() returns (bytes32 family) {
            if (family != FAMILY) return false;
        } catch {
            return false;
        }

        uint256 tenureSeconds;
        try MinimumTenureHook(hook).tenureSeconds() returns (uint256 s) {
            if (s == 0) return false;
            tenureSeconds = s;
        } catch {
            return false;
        }

        try MinimumTenureHook(hook).metadataURI() returns (string memory uri) {
            return _predict(tenureSeconds, uri) == hook;
        } catch {
            return false;
        }
    }

    // ─── Internals ──────────────────────────────────────────────────────────

    function _getOrDeploy(
        uint256 tenureSeconds,
        string memory metadataURI
    ) internal returns (address hook) {
        // A zero window is not a shorter protection, it is no hook at all — and
        // it would sit at an address clients would then hand out as "minimum
        // tenure". Refuse rather than deploy a decorative no-op.
        if (tenureSeconds == 0) revert InvalidTenure();

        hook = _predict(tenureSeconds, metadataURI);
        if (hook.code.length != 0) return hook;

        hook = address(
            new MinimumTenureHook{salt: _salt(tenureSeconds, metadataURI)}(
                tenureSeconds,
                metadataURI
            )
        );
        emit TenureHookDeployed(hook, tenureSeconds, metadataURI);
    }

    function _predict(
        uint256 tenureSeconds,
        string memory metadataURI
    ) internal view returns (address) {
        return
            Create2.computeAddress(
                _salt(tenureSeconds, metadataURI),
                keccak256(
                    abi.encodePacked(
                        type(MinimumTenureHook).creationCode,
                        abi.encode(tenureSeconds, metadataURI)
                    )
                )
            );
    }

    /// @dev `abi.encode`, not `abi.encodePacked`: packed encoding of a dynamic
    ///      string next to a number is ambiguous, and two different
    ///      configurations that collided here would collide on the address.
    function _salt(
        uint256 tenureSeconds,
        string memory metadataURI
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(tenureSeconds, metadataURI));
    }
}
