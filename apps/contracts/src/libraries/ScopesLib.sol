// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Scopes} from "../interfaces/ISlotModule.sol";

/// @notice `Scopes` as the bits a module declares and a slot stores.
///
/// @dev Bits follow `Scopes` field order and are permanent. Packed rather than
///      a struct of bools so a new callback is a new bit in the same word.
///
///      A `uint16` with seven bits spare: {ALL} is the mask of bits that MEAN
///      something, not the type's maximum, because a module declaring a bit this
///      version does not know is a module answering something the slot cannot
///      honour — refused rather than silently narrowed.
library ScopesLib {
    uint16 internal constant BEFORE_BUY = 1 << 0;
    uint16 internal constant BEFORE_SELF_ASSESS = 1 << 1;
    uint16 internal constant AFTER_BUY = 1 << 2;
    uint16 internal constant AFTER_RELEASE = 1 << 3;
    uint16 internal constant AFTER_LIQUIDATE = 1 << 4;
    uint16 internal constant AFTER_SETTLE = 1 << 5;
    /// Not a callback: a mode. See {Scopes-afterCallbacksMustSucceed}.
    uint16 internal constant AFTER_CALLBACKS_MUST_SUCCEED = 1 << 6;
    uint16 internal constant ON_INSTALL = 1 << 7;
    uint16 internal constant ON_UNINSTALL = 1 << 8;

    uint16 internal constant ALL = (1 << 9) - 1;

    function pack(Scopes memory f) internal pure returns (uint16 b) {
        if (f.beforeBuy) b |= BEFORE_BUY;
        if (f.beforeSelfAssess) b |= BEFORE_SELF_ASSESS;
        if (f.afterBuy) b |= AFTER_BUY;
        if (f.afterRelease) b |= AFTER_RELEASE;
        if (f.afterLiquidate) b |= AFTER_LIQUIDATE;
        if (f.afterSettle) b |= AFTER_SETTLE;
        if (f.afterCallbacksMustSucceed) b |= AFTER_CALLBACKS_MUST_SUCCEED;
        if (f.onInstall) b |= ON_INSTALL;
        if (f.onUninstall) b |= ON_UNINSTALL;
    }

    function unpack(uint16 b) internal pure returns (Scopes memory f) {
        f.beforeBuy = b & BEFORE_BUY != 0;
        f.beforeSelfAssess = b & BEFORE_SELF_ASSESS != 0;
        f.afterBuy = b & AFTER_BUY != 0;
        f.afterRelease = b & AFTER_RELEASE != 0;
        f.afterLiquidate = b & AFTER_LIQUIDATE != 0;
        f.afterSettle = b & AFTER_SETTLE != 0;
        f.afterCallbacksMustSucceed = b & AFTER_CALLBACKS_MUST_SUCCEED != 0;
        f.onInstall = b & ON_INSTALL != 0;
        f.onUninstall = b & ON_UNINSTALL != 0;
    }
}
