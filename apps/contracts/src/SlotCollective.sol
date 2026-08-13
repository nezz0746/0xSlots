// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {PushSplit} from "splits-v2/splitters/push/PushSplit.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {UpdateKind} from "./interfaces/ISlot.sol";

/// @notice The subset of `Slot` this contract drives. Declared locally rather
///         than imported from `Slot.sol` so the manager compiles against a
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

/// @title SlotCollective — one address that both receives a slot's tax and governs it
///
/// @notice A slot names two addresses at creation and never lets go of either:
///         `recipient`, which money flows to, and `manager`, which may propose
///         tax / utility / occupancy-policy changes. The protocol deliberately
///         keeps them separate — "receives money" and "has admin powers" are
///         different jobs. This contract is for the case where you want them to
///         be the same address anyway, without collapsing them into one person:
///         a 0xSplits PushSplit that pays out to many recipients, wearing a
///         role-gated control panel on top.
///
///         Point a slot's `recipient` AND `config.manager` at an instance of
///         this and you get: tax accrues here, `distribute()` fans it out over
///         the split, and each of the slot's three governable dimensions is
///         gated behind its own role.
///
/// @dev ── WHY `owner` IS THIS CONTRACT ────────────────────────────────────
///      `SplitWalletV2` inherits `Wallet`, which exposes `execCalls` — an
///      arbitrary-call multicall gated on `msg.sender == owner`. It is NOT
///      `virtual`, so it cannot be overridden away. Left with a human owner,
///      that function would completely defeat everything below it: the owner
///      would simply call
///
///          execCalls([{ to: slot, data: proposeTaxUpdate(9999) }])
///
///      and bypass `TAX_MANAGER_ROLE` entirely. The roles would be decoration.
///
///      So ownership is bound to `address(this)` at construction and can never
///      move (`transferOwnership` reverts). `execCalls` then has no reachable
///      caller. The owner-gated functions that we DO want — `updateSplit`,
///      `setPaused` — are re-exposed below behind `SPLIT_MANAGER_ROLE`, which
///      works because splits' own `onlyOwner` already admits `address(this)`.
///
///      ── WHY THE SPLIT IS SET IN THE CONSTRUCTOR ──────────────────────────
///      `SplitWalletV2.initialize` is gated on `msg.sender == FACTORY`, where
///      `FACTORY` is whoever deployed. Deploying this directly rather than
///      through `PushSplitFactory` would leave a window between construction
///      and initialization in which the contract is a live, uninitialized
///      recipient. The constructor does the work instead — which is why the
///      validator below is hand-written: `SplitV2Lib.validate` takes calldata.
///
///      ── WHY `receive()` IS DECLARED ──────────────────────────────────────
///      `PushSplit` has none: upstream, `SplitProxy` supplies it, to dodge the
///      DELEGATECALL gas cost. Deployed directly there is no proxy. Without a
///      `receive()`, every native-ETH tax push from `Slot._payOrCredit` — a
///      deliberately gas-capped `call{gas: 30_000}` — would fail and silently
///      degrade into a `withdrawableOf` credit needing a manual `claim`.
contract SlotCollective is PushSplit, AccessControl, Initializable {
    using SplitV2Lib for SplitV2Lib.Split;

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

    /// @notice May rewrite the split itself — who gets paid, and in what shares —
    ///         and may pause distribution.
    bytes32 public constant SPLIT_MANAGER_ROLE = keccak256("SPLIT_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    /// @notice `transferOwnership` was called. Ownership is pinned to this
    ///         contract as a security invariant — see the contract-level note.
    error OwnershipIsSelfBound();

    /// @notice The deployer passed `address(0)` as admin, which would ship a
    ///         contract whose roles could never be granted or revoked.
    error AdminRequired();

    /// @notice A split with no recipients, or whose allocations all sum to zero.
    /// @dev Upstream `validate()` permits both. The second is the dangerous one:
    ///      `calculateAllocatedAmount` divides by `totalAllocation`, so a zero
    ///      total makes every `distribute` revert — a permanently stuck
    ///      recipient. Rejected here at construction instead.
    error EmptySplit();

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
    // only while the role holder is an EOA, and breaks in exactly the cases this
    // contract exists to serve: a Safe holding a role reports whichever owner
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
    event LiquidationBountyRelayed(address indexed slot, address indexed by, uint256 newBps);

    /// @dev Widens an address to the `bytes32` `UpdateRelayed` carries, so one
    ///      event shape describes a rate and two contract addresses. Mirrors
    ///      `Slot._asValue`.
    function _asValue(address a) private pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /// @param admin Holder of `DEFAULT_ADMIN_ROLE`. Can call every relay below
    ///        and is the admin of all four manager roles.
    /// @param taxManagers Initial `TAX_MANAGER_ROLE` holders. May be empty.
    /// @param policyManagers Initial `POLICY_MANAGER_ROLE` holders. May be empty.
    /// @param utilityManagers Initial `UTILITY_MANAGER_ROLE` holders. May be empty.
    /// @param splitManagers Initial `SPLIT_MANAGER_ROLE` holders. May be empty.
    struct InitialRoles {
        address admin;
        address[] taxManagers;
        address[] policyManagers;
        address[] utilityManagers;
        address[] splitManagers;
    }

    /// @notice Sets the chain-wide immutables and seals this contract against
    ///         direct use.
    ///
    /// @dev Only immutables here, because a proxy's constructor does not run
    ///      against the proxy's storage. `SPLITS_WAREHOUSE` and `NATIVE_TOKEN`
    ///      are `immutable` in `SplitWalletV2`, which means they live in THIS
    ///      contract's runtime bytecode and are read correctly through a
    ///      delegatecall — every manager behind the beacon shares the one
    ///      canonical warehouse, which is what you want anyway.
    ///
    ///      `SplitWalletV2.FACTORY` is immutable and set to `msg.sender` here,
    ///      so on a proxy it resolves to whoever deployed the IMPLEMENTATION,
    ///      not the manager's own factory. That would matter if this contract
    ///      used the inherited `initialize(split, owner)`, which is gated on
    ///      `msg.sender == FACTORY`. It does not — `initializeManager` below
    ///      does the same work itself, exactly as the old constructor did, so
    ///      nothing depends on `FACTORY` and nothing breaks when the beacon
    ///      points at an implementation someone else deployed.
    ///
    /// @param splitsWarehouse The canonical `SplitsWarehouse` for this chain.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address splitsWarehouse) PushSplit(splitsWarehouse) {
        // The implementation must never hold a split or roles of its own. It is
        // reachable directly at its own address, and a live, owned, role-granted
        // implementation behind a beacon is a standing invitation.
        _disableInitializers();
    }

    /// @notice Set up a manager. Called by `SlotCollectiveFactory` in the proxy
    ///         constructor.
    ///
    /// @dev Byte-for-byte the old constructor body. It deliberately does NOT
    ///      route through the inherited `SplitWalletV2.initialize`: that one is
    ///      gated on the `FACTORY` immutable (see the constructor note) and
    ///      would tie every manager to whoever happened to deploy the
    ///      implementation it was pointing at when it was created.
    ///
    /// @param split Initial payout configuration.
    /// @param roles Initial role assignment.
    function initializeManager(
        SplitV2Lib.Split memory split,
        InitialRoles memory roles
    ) external initializer {
        if (roles.admin == address(0)) revert AdminRequired();

        _validateSplitMemory(split);
        splitHash = split.getHashMem();
        updateBlockNumber = block.number;
        emit SplitUpdated(split);

        // Ownership is the contract itself, permanently. See the contract-level
        // note — this is what makes `Wallet.execCalls` unreachable and the roles
        // below meaningful. Under a proxy, `address(this)` is the proxy, so the
        // invariant lands on the manager rather than the implementation.
        __initWallet(address(this));

        _grantRole(DEFAULT_ADMIN_ROLE, roles.admin);
        _grantRoleBatch(TAX_MANAGER_ROLE, roles.taxManagers);
        _grantRoleBatch(POLICY_MANAGER_ROLE, roles.policyManagers);
        _grantRoleBatch(UTILITY_MANAGER_ROLE, roles.utilityManagers);
        _grantRoleBatch(SPLIT_MANAGER_ROLE, roles.splitManagers);
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    /// @dev OpenZeppelin's `DEFAULT_ADMIN_ROLE` administers other roles but does
    ///      not implicitly hold them, so `onlyRole(X)` alone would lock the admin
    ///      out of its own contract until it granted itself all four. This is the
    ///      "ADMIN can run all three, OR you hold the specific role" rule.
    modifier onlyRoleOrAdmin(bytes32 role) {
        if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, role);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // SLOT GOVERNANCE RELAYS
    // ═══════════════════════════════════════════════════════════
    //
    // Each takes the slot as an argument, so one deployment can be recipient and
    // manager for a whole collection of slots — tax from all of them pools here
    // and distributes over one split. Roles are global across every slot this
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
    // SPLIT GOVERNANCE
    // ═══════════════════════════════════════════════════════════

    /// @notice Rewrite the payout configuration.
    /// @dev Routed through the inherited `updateSplit` by external self-call.
    ///      `Ownable.onlyOwner` admits `msg.sender == address(this)`, so this
    ///      passes, and the hash/validation/event logic stays in exactly one
    ///      place — upstream's — instead of being duplicated and drifting.
    function setSplit(SplitV2Lib.Split calldata split)
        external
        onlyRoleOrAdmin(SPLIT_MANAGER_ROLE)
    {
        this.updateSplit(split);
    }

    /// @notice Pause or unpause distribution.
    /// @dev Reimplemented rather than delegating to `super`: the inherited body
    ///      is `onlyOwner`, and the caller here is a role holder, not this
    ///      contract. The two lines are the whole function upstream.
    function setPaused(bool _paused)
        public
        override
        onlyRoleOrAdmin(SPLIT_MANAGER_ROLE)
    {
        paused = _paused;
        emit SetPaused(_paused);
    }

    // ═══════════════════════════════════════════════════════════
    // OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Pull revenue from `slots` into this contract, ready to distribute.
    ///
    /// @dev Permissionless, and safe to be: `collect()` is unpermissioned on the
    ///      slot and always pays its own `recipient`, and `claim(address)` cannot
    ///      be redirected — it pays the account named, which here is always this
    ///      contract. A keeper calling this can move money towards the split and
    ///      nowhere else.
    ///
    ///      Each leg is individually try/caught because both legs revert in
    ///      ordinary, expected conditions — `collect()` on `NothingToCollect`,
    ///      `claim()` on `NothingToClaim`. Without this, one empty slot in the
    ///      array would sink the whole sweep, and a caller would have to know the
    ///      exact state of every slot before batching.
    ///
    ///      `collect()` merely moves tax from the slot's internal ledger to this
    ///      address; `distribute()` is still a separate call, and remains so
    ///      because it needs the full `Split` struct as calldata to check against
    ///      `splitHash`.
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

    /// @notice Native ETH from slot tax, `distribute` dust, and direct sends.
    /// @dev Must exist — see the contract-level note. Kept empty so it stays
    ///      inside the 30k gas cap `Slot._payOrCredit` allows a native push.
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    // ═══════════════════════════════════════════════════════════
    // SEALED INHERITED SURFACE
    // ═══════════════════════════════════════════════════════════

    /// @notice Always reverts. Ownership is this contract, permanently.
    /// @dev Moving it would re-arm `Wallet.execCalls` and make every role above
    ///      bypassable. `execCalls` is not `virtual` and cannot be disabled
    ///      directly, so pinning the owner is the only lever that seals it —
    ///      which means this override is load-bearing, not hygiene.
    function transferOwnership(address) public pure override {
        revert OwnershipIsSelfBound();
    }

    /// @notice Always reports an invalid signature.
    ///
    /// @dev Not a policy choice so much as a hazard being defused. `getSigner()`
    ///      is non-`virtual` upstream and returns `owner`, which here is
    ///      `address(this)`. `SignatureChecker` falls back to an ERC-1271
    ///      staticcall when the signer has code — so the inherited implementation
    ///      would call back into itself with a re-wrapped hash, recursing until
    ///      it ran out of gas. Any integrator that probes contracts for ERC-1271
    ///      support would get a gas bomb instead of a `false`.
    ///
    ///      A contract governed by four roles has no single signer to speak for
    ///      it in any case, so the honest answer and the safe one agree.
    function isValidSignature(bytes32, bytes calldata) public pure override returns (bytes4) {
        return 0xffffffff;
    }

    /// @dev `AccessControl` and `ERC1155Holder` both land here via `ERC165`.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC1155Holder)
        returns (bool)
    {
        return AccessControl.supportsInterface(interfaceId)
            || ERC1155Holder.supportsInterface(interfaceId);
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    /// @dev `SplitV2Lib.validate` is calldata-only and the constructor works in
    ///      memory. Mirrors it, plus the non-empty check upstream omits.
    function _validateSplitMemory(SplitV2Lib.Split memory split) private pure {
        uint256 numOfRecipients = split.recipients.length;
        if (numOfRecipients == 0) revert EmptySplit();
        if (split.allocations.length != numOfRecipients) {
            revert SplitV2Lib.InvalidSplit_LengthMismatch();
        }

        uint256 totalAllocation;
        for (uint256 i; i < numOfRecipients; ++i) {
            totalAllocation += split.allocations[i];
        }

        if (totalAllocation != split.totalAllocation) {
            revert SplitV2Lib.InvalidSplit_TotalAllocationMismatch();
        }
        if (totalAllocation == 0) revert EmptySplit();
    }

    function _grantRoleBatch(bytes32 role, address[] memory accounts) private {
        uint256 length = accounts.length;
        for (uint256 i; i < length; ++i) {
            _grantRole(role, accounts[i]);
        }
    }
}
