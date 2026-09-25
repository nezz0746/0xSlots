// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Optional discovery, deliberately separate from `ISlotModule`.
 *
 * @dev A module answers with one JSON document describing itself: what it is, and
 *      what it can be configured with. The configuration half is a JSON Schema,
 *      which an application hands to `react-jsonschema-form`, JSONForms or AJV
 *      untouched — so a form for a module nobody wrote a UI for comes from reading
 *      the chain and nothing else. {ModuleSchemaLib} builds it, and documents the
 *      format.
 *
 *      JSON rather than a struct because this is the one surface that has to
 *      grow without an interface change. A field added next year is a field old
 *      clients ignore, and no `definitionV2()` is ever shipped.
 *
 *      `pure`, and about the MODULE rather than about a slot. That is what lets a
 *      client cache it by address for ever. What a particular slot is configured
 *      with is that slot's own storage: `Slot.moduleTerms().settings`.
 *
 *      ── The rule that keeps this safe ───────────────────────────────────
 *
 *      `Slot` MUST NEVER call `uiMetadata()`. Not in `ModuleLib`, not anywhere.
 *      This is self-reported by an untrusted contract and returns an unbounded
 *      string; the moment the protocol reads it, a label becomes an attack
 *      surface inside the path that has to keep working for liquidation to stay
 *      unconditional. It is an `eth_call` for clients only, which is also why it
 *      costs nothing in gas and is never snapshotted.
 *
 *      It follows that a module may lie. That is acceptable precisely because
 *      nothing safety-relevant hangs off it: authority comes from
 *      the scopes the slot copies and enforces, and from
 *      `validateSettings`, which the slot calls. The honest thing for a UI to
 *      say is "this module says it takes a 7-day window".
 *
 *      Implementing this is optional. A client staticcalls `uiMetadata()` and
 *      treats a revert, or JSON it cannot parse, as simply "undescribed" —
 *      falling back to the scopes, which still say whether the module may
 *      refuse a buy. Degraded, but honest.
 */
interface IModuleMetadata {
    function uiMetadata() external pure returns (string memory);
}
