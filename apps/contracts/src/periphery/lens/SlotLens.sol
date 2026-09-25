// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Versioned} from "../../utils/Versioned.sol";
import {ModuleLib} from "../../libraries/ModuleLib.sol";
import {ScopesLib} from "../../libraries/ScopesLib.sol";
import {TermsLib} from "../../libraries/TermsLib.sol";
import {ModuleFee} from "../../types/SlotTypes.sol";
import {SlotInfo, SlotConstantsInfo} from "../../slot/SlotViews.sol";

/// @notice The two reads the lens needs from a slot.
interface ILensedSlot {
    function getSlotInfo() external view returns (SlotInfo memory);
    function getSlotConstants() external pure returns (SlotConstantsInfo memory);
}

/// @notice What a slot's module declares today, beside the slot's copy.
struct ModuleUpdate {
    /// The slot's copy, as `ScopesLib` bits.
    uint16 currentScopes;
    ModuleFee currentFee;
    /// Whether the module answered, under the cap the slot reads it with.
    /// False for no module, one that reverts, or an answer out of range.
    bool answered;
    uint16 declaredScopes;
    ModuleFee declaredFee;
    /// `acceptFee` would change the fee now: it differs, and a rise is allowed
    /// (`mutableRecipient`).
    bool feeDiffers;
    /// `acceptScopes` would queue new scopes: they differ, the module is
    /// mutable, no new module is queued, and they are not already queued.
    bool scopesDiffer;
}

/**
 * @title SlotLens
 * @notice Quotes about a slot that the slot itself has no room for.
 *
 * @dev Stateless, and asks the slot for everything: its state through
 *      `getSlotInfo`, its constants through `getSlotConstants`. Nothing here
 *      is an authority; each answer says what the slot would do if asked.
 *
 *      Outside the slot because the slot is at the 24,576-byte deploy limit,
 *      and a read that calls an untrusted module has no business inside it
 *      anyway.
 */
contract SlotLens is Versioned {
    /// @inheritdoc Versioned
    function version() public pure override returns (uint64) {
        return 1;
    }

    /**
     * @notice What `slot`'s module declares today, and whether accepting it
     *         would change anything.
     *
     * @dev Never reverts on a module that misbehaves: it is read fail-open,
     *      under a third of `MODULE_GAS` per read, which is what the slot
     *      allows when a module lands. A module too expensive to answer here
     *      is one the slot would not install either.
     */
    function moduleUpdate(address slot) external view returns (ModuleUpdate memory u) {
        SlotInfo memory info = ILensedSlot(slot).getSlotInfo();
        u.currentScopes = ScopesLib.pack(info.scopes);
        u.currentFee = info.fee;

        address target = info.terms.moduleTerms.target;
        if (target == address(0)) return u;

        uint256 cap = ILensedSlot(slot).getSlotConstants().moduleGas / 3;
        (u.answered, u.declaredScopes, u.declaredFee) =
            ModuleLib.tryRead(target, info.terms.moduleTerms.settings, cap);
        if (!u.answered) return u;

        u.feeDiffers = !ModuleLib.sameFee(u.declaredFee, u.currentFee)
            && (u.declaredFee.bps <= u.currentFee.bps || info.mutableRecipient);

        uint16 mask = info.pending.mask;
        bool moduleQueued = mask & TermsLib.MODULE != 0;
        bool alreadyQueued =
            mask & TermsLib.SCOPES != 0 && info.pending.module.scopes == u.declaredScopes;
        u.scopesDiffer = info.mutableModule && !moduleQueued && !alreadyQueued
            && u.declaredScopes != u.currentScopes;
    }
}
