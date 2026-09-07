// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The slice of a slot the book talks to.
///
/// @dev Declared here rather than imported from `Slot`, so the book compiles
///      against a signature list and not against an implementation. The two are
///      deployed independently and only ever meet across an ABI boundary — and
///      the book is deliberately replaceable, so it must not drag the core in
///      behind it.
///
///      This list used to name `sell`, `sellOrderHash`, `orderNonce` and
///      `orderUsed`. The core no longer has them: a consensual sale is
///      `selfAssess` then `buy`, and the book performs both. What it needs from
///      the slot is therefore the ordinary market surface plus the two writes,
///      which is why nothing here is sale-specific any more.
interface ISellableSlot {
    function occupant() external view returns (address);
    function price() external view returns (uint256);
    function deposit() external view returns (uint256);
    function currency() external view returns (address);

    /// @dev What `buy` will charge `account` for `depositAmount` of escrow:
    ///      the sitting price, the escrow, and any arrears that account owes.
    function quoteBuy(address account, uint256 depositAmount)
        external
        view
        returns (uint256);

    /// @dev The escrow floor at `price_`. `selfAssess` enforces it, so raising
    ///      a price can require a top-up first.
    function minDepositForBuy(uint256 price_) external view returns (uint256);

    /// @dev True while `operator` may reprice on the CURRENT occupant's behalf.
    ///      Keyed by tenure on the far side, so it goes false by itself the
    ///      moment the slot changes hands.
    function isOperator(address operator) external view returns (bool);

    // ── the two writes a sale is made of ────────────────────────────────────

    function selfAssess(uint256 newPrice) external;

    function buy(
        address account,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) external payable;
}
