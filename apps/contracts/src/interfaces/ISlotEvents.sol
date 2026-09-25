// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaxTerms, ModuleTerms, ModuleFee} from "../types/SlotTypes.sol";

/**
 * @title ISlotEvents
 * @notice The slot's occupancy and terms vocabulary, in one place.
 *
 * @dev Events only. The accounting layer keeps `Settled`, `TaxPaid`,
 *      `TaxCollected`, `ModuleFeePaid`, `Credited`, `Claimed`, `TermsApplied`,
 *      `ModuleDropped` and `ScopesDropped`; `SlotModules` keeps `ModuleCallFailed`.
 */
interface ISlotEvents {
    event Initialized(
        address indexed currency,
        address indexed manager,
        bool mutableTax,
        bool mutableRecipient,
        bool mutableModule,
        TaxTerms taxTerms,
        ModuleTerms moduleTerms
    );
    event Bought(
        address indexed buyer,
        address indexed from,
        uint256 price,
        uint256 deposit,
        uint256 paid
    );
    event Released(address indexed occupant, uint256 refund);
    event Liquidated(address indexed by, address indexed occupant);
    event PriceSet(address indexed by, uint256 oldPrice, uint256 newPrice);
    event Deposited(address indexed by, uint256 amount, uint256 total);
    event Withdrawn(address indexed occupant, uint256 amount, uint256 left);
    /// @dev `tenureId` is not decoration. An approval is keyed by the tenure
    ///      and dies silently when somebody else is seated, so a log without it
    ///      cannot be replayed into `isOperator`.
    event OperatorSet(
        address indexed operator,
        bool allowed,
        uint64 indexed tenureId
    );
    /// @dev `taxTerms` and `moduleTerms` carry only the fields named by `mask`; the
    ///      rest are zero.
    event TermsProposed(TaxTerms taxTerms, ModuleTerms moduleTerms, uint16 mask);
    event TermsCancelled(uint16 mask);
    event ManagerSet(address indexed previous, address indexed next);
    /// @dev The fee applies from now on.
    event FeeAccepted(ModuleFee fee);
    /// @dev Queued under `TERM_SCOPES` for the next buy.
    event ScopesAccepted(uint16 scopes);
}
