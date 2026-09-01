// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Only what this module system needs of the factory. Declared here rather
///      than importing `SlotFactory`, so a slot does not take a compile-time
///      dependency on the whole factory to ask it one question.
import {ISlotEvents} from "./interfaces/ISlot.sol";
import {IModuleLifecycle, IModuleTopics} from "./interfaces/IModuleLifecycle.sol";

interface IModuleRegistry {
    function isUtilityVerified(address utility) external view returns (bool);
}

/**
 * @title SlotModules
 * @notice Many utility modules per slot, replacing the single `utility` field.
 *
 * @dev DRAFT. Not wired into `Slot`. See
 *      `docs/plans/2026-08-29-module-gallery.md` for the reasoning behind the
 *      shape; this file is the executable version of it.
 *
 *      ── Why a slot needs more than one module ──────────────────────────────
 *
 *      One `utility` field is not a limit, it is a foreclosure: every module is
 *      mutually exclusive with every other, so adopting metadata means never
 *      having a feed. Value cannot stack on a slot, and its ceiling is fixed
 *      the moment it picks one. It also makes building adversarial — an author
 *      is not asking a slot to ADD their module, but to DISPLACE the incumbent,
 *      which is not a fight a newcomer wins.
 *
 *      ── Why namespaced storage ─────────────────────────────────────────────
 *
 *      This contract holds no ordinary state variables. Everything lives in one
 *      ERC-7201 struct at a keccak-derived slot.
 *
 *      That is not decoration. Solidity allocates BASE storage before a derived
 *      contract's own, so `contract Slot is …, SlotModules` with plain state
 *      variables would push `recipient` off slot 0 and destroy all 237+ live
 *      proxies. Namespacing removes the ordering question entirely: this can be
 *      inherited at any position, in any order, alongside any other namespaced
 *      module, and nothing in `Slot` moves.
 *
 *      It is also what makes the struct extensible — see `ModuleData`.
 *
 *      ── What this deliberately does NOT do ─────────────────────────────────
 *
 *      Gallery modules take NO FEE. `Slot._distributeTax` is untouched: the
 *      existing `utility` head keeps its cut and the money path — the one that
 *      runs inside `liquidate` — is not modified, not re-tested, not at risk.
 *
 *      That single decision deletes fee-term immutability, two fee-resolution
 *      paths, `sum(feeBps) <= 10_000` validation, credit-versus-push, and an
 *      upgrade story for changing terms. Module revenue stays possible outside
 *      core: modules already have their own entry points (`AdModule.buyAndWrite`
 *      charges its own callers), and `recipient` can be pointed at a splitter.
 */
abstract contract SlotModules is ISlotEvents {
    // ═══════════════════════════════════════════════════════════
    // STORAGE — ERC-7201
    // ═══════════════════════════════════════════════════════════

    /// @custom:storage-location erc7201:slots.storage.SlotModules
    struct ModulesStorage {
        /// Gallery modules in installation order. The head is NOT here.
        address[] list;
        /// module => index + 1 into `list`. Zero means "not installed".
        /// @dev Offset by one so a fresh mapping reads as absent without a
        ///      second flag.
        mapping(address => uint256) index;
        /// module => bookkeeping.
        mapping(address => ModuleData) data;
        /// Installs waiting on the next occupancy transition.
        address[] pendingAdds;
    }

    /**
     * @notice Per-module bookkeeping.
     *
     * @dev Stored in a MAPPING rather than inline in `list`, and that split is
     *      the whole point of the two-collection design.
     *
     *      Appending a field to a struct held in a mapping is safe: each value
     *      sits at its own keccak-derived base, with the entire address space
     *      between it and its neighbours, so growing it collides with nothing.
     *      Appending a field to a struct held in an ARRAY changes the element
     *      stride and relocates every entry after the first.
     *
     *      So: future per-module fields go HERE, appended below `installedAt`,
     *      and cost nothing. That is the answer to "can we add to this later".
     */
    struct ModuleData {
        uint64 installedAt;
        /// @dev Snapshotted from `IModuleTopics.topics()` at install, never
        ///      re-read. A module able to widen its own subscription later
        ///      could start charging the occupant gas they never consented to.
        uint32 topics;
        // APPEND ONLY — safe because of the mapping. See the note above.
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("slots.storage.SlotModules")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MODULES_STORAGE =
        0x061cd7483ff54f2472e032129df3dd760514cda92e74b589ff7fbf49d2ba7b00;

    function _modules$() private pure returns (ModulesStorage storage $) {
        assembly {
            $.slot := MODULES_STORAGE
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice The largest number of gallery modules a slot may carry.
     *
     * @dev Bounded because `_notifyModules` runs inside `buy`, `sell`,
     *      `release` and `liquidate`. Unbounded, a manager installs enough
     *      modules that the loop exceeds the block gas limit and every one of
     *      those paths reverts — INCLUDING liquidation, which this protocol
     *      treats as unconditional.
     *
     *      Swallowing module failures does not save you here: the gas is spent
     *      whether the call succeeds or reverts.
     */
    uint256 public constant MAX_MODULES = 8;

    // ─── Topics ─────────────────────────────────────────────────────────────
    //
    // One bit per hook. A module snapshots its subscription at install and is
    // skipped for anything it did not ask for, so the cost of an occupancy
    // change scales with modules that CARE about it rather than with modules
    // that happen to be installed.

    uint32 public constant TOPIC_TRANSFER = 1 << 0;
    uint32 public constant TOPIC_PRICE = 1 << 1;
    uint32 public constant TOPIC_RELEASE = 1 << 2;
    uint32 public constant TOPIC_SETTLE = 1 << 3;

    /// @dev The default for a module that does not declare `topics()` — which
    ///      is every module written before this existed.
    uint32 internal constant TOPIC_ALL =
        TOPIC_TRANSFER | TOPIC_PRICE | TOPIC_RELEASE | TOPIC_SETTLE;

    /// @dev Stipend for the optional lifecycle and subscription calls. Same
    ///      reasoning as `MODULE_GAS`: these run inside occupancy transitions,
    ///      so an unbounded call here would let a module price out a buy.
    uint256 internal constant MODULE_LIFECYCLE_GAS = 200_000;

    /// @dev Per module, NOT a shared budget divided among them, so a slot with
    ///      one module behaves exactly as it did before the gallery existed.
    uint256 internal constant MODULE_GAS = 500_000;

    // ═══════════════════════════════════════════════════════════
    // HOST HOOKS
    // ═══════════════════════════════════════════════════════════

    /// @dev Revert unless the caller may install and remove. On `Slot` that is
    ///      `manager`, and it reverts `NotManager()` — the SAME error every
    ///      other manager-gated call uses. A gallery-specific error would mean
    ///      one condition with two names, which integrators have to special-case
    ///      for no reason.
    function _requireModuleAdmin() internal view virtual;

    /// @dev Where verification is checked. `Slot.factory`.
    function _moduleRegistry() internal view virtual returns (address);

    /// @dev The legacy single module, kept as the head of the effective list.
    ///      `Slot.utility`.
    function _moduleHead() internal view virtual returns (address);

    /// @dev Vacate the head. The host enforces its own rules — on `Slot` that
    ///      means honouring `mutableUtility`, since a slot that promised an
    ///      immutable utility must not be able to drop it.
    ///
    ///      There is deliberately no `_setModuleHead`. The head is SHRINK-ONLY:
    ///      it can be vacated but never refilled, so every module installed
    ///      from here on goes through `addModule` and is therefore verified.
    ///      Leaving a way to write the head would leave the unverified back
    ///      door that retiring `proposeUtilityUpdate` exists to close.
    function _clearModuleHead() internal virtual;

    /// @dev Revert if this slot promised its modules would never change.
    ///
    ///      On `Slot` that is `mutableUtility`, and honouring it here is not
    ///      optional: the flag means "what holding this grants is fixed", and a
    ///      gallery install changes exactly that. Gating only the head would
    ///      keep the letter of the promise while breaking it in substance.
    ///
    ///      Deliberately NOT applied to `removeModule`. Withdrawing behaviour
    ///      cannot violate a promise that behaviour would not change, and
    ///      removal has to stay reachable as the lever for detaching a module
    ///      found to be broken.
    function _requireModulesMutable() internal view virtual;

    // ═══════════════════════════════════════════════════════════
    // ERRORS / EVENTS
    // ═══════════════════════════════════════════════════════════

    error ModuleHasNoCode();
    error ModuleNotVerified();
    error ModuleAlreadyInstalled();
    error ModuleNotInstalled();
    error TooManyModules();

    event ModuleAddQueued(address indexed module);
    event ModuleInstalled(address indexed module);
    event ModuleRemoved(address indexed module);

    modifier onlyModuleAdmin() {
        _requireModuleAdmin();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // WRITES
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Queue a module for installation on the next occupancy change.
     *
     * @dev DEFERRED, not immediate, for the reason `proposeUtilityUpdate`
     *      already is: a module is called inside the occupant's own exit paths
     *      and spends their gas, so installing one changes the terms of a
     *      tenure already under way. The occupant consents by the seat turning
     *      over.
     *
     *      Verification is checked HERE and nowhere else. A runtime check would
     *      put an external read on every hook, and worse, would let the registry
     *      admin revoking a module reach into live slots and silently disable
     *      their hooks mid-tenure. Revocation stops new installs; it does not
     *      reach backwards into slots that already consented.
     */
    function addModule(address module) external onlyModuleAdmin {
        _requireModulesMutable();
        if (module == address(0) || module.code.length == 0)
            revert ModuleHasNoCode();

        ModulesStorage storage $ = _modules$();
        if (module == _moduleHead() || $.index[module] != 0)
            revert ModuleAlreadyInstalled();
        if (_isPendingAdd($, module)) revert ModuleAlreadyInstalled();
        if ($.list.length + $.pendingAdds.length >= MAX_MODULES)
            revert TooManyModules();
        if (!IModuleRegistry(_moduleRegistry()).isUtilityVerified(module))
            revert ModuleNotVerified();

        $.pendingAdds.push(module);
        emit ModuleAddQueued(module);
    }

    /**
     * @notice Remove a module, effective immediately.
     *
     * @dev Immediate while `addModule` defers, and the asymmetry is the design:
     *      installing imposes cost on the occupant, removing only withdraws it,
     *      so there is nobody to protect by waiting.
     *
     *      It is also the emergency lever. A module found to be broken or
     *      hostile must be detachable NOW, not at the end of a tenure that may
     *      run for years — deferring removal would mean a slot occupied
     *      indefinitely can never be repaired. Granting is gated; revoking is
     *      not.
     *
     *      Also cancels a queued install of the same address, so a mistake can
     *      be undone before it lands.
     *
     *      Accepts the HEAD too, which is the only way to detach it now that
     *      `proposeUtilityUpdate` is gone. Vacating is all it can do — see
     *      `_clearModuleHead` for why refilling is deliberately impossible.
     */
    function removeModule(address module) external onlyModuleAdmin {
        ModulesStorage storage $ = _modules$();

        if (module != address(0) && module == _moduleHead()) {
            _clearModuleHead();
            _lifecycle(module, IModuleLifecycle.onUninstall.selector);
            emit ModuleRemoved(module);
            return;
        }

        if (_dropPendingAdd($, module)) {
            emit ModuleRemoved(module);
            return;
        }

        uint256 idx = $.index[module];
        if (idx == 0) revert ModuleNotInstalled();

        uint256 i = idx - 1;
        uint256 last = $.list.length - 1;
        if (i != last) {
            address moved = $.list[last];
            $.list[i] = moved;
            $.index[moved] = i + 1;
        }
        $.list.pop();
        delete $.index[module];
        delete $.data[module];

        // After the slot's own record is gone, so a module cannot read its
        // registration back and cannot block its own removal.
        _lifecycle(module, IModuleLifecycle.onUninstall.selector);

        emit ModuleRemoved(module);
    }

    // ═══════════════════════════════════════════════════════════
    // READS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Every module this slot notifies, head first.
     *
     * @dev The head is `utility`, kept in place rather than migrated away, so
     *      the 237+ proxies that predate the gallery need no migration
     *      transaction and `utility()` never stops meaning what it meant.
     *      Framing it as the permanent head rather than a fallback also avoids
     *      a "which source is canonical" branch everywhere it is read.
     */
    function modules() public view returns (address[] memory list) {
        ModulesStorage storage $ = _modules$();
        address head = _moduleHead();
        uint256 extra = $.list.length;

        if (head == address(0)) {
            list = new address[](extra);
            for (uint256 i; i < extra; ++i) list[i] = $.list[i];
            return list;
        }

        list = new address[](extra + 1);
        list[0] = head;
        for (uint256 i; i < extra; ++i) list[i + 1] = $.list[i];
    }

    /// @notice Gallery modules only, excluding the head.
    function galleryModules() external view returns (address[] memory) {
        return _modules$().list;
    }

    /// @notice Installs waiting on the next occupancy transition.
    function pendingModules() external view returns (address[] memory) {
        return _modules$().pendingAdds;
    }

    function isModuleInstalled(address module) external view returns (bool) {
        return module == _moduleHead() || _modules$().index[module] != 0;
    }

    function moduleData(address module)
        external
        view
        returns (ModuleData memory)
    {
        return _modules$().data[module];
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNALS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Call from the host's `_applyPendingUpdates`, so installs land on the
     *      same transition boundary every other deferred change does.
     */
    function _applyPendingModules() internal {
        ModulesStorage storage $ = _modules$();
        uint256 n = $.pendingAdds.length;
        if (n == 0) return;

        address head = _moduleHead();
        for (uint256 i; i < n; ++i) {
            address module = $.pendingAdds[i];
            // Re-checked because a queue outlives the conditions that filled
            // it: between queueing and this transition the head may have been
            // swapped to this same address, or the cap reached.
            if (module == head || $.index[module] != 0) continue;
            if ($.list.length >= MAX_MODULES) break;

            $.list.push(module);
            $.index[module] = $.list.length;
            $.data[module] = ModuleData({
                installedAt: uint64(block.timestamp),
                topics: _readTopics(module)
            });
            _lifecycle(module, IModuleLifecycle.onInstall.selector);
            emit ModuleInstalled(module);
        }
        delete $.pendingAdds;
    }

    /**
     * @notice Fan one hook out to the head and every gallery module.
     *
     * @dev Failures stay swallowed, per module. Utilities are advisory, and one
     *      broken module must never be able to block a buy — still less a
     *      liquidation. The gas stipend bounds a hostile one; the swallow
     *      bounds a merely broken one.
     */
    function _notifyModules(
        uint32 topic,
        string memory name,
        bytes memory data
    ) internal {
        // The head is always notified: it predates subscriptions and has no
        // snapshot, so assuming "everything" is the only safe reading of a
        // module that never got to say otherwise.
        address head = _moduleHead();
        if (head != address(0)) _call(name, head, data);

        ModulesStorage storage $ = _modules$();
        uint256 n = $.list.length;
        for (uint256 i; i < n; ++i) {
            address m = $.list[i];
            if ($.data[m].topics & topic == 0) continue;
            _call(name, m, data);
        }
    }

    /// @dev A module's declared subscription, or everything if it declares
    ///      none. Gas-capped and fail-open like every other module call: a
    ///      module that reverts here is simply subscribed to all topics, which
    ///      is the pre-existing behaviour rather than a new failure mode.
    function _readTopics(address module) internal view returns (uint32) {
        (bool ok, bytes memory ret) = module.staticcall{
            gas: MODULE_LIFECYCLE_GAS
        }(abi.encodeCall(IModuleTopics.topics, ()));
        if (!ok || ret.length < 32) return TOPIC_ALL;
        uint32 declared = abi.decode(ret, (uint32));
        // A module subscribing to nothing is almost certainly a mistake or a
        // stub returning zero; treat it as "everything" rather than silently
        // installing something that will never be called.
        return declared == 0 ? TOPIC_ALL : declared;
    }

    /// @dev Fire an optional lifecycle callback. Swallowed and capped: these
    ///      run inside occupancy transitions, and a module must never be able
    ///      to block a buy — still less its own removal.
    function _lifecycle(address module, bytes4 selector) internal {
        (bool ok, ) = module.call{gas: MODULE_LIFECYCLE_GAS}(
            abi.encodeWithSelector(selector, uint256(0), bytes(""))
        );
        if (!ok) emit ModuleCallFailed("lifecycle");
    }

    /// @dev Emits the protocol's existing `ModuleCallFailed(string)` so the
    ///      failure signal indexers already watch keeps working unchanged now
    ///      that one hook fans out to several modules.
    function _call(string memory name, address module, bytes memory data)
        private
    {
        (bool ok, ) = module.call{gas: MODULE_GAS}(data);
        if (!ok) emit ModuleCallFailed(name);
    }

    function _isPendingAdd(ModulesStorage storage $, address module)
        private
        view
        returns (bool)
    {
        uint256 n = $.pendingAdds.length;
        for (uint256 i; i < n; ++i)
            if ($.pendingAdds[i] == module) return true;
        return false;
    }

    function _dropPendingAdd(ModulesStorage storage $, address module)
        private
        returns (bool)
    {
        uint256 n = $.pendingAdds.length;
        for (uint256 i; i < n; ++i) {
            if ($.pendingAdds[i] != module) continue;
            $.pendingAdds[i] = $.pendingAdds[n - 1];
            $.pendingAdds.pop();
            return true;
        }
        return false;
    }
}
