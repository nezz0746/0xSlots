// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook, HookFlags, SlotContext} from "../ISlotHook.sol";

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
contract CompositeHook is ISlotHook {
    address public immutable owner;

    address[] public children;
    HookFlags public declared;

    /// @dev Per-child stipend for `after` callbacks. The slot gives this whole
    ///      contract 500k; spending it all on the first child would be a
    ///      denial of service on the rest.
    uint256 public constant CHILD_GAS = 100_000;

    error NotOwner();
    error TooManyChildren();

    event ChildAdded(address indexed child);

    uint256 public constant MAX_CHILDREN = 8;

    constructor(address owner_, address[] memory initial, HookFlags memory flags) {
        owner = owner_;
        declared = flags;
        for (uint256 i; i < initial.length; ++i) {
            children.push(initial[i]);
        }
        if (children.length > MAX_CHILDREN) revert TooManyChildren();
    }

    function add(address child) external {
        if (msg.sender != owner) revert NotOwner();
        if (children.length >= MAX_CHILDREN) revert TooManyChildren();
        children.push(child);
        emit ChildAdded(child);
    }

    function childCount() external view returns (uint256) {
        return children.length;
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
            children[i].call{gas: CHILD_GAS}(call);
        }
    }
}
