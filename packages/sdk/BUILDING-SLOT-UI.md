# Building a slot auction UI

Everything a front end has to know to put a slot on screen and let people act
on it, organised by the role doing the acting. Written after building
Slotmarket, and every trap in it is one that shipped, was wrong, and was found
by reading the chain rather than the screen.

Import from `@0xslots/sdk/slots`. React bindings are at
`@0xslots/sdk/slots/react` (`useSlotsClient`, `useSlotAction`).

---

## 1. The model, in the order a UI needs it

A slot is held by one **occupant** at a price they set themselves. Anyone may
take it at that price, at any time. The occupant pays rent on their own number,
drawn continuously from an **escrow** they posted. When the escrow runs dry
they can be evicted by anyone.

Three consequences drive nearly every screen:

- **The price is a standing offer, not an asking price.** There is no accept
  step and no negotiation. A UI that renders it as a listing is lying.
- **Holding costs money over time.** The figure people actually need is the
  **runway** — how long the escrow lasts — and it is derived, not stored.
- **Raising your price raises your rent.** The two move together, and a form
  that separates them will mislead.

---

## 2. Read once, render everything: `slotState`

```ts
const state = await slots.slotState(slot);
```

One call returns occupant, price, deposit, taxOwed, isVacant, isInsolvent,
secondsUntilLiquidation, currency, taxBps, minDepositSeconds, recipient,
manager, hook, hookData, hookFlags, pending terms and collectedTax.

Prefer it over assembling individual reads. The individual getters exist
(`price`, `deposit`, `occupant`, `taxOwed`, …) and are fine for a single figure,
but a panel built from six of them can render six different instants.

**Poll it.** Occupancy changes without your user doing anything. Slotmarket
polls slot state every 5s and token lists every 10s.

### Derived figures you will need

```ts
rentPerMonth = (price * taxBps) / 10_000n            // the contract's own formula
escrowLeft   = deposit > taxOwed ? deposit - taxOwed : 0n
runway       = (escrowLeft * MONTH_SECONDS * BASIS_POINTS) / (price * taxBps)
```

`secondsUntilLiquidation` returns `2^256 - 1` when the escrow outlives the
arithmetic. Render that as a symbol, never as a number of days.

---

## 3. Who may do what

| Action | Who | Precondition |
|---|---|---|
| `buy` | anyone except the sitting occupant | price > 0, funded, hook allows |
| `selfAssess` | occupant **or** their operator | escrow still covers the floor at the new price |
| `topUp` | **anyone** | slot not vacant |
| `withdraw` | occupant only | what remains still covers the floor |
| `setOperator` | occupant only | — |
| `release` | occupant only | — |
| `liquidate` | **anyone** | occupied, and escrow fully drained |
| `collect` | **anyone** | some rent has accrued |
| `claim` | **anyone**, on anyone's behalf | that address is owed a failed payout |
| `proposeTerms` / `cancelTerms` | manager only | the dimension is mutable |
| `setBaseURI` | collection owner only | slot-bound collections only |

Two of these surprise people, so say it in the copy:

- **`topUp` is permissionless.** Anyone can fund anyone's slot. That is what
  makes a keeper possible with no protocol permission.
- **`collect` and `liquidate` pay the caller nothing.** Collect sends accrued
  rent to the slot's recipient. Liquidate just opens the slot; taking it is a
  second transaction. Label them so nobody presses them expecting a reward.

Only render what the viewer can actually do. An action shown and then refused
reads as a permissions bug rather than as a state that has not arrived.

---

## 4. The buyer

### Charge what the slot says, never what you computed

```ts
const cost = await slots.quoteBuy(slot, buyerAddress, depositAmount);
```

`quoteBuy` is `(occupied ? currentPrice : 0) + deposit + arrearsOf[buyer]`.

**The buyer's own valuation is not part of the payment.** They pay the *sitting
holder's* declared price, plus their deposit, plus any arrears they personally
carry from an earlier occupancy that ran dry. On a vacant slot the charge is the
deposit alone.

Deriving this locally as `newPrice + deposit` is wrong in every case and looks
right only while the input still equals the standing price. It also silently
omits arrears, which live on the account and are invisible to the client.

### Quote for the address being seated

`buy` takes an `account` to seat and is paid by `msg.sender`. They need not be
the same — that is what lets a contract acquire a slot for someone. Arrears
follow the **occupant**, so quote for the address being seated.

### Simulate before sending

```ts
await slots.simulateBuy(params);   // then
await slots.buy(params);
```

A hook's refusal is a view revert carrying its own reason — `BuyoutBelowPremium(…)`,
`TenureNotElapsed(…)`. That reason survives a simulation and nothing else. Sent
blind, the same veto arrives as a mined transaction with no reason at all, and
the best your UI can say is "it failed".

### The deposit is a choice, not a constant

`minDepositForBuy(slot, price)` is the floor. A buyer may post more, and the
natural unit is time: offer ×1/×2/×3 of `minDepositSeconds`, each labelled with
the runway it buys. `depositFor(price, taxBps, window)` prices them locally so
the options respond instantly; ask the slot for the number you actually send.

---

## 5. The occupant

### These actions are coupled — do not build three buttons

`selfAssess` re-tests the escrow floor at the **new** price without taking any
money. So raising your valuation, the most ordinary thing a holder wants, reverts
unless the escrow was already large enough. `withdraw` is the same coupling from
the other side: how much may be taken out depends on the price, and *lowering*
the price is exactly what frees escrow to take.

Use `manageTerms`, which packages the whole form:

```ts
await slots.manageTerms(slot, {
  newPrice,        // omit to leave the price alone
  topUpAmount,     // cannot be combined with withdrawAmount
  withdrawAmount,
});
```

It orders the calls the only way that satisfies both checks: **topUp →
selfAssess → withdraw**.

Compute the shortfall and fold it in silently rather than refusing:

```ts
const settled   = deposit > taxOwed ? deposit - taxOwed : 0n;
const floor     = depositFor(newPrice, taxBps, minDepositSeconds);
const margin    = rentFor(600n, newPrice, taxBps);   // see §7
const shortfall = raised && settled + chosen < floor + margin
  ? floor + margin - settled - chosen : 0n;
```

One button, one summary of what leaves the wallet. Raising a price quietly buys
the escrow it needs.

### One transaction, or two

`Slot` inherits OpenZeppelin's `Multicall`, so an ERC-20 slot does the whole form
in one transaction. **It is not payable**, so a native `topUp` cannot ride in it —
`msg.value` would be zero inside and `topUp` rejects the mismatch. Making it
payable would be worse: every delegatecall sees the same `msg.value`, so one
payment would satisfy two calls.

So on a native slot the top-up goes first and alone. `manageTerms` handles this;
your button should say how many confirmations to expect rather than letting a
second wallet prompt surprise anyone.

### Operators

`setOperator` delegates repricing only, and the grant dies with the tenure — it
is keyed by `tenureId`. There is nothing to revoke when a slot changes hands and
nothing an incoming occupant has to clean up. Retaking a slot you once held
starts a fresh tenure that approves nobody.

---

## 6. The manager

`proposeTerms(newTaxBps, newHook, newHookData, changeTax, changeHook)` queues a
change. It **never applies immediately**: terms ripen for `TERMS_DELAY` (1 day)
and land at the next occupancy transition. The terms an occupant bought into
hold for their whole tenure.

- `hookData` travels with `changeHook`, never separately. Swapping a hook and
  leaving the old configuration behind hands the new hook a word meant for
  someone else.
- Check `mutableTax` / `mutableHook` before offering the control at all. A slot
  with both false has no manager.
- `hasRipeTerms(slot)` is the chain's answer to "will the next transition
  actually land this". `pending.appliesAt` is derived locally and is the right
  thing to *render* and the wrong thing to branch on.

Telling a buyer "buying now applies these to you" inside the delay window is
false. Branch on `hasRipeTerms`.

---

## 7. Traps that cost real time

**A mined transaction is not a successful one.** `waitForTransactionReceipt`
resolves for any mined transaction and puts the outcome in `status`; it does not
throw. Every write must check:

```ts
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("mined but reverted");
```

Without this a revert stops the spinner, shows no error, and refreshes the
figures to exactly what they were. It looks like a dead button.

**Never offer the exact maximum withdrawal.** Every one of these calls
`_settle()` first, so the escrow it tests is smaller than the one you polled by
however long the transaction took to mine. The exact maximum reverts every time.
Hold back a margin measured in time — ten minutes of rent works.

**Writes return a hash, not a confirmation.** Refreshing your caches on the hash
asks the indexer about a block it has not seen. Wait for the receipt, then
invalidate.

**Zero is not a valid price.** `_buy` and `selfAssess` both reject
`selfAssessedPrice == 0`. A price of zero owes zero rent for ever, so nothing
accrues, nothing runs dry, and nothing is ever liquidatable. Note that
`quoteMint(0)` cheerfully returns a total of zero, so anything reading only the
quote will offer a free mint that cannot be minted.

**Currency is not always ETH at 18 decimals.** Read `symbol` and `decimals` off
the token. A six-decimal currency rendered at eighteen is wrong by a factor of a
trillion.

**Step prices in integers.** Percentage steppers that round to two decimals turn
0.001 raised by 10% into 0.00 — a self-assessed price of zero behind a button
that assesses at exactly that. Work in raw units throughout.

**Read the indexer for lists, the chain for figures.** The indexer knows who
owns what; only the slot knows what it currently costs, and the price is the
thing being clicked.

---

## 8. Minting, for slot-bound collections

`SlotBoundNFT` mints a token and its slot together. Ownership follows occupancy,
so the token moves whenever the slot does.

```ts
const { total, price, deposit } = await collections.quoteMint(collection, valuation);
if (!isNativeCurrency(currency)) await collections.approveMint(collection, valuation);
await collections.mint(collection, valuation);
```

A mint costs `valuation + deposit`, and that is genuinely different from a buy:
the slot is fresh, so there is no outgoing holder to pay, and your valuation goes
to the collection's recipient. Same-looking sum, different reason.

The escrow is fixed by the collection's terms — `_seat` asks the slot for
`minDepositForBuy` and passes that — so a minter has one runway and no choice
about it. Do not offer the ×1/×2/×3 control on a mint.

Approve the **collection**, not the slot. `mint` pulls the whole total to itself
before splitting it.

### The collection owner

A fourth role, and a deliberately small one. `owner` may call `setBaseURI` and
nothing else — no power over the terms, the slots, or anybody's tokens. Say so
in the UI: an owner control that looks like it could touch the rent reads as a
reason not to mint.

```ts
const uri = await collections.baseURI(collection);
await collections.setBaseURI(collection, "https://art.example/meta/");
```

`tokenURI` is the base plus the id with nothing between them, so a base that
does not end in a separator sends token 1 to `…/meta1`. Warn rather than
correct: the contract stores the string verbatim, and quietly appending a slash
makes your field disagree with the chain.

A collection with no baseURI has no art yet, and `tokenURI` returns empty. Draw
something deterministic from the slot address rather than a grey box — the grid
is most of the page, and every tile being a placeholder makes a live collection
look broken.

---

## 9. A panel that works

Three figures, read across as a sentence: **worth X, so it costs Y a month, so
it lasts Z.** Deposit, tax accrued and escrow left are the working behind the
runway, not three more readings.

Colour the runway, and never with colour alone — pair it with a word
(`31d · funded`, `29d · running low`, `0d · unfunded`). Roughly eight percent of
men cannot separate that red from that green, and this is the figure that decides
whether a position is safe. Use the slot's own `minDepositSeconds` as the amber
threshold, not a round number of days: a runway shorter than one funded window
means the slot can be taken before the window being paid for has elapsed.

Keep release, liquidate, collect and claim out of the main flow. They are real
and occasionally urgent, and none of them belongs beside the control someone came
to use. A menu with a one-line description each is enough — and those
descriptions matter, because none of these words means anything on its own.

---

## 10. Constants

| Name | Value | Meaning |
|---|---|---|
| `BASIS_POINTS` | 10 000 | denominator for `taxBps` |
| `MONTH_SECONDS` | 2 592 000 | the tax period is 30 days, **not** a year |
| `MAX_TAX_BPS` | 10 000 | 100% per month |
| `MAX_PRICE` | `type(uint128).max` | |
| `TERMS_DELAY_SECONDS` | 86 400 | how long a manager's proposal ripens |
| `NATIVE_CURRENCY_ADDRESS` | zero address | test with `isNativeCurrency` |

Reading `taxBps` as annual understates the cost of holding by a factor of twelve.
