// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * @title SetSlotFactory
 * @notice Point this chain's AdLand hook at this chain's slot factory.
 *
 * @dev A freshly deployed AdLand has `slotFactory == address(0)`, and
 *      `createAdSlot` reverts `NoFactory()` — selector `0x14042392` — until
 *      somebody sets it. Nothing reports that state: the hook deploys, records
 *      itself, resolves keys, serves creatives, and the only symptom is that
 *      creating a space fails for everyone with a bare custom error. The app
 *      cannot fix it and neither can the person hitting it; it is one owner
 *      call, and this is that call.
 *
 *      ── Why a script and not a `cast send` ──────────────────────────────
 *
 *      The factory address is per chain, and the failure mode of typing it is
 *      not a revert. `setSlotFactory` takes any address: pass the wrong one
 *      and creation keeps working, keeps emitting `AdSlotCreated`, and keeps
 *      producing slots — from another chain's factory, or from the PREVIOUS
 *      generation's, whose deployments the current indexer starts too late to
 *      see. An ad space that renders but appears in no list is the failure
 *      {CreatePrimaryAdSlot} exists to prevent, and this is where it starts.
 *
 *      So the address is read from `deployments/<chainid>/SlotFactory.json`
 *      rather than passed in, which makes "the correct factory for this chain"
 *      a fact about the repository instead of a thing the operator remembers
 *      per RPC. Sweeping every live chain is running the same command once per
 *      RPC with nothing else changed.
 *
 *      ── Compared, not null-checked ──────────────────────────────────────
 *
 *      A hook whose factory is merely SET is not a hook that is correct. The
 *      dangerous state is non-zero and stale, because it works. So this reads
 *      the current value, compares it against the record, and says which of
 *      the three cases it found — unset, stale, or already right — before it
 *      sends anything. An already-correct chain sends no transaction at all,
 *      which is what makes running this across every chain safe to repeat.
 *
 *      ── Run ─────────────────────────────────────────────────────────────
 *
 *      Read-only across every chain first, one RPC at a time, no key needed:
 *
 *        forge script script/protocol/SetSlotFactory.s.sol:SetSlotFactory \
 *          --sig 'check()' --rpc-url $RPC
 *
 *      Then, per chain that needs it:
 *
 *        forge script script/protocol/SetSlotFactory.s.sol:SetSlotFactory \
 *          --rpc-url $RPC --broadcast --private-key $PK
 */
contract SetSlotFactory is ProtocolConfig {
    error NoAdLandOnThisChain(uint256 chainId);
    error NoSlotFactoryOnThisChain(uint256 chainId);
    error FactoryHasNoCode(address factory);
    error NotAFactory(address factory);
    error NotOwner(address owner, address caller);

    /// @dev Reported by both entry points so a dry run and a broadcast print
    ///      the same four lines and differ only in what happens after them.
    struct State {
        address adLand;
        address owner;
        address recorded;
        address current;
    }

    function _read() internal view returns (State memory s) {
        s.adLand = deployed("AdLand");
        if (s.adLand == address(0)) revert NoAdLandOnThisChain(block.chainid);

        s.recorded = deployed("SlotFactory");
        if (s.recorded == address(0)) {
            revert NoSlotFactoryOnThisChain(block.chainid);
        }

        s.owner = AdLand(s.adLand).owner();
        s.current = AdLand(s.adLand).slotFactory();
    }

    /**
     * @dev The record names an address; it does not prove there is a factory
     *      at it. A record written by a dry run, or copied from another chain,
     *      points at nothing or at something else — and `setSlotFactory`
     *      accepts both. `implementation()` is the cheapest question only a
     *      SlotFactory answers, so it is asked before the address is enshrined
     *      as the thing every future slot is created by.
     *
     *      Staticcall rather than a typed call: an address that is not a
     *      factory reverts with nothing in it, and a typed call turns that
     *      into an `EvmError` and a stack trace instead of a named error.
     */
    function _assertIsFactory(address factory) internal view {
        if (factory.code.length == 0) revert FactoryHasNoCode(factory);

        (bool ok, bytes memory ret) = factory.staticcall(
            abi.encodeWithSignature("implementation()")
        );
        if (!ok || ret.length != 32) revert NotAFactory(factory);
    }

    function _report(State memory s) internal view {
        console2.log("chain            ", block.chainid);
        console2.log("AdLand           ", s.adLand);
        console2.log("owner            ", s.owner);
        console2.log("factory (hook)   ", s.current);
        console2.log("factory (record) ", s.recorded);
    }

    /**
     * @notice Say what this chain's hook points at, and send nothing.
     * @dev Its own entry point rather than a `DRY_RUN` flag, because forge runs
     *      the body either way and `--broadcast` decides only whether the
     *      transactions are sent — a reader sweeping six chains should not have
     *      to trust that they remembered to leave a flag off.
     */
    function check() external view {
        State memory s = _read();
        _report(s);

        if (s.current == s.recorded) {
            console2.log("state             correct");
        } else if (s.current == address(0)) {
            console2.log("state             UNSET - createAdSlot reverts NoFactory()");
        } else {
            console2.log("state             STALE - creates slots the indexer never sees");
        }
    }

    function run() external {
        State memory s = _read();
        _report(s);

        // Nothing to do is the expected outcome on most chains once this has
        // been swept, so it is a clean exit rather than a revert: a sweep that
        // fails on the chains that are already right is a sweep nobody runs
        // twice.
        if (s.current == s.recorded) {
            console2.log("state             correct - nothing to send");
            return;
        }

        _assertIsFactory(s.recorded);

        // Checked before broadcasting. `setSlotFactory` is `onlyOwner`, and a
        // run that discovers this from a reverted transaction has spent gas to
        // learn which key it was holding.
        if (s.owner != msg.sender) revert NotOwner(s.owner, msg.sender);

        console2.log("setSlotFactory ->", s.recorded);

        vm.startBroadcast();
        AdLand(s.adLand).setSlotFactory(s.recorded);
        vm.stopBroadcast();

        console2.log("factory is now   ", AdLand(s.adLand).slotFactory());

        // The next step, said here because it is invisible from the receipt:
        // a hook that can create slots still has no primary until one is made,
        // and the embed resolves `primary` for every publisher who pasted no
        // address.
        if (AdLand(s.adLand).primary() == address(0)) {
            console2.log("next              CreatePrimaryAdSlot (primary is unset)");
        }
    }
}
