// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * @title SetPrimarySlot
 * @notice Point AdLand's `primary` key at a slot.
 *
 * @dev The successor to `script/SetPrimarySlot.s.sol`, which wrote to the V1
 *      `AdModule`. The key and the delay are the same idea; the contract
 *      holding them is the hook now.
 *
 *      ── Why a key at all ────────────────────────────────────────────────
 *
 *      A publisher pastes `<adland-slot slot="0x…">` into their page, and that
 *      address then lives in HTML nobody can reach again. An embed carrying no
 *      slot resolves `primary` instead, which is ours to repoint.
 *
 *      ── Immediate once, delayed after ───────────────────────────────────
 *
 *      `setSlot` applies straight away while the key has no value and proposes
 *      a {AdLand-CHANGE_DELAY} change once it does. The caller does not choose
 *      which — an owner who picks whether their own change is delayed provides
 *      no assurance at all — so this script reads the key first and says which
 *      of the two is about to happen.
 *
 *      Run:
 *        forge script script/protocol/SetPrimarySlot.s.sol:SetPrimarySlot \
 *          --sig 'run(address)' <slot> \
 *          --rpc-url $RPC --broadcast --private-key $PK
 *
 *      The AdLand address is read from `deployments/<chainid>/AdLand.json`, so
 *      the chain the RPC points at is the chain this writes to and there is no
 *      second place to keep an address in step.
 */
contract SetPrimarySlot is ProtocolConfig {
    error NoAdLandOnThisChain(uint256 chainId);
    error SlotHasNoCode(address slot);
    error NotASlot(address slot);
    error SlotPointsElsewhere(address expected, address actual);
    error AlreadyPrimary(address slot);

    function run(address slot) external {
        address adLandAddress = deployed("AdLand");
        if (adLandAddress == address(0))
            revert NoAdLandOnThisChain(block.chainid);

        AdLand adLand = AdLand(adLandAddress);

        // ── the checks, before anything is sent ─────────────────────────────
        //
        // All three are things the registry itself will not catch. `setSlot`
        // takes any address: it never asks whether there is code there, whether
        // it is a slot, or whether that slot runs THIS hook. A key pointed at
        // the wrong address does not revert, it renders an empty ad space —
        // which is indistinguishable from an unsold one.
        if (slot.code.length == 0) revert SlotHasNoCode(slot);

        // Staticcall rather than `Slot(slot).hook()`, so that an address which
        // is not a slot of this protocol says so. A V1 slot has no `hook()` and
        // the typed call reverts with nothing in it — an `EvmError: Revert` and
        // a stack trace, for what is almost always somebody pasting the address
        // they have been using for a year.
        (bool ok, bytes memory ret) = slot.staticcall(
            abi.encodeWithSignature("hook()")
        );
        if (!ok || ret.length != 32) revert NotASlot(slot);

        address hook = abi.decode(ret, (address));
        if (hook != adLandAddress)
            revert SlotPointsElsewhere(adLandAddress, hook);

        address current = adLand.primary();
        if (current == slot) revert AlreadyPrimary(slot);

        console2.log("AdLand        ", adLandAddress);
        console2.log("owner         ", adLand.owner());
        console2.log("primary (now) ", current);
        console2.log("primary (next)", slot);

        // Said before it is sent, because the two outcomes need different
        // follow-ups and the difference is invisible in the receipt: one write
        // takes effect, the other starts a clock.
        if (current == address(0)) {
            console2.log("effect         immediate (key has no value yet)");
        } else {
            console2.log("effect         proposed, ready in (seconds):");
            console2.log("              ", adLand.CHANGE_DELAY());
            console2.log("apply with     commitSlot(PRIMARY) after that");
        }

        vm.startBroadcast();
        adLand.setSlot(adLand.PRIMARY(), slot);
        vm.stopBroadcast();

        console2.log("primary is now", adLand.primary());
    }

    /**
     * @notice Apply a change that has waited out its delay.
     * @dev Callable by anyone, which is why it is a separate entry point: the
     *      delay is the protection, and requiring the owner to press a second
     *      button only adds a way for a change everybody has already seen to
     *      sit unapplied.
     */
    function commit() external {
        AdLand adLand = AdLand(deployed("AdLand"));
        vm.startBroadcast();
        adLand.commitSlot(adLand.PRIMARY());
        vm.stopBroadcast();
        console2.log("primary is now", adLand.primary());
    }
}
