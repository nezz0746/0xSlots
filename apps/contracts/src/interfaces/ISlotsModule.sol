// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IModuleMetadata} from "./IModuleMetadata.sol";

/// @title ISlotsModule — deprecated name for `IUtility`
/// @notice Kept so utilities that `import {ISlotsModule}` keep compiling. New
///         code should implement `IUtility`; the two are ABI-identical, so a
///         contract written against either satisfies the other on chain.
///
/// @dev Declared in full rather than as `interface ISlotsModule is IUtility {}`.
///      An ERC165 interfaceId is the XOR of an interface's OWN function
///      selectors and ignores inherited ones, so the empty-inheriting version
///      computed `0x00000000`. A utility recompiled against it would answer
///      `supportsInterface` with a bogus id and fail `setUtilityVerified`,
///      even though every one of its functions was correct. Duplicating the
///      declarations keeps `type(ISlotsModule).interfaceId` equal to
///      `type(IUtility).interfaceId` — and equal to what utilities already
///      deployed on Base computed at their own compile time.
///
///      Delete in the next major version.
interface ISlotsModule is IModuleMetadata {
  function onTransfer(uint256 slotId, address from, address to) external;

  function onPriceUpdate(
    uint256 slotId,
    uint256 oldPrice,
    uint256 newPrice
  ) external;

  function onRelease(uint256 slotId, address from) external;

  function onSettle(
    uint256 slotId,
    address occupant,
    uint256 owed,
    uint256 paid
  ) external;

  function feeBps() external view returns (uint256);

  function feeRecipient() external view returns (address);
}
