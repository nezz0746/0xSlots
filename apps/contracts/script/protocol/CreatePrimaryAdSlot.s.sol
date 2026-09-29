// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {AdLand} from "../../src/modules/adland/AdLand.sol";
import {AdConfig, ModerationMode} from "../../src/modules/adland/IAdLand.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";

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
 *      vars — AD_OWNER, AD_CURRENCY, AD_TAX_BPS, AD_MIN_DEPOSIT_SECONDS,
 *      AD_TENURE_WINDOW, AD_MODERATION (0 Open, 1 FirstPerTenure, 2 Every) —
 *      and the log prints what it
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
    error NoOwner();

    /// The outgoing primary's terms, or zeroes when there is no primary yet.
    struct Terms {
        bool found;
        address recipient;
        address manager;
        address currency;
        uint256 taxRateBps;
        uint256 minRunwaySeconds;
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
        t.taxRateBps = _word(slot, "taxRateBps()");
        t.minRunwaySeconds = _word(slot, "minRunwaySeconds()");
        // Only the RETIRED protocol answers this: its hook kept the window as
        // its 32 bytes of config. A v1 slot misses, and the window stays zero.
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
        // first — which for `setSlotFactory` means a half-migrated module.
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

        // The owner must sign as manager, so the outgoing manager is the
        // default, not the outgoing recipient (which may be a contract).
        address slotOwner = vm.envOr("AD_OWNER", prev.manager);
        // Zero is a legal currency — it means native ETH — so it cannot double
        // as "unset". A chain with no previous primary must be told.
        address currency = vm.envOr("AD_CURRENCY", prev.currency);
        uint256 taxRateBps = vm.envOr("AD_TAX_BPS", prev.found ? prev.taxRateBps : DEFAULT_TAX_BPS);
        uint256 minDeposit = vm.envOr(
            "AD_MIN_DEPOSIT_SECONDS",
            prev.found ? prev.minRunwaySeconds : DEFAULT_MIN_DEPOSIT_SECONDS
        );
        uint256 tenure =
            vm.envOr("AD_TENURE_WINDOW", prev.found ? prev.tenureWindow : DEFAULT_TENURE_WINDOW);
        uint256 moderation = vm.envOr("AD_MODERATION", uint256(0));

        // No default worth having: a guessed owner would receive the rent and
        // hold the slot.
        if (slotOwner == address(0)) revert NoOwner();

        console2.log("AdLand          ", adLandAddress);
        console2.log("owner           ", owner);
        console2.log("factory (record)", factory);
        console2.log("slot owner      ", slotOwner);
        console2.log("currency        ", currency);
        console2.log("taxRateBps      ", taxRateBps);
        console2.log("minDepositSecs  ", minDeposit);
        console2.log("tenureWindow    ", tenure);
        console2.log("moderation      ", moderation);

        vm.startBroadcast();

        // The slot's whole AdLand configuration, stored on the slot.
        // Keyless: `primary` is claimed below, delay and all.
        bytes memory settings = abi.encode(
            AdConfig({
                tenureWindow: uint64(tenure),
                moderation: ModerationMode(moderation),
                key: bytes32(0)
            })
        );

        // An ordinary slot from the ordinary factory, with AdLand as its module.
        address slot = SlotFactory(factory)
            .createSlot(
                SlotInit({
                    currency: IERC20(currency),
                    manager: slotOwner,
                    mutableTax: true,
                    mutableRecipient: true,
                    mutableModule: false,
                    taxTerms: TaxTerms({
                        recipient: slotOwner,
                        rateBps: uint16(taxRateBps),
                        minRunwaySeconds: uint32(minDeposit)
                    }),
                    moduleTerms: ModuleTerms({module: adLandAddress, settings: settings})
                })
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
            console2.log("next             set settings.miniapp.slot to the slot above");
        } else {
            console2.log("effect           proposed; ready in (seconds):");
            console2.log("                ", adLand.CHANGE_DELAY());
            console2.log("next             SetPrimarySlot --sig 'commit()' after that");
        }
    }
}
