// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {PushSplit} from "splits-v2/splitters/push/PushSplit.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotGovernance} from "./SlotGovernance.sol";
import {Versioned} from "../utils/Versioned.sol";

/// @title SlotCollective — a collective that pays out through a 0xSplits split
///
/// @notice A slot names two addresses at creation and never lets go of either:
///         `recipient`, which money flows to, and `manager`, which may propose
///         tax and module changes. The protocol deliberately
///         keeps them separate — "receives money" and "has admin powers" are
///         different jobs. This contract is for the case where you want them to
///         be the same address anyway, without collapsing them into one person:
///         a 0xSplits PushSplit that pays out to many recipients, wearing a
///         role-gated control panel on top.
///
///         Point a slot's `recipient` AND `settings.manager` at an instance of
///         this and you get: tax accrues here, `distribute()` fans it out over
///         the split, and each of the slot's two governable dimensions is
///         gated behind its own role.
///
/// @dev ── THIS IS ONE OF TWO PAYOUT ENGINES ───────────────────────────────
///      The control panel — the roles and the relays — lives in
///      `SlotGovernance` and is shared with `SlotStreamCollective`, which pays
///      out through a Superfluid pool instead. Everything below is the split
///      half and only the split half.
///
///      Pick this one when payouts are DISCRETE: a lump arrives, someone calls
///      `distribute()`, recipients are paid. Pick the stream when payouts
///      should be CONTINUOUS.
///
///      ── WHY `owner` IS THIS CONTRACT ────────────────────────────────────
///      `SplitWalletV2` inherits `Wallet`, which exposes `execCalls` — an
///      arbitrary-call multicall gated on `msg.sender == owner`. It is NOT
///      `virtual`, so it cannot be overridden away. Left with a human owner,
///      that function would completely defeat everything below it: the owner
///      would simply call
///
///          execCalls([{ to: slot, data: proposeTerms(tax, module, TERM_TAX_RATE) }])
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
///
///      ── WHY `multicall` IS SAFE WHERE `execCalls` IS NOT ─────────────────
///      `multicall` only delegatecalls this contract's own functions, keeping
///      `msg.sender`, so every call in a batch passes the same role check it
///      would alone. It cannot reach another contract and is not payable.
contract SlotCollective is PushSplit, SlotGovernance, Multicall, Versioned {
    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    /// @dev The split manager: whoever decides who is paid decides whether a
    ///      module may take a share first.
    function _payoutRole() internal pure override returns (bytes32) {
        return SPLIT_MANAGER_ROLE;
    }

    using SplitV2Lib for SplitV2Lib.Split;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    /// @notice May rewrite the split itself — who gets paid, and in what shares —
    ///         and may pause distribution.
    ///
    /// @dev The payout role, declared HERE rather than in `SlotGovernance`,
    ///      because its identifier is `keccak256` of this exact string and
    ///      live collectives already have holders of it. See the note in
    ///      `SlotGovernance` on why the payout role is never shared.
    bytes32 public constant SPLIT_MANAGER_ROLE = keccak256("SPLIT_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    /// @notice `transferOwnership` was called. Ownership is pinned to this
    ///         contract as a security invariant — see the contract-level note.
    error OwnershipIsSelfBound();

    /// @notice A split with no recipients, or whose allocations all sum to zero.
    /// @dev Upstream `validate()` permits both. The second is the dangerous one:
    ///      `calculateAllocatedAmount` divides by `totalAllocation`, so a zero
    ///      total makes every `distribute` revert — a permanently stuck
    ///      recipient. Rejected here at construction instead.
    error EmptySplit();

    /// @dev The implementation was deployed by an account with no code. That
    ///      account would be `FACTORY`, able to call the inherited `initialize`
    ///      on every collective behind the beacon. See the constructor.
    error DeployedByAnAccount();

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /// @param admin Holder of `DEFAULT_ADMIN_ROLE`. Can call every relay below
    ///        and is the admin of all three manager roles.
    /// @param taxManagers Initial `TAX_MANAGER_ROLE` holders. May be empty.
    /// @param policyManagers Initial `POLICY_MANAGER_ROLE` holders — the role
    ///        that governs the module. May be empty.
    /// @param splitManagers Initial `SPLIT_MANAGER_ROLE` holders. May be empty.
    struct InitialRoles {
        address admin;
        address[] taxManagers;
        address[] policyManagers;
        address[] splitManagers;
    }

    /// @notice Sets the chain-wide immutables and seals this contract against
    ///         direct use.
    ///
    /// @dev Only immutables here, because a proxy's constructor does not run
    ///      against the proxy's storage. `SPLITS_WAREHOUSE` and `NATIVE_TOKEN`
    ///      are `immutable` in `SplitWalletV2`, which means they live in THIS
    ///      contract's runtime bytecode and are read correctly through a
    ///      delegatecall — every collective behind the beacon shares the one
    ///      canonical warehouse, which is what you want anyway.
    ///
    ///      `SplitWalletV2.FACTORY` is immutable and set to `msg.sender` here,
    ///      so on a proxy it resolves to whoever deployed the IMPLEMENTATION,
    ///      not the collective's own factory. This contract never uses the
    ///      inherited `initialize(split, owner)` — `initializeCollective` does
    ///      that work itself — but it cannot remove it either: upstream it is
    ///      not `virtual`, has no initialized latch, and is gated ONLY on
    ///      `msg.sender == FACTORY`. Whoever deployed the implementation can
    ///      therefore call it on EVERY collective behind the beacon, at any
    ///      time, making themselves `owner` — which re-arms `execCalls` and
    ///      undoes everything the note above describes.
    ///
    ///      So the deployer must be something that can never make that call.
    ///      The canonical one is the deterministic CREATE2 deployer, whose
    ///      code has no `CALL` at all; `DeployProtocol` uses it. An account
    ///      with no code is refused outright, because `forge create` from a
    ///      wallet is the realistic way to get this wrong. A contract deployer
    ///      is allowed (tests, and the deploy script's own version probe), and
    ///      is on whoever adopts its implementation into the beacon to vet.
    ///
    /// @param splitsWarehouse The canonical `SplitsWarehouse` for this chain.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address splitsWarehouse) PushSplit(splitsWarehouse) {
        if (msg.sender.code.length == 0) revert DeployedByAnAccount();
        // The implementation must never hold a split or roles of its own. It is
        // reachable directly at its own address, and a live, owned, role-granted
        // implementation behind a beacon is a standing invitation.
        _disableInitializers();
    }

    /// @notice Set up a collective. Called by `SlotCollectiveFactory` in the
    ///         proxy constructor.
    ///
    /// @dev Deliberately does NOT route through the inherited
    ///      `SplitWalletV2.initialize`: that one is
    ///      gated on the `FACTORY` immutable (see the constructor note) and
    ///      would tie every collective to whoever happened to deploy the
    ///      implementation it was pointing at when it was created.
    ///
    /// @param split Initial payout configuration.
    /// @param roles Initial role assignment.
    function initializeCollective(
        SplitV2Lib.Split memory split,
        InitialRoles memory roles
    ) external initializer {
        _validateSplitMemory(split);
        splitHash = split.getHashMem();
        updateBlockNumber = block.number;
        emit SplitUpdated(split);

        // Ownership is the contract itself, permanently. See the contract-level
        // note — this is what makes `Wallet.execCalls` unreachable and the roles
        // below meaningful. Under a proxy, `address(this)` is the proxy, so the
        // invariant lands on the collective rather than the implementation.
        __initWallet(address(this));

        // Reverts on a zero admin, so the ordering below matches the original:
        // validation of the split first, then of the roles.
        _initGovernance(roles.admin, roles.taxManagers, roles.policyManagers);
        _grantRoleBatch(SPLIT_MANAGER_ROLE, roles.splitManagers);
    }

    // ═══════════════════════════════════════════════════════════
    // SPLIT GOVERNANCE
    // ═══════════════════════════════════════════════════════════

    /// @notice Pay out what is held under the current split, then rewrite it.
    ///
    /// @param current The split in force, as `distribute` requires.
    /// @param next The split to install.
    /// @param tokens Every token the collective holds, `NATIVE_TOKEN` for ETH.
    ///        Each is distributed under `current` first, so rent already
    ///        collected for the old recipients cannot be paid to the new ones.
    ///        A token left out is paid under `next`; listing all of them is the
    ///        split manager's responsibility.
    ///
    /// @dev Reverts while paused, because distributing does. Routed through the
    ///      inherited `updateSplit` by external self-call: `Ownable.onlyOwner`
    ///      admits `msg.sender == address(this)`, so the hash, validation and
    ///      event logic stay upstream's.
    function setSplit(
        SplitV2Lib.Split calldata current,
        SplitV2Lib.Split calldata next,
        address[] calldata tokens
    ) external onlyRoleOrAdmin(SPLIT_MANAGER_ROLE) {
        uint256 length = tokens.length;
        for (uint256 i; i < length; ++i) {
            (uint256 held, uint256 warehoused) = getSplitBalance(tokens[i]);
            // `distribute` leaves one unit behind, so one unit is nothing to pay.
            if (held > 1 || warehoused > 1) this.distribute(current, tokens[i], msg.sender);
        }
        this.updateSplit(next);
    }

    /// @notice Pause or unpause distribution.
    /// @dev Reimplemented rather than delegating to `super`: the inherited body
    ///      is `onlyOwner`, and the caller here is a role holder, not this
    ///      contract. The two lines are the whole function upstream.
    function setPaused(bool _paused) public override onlyRoleOrAdmin(SPLIT_MANAGER_ROLE) {
        paused = _paused;
        emit SetPaused(_paused);
    }

    // ═══════════════════════════════════════════════════════════
    // OPERATIONS
    // ═══════════════════════════════════════════════════════════

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
}
