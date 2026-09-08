// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Slot, SlotInit} from "./Slot.sol";
import "./SlotErrors.sol";
import {VersionedUUPS} from "./VersionedUUPS.sol";
import {Versioned} from "./Versioned.sol";

/**
 * @title SlotFactory
 * @notice Deploys slots behind a shared beacon, and is the protocol's event hub.
 *
 * @dev ── One creation function ────────────────────────────────────────────
 *
 *      A new slot parameter goes into `SlotInit`, never into a suffixed second
 *      creator. A versioned entry point is a permanent tax on every caller,
 *      every published ABI and every integration, paid to avoid changing one
 *      struct once — and it also splits the indexer, which then has to register
 *      every handler twice to cover both eras.
 */
contract SlotFactory is VersionedUUPS {

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 3;
    }

    /// @notice Which migration has run against THIS proxy's storage.
    /// @dev OpenZeppelin already tracks this and already refuses to run a
    ///      `reinitializer(N)` twice or out of order — so an upgrade that
    ///      needs new state gets its monotonicity enforced by the library
    ///      rather than by a script. Exposed because it is otherwise
    ///      internal, and during an incident you want both numbers.

    /// @notice The beacon every slot delegates to. Upgrading it upgrades all.
    UpgradeableBeacon public beacon;

    /// @notice May upgrade the beacon and upgrade this factory.
    address public admin;

    /// @notice Slots this factory created. The event hub's guest list.
    mapping(address => bool) public isSlot;

    uint256 public slotCount;

    event SlotCreated(
        address indexed slot,
        address indexed recipient,
        address indexed creator,
        address currency,
        address hook
    );
    event AdminTransferred(address indexed from, address indexed to);
    event BeaconUpgraded(address indexed implementation);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotManager();
        _;
    }

    function initialize(address admin_, address implementation_)
        external
        initializer
    {
        if (admin_ == address(0)) revert InvalidRecipient();
        admin = admin_;
        // The FACTORY owns the beacon, not the admin EOA. Handing beacon
        // ownership straight to `admin_` reads like the simpler thing and
        // breaks two ways: `upgradeBeacon` below can then never succeed, since
        // the caller OZ sees is this contract; and beacon ownership would be
        // frozen at whoever deployed, so `transferAdmin` would hand over an
        // admin role that silently no longer carries the power to upgrade.
        beacon = new UpgradeableBeacon(implementation_, address(this));
        emit AdminTransferred(address(0), admin_);
    }

    function createSlot(SlotInit calldata init) external returns (address slot) {
        slot = address(
            new BeaconProxy(
                address(beacon),
                abi.encodeCall(Slot.initialize, (init))
            )
        );
        isSlot[slot] = true;
        unchecked {
            ++slotCount;
        }
        emit SlotCreated(
            slot,
            init.recipient,
            msg.sender,
            address(init.currency),
            init.hook
        );
    }

    /**
     * @notice Flush accrued tax out of many slots at once.
     *
     * @dev ── Why it lives here ─────────────────────────────────────────────
     *
     *      The factory already knows which addresses are slots, and that check
     *      is the only thing a batch collector needs that a standalone utility
     *      would have to be told. A separate contract would take an array of
     *      addresses on trust and call `collect()` on whatever it was handed.
     *
     *      ── Nothing here is privileged ────────────────────────────────────
     *
     *      `collect()` is permissionless on every slot and the money always
     *      goes to that slot's own `recipient`, so this grants no authority
     *      over anyone's funds. It is a gas convenience: a keeper, or a
     *      recipient with twenty slots, spends one transaction instead of
     *      twenty and one base fee instead of twenty.
     *
     *      ── One bad slot must not sink the batch ──────────────────────────
     *
     *      Each collection is isolated, and the reasons a single one reverts
     *      are ordinary rather than exceptional: `NothingToCollect` for a slot
     *      whose tax is already flushed — which is most of them, most of the
     *      time — and a hook that reverts in `afterSettle` while running
     *      uncapped under `strict`. Neither is a reason to deny nineteen other
     *      recipients their rent, so a failure leaves a zero in `collected` and
     *      the loop carries on.
     *
     *      Addresses this factory did not create are skipped rather than
     *      rejected, for the same reason: a stale entry in a caller's list is
     *      not worth failing a batch over.
     *
     * @return collected What each slot actually paid out, indexed as passed in.
     *         Zero means skipped, already flushed, or reverted — deliberately
     *         not distinguished, because the caller's next move is the same for
     *         all three. Simulate this call to price the button before showing
     *         it; the per-slot `TaxCollected` events carry the recipients.
     */
    function collectAll(address[] calldata slots)
        external
        returns (uint256[] memory collected)
    {
        collected = new uint256[](slots.length);
        for (uint256 i; i < slots.length; ++i) {
            // Through an external self-call, which is the only way to isolate
            // a revert: `try` guards the call in its own expression and nothing
            // in the success block, so the amount has to be read on the far
            // side of the same boundary the failure is caught at.
            try this.collectFrom(slots[i]) returns (uint256 amount) {
                collected[i] = amount;
            } catch {}
        }
    }

    /**
     * @notice Flush one slot, and say how much moved.
     *
     * @dev Exists to be `try`-ed by {collectAll}, and is harmless to call
     *      directly — it does nothing `collect()` does not already allow
     *      anyone to do. The `isSlot` guard is not there to protect the
     *      caller's funds but to keep this from becoming a way to make the
     *      factory address call arbitrary contracts.
     *
     *      The amount is read BEFORE collecting. `_flush` zeroes `collectedTax`
     *      on the way out, so reading it afterwards reports zero for a
     *      collection that worked — a mistake the previous generation's batch
     *      collector shipped with. What `collect()` is about to pay is what has
     *      already accrued plus what this settlement is about to add, and both
     *      are readable now.
     *
     *      Capped by the deposit, which is not defensive rounding but the
     *      settlement rule: `taxOwed()` is the RAW debt and may exceed the
     *      escrow, in which case `_settle` takes the deposit and carries the
     *      rest as arrears against the occupant rather than paying it out.
     *      Adding the uncapped debt here would report money to a recipient that
     *      no transfer moved, on exactly the slots — insolvent ones — a
     *      collection run is most likely to be sweeping up.
     */
    function collectFrom(address slot) external returns (uint256 amount) {
        if (!isSlot[slot]) revert NotASlot();

        Slot s = Slot(payable(slot));
        uint256 owed = s.taxOwed();
        uint256 escrow = s.deposit();
        amount = s.collectedTax() + (owed > escrow ? escrow : owed);
        s.collect();
    }

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert InvalidRecipient();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    /// @notice Point every slot at new code. The single most consequential
    ///         action in the protocol.
    function upgradeBeacon(address implementation_) external onlyAdmin {
        beacon.upgradeTo(implementation_);
        emit BeaconUpgraded(implementation_);
    }

    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
