// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IModuleMetadata} from "./IModuleMetadata.sol";

/// @title IUtility — what holding a slot grants
/// @notice The utility is one of a slot's two pluggable contracts, and the two
///         are deliberately asymmetric. The occupancy policy (`IOccupancyPolicy`)
///         answers WHO may hold a slot and can veto — it fails closed. The
///         utility answers WHAT holding it grants — a feed post, metadata,
///         access, revenue share — and must never be able to hold the market
///         hostage, so every hook here is gas-capped and failures are
///         swallowed. A broken utility degrades to a slot that grants nothing;
///         it cannot block a buy, a release, or a liquidation.
///
/// @dev Formerly `ISlotsModule`. The interface NAME is source-level and free to
///      change; the function SIGNATURES below are wire-frozen — deployed
///      utilities (FeedPostModule, MetadataModule on Base) implement them, and
///      deployed slots call them by selector.
///
///      Self-description (`name`, `version`, `metadataURI`) moved to
///      `IModuleMetadata`, shared with `IOccupancyPolicy`. That inheritance
///      NARROWS this interface's ERC165 id, and the narrowing is the point: an
///      id is the XOR of an interface's OWN selectors and ignores inherited
///      ones, so `type(IUtility).interfaceId` now means exactly "implements
///      the utility hooks" and `type(IModuleMetadata).interfaceId` means
///      "describes itself". `SlotFactory.setUtilityVerified` asserts BOTH —
///      checking only the first would accept a contract with no name.
///
///      This changed the id, so utilities compiled against the previous
///      interface no longer verify. They are UUPS proxies and were upgraded in
///      place; see IModuleMetadata for why that break was taken deliberately.
interface IUtility is IModuleMetadata {
  function onTransfer(uint256 slotId, address from, address to) external;

  function onPriceUpdate(
    uint256 slotId,
    uint256 oldPrice,
    uint256 newPrice
  ) external;

  function onRelease(uint256 slotId, address from) external;

  /// @notice Tax was taken from `occupant`'s deposit.
  /// @dev The economic counterpart to the three occupancy hooks above, which
  ///      only report WHO holds the slot and at what price — never that money
  ///      moved. Utilities doing revenue share, rebates, loyalty or contribution
  ///      accounting need this one.
  ///
  ///      `paid` is capped by the remaining deposit and is the only sound basis
  ///      for accounting. `owed - paid` is non-zero exactly when the occupant
  ///      has run dry, which is a useful distress signal.
  ///
  ///      Do NOT rely on this hook for anything whose correctness matters:
  ///      utility calls are gas-capped and failures are swallowed (see
  ///      `Slot._notifyUtility`). The `TaxPaid` event is the authoritative
  ///      record and always fires. This hook is for reacting, not for being the
  ///      source of truth.
  ///
  ///      CALLED MID-TRANSACTION. Unlike `onTransfer`/`onRelease`, which fire
  ///      after their entry point has settled, this fires from `_accrue` inside
  ///      `_settle()` — the first statement of every mutating function. The slot
  ///      is in its PRE-operation state: during `buy()`, `occupant()` still
  ///      returns the outgoing occupant. Reentry into the slot is blocked by
  ///      `nonReentrant`, but treat any state you read here as in-flux.
  function onSettle(
    uint256 slotId,
    address occupant,
    uint256 owed,
    uint256 paid
  ) external;

  /// @notice Utility fee in basis points (e.g. 500 = 5%), taken from collected tax
  function feeBps() external view returns (uint256);

  /// @notice Address that receives utility fees (EOA, multisig, Splits, etc.)
  function feeRecipient() external view returns (address);
}
