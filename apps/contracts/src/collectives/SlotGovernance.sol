// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";


/// @notice The subset of `Slot` a collective drives. Declared locally rather
///         than imported from `Slot.sol` so the collective compiles against a
///         signature list, not against the slot's implementation — the two are
///         deployed independently and only ever meet across an ABI boundary.
///
/// @dev ── What the hook redesign did to this ─────────────────────────────
///
///      Seven of the previous nine functions are gone. `addModule` and
///      `removeModule` went with modules themselves; `setLiquidationBounty`
///      went with the bounty; and `proposeTaxUpdate` and `proposePolicyUpdate`
///      collapsed into one `proposeTerms`, because tax and hook now share one
///      deferral and one apply.
///
///      The old local copy of `UpdateKind` is gone too, and with it the hazard
///      that justified importing it: an enum passed ACROSS the boundary is
///      positional, so a local copy drifting by one member would cancel the
///      wrong dimension. `proposeTerms` and `cancelTerms` take plain bools,
///      so nothing positional crosses any more. The `Dimension` enum below
///      never leaves this contract — it labels events and nothing else — which
///      is why redeclaring it here is safe where the old one was not.
interface IManagedSlot {
    function proposeTerms(
        uint256 newTaxBps,
        address newHook,
        bytes32 newHookData,
        bool changeTax,
        bool changeHook
    ) external;

    function cancelTerms(bool cancelTax, bool cancelHook) external;

    function collect() external;

    function claim(address account) external;
}

/// @notice Which lever a relayed event describes. Local to this contract and
///         never passed to a slot — see the note on `IManagedSlot`.
enum Dimension {
    Tax,
    Hook
}

abstract contract SlotGovernance is AccessControl, Initializable {
    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    /// @notice May change the tax rate — what the slot costs to hold.
    /// @dev The liquidation bounty used to ride along with this role. The
    ///      protocol no longer has one: liquidation pays nothing, and the
    ///      reward is the vacancy itself.
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");

    /// @notice May change the hook — both what holding the slot grants and who
    ///         is allowed to hold it.
    ///
    /// @dev ── Why this is the POLICY role and not the UTILITY one ──────────
    ///
    ///      A hook is the old policy and the old utility unified, so the two
    ///      roles that governed them separately have to collapse into one. The
    ///      identifier kept is `POLICY_MANAGER_ROLE`, and the choice is not
    ///      cosmetic: whichever one survives, its existing holders inherit the
    ///      other's powers on every live collective.
    ///
    ///      A policy manager could already decide who may hold a slot, which
    ///      is the stronger of the two — they gain the ability to change what
    ///      it does. Keeping `UTILITY_MANAGER_ROLE` instead would run the
    ///      escalation the other way: someone trusted only to change what a
    ///      slot does would silently acquire the power to decide who may hold
    ///      it, and to refuse buys outright. Privileges must not widen because
    ///      an implementation was refactored underneath them.
    ///
    ///      Holders of `UTILITY_MANAGER_ROLE` therefore lose their lever
    ///      rather than gaining one. That is the safe direction, and it is
    ///      recoverable by an admin granting them this role deliberately.
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");

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
    //     event UpdateProposed(Dimension indexed kind, bytes32 value, uint64 proposedAt);
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
    // ── One shape for both dimensions ────────────────────────────
    //
    // `value` is the proposed value widened to 32 bytes: raw basis points for
    // `Tax`, the left-padded address for `Hook`.

    /// @notice A role holder relayed a pending-update proposal to `slot`.
    event TermsRelayed(
        address indexed slot,
        address indexed by,
        Dimension indexed kind,
        bytes32 value
    );

    /// @notice A role holder retracted `slot`'s pending update for one dimension.
    event TermsCancelRelayed(
        address indexed slot,
        address indexed by,
        Dimension indexed kind
    );

    /// @notice An admin dropped every pending proposal on `slot` at once.
    /// @dev Distinct from `TermsCancelRelayed`: this is the admin-only reach
    ///      across both dimensions, not a per-dimension retraction.
    event AllTermsCancelled(address indexed slot, address indexed by);

    /// @dev Widens an address to the `bytes32` `TermsRelayed` carries, so one
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
    /// @dev `hookManagers` receive `POLICY_MANAGER_ROLE` — see that constant
    ///      for why the identifier still says policy. There is no separate
    ///      utility role to grant any more; the parameter is gone rather than
    ///      quietly redirected, because silently granting the hook role to
    ///      whoever was listed as a utility manager is the escalation the role
    ///      choice above exists to avoid.
    function _initGovernance(
        address admin,
        address[] memory taxManagers,
        address[] memory hookManagers
    ) internal {
        if (admin == address(0)) revert AdminRequired();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRoleBatch(TAX_MANAGER_ROLE, taxManagers);
        _grantRoleBatch(POLICY_MANAGER_ROLE, hookManagers);
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

    /// @notice Propose a new tax rate on `slot`. Applies on its next occupancy
    ///         transition, not immediately.
    function proposeTax(IManagedSlot slot, uint256 newTaxBps)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        _proposeTax(slot, newTaxBps);
    }

    /// @notice The same rate across many slots, in one transaction.
    ///
    /// @dev All-or-nothing, unlike {sweep}. A relay that fails does so because
    ///      this contract is not that slot's manager or the rate is invalid —
    ///      mistakes, not ordinary states — and swallowing them would report
    ///      success for a portfolio that half moved. The cancels below tolerate
    ///      failure because "nothing queued" IS an ordinary state.
    function proposeTaxBatch(IManagedSlot[] calldata slots, uint256 newTaxBps)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) _proposeTax(slots[i], newTaxBps);
    }

    function _proposeTax(IManagedSlot slot, uint256 newTaxBps) internal {
        slot.proposeTerms(newTaxBps, address(0), bytes32(0), true, false);
        emit TermsRelayed(address(slot), msg.sender, Dimension.Tax, bytes32(newTaxBps));
    }

    /// @notice Propose a new hook on `slot` — what holding it grants, and who
    ///         may take it.
    ///
    /// @dev Passing `address(0)` detaches. That is a real choice rather than a
    ///      missing argument, which is why the slot takes an explicit
    ///      `changeHook` flag and this relay always sets it: there is no way to
    ///      express "detach" if a zero address means "leave alone".
    ///
    ///      The slot validates the hook now — one whose `subscriptions()` does not
    ///      answer, or which rejects `newHookData`, is refused here rather than
    ///      attached broken — so this relay does not re-check. One validation,
    ///      one authority.
    ///
    ///      `newHookData` rides with the address because it configures THAT
    ///      hook. A relay that let the two be set apart would be a way for this
    ///      role to hand a hook a word meant for its predecessor.
    function proposeHook(
        IManagedSlot slot,
        address newHook,
        bytes32 newHookData
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        _proposeHook(slot, newHook, newHookData);
    }

    /// @notice The same hook and configuration across many slots.
    /// @dev All-or-nothing, for the reason given on {proposeTaxBatch}. The hook
    ///      and its data travel together here exactly as they do singly — one
    ///      word cannot be handed to a hook it was not written for.
    function proposeHookBatch(
        IManagedSlot[] calldata slots,
        address newHook,
        bytes32 newHookData
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            _proposeHook(slots[i], newHook, newHookData);
        }
    }

    function _proposeHook(
        IManagedSlot slot,
        address newHook,
        bytes32 newHookData
    ) internal {
        slot.proposeTerms(0, newHook, newHookData, false, true);
        emit TermsRelayed(
            address(slot),
            msg.sender,
            Dimension.Hook,
            _asValue(newHook)
        );
    }

    /// @notice Retract this role's own queued tax proposal on `slot`.
    /// @dev Single-dimension, and that is load-bearing rather than tidy. The
    ///      slot's cancel takes the same two flags its propose does, so a tax
    ///      manager retracting their own work cannot destroy the hook
    ///      manager's queued change as a side effect.
    function cancelTaxProposal(IManagedSlot slot)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        slot.cancelTerms(true, false);
        emit TermsCancelRelayed(address(slot), msg.sender, Dimension.Tax);
    }

    /// @notice Retract this role's queued tax proposals across many slots.
    /// @dev Tolerant, unlike the proposes: the slot rejects a cancel for a
    ///      dimension holding nothing, so one already-clean slot in the array
    ///      would otherwise sink the batch — and a caller would have to know
    ///      the exact state of every slot before calling.
    function cancelTaxProposalBatch(IManagedSlot[] calldata slots)
        external
        onlyRoleOrAdmin(TAX_MANAGER_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(true, false) {
                emit TermsCancelRelayed(address(slots[i]), msg.sender, Dimension.Tax);
            } catch {}
        }
    }

    /// @notice Retract this role's own queued hook proposal on `slot`.
    function cancelHookProposal(IManagedSlot slot)
        external
        onlyRoleOrAdmin(POLICY_MANAGER_ROLE)
    {
        slot.cancelTerms(false, true);
        emit TermsCancelRelayed(address(slot), msg.sender, Dimension.Hook);
    }

    /// @notice Retract this role's queued hook proposals across many slots.
    /// @dev Tolerant, for the reason given on {cancelTaxProposalBatch}.
    function cancelHookProposalBatch(IManagedSlot[] calldata slots)
        external
        onlyRoleOrAdmin(POLICY_MANAGER_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(false, true) {
                emit TermsCancelRelayed(address(slots[i]), msg.sender, Dimension.Hook);
            } catch {}
        }
    }

    /// @notice Drop every pending proposal on `slot`, across both dimensions.
    ///
    /// @dev Admin only, and for the reason it always claimed: this is a
    ///      deliberate reach across work that belongs to other roles, so it
    ///      belongs to the role that already outranks them. With the two
    ///      single-dimension cancels above, no role needs it to undo its own
    ///      proposal.
    ///
    ///      Tolerates a slot with only one dimension queued. The slot rejects a
    ///      cancel for a dimension that holds nothing, so asking for both would
    ///      revert on exactly the common case; each leg is attempted
    ///      separately and a nothing-to-cancel is not a failure.
    function cancelAllProposals(IManagedSlot slot)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // solhint-disable-next-line no-empty-blocks
        try slot.cancelTerms(true, false) {} catch {}
        // solhint-disable-next-line no-empty-blocks
        try slot.cancelTerms(false, true) {} catch {}
        emit AllTermsCancelled(address(slot), msg.sender);
    }

    /// @notice Drop every pending proposal across many slots. Admin only.
    /// @dev Already tolerant singly, and stays so: this is the call reached for
    ///      when the state of the portfolio is exactly what is not known.
    function cancelAllProposalsBatch(IManagedSlot[] calldata slots)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(true, false) {} catch {}
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(false, true) {} catch {}
            emit AllTermsCancelled(address(slots[i]), msg.sender);
        }
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
