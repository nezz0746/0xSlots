// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AdLandStorage} from "./AdLandStorage.sol";
import {ISlotFactory, SlotInit} from "./IAdLand.sol";

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
 *      What it removes is the chance to get it wrong. `SlotInit` is nine
 *      fields, and three of them are the kind that fail quietly:
 *
 *        - `hook`, which is an address a form can fill with the wrong one. A
 *          slot pointing at some other hook is a perfectly valid slot that
 *          simply is not an ad space, and nothing about it looks broken.
 *        - `hookData`, a `bytes32` that is really seconds. Callers pass a
 *          duration here; the word is this contract's to encode.
 *        - `mutableHook`, which decides whether the slot can ever stop being an
 *          ad space. See below — this function decides it, and does not ask.
 *
 *      `Slot.initialize` already validates the rest, and reverts rather than
 *      attaching quietly: a `hookData` this contract refuses takes the creation
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
     * @notice One space's terms, for {createAdSlotMany}.
     *
     * @dev The same seven arguments {createAdSlot} takes, as a struct, because
     *      seven parallel arrays would be seven chances to misalign one. Field
     *      order matches the function's parameter order so the two read the
     *      same way round.
     */
    struct AdSlotParams {
        address recipient;
        IERC20 currency;
        uint256 taxBps;
        uint256 minDepositSeconds;
        uint256 tenureWindow;
        address manager;
        bytes32 key;
    }

    /// @notice A slot was created through this contract, pointing at it.
    /// @dev Not the definition of an AdLand slot — `Slot.hook()` is. This says
    ///      "made here", which is a smaller and different claim.
    event AdSlotCreated(address indexed slot, address indexed creator, address indexed recipient, uint256 tenureWindow);

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
     * @param recipient Where the rent goes. The publisher, or their collective.
     * @param currency  The token rent is priced and paid in. Zero for native.
     * @param taxBps    Rent per 30 days, in basis points of the declared price.
     * @param minDepositSeconds How far ahead an occupant must fund.
     * @param tenureWindow Seconds an advertiser cannot be outbid off the space,
     *        except at ten times their declared price. ZERO means no window,
     *        which AdLand accepts — the rule is optional on this hook.
     * @param manager Who may change the tax later. Zero for a slot whose terms
     *        can never move.
     * @param key A registry name to claim for this slot, or zero to claim none.
     *        Free to take while unclaimed, and yours to repoint afterwards.
     *
     * @dev ── Two decisions this makes for the caller ─────────────────────────
     *
     *      `mutableHook` is FALSE, always. A slot made here is an ad space
     *      permanently: the manager may reprice the rent but can never point it
     *      at a different hook. That is a real restriction and it is the point
     *      — it turns "this is an AdLand slot" from a fact about right now into
     *      a fact about the slot, which is what a publisher pasting an address
     *      into their page is actually relying on. A publisher who wants the
     *      other trade calls `SlotFactory.createSlot` directly; nothing here
     *      stops them.
     *
     *      `mutableTax` follows the manager, because the core requires exactly
     *      that: a manager is demanded when something is mutable and forbidden
     *      when nothing is. Passing a manager means adjustable rent; passing
     *      zero means terms fixed at birth, with nobody able to revise them.
     *
     *      ── Claiming a name, first come first served ────────────────────────
     *
     *      A key is taken here WITHOUT permission, which is the point: a
     *      publisher should be able to make a space and name it in one
     *      transaction, and `setSlot` is owner-only precisely so that names
     *      cannot be grabbed. The reconciliation is that only an UNCLAIMED key
     *      may be taken this way, and taking one is recorded in `keyOwner`.
     *
     *      Three things keep that safe at the size this registry actually is:
     *      `primary` and anything else already pointing somewhere cannot be
     *      claimed at all; the owner can still repoint any key through
     *      `setSlot`'s delayed path, so a squatted name costs two days rather
     *      than being lost; and holding a key grants exactly one power over
     *      exactly that key.
     *
     *      A taken key reverts the WHOLE creation rather than making the slot
     *      and skipping the claim. Half-succeeding would hand the caller a
     *      space they believe is named and is not, discovered later by a
     *      publisher whose embed resolves to somebody else.
     */
    function createAdSlot(
        address recipient,
        IERC20 currency,
        uint256 taxBps,
        uint256 minDepositSeconds,
        uint256 tenureWindow,
        address manager,
        bytes32 key
    ) external returns (address slot) {
        return _createAdSlot(
            AdSlotParams({
                recipient: recipient,
                currency: currency,
                taxBps: taxBps,
                minDepositSeconds: minDepositSeconds,
                tenureWindow: tenureWindow,
                manager: manager,
                key: key
            })
        );
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
                    recipient: p.recipient,
                    currency: p.currency,
                    manager: p.manager,
                    hook: address(this),
                    // The caller passes seconds; the word is ours to encode. A
                    // `bytes32` in a form is a decision nobody should be making by
                    // hand, and the one mistake it invites — a window written in
                    // the wrong unit, or left as a hex string — produces a slot
                    // that reverts every buy rather than one that looks wrong.
                    hookData: bytes32(p.tenureWindow),
                    taxBps: p.taxBps,
                    minDepositSeconds: p.minDepositSeconds,
                    mutableTax: p.manager != address(0),
                    mutableHook: false
                })
            );

        if (p.key != bytes32(0)) {
            if (slotOf[p.key] != address(0)) revert KeyTaken(p.key);
            slotOf[p.key] = slot;
            keyOwner[p.key] = msg.sender;
            // The registry's own event, so the indexer and the embed's
            // resolution path need to learn nothing about this function.
            emit SlotSet(p.key, address(0), slot);
        }

        emit AdSlotCreated(slot, msg.sender, p.recipient, p.tenureWindow);
    }
}
