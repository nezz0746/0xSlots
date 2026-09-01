// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlotConfig, SlotInitParams, MAX_PRICE, MAX_TAX_BPS} from "./interfaces/ISlot.sol";
import "./interfaces/SlotErrors.sol";
import {SlotOccupancy} from "./base/SlotOccupancy.sol";
import {SlotEscrow} from "./base/SlotEscrow.sol";
import {SlotAdmin} from "./base/SlotAdmin.sol";
import {SlotViews} from "./base/SlotViews.sol";
import {SlotModules} from "./SlotModules.sol";

/// @title Slot — Immutable & modular Harberger-taxed slot
/// @notice One slot = one contract. Deployed deterministically via SlotFactory.
///
/// @dev All slots share one implementation behind a beacon, so the storage
///      layout is APPEND-ONLY and permanent: 237+ live proxies hold state at
///      fixed offsets. Some of it is inert. It still cannot move.
///
///      Versioning lives in `reinitializer(n)` and nowhere else — not in
///      function names, not in comments. The history of how the layout got this
///      way is in git; what the chain still depends on is in `SlotStorage`.
///
///      ── Reading this contract ──────────────────────────────────────────────
///
///      The behaviour is split across bases, each answering one question:
///
///        SlotStorage     what a slot remembers, and in what order
///        SlotAccounting  how tax accrues, settles and is paid out
///        SlotOccupancy   taking, pricing and giving up a seat
///        SlotEscrow      where money leaves
///        SlotAdmin       manager-controlled terms, and the delay guarding them
///        SlotViews       reads
///        SlotModules     the module gallery (ERC-7201 namespaced)
///
///      ── Why the inheritance order is not stylistic ────────────────────────
///
///      Solidity allocates base storage BEFORE the derived contract's own, and
///      in linearization order. `SlotStorage` therefore has to be reached
///      first, which it is: every other base descends from it. All of them are
///      storage-free, except `SlotModules`, which is namespaced under ERC-7201
///      and so contributes nothing to this layout regardless of position.
///
///      Reordering this list, or adding an ordinary state variable to any base
///      other than `SlotStorage`, moves every live proxy's state and is
///      unrecoverable. `forge inspect Slot storage` is the gate.
// `SlotModules` is NOT listed here: it is inherited through `SlotAccounting`,
// which needs it so the hook fan-out is reachable from the settle path. Listing
// it again would make the C3 linearization impossible.
contract Slot is SlotOccupancy, SlotEscrow, SlotAdmin, SlotViews {
    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Set up a slot. Called by `SlotFactory` in the proxy constructor.
    /// @dev The only initializer, and the only place a slot's terms are set.
    ///      Everything arrives at once — recipient, currency, tax, utility,
    ///      occupancy policy, factory — so there is no window in which a slot
    ///      exists half-configured and no version to track.
    ///
    ///      A slot's policy is therefore part of its founding terms. One created
    ///      without a policy is a plain-Harberger slot; it can still gain one
    ///      later through `proposePolicyUpdate`, but only if its creator chose
    ///      mutability. Nobody can install one retroactively over that choice.
    function initialize(
        address _recipient,
        IERC20 _currency,
        SlotConfig memory _config,
        SlotInitParams memory _init,
        address _factory
    ) external initializer {
        // Guard on STATE, not just on OZ's version counter.
        //
        // `initializer` only checks the ERC-7201 `_initialized` word, which is
        // zero on any proxy initialized before this contract adopted
        // `Initializable` — see the `_legacyInitialized` flag at slot 14, kept
        // precisely because such proxies exist. Those slots would sail through
        // the modifier and let anyone rewrite `recipient` and `manager` on a
        // live, occupied slot.
        //
        // `recipient` is non-zero after every initialization path this contract
        // has ever had (the very next line makes zero impossible), so it is a
        // reliable "already in use" witness where the counter is not.
        if (recipient != address(0)) revert SlotAlreadyInitialized();
        if (_recipient == address(0)) revert InvalidRecipient();
        // `address(0)` is the native-ETH sentinel — deliberately valid. Any
        // other address must actually be a contract: a codeless non-zero
        // currency used to pass this check and produce a slot whose every
        // transfer silently no-ops.
        if (
            address(_currency) != address(0) &&
            address(_currency).code.length == 0
        ) revert InvalidCurrency();
        if (_init.taxPercentage == 0 || _init.taxPercentage > MAX_TAX_BPS)
            revert InvalidTaxPercentage();
        // `liquidationBountyBps` is accepted and NORMALISED TO ZERO rather
        // than rejected. Bounties are retired, so the value is meaningless —
        // but it sits in a struct every existing caller already passes, and
        // rejecting a non-zero default would break creation for every
        // integration at upgrade time to enforce a field that no longer does
        // anything. The stored value is what is read back, so state never
        // claims a bounty that will not be paid.
        if (
            _init.occupancyPolicy != address(0) &&
            _init.occupancyPolicy.code.length == 0
        ) revert InvalidModule_NoCode();

        recipient = _recipient;
        currency = _currency;
        mutableTax = _config.mutableTax;
        mutableUtility = _config.mutableUtility;
        mutablePolicy = _config.mutablePolicy;
        manager = _config.manager;

        taxPercentage = _init.taxPercentage;
        utility = _init.utility;
        liquidationBountyBps = 0; // retired — see above
        minDepositSeconds = _init.minDepositSeconds;
        occupancyPolicy = _init.occupancyPolicy;

        factory = _factory;
        lastSettled = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════
    // MODULE GALLERY WIRING
    // ═══════════════════════════════════════════════════════════

    /// @inheritdoc SlotModules
    /// @dev The manager owns terms, and installing a module is a change of
    ///      terms — same authority that proposes tax and policy changes, and
    ///      deliberately the same `NotManager()` on refusal.
    function _requireModuleAdmin() internal view override {
        if (msg.sender != manager) revert NotManager();
    }

    /// @inheritdoc SlotModules
    /// @dev The factory is where verification lives; a slot asks it rather than
    ///      keeping its own allowlist, so one verification serves every slot.
    function _moduleRegistry() internal view override returns (address) {
        return factory;
    }

    /// @inheritdoc SlotModules
    /// @dev `utility` remains the head of the effective module list rather than
    ///      being migrated into the gallery. That is what lets 237+ proxies
    ///      predating the gallery need no migration transaction, and what keeps
    ///      `utility()` and the deprecated `module()` meaning exactly what they
    ///      always meant to callers that will never be redeployed.
    function _moduleHead() internal view override returns (address) {
        return utility;
    }

    /// @inheritdoc SlotModules
    /// @dev Gated on `mutableUtility` because that flag is a promise made at
    ///      creation: a slot that advertised an immutable utility must not be
    ///      able to drop it later, any more than it could have swapped it.
    ///
    ///      Vacating is not deferred to the next transition the way installing
    ///      is. Removing only withdraws behaviour from the occupant, so there
    ///      is nobody to protect by waiting — and this is the lever for
    ///      detaching a head found to be broken.
    function _clearModuleHead() internal override {
        _requireModulesMutable();
        utility = address(0);
    }

    /// @inheritdoc SlotModules
    /// @dev `mutableUtility` predates the gallery and governed a single field.
    ///      It governs the whole module set now, which is the same promise read
    ///      honestly: it always meant "what holding this slot grants is fixed".
    function _requireModulesMutable() internal view override {
        if (!mutableUtility) revert ModuleNotMutable();
    }
}
