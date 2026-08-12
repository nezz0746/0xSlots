// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LocalBootstrap
 * @notice CREATE2 seed implementation. Local dev only — never deploy to a real network.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The goal is a local SlotFactory / MetadataModule whose addresses survive
 * edits to the contracts, so `ponder.config.ts` and the landing config don't
 * need re-editing on every recompile.
 *
 * CREATE2 alone does NOT give that. Its address is
 * `keccak(0xff, deployer, salt, keccak(initcode))` — the initcode is an input,
 * so changing one line of Slot.sol moves the address. (Plain nonce-based CREATE
 * is the opposite: code-independent, but shifts if you reorder deployments.)
 *
 * What pins an address through both is CREATE2-ing the *proxy* against an
 * implementation whose bytecode never changes, then upgrading. The proxy's
 * initcode is then a function of the OZ ERC1967Proxy creation code and this
 * contract's address only — neither of which moves when the real contracts do.
 *
 * ── Why it is hand-rolled ────────────────────────────────────────────────────
 *
 * Both proxies are UUPS, so the upgrade entrypoint has to live in the
 * implementation — a non-upgradeable placeholder would be a one-way door. This
 * is the smallest thing that can be upgraded away from: it writes the ERC-1967
 * slot and delegatecalls the initializer, skipping OZ's `onlyProxy` and
 * `proxiableUUID` rollback checks, which is safe precisely because the only
 * call it ever receives is the one that replaces it.
 *
 * ── Do not edit ──────────────────────────────────────────────────────────────
 *
 * Changing this file changes its bytecode, which moves every pinned local
 * address. DeployLocal asserts the pinned values, so drift fails the deploy
 * loudly rather than silently breaking the indexer config. Compiler version and
 * optimizer settings are inputs too — see foundry.toml.
 */
contract LocalBootstrap {
    /// @dev ERC-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function upgradeToAndCall(
        address newImplementation,
        bytes calldata data
    ) external payable {
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
        if (data.length > 0) {
            (bool ok, bytes memory ret) = newImplementation.delegatecall(data);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }

    function proxiableUUID() external pure returns (bytes32) {
        return IMPLEMENTATION_SLOT;
    }

    /**
     * @dev Does nothing, deliberately.
     *
     * OZ v5.6's ERC1967Proxy constructor rejects empty init data with
     * `ERC1967ProxyUninitialized()`, so the seed deploy has to delegatecall
     * *something*. This is that something: no state, no effects, and a constant
     * calldata encoding, which keeps the proxy initcode — and therefore the
     * pinned address — stable.
     */
    function bootstrapNoop() external {}
}
