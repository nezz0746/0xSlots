// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IModuleLifecycle
 * @notice Optional. A module that wants to know when it is attached to, or
 *         detached from, a slot.
 *
 * @dev Deliberately SEPARATE from `IUtility` rather than added to it. An
 *      ERC-165 id is the XOR of an interface's own selectors, so extending
 *      `IUtility` would change `type(IUtility).interfaceId` and every module
 *      already deployed would fail `SlotFactory.setUtilityVerified` — and the
 *      hardcoded id in the explorer's `use-module-check.ts` would rot for the
 *      second time. Optional interfaces cost nothing and break nobody.
 *
 *      ── Why these are fail-open, unlike ERC-7579's ──────────────────────────
 *
 *      In modular smart accounts, `installModule` is a standalone user action,
 *      so a reverting `onInstall` can safely abort it. Here the install lands
 *      inside `_applyPendingUpdates`, which runs during `buy`, `sell`,
 *      `release` and `liquidate`. A module that reverted on install would
 *      therefore block occupancy transitions — including liquidation, which
 *      this protocol treats as unconditional.
 *
 *      So both calls are gas-capped and their failure is swallowed, exactly
 *      like the event hooks. A module cannot refuse to be installed, and — more
 *      importantly — cannot refuse to be removed. Removal is the lever for
 *      detaching something broken; letting the broken thing veto it would be
 *      the whole point missed.
 */
interface IModuleLifecycle {
    /// @notice Called once, when this module becomes active on `msg.sender`.
    /// @param slotId Reserved. Currently zero; the calling slot is `msg.sender`.
    /// @param data Reserved for a future `addModule(address,bytes)`. Empty today.
    function onInstall(uint256 slotId, bytes calldata data) external;

    /// @notice Called once, when this module is detached from `msg.sender`.
    /// @dev The slot has already dropped its own record by the time this runs,
    ///      so a module cannot rely on reading its registration back. Treat it
    ///      as "you are out" and tidy up.
    function onUninstall(uint256 slotId, bytes calldata data) external;
}

/**
 * @title IModuleTopics
 * @notice Optional. Which events a module actually wants.
 *
 * @dev Without this, every module is woken for every hook — so a metadata
 *      module that only cares about occupancy is called on every tax
 *      settlement, and the cost of a `buy` scales with modules that had no
 *      interest in it. With eight modules installed that is eight external
 *      calls where one was wanted.
 *
 *      Read ONCE at install and snapshotted, not consulted per call: a module
 *      that could change its own subscription mid-tenure would be able to
 *      quietly start charging the occupant gas it never agreed to.
 *
 *      A module that does not implement this is subscribed to everything,
 *      which is the behaviour every existing module already has.
 */
interface IModuleTopics {
    function topics() external view returns (uint32);
}
