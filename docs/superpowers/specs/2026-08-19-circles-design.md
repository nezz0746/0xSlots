# Circles — design

**Status:** proposed, not started. Awaiting approval on the open decisions in §2.
**Date:** 2026-08-19

---

## 1. What we are building

Three things, in this order:

1. **Contracts** — `CircleHub` (UUPS factory that owns an `UpgradeableBeacon`) minting
   `Circle` beacon proxies. A circle is *an admin plus a set of seats*. Seats are real
   `Slot` beacon proxies from the existing `SlotFactory`, created with `SlotData` as
   their utility and **no occupancy policy**.
2. **Local stack** — a deploy script, a seed script, and ponder sources so the new
   contracts are indexed on anvil alongside the rest of the protocol.
3. **`apps/circles`** — a Next.js app that is wallet-gated at the root. No marketing
   surface, no `/app` sub-path; `/` *is* the product. Twitter-shaped layout: "Circles"
   top-left, `/` is a feed (a welcome card for now), `/seats` lists every seat as
   available or occupied and each one opens.

### Why seats are `Slot`s and not a new mapping

`SlotData` derives its write permission from `ISlotBuy(slot).occupant()` and clears on
the slot's `onTransfer` / `onRelease` hooks. It only works against something that *is*
a slot. Rolling our own seat registry would mean re-implementing the tenancy lifecycle
that `SlotData` was built on — and losing the indexer, the ABIs and the SDK that
already understand slots. A circle is therefore a thin composition over the protocol,
not a parallel one.

"Not occupancy" is read as: seats plug in a **utility** (`SlotData`) and leave
`occupancyPolicy = address(0)` — anyone may take a free seat, instantly. Occupancy in
the plain sense (someone sits there) is still what the seats page renders; there is
just no policy gating who may sit.

---

## 2. Open decisions

Everything below is decided-with-a-default so implementation is not blocked. Say the
word on any of them and the default changes.

| # | Decision | Default taken | Why |
|---|---|---|---|
| D1 | Seats are protocol `Slot`s vs. a bespoke registry | Protocol `Slot`s | `SlotData` requires it; see above |
| D2 | Seat currency | Native ETH (`address(0)`) | No approve step in the demo flow |
| D3 | Seat tax rate | `0` bps | A circle seat is membership, not rent. Nobody gets liquidated in v0 |
| D4 | `mutableTax` / `mutablePolicy` / `mutableUtility` | `false` / **`true`** / **`true`**, `manager = circle` | Mutable policy is the *only* way to add an NFT gate later without redeploying every seat — see §9. Mutable utility lets the circle move off `SlotData`. Tax stays pinned so "free forever" is a real promise |
| D5 | Circle admin model | Single `admin` address + `transferAdmin` | "Original admin" — `AccessControl` can arrive in a beacon upgrade |
| D6 | Which circle the app shows | `hub.circles(0)` by default, switcher in the sidebar when >1 | Keeps `/` and `/seats` as literal routes, as asked |
| D7 | App reads | Indexer for lists and the feed, chain multicall for the seat you are acting on | The pattern `apps/landing` already uses (`use-slot-onchain.ts` + `use-post-tx-refresh.ts`) |
| D8 | Chains | anvil `31337` only | Explicitly asked. Ponder circle sources are gated behind `PONDER_LOCAL=1` |

**One thing to verify during implementation, not now:** whether `Slot.buy` accepts
`depositAmount = 0` on a `taxPercentage = 0` native slot. If it does not, D3 becomes
"1 bps with `minDepositSeconds = 0`" and the claim flow gains a dust deposit. A test
answers this on day one.

---

## 3. Contracts

New directory `apps/contracts/src/circles/`.

### `CircleHub.sol`

Deliberately the same shape as `SlotCollectiveFactory`: UUPS proxy for the hub, an
`UpgradeableBeacon` owned by the hub from construction (not by an EOA — the mainnet
one-shot fix that `SlotCollectiveFactory` documents is avoided by construction).

```solidity
function initialize(
    address admin,              // upgrades the hub and the beacon
    address circleImplementation,
    address slotFactory,        // the existing SlotFactory proxy
    address slotData,           // the SlotData proxy
    uint256 profileServiceId    // the SlotData service seats write against
) external;

function createCircle(
    string calldata name,
    string calldata metadataURI,
    address circleAdmin,        // the "original admin"
    uint256 initialSeats
) external returns (address circle);

function circles(uint256) external view returns (address);
function circleCount() external view returns (uint256);
function isCircle(address) external view returns (bool);

function upgradeBeacon(address newImplementation) external;   // onlyAdmin
function transferAdmin(address newAdmin) external;            // onlyAdmin

event CircleCreated(
    address indexed circle,
    address indexed admin,
    address indexed deployer,
    string name,
    uint256 seatCount
);
```

`profileServiceId` lives on the hub, not per circle: every circle writes profiles
against the same `SlotData` service so one client decoder serves all of them.

### `Circle.sol`

Beacon proxy, `Initializable`. Everything it does, it does by calling `SlotFactory`.

```solidity
address public hub;
address public admin;
string  public name;
string  public metadataURI;

address[] public seats;                       // Slot addresses, in creation order
mapping(address => uint256) public seatIndex; // 1-based; 0 = not a seat here

function initialize(address hub, address admin, string name, string metadataURI, uint256 initialSeats) external initializer;

function createSeats(uint256 count) external;           // onlyAdmin
function setMetadataURI(string calldata uri) external;  // onlyAdmin
function transferAdmin(address newAdmin) external;      // onlyAdmin

// Manager relays. The circle is every seat's `manager`; without these the
// power is stranded behind a beacon upgrade. Both go through the protocol's
// own rules — proposed, applied at the next occupancy change.
function proposeSeatPolicy(address seat, address policy) external;   // onlyAdmin
function proposeSeatUtility(address seat, address utility) external; // onlyAdmin

function seatCount() external view returns (uint256);
function allSeats() external view returns (address[] memory);  // one call for the UI

event SeatCreated(address indexed seat, uint256 indexed index);
event AdminTransferred(address indexed previous, address indexed next);
event MetadataURIUpdated(string uri);
```

Seat creation is one `SlotFactory.createSlots` call:

```
recipient  = address(this)                 // seat tax, if ever non-zero, flows to the circle
currency   = address(0)                    // native
config     = { mutableTax: false, mutableUtility: true, mutablePolicy: true, manager: address(this) }
initParams = { taxPercentage: 0, utility: slotData, liquidationBountyBps: 0,
               minDepositSeconds: 0, occupancyPolicy: address(0) }
```

The circle being its own `manager` is what makes D4 real: adding an NFT gate later is
`circle.proposeSeatPolicy(seat, policy)` relaying to `Slot.proposePolicyUpdate` — admin-gated,
applied at the next occupancy change by the protocol's own rules, so it cannot shift
under a sitting holder.

### The `SlotData` profile service

Registered once at deploy time (registration is permissionless by design):

```
name:   "circle.profile"
schema: "string handle,string avatarURI,string bio,address pfpCollection,uint256 pfpTokenId"
```

`pfpCollection` / `pfpTokenId` are in the schema **from day one** even though nothing
reads them yet. Adding a field later means a second service id and two decoders
forever; two unused words cost nothing. See §9.

---

## 4. Local deploy and seed

Two new forge scripts, appended to the local stack rather than folded into
`DeployLocal.s.sol` — the existing pinned CREATE2 addresses stay untouched and the
circles half stays independently re-runnable.

**`script/DeployCircles.s.sol`**
1. Deploy `SlotData` impl + ERC1967 proxy (CREATE2, pinned salt like its siblings),
   `initialize(deployer)`.
2. `SlotFactory.setModuleVerified(slotData, true)`.
3. `slotData.registerService(...)` → capture the id.
4. Deploy `Circle` impl, `CircleHub` impl, hub proxy (CREATE2, pinned), initialize.
5. Write `deployments/31337/{SlotData,CircleHub,CircleImplementation}.json`.

**`script/SeedCircles.s.sol`**
- One circle, "Genesis", admin = anvil[0], 12 seats.
- Alice and Bob claim two seats each and write a profile through
  `SlotData.buyAndWrite` — so the app opens onto something, not an empty grid.

**`scripts/dev-chain.sh`** gains both calls after the existing deploy/seed pair, and
prints the hub address in the ready banner.

---

## 5. Indexing

Extend `packages/ponder`. Circle sources are added **only under `PONDER_LOCAL=1`**,
matching the existing "local mode is a full replacement, not an addition" rule — there
is nothing to index on base yet, and a log filter that can never match is a cost with
no return.

**Sources**
- `CircleHub` — plain contract at the local address.
- `Circle` — `factory()`-derived children from `CircleCreated`.
- `SlotData` — plain contract; `ServiceRegistered`, `Wrote`, `Cleared`.

**Seats are already indexed.** They are `SlotFactory`-deployed slots with the circle as
`recipient`, so the existing `SlotDeployed` handler writes their rows today. The circle
handler only has to draw the edge.

**Schema additions** (additive — no existing table moves):

| Table | Key | Holds |
|---|---|---|
| `circle` | `(id, chainId)` | admin, name, metadataURI, seatCount, createdAt, txHash |
| `circleSeat` | `(circle, slot)` | seat index, so a seat resolves to its circle and back |
| `dataService` | `serviceId` | schema, name, registrar, metadataURI |
| `seatData` | `(slot, serviceId)` | current-generation payload, writer, generation, updatedAt |
| `seatDataWrite` | event id | append-only history — the feed's raw material later |

`seatData` is upserted on `Wrote` and deleted on `Cleared` (the generation bump *is*
the clear — a stale row would be the one bug in this that looks like a UI bug).

**Handlers:** `src/circle.ts`, `src/slotdata.ts`.

---

## 6. The app — `apps/circles`

Next.js 16 · React 19 · Tailwind 4 · wagmi 3 · viem 2 · shadcn — the same stack as
`apps/landing`, port **3400**. `@0xslots/contracts` and `@0xslots/config` as workspace
deps; new ABIs exported from `packages/contracts`.

### The wallet gate

`app/layout.tsx` → `Providers` (wagmi + react-query + RainbowKit) → `WalletGate`.
Disconnected renders a single full-screen connect panel and nothing else — no shell, no
nav, no route is reachable behind it. Connected renders the shell and `children`.

Anvil dev accounts come straight from `apps/landing/src/config/anvil-connectors.ts`:
mock connectors pinned to the anvil RPC, one per unlocked account, dev-build only.
That file and `dev-account-switcher.tsx` are worth **moving to a shared package**
(`@0xslots/config/anvil` or a small `packages/dev-wallet`) rather than copied — two
copies of a connector list drift, and this one has a documented footgun in it.

### Layout

Left rail: "Circles" wordmark top-left, then Home / Seats, the circle switcher when
there is more than one, and the connected account at the bottom. Centre column holds
the page. Mobile collapses the rail to a bottom tab bar.

### Routes

| Route | Content |
|---|---|
| `/` | Feed. "Welcome to Circles" card plus an empty-state — the feed is filled later from `seatDataWrite` |
| `/seats` | Every seat in the active circle as a card: index, holder (blockie + ENS), available/occupied badge, profile handle when written. Click through |
| `/seats/[address]` | One seat. Free → *Take this seat*. Yours → edit profile, leave seat. Someone else's → their profile, read-only |

Vocabulary follows `docs/seat-ux.md`: seat, holder, take, leave. No "slot", no "bps",
no "self-assessed" anywhere in the UI.

### Actions

- **Take a free seat** — `SlotData.buyAndWrite(seat, 0, 0, profileServiceId, encoded)`,
  one transaction that claims and publishes. Claiming and writing separately leaves a
  window where the seat is held with nothing on it.
- **Edit profile** — `SlotData.write`.
- **Leave** — `Slot.release()`.

---

## 7. Testing

Foundry, TDD, one behaviour per test:

- `CircleHub` — create, admin gating, `isCircle` provenance, beacon upgrade reaches
  every live circle, re-initialisation reverts.
- `Circle` — initial seats created with exactly the params in §3, `createSeats` is
  admin-only, `allSeats` matches `seatCount`, admin transfer, and the manager relays
  reject a seat that is not this circle's.
- Integration — a seat is claimable by anyone, `SlotData` writes are gated on the
  holder, a write is cleared when the seat changes hands, and the circle can propose a
  new occupancy policy that takes effect on the next turnover.

App: no test infrastructure exists in `apps/landing` and this plan does not invent one.
Verification is the seeded local chain plus the flows above, run by hand.

---

## 8. Build order

1. `Circle` + `CircleHub` with tests. Nothing else moves until these are green.
2. `DeployCircles.s.sol` + `SeedCircles.s.sol`, wired into `dev-chain.sh`.
3. ABIs exported from `packages/contracts`.
4. Ponder schema, sources and handlers; verify against the seeded chain.
5. `apps/circles` scaffold, providers, wallet gate, shell.
6. `/` welcome feed.
7. `/seats` and `/seats/[address]` with take / write / leave.
8. Extract the anvil connectors into a shared package (or leave a tracked TODO if it
   turns out to drag `apps/landing` around more than it is worth).

---

## 9. NFTs as identity — the question, answered

There are four genuinely different things "NFT as identity" can mean here, and they are
not alternatives so much as rungs. The important part of the answer is that **only one
of them has to be decided before we write the first contract**; the rest can arrive
whenever.

### The one decision that cannot be retrofitted

A slot's `occupancyPolicy` and its `mutablePolicy` flag are set **at creation and are
immutable thereafter**. If seats ship with `mutablePolicy: false`, then gating a circle
on an NFT collection later means deploying new seats and abandoning the old ones —
every profile, every history, every link.

So: **create seats with `mutablePolicy: true` and `manager = circle`** (D4). It costs
one boolean today and keeps every rung below reachable. This is the whole reason it is
in the defaults.

### Rung 1 — verified PFP (no new contracts, days)

The profile schema already carries `(address pfpCollection, uint256 pfpTokenId)`. The
holder writes them; the client calls `ownerOf` and renders the token's image with a
"verified" ring when it matches the seat's holder, greyed when it does not. Nothing on
chain to build, nothing to migrate, and it is the rung that actually makes a circle
*look* like an identity surface. Verification is a read, so a sold PFP degrades
gracefully the moment anyone looks.

### Rung 2 — the NFT as membership gate (contract exists, hours)

`TokenHolderPolicy` is already in the repo: *only holders of collection X may take this
seat*. Point a circle's seats at one and the circle becomes a token-gated club, with
the protocol's own guarantee that a policy change applies at the next occupancy change
rather than under a sitting holder.

Two properties worth knowing before choosing it, both documented in that contract:
membership is checked **at entry only** (selling your token does not evict you — it
only stops you retaking a seat), and the gate is a **snapshot**, so a token borrowed
for one transaction satisfies it. For a club that is fine. For anything adversarial it
is not, and the answer is a collection that records holding duration itself.

`AllOfPolicy` / `OneOfPolicy` compose these, so "holds the club NFT **or** the founder
NFT" is configuration, not code.

### Rung 3 — the circle mints its own membership NFT (new contract, ~a week)

The `Circle` mints a **soulbound** ERC-721 when someone takes a seat and burns it when
they leave, with a `tokenURI` rendering the seat and its profile. The membership then
shows up in every wallet and every NFT-aware surface without those surfaces knowing
what a circle is.

The rule that keeps this from being a footgun: **the seat stays the single authority,
and the NFT is a mirror.** Two transferable representations of one membership means two
answers to "who holds seat 4", and they will disagree the first time someone sells.
Soulbound, minted and burned only by the circle on the seat's own hooks, and there is
only ever one answer.

### Rung 4 — the NFT *is* the account (ERC-6551, a project)

A token-bound account holds the seat, so the whole identity — seat, profile, anything
else it accumulated — transfers when the NFT transfers. This is the real "NFT as
identity" and it is also the largest step: TBAs, a registry, and a UX where the thing
you connect is not the thing that acts.

Worth noting the repo already contains the inverse experiment: `ERC721Slots` makes each
token *backed* by a slot with ownership defined as occupancy and `transferFrom`
disabled. Rung 4 is the same idea pointed the other way.

### One thing that is not an NFT problem

`SlotData` clears on transfer — deliberately, that is the point of the generation
counter. So a profile belongs to **a tenancy**, not to a person: leave your seat, take
another, and your handle does not follow you. For a seat-scoped presence that is
correct. The moment identity is meant to be *portable* — the same handle across
circles, surviving a move — `SlotData` is the wrong home for it and the answer is
either a registry keyed by address or, precisely, an NFT.

That is the real argument for rungs 3 and 4, and it is worth being explicit that v0
does not have it: **in v0 your identity is your seat.**

### Recommendation

Ship v0 with `mutablePolicy: true` and the pfp fields in the schema — that is the whole
cost of keeping the door open. Then rung 1 when the seats page needs faces, rung 2 the
first time a circle wants to be private, and rungs 3 and 4 only when identity genuinely
needs to outlive a seat.

---

## 10. Out of scope for v0

Feed content (the tables are built, the rendering is not), circle discovery beyond the
sidebar switcher, any chain other than anvil, splits or payouts (a circle is not a
`SlotCollective`), notifications, and app-level tests.
