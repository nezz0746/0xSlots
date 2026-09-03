// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISlotEvents
 * @notice The slot's occupancy and terms vocabulary, in one place.
 *
 * @dev Events, and nothing else — there is no function here, and `SlotStorage`
 *      inherits this purely to bring the vocabulary into scope. The three
 *      FUNCTION surfaces are declared where they are consumed and are named for
 *      it: `ISellableSlot`, `ISlotAd`, `IManagedSlot`.
 *
 *      Declared on an interface rather than beside the functions that emit
 *      them, because the concern layers all emit into one log and a consumer
 *      reads one ABI.
 *
 *      NOT the whole vocabulary, and it is worth saying so rather than
 *      implying otherwise: the accounting layer keeps `Settled`, `TaxPaid`,
 *      `TaxCollected`, `Credited`, `Claimed`, `TermsApplied` and
 *      `HookDetached`; `SlotHooks` keeps `HookCallFailed`; `SlotOrders` keeps
 *      `OrderCancelled`. Each sits with the invariant it reports on.
 */
interface ISlotEvents {

    event Initialized(address indexed recipient, address indexed currency);
    event Bought(
        address indexed buyer,
        address indexed from,
        uint256 price,
        uint256 deposit,
        uint256 paid
    );
    event Sold(
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 deposit
    );
    event Released(address indexed occupant, uint256 refund);
    event Liquidated(address indexed by, address indexed occupant);
    event PriceSet(address indexed by, uint256 oldPrice, uint256 newPrice);
    event Deposited(address indexed by, uint256 amount, uint256 total);
    event Withdrawn(address indexed occupant, uint256 amount, uint256 left);
    /// @dev `tenureId` is not decoration. An approval is keyed by the tenure
    ///      and dies silently when somebody else is seated — there is no
    ///      revocation event — so a log without it cannot be replayed into
    ///      `isOperator`. An indexer would show a previous occupant's bot as a
    ///      co-signer on an asking price its owner never approved anyone for.
    event OperatorSet(
        address indexed operator,
        bool allowed,
        uint64 indexed tenureId
    );
    /// @dev `hook` is indexed because "which slots proposed hook X" is the
    ///      query anyone actually runs; `SlotFactory.HookAttested` already
    ///      indexes the same thing.
    ///
    ///      The flags were `tax` and `hook_` — the trailing underscore existed
    ///      only to dodge the collision with `hook`, and landed in generated
    ///      clients looking like a typo. They are named for what they mean, and
    ///      for what `proposeTerms` calls them.
    event TermsProposed(
        uint256 taxPercentage,
        address indexed hook,
        bytes32 hookData,
        bool changeTax,
        bool changeHook
    );
    event ProposalCancelled(bool cancelTax, bool cancelHook);
}
