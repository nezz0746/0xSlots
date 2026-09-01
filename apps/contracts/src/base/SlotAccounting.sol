// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

import {SlotStorage} from "./SlotStorage.sol";
import {SlotModules} from "../SlotModules.sol";

/**
 * @title SlotAccounting
 * @notice Tax accrual, settlement, payout, and the utility fan-out.
 *
 * @dev Storage-free: it operates on `SlotStorage`'s variables and declares
 *      none of its own. See the warning there for why that matters.
 *
 *      Sits between `SlotStorage` and every behavioural mixin because all of
 *      them settle before they act — a buy, a release and a liquidation each
 *      begin by realising the tax owed up to this instant.
 */
abstract contract SlotAccounting is SlotStorage, SlotModules {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _occupancyCtx(
        address account,
        uint256 newPrice,
        uint256 depositAmount
    ) internal view returns (OccupancyContext memory) {
        return
            OccupancyContext({
                slot: address(this),
                caller: msg.sender,
                account: account,
                occupant: occupant(),
                occupiedSince: occupiedSince,
                taxPercentage: taxPercentage,
                currentPrice: price(),
                newPrice: newPrice,
                depositAmount: depositAmount
            });
    }

    /// @dev Accrue tax for the current occupant up to `upTo`.
    function _accrue(uint256 upTo) internal {
        if (upTo <= lastSettled) return;

        if (_occupant == address(0)) {
            lastSettled = upTo;
            return;
        }

        uint256 elapsed = upTo - lastSettled;
        // `mulDiv`, not `a * b / c`. The plain form multiplies before it
        // divides, so a large self-assessed price overflowed uint256 and
        // reverted — and because `_settle()` is the first statement of every
        // entry point, that reverted `liquidate()` too. A slot could be
        // permanently bricked, and its occupant made un-evictable, for the
        // price of gas. The 512-bit intermediate removes the overflow entirely;
        // the quotient always fitted.
        uint256 owed = Math.mulDiv(
            _price,
            taxPercentage * elapsed,
            MONTH * BASIS_POINTS
        );

        uint256 paid;
        if (owed >= _deposit) {
            paid = _deposit;
            collectedTax += _deposit;
            _deposit = 0;
        } else {
            paid = owed;
            _deposit -= owed;
            collectedTax += owed;
        }
        lastSettled = upTo;

        emit Settled(owed, paid, _deposit);

        if (paid > 0) {
            // Attributed to `_occupant`, which is still the payer here: every
            // entry point calls `_settle()` before it reassigns occupancy, so
            // a buy charges the OUTGOING occupant for their own tenure.
            address payer = _occupant;
            emit TaxPaid(payer, owed, paid);
            _notifyUtility(
                TOPIC_SETTLE,
                "onSettle",
                abi.encodeCall(
                IUtility.onSettle, (0, payer, owed, paid))
            );
        }
    }

    function _settle() internal {
        _accrue(block.timestamp);
    }

    function _applyPendingUpdates() internal {
        // Land queued module installs on the same transition boundary every
        // other deferred change uses. Without this call the gallery was inert:
        // `addModule` queued, emitted, charged gas, and nothing ever installed.
        _applyPendingModules();

        if (pendingPolicyUpdate.hasPolicyUpdate) {
            address newPolicy = pendingPolicyUpdate.newPolicy;
            occupancyPolicy = newPolicy;
            delete pendingPolicyUpdate;
            policyProposedAt = 0;
            emit PolicyUpdateApplied(newPolicy);
            emit UpdateApplied(UpdateKind.Policy, _asValue(newPolicy));
        }

        if (!pendingUpdate.hasTaxUpdate && !pendingUpdate.hasUtilityUpdate)
            return;

        uint256 newTax = taxPercentage;
        address newMod = utility;

        // The per-kind events fire only for what actually changed, which is the
        // distinction `PendingUpdateApplied` cannot draw: it carries both
        // fields on every apply, filling the unchanged one in from current
        // state, so a reader sees a utility "change" to the value it already
        // had. Both are emitted — the flat one for existing indexers, the
        // per-kind ones for anything that needs to know what moved.
        if (pendingUpdate.hasTaxUpdate) {
            newTax = pendingUpdate.newTaxPercentage;
            taxPercentage = newTax;
            taxProposedAt = 0;
            emit UpdateApplied(UpdateKind.Tax, bytes32(newTax));
        }
        if (pendingUpdate.hasUtilityUpdate) {
            newMod = pendingUpdate.newUtility;
            utility = newMod;
            utilityProposedAt = 0;
            emit UpdateApplied(UpdateKind.Utility, _asValue(newMod));
        }

        delete pendingUpdate;

        emit PendingUpdateApplied(newTax, newMod);
    }

    /// @dev Widens an address to the `bytes32` the per-kind events carry, so
    ///      one event shape can describe a rate and two contract addresses.
    function _asValue(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    function _minDepositFor(uint256 price_) internal view returns (uint256) {
        if (minDepositSeconds == 0) return 0;
        return
            Math.ceilDiv(
                price_ * taxPercentage * minDepositSeconds,
                MONTH * BASIS_POINTS
            );
    }

    function _enforceMinDeposit(
        uint256 depositAmount,
        uint256 price_
    ) internal view {
        uint256 minDep = _minDepositFor(price_);
        if (depositAmount < minDep) revert InsufficientDeposit();
    }

    function _enforceMinDepositExisting(uint256 price_) internal view {
        uint256 minDep = _minDepositFor(price_);
        if (_deposit < minDep) revert InsufficientDeposit();
    }

    /// @dev True when this slot's market is denominated in native ETH.
    ///      `address(0)` is a sound sentinel because `initialize` rejected it
    ///      outright before native support existed, so no slot predating this
    ///      change can be holding it.
    function _isNative() internal view returns (bool) {
        return address(currency) == address(0);
    }

    /// @dev Pay `to`, and if the currency refuses, credit them instead so the
    ///      slot itself never becomes unusable.
    ///
    ///      This is a try-push-then-credit, not a bare pull payment: the happy
    ///      path (any well-behaved token, any unblocked recipient) still
    ///      settles atomically, which is what every caller and integrator
    ///      already expects, while a blocklisting token or a reverting
    ///      recipient degrades to a claimable credit instead of bricking every
    ///      entry point through `_settle()`.
    ///
    ///      Deliberately a raw `call` rather than `safeTransfer`: SafeERC20
    ///      reverts internally and an internal library call cannot be
    ///      try/caught. The success condition mirrors SafeERC20's — the call
    ///      must succeed AND either return nothing or return true — with the
    ///      extra requirement that the currency actually has code, so a
    ///      codeless address can never be mistaken for a successful payment.
    function _payOrCredit(address to, uint256 amount) internal {
        if (amount == 0) return;

        bool paid;
        if (_isNative()) {
            // Gas-capped deliberately. Unlike an ERC-20 transfer, a native send
            // runs the recipient's code — and this fires inside SOMEONE ELSE'S
            // transaction (a buy, a liquidation). Uncapped, an outgoing occupant
            // with a gas-burning `receive()` could make their own eviction
            // expensive and unreliable. 30k covers an EOA (2300) and a typical
            // Safe (~20k); anything greedier degrades to a claimable credit,
            // which `claim()` then delivers at full gas.
            (paid, ) = to.call{value: amount, gas: 30_000}("");
        } else {
            address token = address(currency);
            if (token.code.length > 0) {
                (bool ok, bytes memory data) = token.call(
                    abi.encodeCall(IERC20.transfer, (to, amount))
                );
                paid = ok && (data.length == 0 || abi.decode(data, (bool)));
            }
        }

        if (!paid) {
            withdrawableOf[to] += amount;
            emit RefundCredited(to, amount);
        }
    }

    /// @dev Query the utility fee and split tax between utility and recipient.
    ///
    ///      Both legs pay through `_payOrCredit`. `recipient` is chosen by
    ///      whoever creates the slot and is never validated beyond being
    ///      non-zero, so a plain `safeTransfer` here handed the creator a trap:
    ///      point `recipient` at a contract that reverts on receipt (or let a
    ///      blocklisting currency freeze it) and every path that flushes tax —
    ///      `collect`, `release`, `liquidate` — reverts forever. An insolvent
    ///      occupant then cannot be removed and cannot leave, because
    ///      `release` flushes tax too. Crediting instead keeps liquidation
    ///      unconditional, which is this protocol's first invariant, and leaves
    ///      the recipient whole via `claim()` whenever they can receive again.
    /// @dev Tax goes to the recipient. All of it.
    ///
    ///      This used to ask the `utility` head two questions first — what is
    ///      your fee, and who should receive it — and split the tax
    ///      accordingly. That mechanism is gone, and its removal cost nothing:
    ///      every module ever deployed (`MetadataModule`, `FeedPostModule`,
    ///      and `AdModule` which inherits the first) returned `feeBps() == 0`.
    ///      It was live, load-bearing in three findings, and earning no one
    ///      anything.
    ///
    ///      What went with it:
    ///
    ///      - Two un-gas-capped `staticcall`s into an untrusted, creator-chosen
    ///        contract, sitting inside `liquidate()` — the one path this
    ///        protocol promises is unconditional.
    ///      - A retroactive redirect: the fee was read LIVE at payout and
    ///        applied to the whole accumulated pot, so a module could quote 0%
    ///        while tax accrued and 100% just before a `collect()`.
    ///      - The mirror of that: detaching the head erased a module's earned
    ///        fee on tax already collected, since nothing was ever checkpointed.
    ///
    ///      Modules that want revenue charge at their own entry points, where
    ///      they have a direct relationship with the payer (`AdModule` already
    ///      does this), or a splitter is placed at `recipient`. Neither needs
    ///      anything from the core, and neither can reach into this path.
    ///
    ///      There are now NO external calls in tax distribution beyond paying
    ///      the recipient, which is what makes the flush unconditional by
    ///      construction rather than by careful defence.
    function _distributeTax(uint256 amount) internal {
        _payOrCredit(recipient, amount);
    }

    /// @dev Fans out to `utility` AND every installed gallery module. Kept
    ///      under the old name so the six call sites read unchanged; the
    ///      per-module gas stipend and swallowed failures live in
    ///      `SlotModules._notifyModules`.
    function _notifyUtility(
        uint32 topic,
        string memory name,
        bytes memory data
    ) internal {
        _notifyModules(topic, name, data);
    }

    function _emitProtocolEvent(uint8 eventType, bytes memory data) internal {
        if (factory == address(0)) return;
        try SlotFactory(factory).emitEvent(eventType, data) {} catch {}
    }
}
