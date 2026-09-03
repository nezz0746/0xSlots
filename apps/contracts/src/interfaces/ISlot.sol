// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISlot {
    // ─── events ─────────────────────────────────────────────────────────────
    //
    // Declared on the storage base rather than beside the functions that emit
    // them, because the concern layers above all emit into the same log and a
    // consumer reads one ABI. Keeping the vocabulary in one place is also the
    // only way to see it whole.

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
    event OperatorSet(address indexed operator, bool allowed);
    event TermsProposed(
        uint256 taxPercentage,
        address hook,
        bytes32 hookData,
        bool tax,
        bool hook_
    );
    event ProposalCancelled(bool tax, bool hook);
}
