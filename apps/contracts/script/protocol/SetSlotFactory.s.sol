// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * @title SetSlotFactory
 * @notice Point every configured chain's AdLand hook at that chain's own slot
 *         factory, in one run.
 *
 * @dev A freshly deployed AdLand has `slotFactory == address(0)`, and
 *      `createAdSlot` reverts `NoFactory()` — selector `0x14042392` — until
 *      somebody sets it. Nothing reports that state: the hook deploys, records
 *      itself, resolves keys, serves creatives, and the only symptom is that
 *      creating a space fails for everyone with a bare custom error. The app
 *      cannot fix it and neither can the person hitting it; it is one owner
 *      call per chain, and this is that call, on all of them.
 *
 *      ── Why the whole estate and not one RPC ────────────────────────────
 *
 *      This condition arrives on every chain at once, because it is a property
 *      of deploying rather than of any chain — so a per-RPC command means
 *      remembering how many chains exist and noticing the day that number
 *      changes. The chain list is `deployments/config/*.json`, which is the
 *      same list the deploy scripts work from: adding a chain is adding a file
 *      there, and this picks it up without being edited.
 *
 *      ── Why the factory is never an argument ────────────────────────────
 *
 *      The failure mode of typing it is not a revert. `setSlotFactory` takes
 *      any address: pass the wrong one and creation keeps working, keeps
 *      emitting `AdSlotCreated`, and keeps producing slots — from another
 *      chain's factory, or from the PREVIOUS generation's, whose deployments
 *      the current indexer starts too late to see. An ad space that renders but
 *      appears in no list is the failure {CreatePrimaryAdSlot} exists to
 *      prevent, and this is where it starts. Each chain's factory comes from
 *      its own `deployments/<chainid>/SlotFactory.json`, read after the fork is
 *      selected, so "the right factory for this chain" is a fact about the
 *      repository rather than something an operator holds in their head while
 *      cycling through six terminals.
 *
 *      ── Compared, not null-checked ──────────────────────────────────────
 *
 *      A hook whose factory is merely SET is not a hook that is correct. The
 *      dangerous state is non-zero and stale, because it works. So each chain
 *      is reported as one of three things — unset, stale, or already right —
 *      before anything is sent, and a chain that is already right sends no
 *      transaction. That is what makes the sweep safe to repeat, which matters
 *      because a sweep you have to reason about before each run is one that
 *      gets run once.
 *
 *      ── Run ─────────────────────────────────────────────────────────────
 *
 *      Read-only over every chain. No key, no `--rpc-url`, no `--broadcast`:
 *
 *        forge script script/protocol/SetSlotFactory.s.sol:SetSlotFactory \
 *          --sig 'check()'
 *
 *      Then fix them, still in one run. `PRIVATE_KEY` is read by the script
 *      rather than passed as `--private-key`, because forge binds a CLI key to
 *      one chain and this broadcasts to several:
 *
 *        PRIVATE_KEY=0x… forge script \
 *          script/protocol/SetSlotFactory.s.sol:SetSlotFactory --broadcast
 *
 *      `ONLY_CHAIN=8453` narrows either command to one chain.
 */
contract SetSlotFactory is ProtocolConfig {
    using stdJson for string;

    error NoChainsConfigured();
    error NoPrivateKey();
    error FactoryHasNoCode(uint256 chainId, address factory);
    error NotAFactory(uint256 chainId, address factory);
    error NotOwner(uint256 chainId, address owner, address caller);

    /**
     * One chain's answer, gathered on its fork and reported off it.
     *
     * Not `Chain` — forge-std's `StdChains` already declares that name and
     * `Script` inherits it, so the obvious name is the one that will not
     * compile.
     */
    struct ChainState {
        uint256 chainId;
        string name;
        string rpc;
        address adLand;
        address owner;
        address recorded;
        address current;
        /// False when the chain has no reachable RPC or no AdLand of ours.
        bool inspected;
        string skipped;
    }

    // ── the chain list ────────────────────────────────────────────────────

    /**
     * @dev `deployments/config` is the chain list because it already is one —
     *      `chainConfig()` reads a file from it per chain, and the deploy
     *      scripts treat a missing file as "we are not on that chain". Reading
     *      the directory rather than a hardcoded array means this script has no
     *      opinion about how many chains exist, which is the only version of it
     *      that stays correct.
     */
    function _configPaths() internal view returns (string[] memory paths) {
        VmSafe.DirEntry[] memory entries = vm.readDir(
            string.concat(vm.projectRoot(), "/deployments/config")
        );

        paths = new string[](entries.length);
        uint256 n;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].isDir) continue;
            // The directory holds a README as well, and a filename is the only
            // thing distinguishing it from a chain.
            if (!_endsWith(entries[i].path, ".json")) continue;
            paths[n++] = entries[i].path;
        }

        assembly {
            mstore(paths, n)
        }
        if (n == 0) revert NoChainsConfigured();
    }

    function _endsWith(
        string memory value,
        string memory suffix
    ) private pure returns (bool) {
        bytes memory v = bytes(value);
        bytes memory s = bytes(suffix);
        if (v.length < s.length) return false;
        for (uint256 i; i < s.length; ++i) {
            if (v[v.length - s.length + i] != s[i]) return false;
        }
        return true;
    }

    /**
     * @dev Three places an RPC can come from, in the order of how specific
     *      they are to the operator: the env var the config names, then the
     *      public URL the config carries, then the foundry.toml alias.
     *
     *      An empty answer is a SKIP and never an error. The local anvil config
     *      names an env var and carries no URL, so an operator who is not
     *      running a node skips 31337 by doing nothing — which is the right
     *      default for a command whose whole point is the live chains.
     */
    function _rpcFor(string memory json) internal view returns (string memory) {
        if (vm.keyExistsJson(json, ".rpcEnv")) {
            string memory fromEnv = vm.envOr(json.readString(".rpcEnv"), string(""));
            if (bytes(fromEnv).length > 0) return fromEnv;
        }
        if (vm.keyExistsJson(json, ".rpcUrl")) {
            string memory fromJson = json.readString(".rpcUrl");
            if (bytes(fromJson).length > 0) return fromJson;
        }
        // `rpcUrl` reverts when the alias is unknown, so it is only reached for
        // a name foundry.toml actually declares.
        string memory name = json.readString(".name");
        try vm.rpcUrl(name) returns (string memory alias_) {
            return alias_;
        } catch {
            return "";
        }
    }

    /**
     * @dev Forks each chain in turn and reads it. `deployed()` keys off
     *      `block.chainid`, which `createSelectFork` changes, so the records
     *      read here are that chain's own without anything being passed down.
     */
    function _survey() internal returns (ChainState[] memory chains) {
        string[] memory paths = _configPaths();
        uint256 only = vm.envOr("ONLY_CHAIN", uint256(0));

        chains = new ChainState[](paths.length);
        uint256 n;

        for (uint256 i; i < paths.length; ++i) {
            string memory json = vm.readFile(paths[i]);

            ChainState memory c;
            c.chainId = json.readUint(".chainId");
            c.name = json.readString(".name");

            if (only != 0 && c.chainId != only) continue;

            c.rpc = _rpcFor(json);
            if (bytes(c.rpc).length == 0) {
                c.skipped = "no RPC configured";
                chains[n++] = c;
                continue;
            }

            vm.createSelectFork(c.rpc);

            c.adLand = deployed("AdLand");
            if (c.adLand == address(0)) {
                // Not an error. A chain can be configured and carry records
                // from the retired protocol without this one ever having
                // deployed to it — `deployed()` returns zero for exactly that,
                // and sweeping it would be sweeping somebody else's contract.
                c.skipped = "no AdLand from this protocol";
                chains[n++] = c;
                continue;
            }

            c.recorded = deployed("SlotFactory");
            if (c.recorded == address(0)) {
                c.skipped = "no SlotFactory recorded";
                chains[n++] = c;
                continue;
            }

            c.owner = AdLand(c.adLand).owner();
            c.current = AdLand(c.adLand).slotFactory();
            c.inspected = true;
            chains[n++] = c;
        }

        assembly {
            mstore(chains, n)
        }
    }

    function _state(ChainState memory c) internal pure returns (string memory) {
        if (!c.inspected) return c.skipped;
        if (c.current == c.recorded) return "correct";
        if (c.current == address(0)) {
            return "UNSET - createAdSlot reverts NoFactory()";
        }
        return "STALE - creates slots the indexer never sees";
    }

    function _report(ChainState memory c) internal pure {
        console2.log("");
        console2.log(
            string.concat("== ", c.name, " (", vm.toString(c.chainId), ")")
        );
        if (!c.inspected) {
            console2.log("   skipped        ", c.skipped);
            return;
        }
        console2.log("   AdLand          ", c.adLand);
        console2.log("   owner           ", c.owner);
        console2.log("   factory (hook)  ", c.current);
        console2.log("   factory (record)", c.recorded);
        console2.log("   state           ", _state(c));
    }

    // ── entry points ──────────────────────────────────────────────────────

    /**
     * @notice Say what every chain's hook points at, and send nothing.
     * @dev Its own entry point rather than a `DRY_RUN` flag, because forge runs
     *      the body either way and `--broadcast` decides only whether the
     *      transactions are sent — a reader looking at six chains should not
     *      have to trust that they remembered to leave a flag off.
     */
    function check() external {
        ChainState[] memory chains = _survey();
        for (uint256 i; i < chains.length; ++i) _report(chains[i]);

        console2.log("");
        uint256 pending;
        for (uint256 i; i < chains.length; ++i) {
            if (chains[i].inspected && chains[i].current != chains[i].recorded) {
                ++pending;
            }
        }
        console2.log("chains needing a fix:", pending);
    }

    function run() external {
        ChainState[] memory chains = _survey();

        // Read before any fork work so a missing key fails immediately rather
        // than after six RPC round trips.
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk == 0) revert NoPrivateKey();
        address sender = vm.addr(pk);

        uint256 sent;
        for (uint256 i; i < chains.length; ++i) {
            ChainState memory c = chains[i];
            _report(c);

            if (!c.inspected) continue;

            // Nothing to do is the expected outcome on most chains once this
            // has been swept, so it is a clean skip rather than a revert: a
            // sweep that fails on the chains that are already right is a sweep
            // nobody runs twice.
            if (c.current == c.recorded) continue;

            // Re-selected because the survey left the fork on the LAST chain
            // it looked at. Without this every broadcast below would go to that
            // one chain — with the right factory address for a different one.
            vm.createSelectFork(c.rpc);

            _assertIsFactory(c.chainId, c.recorded);

            // Checked before broadcasting. `setSlotFactory` is `onlyOwner`, and
            // a run that discovers this from a reverted transaction has spent
            // gas to learn which key it was holding — once per chain.
            if (c.owner != sender) {
                revert NotOwner(c.chainId, c.owner, sender);
            }

            console2.log("   setSlotFactory ->", c.recorded);

            vm.startBroadcast(pk);
            AdLand(c.adLand).setSlotFactory(c.recorded);
            vm.stopBroadcast();

            console2.log("   factory is now  ", AdLand(c.adLand).slotFactory());
            ++sent;

            // The next step, said here because it is invisible from the
            // receipt: a hook that can create slots still has no primary until
            // one is made, and the embed resolves `primary` for every publisher
            // who pasted no address.
            if (AdLand(c.adLand).primary() == address(0)) {
                console2.log("   next             CreatePrimaryAdSlot (primary is unset)");
            }
        }

        console2.log("");
        console2.log("chains updated:", sent);
    }

    /**
     * @dev The record names an address; it does not prove there is a factory at
     *      it. A record written by a dry run, or copied from another chain,
     *      points at nothing or at something else — and `setSlotFactory`
     *      accepts both. `implementation()` is the cheapest question only a
     *      SlotFactory answers, so it is asked before the address is enshrined
     *      as the thing every future slot on this chain is created by.
     *
     *      Staticcall rather than a typed call: an address that is not a
     *      factory reverts with nothing in it, and a typed call turns that into
     *      an `EvmError` and a stack trace instead of a named error naming the
     *      chain it happened on.
     */
    function _assertIsFactory(uint256 chainId, address factory) internal view {
        if (factory.code.length == 0) {
            revert FactoryHasNoCode(chainId, factory);
        }

        (bool ok, bytes memory ret) = factory.staticcall(
            abi.encodeWithSignature("implementation()")
        );
        if (!ok || ret.length != 32) revert NotAFactory(chainId, factory);
    }
}
