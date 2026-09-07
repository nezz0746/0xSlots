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
 *      `signature` is an ABI type list — `"uint256 window"` — describing this
 *      family's share of the slot's `hookData`. `data` is
 *      `abi.encode(HookBounds[])`, annotating it field by field, in order.
 *
 *      The signature is its own field rather than a first member inside `data`
 *      so that a client reads it straight off the call. It is the thing a form
 *      needs first and the thing most likely to be read alone; burying it
 *      behind a decode made every consumer unpack a struct to reach a string.
 *      EAS keeps its schema string in the open for the same reason.
 *
 *      A SIGNATURE and not a bespoke struct, because that is the format the
 *      ecosystem already reads: viem's `parseAbiParameters` takes it as-is,
 *      and it is the same choice EAS made — its schema registry stores
 *      `"uint256 eventId, uint8 voteIndex"` and leaves validation to a
 *      separate resolver contract, which is exactly what `validateHookData`
 *      is here.
 *
 *      Widths come from the types, so a hook that ever packs two values into
 *      the word says so by writing `"uint64 window, uint32 premiumBps"`. Note
 *      that a packed word is not what `decodeAbiParameters` reads — standard
 *      encoding pads every value to 32 bytes, so anything with more than one
 *      field is `encodePacked` and a client slices it by the widths the
 *      signature gives.
 *
 *      Empty `data` means the family takes no per-slot configuration, which is
 *      different from taking one it declines to describe: a client that finds
 *      no signature renders no form, and one that finds a signature can render
 *      a form for a hook nobody wrote a UI for.
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
    string signature;
    bytes data;
    string metadataURI;
}

/**
 * @notice What a value MEANS, once a client has decoded it.
 *
 * @dev The signature says `uint256`; this says the number is seconds, that it
 *      has to be between one and a year, and what to call it on a form. None
 *      of that is expressible as a type, and all of it is needed to render a
 *      control somebody can use.
 *
 *      `bounded` because a range is only meaningful for a number — an address
 *      has no minimum. Rather than encode zeroes a client must know to ignore,
 *      the field says whether the pair means anything.
 *
 *      The bounds are the CONTRACT'S OWN constants, encoded from the same
 *      source the check reads. That is why they are here rather than at
 *      `metadataURI`: a schema published off-chain drifts to saying thirty
 *      days while the code still refuses anything over a year, and the form is
 *      right up until the transaction reverts.
 */
struct HookBounds {
    string name;
    string unit;
    bool bounded;
    uint256 min;
    uint256 max;
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
