# SlotBoundNFTWrapper — design

**Status:** design, not built. Every protocol dependency it needs is deployed
and tested; nothing below requires a core change.

## What it is

`SlotBoundNFT` mints a token backed by nothing: the slot is the asset, and
occupancy is the only market for it. `SlotBoundNFTWrapper` keeps that lifecycle
exactly and changes what sits underneath — an ERC-721 you already own, escrowed
here, with a wrapper token bound to the slot's occupancy.

So `mint(valuation)` becomes `wrap(underlying, id, taxBps, valuation, mode)`.

The point is a market in *use* of an asset rather than title to it. A depositor
puts a token in, names a tax rate, and collects that tax from whoever occupies.
Occupants buy the seat and the standing it carries; they never take the
underlying home. Where the asset goes when nobody wants the seat is the
depositor's choice, made once, at wrap.

## What it is not

Not a variant of `SlotBoundNFT` and not deployed by the same path as one. A
collection fixes its terms for every token it will ever mint; a wrapper fixes
almost nothing, because each deposit brings its own asset and its own rate.
`MAX_SUPPLY`, `totalMinted`, the shared `SlotInit`, and the `Ownable` metadata
owner all lose their reason to exist. What survives is the lifecycle, and the
lifecycle is the whole point of copying it.

## Shape

One wrapper is monolithic and permissionless: any ERC-721, any depositor, one
wrapper token per deposit, unbounded supply. Wrappers are deployed by
`SlotBoundNFTFactory` as `BeaconProxy` instances behind an `UpgradeableBeacon`
the factory owns — the `SlotCollectiveFactory` pattern, copied.

```
SlotBoundNFTFactory (UUPS)
  ├── new SlotBoundNFT(...)            existing, immutable, unchanged
  └── new BeaconProxy(wrapperBeacon)   SlotBoundNFTWrapper
                                         └── N × Slot (one per wrap)
```

A wrapper therefore takes only a `name` and a `symbol` at creation:

```solidity
struct WrapperInit { string name; string symbol; }
```

That is
thin, and it is the honest consequence of per-depositor terms: there is nothing
else a wrapper could fix that a wrap does not decide for itself.

## Terms, built per wrap

Assembled in `wrap()` and handed to `SlotFactory.createSlot`:

| `SlotInit` field | Value | Why |
|---|---|---|
| `currency` | `address(0)` — native ETH | Constant on the implementation |
| `minDepositSeconds` | `7 days` | Constant on the implementation |
| `taxBps` | the depositor's, `0 < taxBps <= MAX_TAX_BPS` | The one lever they get |
| `recipient` | the depositor | They own the asset; they earn its rent |
| `manager` | the depositor | May re-rate later, under the core's deferral |
| `hook` / `hookData` | `address(this)` / `bytes32(0)` | Mode lives in wrapper storage, not here |
| `mutableTax` | `true` | Safe: see below |
| `mutableHook` | **`false`** | Mandatory — a detachable hook strands the token |

`mutableTax: true` is safe because of a property the core already guarantees and
`SlotAdmin` states outright: *"A manager cannot change anything under a sitting
occupant: terms ripen for `TERMS_DELAY` and then land at the next occupancy
transition."* `proposeTerms` only ever queues, and `_applyPending` runs solely
from `buy`, `release` and `liquidate`. A depositor cannot re-rate, evict, or
liquidate someone who is sitting in their slot. Without that property, depositor
-as-manager plus depositor-as-withdrawer would be a rug, and this design would
not work.

`minDepositSeconds` and `currency` being implementation constants rather than
storage means a beacon upgrade changes them **for future wraps only** — every
existing slot holds its own copy, set at `initialize` and never written again.

## The wrap call

```solidity
function wrap(
    IERC721 underlying,
    uint256 underlyingId,
    uint256 taxBps,
    uint256 valuation,
    Mode mode
) external payable nonReentrant returns (uint256 tokenId, address slot);
```

The depositor is seated at `valuation` and pays **only the escrow deposit**.
`msg.value` funds the deposit and nothing else. `SlotBoundNFT.mint` charges
`valuation + deposit` because there the valuation is a primary sale paid to a
separate `recipient`; here the depositor *is* the recipient, so that leg would
be a round trip of their own money. The freshly created slot is vacant at price
zero, so the buy costs nothing beyond the deposit.

`msg.value` is forwarded whole as the deposit and the floor is left to the slot
to enforce — asked of it, not computed here, as `SlotBoundNFT._seat` already
does. Anything above the floor is simply longer runway. A zero `valuation` is
refused by the core, so it needs no check here either.

`tokenId = ++totalWrapped`, so an id is never zero and `tokenOf`'s
zero-means-not-ours stays sound.

Ordering follows `mint` and is load-bearing: pull the underlying in, create the
slot, write `slotOf` / `tokenOf` / `wrapped`, `_mint` to the wrapper, then seat.
The mappings must be written **before** the buy, because the buy calls
`afterBuy` back mid-frame and `_sync` reads `tokenOf` to decide whether the slot
is one of ours.

## Modes

Fixed at wrap, immutable, publicly readable:

- **`Permanent`** — the underlying never leaves. The wrapper is its final owner.
- **`Reclaimable`** — the depositor may withdraw it when nobody is occupying.

**The occupant never redeems, in either mode.** This is a market in occupancy,
not a way to buy the asset.

The mode must be readable before anyone buys, because it changes what a seat is
worth: a permanently committed asset and one that goes home the moment you leave
are not the same product. It is stored on the wrapper and exposed by a view, not
buried in `hookData`.

## Lifecycle — unchanged from `SlotBoundNFT`

Copied wholesale, because it is correct and because divergence here would be a
second thing to keep right:

- `subscriptions()` declares `beforeBuy`, `afterBuy`, `afterRelease`,
  `afterLiquidate`, and **`strict`** — the flag that makes holding real ERC-721
  ownership state safe, since the move cannot be starved.
- `_sync(slot)` reads `occupant()` **live**, never from `ctx`. The `after` entry
  points are world-callable, so a forged context must be able to change nothing.
  Vacant syncs the token back to the wrapper.
- `_update` refuses every transfer but a mint and a `_sync` move. The token is
  soulbound to occupancy.

## Withdrawal

`withdraw(tokenId)`, and only when all of these hold:

1. `mode == Reclaimable`
2. `msg.sender == depositor` (stored at wrap, not read from the slot)
3. the slot is **vacant**, *or* the depositor is themselves the sitting occupant

Clause 3's second arm closes a real race. Without it the depositor must buy the
slot back, `release()`, then `withdraw()` in a second transaction — and anyone
can take the vacant slot in between, for the price of their own deposit. Letting
a depositor who is already the occupant withdraw directly removes the window,
and costs nothing in safety: when they hold the seat, no third party has a claim
on it.

`depositor` is stored rather than read back as the slot's `recipient` so the
withdrawal right cannot be moved by anything happening slot-side.

Vacancy is read live from `occupant()`. An insolvent-but-not-yet-liquidated
occupant still reads non-zero, so withdrawal is *blocked* until someone actually
calls `liquidate()` — the failure is in the safe direction. `liquidate()` is
permissionless but only fires once the deposit is genuinely empty
(`if (_deposit > 0) revert NotInsolvent()`), so a depositor can clear a defaulted
occupant without being able to manufacture the default.

Order inside `withdraw`: mark retired, burn the wrapper token, **then** transfer
the underlying out, under `nonReentrant`. Permissionless wrapping means arbitrary
ERC-721 code runs on the way out.

## Retirement — two hooks, two different reasons

The part most easily got wrong. Retirement is not bookkeeping; it needs both of
these, and each covers a failure the other does not:

**`beforeBuy` reverts `SlotRetired()`.** Nobody may occupy a slot backed by
nothing. It has to be a named veto. The tempting tidy-up — clearing
`tokenOf[slot]` on withdrawal — sends `_sync` down its `if (tokenId == 0)
return;` *"not ours; never revert on a stranger"* path, and the buy **succeeds**:
someone pays to occupy a slot with no asset and no token. Leaving `tokenOf` set
instead happens to revert, inside OpenZeppelin's `_transfer`, as
`ERC721NonexistentToken` — safe today by accident of a library's internal
ordering, which is not where a security property belongs.

`beforeBuy` resolves the slot from `msg.sender`, not from `ctx.slot`. The slot is
the caller when the veto matters, and a veto read out of a caller-supplied
struct is a veto someone can arrange to miss.

**And `subscriptions()` must declare `beforeBuy`, from the very first wrap.**
`_readHookFlags` packs the flags into the slot's `_hookFlags` at its own
`initialize`, and `_before` consults that bit forever after. A wrapper shipped
without the subscription leaves every slot it ever creates permanently unable
to refuse a buy, and **no beacon upgrade can retrofit it** — the bit is
per-slot storage, written once. Found in implementation, not in review:
`test_TheRetirementVetoIsSubscribedFromTheFirstWrap` pins both halves.

**`_sync` returns early when retired.** `release()` and `liquidate()` must still
settle after a withdrawal. Without this, a depositor who withdraws while
occupying can never release: `afterRelease` reverts on a burned token, `strict`
propagates it, and **their deposit is stuck in the slot forever.**

## Metadata

`tokenURI(tokenId)` proxies to the underlying's `tokenURI`, in a `try/catch`
returning `""` on failure — the underlying is arbitrary and may revert, and a
wrapper token that cannot render is better than one that cannot be read at all.
Reverts `NoSuchToken` for an unwrapped or retired id.

This removes `Ownable`, `setBaseURI`, `_baseURI` and the metadata owner role
entirely. A wrapper has no privileged party at all.

## Accepting deposits

`onERC721Received` returns its selector **only** during a `wrap()` call, gated by
a transient flag in the manner of `_syncing`, and reverts `UnsolicitedTransfer()`
otherwise. A wrapper that accepts anything sent to it strands NFTs that arrive
with no wrap record, and it has no rescue path by design.

## Storage

```solidity
enum Mode { Permanent, Reclaimable }

struct Wrap {
    address underlying;    // ─┐ one slot
    Mode mode;             //  │
    bool retired;          // ─┘
    address depositor;
    uint256 underlyingId;
}

mapping(uint256 tokenId => Wrap) public wrapped;
mapping(uint256 tokenId => address slot) public slotOf;
mapping(address slot => uint256 tokenId) public tokenOf;  // zero means not ours
uint256 public totalWrapped;
```

## Finding a wrapper token from its underlying

`tokenIdOf(underlying, underlyingId)` returns the live wrapper token, or zero.
Backed by `mapping(bytes32 => uint256)` keyed on `keccak(underlying, id)`, set
in `wrap` and deleted in `withdraw`.

**Why the token id stays a plain counter.** Deriving it from the underlying —
`keccak(underlying, id)`, or a packed `uint160(underlying) << 96 | uint96(id)`
you could decode by eye — would let an integration compute it offline. It also
breaks re-wrapping, which `Reclaimable` makes a first-class flow.

A derived id gives a re-wrap the SAME id as the retired wrap before it. Its
`retired` flag is still set, so the new wrap is born vetoed and un-withdrawable.
Reset the record to fix that and the old slot becomes the casualty:
`tokenOf[oldSlot]` still points at that id, `beforeBuy` now reads the new wrap's
`retired == false`, and **the dead slot is buyable again** — failure mode one,
resurrected. One `retired` flag cannot serve two slots.

It is fixable by keying retirement on the slot rather than the token, and the
packed variant additionally truncates ids to 96 bits or refuses the collections
that overflow. Neither cost buys much: the `Wrapped` event already carries
`tokenId`, `slot`, `depositor`, `underlying` and `underlyingId` together, so
indexers have the mapping for free and clients are making RPC calls anyway.
A counter plus one lookup is the cheaper correct answer.
`test_ReWrappingAfterAWithdrawalGetsAFreshId` pins the scenario.

## Factory changes

`SlotBoundNFTFactory` is live on Base at
`0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4`, version 2, with slots 0–3 occupied
by `slotFactory`, `admin`, `isCollection`, `collectionCount`. New state
**appends** at slot 4:

```solidity
UpgradeableBeacon public wrapperBeacon;      // slot 4
mapping(address => bool) public isWrapper;   // slot 5
uint256 public wrapperCount;                 // slot 6
```

- `version()` → **3**, in the same commit as the change.
- `initializeWrappers(address impl) external reinitializer(2) onlyAdmin` creates
  the beacon. It cannot go in `initialize`, which already ran on the live proxy.
  **`onlyAdmin` is load-bearing**: a `reinitializer` on an external function is
  otherwise callable by anyone, and the caller would be choosing the
  implementation behind every wrapper.
- `createWrapper(WrapperInit calldata) returns (address)`, salted
  `keccak256(abi.encode(block.chainid, "wrapper", wrapperCount))`. The literal is
  a domain separator: collection and wrapper counters both start at zero, and
  while differing initcode already separates the two CREATE2 addresses, the
  reader should not have to derive that.
- `upgradeWrapperBeacon(address) external onlyAdmin`, kept distinct from the
  collective factory's beacon.
- `CollectionInit`, `createCollection` and `SlotBoundNFT` are **untouched**.

The wrapper implementation inherits `Versioned` alone, at version 1. Beacon
implementations must not carry an upgrade entry point of their own; upgrading
them is the beacon's job.

Behind a proxy the wrapper uses `ERC721Upgradeable` with `__ERC721_init` — a
constructor-set name and symbol would simply be empty — and plain
`ReentrancyGuard` from `@openzeppelin/contracts`, which is what `Slot` does
behind its own beacon.

## Accepted risks

**The beacon key is hot, and this is the sharpest place in the protocol to put
one.** `SlotBoundNFTFactory` argues in its own comments that collections are
`new` "and permanently so", because behind a beacon "whoever held its key could
rewrite what `ownerOf` means for tokens people already hold, and could make
`_sync` revert, which under `strict` turns every slot in that collection into a
permanent hold." For a wrapper the key also owns `withdraw`, so it can drain
every escrowed NFT. This is authority over other people's assets, not only over
their positions.

Taken deliberately, consistent with the same trade already made for collectives.
The mitigations, in order of cost: put a timelock on `upgradeWrapperBeacon`; move
the factory admin to a multisig; or drop the beacon and deploy wrappers as
minimal clones, which the collective factory already notes as a live option for
itself. None are in scope here.

**A vacancy is a free grab.** `liquidate()` says it plainly: *"a vacant slot
costs only the taker's own deposit."* `_vacate()` zeroes the price, so whoever
takes an empty seat names their own. A squatter can take one at 1 wei and pay
almost no tax — and because tax is `price × rate × time`, their deposit never
drains and they are never liquidatable.

Self-assessment answers this: a seat declared at 1 wei can be bought back for
1 wei, by the depositor or anyone else. To actually exclude, a squatter must
declare a high price and pay real rent for it. What remains is a nuisance — the
depositor pays a buy-back plus a fresh 7-day deposit to defend — not theft. A
price floor would mean the wrapper vetoing in `beforeBuy`, which is real
complexity against an attack that pays the attacker nothing. Documented, not
fixed.

**The wrapper is the permanent `ownerOf` externally.** Airdrops to holders,
snapshot governance and token-gated access all see the wrapper, never the
occupant. In `Reclaimable` mode the depositor eventually gets the asset back; in
`Permanent` mode anything sent to the holder is stranded forever. There is no
sweep function, and adding one would be a honeypot — an admin who can move
arbitrary tokens out of escrow. Wrap assets whose value is the token itself.

## Test plan

Mirroring `test/slots/SlotBoundNFT.t.sol`, whose scenarios carry over directly.

Lifecycle parity:
- wrapping seats the depositor and delivers the token
- buying the slot moves the token, and emits a real `Transfer`
- releasing parks it back with the wrapper
- liquidation moves it too
- the occupant cannot sell the token; nor can an approved operator
- a forged callback cannot steal the token
- a stranger cannot claim a token with their own slot
- the hook is strict, and permanent

Terms:
- the depositor is the slot's recipient and its manager
- the depositor's chosen rate is the slot's rate; zero and above-max are refused
- a queued re-rate cannot touch a sitting occupant, and lands at the next
  transition
- a wrap at zero valuation is refused by the core

Withdrawal:
- `Permanent` refuses withdrawal in every state
- `Reclaimable` refuses it while a stranger occupies
- `Reclaimable` allows it when vacant
- `Reclaimable` allows it when the depositor is the sitting occupant
- a non-depositor cannot withdraw
- an insolvent occupant blocks withdrawal until someone liquidates
- the underlying arrives back with the depositor, once

Retirement — the two failure modes above, named:
- **buying a retired slot reverts `SlotRetired()`**
- **a depositor who withdraws while occupying can still `release()` and gets
  their deposit back**
- a retired slot's `tokenURI` reverts `NoSuchToken`

Hostile underlyings:
- a reentrant ERC-721 cannot re-enter `withdraw`
- an underlying whose `tokenURI` reverts still renders as `""`
- an unsolicited `safeTransferFrom` reverts `UnsolicitedTransfer()`

Factory:
- `initializeWrappers` is refused to a non-admin
- an existing collection is unaffected by the upgrade (fork test against Base)
- the factory's storage layout appends and does not shift

## Out of scope

Occupant redemption; price floors; any claim path for airdrops reaching the
wrapper; ERC-1155; wrapping into an existing slot rather than a fresh one.
