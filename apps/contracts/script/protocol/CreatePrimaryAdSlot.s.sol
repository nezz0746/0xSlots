// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";

/**
 * @title CreatePrimaryAdSlot
 * @notice Create an ad slot on the CURRENT deployment and hand it the `primary`
 *         key.
 *
 * @dev `SetPrimarySlot` points the key at a slot that already exists. This is
 *      the step before it, and it exists because a redeployed protocol leaves
 *      the old primary stranded in a way nothing reports: the slot keeps
 *      working, the embed keeps resolving it, and the indexer — which starts at
 *      the new factory's block — has never heard of it. An ad space that renders
 *      but appears in no list is the failure this script is for.
 *
 *      ── Two prerequisites, both silent when unmet ───────────────────────
 *
 *      `AdLand.slotFactory` is zero after a fresh deploy until somebody sets
 *      it, and `createAdSlot` reverts with `NoFactory()` when it is. Worse, it
 *      can be non-zero and STALE — pointing at the previous generation's
 *      factory, which still works and still creates slots the current indexer
 *      will not see. So this checks the value against the address book rather
 *      than checking it is set, and fixes it in the same transaction batch.
 *
 *      ── Why the key is claimed separately ───────────────────────────────
 *
 *      `createAdSlot` takes a key and would register it in one call, but only
 *      while the key is FREE — it reverts `KeyTaken` otherwise, and `primary`
 *      is taken on any chain that has ever had an ad space. So the slot is
 *      created keyless and `setSlot` is called after, which is also the path
 *      that respects {AdLand-CHANGE_DELAY}: repointing a live key proposes,
 *      and somebody has to commit it two days later. That delay is the point,
 *      and a script that dodged it by creating under a free key would be
 *      quietly removing the protection.
 *
 *      Terms are read off the OUTGOING primary, so this is a like-for-like
 *      replacement unless you say otherwise. Override any of them with env
 *      vars — AD_RECIPIENT, AD_MANAGER, AD_CURRENCY, AD_TAX_BPS,
 *      AD_MIN_DEPOSIT_SECONDS, AD_TENURE_WINDOW — and the log prints what it
 *      used either way.
 *
 *      Run:
 *        cd apps/contracts
 *        forge script script/protocol/CreatePrimaryAdSlot.s.sol:CreatePrimaryAdSlot \
 *          --rpc-url $RPC --broadcast --private-key $PK
 *
 *      Then, two days later:
 *        forge script script/protocol/SetPrimarySlot.s.sol:SetPrimarySlot \
 *          --sig 'commit()' --rpc-url $RPC --broadcast --private-key $PK
 */
contract CreatePrimaryAdSlot is ProtocolConfig {
    error NoAdLandOnThisChain(uint256 chainId);
    error NoSlotFactoryOnThisChain(uint256 chainId);
    error NotOwner(address owner, address caller);
    error NoRecipient();

    /// The outgoing primary's terms, or zeroes when there is no primary yet.
    struct Terms {
        bool found;
        address recipient;
        address manager;
        address currency;
        uint256 taxBps;
        uint256 minDepositSeconds;
        uint256 tenureWindow;
    }

    /**
     * @dev Staticcalls rather than a typed interface, for the reason
     *      `SetPrimarySlot` gives: the outgoing primary can be a slot from a
     *      RETIRED protocol with a different surface, and a typed call against
     *      one reverts with nothing in it. Every getter is asked for
     *      separately and a miss leaves its field zero, so an older slot
     *      contributes whatever it still answers and no more.
     */
    function _termsOf(address slot) internal view returns (Terms memory t) {
        if (slot == address(0) || slot.code.length == 0) return t;
        t.found = true;
        t.recipient = address(uint160(_word(slot, "recipient()")));
        t.manager = address(uint160(_word(slot, "manager()")));
        t.currency = address(uint160(_word(slot, "currency()")));
        t.taxBps = _word(slot, "taxBps()");
        t.minDepositSeconds = _word(slot, "minDepositSeconds()");
        // The hook stores the window as its 32 bytes of config; see
        // `AdLandCreate.createAdSlot`, which encodes seconds into it.
        t.tenureWindow = _word(slot, "hookData()");
    }

    function _word(address target, string memory sig) private view returns (uint256) {
        (bool ok, bytes memory ret) = target.staticcall(abi.encodeWithSignature(sig));
        if (!ok || ret.length != 32) return 0;
        return abi.decode(ret, (uint256));
    }

    /// 50% of the declared price per 30 days, as the outgoing primary charges.
    uint256 internal constant DEFAULT_TAX_BPS = 5000;
    /// A day of runway a buyer must fund up front.
    uint256 internal constant DEFAULT_MIN_DEPOSIT_SECONDS = 1 days;
    /// How long an advertiser cannot be outbid off the space.
    uint256 internal constant DEFAULT_TENURE_WINDOW = 30 minutes;

    function run() external {
        address adLandAddress = deployed("AdLand");
        if (adLandAddress == address(0)) {
            revert NoAdLandOnThisChain(block.chainid);
        }

        address factory = deployed("SlotFactory");
        if (factory == address(0)) {
            revert NoSlotFactoryOnThisChain(block.chainid);
        }

        AdLand adLand = AdLand(adLandAddress);

        // Checked before anything is sent. Both writes below are `onlyOwner`,
        // and a broadcast that reverts on the second one has already spent the
        // first — which for `setSlotFactory` means a half-migrated hook.
        address owner = adLand.owner();
        address caller = msg.sender;
        if (owner != caller) revert NotOwner(owner, caller);

        // ── Defaults are the OUTGOING primary's own terms ────────────────
        //
        // Read off the chain rather than written down here, so "like for like"
        // is a fact about this deployment instead of a constant that was true
        // once. The constants below are only reached on a chain that has never
        // had a primary, where there is nothing to copy.
        Terms memory prev = _termsOf(adLand.primary());

        address recipient = vm.envOr("AD_RECIPIENT", prev.recipient);
        address manager = vm.envOr("AD_MANAGER", prev.manager);
        // Zero is a legal currency — it means native ETH — so it cannot double
        // as "unset". A chain with no previous primary must be told.
        address currency = vm.envOr("AD_CURRENCY", prev.currency);
        uint256 taxBps = vm.envOr("AD_TAX_BPS", prev.found ? prev.taxBps : DEFAULT_TAX_BPS);
        uint256 minDeposit =
            vm.envOr("AD_MIN_DEPOSIT_SECONDS", prev.found ? prev.minDepositSeconds : DEFAULT_MIN_DEPOSIT_SECONDS);
        uint256 tenure = vm.envOr("AD_TENURE_WINDOW", prev.found ? prev.tenureWindow : DEFAULT_TENURE_WINDOW);

        // No default worth having. Rent goes here forever, and a script that
        // guessed — the owner, say — would produce a slot that looks right and
        // pays the wrong address for as long as nobody checks.
        if (recipient == address(0)) revert NoRecipient();

        console2.log("AdLand          ", adLandAddress);
        console2.log("owner           ", owner);
        console2.log("factory (record)", factory);
        console2.log("factory (hook)  ", adLand.slotFactory());
        console2.log("recipient       ", recipient);
        console2.log("manager         ", manager);
        console2.log("currency        ", currency);
        console2.log("taxBps          ", taxBps);
        console2.log("minDepositSecs  ", minDeposit);
        console2.log("tenureWindow    ", tenure);

        vm.startBroadcast();

        // Compared, not null-checked: a hook still pointing at the previous
        // generation creates slots that work and that the indexer never sees.
        if (adLand.slotFactory() != factory) {
            console2.log("setSlotFactory   ->", factory);
            adLand.setSlotFactory(factory);
        }

        address slot = adLand.createAdSlot(
            recipient,
            IERC20(currency),
            taxBps,
            minDeposit,
            tenure,
            manager,
            bytes32(0) // keyless; `primary` is claimed below, delay and all
        );

        address current = adLand.primary();
        adLand.setSlot(adLand.PRIMARY(), slot);

        vm.stopBroadcast();

        console2.log("slot created    ", slot);
        console2.log("primary (was)   ", current);
        console2.log("primary (now)   ", adLand.primary());

        // The two outcomes are indistinguishable in the receipt and need
        // different follow-ups, so they are said out loud.
        if (adLand.primary() == slot) {
            console2.log("effect           immediate");
            console2.log("next             set config.miniapp.slot to the slot above");
        } else {
            console2.log("effect           proposed; ready in (seconds):");
            console2.log("                ", adLand.CHANGE_DELAY());
            console2.log("next             SetPrimarySlot --sig 'commit()' after that");
        }
    }
}
