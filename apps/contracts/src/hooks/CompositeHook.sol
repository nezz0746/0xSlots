// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook, HookFlags, SlotContext} from "../ISlotHook.sol";
import {IDescribedHook, HookDescriptor} from "../IDescribedHook.sol";
import {SlotConstants} from "../SlotConstants.sol";

/**
 * @title CompositeHook
 * @notice Several hooks behind one address.
 *
 * @dev ── Why the fan-out lives HERE and not in the slot ──────────────────
 *
 *      An earlier design kept a list of modules in the slot and looped it on
 *      every occupancy change — including inside `liquidate()`. That put a loop
 *      over untrusted addresses in the one function the protocol promises is
 *      unconditional.
 *
 *      Moving it here changes the blast radius completely. The slot makes ONE
 *      capped, swallowed call, and that single cap bounds this entire subtree.
 *      A composite that is slow, broken or hostile harms only the slot that
 *      chose it, and can never reach an eviction.
 *
 *      ── Failure inside the composite ────────────────────────────────────
 *
 *      `before` fans out strictly: any child that reverts vetoes the action.
 *      That is what composing decisions means — this is `AllOf`, and a child
 *      wanting `OneOf` semantics composes that itself.
 *
 *      `after` fans out leniently: a child that reverts is skipped and the
 *      others still run, mirroring how the slot treats this contract. Without
 *      it, one broken observer would silence every other one.
 */
contract CompositeHook is ISlotHook, IDescribedHook, SlotConstants {
    /// @notice Who deployed this composite. Provenance, and nothing more.
    ///
    /// @dev It confers NO powers. `add()` was deliberately removed — the child
    ///      set is snapshotted by the slot when it attaches, so a composite
    ///      that could grow would be a hook widening its own reach mid-tenure
    ///      — and `NotOwner` went with it. What survives is a public record of
    ///      who assembled this tree, for a reader deciding whether to trust it.
    ///
    ///      Named `owner` rather than `deployer` only because that is what the
    ///      ecosystem reads. Nothing here is gated on it, so do not read a
    ///      public `owner()` on a hook as authority.
    address public immutable owner;

    address[] public children;
    HookFlags public declared;

    uint256 public constant MAX_CHILDREN = 8;

    /// @dev Headroom left for this contract's own loop and return.
    uint256 internal constant GAS_FLOOR = 10_000;

    /// @dev Nominal per-child stipend, quoted for clients sizing a call.
    ///
    ///      It was a flat 100_000 against `MAX_CHILDREN = 8`, promising 800k
    ///      out of the 500k the slot actually forwards. The failure was not
    ///      "the last few children are starved": the composite's own frame ran
    ///      out, so every child that had already succeeded was rolled back
    ///      too, and the slot swallowed it as one `HookCallFailed`. A lenient
    ///      fan-out that drops all of its children is the exact failure it
    ///      exists to prevent.
    ///
    ///      NOT what `_each` actually forwards — see `_share`. A constant
    ///      cannot be right here, because the budget this contract is called
    ///      with is not a constant.
    uint256 public constant CHILD_GAS = HOOK_GAS / MAX_CHILDREN;

    error TooManyChildren();
    error ChildHasNoCode();

    /// @notice A child callback failed and was skipped.
    /// @dev The composite's counterpart to the slot's `HookCallFailed`. Only
    ///      ever emitted on the `after` side: a failing `before` reverts the
    ///      whole fan-out and never reaches here.
    event ChildCallFailed(address indexed child, bytes4 selector);


    /// @notice Identifies this as a composite. See `IDescribedHook`.
    bytes32 public constant FAMILY = keccak256("slots.hook.composite");

    /// @notice The encoding of `descriptors()[0].data`, and nothing else.
    uint32 public constant DESCRIPTOR_VERSION = 1;

    /// @notice Where the human half lives. May be empty.
    string public metadataURI;

    constructor(
        address owner_,
        address[] memory initial,
        HookFlags memory flags,
        string memory metadataURI_
    ) {
        owner = owner_;
        metadataURI = metadataURI_;
        declared = flags;
        for (uint256 i; i < initial.length; ++i) {
            // A staticcall to an address with no code SUCCEEDS with empty
            // returndata, and `_all` reads success as assent — so a codeless
            // child is a veto that always approves. The slot refuses a hook
            // that cannot answer; a composite must refuse one too, or it
            // launders exactly what the slot rejected.
            if (initial[i].code.length == 0) revert ChildHasNoCode();
            children.push(initial[i]);
        }
        if (children.length > MAX_CHILDREN) revert TooManyChildren();
    }

    // `add` is deliberately gone.
    //
    // The slot snapshots `subscriptions()` once so a hook cannot widen its reach under
    // a sitting occupant. `add` walked around that: the flags stayed as
    // snapshotted while what ran behind them changed, letting this contract's
    // owner — a third party to the slot — install a veto mid-tenure on every
    // slot pointing here. The veto then blocked `buy`, which is the transition
    // the manager needs in order to detach the composite, so it could not even
    // be undone.
    //
    // The child set is the configuration, so it belongs in the address, the
    // way `MinimumTenureHook`'s duration does. Changing it means deploying a
    // new composite and proposing it — which is deferred, visible, and
    // refusable.

    function childCount() external view returns (uint256) {
        return children.length;
    }

    /**
     * @notice What this hook claims to be.
     *
     * @dev version 1 — `data` is `abi.encode(address[] children)`.
     *
     *      Returns ONLY its own descriptor. A consumer that wants the whole
     *      tree walks `children` and calls `descriptors()` on each, which
     *      preserves the shape: flattening every child's descriptor into this
     *      array would report a composite of two hooks identically to a slot
     *      wearing two hooks directly, and those are not the same thing. It
     *      also keeps this array bounded by `MAX_CHILDREN` rather than by the
     *      sum of whatever an untrusted subtree decides to return.
     *
     *      Recursion is the consumer's to bound. Nothing here prevents a cycle
     *      — a composite may name another composite, and could in principle
     *      name one that names it back — so a client must cap depth and track
     *      what it has visited.
     */
    function descriptors()
        external
        view
        returns (HookDescriptor[] memory result)
    {
        result = new HookDescriptor[](1);
        result[0] = HookDescriptor({
            family: FAMILY,
            version: DESCRIPTOR_VERSION,
            data: abi.encode(children),
            metadataURI: metadataURI
        });
    }

    /// @dev The union its children need, declared at construction. Not derived
    ///      from them: a child added later must not silently widen what the
    ///      slot snapshotted when this was attached.
    function subscriptions() external view returns (HookFlags memory) {
        return declared;
    }

    /// @dev Fanned out strictly, like a `before`: one word reaches every child
    ///      verbatim, so every child has to accept it. A composite has one
    ///      `hookData` and no way to split it, which means at most one of its
    ///      children may take configuration — the rest must be indifferent to
    ///      it. Asking them all is how that constraint gets checked instead of
    ///      assumed.
    function validateHookData(bytes32 data) external view {
        _all(abi.encodeCall(ISlotHook.validateHookData, (data)));
    }

    // ─── decisions: strict. any veto is the composite's veto ────────────────

    function beforeBuy(SlotContext calldata ctx) external view {
        _all(abi.encodeCall(ISlotHook.beforeBuy, (ctx)));
    }

    function beforeSell(SlotContext calldata ctx) external view {
        _all(abi.encodeCall(ISlotHook.beforeSell, (ctx)));
    }

    function beforeSelfAssess(SlotContext calldata ctx) external view {
        _all(abi.encodeCall(ISlotHook.beforeSelfAssess, (ctx)));
    }

    // ─── effects: lenient. one broken child must not silence the rest ───────

    function afterBuy(SlotContext calldata ctx) external {
        _each(abi.encodeCall(ISlotHook.afterBuy, (ctx)));
    }

    function afterSell(SlotContext calldata ctx) external {
        _each(abi.encodeCall(ISlotHook.afterSell, (ctx)));
    }

    function afterRelease(SlotContext calldata ctx) external {
        _each(abi.encodeCall(ISlotHook.afterRelease, (ctx)));
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        _each(abi.encodeCall(ISlotHook.afterLiquidate, (ctx)));
    }

    function afterSettle(SlotContext calldata ctx) external {
        _each(abi.encodeCall(ISlotHook.afterSettle, (ctx)));
    }

    /**
     * @dev What the next child may spend: an equal share of what is LEFT.
     *
     *      Recomputed every iteration, for two reasons.
     *
     *      It fixes a bug a constant guaranteed. The stipend was
     *      `CHILD_GAS = HOOK_GAS / MAX_CHILDREN`, so a NESTED composite —
     *      entered with one child's share rather than the slot's full one —
     *      met `gasleft() < CHILD_GAS + GAS_FLOOR` on its very first iteration
     *      and returned. Not a tight margin: arithmetic. Its entire subtree
     *      received no `after` callbacks, ever, and because the inner call
     *      SUCCEEDED nothing emitted `HookCallFailed`. Silent.
     *
     *      And it is self-correcting. A child that under-spends leaves more for
     *      the rest instead of stranding it, and there is no boundary case on
     *      the last child — dividing by the number REMAINING keeps the last one
     *      funded exactly as well as the first.
     *
     *      Returns 0 when the frame is down to its own headroom, which the
     *      callers read as "stop".
     */
    function _shareOf(uint256 remaining) internal view returns (uint256) {
        uint256 budget = gasleft();
        if (budget <= GAS_FLOOR) return 0;
        unchecked {
            return (budget - GAS_FLOOR) / remaining;
        }
    }

    /// @dev Strict: any child's revert is the composite's revert. Capped per
    ///      child even so — `_all` is reachable from `validateHookData`, which
    ///      `_applyPending` calls inside `liquidate()`, and an uncapped
    ///      fan-out there hands an untrusted subtree the whole eviction frame.
    ///      A child that runs out under its share reverts, which is a veto and
    ///      is what strict means; the cap only bounds what it costs to say so.
    function _all(bytes memory call) internal view {
        uint256 n = children.length;
        for (uint256 i; i < n; ++i) {
            uint256 share = _shareOf(n - i);
            if (share == 0) return;
            (bool ok, bytes memory err) = children[i].staticcall{gas: share}(
                call
            );
            if (ok) continue;
            assembly {
                revert(add(err, 0x20), mload(err))
            }
        }
    }

    function _each(bytes memory call) internal {
        uint256 n = children.length;
        for (uint256 i; i < n; ++i) {
            // Stop rather than continue into a frame too small to run in.
            // `call{gas: X}` only CAPS the forward — once the budget is spent
            // the remaining children are called with almost nothing, fail, and
            // (worse) the composite's own frame can die and roll back every
            // child that already succeeded. Returning cleanly keeps the ones
            // that ran.
            uint256 share = _shareOf(n - i);
            if (share == 0) return;
            (bool ok, ) = children[i].call{gas: share}(call);
            // Say so. The slot emits `HookCallFailed` for exactly this and the
            // composite was the one layer that swallowed a failure in silence.
            if (!ok) emit ChildCallFailed(children[i], bytes4(call));
        }
    }
}
