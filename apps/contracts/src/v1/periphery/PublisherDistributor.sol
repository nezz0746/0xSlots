// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title PublisherDistributor — cumulative merkle payouts for ad publishers
///
/// @notice Pays many publishers from one pot, against a root published each
///         epoch. Sits behind a split: the slot's collective holds
///         `[10% adland, 90% this]`, so what arrives here is already the
///         publishers' share and nothing here needs to know the ratio.
///
/// @dev ── WHY NOT JUST USE THE SPLIT ─────────────────────────────────────
///      A split divides whatever balance is present WHEN `distribute()` runs,
///      by whatever the split says AT THAT MOMENT. It has no notion that money
///      was earned in a particular period. Harberger tax accrues continuously,
///      so there is always money in flight belonging to a period whose shares
///      are about to be overwritten: rewrite for epoch 8 before epoch 7's money
///      is out, and epoch 7's revenue pays epoch 8's publishers. A publisher
///      who joined this week is paid for last week's traffic; one who left is
///      paid nothing for work they did.
///
///      That is tolerable when the recipient set is static. Ours changes every
///      epoch by design — publishers join and leave continuously — so epoch
///      attribution is the requirement, not an optimisation.
///
///      ── WHY CUMULATIVE, NOT PER-EPOCH ──────────────────────────────────
///      A leaf holds total-earned-EVER, and a claim pays the difference against
///      what has already been paid out. Four consequences, all of which are the
///      reason to prefer it over a per-epoch tree:
///
///        - One claim sweeps every epoch. No list of epoch ids, no `batchClaim`
///          over periods, and skipping ten epochs costs the same gas as one.
///        - Missing an epoch can never forfeit anything.
///        - MISTAKES ARE CORRECTABLE. Publish a corrected root and the next
///          claim self-heals. Under a split, a wrong epoch is money permanently
///          gone to the wrong people.
///        - Storage is O(claimants), not O(claimants x epochs).
///
///      The history lives off chain: each `RootSet` carries a `uri` pointing at
///      that epoch's leaf file. "What did I earn in epoch 7" is roots 6 vs 7.
///      Without that pointer the roots would be unfalsifiable in practice,
///      which is why the event carries it and `setRoot` will not accept an
///      empty one.
///
///      ── HOW MUCH IS THERE TO SHARE OUT ─────────────────────────────────
///      The natural question when the money arrives through a split is "how
///      does the contract know this epoch's amount". It does not, and it must
///      not: an epoch delta is a fact about time, and a contract that tried to
///      measure it would need to know when an epoch began, trust that
///      `distribute()` ran exactly once inside it, and have no way to account
///      for a donation or a skipped run.
///
///      `unallocated()` answers the useful question instead — how much is held
///      that nobody is already owed:
///
///          unallocated = balance - (totalAllocated - totalClaimed)
///
///      That is self-correcting by construction. Integer-division dust rolls
///      into the next epoch, a skipped epoch is picked up by the next one, and
///      a direct transfer to this contract is simply distributed. The off-chain
///      job reads it, splits it by that epoch's shares, adds the result to each
///      publisher's running total, and publishes the new root.
///
///      ── WHAT IS ENFORCED IN SOLIDITY ───────────────────────────────────
///      Not the amounts — those are computed off chain and committed to by the
///      root. What IS enforced is SOLVENCY: `setRoot` refuses a root that
///      promises more than this contract can pay.
///
///          totalAllocated - totalClaimed <= balance
///
///      Without it, an over-allocated root is not caught anywhere: the first
///      claimants are paid in full and the last ones revert, so the failure
///      lands on whoever was slowest rather than on whoever was wrong. With it,
///      a root that does not add up cannot be published at all.
///
///      This is also what bounds the root setter. It can misallocate the
///      UNALLOCATED balance — one epoch's revenue — and it cannot touch a
///      single token already owed to somebody, because reducing another
///      account's cumulative below what they have drawn is a no-op (see
///      `claim`) and the invariant refuses to free up their share. A leaked
///      root-setter key costs one epoch, not the pot.
contract PublisherDistributor is AccessControl {
    using SafeERC20 for IERC20;

    /// @notice May publish a new root. Held by the epoch job's key.
    bytes32 public constant ROOT_SETTER_ROLE = keccak256("ROOT_SETTER_ROLE");

    /// @notice May roll back to the previous root, and nothing else.
    /// @dev Deliberately not "pause claims": pausing punishes publishers for a
    ///      mistake that is ours. Rollback removes the bad allocation while
    ///      leaving every honest outstanding claim payable.
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @notice The token publishers are paid in. USDC, in practice.
    IERC20 public immutable TOKEN;

    bytes32 public root;
    bytes32 public previousRoot;

    /// @notice Sum of every `cumulative` in the current root.
    uint256 public totalAllocated;
    uint256 public previousTotalAllocated;

    /// @notice Sum of everything ever paid out.
    uint256 public totalClaimed;

    uint256 public epoch;

    /// @notice Total ever paid to an account. A claim pays `cumulative - this`.
    mapping(address account => uint256 claimed) public claimed;

    event RootSet(uint256 indexed epoch, bytes32 root, uint256 totalAllocated, string uri);
    event RootRolledBack(uint256 indexed epoch, bytes32 restoredRoot);
    event Claimed(address indexed account, uint256 amount, uint256 cumulative);
    event Swept(address indexed to, uint256 amount);

    error BadProof();
    error NothingToClaim();
    error Insolvent(uint256 promised, uint256 held);
    error AllocationBelowClaimed(uint256 allocated, uint256 alreadyClaimed);
    error EmptyUri();
    error NoPreviousRoot();
    error ZeroAddress();
    error LengthMismatch();

    constructor(IERC20 token, address admin, address rootSetter) {
        if (address(token) == address(0) || admin == address(0)) revert ZeroAddress();
        TOKEN = token;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
        // May be zero at deploy: the API's signer is often created after the
        // contract exists. Granting it later is a normal admin action.
        if (rootSetter != address(0)) _grantRole(ROOT_SETTER_ROLE, rootSetter);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice What is owed but not yet drawn.
    function outstanding() public view returns (uint256) {
        // Cannot underflow while the invariant in `setRoot` holds; written
        // defensively anyway so a view never reverts and breaks a dashboard.
        uint256 allocated = totalAllocated;
        uint256 drawn = totalClaimed;
        return allocated > drawn ? allocated - drawn : 0;
    }

    /// @notice How much is held that nobody is owed — the next epoch's pot.
    /// @dev THIS is what the off-chain job reads to decide what to share out.
    ///      See the note on the contract about why it is not an epoch delta.
    function unallocated() public view returns (uint256) {
        uint256 balance = TOKEN.balanceOf(address(this));
        uint256 owed = outstanding();
        return balance > owed ? balance - owed : 0;
    }

    /// @notice What `account` could draw right now, given a cumulative figure.
    /// @dev A view for the UI. It does NOT check the proof — the caller
    ///      supplies a `cumulative` they read from the published leaf file, and
    ///      `claim` is where that number has to survive the root.
    function claimableAgainst(address account, uint256 cumulative) external view returns (uint256) {
        uint256 already = claimed[account];
        return cumulative > already ? cumulative - already : 0;
    }

    /// @notice The leaf for an entry, so off-chain tooling cannot disagree
    ///         with the contract about how one is built.
    /// @dev Double-hashed: an OpenZeppelin convention that makes it impossible
    ///      to present a leaf where an internal node is expected, since internal
    ///      nodes are single-hashed and the two spaces cannot collide.
    function leafOf(address account, uint256 cumulative) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(account, cumulative))));
    }

    // ═══════════════════════════════════════════════════════════
    // CLAIMING
    // ═══════════════════════════════════════════════════════════

    /// @notice Draw everything owed to `account` under the current root.
    ///
    /// @dev Permissionless, and `account` is a parameter rather than
    ///      `msg.sender`, because the funds always go to `account` — so there
    ///      is nothing to gain by calling it for somebody else, and something
    ///      to gain by allowing it: we can run a sweeper that pays the gas for
    ///      publishers who never come and claim. An unclaimed balance and never
    ///      having been paid look identical from outside, and only one of them
    ///      is our fault.
    function claim(address account, uint256 cumulative, bytes32[] calldata proof)
        public
        returns (uint256 amount)
    {
        if (!MerkleProof.verifyCalldata(proof, root, leafOf(account, cumulative))) {
            revert BadProof();
        }

        uint256 already = claimed[account];
        // A downward correction is a no-op rather than an underflow. We can
        // stop somebody accruing further; we cannot claw back what they drew.
        if (cumulative <= already) revert NothingToClaim();

        amount = cumulative - already;
        // Assignment, not `+=`. This is what makes a republished root
        // idempotent: claiming twice against the same leaf is a no-op, and a
        // corrected root converges rather than compounding.
        claimed[account] = cumulative;
        totalClaimed += amount;

        TOKEN.safeTransfer(account, amount);
        emit Claimed(account, amount, cumulative);
    }

    /// @notice `claim` for many accounts, for the courtesy sweeper.
    /// @dev Skips anything already drawn instead of reverting, so one
    ///      up-to-date publisher cannot fail the whole batch.
    function claimMany(
        address[] calldata accounts,
        uint256[] calldata cumulatives,
        bytes32[][] calldata proofs
    ) external returns (uint256 total) {
        if (accounts.length != cumulatives.length || accounts.length != proofs.length) {
            revert LengthMismatch();
        }
        for (uint256 i; i < accounts.length; ++i) {
            if (cumulatives[i] <= claimed[accounts[i]]) continue;
            total += claim(accounts[i], cumulatives[i], proofs[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ROOTS
    // ═══════════════════════════════════════════════════════════

    /// @notice Publish an epoch's allocations.
    /// @param newRoot Merkle root over `leafOf(account, cumulative)` entries.
    /// @param newTotalAllocated Sum of every `cumulative` in the tree.
    /// @param uri Where the leaf file for this epoch can be read.
    function setRoot(bytes32 newRoot, uint256 newTotalAllocated, string calldata uri)
        external
        onlyRole(ROOT_SETTER_ROLE)
    {
        // Without a pointer to the leaves the root is a number nobody can
        // check. Refusing an empty one keeps the audit trail complete by
        // construction rather than by discipline.
        if (bytes(uri).length == 0) revert EmptyUri();

        uint256 drawn = totalClaimed;
        // A root that allocates less than has already been paid out is not a
        // correction, it is an accounting error: the difference has no meaning.
        if (newTotalAllocated < drawn) {
            revert AllocationBelowClaimed(newTotalAllocated, drawn);
        }

        // THE INVARIANT. See the contract note: it is what stops an
        // over-allocated root paying the fast and reverting on the slow, and
        // what bounds a compromised root setter to the unallocated balance.
        uint256 promised = newTotalAllocated - drawn;
        uint256 held = TOKEN.balanceOf(address(this));
        if (promised > held) revert Insolvent(promised, held);

        previousRoot = root;
        previousTotalAllocated = totalAllocated;

        root = newRoot;
        totalAllocated = newTotalAllocated;

        emit RootSet(++epoch, newRoot, newTotalAllocated, uri);
    }

    /// @notice Undo the most recent `setRoot`.
    /// @dev The emergency power, and a narrow one. It cannot recover anything
    ///      already claimed under the bad root — that is inherent, and the
    ///      reason to put a timelock in front of `setRoot` once the amounts
    ///      justify one. Rolling back twice is not supported: there is one step
    ///      of history, deliberately, so this cannot be used to walk the
    ///      contract back to an arbitrary past state.
    function rollBackRoot() external onlyRole(GUARDIAN_ROLE) {
        if (previousRoot == bytes32(0) && previousTotalAllocated == 0) {
            revert NoPreviousRoot();
        }
        // Anything drawn under the bad root stays drawn, so the restored
        // allocation can sit below `totalClaimed`. Clamp rather than revert:
        // refusing to roll back because the mistake was already partly drawn
        // would disable the tool exactly when it is needed.
        uint256 restored = previousTotalAllocated;
        uint256 drawn = totalClaimed;

        root = previousRoot;
        totalAllocated = restored > drawn ? restored : drawn;

        previousRoot = bytes32(0);
        previousTotalAllocated = 0;

        emit RootRolledBack(epoch, root);
    }

    // ═══════════════════════════════════════════════════════════
    // SWEEP
    // ═══════════════════════════════════════════════════════════

    /// @notice Recover tokens that nobody is owed.
    /// @dev Bounded by `unallocated()`, so this can never take a publisher's
    ///      outstanding claim — the admin is trusted to run the programme, not
    ///      to hold everyone's balance. Use for a wind-down, for dust left by
    ///      publishers who never claimed, or for a token sent here by mistake.
    function sweep(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        uint256 free = unallocated();
        if (amount > free) revert Insolvent(amount, free);
        TOKEN.safeTransfer(to, amount);
        emit Swept(to, amount);
    }

    /// @notice Recover a token that is not the payout token, in full.
    /// @dev Separate from `sweep` because `unallocated()` is denominated in
    ///      `TOKEN`; applying it to an unrelated token would be meaningless.
    function sweepForeign(IERC20 token, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == TOKEN) revert Insolvent(0, 0);
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, token.balanceOf(address(this)));
    }
}
