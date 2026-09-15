# SlotBoundNFTWrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap an existing ERC-721 into the `SlotBoundNFT` occupancy lifecycle — the underlying escrowed, a slot created on the depositor's own terms, and a wrapper token soulbound to whoever occupies.

**Architecture:** One `SlotBoundNFTWrapper` is monolithic and permissionless: any ERC-721, any depositor, one wrapper token per deposit. Wrappers are `BeaconProxy` instances deployed by the existing `SlotBoundNFTFactory` behind an `UpgradeableBeacon` it owns — the `SlotCollectiveFactory` pattern. The occupancy lifecycle is copied unchanged from `SlotBoundNFT`; what is new is the escrow, two immutable per-wrap modes, and retirement.

**Tech Stack:** Solidity ^0.8.24, Foundry, OpenZeppelin v5 (`ERC721Upgradeable` from `@openzeppelin-upgradeable`, everything else from `@openzeppelin/contracts`).

**Spec:** `docs/superpowers/specs/2026-09-15-slot-bound-nft-wrapper-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- All commands run from `apps/contracts`. Test with `forge test`, build with `forge build`.
- `currency` is always `IERC20(address(0))` — **native ETH**. An implementation constant, never a parameter.
- `minDepositSeconds` is always **`7 days`**. An implementation constant, never a parameter.
- `mutableHook` is always **`false`**. Mandatory: a detachable hook strands the token.
- `mutableTax` is always **`true`**, and `manager` is always the depositor.
- `recipient` is always the depositor.
- **The occupant never redeems the underlying, in either mode.** No code path may let them.
- `taxBps`, `valuation` and deposit floors are **validated by the slot, never re-checked in the wrapper**. Ask the slot; do not compute. This mirrors `SlotBoundNFT._seat`.
- `version()` on the wrapper implementation is `1`. On `SlotBoundNFTFactory` it goes `2` → `3`, bumped in the same commit as the change.
- The wrapper inherits `Versioned` **alone**, never `VersionedUUPS`. Beacon implementations must not carry an upgrade entry point of their own.
- Vocabulary: say "common ownership", never "Harberger". Say "sponsor", never "ad" or "advertiser".
- Commit after every task. Do not push.

## File Structure

| File | Responsibility |
|---|---|
| Create `src/hooks/nft/ISlotBoundNFTWrapper.sol` | Vocabulary only: `Mode`, `Wrap`, events, errors. Split out so the SDK and indexer import it without the implementation — same reason `ISlotBoundNFT.sol` exists. |
| Create `src/hooks/nft/SlotBoundNFTWrapper.sol` | The wrapper: escrow, slot creation, hook lifecycle, withdrawal, retirement. |
| Modify `src/hooks/nft/SlotBoundNFTFactory.sol` | Beacon, `createWrapper`, `initializeWrappers`, `upgradeWrapperBeacon`, version → 3. |
| Create `test/slots/SlotBoundNFTWrapper.t.sol` | Wrap, lifecycle, terms, metadata. |
| Create `test/slots/SlotBoundNFTWrapperWithdraw.t.sol` | Modes, withdrawal, retirement, hostile underlyings. |
| Create `test/slots/SlotBoundNFTWrapperFactory.t.sol` | Beacon plumbing and the live-proxy upgrade path. |
| Modify `packages/contracts/wagmi.config.ts` | Add the two new names to the `INCLUDE` allowlist. |

Flat in `src/hooks/nft/`, matching `ISlotBoundNFT.sol` / `SlotBoundNFT.sol` / `SlotBoundNFTFactory.sol`. Each `.t.sol` is self-contained with its own `setUp`, matching `SlotBoundNFT.t.sol`.

## Two deviations from the spec

Both found while writing real code against it. Flagged here rather than applied silently.

1. **`onERC721Received` always reverts; there is no transient flag.** The spec gates it open during `wrap()`. Unnecessary: `wrap()` pulls with `transferFrom`, which never invokes the receiver hook. A three-line unconditional revert gives the same guarantee, a named error, and no flag to get wrong.
2. **`quoteWrap` is added.** The spec has no way for a caller to learn the deposit before the slot exists — and it cannot ask the slot, because `wrap()` is what creates it. `SlotBoundNFT` has `quoteMint` for exactly this. Mirrors it.

---

### Task 1: The wrapper — wrap, escrow, and the occupancy lifecycle

A wrap cannot complete without the hook surface: the slot validates the hook at creation and calls `afterBuy` back during the seating buy. So they land together.

**Files:**
- Create: `src/hooks/nft/ISlotBoundNFTWrapper.sol`
- Create: `src/hooks/nft/SlotBoundNFTWrapper.sol`
- Test: `test/slots/SlotBoundNFTWrapper.t.sol`

**Interfaces:**
- Consumes: `SlotFactory.createSlot(SlotInit)`, `ISlotOccupancy` and `ISlotBoundNFT`'s `NoSuchToken` vocabulary from `src/hooks/nft/ISlotBoundNFT.sol`, `ISlotHook` / `HookFlags` / `SlotContext`, `SlotMath.depositFor`, `Versioned`.
- Produces:
  - `enum Mode { Permanent, Reclaimable }`
  - `struct Wrap { address underlying; Mode mode; bool retired; address depositor; uint256 underlyingId; }`
  - `SlotBoundNFTWrapper.initialize(string name_, string symbol_, SlotFactory factory_)`
  - `wrap(IERC721 underlying, uint256 underlyingId, uint256 taxBps, uint256 valuation, Mode mode) payable returns (uint256 tokenId, address slot)`
  - `quoteWrap(uint256 valuation, uint256 taxBps) view returns (uint256 deposit)`
  - `wrapOf(uint256 tokenId) view returns (Wrap memory)`
  - `slotOf(uint256) view returns (address)`, `tokenOf(address) view returns (uint256)`, `totalWrapped() view returns (uint256)`
  - `MIN_DEPOSIT_SECONDS()` = `7 days`

- [ ] **Step 1: Write the vocabulary file**

Create `src/hooks/nft/ISlotBoundNFTWrapper.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice What happens to the underlying when nobody wants the seat. Chosen
///         once, at wrap, and never again.
enum Mode {
    /// The underlying never leaves. The wrapper is its final owner.
    Permanent,
    /// The depositor may take it back when nobody is occupying.
    Reclaimable
}

/// @dev One deposit. Packed: `underlying` + `mode` + `retired` share a slot.
struct Wrap {
    address underlying;
    Mode mode;
    bool retired;
    address depositor;
    uint256 underlyingId;
}

/**
 * @title ISlotBoundNFTWrapper
 * @notice What a wrapper emits and refuses.
 *
 * @dev Split out so the SDK and the indexer can import the vocabulary without
 *      pulling in the implementation. Same reason as {ISlotBoundNFT}.
 */
interface ISlotBoundNFTWrapper {
    // ─── events ─────────────────────────────────────────────────────────────

    event Wrapped(
        uint256 indexed tokenId,
        address indexed slot,
        address indexed depositor,
        address underlying,
        uint256 underlyingId,
        Mode mode,
        uint256 taxBps
    );

    event Withdrawn(
        uint256 indexed tokenId,
        address indexed slot,
        address indexed depositor,
        address underlying,
        uint256 underlyingId
    );

    // ─── errors ─────────────────────────────────────────────────────────────

    /// @dev The token is soulbound to occupancy. Only {_sync} and a retirement
    ///      burn may move it.
    error NotTransferable();
    /// @dev The slot's underlying has been withdrawn. Nothing backs it.
    error SlotRetired();
    error NotDepositor();
    error NotReclaimable();
    /// @dev Someone other than the depositor holds the slot.
    error Occupied();
    /// @dev Reached this contract other than through {wrap}.
    error UnsolicitedTransfer();
    error InvalidFactory();
}
```

- [ ] **Step 2: Write the failing test**

Create `test/slots/SlotBoundNFTWrapper.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "../../src/hooks/nft/ISlotBoundNFTWrapper.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";
import {SlotContext} from "../../src/ISlotHook.sol";

contract MockNFT is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function tokenURI(uint256) public pure override returns (string memory) {
        return "ipfs://underlying";
    }
}

contract SlotBoundNFTWrapperTest is Test {
    SlotFactory factory;
    SlotBoundNFTWrapper wrapper;
    MockNFT nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant TAX = 1000; // 10%
    uint256 constant VALUATION = 1 ether;

    uint256 tokenId;
    Slot slot;

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTWrapper wImpl = new SlotBoundNFTWrapper();
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(wImpl), address(this));
        wrapper = SlotBoundNFTWrapper(address(new BeaconProxy(address(beacon),
            abi.encodeCall(SlotBoundNFTWrapper.initialize,
                ("Wrapped Slots", "WSLOT", factory)))));

        nft = new MockNFT();
        nft.mint(alice, 1);
        nft.mint(alice, 2);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.warp(1_000_000);

        tokenId = _wrap(alice, 1, Mode.Permanent);
        slot = Slot(payable(wrapper.slotOf(tokenId)));
    }

    function _deposit(uint256 valuation) internal view returns (uint256) {
        return wrapper.quoteWrap(valuation, TAX);
    }

    function _wrap(address who, uint256 id, Mode mode) internal returns (uint256 newId) {
        vm.startPrank(who);
        nft.approve(address(wrapper), id);
        (newId, ) = wrapper.wrap{value: _deposit(VALUATION)}(
            IERC721(address(nft)), id, TAX, VALUATION, mode
        );
        vm.stopPrank();
    }

    // ── the wrap itself ─────────────────────────────────────────────────────

    /// @notice One transaction: escrowed, slot created, depositor seated,
    ///         token delivered.
    function test_WrappingEscrowsTheUnderlyingAndSeatsTheDepositor() public view {
        assertEq(nft.ownerOf(1), address(wrapper), "underlying is escrowed");
        assertEq(slot.occupant(), alice, "seated by the wrap itself");
        assertEq(wrapper.ownerOf(tokenId), alice, "and holding the token");
        assertEq(slot.price(), VALUATION);
        assertEq(wrapper.totalWrapped(), 1);
    }

    /// @notice The depositor keeps the economics of their own asset.
    function test_TheDepositorIsTheRecipientAndTheManager() public view {
        assertEq(slot.recipient(), alice, "earns the rent on their own asset");
        assertEq(slot.manager(), alice, "and may re-rate it");
        assertEq(slot.taxBps(), TAX, "at the rate they chose");
    }

    /// @notice The hook cannot be detached; detaching it would strand the token.
    function test_TheHookIsThisContractAndPermanent() public view {
        assertEq(slot.hook(), address(wrapper));
        assertFalse(slot.mutableHook(), "and permanently so");
        assertTrue(slot.mutableTax(), "but the rate can still move");
    }

    /// @notice The wrap records what backs the token.
    function test_TheWrapRecordsItsUnderlying() public view {
        Wrap memory w = wrapper.wrapOf(tokenId);
        assertEq(w.underlying, address(nft));
        assertEq(w.underlyingId, 1);
        assertEq(w.depositor, alice);
        assertFalse(w.retired);
        assertTrue(w.mode == Mode.Permanent);
    }

    /// @notice Ids start at one, so `tokenOf`'s zero-means-not-ours holds.
    function test_IdsStartAtOneSoZeroStaysMeaningful() public {
        assertEq(tokenId, 1);
        assertEq(wrapper.tokenOf(address(slot)), 1);
        assertEq(wrapper.tokenOf(address(0xdead)), 0, "a stranger is not ours");
    }

    /// @notice `msg.value` funds the escrow and nothing else — the depositor
    ///         IS the recipient, so a valuation leg would be their own money
    ///         going in a circle.
    function test_TheWrapCostsTheDepositOnly() public {
        uint256 before = alice.balance;
        _wrap(alice, 2, Mode.Permanent);
        assertEq(before - alice.balance, _deposit(VALUATION));
    }

    /// @notice The floor is the slot's to enforce, not the wrapper's.
    function test_AnUnderfundedWrapIsRefusedByTheCore() public {
        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);
        vm.expectRevert();
        wrapper.wrap{value: _deposit(VALUATION) - 1}(
            IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();
    }

    /// @notice Over-funding is longer runway, not an error.
    function test_OverfundingBuysRunway() public {
        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);
        (uint256 id2, address s2) = wrapper.wrap{value: _deposit(VALUATION) * 2}(
            IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();
        assertEq(Slot(payable(s2)).deposit(), _deposit(VALUATION) * 2);
        assertEq(wrapper.ownerOf(id2), alice);
    }

    /// @notice Zero price and a zero or excessive rate are the core's to refuse.
    function test_TheCoreRefusesADegenerateWrap() public {
        vm.startPrank(alice);
        nft.approve(address(wrapper), 2);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, TAX, 0, Mode.Permanent);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, 0, VALUATION, Mode.Permanent);

        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, 10_001, VALUATION, Mode.Permanent);

        vm.stopPrank();
    }

    /// @notice You cannot wrap what you do not hold.
    function test_WrappingSomeoneElsesTokenIsRefused() public {
        vm.prank(bob);
        vm.expectRevert();
        wrapper.wrap{value: 1 ether}(IERC721(address(nft)), 2, TAX, VALUATION, Mode.Permanent);
    }

    // ── the lifecycle, inherited wholesale ──────────────────────────────────

    function test_BuyingTheSlotMovesTheToken() public {
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);
        assertEq(wrapper.ownerOf(tokenId), bob, "ownership follows occupancy");
        assertEq(slot.occupant(), bob);
    }

    function test_ReleasingParksItBackWithTheWrapper() public {
        vm.prank(alice);
        slot.release();
        assertEq(slot.occupant(), address(0));
        assertEq(wrapper.ownerOf(tokenId), address(wrapper), "parked, not burned");
    }

    function test_LiquidationMovesItToo() public {
        vm.warp(block.timestamp + 3650 days);
        slot.liquidate();
        assertEq(slot.occupant(), address(0));
        assertEq(wrapper.ownerOf(tokenId), address(wrapper));
    }

    function test_TheOccupantCannotSellTheToken() public {
        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.NotTransferable.selector);
        wrapper.transferFrom(alice, bob, tokenId);
    }

    function test_AnApprovedOperatorCannotMoveItEither() public {
        vm.prank(alice);
        wrapper.setApprovalForAll(bob, true);
        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.NotTransferable.selector);
        wrapper.transferFrom(alice, bob, tokenId);
    }

    /// @dev `_sync` reads `occupant()` live and never the context. The `after`
    ///      entry points are world-callable by design, so a context someone
    ///      invented must be able to change nothing.
    function test_AForgedCallbackCannotStealTheToken() public {
        SlotContext memory forged;
        forged.slot = address(slot);
        forged.caller = bob;
        forged.account = bob;
        forged.occupant = bob;

        vm.prank(bob);
        wrapper.afterBuy(forged);

        assertEq(wrapper.ownerOf(tokenId), alice, "the live occupant is alice");
    }

    function test_TheBuyEmitsARealTransfer() public {
        vm.expectEmit(true, true, true, true, address(wrapper));
        emit IERC721.Transfer(alice, bob, tokenId);
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);
    }

    /// @dev Someone stands up their own slot pointing at this hook and fires
    ///      the callback. `tokenOf` is zero for it, so nothing happens — and
    ///      it must not revert either: never revert on a stranger.
    function test_AStrangerCannotClaimATokenWithTheirOwnSlot() public {
        vm.prank(bob);
        address rogue = factory.createSlot(SlotInit({
            recipient: bob, currency: IERC20(address(0)), manager: bob,
            hook: address(wrapper), hookData: bytes32(0),
            taxBps: TAX, minDepositSeconds: 7 days,
            mutableTax: true, mutableHook: false
        }));
        assertEq(wrapper.tokenOf(rogue), 0, "not ours");
        assertEq(wrapper.ownerOf(tokenId), alice, "and alice keeps her token");
    }

    /// @notice The property this whole design leans on. The depositor manages
    ///         their own slot, and a manager can change NOTHING under a
    ///         sitting occupant — terms ripen for `TERMS_DELAY` and land at the
    ///         next occupancy transition. Without this, depositor-as-manager
    ///         plus depositor-as-withdrawer is a rug.
    function test_ARerateCannotTouchASittingOccupant() public {
        vm.prank(bob);
        slot.buy{value: VALUATION + _deposit(2 ether)}(bob, 2 ether, _deposit(2 ether), 0);

        vm.prank(alice);
        slot.proposeTerms(5000, address(0), bytes32(0), true, false);

        vm.warp(block.timestamp + 2 days); // well past TERMS_DELAY
        assertEq(slot.taxBps(), TAX, "still the rate bob bought under");

        vm.prank(bob);
        slot.release();
        assertEq(slot.taxBps(), 5000, "lands at the transition, never before");
    }

    function test_TheHookIsStrict() public view {
        assertTrue(wrapper.subscriptions().strict, "so the move cannot be starved");
        assertTrue(wrapper.subscriptions().afterBuy);
        assertTrue(wrapper.subscriptions().afterRelease);
        assertTrue(wrapper.subscriptions().afterLiquidate);
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapper.t.sol
```

Expected: FAIL — `SlotBoundNFTWrapper.sol` does not exist, so compilation fails.

- [ ] **Step 4: Write the implementation**

Create `src/hooks/nft/SlotBoundNFTWrapper.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from
    "@openzeppelin-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from
    "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ISlotHook, HookFlags, SlotContext} from "../../ISlotHook.sol";
import {SlotFactory} from "../../SlotFactory.sol";
import {SlotInit} from "../../Slot.sol";
import {SlotMath} from "../../SlotMath.sol";
import {Versioned} from "../../Versioned.sol";
import {ISlotOccupancy, ISlotBoundNFT} from "./ISlotBoundNFT.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "./ISlotBoundNFTWrapper.sol";

/**
 * @title SlotBoundNFTWrapper
 * @notice An ERC-721 you already own, put under common ownership.
 *
 * @dev {SlotBoundNFT} mints a token backed by nothing. This escrows a real one
 *      and keeps the identical lifecycle: ownership is real ERC-721 storage
 *      moved in `afterBuy`, safe only because this hook declares `strict`.
 *
 *      Monolithic and permissionless — any ERC-721, any depositor, terms per
 *      wrap. The depositor is the recipient and the manager of their own slot;
 *      that is safe only because {SlotAdmin} can never change anything under a
 *      sitting occupant. If that ever stops being true, this contract is a rug.
 *
 *      The occupant never redeems. This is a market in occupancy, not a way to
 *      buy the asset.
 */
contract SlotBoundNFTWrapper is
    ERC721Upgradeable,
    ReentrancyGuard,
    Versioned,
    ISlotHook,
    ISlotBoundNFTWrapper,
    IERC721Receiver
{
    /// @dev Native ETH, always. A constant so a beacon upgrade could only ever
    ///      change it for FUTURE wraps — every slot holds its own copy.
    IERC20 internal constant CURRENCY = IERC20(address(0));

    uint256 public constant MIN_DEPOSIT_SECONDS = 7 days;

    SlotFactory public slotFactory;

    mapping(uint256 tokenId => Wrap) internal _wrapped;
    mapping(uint256 tokenId => address slot) public slotOf;
    /// @dev Zero means the slot is not one of ours.
    mapping(address slot => uint256 tokenId) public tokenOf;

    uint256 public totalWrapped;

    /// @dev Open only while THIS contract moves or burns a token of its own.
    ///      Read by {_update} and nothing else.
    bool private _moving;

    /// @dev Locks the IMPLEMENTATION. Only a proxy delegating in runs `initialize`.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc Versioned
    function version() public pure override returns (uint64) {
        return 1;
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        SlotFactory factory_
    ) external initializer {
        if (address(factory_) == address(0)) revert InvalidFactory();
        __ERC721_init(name_, symbol_);
        slotFactory = factory_;
    }

    /// @notice Escrow an ERC-721, open a slot on your own terms, and take the
    ///         first seat at `valuation`.
    /// @dev Costs the escrow deposit only. Unlike {SlotBoundNFT.mint} there is
    ///      no valuation leg: the depositor IS the recipient, so paying it
    ///      would be their own money in a circle.
    function wrap(
        IERC721 underlying,
        uint256 underlyingId,
        uint256 taxBps,
        uint256 valuation,
        Mode mode
    ) external payable nonReentrant returns (uint256 tokenId, address slot) {
        // Plain `transferFrom`: no receiver callback, so no arbitrary code runs
        // inside this frame. See {onERC721Received}.
        underlying.transferFrom(msg.sender, address(this), underlyingId);

        // Nothing below is re-validated here. `taxBps`, `valuation` and the
        // deposit floor are the slot's to enforce, and one validation means one
        // authority.
        slot = slotFactory.createSlot(
            SlotInit({
                recipient: msg.sender,
                currency: CURRENCY,
                manager: msg.sender,
                hook: address(this),
                hookData: bytes32(0),
                taxBps: taxBps,
                minDepositSeconds: MIN_DEPOSIT_SECONDS,
                mutableTax: true,
                mutableHook: false
            })
        );

        unchecked {
            tokenId = ++totalWrapped;
        }

        // Before the buy: it calls `afterBuy` back mid-frame, and {_sync} reads
        // `tokenOf` to decide whether the slot is one of ours.
        slotOf[tokenId] = slot;
        tokenOf[slot] = tokenId;
        _wrapped[tokenId] = Wrap({
            underlying: address(underlying),
            mode: mode,
            retired: false,
            depositor: msg.sender,
            underlyingId: underlyingId
        });

        _mint(address(this), tokenId);
        emit Wrapped(
            tokenId,
            slot,
            msg.sender,
            address(underlying),
            underlyingId,
            mode,
            taxBps
        );

        ISlotOccupancy(slot).buy{value: msg.value}(
            msg.sender,
            valuation,
            msg.value,
            0
        );
    }

    /// @notice What a wrap costs. For a UI: the slot enforces the real floor.
    /// @dev Exists because the slot does not yet exist when a caller needs this.
    function quoteWrap(
        uint256 valuation,
        uint256 taxBps
    ) external pure returns (uint256 deposit) {
        return SlotMath.depositFor(valuation, taxBps, MIN_DEPOSIT_SECONDS);
    }

    function wrapOf(uint256 tokenId) external view returns (Wrap memory) {
        Wrap memory w = _wrapped[tokenId];
        if (w.underlying == address(0)) revert ISlotBoundNFT.NoSuchToken(tokenId);
        return w;
    }

    // ─── hook ───────────────────────────────────────────────────────────────

    function subscriptions() external pure returns (HookFlags memory f) {
        f.afterBuy = true;
        f.afterRelease = true;
        f.afterLiquidate = true;
        f.strict = true; // why this contract can hold real ownership state
    }

    function validateHookData(bytes32) external view {}

    function beforeBuy(SlotContext calldata) external view {}

    function beforeSelfAssess(SlotContext calldata) external view {}

    function afterBuy(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterRelease(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterLiquidate(SlotContext calldata ctx) external {
        _sync(ctx.slot);
    }

    function afterSettle(SlotContext calldata) external {}

    /// @dev Reads `occupant()` live, never `ctx`: the `after` entry points are
    ///      world-callable, so a forged context must be able to change nothing.
    function _sync(address slot) internal {
        uint256 tokenId = tokenOf[slot];
        if (tokenId == 0) return; // not ours; never revert on a stranger

        address want = ISlotOccupancy(slot).occupant();
        if (want == address(0)) want = address(this);

        address have = _ownerOf(tokenId);
        if (have == want) return;

        _moving = true;
        _transfer(have, want, tokenId);
        _moving = false;
    }

    /// @dev Mints pass, and so do this contract's own moves. Everything else
    ///      is refused: the token is soulbound to occupancy.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0) && !_moving) revert NotTransferable();
        return super._update(to, tokenId, auth);
    }

    /// @dev Nothing reaches this contract except through {wrap}, which uses
    ///      plain `transferFrom`. An escrow that accepts unsolicited transfers
    ///      strands what it is sent, and it has no rescue path by design.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert UnsolicitedTransfer();
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapper.t.sol -vv
```

Expected: PASS. If `_ownerOf`, `_transfer` or `__ERC721_init` are not found, check the `@openzeppelin-upgradeable` remapping in `remappings.txt`.

- [ ] **Step 6: Commit**

```bash
git add apps/contracts/src/hooks/nft/ISlotBoundNFTWrapper.sol apps/contracts/src/hooks/nft/SlotBoundNFTWrapper.sol apps/contracts/test/slots/SlotBoundNFTWrapper.t.sol
git commit -m "feat(contracts): SlotBoundNFTWrapper escrows an ERC-721 into a slot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Metadata

**Files:**
- Modify: `src/hooks/nft/SlotBoundNFTWrapper.sol`
- Test: `test/slots/SlotBoundNFTWrapper.t.sol` (append)

**Interfaces:**
- Consumes: `Wrap`, `_wrapped`, `ISlotBoundNFT.NoSuchToken` from Task 1.
- Produces: `tokenURI(uint256) view returns (string memory)`, overriding `ERC721Upgradeable`.

- [ ] **Step 1: Write the failing tests**

Append to `test/slots/SlotBoundNFTWrapper.t.sol`, and add this mock beside `MockNFT` at the top of the file:

```solidity
contract RevertingURINFT is ERC721 {
    constructor() ERC721("Bad", "BAD") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function tokenURI(uint256) public pure override returns (string memory) {
        revert("no metadata for you");
    }
}
```

Tests:

```solidity
    // ── metadata ────────────────────────────────────────────────────────────

    /// @notice A wrapper token shows what it wraps.
    function test_TokenURIProxiesToTheUnderlying() public view {
        assertEq(wrapper.tokenURI(tokenId), "ipfs://underlying");
    }

    /// @notice The underlying is arbitrary and may misbehave. A token that
    ///         cannot render beats one that cannot be read at all.
    function test_ARevertingUnderlyingRendersEmptyRatherThanReverting() public {
        RevertingURINFT bad = new RevertingURINFT();
        bad.mint(alice, 7);

        vm.startPrank(alice);
        bad.approve(address(wrapper), 7);
        (uint256 badId, ) = wrapper.wrap{value: _deposit(VALUATION)}(
            IERC721(address(bad)), 7, TAX, VALUATION, Mode.Permanent
        );
        vm.stopPrank();

        assertEq(wrapper.tokenURI(badId), "");
    }

    function test_AnUnwrappedTokenIsNamedNotGuessedAt() public {
        vm.expectRevert(abi.encodeWithSelector(ISlotBoundNFT.NoSuchToken.selector, uint256(99)));
        wrapper.tokenURI(99);
    }

    /// @notice There is no privileged party at all — no owner, no base URI.
    function test_TheWrapperHasNoOwner() public view {
        (bool ok, ) = address(wrapper).staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(ok, "no Ownable surface");
    }
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapper.t.sol --match-test "URI|NoOwner" -vv
```

Expected: FAIL — `tokenURI` still returns the inherited empty-base-URI value, and `NoSuchToken` is never raised.

- [ ] **Step 3: Implement**

Add to `SlotBoundNFTWrapper.sol`, after `wrapOf`:

```solidity
    /// @notice The underlying's own metadata. A wrapper should look like what
    ///         it wraps.
    /// @dev `try`/`catch` because the underlying is arbitrary: a reverting
    ///      `tokenURI` must not make the wrapper token unreadable.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        Wrap memory w = _wrapped[tokenId];
        if (w.underlying == address(0)) revert ISlotBoundNFT.NoSuchToken(tokenId);

        try IERC721Metadata(w.underlying).tokenURI(w.underlyingId) returns (
            string memory uri
        ) {
            return uri;
        } catch {
            return "";
        }
    }
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapper.t.sol -vv
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add apps/contracts/src/hooks/nft/SlotBoundNFTWrapper.sol apps/contracts/test/slots/SlotBoundNFTWrapper.t.sol
git commit -m "feat(contracts): wrapper tokenURI proxies to the underlying

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Withdrawal and retirement

The two retirement failure modes below are the reason this task exists as its own gate. Read them before writing code.

**Files:**
- Modify: `src/hooks/nft/SlotBoundNFTWrapper.sol`
- Test: `test/slots/SlotBoundNFTWrapperWithdraw.t.sol`

**Interfaces:**
- Consumes: `Wrap`, `Mode`, `_wrapped`, `_moving`, `_sync`, `beforeBuy`, `tokenOf`, `slotOf` from Task 1.
- Produces: `withdraw(uint256 tokenId)`, and the `retired` field of `Wrap` becoming meaningful.

- [ ] **Step 1: Write the failing tests**

Create `test/slots/SlotBoundNFTWrapperWithdraw.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";
import {ISlotBoundNFTWrapper, Mode, Wrap} from "../../src/hooks/nft/ISlotBoundNFTWrapper.sol";
import {ISlotBoundNFT} from "../../src/hooks/nft/ISlotBoundNFT.sol";

contract MockNFT is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
}

/// @dev Re-enters `withdraw` from inside the underlying's own transfer.
contract ReentrantNFT is ERC721 {
    SlotBoundNFTWrapper public target;
    uint256 public reenterOn;
    bool public tried;

    constructor() ERC721("Re", "RE") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
    function arm(SlotBoundNFTWrapper t, uint256 id) external { target = t; reenterOn = id; }

    function transferFrom(address from, address to, uint256 id) public override {
        super.transferFrom(from, to, id);
        if (address(target) != address(0) && !tried) {
            tried = true;
            try target.withdraw(reenterOn) {} catch {}
        }
    }
}

contract SlotBoundNFTWrapperWithdrawTest is Test {
    SlotFactory factory;
    SlotBoundNFTWrapper wrapper;
    MockNFT nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant TAX = 1000;
    uint256 constant VALUATION = 1 ether;

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTWrapper wImpl = new SlotBoundNFTWrapper();
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(wImpl), address(this));
        wrapper = SlotBoundNFTWrapper(address(new BeaconProxy(address(beacon),
            abi.encodeCall(SlotBoundNFTWrapper.initialize,
                ("Wrapped Slots", "WSLOT", factory)))));

        nft = new MockNFT();
        for (uint256 i = 1; i <= 5; ++i) nft.mint(alice, i);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.warp(1_000_000);
    }

    function _dep(uint256 v) internal view returns (uint256) {
        return wrapper.quoteWrap(v, TAX);
    }

    function _wrap(uint256 id, Mode mode) internal returns (uint256 tokenId, Slot slot) {
        vm.startPrank(alice);
        nft.approve(address(wrapper), id);
        address s;
        (tokenId, s) = wrapper.wrap{value: _dep(VALUATION)}(
            IERC721(address(nft)), id, TAX, VALUATION, mode
        );
        vm.stopPrank();
        slot = Slot(payable(s));
    }

    function _buy(address who, Slot slot, uint256 price) internal {
        vm.prank(who);
        slot.buy{value: slot.price() + _dep(price)}(who, price, _dep(price), 0);
    }

    // ── modes ───────────────────────────────────────────────────────────────

    function test_PermanentRefusesWithdrawalWhenVacant() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Permanent);
        vm.prank(alice);
        slot.release();

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.NotReclaimable.selector);
        wrapper.withdraw(id);
    }

    function test_ReclaimableAllowsWithdrawalWhenVacant() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        slot.release();

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(nft.ownerOf(1), alice, "the underlying went home");
        assertTrue(wrapper.wrapOf(id).retired);
    }

    /// @notice Closes the snipe race: release-then-withdraw in two transactions
    ///         lets anyone take the vacant slot in between.
    function test_TheDepositorMayWithdrawWhileTheyThemselvesOccupy() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(nft.ownerOf(1), alice);
        assertTrue(wrapper.wrapOf(id).retired);
    }

    function test_ReclaimableRefusesWithdrawalWhileAStrangerOccupies() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        _buy(bob, slot, 2 ether);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.Occupied.selector);
        wrapper.withdraw(id);
    }

    function test_ANonDepositorCannotWithdraw() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        slot.release();

        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.NotDepositor.selector);
        wrapper.withdraw(id);
    }

    /// @notice An insolvent occupant still reads as the occupant. The failure
    ///         is in the safe direction: blocked, never wrongly allowed.
    function test_AnInsolventOccupantBlocksWithdrawalUntilLiquidated() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        _buy(bob, slot, 2 ether);
        vm.warp(block.timestamp + 3650 days);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.Occupied.selector);
        wrapper.withdraw(id);

        slot.liquidate();

        vm.prank(alice);
        wrapper.withdraw(id);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_WithdrawingTwiceIsRefused() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.SlotRetired.selector);
        wrapper.withdraw(id);
    }

    // ── retirement: the two failure modes ───────────────────────────────────

    /// @notice FAILURE MODE ONE. Without a named veto in `beforeBuy`, someone
    ///         pays to occupy a slot with no asset and no token behind it.
    function test_BuyingARetiredSlotIsRefusedByName() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.prank(bob);
        vm.expectRevert(ISlotBoundNFTWrapper.SlotRetired.selector);
        slot.buy{value: 10 ether}(bob, 2 ether, _dep(2 ether), 0);
    }

    /// @notice FAILURE MODE TWO. Without `_sync` returning early on a retired
    ///         token, `afterRelease` reverts on a burned token, `strict`
    ///         propagates it, and the depositor's escrow is stuck forever.
    function test_AWithdrawingOccupantCanStillReleaseAndGetTheirDepositBack() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);

        vm.prank(alice);
        wrapper.withdraw(id);

        uint256 before = alice.balance;
        vm.prank(alice);
        slot.release();

        assertGt(alice.balance, before, "escrow came back");
        assertEq(slot.occupant(), address(0));
    }

    /// @notice And liquidation of a retired slot must not brick either.
    function test_ARetiredSlotCanStillBeLiquidated() public {
        (uint256 id, Slot slot) = _wrap(1, Mode.Reclaimable);
        _buy(bob, slot, 2 ether);
        vm.warp(block.timestamp + 3650 days);
        slot.liquidate();

        vm.prank(alice);
        wrapper.withdraw(id);

        (uint256 id2, Slot slot2) = _wrap(2, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id2);
        vm.warp(block.timestamp + 3650 days);
        slot2.liquidate(); // must not revert
        assertEq(slot2.occupant(), address(0));
    }

    function test_ARetiredTokenIsBurned() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.expectRevert();
        wrapper.ownerOf(id);
    }

    function test_ARetiredTokenHasNoMetadata() public {
        (uint256 id, ) = _wrap(1, Mode.Reclaimable);
        vm.prank(alice);
        wrapper.withdraw(id);

        vm.expectRevert(abi.encodeWithSelector(ISlotBoundNFT.NoSuchToken.selector, id));
        wrapper.tokenURI(id);
    }

    // ── hostile underlyings ─────────────────────────────────────────────────

    function test_AReentrantUnderlyingCannotReenterWithdraw() public {
        ReentrantNFT bad = new ReentrantNFT();
        bad.mint(alice, 1);

        vm.startPrank(alice);
        bad.approve(address(wrapper), 1);
        (uint256 id, ) = wrapper.wrap{value: _dep(VALUATION)}(
            IERC721(address(bad)), 1, TAX, VALUATION, Mode.Reclaimable
        );
        vm.stopPrank();

        bad.arm(wrapper, id);

        vm.prank(alice);
        wrapper.withdraw(id);

        assertEq(bad.ownerOf(1), alice, "out exactly once");
        assertTrue(wrapper.wrapOf(id).retired);
    }

    function test_AnUnsolicitedSafeTransferIsRefusedByName() public {
        vm.prank(alice);
        vm.expectRevert(ISlotBoundNFTWrapper.UnsolicitedTransfer.selector);
        nft.safeTransferFrom(alice, address(wrapper), 3);
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapperWithdraw.t.sol
```

Expected: FAIL — `withdraw` does not exist, so compilation fails.

- [ ] **Step 3: Implement**

Three edits to `SlotBoundNFTWrapper.sol`.

**(a)** Replace the empty `beforeBuy` with the veto. It resolves the slot from `msg.sender`, not `ctx` — the slot is the caller when the veto matters, and a veto read out of a caller-supplied struct is one somebody can arrange to miss:

```solidity
    /// @dev The one thing that stops a retired slot being sold. Merely clearing
    ///      `tokenOf` would send {_sync} down its "not ours" path and let the
    ///      buy SUCCEED, against a slot with nothing behind it.
    function beforeBuy(SlotContext calldata) external view {
        uint256 tokenId = tokenOf[msg.sender];
        if (tokenId != 0 && _wrapped[tokenId].retired) revert SlotRetired();
    }
```

**(b)** Add the retired short-circuit to `_sync`, directly after the `tokenId == 0` line:

```solidity
        // Retired: the token is burned and nothing should move. Returning
        // rather than reverting is what lets `release` and `liquidate` still
        // settle — under `strict` a revert here would strand the deposit.
        if (_wrapped[tokenId].retired) return;
```

**(c)** Add `withdraw`, after `quoteWrap`:

```solidity
    /// @notice Take your underlying back. `Reclaimable` wraps only, and only
    ///         when nobody else holds the slot.
    ///
    /// @dev The second arm of the occupancy check — the depositor occupying
    ///      their own slot — closes a real race. Without it a depositor must
    ///      release and then withdraw in a second transaction, and anyone may
    ///      take the vacant slot in between for the price of their own deposit.
    ///      It costs nothing in safety: while they hold the seat, no third
    ///      party has a claim on it.
    function withdraw(uint256 tokenId) external nonReentrant {
        Wrap memory w = _wrapped[tokenId];
        if (w.underlying == address(0)) revert ISlotBoundNFT.NoSuchToken(tokenId);
        if (w.retired) revert SlotRetired();
        if (w.mode != Mode.Reclaimable) revert NotReclaimable();
        if (msg.sender != w.depositor) revert NotDepositor();

        address slot = slotOf[tokenId];

        // Read live. An insolvent occupant still reads non-zero, so this blocks
        // until someone actually liquidates — the safe direction.
        address occupant = ISlotOccupancy(slot).occupant();
        if (occupant != address(0) && occupant != w.depositor) revert Occupied();

        // Retire and burn BEFORE the underlying moves: it is arbitrary code.
        _wrapped[tokenId].retired = true;

        _moving = true;
        _burn(tokenId);
        _moving = false;

        emit Withdrawn(tokenId, slot, w.depositor, w.underlying, w.underlyingId);

        IERC721(w.underlying).transferFrom(
            address(this),
            w.depositor,
            w.underlyingId
        );
    }
```

**(d)** A retired id has no metadata either. In `tokenURI`, widen the guard:

```solidity
        if (w.underlying == address(0) || w.retired) revert ISlotBoundNFT.NoSuchToken(tokenId);
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapperWithdraw.t.sol -vv
```

Expected: PASS. If `test_AWithdrawingOccupantCanStillReleaseAndGetTheirDepositBack` fails, edit (b) is missing or placed after the `_ownerOf` read.

- [ ] **Step 5: Re-run the Task 1 and 2 tests for regressions**

```bash
cd apps/contracts && forge test --match-path "test/slots/SlotBoundNFTWrapper*.t.sol" -vv
```

Expected: PASS, every file.

- [ ] **Step 6: Commit**

```bash
git add apps/contracts/src/hooks/nft/SlotBoundNFTWrapper.sol apps/contracts/test/slots/SlotBoundNFTWrapperWithdraw.t.sol
git commit -m "feat(contracts): reclaimable wraps, and retirement that cannot strand a deposit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Factory — beacon, createWrapper, version 3

**Files:**
- Modify: `src/hooks/nft/SlotBoundNFTFactory.sol`
- Test: `test/slots/SlotBoundNFTWrapperFactory.t.sol`
- Modify: `packages/contracts/wagmi.config.ts`

**Interfaces:**
- Consumes: `SlotBoundNFTWrapper.initialize(string,string,SlotFactory)` from Task 1.
- Produces: `WrapperInit`, `initializeWrappers(address)`, `createWrapper(WrapperInit)`, `upgradeWrapperBeacon(address)`, `wrapperBeacon()`, `isWrapper(address)`, `wrapperCount()`.

**Storage — read before editing.** The factory is live on Base at `0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4` at version 2, with slots 0–3 held by `slotFactory`, `admin`, `isCollection`, `collectionCount`. Solidity allocates in declaration order, so the three new variables must be declared **after `collectionCount` in source order**. Do not reorder or insert above it.

- [ ] **Step 1: Write the failing tests**

Create `test/slots/SlotBoundNFTWrapperFactory.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotBoundNFTFactory, CollectionInit, WrapperInit}
    from "../../src/hooks/nft/SlotBoundNFTFactory.sol";
import {SlotBoundNFTWrapper} from "../../src/hooks/nft/SlotBoundNFTWrapper.sol";

contract SlotBoundNFTWrapperFactoryTest is Test {
    SlotFactory slots;
    SlotBoundNFTFactory nftFactory;
    address admin = makeAddr("admin");
    address stranger = makeAddr("stranger");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        slots = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));

        SlotBoundNFTFactory fImpl = new SlotBoundNFTFactory();
        nftFactory = SlotBoundNFTFactory(address(new ERC1967Proxy(address(fImpl),
            abi.encodeCall(SlotBoundNFTFactory.initialize, (admin, slots)))));
    }

    function _enableWrappers() internal returns (address wrapperImpl) {
        wrapperImpl = address(new SlotBoundNFTWrapper());
        vm.prank(admin);
        nftFactory.initializeWrappers(wrapperImpl);
    }

    function test_TheVersionAnnouncesTheNewCode() public view {
        assertEq(nftFactory.version(), 3);
    }

    /// @dev A `reinitializer` on an external function is otherwise callable by
    ///      anyone, and the caller would be choosing the implementation behind
    ///      every wrapper.
    function test_OnlyTheAdminCanEnableWrappers() public {
        address wrapperImpl = address(new SlotBoundNFTWrapper());
        vm.prank(stranger);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        nftFactory.initializeWrappers(wrapperImpl);
    }

    function test_EnablingWrappersTwiceIsRefused() public {
        _enableWrappers();
        address second = address(new SlotBoundNFTWrapper());
        vm.prank(admin);
        vm.expectRevert();
        nftFactory.initializeWrappers(second);
    }

    function test_TheFactoryDeploysAWorkingWrapper() public {
        _enableWrappers();
        address w = nftFactory.createWrapper(WrapperInit({name: "Wrapped", symbol: "WRP"}));

        assertTrue(nftFactory.isWrapper(w));
        assertEq(nftFactory.wrapperCount(), 1);
        assertEq(SlotBoundNFTWrapper(w).name(), "Wrapped", "initialized through the proxy");
        assertEq(SlotBoundNFTWrapper(w).symbol(), "WRP");
        assertEq(address(SlotBoundNFTWrapper(w).slotFactory()), address(slots));
        assertEq(SlotBoundNFTWrapper(w).version(), 1);
    }

    function test_TwoWrappersGetTwoAddresses() public {
        _enableWrappers();
        address a = nftFactory.createWrapper(WrapperInit({name: "A", symbol: "A"}));
        address b = nftFactory.createWrapper(WrapperInit({name: "B", symbol: "B"}));
        assertTrue(a != b);
    }

    /// @notice The upgrade key is hot by design; it is at least gated.
    function test_OnlyTheAdminUpgradesTheWrapperBeacon() public {
        _enableWrappers();
        address next = address(new SlotBoundNFTWrapper());

        vm.prank(stranger);
        vm.expectRevert(SlotBoundNFTFactory.NotAdmin.selector);
        nftFactory.upgradeWrapperBeacon(next);

        vm.prank(admin);
        nftFactory.upgradeWrapperBeacon(next);
    }

    /// @notice Collections are untouched: still a plain `new`, still immutable.
    function test_CollectionsStillWork() public {
        _enableWrappers();
        address c = nftFactory.createCollection(CollectionInit({
            name: "Coll", symbol: "C", maxSupply: 3,
            currency: IERC20(address(0)), taxBps: 1000, minDepositSeconds: 7 days,
            recipient: makeAddr("r"), manager: address(0), owner: makeAddr("o")
        }));
        assertTrue(nftFactory.isCollection(c));
        assertFalse(nftFactory.isWrapper(c), "the two registries are separate");
    }
}
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapperFactory.t.sol
```

Expected: FAIL — `WrapperInit`, `initializeWrappers` and `createWrapper` do not exist.

- [ ] **Step 3: Implement**

Four edits to `src/hooks/nft/SlotBoundNFTFactory.sol`.

**(a)** Add imports beside the existing ones:

```solidity
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {SlotBoundNFTWrapper} from "./SlotBoundNFTWrapper.sol";
```

**(b)** Add the struct beside `CollectionInit`:

```solidity
/// @notice Everything a wrapper is fixed with — which is almost nothing. Each
///         wrap brings its own asset, its own rate and its own mode.
struct WrapperInit {
    string name;
    string symbol;
}
```

**(c)** Change `version()` from `2` to `3`.

**(d)** Append the new state and functions. The state goes **after `collectionCount`**; the functions after `createCollection`:

```solidity
    // ─── wrappers ───────────────────────────────────────────────────────────
    //
    // Appended, never inserted: this factory is live and slots 0-3 are spoken
    // for by `slotFactory`, `admin`, `isCollection`, `collectionCount`.
    //
    // Collections are a plain `new` and permanently so — the reasoning is at
    // the top of this file and it has not changed. Wrappers take the opposite
    // trade knowingly: they hold OTHER PEOPLE'S escrowed assets, so this
    // beacon's key can rewrite `withdraw` as well as `ownerOf`. Accepted, and
    // recorded in the design spec rather than mitigated here.

    /// @notice The beacon every wrapper proxy points at.
    UpgradeableBeacon public wrapperBeacon;

    mapping(address => bool) public isWrapper;
    uint256 public wrapperCount;

    event WrapperCreated(
        address indexed wrapper,
        address indexed creator,
        string name,
        string symbol
    );
    event WrapperBeaconUpgraded(address indexed newImplementation);

    /// @notice Stand up the wrapper beacon on an already-deployed factory.
    ///
    /// @dev Cannot live in `initialize`, which already ran on the live proxy.
    ///      `onlyAdmin` is load-bearing: a `reinitializer` on an external
    ///      function is otherwise callable by anyone, and the caller would be
    ///      choosing the implementation behind every wrapper.
    function initializeWrappers(
        address wrapperImplementation
    ) external reinitializer(2) onlyAdmin {
        if (wrapperImplementation == address(0)) revert InvalidRecipient();
        wrapperBeacon = new UpgradeableBeacon(
            wrapperImplementation,
            address(this)
        );
    }

    /// @notice Deploy a wrapper. Anyone may; it has no privileged party.
    function createWrapper(
        WrapperInit calldata init
    ) external returns (address wrapper) {
        bytes memory initData = abi.encodeCall(
            SlotBoundNFTWrapper.initialize,
            (init.name, init.symbol, slotFactory)
        );
        // CREATE2, salted with the chain id and the wrapper's index — the same
        // reasoning as `SlotFactory.createSlot`, written out in full there. The
        // literal is a domain separator: this counter and `collectionCount`
        // both start at zero, and while the differing initcode already parts
        // the two addresses, a reader should not have to derive that.
        wrapper = address(
            new BeaconProxy{
                salt: keccak256(
                    abi.encode(block.chainid, "wrapper", wrapperCount)
                )
            }(address(wrapperBeacon), initData)
        );

        isWrapper[wrapper] = true;
        unchecked {
            ++wrapperCount;
        }
        emit WrapperCreated(wrapper, msg.sender, init.name, init.symbol);
    }

    /// @dev Read the note above `wrapperBeacon` before using this.
    function upgradeWrapperBeacon(address newImplementation) external onlyAdmin {
        wrapperBeacon.upgradeTo(newImplementation);
        emit WrapperBeaconUpgraded(newImplementation);
    }
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/contracts && forge test --match-path test/slots/SlotBoundNFTWrapperFactory.t.sol -vv
```

Expected: PASS.

- [ ] **Step 5: Run the whole slots suite for regressions**

```bash
cd apps/contracts && forge test --match-path "test/slots/*.t.sol"
```

Expected: PASS. `SlotBoundNFTFactory.t.sol` must still pass unchanged — collections are untouched.

- [ ] **Step 6: Prove the storage layout appended and did not shift**

The factory is live; a shifted slot is a silent, unrecoverable corruption. Run:

```bash
cd apps/contracts && forge inspect SlotBoundNFTFactory storageLayout --json | python3 -c "
import json, sys
want = ['slotFactory','admin','isCollection','collectionCount','wrapperBeacon','isWrapper','wrapperCount']
got = [(s['label'], int(s['slot'])) for s in json.load(sys.stdin)['storage']]
assert [l for l, _ in got] == want, got
assert [i for _, i in got] == [0,1,2,3,4,5,6], got
print('layout appends cleanly:', got)
"
```

Expected: `layout appends cleanly: [...]`. If the assertion trips, the new
variables were declared above `collectionCount` — move them below it.

- [ ] **Step 7: Add the new contracts to the ABI allowlist**

In `packages/contracts/wagmi.config.ts`, add two entries to `INCLUDE` after `"SlotBoundNFT"`:

```ts
  "SlotBoundNFTWrapper",
```

`SlotBoundNFTFactory` is already listed, so its new functions come through on the next generation. Then:

```bash
cd packages/contracts && pnpm build
```

Expected: the build succeeds and the generated output mentions `SlotBoundNFTWrapper`.

- [ ] **Step 8: Commit**

```bash
git add apps/contracts/src/hooks/nft/SlotBoundNFTFactory.sol apps/contracts/test/slots/SlotBoundNFTWrapperFactory.t.sol packages/contracts/wagmi.config.ts
git commit -m "feat(contracts): SlotBoundNFTFactory deploys wrappers behind a beacon

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope

Deploying or upgrading anything on a live chain — the factory upgrade and
`initializeWrappers` are operational steps run through `pnpm protocol upgrade`,
not part of this plan. Also out of scope, per the spec: occupant redemption,
price floors, any claim path for airdrops reaching the wrapper, ERC-1155, and
the beacon-key mitigations (timelock, multisig, clones).
