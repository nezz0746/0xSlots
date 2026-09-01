# `sell()` + offer book — plan

## The gap

`Slot` has only half a voluntary transfer surface.

- **`buy()`** — anyone may take occupancy, at the price the occupant set.
- **missing** — the occupant may hand occupancy to anyone, at a price *they* set.

Everything below falls out of adding the second half. The offer book is then
ordinary periphery, not a core concept.

## Decisions already made

**Liquidation does NOT consult offers.** Running dry is a forfeit; the position
opens free. This is deliberate, and it is what removed the operator delegation,
the `selfAssess(1)` trust surface, the keeper, and the race with `liquidate()`.
Do not reintroduce it.

**`release()` is untouched.** It still pays zero and stays `onlyOccupant`. The
client hides it while a live offer exists and offers "sell at N" instead.

**No `setOperator` in this design.** `sell()` is occupant-initiated. The operator
path was the previous plan and is abandoned.

**Not named `sellTo`.**

## 1. Core: `sell()`

```solidity
function sell(address buyer, uint256 price) external nonReentrant onlyOccupant
```

Mirror of `buy()`. Steps, in this order:

1. `_settle()` — materialises any matured pending transfer, same as `buy`.
2. `checkBuy` on `occupancyPolicy` for `buyer`, if one is set.
3. Pull `price` from `buyer` on allowance. **Pull, not a callback** — no
   reentrancy surface, and any EOA or contract can be a counterparty just by
   approving.
4. Transfer occupancy; pay the outgoing occupant; refund their remaining
   deposit exactly as `release()` does.
5. Notify the utility, same as the other transitions.

### The invariant that must not be fluffed

`sell()` transfers occupancy, so it **must run `checkBuy`**. Skip it and every
occupancy policy silently becomes a suggestion — a tenure or token-holder
policy could be handed a buyer it would have refused. Same for settling first.

### Notes

- The occupant naming a low price only hurts the occupant. No guard needed.
- `buyer` may be a contract (an offer book, an auction) or an EOA (OTC).
- Storage ends at slot 24 with headroom; nothing new is needed for `sell()`.

## 2. Periphery: the offer book

A standalone contract. There may be many; `Slot` knows about none of them.

- Offers escrow **full price + a deposit covering minimum runway**.
- Cancellable, with expiry.
- **Price-ordered, best first** — the old `SlotQueue` was FIFO, which took the
  oldest bid rather than the best. Do not repeat that.
- Pre-approves the slot for `price` so the occupant's `sell()` can pull.
- Keep the tipped, permissionless fill for the vacant case (that part of the
  old `SlotQueue` was fine).

### Lifecycle

Alice occupies at 100. Bob offers 80.

| event | result | Alice receives |
|---|---|---|
| anyone `buy()` | new occupant at 100 | 100 |
| Alice `sell(bob, 80)` | Bob occupies at 80 | 80 |
| Alice `release()` | vacant | 0 |
| Alice drains → `liquidate()` | vacant, bounty to caller | 0 |

## 3. Open decisions

- **Slippage guard on `sell()`** — a `minPrice` argument, or leave it to the
  caller since the occupant names the price directly? Leaning: not needed,
  because the occupant states `price` rather than accepting a quoted one.
- Whether the book exposes `bestOffer(slot)` as a view for the client, or the
  client derives it from logs (consistent with the Tribune rule).

## 4. Deferred, deliberately

**Scoped operators.** `isOperator` is currently a single unbounded grant —
`selfAssess(1)` plus a colluding buy extracts the whole position, so the
documented boundary ("operators may not move principal") is already untrue.

The fix is `{ uint32 flags; uint256 floorPrice; }` per operator: an operator may
reprice or sell but never below the floor. Worth doing even with no expansion of
reach, since it retroactively bounds the existing grant. **Prerequisite for any
delegated/agent use case.** Not needed for `sell()`.

## Repo state

- Branch `slot-data` — `SlotData.sol` + 19 tests (generic data module). This plan
  lives here.
- Branch `seat-game` — `SeatPot.sol` + board UI.
- `main` — stream collective work still unstaged.
- Historical: `SlotQueue.sol` / `QueueExclusivityPolicy.sol` recoverable from
  commit `229a972` (FIFO, vacancy-only fill; superseded by this plan).
