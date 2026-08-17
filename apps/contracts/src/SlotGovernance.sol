// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {UpdateKind} from "./interfaces/ISlot.sol";

/// @notice The subset of `Slot` a collective drives. Declared locally rather
///         than imported from `Slot.sol` so the collective compiles against a
///         signature list, not against the slot's implementation — the two are
///         deployed independently and only ever meet across an ABI boundary.
///
/// @dev `UpdateKind` is the exception: it is imported from `ISlot.sol` rather
///      than redeclared here. An enum is positional, so a local copy that
///      drifted by one member would silently cancel the wrong dimension — a
///      tax manager's call landing on the policy manager's proposal. That is
///      the precise failure the roles below exist to prevent, and it is not
///      worth risking to keep the interface self-contained.
interface IManagedSlot {
    function proposeTaxUpdate(uint256 newPct) external;

    function proposeUtilityUpdate(address newUtility) external;

    function proposePolicyUpdate(address newPolicy) external;

    function cancelPendingUpdate(UpdateKind kind) external;

    function cancelPendingUpdates() external;

    function setLiquidationBounty(uint256 newBps) external;

    function collect() external;

    function claim(address account) external;
}

/// @title SlotGovernance — the half of a collective that governs slots
///
/// @notice Everything a collective does to a SLOT, with none of what it does
///         with MONEY. Three roles, one per governable dimension, and a relay
///         behind each.
///
/// @dev ── WHY THIS IS SPLIT OUT ─────────────────────────────────────────────
///      A collective is two independent things welded together:
///
///        1. a payout engine — where tax goes once it arrives, and
///        2. a control panel — who may pull which of the slot's levers.
///
///      Only (1) has any opinion about 0xSplits, or Superfluid, or anything
///      else. Half (2) is identical whatever pays out, so it lives here and
///      each engine inherits it:
///
///        SlotCollective       = SlotGovernance + 0xSplits PushSplit
///        SlotStreamCollective = SlotGovernance + Superfluid GDA pool
///
///      A third engine — a vault, a bonding curve, a plain treasury — is a new
///      contract that inherits this and writes only its own payout half.
///
///      ── WHY THE PAYOUT ROLE IS *NOT* HERE ────────────────────────────────
///      Each engine declares its own. It is tempting to define one
///      `PAYOUT_MANAGER_ROLE` up here and be done, but a role identifier is
///      `keccak256` of its NAME, and `SlotCollective` is already deployed with
///      live holders of `keccak256("SPLIT_MANAGER_ROLE")`. Renaming it would
///      silently strip every existing holder of their role while leaving the
///      contract looking perfectly healthy. The three roles below are safe to
///      share precisely because their names do not change.
///
///      ── NO STORAGE ───────────────────────────────────────────────────────
///      This contract declares no state variables, only `constant`s. That is
///      load-bearing: `SlotCollective` sits behind a live beacon, and adding a
///      storage-carrying base would shift every slot beneath it. Verified in
///      `test/SlotCollectiveLayout.t.sol` rather than asserted here.
abstract contract SlotGovernance is AccessControl, Initializable {
    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    /// @notice May change the tax rate, and the liquidation bounty with it.
    /// @dev The bounty lives here rather than under its own role because it is
    ///      the same kind of lever: what the slot costs to hold and what it
    ///      pays to evict are one economic policy, set by one hand.
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");

    /// @notice May change the occupancy policy — who is allowed to hold the slot.
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");

    /// @notice May change the utility — what holding the slot grants.
    bytes32 public constant UTILITY_MANAGER_ROLE = keccak256("UTILITY_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    /// @notice The deployer passed `address(0)` as admin, which would ship a
    ///         contract whose roles could never be granted or revoked.
    error AdminRequired();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    // ── Why these exist at all ───────────────────────────────────
    //
    // Not redundancy with the slot's own logs. The slot's propose events carry
    // NO proposer:
    //
    //     event TaxUpdateProposed(uint256 newPercentage);
    //     event UpdateProposed(UpdateKind indexed kind, bytes32 value, uint64 proposedAt);
    //
    // so from the slot side, who pulled the lever is simply absent.
    //
    // An indexer cannot recover it from `transaction.from` either. That works
    // only while the role holder is an EOA, and breaks in exactly the cases a
    // collective exists to serve: a Safe holding a role reports whichever owner
    // executed, and a bundled/AA call reports the bundler. A role-gated
    // governance contract is built so a multisig CAN hold a role, so the one
    // fallback is wrong precisely where it matters.
    //
    // ── One shape for all three dimensions ───────────────────────
    //
    // `value` is the proposed value widened to 32 bytes: raw basis points for
    // `Tax`, the left-padded address for `Utility` and `Policy` — matching how
    // the slot's own `UpdateProposed` carries it, so both sides of the relay
    // speak one vocabulary.

    /// @notice A role holder relayed a pending-update proposal to `slot`.
    event UpdateRelayed(
        address indexed slot,
        address indexed by,
        UpdateKind indexed kind,
        bytes32 value
    );

    /// @notice A role holder retracted `slot`'s pending update for one dimension.
    event UpdateCancelRelayed(
        address indexed slot,
        address indexed by,
        UpdateKind indexed kind
    );

    /// @notice An admin dropped every pending update on `slot` at once.
    /// @dev Distinct from `UpdateCancelRelayed`: this is the admin-only reach
    ///      across all three dimensions, not a per-kind retraction.
    event PendingUpdatesCancelled(address indexed slot, address indexed by);

    /// @notice A role holder changed `slot`'s liquidation bounty.
    /// @dev Kept off `UpdateRelayed` deliberately. The bounty is not an
    ///      `UpdateKind`, and adding a fourth member to that enum to fold this in
    ///      would be a genuinely dangerous edit: `UpdateKind` is positional and
    ///      is IMPORTED from `ISlot.sol` rather than redeclared here, precisely so
    ///      the two sides cannot drift. Saving one event is not worth touching it.
    event LiquidationBountyRelayed(
        address indexed slot,
        address indexed by,
        uint256 newBps
    );

    /// @dev Widens an address to the `bytes32` `UpdateRelayed` carries, so one
    ///      event shape describes a rate and two contract addresses. Mirrors
    ///      `Slot._asValue`.
    function _asValue(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    /// @dev OpenZeppelin's `DEFAULT_ADMIN_ROLE` administers other roles but does
    ///      not implicitly hold them, so `onlyRole(X)` alone would lock the admin
    ///      out of its own contract until it granted itself every role. This is
    ///      the "ADMIN can run all of them, OR you hold the specific role" rule.
    modifier onlyRoleOrAdmin(bytes32 role) {
        if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, role);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @dev Grants the admin and the three universal roles. Each engine calls
    ///      this from its own initializer and then grants its own payout role,
    ///      because only the engine knows what that role is called.
    ///
    ///      Deliberately NOT an `initializer` itself — the engine's entry point
    ///      carries that modifier, and nesting them would revert.
    function _initGovernance(
        address admin,
        address[] memory taxManagers,
        address[] memory policyManagers,
        address[] memory utilityManagers
    ) internal {
        if (admin == address(0)) revert AdminRequired();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRoleBatch(TAX_MANAGER_ROLE, taxManagers);
        _grantRoleBatch(POLICY_MANAGER_ROLE, policyManagers);
        _grantRoleBatch(UTILITY_MANAGER_ROLE, utilityManagers);
    }

    function _grantRoleBatch(bytes32 role, address[] memory accounts) internal {
        uint256 length = accounts.length;
        for (uint256 i; i < length; ++i) {
            _grantRole(role, accounts[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SLOT GOVERNANCE RELAYS
    // ═══════════════════════════════════════════════════════════
    //
    // Each takes the slot as an argument, so one deployment can be recipient and
    // manager for a whole collection of slots — tax from all of them pools here
    // and pays out through one engine. Roles are global across every slot this
    // contract manages; a `TAX_MANAGER_ROLE` holder holds it everywhere.
    //
    // No registry of "slots I manage" is kept. It would buy nothing: a call to a
    // slot that has not named this contract as its manager simply reverts with
    // `NotManager()` on the far side.

    /// @notice Propose a new tax rate on `slot`. Applies on its next ownership
    ///         transition, not immediately.
    function proposeTaxUpdate(IManagedSlot slot, uint256 newPct)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        slot.proposeTaxUpdate(newPct);
        emit UpdateRelayed(address(slot), msg.sender, UpdateKind.Tax, bytes32(newPct));
    }

    /// @notice Propose a new utility on `slot` — what holding it grants.
    function proposeUtilityUpdate(IManagedSlot slot, address newUtility)
        external
        onlyRoleOrAdmin(UTILITY_MANAGER_ROLE)
    {
        slot.proposeUtilityUpdate(newUtility);
        emit UpdateRelayed(
            address(slot),
            msg.sender,
            UpdateKind.Utility,
            _asValue(newUtility)
        );
    }

    /// @notice Propose a new occupancy policy on `slot` — who may hold it.
    /// @dev Deliberately its own role rather than sharing the utility's. Swapping
    ///      what a slot does and swapping whether it can be taken from you are
    ///      different promises to an occupant, and the slot gates them on
    ///      different flags (`mutableUtility` vs `mutablePolicy`). Collapsing the
    ///      two roles here would undo that distinction one layer up.
    function proposePolicyUpdate(IManagedSlot slot, address newPolicy)
        external
        onlyRoleOrAdmin(POLICY_MANAGER_ROLE)
    {
        slot.proposePolicyUpdate(newPolicy);
        emit UpdateRelayed(
            address(slot),
            msg.sender,
            UpdateKind.Policy,
            _asValue(newPolicy)
        );
    }

    /// @notice Update the liquidation bounty on `slot`. Takes effect immediately.
    function setLiquidationBounty(IManagedSlot slot, uint256 newBps)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        slot.setLiquidationBounty(newBps);
        emit LiquidationBountyRelayed(address(slot), msg.sender, newBps);
    }

    /// @notice Retract this role's own queued tax proposal on `slot`.
    /// @dev The mirror of `proposeTaxUpdate`, gated on the same role. Before the
    ///      slot grew a per-kind cancel, proposing and retracting sat at
    ///      different authority levels: a tax manager could queue a change but
    ///      only `DEFAULT_ADMIN_ROLE` could take it back, because taking it back
    ///      meant destroying every other role's queued work along with it.
    function cancelTaxUpdate(IManagedSlot slot)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        slot.cancelPendingUpdate(UpdateKind.Tax);
        emit UpdateCancelRelayed(address(slot), msg.sender, UpdateKind.Tax);
    }

    /// @notice Retract this role's own queued utility proposal on `slot`.
    function cancelUtilityUpdate(IManagedSlot slot)
        external
        onlyRoleOrAdmin(UTILITY_MANAGER_ROLE)
    {
        slot.cancelPendingUpdate(UpdateKind.Utility);
        emit UpdateCancelRelayed(address(slot), msg.sender, UpdateKind.Utility);
    }

    /// @notice Retract this role's own queued occupancy-policy proposal on `slot`.
    function cancelPolicyUpdate(IManagedSlot slot)
        external
        onlyRoleOrAdmin(POLICY_MANAGER_ROLE)
    {
        slot.cancelPendingUpdate(UpdateKind.Policy);
        emit UpdateCancelRelayed(address(slot), msg.sender, UpdateKind.Policy);
    }

    /// @notice Drop every pending update on `slot`, across all three dimensions.
    ///
    /// @dev STILL ADMIN ONLY, and now for a better reason than before. This used
    ///      to be the only way to cancel anything, so restricting it meant a
    ///      role holder could not retract their own proposal at all — the
    ///      restriction was damage control, not policy. With the three
    ///      single-dimension cancels above, each role can undo its own work,
    ///      and this is what it has always claimed to be: a deliberate reach
    ///      across all three, available only to the role that already outranks
    ///      them.
    function cancelPendingUpdates(IManagedSlot slot)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        slot.cancelPendingUpdates();
        emit PendingUpdatesCancelled(address(slot), msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Pull revenue from `slots` into this contract, ready to pay out.
    ///
    /// @dev Permissionless, and safe to be: `collect()` is unpermissioned on the
    ///      slot and always pays its own `recipient`, and `claim(address)` cannot
    ///      be redirected — it pays the account named, which here is always this
    ///      contract. A keeper calling this can move money towards the payout
    ///      engine and nowhere else.
    ///
    ///      Each leg is individually try/caught because both legs revert in
    ///      ordinary, expected conditions — `collect()` on `NothingToCollect`,
    ///      `claim()` on `NothingToClaim`. Without this, one empty slot in the
    ///      array would sink the whole sweep, and a caller would have to know the
    ///      exact state of every slot before batching.
    ///
    ///      Paying out stays a separate call in both engines, for the same
    ///      reason in each: the split needs its full `Split` struct as calldata
    ///      to check against `splitHash`, and the pool needs a decision about
    ///      whether the money leaves as a lump or as a rate.
    function sweep(IManagedSlot[] calldata slots) external {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].collect() {} catch {}
            // Recovers tax that was pushed while this contract could not accept
            // it and got booked as a credit instead.
            // solhint-disable-next-line no-empty-blocks
            try slots[i].claim(address(this)) {} catch {}
        }
    }
}
