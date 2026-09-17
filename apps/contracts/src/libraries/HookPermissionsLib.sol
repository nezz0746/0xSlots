// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HookPermissions} from "../interfaces/ISlotHook.sol";

/// @notice `HookPermissions` as the bits of `HookOffer.permissions`.
/// @dev Bits follow `HookPermissions` field order and are permanent. Packed rather
///      than a struct of bools so a new callback is a new bit in the same word,
///      and `HookOffer` keeps its shape.
library HookPermissionsLib {
    uint8 internal constant BEFORE_BUY = 1 << 0;
    uint8 internal constant BEFORE_SELF_ASSESS = 1 << 1;
    uint8 internal constant AFTER_BUY = 1 << 2;
    uint8 internal constant AFTER_RELEASE = 1 << 3;
    uint8 internal constant AFTER_LIQUIDATE = 1 << 4;
    uint8 internal constant AFTER_SETTLE = 1 << 5;
    /// Not a callback: a mode. See {HookPermissions-strict}.
    uint8 internal constant STRICT = 1 << 6;

    uint8 internal constant ALL = (1 << 7) - 1;

    function pack(HookPermissions memory f) internal pure returns (uint8 b) {
        if (f.beforeBuy) b |= BEFORE_BUY;
        if (f.beforeSelfAssess) b |= BEFORE_SELF_ASSESS;
        if (f.afterBuy) b |= AFTER_BUY;
        if (f.afterRelease) b |= AFTER_RELEASE;
        if (f.afterLiquidate) b |= AFTER_LIQUIDATE;
        if (f.afterSettle) b |= AFTER_SETTLE;
        if (f.strict) b |= STRICT;
    }

    function unpack(uint8 b) internal pure returns (HookPermissions memory f) {
        f.beforeBuy = b & BEFORE_BUY != 0;
        f.beforeSelfAssess = b & BEFORE_SELF_ASSESS != 0;
        f.afterBuy = b & AFTER_BUY != 0;
        f.afterRelease = b & AFTER_RELEASE != 0;
        f.afterLiquidate = b & AFTER_LIQUIDATE != 0;
        f.afterSettle = b & AFTER_SETTLE != 0;
        f.strict = b & STRICT != 0;
    }
}
