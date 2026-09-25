// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Scopes} from "../../interfaces/ISlotModule.sol";
import {ModuleLib} from "../../libraries/ModuleLib.sol";
import {ScopesLib} from "../../libraries/ScopesLib.sol";
import {TermsLib} from "../../libraries/TermsLib.sol";
import {ModuleTerms, ModuleFee, Terms, Pending} from "../../types/SlotTypes.sol";
import {NotManager, InvalidRecipient} from "../../errors/SlotErrors.sol";
import {VersionedUUPS} from "../../utils/VersionedUUPS.sol";
import {Versioned} from "../../utils/Versioned.sol";

/// @notice One slot, whole, as of one block.
///
/// @dev Everything a client needs to render a slot, in a single call, so no
///      two figures can straddle a block.
struct SlotInfo {
    // governance
    IERC20 currency;
    address manager;
    bool mutableTax;
    bool mutableRecipient;
    bool mutableModule;
    Terms terms;
    Scopes scopes;
    ModuleFee fee;
    // occupancy
    address occupant;
    uint256 price;
    uint256 deposit;
    uint64 occupiedSince;
    uint64 tenureId;
    uint64 lastSettled;
    // money, as of this block
    uint256 taxOwed;
    uint256 collectedTax;
    bool isVacant;
    bool isInsolvent;
    uint256 secondsUntilLiquidation;
    Pending pending;
    /// Whether `pending` lands at the next buy.
    bool hasRipeTerms;
}

/// @notice A slot's fixed numbers, in one call.
struct SlotConstantsInfo {
    uint256 maxPrice;
    uint256 maxTaxBps;
    uint256 basisPoints;
    uint256 month;
    uint256 moduleCallbackGasLimit;
    uint256 nativePayoutGasLimit;
    uint64 termsDelay;
    uint256 maxMinRunway;
    /// `TERM_*` bits for `proposeTerms` and `cancelTerms`.
    uint16 termTaxRate;
    uint16 termRecipient;
    uint16 termMinRunway;
    uint16 termModule;
    uint16 termScopes;
}

/// @notice What a slot's module declares today, beside the slot's copy.
struct ModuleUpdate {
    /// The slot's copy, as `ScopesLib` bits.
    uint16 currentScopes;
    ModuleFee currentFee;
    /// Whether the module answered, under the cap the slot reads it with.
    /// False for no module, one that reverts, or an answer out of range.
    bool answered;
    uint16 declaredScopes;
    ModuleFee declaredFee;
    /// `acceptFee` would change the fee now: it differs, and a rise is allowed
    /// (`mutableRecipient`).
    bool feeDiffers;
    /// `acceptScopes` would queue new scopes: they differ, the module is
    /// mutable, no new module is queued, and they are not already queued.
    bool scopesDiffer;
}

/// @dev The slot's public reads the lens puts together. Narrow on purpose:
///      declaring the whole surface would recompile this on every change to it.
interface ISlotReads {
    function currency() external view returns (IERC20);
    function manager() external view returns (address);
    function mutableTax() external view returns (bool);
    function mutableRecipient() external view returns (bool);
    function mutableModule() external view returns (bool);
    function terms() external view returns (Terms memory);
    function moduleTerms() external view returns (ModuleTerms memory);
    function scopes() external view returns (Scopes memory);
    function fee() external view returns (ModuleFee memory);
    function occupant() external view returns (address);
    function price() external view returns (uint256);
    function deposit() external view returns (uint256);
    function occupiedSince() external view returns (uint64);
    function tenureId() external view returns (uint64);
    function lastSettled() external view returns (uint64);
    function taxOwed() external view returns (uint256);
    function collectedTax() external view returns (uint256);
    function isVacant() external view returns (bool);
    function isInsolvent() external view returns (bool);
    function secondsUntilLiquidation() external view returns (uint256);
    function pending() external view returns (Pending memory);
    function hasRipeTerms() external view returns (bool);

    function MAX_PRICE() external view returns (uint256);
    function MAX_TAX_BPS() external view returns (uint256);
    function BASIS_POINTS() external view returns (uint256);
    function MONTH() external view returns (uint256);
    function MODULE_CALLBACK_GAS_LIMIT() external view returns (uint256);
    function NATIVE_PAYOUT_GAS_LIMIT() external view returns (uint256);
    function TERMS_DELAY() external view returns (uint64);
    function MAX_MIN_RUNWAY() external view returns (uint32);
    function TERM_TAX_RATE() external view returns (uint16);
    function TERM_RECIPIENT() external view returns (uint16);
    function TERM_MIN_RUNWAY() external view returns (uint16);
    function TERM_MODULE() external view returns (uint16);
    function TERM_SCOPES() external view returns (uint16);
}

/**
 * @title SlotLens
 * @notice Reads about slots that the slot itself has no room for: a whole
 *         slot in one call, many slots in one call, its constants, and what
 *         its module would change.
 *
 * @dev Stateless apart from its admin, and asks each slot for everything
 *      through the slot's own getters. Nothing here is an authority; each
 *      answer says what the slot would do if asked. Every call runs in one
 *      block, so no two figures in an answer straddle one.
 *
 *      Outside the slot because the slot is near the 24,576-byte deploy
 *      limit, and a read that calls an untrusted module has no business inside
 *      it anyway.
 *
 *      A UUPS proxy like the factories, so a new read can be added without a
 *      new address.
 */
contract SlotLens is VersionedUUPS {
    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    /// @notice May upgrade this lens.
    address public admin;

    event AdminTransferred(address indexed from, address indexed to);

    modifier onlyAdmin() {
        _checkAdmin();
        _;
    }

    function _checkAdmin() internal view {
        if (msg.sender != admin) revert NotManager();
    }

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert InvalidRecipient();
        admin = admin_;
        emit AdminTransferred(address(0), admin_);
    }

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert InvalidRecipient();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    // ─── reads ──────────────────────────────────────────────────────────────

    /// @notice The whole slot, in one call.
    function getSlotInfo(address slot) public view returns (SlotInfo memory info) {
        ISlotReads s = ISlotReads(slot);
        info.currency = s.currency();
        info.manager = s.manager();
        info.mutableTax = s.mutableTax();
        info.mutableRecipient = s.mutableRecipient();
        info.mutableModule = s.mutableModule();

        info.terms = s.terms();
        info.scopes = s.scopes();
        info.fee = s.fee();

        info.occupant = s.occupant();
        info.price = s.price();
        info.deposit = s.deposit();
        info.occupiedSince = s.occupiedSince();
        info.tenureId = s.tenureId();
        info.lastSettled = s.lastSettled();

        info.taxOwed = s.taxOwed();
        info.collectedTax = s.collectedTax();
        info.isVacant = s.isVacant();
        info.isInsolvent = s.isInsolvent();
        info.secondsUntilLiquidation = s.secondsUntilLiquidation();

        info.pending = s.pending();
        info.hasRipeTerms = s.hasRipeTerms();
    }

    /// @notice Several slots, whole, in one call. Reverts if any one is not a slot.
    function getSlotInfos(address[] calldata slots)
        external
        view
        returns (SlotInfo[] memory infos)
    {
        infos = new SlotInfo[](slots.length);
        for (uint256 i; i < slots.length; ++i) {
            infos[i] = getSlotInfo(slots[i]);
        }
    }

    /// @notice Every constant `slot` runs under, in one call. Asked of the slot
    ///         rather than copied here, so a beacon upgrade cannot leave the
    ///         lens reporting old numbers.
    function getSlotConstants(address slot) external view returns (SlotConstantsInfo memory c) {
        ISlotReads s = ISlotReads(slot);
        c.maxPrice = s.MAX_PRICE();
        c.maxTaxBps = s.MAX_TAX_BPS();
        c.basisPoints = s.BASIS_POINTS();
        c.month = s.MONTH();
        c.moduleCallbackGasLimit = s.MODULE_CALLBACK_GAS_LIMIT();
        c.nativePayoutGasLimit = s.NATIVE_PAYOUT_GAS_LIMIT();
        c.termsDelay = s.TERMS_DELAY();
        c.maxMinRunway = s.MAX_MIN_RUNWAY();
        c.termTaxRate = s.TERM_TAX_RATE();
        c.termRecipient = s.TERM_RECIPIENT();
        c.termMinRunway = s.TERM_MIN_RUNWAY();
        c.termModule = s.TERM_MODULE();
        c.termScopes = s.TERM_SCOPES();
    }

    /**
     * @notice What `slot`'s module declares today, and whether accepting it
     *         would change anything. A quote: it changes nothing.
     *
     * @dev Never reverts on a module that misbehaves: it is read fail-open,
     *      under a third of the slot's `MODULE_CALLBACK_GAS_LIMIT` per read,
     *      which is what the slot allows when a module lands.
     */
    function moduleUpdate(address slot) external view returns (ModuleUpdate memory u) {
        ISlotReads s = ISlotReads(slot);
        u.currentScopes = ScopesLib.pack(s.scopes());
        u.currentFee = s.fee();

        ModuleTerms memory t = s.moduleTerms();
        if (t.module == address(0)) return u;

        (u.answered, u.declaredScopes, u.declaredFee) =
            ModuleLib.tryRead(t.module, t.settings, s.MODULE_CALLBACK_GAS_LIMIT() / 3);
        if (!u.answered) return u;

        u.feeDiffers = !ModuleLib.sameFee(u.declaredFee, u.currentFee)
            && (u.declaredFee.bps <= u.currentFee.bps || s.mutableRecipient());

        Pending memory p = s.pending();
        bool moduleQueued = p.mask & TermsLib.MODULE != 0;
        bool alreadyQueued =
            p.mask & TermsLib.SCOPES != 0 && p.nextModule.scopes == u.declaredScopes;
        u.scopesDiffer = s.mutableModule() && !moduleQueued && !alreadyQueued
            && u.declaredScopes != u.currentScopes;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
