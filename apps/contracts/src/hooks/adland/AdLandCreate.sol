// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AdLandStorage} from "./AdLandStorage.sol";
import {ISlotFactory, ModerationMode} from "./IAdLand.sol";
import {SlotInit, TaxTerms, HookTerms} from "../../types/SlotTypes.sol";

/**
 * @title AdLandCreate
 * @notice Making an ad space, without assembling one.
 *
 * @dev ── Why this exists, given `createSlot` is already permissionless ──────
 *
 *      It buys nothing a determined caller cannot do themselves. `SlotFactory`
 *      has no access control: any app can call it with `hook` set to this
 *      contract and get exactly the same slot. This is not a gate.
 *
 *            What it removes is the chance to get it wrong. Three `SlotInit` fields
 *      fail quietly:
 *
 *        - `hook`, which is an address a form can fill with the wrong one. A
 *          slot pointing at some other hook is a perfectly valid slot that
 *          simply is not an ad space, and nothing about it looks broken.
 *                - the hook's `config`, a `bytes32` that is really seconds. Callers pass
 *          a duration; the word is this contract's to encode.
 *        - `mutableHook`, which decides whether the slot can ever stop being an
 *          ad space. This function locks it, and does not ask.
 *
 *      `Slot.initialize` already validates the rest, and reverts rather than
 *      attaching quietly: hook data this contract refuses takes the creation
 *      down with the hook's own error. So this adds no checks the core lacks.
 *      It removes arguments.
 *
 *      ── What it deliberately does NOT do ────────────────────────────────────
 *
 *      It keeps no list. An on-chain array of slots created here could only
 *      ever hold the ones that came through this function — and since anybody
 *      may call the factory directly with this address as their hook, that
 *      array would mean "slots that used our button", not "slots using this
 *      hook". The two diverge the first time somebody does it themselves, and
 *      the incomplete one is the one a UI would trust.
 *
 *      The complete answer is off-chain and already exists: every slot carries
 *      its hook, so an indexer filtering `hook == adland` sees all of them
 *      however they were made. {AdSlotCreated} is emitted for the indexer's
 *      convenience, not as a source of truth.
 */
abstract contract AdLandCreate is AdLandStorage {
    error NoFactory();
    error EmptyBatch();

    /**
     * @notice One space's terms.
     *
     * @param owner    Manages the slot and receives its rent. Can propose new
     *        rent terms, hand the slot over with `Slot.setManager`, and
     *        moderate its creatives.
     * @param currency The token rent is priced and paid in. Zero for native.
     * @param taxRateBps Tax per 30 days, in basis points of the declared price.
     * @param minRunwaySeconds How far ahead an occupant must fund.
     * @param tenureWindow Seconds an advertiser cannot be outbid off the space,
     *        except at ten times their declared price. Zero means no window.
     * @param moderation How creatives are screened from the first occupant on.
     * @param key A registry name to claim for this slot, or zero to claim none.
     */
    struct AdSlotParams {
        address owner;
        IERC20 currency;
        uint16 taxRateBps;
        uint32 minRunwaySeconds;
        uint256 tenureWindow;
        ModerationMode moderation;
        bytes32 key;
    }

    /// @notice A slot was created through this contract, pointing at it.
    /// @dev Not the definition of an AdLand slot — `Slot.hook()` is. This says
    ///      "made here", which is a smaller and different claim.
    event AdSlotCreated(
        address indexed slot,
        address indexed creator,
        address indexed owner,
        uint256 tenureWindow,
        ModerationMode moderation
    );

    event SlotFactorySet(address previous, address next);

    /// @notice Point creation at a factory.
    /// @dev Owner-only and deliberately not settable per call. A caller who can
    ///      name the factory can name one that returns something which is not a
    ///      slot at all.
    function setSlotFactory(address factory) external onlyOwner {
        emit SlotFactorySet(slotFactory, factory);
        slotFactory = factory;
    }

    /**
     * @notice Create a slot that runs this hook, and cannot stop running it.
     *
     * @dev ── Decisions this makes for the caller ────────────────────────────
     *
     *      `mutableHook` is FALSE, always. A slot made here is an ad space
     *      permanently: the owner may change the rent terms but can never point
     *      it at a different hook, which is what a publisher pasting the
     *      address into their page relies on. Anyone wanting the other trade
     *      calls `SlotFactory.createSlot` directly.
     *
     *      Tax and recipient are mutable, and the owner is both manager and
     *      recipient. Every space made here is manageable.
     *
     *      The moderation mode is written before anyone can buy, so the first
     *      occupant is seated under it. A separate `setModerationMode` after
     *      creation would race the first buyer, and lose to them for a whole
     *      tenure.
     *
     *      ── Claiming a name, first come first served ────────────────────────
     *
     *      A key is taken here WITHOUT permission: only an UNCLAIMED key, and
     *      taking one is recorded in `keyOwner`. `primary` and anything already
     *      pointing somewhere cannot be claimed; the owner can still repoint
     *      any key through `setSlot`'s delayed path; and holding a key grants
     *      exactly one power over exactly that key.
     *
     *      A taken key reverts the WHOLE creation rather than making the slot
     *      and skipping the claim, so nobody walks away believing a space is
     *      named when it is not.
     */
    function createAdSlot(AdSlotParams calldata params) external returns (address slot) {
        return _createAdSlot(params);
    }

    /**
     * @notice Create several ad spaces in one call.
     *
     * @param params One entry per space. Order is preserved in the return.
     * @return slots The addresses created, in the order asked for.
     *
     * @dev ── Why this exists when {multicall} also batches ─────────────────
     *
     *      They are not the same tool. `multicall` batches ARBITRARY calls on
     *      this contract and pays for it: each entry is a `delegatecall` with
     *      its own 4-byte selector, its own ABI-encoded arguments and its own
     *      returndata copy. This takes one array, one dispatch, and the shared
     *      `slotFactory` read happens once instead of per entry.
     *
     *      The bigger difference is legibility. A batch of ten spaces through
     *      `multicall` is ten opaque `bytes` blobs in the calldata a wallet
     *      shows you; here it is ten structs a wallet can decode and display.
     *      For the one batch operation anybody actually performs, that is worth
     *      a function.
     *
     *      ── No cap on the length ────────────────────────────────────────────
     *
     *      Gas is the limit and it is the honest one. A hardcoded maximum would
     *      be a number picked today against a block limit that moves, and the
     *      failure it prevents — a batch too large to fit — already fails
     *      loudly and costs nothing on a call that never lands.
     *
     *      ── All or nothing ─────────────────────────────────────────────────
     *
     *      One revert takes the whole batch down. That follows from the single
     *      transaction rather than being chosen, and it is the behaviour to
     *      want: the reverts reachable here are a missing factory, terms the
     *      core refuses, and a name already taken — none of which is a reason
     *      to keep the other nine and leave the caller to work out which one
     *      is missing.
     *
     *      Two entries claiming the SAME name revert on the second, because the
     *      first has already written `slotOf`. That is the same rule as two
     *      separate transactions, and it needs no special case.
     */
    function createAdSlotMany(AdSlotParams[] calldata params) external returns (address[] memory slots) {
        // An empty batch is a caller bug, not a no-op worth succeeding at: it
        // costs gas, emits nothing, returns nothing, and reads as success.
        if (params.length == 0) revert EmptyBatch();

        slots = new address[](params.length);
        for (uint256 i; i < params.length; ++i) {
            slots[i] = _createAdSlot(params[i]);
        }
    }

    /// @dev The whole of creation, shared so the single and batch entry points
    ///      cannot drift into making two different kinds of slot.
    function _createAdSlot(AdSlotParams memory p) internal returns (address slot) {
        address factory = slotFactory;
        if (factory == address(0)) revert NoFactory();

        slot = ISlotFactory(factory)
            .createSlot(
                SlotInit({
                    currency: p.currency,
                    manager: p.owner,
                    mutableTax: true,
                    mutableRecipient: true,
                    mutableHook: false,
                    taxTerms: TaxTerms({
                        recipient: p.owner,
                        rateBps: p.taxRateBps,
                        minRunwaySeconds: p.minRunwaySeconds
                    }),
                    hookTerms: HookTerms({
                        target: address(this),
                        // The caller passes seconds; the word is ours to encode.
                        config: bytes32(p.tenureWindow)
                    })
                })
            );

        if (p.moderation != ModerationMode.Open) {
            _moderation[slot].current = p.moderation;
            emit ModerationModeSet(slot, p.moderation, 0);
        }

        if (p.key != bytes32(0)) {
            if (slotOf[p.key] != address(0)) revert KeyTaken(p.key);
            slotOf[p.key] = slot;
            keyOwner[p.key] = msg.sender;
            // The registry's own event, so the indexer and the embed's
            // resolution path need to learn nothing about this function.
            emit SlotSet(p.key, address(0), slot);
        }

        emit AdSlotCreated(slot, msg.sender, p.owner, p.tenureWindow, p.moderation);
    }
}
