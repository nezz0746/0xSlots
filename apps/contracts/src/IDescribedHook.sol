// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice What a hook claims to be, for clients that want to render it.
 *
 * @dev `family` identifies the behaviour; `version` describes the encoding of
 *      `data` and nothing else, so a client that knows family X version 1 and
 *      meets version 2 ignores it rather than decoding v2's bytes with v1's
 *      layout and rendering a confident wrong number.
 *
 *      `metadataURI` is where the human half lives — label, units, copy, an
 *      icon. It is deliberately not on-chain: a UI needs "7-day minimum
 *      tenure", not `tenureSeconds: 604800`, and none of that is expressible
 *      as a type. Empty is legal and means nothing has been published; the
 *      family id remains the lookup key.
 */
struct HookDescriptor {
    bytes32 family;
    uint32 version;
    bytes data;
    string metadataURI;
}

/**
 * @notice Optional discovery, deliberately separate from `ISlotHook`.
 *
 * @dev ── The rule that keeps this safe ───────────────────────────────────
 *
 *      `Slot` MUST NEVER call `descriptors()`. Not in `_readHookFlags`, not
 *      anywhere. This is self-reported by an untrusted contract and returns an
 *      unbounded array; the moment the protocol reads it, a label becomes an
 *      attack surface inside the path that has to keep working for liquidation
 *      to stay unconditional. It is an `eth_call` for clients only, which is
 *      also why it costs nothing in gas and is never snapshotted.
 *
 *      It follows that a hook may lie. That is acceptable precisely because
 *      nothing safety-relevant hangs off it: authority comes from `HookFlags`,
 *      which the slot snapshots and enforces. The honest thing for a UI to say
 *      is "this hook says it is a 7-day minimum tenure", with whatever list
 *      that interface keeps as the upgrade to "and we vouch for that".
 *
 *      Implementing this is optional. A client staticcalls `descriptors()` and
 *      treats a revert, an unknown family, an unknown version, or `data` that
 *      fails to decode as simply "unknown" — falling back to the flags, which
 *      still say whether the hook may refuse a buy. Degraded, but honest.
 */
interface IDescribedHook {
    function descriptors() external view returns (HookDescriptor[] memory);
}
