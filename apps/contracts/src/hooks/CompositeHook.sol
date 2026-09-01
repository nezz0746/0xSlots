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
    address public immutable owner;

    address[] public children;
    HookFlags public declared;

    uint256 public constant MAX_CHILDREN = 8;

    /// @dev Headroom left for this contract's own loop and return.
    uint256 internal constant GAS_FLOOR = 10_000;

    /// @dev Per-child stipend for `after` callbacks, derived from the budget
    ///      rather than guessed.
    ///
    ///      It was a flat 100_000 against `MAX_CHILDREN = 8`, promising 800k
    ///      out of the 500k the slot actually forwards. The failure was not
    ///      "the last few children are starved": the composite's own frame ran
    ///      out, so every child that had already succeeded was rolled back
    ///      too, and the slot swallowed it as one `HookCallFailed`. A lenient
    ///      fan-out that drops all of its children is the exact failure it
    ///      exists to prevent.
    uint256 public constant CHILD_GAS = HOOK_GAS / MAX_CHILDREN;

    error NotOwner();
    error TooManyChildren();
    error ChildHasNoCode();

    event ChildAdded(address indexed child);


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
    // The slot snapshots `hooks()` once so a hook cannot widen its reach under
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
    function hooks() external view returns (HookFlags memory) {
        return declared;
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

    function _all(bytes memory call) internal view {
        uint256 n = children.length;
        for (uint256 i; i < n; ++i) {
            (bool ok, bytes memory err) = children[i].staticcall(call);
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
            if (gasleft() < CHILD_GAS + GAS_FLOOR) return;
            children[i].call{gas: CHILD_GAS}(call);
        }
    }
}
