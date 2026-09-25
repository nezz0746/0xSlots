// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {TaxTerms, ModuleTerms, ModuleFee, Pending} from "../types/SlotTypes.sol";
import {TermsLib} from "../libraries/TermsLib.sol";

/// @notice The subset of `Slot` a collective drives.
interface IManagedSlot {
    function proposeTerms(
        TaxTerms calldata taxTerms,
        ModuleTerms calldata terms,
        uint16 mask
    ) external;

    function cancelTerms(uint16 mask) external;

    function acceptFee(ModuleFee calldata expected) external;

    function acceptScopes(uint16 expected) external;

    function fee() external view returns (ModuleFee memory);

    function pending() external view returns (Pending memory);

    function collect() external;

    function claim(address account) external;
}

/// @notice Which lever a relayed event describes. Local to this contract and
///         never passed to a slot.
enum Dimension {
    Tax,
    Module
}

abstract contract SlotGovernance is AccessControl, Initializable {
    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    /// @notice May change the tax rate — what the slot costs to hold.
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");

    /// @notice May change the module — both what holding the slot grants and who
    ///         is allowed to hold it.
    ///
    /// @dev One role, because one module governs both halves: a module decides who
    ///      may hold a slot AND what holding it does, and nobody can be granted
    ///      one of those without the other.
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
    // Not redundancy with the slot's own logs. The slot's `TermsProposed`
    // carries NO proposer, so from the slot side, who pulled the lever is
    // simply absent.
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
    // `Tax`, the left-padded address for `Module`.

    /// @notice A role holder relayed a pending-update proposal to `slot`.
    event TermsRelayed(
        address indexed slot, address indexed by, Dimension indexed kind, bytes32 value
    );

    /// @notice A role holder retracted `slot`'s pending update for one dimension.
    event TermsCancelRelayed(address indexed slot, address indexed by, Dimension indexed kind);

    /// @notice A policy manager accepted the attached module's current fee on `slot`.
    event FeeAcceptRelayed(address indexed slot, address indexed by, ModuleFee fee);

    /// @notice A policy manager accepted the attached module's current scopes on `slot`.
    event ScopesAcceptRelayed(address indexed slot, address indexed by, uint16 scopes);

    /// @notice An admin dropped every pending proposal on `slot` at once.
    /// @dev Distinct from `TermsCancelRelayed`: this is the admin-only reach
    ///      across both dimensions, not a per-dimension retraction.
    event AllTermsCancelled(address indexed slot, address indexed by);

    /// @dev Widens an address to the `bytes32` `TermsRelayed` carries, so one
    ///      event shape describes a rate and an address.
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
        _requireRoleOrAdmin(role);
        _;
    }

    function _requireRoleOrAdmin(bytes32 role) internal view {
        if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, role);
        }
    }

    /// @dev The role that decides where this engine's revenue goes — the split
    ///      manager of a split, the pool manager of a stream. Only the engine
    ///      knows its name.
    function _payoutRole() internal pure virtual returns (bytes32);

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @dev Grants the admin and the three universal roles. Each engine calls
    ///      this from its own initializer and then grants its own payout role,
    ///      because only the engine knows what that role is called.
    ///
    ///      Deliberately NOT an `initializer` itself — the engine's entry point
    ///      carries that modifier, and nesting them would revert.
    /// @dev `policyManagers` receive `POLICY_MANAGER_ROLE`.
    function _initGovernance(
        address admin,
        address[] memory taxManagers,
        address[] memory policyManagers
    ) internal {
        if (admin == address(0)) revert AdminRequired();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRoleBatch(TAX_MANAGER_ROLE, taxManagers);
        _grantRoleBatch(POLICY_MANAGER_ROLE, policyManagers);
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

    /// @notice Propose a new tax rate on `slot`. Applies at its next buy, not
    ///         immediately.
    function proposeTax(
        IManagedSlot slot,
        uint16 newTaxRateBps
    ) external onlyRoleOrAdmin(TAX_MANAGER_ROLE) {
        _proposeTax(slot, newTaxRateBps);
    }

    /// @notice The same rate across many slots, in one transaction.
    ///
    /// @dev All-or-nothing, unlike {sweep}. A relay that fails does so because
    ///      this contract is not that slot's manager or the rate is invalid —
    ///      mistakes, not ordinary states — and swallowing them would report
    ///      success for a portfolio that half moved. The cancels below tolerate
    ///      failure because "nothing queued" IS an ordinary state.
    function proposeTaxBatch(
        IManagedSlot[] calldata slots,
        uint16 newTaxRateBps
    ) external onlyRoleOrAdmin(TAX_MANAGER_ROLE) {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            _proposeTax(slots[i], newTaxRateBps);
        }
    }

    function _proposeTax(IManagedSlot slot, uint16 newTaxRateBps) internal {
        TaxTerms memory taxTerms;
        taxTerms.rateBps = newTaxRateBps;
        ModuleTerms memory none;
        slot.proposeTerms(taxTerms, none, TermsLib.TAX_RATE);
        emit TermsRelayed(address(slot), msg.sender, Dimension.Tax, bytes32(uint256(newTaxRateBps)));
    }

    /// @notice Propose a new module on `slot`: its address, configuration and
    ///         fee, as one decision.
    ///
    /// @dev A zero `terms.module` detaches. The slot validates the terms with the
    ///      module now, so this relay does not re-check. One validation, one
    ///      authority.
    function proposeModule(
        IManagedSlot slot,
        ModuleTerms calldata terms
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        _proposeModule(slot, terms);
    }

    /// @notice The same module terms across many slots.
    /// @dev All-or-nothing, for the reason given on {proposeTaxBatch}.
    function proposeModuleBatch(
        IManagedSlot[] calldata slots,
        ModuleTerms calldata terms
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            _proposeModule(slots[i], terms);
        }
    }

    function _proposeModule(IManagedSlot slot, ModuleTerms calldata terms) internal {
        // A module that takes a fee takes it from the revenue this collective
        // exists to divide, so attaching one is the payout role's decision as
        // much as the policy role's. Without this the policy role could send
        // every slot's rent to a module's fee recipient and the split's members
        // would receive nothing, with the split itself untouched.
        //
        // Checked against the fee the SLOT recorded, after it recorded it, and
        // never against an answer the module gave this contract. A module's
        // `fee` is a view that can see who is asking: asked separately, it
        // could tell this contract nothing and the slot everything.
        TaxTerms memory none;
        slot.proposeTerms(none, terms, TermsLib.MODULE);
        if (slot.pending().nextModule.fee.bps != 0) _requireRoleOrAdmin(_payoutRole());
        emit TermsRelayed(address(slot), msg.sender, Dimension.Module, _asValue(terms.module));
    }

    /// @notice Accept the attached module's current fee on `slot`. Applies at once.
    ///
    /// @dev The policy manager's decision, like proposing a module — and, for a
    ///      higher fee or a new fee recipient, the payout role's as well.
    ///      `expected` is the fee they reviewed; the slot reverts if the module
    ///      now declares anything else.
    function acceptFee(
        IManagedSlot slot,
        ModuleFee calldata expected
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        // Raising the fee, or sending it somewhere new, is the payout role's
        // call too, for the reason given in {_proposeModule}. Lowering it to
        // the same recipient is not.
        ModuleFee memory current = slot.fee();
        if (
            expected.bps > current.bps
                || (expected.bps != 0 && expected.recipient != current.recipient)
        ) {
            _requireRoleOrAdmin(_payoutRole());
        }
        slot.acceptFee(expected);
        emit FeeAcceptRelayed(address(slot), msg.sender, expected);
    }

    /// @notice Accept the attached module's current scopes on `slot`. They
    ///         land at the next buy.
    function acceptScopes(
        IManagedSlot slot,
        uint16 expected
    ) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        slot.acceptScopes(expected);
        emit ScopesAcceptRelayed(address(slot), msg.sender, expected);
    }

    /// @notice Retract this role's own queued tax proposal on `slot`.
    /// @dev Single-dimension, and that is load-bearing rather than tidy. The
    ///      slot's cancel takes a mask like its propose, so a tax
    ///      manager retracting their own work cannot destroy the module
    ///      manager's queued change as a side effect.
    function cancelTaxProposal(IManagedSlot slot) external onlyRoleOrAdmin(TAX_MANAGER_ROLE) {
        slot.cancelTerms(TermsLib.TAX_RATE);
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
            try slots[i].cancelTerms(TermsLib.TAX_RATE) {
                emit TermsCancelRelayed(address(slots[i]), msg.sender, Dimension.Tax);
            } catch {}
        }
    }

    /// @notice Retract this role's own queued module proposal on `slot`.
    function cancelModuleProposal(IManagedSlot slot) external onlyRoleOrAdmin(POLICY_MANAGER_ROLE) {
        slot.cancelTerms(TermsLib.MODULE);
        emit TermsCancelRelayed(address(slot), msg.sender, Dimension.Module);
    }

    /// @notice Retract this role's queued module proposals across many slots.
    /// @dev Tolerant, for the reason given on {cancelTaxProposalBatch}.
    function cancelModuleProposalBatch(IManagedSlot[] calldata slots)
        external
        onlyRoleOrAdmin(POLICY_MANAGER_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(TermsLib.MODULE) {
                emit TermsCancelRelayed(address(slots[i]), msg.sender, Dimension.Module);
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
    ///      Clears whatever is queued, of any term.
    function cancelAllProposals(IManagedSlot slot) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // solhint-disable-next-line no-empty-blocks
        try slot.cancelTerms(TermsLib.ALL) {} catch {}
        emit AllTermsCancelled(address(slot), msg.sender);
    }

    /// @notice Drop every pending proposal across many slots. Admin only.
    /// @dev Tolerant: this is the call reached for when the state of the
    ///      portfolio is exactly what is not known.
    function cancelAllProposalsBatch(IManagedSlot[] calldata slots)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 length = slots.length;
        for (uint256 i; i < length; ++i) {
            // solhint-disable-next-line no-empty-blocks
            try slots[i].cancelTerms(TermsLib.ALL) {} catch {}
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
        _sweep(slots);
    }

    function _sweep(IManagedSlot[] calldata slots) internal {
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
