// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * @title SetSlotFactory
 * @notice Point every chain's AdLand hook at that chain's own slot factory.
 *
 * @dev A freshly deployed AdLand has `slotFactory == address(0)` and
 *      `createAdSlot` reverts `NoFactory()` — `0x14042392` — until somebody
 *      sets it. Nothing reports that: the hook deploys, records itself,
 *      resolves keys and serves creatives, and the only symptom is that
 *      creating a space fails for everyone with a bare custom error.
 *
 *      Three things are deliberate here.
 *
 *      The chain list is `deployments/config/*.json`, read rather than written
 *      down — the same list the deploy scripts work from, so adding a chain is
 *      adding a file. The condition arrives on every chain at once because it
 *      is a property of deploying, not of any chain.
 *
 *      The factory is never an argument. `setSlotFactory` takes any address,
 *      so a wrong one does not revert — it keeps creating slots, from another
 *      chain's factory or the previous generation's, whose deployments the
 *      current indexer starts too late to see. Each chain's comes from its own
 *      `deployments/<chainid>/SlotFactory.json`, read after its fork is
 *      selected.
 *
 *      The current value is COMPARED, not null-checked. A hook whose factory
 *      is merely set is not correct; the dangerous state is non-zero and
 *      stale, because it works. A chain already right sends nothing, which is
 *      what makes this safe to re-run.
 *
 *      Run — read-only over every chain, no flags:
 *
 *        forge script script/protocol/SetSlotFactory.s.sol:SetSlotFactory \
 *          --sig 'check()'
 *
 *      Then fix them all, signing with `PK` from `.env`:
 *
 *        forge script script/protocol/SetSlotFactory.s.sol:SetSlotFactory \
 *          --broadcast
 *
 *      `ONLY_CHAIN=8453` narrows either one.
 */
contract SetSlotFactory is ProtocolConfig {
    using stdJson for string;

    error FactoryHasNoCode(uint256 chainId, address factory);
    error NotAFactory(uint256 chainId, address factory);
    error NotOwner(uint256 chainId, address owner, address caller);

    /**
     * One chain, as found on its own fork.
     *
     * Not named `Chain` — forge-std's `StdChains` already declares that and
     * `Script` inherits it, so the obvious name is the one that will not
     * compile. A non-empty `skipped` means every address below is unread.
     */
    struct ChainState {
        uint256 chainId;
        string name;
        string rpc;
        address adLand;
        address owner;
        address recorded;
        address current;
        string skipped;
    }

    /**
     * @dev The foundry.toml alias first, because that is where `ALCHEMY_KEY`
     *      is spent; the config's public URL second, as the endpoint that
     *      works with no keys at all. Hyphens are stripped because the aliases
     *      are written `basesepolia` and the configs `base-sepolia`.
     *
     *      No third option, and an unresolved chain is a SKIP rather than an
     *      error. Local anvil declares neither an alias by its config name nor
     *      a URL, so an operator who is not running a node drops 31337 by
     *      doing nothing — right for a command whose point is the live chains.
     */
    function _rpc(string memory json) internal view returns (string memory) {
        try vm.rpcUrl(_stripHyphens(json.readString(".name"))) returns (
            string memory alias_
        ) {
            return alias_;
        } catch {}

        if (vm.keyExistsJson(json, ".rpcUrl")) {
            return json.readString(".rpcUrl");
        }
        return "";
    }

    function _stripHyphens(
        string memory value
    ) private pure returns (string memory) {
        bytes memory v = bytes(value);
        bytes memory out = new bytes(v.length);
        uint256 n;
        for (uint256 i; i < v.length; ++i) {
            if (v[i] != "-") out[n++] = v[i];
        }
        assembly {
            mstore(out, n)
        }
        return string(out);
    }

    /**
     * @dev Forks each chain in turn and reads it. `deployed()` keys off
     *      `block.chainid`, which `createSelectFork` changes, so every record
     *      read here is that chain's own with nothing passed down.
     */
    function _survey() internal returns (ChainState[] memory chains) {
        VmSafe.DirEntry[] memory entries = vm.readDir(
            string.concat(vm.projectRoot(), "/deployments/config")
        );
        uint256 only = vm.envOr("ONLY_CHAIN", uint256(0));

        chains = new ChainState[](entries.length);
        uint256 n;

        for (uint256 i; i < entries.length; ++i) {
            // The directory holds a README too, and a chain is a JSON file
            // named for its id.
            if (entries[i].isDir) continue;
            if (!_endsWithJson(entries[i].path)) continue;

            string memory json = vm.readFile(entries[i].path);

            ChainState memory c;
            c.chainId = json.readUint(".chainId");
            c.name = json.readString(".name");
            if (only != 0 && c.chainId != only) continue;

            c.rpc = _rpc(json);
            if (bytes(c.rpc).length == 0) {
                c.skipped = "no RPC configured";
                chains[n++] = c;
                continue;
            }

            vm.createSelectFork(c.rpc);

            c.adLand = deployed("AdLand");
            c.recorded = deployed("SlotFactory");

            // Not an error. A chain can be configured and still carry only the
            // RETIRED protocol's records — `deployed()` returns zero for
            // exactly that, and sweeping it would be sweeping someone else's
            // contract.
            if (c.adLand == address(0)) {
                c.skipped = "no AdLand from this protocol";
            } else if (c.recorded == address(0)) {
                c.skipped = "no SlotFactory recorded";
            } else {
                c.owner = AdLand(c.adLand).owner();
                c.current = AdLand(c.adLand).slotFactory();
            }

            chains[n++] = c;
        }

        assembly {
            mstore(chains, n)
        }
    }

    function _endsWithJson(string memory p) private pure returns (bool) {
        bytes memory v = bytes(p);
        return
            v.length > 5 &&
            v[v.length - 5] == "." &&
            v[v.length - 4] == "j" &&
            v[v.length - 3] == "s" &&
            v[v.length - 2] == "o" &&
            v[v.length - 1] == "n";
    }

    function _needsFix(ChainState memory c) internal pure returns (bool) {
        return bytes(c.skipped).length == 0 && c.current != c.recorded;
    }

    function _report(ChainState memory c) internal pure {
        console2.log("");
        console2.log(
            string.concat("== ", c.name, " (", vm.toString(c.chainId), ")")
        );
        if (bytes(c.skipped).length > 0) {
            console2.log("   skipped         ", c.skipped);
            return;
        }
        console2.log("   AdLand          ", c.adLand);
        console2.log("   owner           ", c.owner);
        console2.log("   factory (hook)  ", c.current);
        console2.log("   factory (record)", c.recorded);
        console2.log(
            "   state           ",
            c.current == c.recorded
                ? "correct"
                : c.current == address(0)
                    ? "UNSET - createAdSlot reverts NoFactory()"
                    : "STALE - creates slots the indexer never sees"
        );
    }

    /**
     * @notice Say what every chain points at, and send nothing.
     * @dev Its own entry point rather than a `DRY_RUN` flag: forge runs the
     *      body either way and `--broadcast` decides only whether transactions
     *      are sent, so nobody should have to trust they left a flag off.
     */
    function check() external {
        ChainState[] memory chains = _survey();
        uint256 pending;
        for (uint256 i; i < chains.length; ++i) {
            _report(chains[i]);
            if (_needsFix(chains[i])) ++pending;
        }
        console2.log("");
        console2.log("chains needing a fix:", pending);
    }

    function run() external {
        ChainState[] memory chains = _survey();

        // `PK` is the key every script in this repo signs with, and forge loads
        // `.env` on its own. Read here rather than passed as `--private-key`,
        // because forge binds a CLI key to one chain and this broadcasts to
        // several.
        uint256 pk = vm.envUint("PK");
        address sender = vm.addr(pk);

        uint256 sent;
        for (uint256 i; i < chains.length; ++i) {
            ChainState memory c = chains[i];
            _report(c);

            // A chain already correct is skipped, not failed: a sweep that
            // errors on the chains that are right is a sweep nobody re-runs.
            if (!_needsFix(c)) continue;

            // Re-selected because the survey left the fork on the LAST chain it
            // looked at. Without this every write below would go to that one
            // chain, carrying a different chain's factory address — the exact
            // miswiring this script exists to prevent.
            vm.createSelectFork(c.rpc);

            _assertIsFactory(c.chainId, c.recorded);

            // Before broadcasting. `setSlotFactory` is `onlyOwner`, and finding
            // that out from a reverted transaction costs gas on every chain.
            if (c.owner != sender) revert NotOwner(c.chainId, c.owner, sender);

            console2.log("   setSlotFactory ->", c.recorded);

            vm.startBroadcast(pk);
            AdLand(c.adLand).setSlotFactory(c.recorded);
            vm.stopBroadcast();

            console2.log("   factory is now  ", AdLand(c.adLand).slotFactory());
            ++sent;

            // Invisible in the receipt: a hook that can create slots still has
            // no primary until one is made, and the embed resolves `primary`
            // for every publisher who pasted no address.
            if (AdLand(c.adLand).primary() == address(0)) {
                console2.log("   next             CreatePrimaryAdSlot");
            }
        }

        console2.log("");
        console2.log("chains updated:", sent);
    }

    /**
     * @dev The record names an address; it does not prove a factory is at it.
     *      A record copied from another chain points at something else, and
     *      `setSlotFactory` accepts that happily. `implementation()` is the
     *      cheapest question only a SlotFactory answers, asked by staticcall so
     *      a non-factory gives a named error rather than a bare `EvmError`.
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
