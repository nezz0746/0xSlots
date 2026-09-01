// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotSellOrder} from "../src/v1/base/SlotSellOrder.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/v1/interfaces/ISlot.sol";
import {IUtility} from "../src/v1/interfaces/IUtility.sol";
import {IModuleMetadata} from "../src/v1/interfaces/IModuleMetadata.sol";
import "../src/v1/interfaces/SlotErrors.sol";

contract PoCToken is ERC20 {
    constructor() ERC20("PoC", "POC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev A utility whose `feeBps()` burns every gas unit forwarded to it.
///      Used to test whether the un-capped staticcall in `_distributeTax`
///      is exploitable.
contract GasBurnerUtility is IUtility {
    uint256 public sink;
    function feeBps() external view returns (uint256) {
        // Burn everything forwarded. A view can still consume the frame's gas.
        uint256 i;
        while (true) { i = uint256(keccak256(abi.encode(i, sink))); }
        return 0;
    }
    function feeRecipient() external pure returns (address) { return address(0xFEE); }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function name() external pure returns (string memory) { return "Burner"; }
    function version() external pure returns (string memory) { return "1"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @dev A well-behaved module: cheap, verifiable, and it records hook calls
///      so we can observe whether the gallery ever notifies it.
contract BenignModule is IUtility {
    uint256 public transfers;
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external pure returns (address) { return address(0); }
    function onTransfer(uint256, address, address) external { transfers++; }
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external { transfers++; }
    function onSettle(uint256, address, uint256, uint256) external {}
    function name() external pure returns (string memory) { return "Benign"; }
    function version() external pure returns (string memory) { return "1"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @dev Returns a huge buffer instead of burning gas. `_distributeTax` does
///      `(bool ok, bytes memory data) = utility.staticcall(...)`, which forces
///      the CALLER to returndatacopy everything. The callee pays 63/64 of the
///      gas to build the buffer; the caller must pay comparable memory
///      expansion out of the 1/64 it retained — an asymmetry no gas budget
///      fixes.
contract ReturnBombUtility is IUtility {
    function feeBps() external pure returns (uint256) {
        assembly { return(0, 0x1000000) }   // ~16MB of returndata
    }
    function feeRecipient() external pure returns (address) { return address(0xFEE); }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function name() external pure returns (string memory) { return "Bomb"; }
    function version() external pure returns (string memory) { return "1"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

contract AuditRegressionTest is Test {
    SlotFactory factory;
    PoCToken token;

    address recipient = makeAddr("recipient");
    address alice     = makeAddr("alice");
    address victim;
    uint256 victimKey;
    address attacker  = makeAddr("attacker");
    address manager   = makeAddr("manager");

    function setUp() public {
        (victim, victimKey) = makeAddrAndKey("victim");
        Slot slotImpl = new Slot();
        SlotFactory impl = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(
            address(impl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        )));
        token = new PoCToken();
        token.mint(alice, 10_000 ether);
        token.mint(victim, 10_000 ether);
        token.mint(attacker, 10_000 ether);
        vm.warp(1_000_000);
    }

    function _params(address utility, uint64 minDepSecs)
        internal pure returns (SlotInitParams memory)
    {
        return SlotInitParams({
            taxPercentage: 100,               // 1% / month
            utility: utility,
            liquidationBountyBps: 500,
            minDepositSeconds: minDepSecs,
            occupancyPolicy: address(0)
        });
    }

    function _slot(address utility, uint64 minDepSecs) internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: true, mutablePolicy: false, manager: manager}),
            _params(utility, minDepSecs)
        ));
    }

    // ══════════════════════════════════════════════════════════════════════
    // P1 — sell() treats a bare allowance as consent
    // ══════════════════════════════════════════════════════════════════════

    /// @notice FIXED. The occupant can no longer drain an address merely
    ///         because it holds a standing allowance: `sell` requires the
    ///         buyer's signature over the exact terms.
    function test_P1_CannotDrainAnApproverWithoutTheirSignature() public {
        Slot s = _slot(address(0), 0);

        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        s.buy(attacker, 1 ether, 10 ether);
        vm.stopPrank();

        // Victim approves the slot — as anyone intending to `buy` must.
        vm.prank(victim);
        token.approve(address(s), type(uint256).max);

        uint256 before = token.balanceOf(victim);

        // The attacker forges terms the victim never agreed to.
        SlotSellOrder.SellOrder memory order = SlotSellOrder.SellOrder({
            slot: address(s), buyer: victim, price: 5_000 ether, deposit: 0,
            nonce: 0, deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) =
            vm.sign(uint256(0xA11CE), s.sellOrderHash(order));   // not victim's key

        vm.prank(attacker);
        vm.expectRevert(SlotSellOrder.SellOrderBadSignature.selector);
        s.sell(order, abi.encodePacked(r, ss, v));

        assertEq(token.balanceOf(victim), before, "victim untouched");
        assertEq(s.occupant(), attacker, "victim was not force-seated");
    }

    /// @notice FIXED. The buyer signs `price` AND `deposit`, so the occupant
    ///         can no longer repartition an exact approval into pure proceeds.
    function test_P1_SplitIsFixedByTheBuyer() public {
        Slot s = _slot(address(0), 0);

        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        s.buy(attacker, 1 ether, 10 ether);
        vm.stopPrank();

        vm.prank(victim);
        token.approve(address(s), 150 ether);

        // The bidder signs the terms they actually want: 100 price, 50 escrow.
        SlotSellOrder.SellOrder memory intended = SlotSellOrder.SellOrder({
            slot: address(s), buyer: victim, price: 100 ether, deposit: 50 ether,
            nonce: 0, deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) =
            vm.sign(victimKey, s.sellOrderHash(intended));
        bytes memory sig = abi.encodePacked(r, ss, v);

        // The occupant tries the old attack: same total, all of it as price.
        // Built field-by-field: `= intended` would alias the same memory and
        // silently mutate the order we are about to execute.
        SlotSellOrder.SellOrder memory greedy = SlotSellOrder.SellOrder({
            slot: intended.slot,
            buyer: intended.buyer,
            price: 150 ether,
            deposit: 0,
            nonce: intended.nonce,
            deadline: intended.deadline
        });

        vm.prank(attacker);
        vm.expectRevert(SlotSellOrder.SellOrderBadSignature.selector);
        s.sell(greedy, sig);

        // Only the signed split executes.
        vm.prank(attacker);
        s.sell(intended, sig);

        assertEq(s.occupant(), victim, "seated on the agreed terms");
        assertEq(s.deposit(), 50 ether, "the buyer's escrow survived");
        assertFalse(s.isInsolvent(), "and they are solvent");
    }

    /// @notice A signature is single-use.
    function test_P1_SellOrderCannotBeReplayed() public {
        Slot s = _slot(address(0), 0);
        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        s.buy(attacker, 1 ether, 10 ether);
        vm.stopPrank();

        vm.prank(victim);
        token.approve(address(s), type(uint256).max);

        SlotSellOrder.SellOrder memory o = SlotSellOrder.SellOrder({
            slot: address(s), buyer: victim, price: 20 ether, deposit: 5 ether,
            nonce: 0, deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(victimKey, s.sellOrderHash(o));
        bytes memory sig = abi.encodePacked(r, ss, v);

        vm.prank(attacker);
        s.sell(o, sig);

        // victim now occupies; they sell back, then the old sig must not work.
        vm.prank(victim);
        vm.expectRevert(SlotSellOrder.SellOrderAlreadyUsed.selector);
        s.sell(o, sig);
    }

    /// @notice A buyer can cancel a signature they regret.
    function test_P1_BuyerCanCancelASignedOrder() public {
        Slot s = _slot(address(0), 0);
        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        s.buy(attacker, 1 ether, 10 ether);
        vm.stopPrank();

        vm.prank(victim);
        token.approve(address(s), type(uint256).max);

        SlotSellOrder.SellOrder memory o = SlotSellOrder.SellOrder({
            slot: address(s), buyer: victim, price: 20 ether, deposit: 5 ether,
            nonce: 0, deadline: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(victimKey, s.sellOrderHash(o));

        vm.prank(victim);
        s.cancelSellOrder(0);

        vm.prank(attacker);
        vm.expectRevert(SlotSellOrder.SellOrderAlreadyUsed.selector);
        s.sell(o, abi.encodePacked(r, ss, v));
    }

    // ══════════════════════════════════════════════════════════════════════
    // P2 — unbounded price overflows _accrue
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Tests whether a max self-assessed price bricks the slot.
    function test_P2_MaxPriceBricksTheSlot() public {
        Slot s = _slot(address(0), 0);   // minDepositSeconds = 0 -> free

        // FIXED: an unbounded price is refused outright, so the settle
        // overflow that bricked every entry point can no longer be reached.
        vm.prank(attacker);
        vm.expectRevert(InvalidPrice.selector);
        s.buy(attacker, 0, type(uint256).max);

        assertEq(s.occupant(), address(0), "slot never taken");
    }

    /// @notice Finds the ACTUAL minimum bricking price at a realistic tax rate.
    function test_P2_MinimumBrickingPrice() public {
        // owed = price * taxPct * elapsed  must exceed 2^256-1.
        // taxPct = 100 (1%/mo), elapsed = 1s  ->  price > (2^256-1)/100
        uint256 threshold = type(uint256).max / 100;
        Slot s = _slot(address(0), 0);

        vm.prank(attacker);
        vm.expectRevert(InvalidPrice.selector);
        s.buy(attacker, 0, threshold + 1);

        // And the bound is far below it: MAX_PRICE is 2^128-1.
        assertLt(s.maxPrice(), threshold, "cap sits well under the danger zone");
    }

    /// @notice Is a non-zero `minDepositSeconds` an accidental defence?
    ///         `_minDepositFor` multiplies price*tax*minDepositSeconds, which
    ///         overflows FIRST, reverting the buy before the price is stored.
    function test_P2_NonZeroMinDepositSecondsBlocksTheBrick() public {
        Slot s = _slot(address(0), 1 days);

        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert();                       // overflow in _minDepositFor
        s.buy(attacker, 0, type(uint256).max);
        vm.stopPrank();

        assertEq(s.occupant(), address(0), "slot never taken; brick prevented");
    }

    /// @notice A realistic price is nowhere near the overflow threshold, so
    ///         honest slots are unaffected — this is a deliberate-grief bug.
    function test_P2_RealisticPricesAreSafe() public {
        Slot s = _slot(address(0), 0);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 1_000_000_000 ether);   // $1B-scale price
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        s.collect();                                  // settles fine
        assertGt(s.price(), 0);
    }

    /// @notice AMPLIFICATION: one bricked slot poisons batch collection for
    ///         every other slot. `collectAll` guards `collect()` with
    ///         try/catch but calls `taxOwed()` OUTSIDE it, and `taxOwed()`
    ///         reverts on a bricked slot.
    function test_P2_OneBrickedSlotBreaksCollectAll() public {
        Slot healthy = _slot(address(0), 0);
        Slot bricked = _slot(address(0), 0);

        vm.startPrank(alice);
        token.approve(address(healthy), type(uint256).max);
        healthy.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();

        // A slot can no longer be bricked at all...
        vm.prank(attacker);
        vm.expectRevert(InvalidPrice.selector);
        bricked.buy(attacker, 0, type(uint256).max);

        vm.warp(block.timestamp + 30 days);

        // ...and `collectAll` is defensive regardless: `taxOwed()` now reads
        // inside the try, so one bad slot can never take the batch down.
        address[] memory batch = new address[](2);
        batch[0] = address(healthy);
        batch[1] = address(bricked);
        factory.collectAll(batch);       // no revert
    }

    // ══════════════════════════════════════════════════════════════════════
    // P3 — un-gas-capped staticcall in _distributeTax
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Tests whether a gas-burning utility head can block liquidation.
    function test_P3_GasBurnerUtilityBlocksLiquidation() public {
        GasBurnerUtility burner = new GasBurnerUtility();
        // NOTE: createSlot does NOT require the utility to be verified —
        // only that it has code. This is what makes the head reachable.
        Slot s = _slot(address(burner), 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 100 ether);
        vm.stopPrank();

        // Run the occupant dry so they are liquidatable with tax collected.
        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "occupant is insolvent");

        // How much gas does eviction now cost, and does it complete at all?
        uint256 g0 = gasleft();
        (bool ok10M, ) = address(s).call{gas: 10_000_000}(
            abi.encodeWithSignature("liquidate()")
        );
        uint256 used = g0 - gasleft();
        emit log_named_uint("gas consumed by liquidate() w/ burner utility", used);
        emit log_named_string("liquidate() succeeded at 10M gas", ok10M ? "YES" : "NO");

        // The honest question: at a NORMAL gas budget, does it still work?
        assertTrue(ok10M, "at 10M gas eviction completes (63/64 leaves enough tail)");
    }

    /// @notice The real shape of P3: not a hard DoS, but a gas amplification.
    ///         A caller using a normal estimate is griefed into failure.
    function test_P3_GasBurnerGriefsNormalGasBudgets() public {
        GasBurnerUtility burner = new GasBurnerUtility();
        Slot s = _slot(address(burner), 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);

        // 500k is a generous budget for an eviction on a clean slot.
        // FIXED: the fee read is gas-capped, so a hostile head can no longer
        // inflate eviction past a normal budget.
        (bool ok500k, ) = address(s).call{gas: 500_000}(
            abi.encodeWithSignature("liquidate()")
        );
        assertTrue(ok500k, "eviction completes at a normal 500k budget");
        assertEq(s.occupant(), address(0), "occupant evicted");
    }

    /// @notice A clean slot for comparison — what eviction SHOULD cost.
    function test_P3_BaselineLiquidationCost() public {
        Slot s = _slot(address(0), 0);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);

        (bool ok, ) = address(s).call{gas: 500_000}(
            abi.encodeWithSignature("liquidate()")
        );
        assertTrue(ok, "baseline: eviction fits comfortably in 500k");
    }

    /// @notice SEPARATE BUG found while writing these: `setUtilityVerified`
    ///         calls `mod.feeBps()` un-capped inside its event emission, so
    ///         verifying a hostile module burns the admin's whole transaction.
    function test_NEW_SetUtilityVerifiedIsGriefableByFeeBps() public {
        GasBurnerUtility burner = new GasBurnerUtility();
        // FIXED: the fee is read under a stipend and defaults to zero, so a
        // hostile module can no longer make itself impossible to verify — or,
        // worse, impossible to REVOKE.
        (bool ok, ) = address(factory).call{gas: 5_000_000}(
            abi.encodeWithSignature("setUtilityVerified(address,bool)", address(burner), true)
        );
        assertTrue(ok, "verification survives a hostile feeBps()");
        assertTrue(factory.isUtilityVerified(address(burner)));
    }

    // ══════════════════════════════════════════════════════════════════════
    // P4 — module gallery inert
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Tests whether a queued module is ever actually installed.
    function test_P4_GalleryNeverInstalls() public {
        Slot s = _slot(address(0), 0);
        BenignModule mod = new BenignModule();
        factory.setUtilityVerified(address(mod), true);

        vm.prank(manager);
        s.addModule(address(mod));
        assertEq(s.pendingModules().length, 1, "queued");

        // Drive a full occupancy transition — the documented apply point.
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();

        vm.prank(alice);
        s.release();

        // FIXED: the transition drains the queue and the module is notified.
        assertEq(s.pendingModules().length, 0, "queue drained on transition");
        assertEq(s.galleryModules().length, 1, "module installed");
        assertTrue(s.isModuleInstalled(address(mod)));
        assertGt(mod.transfers(), 0, "and it received hooks");
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW (round 2) — manager redirects the recipient's accrued tax
    // ══════════════════════════════════════════════════════════════════════

    /// @notice The bounty rug is gone because the bounty is gone.
    ///
    /// @dev The original attack: `setLiquidationBounty` was immediate, allowed
    ///      100%, and paid `msg.sender` — so a manager (an address independent
    ///      of `recipient`) could `multicall([set(10000), liquidate()])` and
    ///      take the entire accrued tax pot in one transaction.
    ///
    ///      Capping the rate would have blunted it. Removing bounties removes
    ///      it: there is no longer a lever to pull, and no cut to take.
    function test_NEW_BountyRugIsImpossible() public {
        Slot s = _slot(address(0), 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 1_000 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "occupant insolvent");

        // The lever no longer exists.
        vm.prank(manager);
        vm.expectRevert(LiquidationBountyRetired.selector);
        s.setLiquidationBounty(10_000);

        uint256 recipientBefore = token.balanceOf(recipient);
        uint256 managerBefore = token.balanceOf(manager);

        vm.prank(manager);
        s.liquidate();

        assertEq(
            token.balanceOf(manager),
            managerBefore,
            "manager takes nothing for liquidating"
        );
        assertGt(
            token.balanceOf(recipient),
            recipientBefore,
            "all tax reaches the recipient"
        );
    }

    /// @notice Control: liquidation still flushes tax to the recipient.
    function test_NEW_LiquidationStillPaysRecipient() public {
        Slot s = _slot(address(0), 0);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 1_000 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);

        uint256 before = token.balanceOf(recipient);
        s.liquidate();                       // default 500 bps
        assertGt(token.balanceOf(recipient), before, "recipient normally paid");
    }

    /// @notice Binary-search the real gas requirement for liquidating a slot
    ///         whose utility head burns gas. Decides whether P3 is a hard DoS
    ///         (needs > block limit) or expensive griefing.
    function test_P3_MeasureRealGasRequirement() public {
        uint256 lo = 500_000;
        uint256 hi = 60_000_000;

        for (uint256 i; i < 24; ++i) {
            uint256 mid = (lo + hi) / 2;
            if (_liquidateSucceedsAt(mid)) { hi = mid; } else { lo = mid + 1; }
        }
        emit log_named_uint("min gas to liquidate w/ gas-burning utility", hi);
        emit log_named_uint("mainnet-style block limit", 30_000_000);
        emit log_named_string(
            "exceeds a 30M block limit (hard DoS)?",
            hi > 30_000_000 ? "YES" : "NO"
        );
    }

    function _liquidateSucceedsAt(uint256 gasBudget) internal returns (bool ok) {
        uint256 snap = vm.snapshotState();
        GasBurnerUtility burner = new GasBurnerUtility();
        Slot s = _slot(address(burner), 0);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);
        (ok, ) = address(s).call{gas: gasBudget}(abi.encodeWithSignature("liquidate()"));
        vm.revertToState(snap);
    }

    /// @notice Is `collect()` also bricked when the head is IMMUTABLE (so it
    ///         can never be detached)? That would lock the tax permanently.
    function test_P3_CollectWithImmutableHostileHead() public {
        GasBurnerUtility burner = new GasBurnerUtility();
        Slot s = Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _params(address(burner), 0)
        ));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 days);

        (bool ok500k, ) = address(s).call{gas: 500_000}(abi.encodeWithSignature("collect()"));
        emit log_named_string("collect() at 500k", ok500k ? "OK" : "REVERTS");
        assertTrue(ok500k, "capped fee read keeps the flush affordable");

        // And the head can NEVER be detached: a fully-immutable slot must have
        // manager == address(0), so `removeModule` is unreachable by anyone.
        assertEq(s.manager(), address(0), "immutable slot has no manager");
        vm.expectRevert();               // NotManager: msg.sender != address(0)
        s.removeModule(address(burner));


    }

    /// @notice P2 extension: an OPERATOR (not just the occupant) can brick.
    function test_P2_OperatorCanBrickViaSelfAssess() public {
        Slot s = _slot(address(0), 0);
        address operator = makeAddr("operator");

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        s.setOperator(operator, true);
        vm.stopPrank();

        // FIXED: the bound applies to `selfAssess` too, so the operator lever
        // into the same overflow is closed.
        vm.prank(operator);
        vm.expectRevert(InvalidPrice.selector);
        s.selfAssess(type(uint256).max);

        vm.warp(block.timestamp + 1);
        s.collect();                     // still healthy
    }

    // ══════════════════════════════════════════════════════════════════════
    // NEW (round 2) — permissionless re-initialization of a legacy proxy
    // ══════════════════════════════════════════════════════════════════════

    /// @dev OZ v5 Initializable's ERC-7201 slot. `_initialized` is its low 8B.
    bytes32 constant INITIALIZABLE_SLOT =
        0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /// @notice `Slot.initialize` is `external initializer` with NO caller
    ///         gate — its only guard is OZ's version counter. `_legacyInitialized`
    ///         (slot 14) is documented as "a hand-rolled init flag that
    ///         reinitializer replaced", proving an earlier generation of slots
    ///         was initialized WITHOUT OZ Initializable.
    ///
    ///         This simulates such a proxy (OZ counter == 0) and shows anyone
    ///         can seize it: recipient, currency, manager and tax all rewritten
    ///         on a LIVE, OCCUPIED slot.
    function test_NEW_LegacyProxyIsReinitializableByAnyone() public {
        Slot s = _slot(address(0), 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();

        assertEq(s.recipient(), recipient, "honest recipient");
        assertEq(s.occupant(), alice, "slot is live and occupied");

        // Simulate a pre-OZ-Initializable proxy: version counter at 0.
        vm.store(address(s), INITIALIZABLE_SLOT, bytes32(0));

        // Anyone. No role, no factory, no manager.
        // FIXED: `initialize` now guards on STATE (a non-zero `recipient`),
        // not only on OZ's version counter, so a legacy proxy whose counter is
        // still zero is no longer seizable.
        vm.prank(attacker);
        vm.expectRevert(SlotAlreadyInitialized.selector);
        s.initialize(
            attacker,
            IERC20(address(token)),
            SlotConfig({
                mutableTax: true, mutableUtility: true, mutablePolicy: true,
                manager: attacker
            }),
            _params(address(0), 0),
            address(factory)
        );

        assertEq(s.recipient(), recipient, "recipient untouched");
        assertEq(s.occupant(),  alice,     "occupant untouched");
    }

    /// @notice Control: a normally-created slot is NOT re-initializable.
    function test_NEW_CurrentGenerationSlotsAreProtected() public {
        Slot s = _slot(address(0), 0);
        vm.prank(attacker);
        vm.expectRevert();                  // InvalidInitialization
        s.initialize(
            attacker, IERC20(address(token)),
            SlotConfig({mutableTax: true, mutableUtility: true, mutablePolicy: true, manager: attacker}),
            _params(address(0), 0), address(factory)
        );
        assertEq(s.recipient(), recipient, "untouched");
    }

    /// @notice THE decisive P3 test: is the un-capped staticcall a survivable
    ///         gas grief (my earlier measurement: 4.19M) or an unfixable brick?
    function test_P3_ReturnBombIsScaleInvariant() public {
        ReturnBombUtility bomb = new ReturnBombUtility();
        Slot s = _slot(address(bomb), 0);

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 30 days);

        // Throw escalating budgets at it. If any succeeds it is mere griefing.
        uint256[5] memory budgets =
            [uint256(1_000_000), 10_000_000, 30_000_000, 100_000_000, 500_000_000];

        for (uint256 i; i < budgets.length; ++i) {
            uint256 snap = vm.snapshotState();
            (bool ok, ) = address(s).call{gas: budgets[i]}(
                abi.encodeWithSignature("collect()"));
            emit log_named_string(
                string.concat("collect() at ", vm.toString(budgets[i]), " gas"),
                ok ? "SUCCEEDS" : "REVERTS"
            );
            vm.revertToState(snap);
        }
    }

    /// @notice And with an immutable head there is no escape hatch at all.
    function test_P3_ReturnBombOnImmutableHeadIsPermanent() public {
        ReturnBombUtility bomb = new ReturnBombUtility();
        Slot s = Slot(factory.createSlot(
            recipient, IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            _params(address(bomb), 0)
        ));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "occupant insolvent");

        (bool okBig, ) = address(s).call{gas: 100_000_000}(
            abi.encodeWithSignature("liquidate()"));
        emit log_named_string("liquidate() at 100M gas", okBig ? "SUCCEEDS" : "REVERTS");

        assertEq(s.manager(), address(0), "no manager: head can never be detached");
    }

    // ─── is the liquidation bounty even needed? ─────────────────────────────

    /// @notice The real incentive to evict a deadbeat is the SLOT, not the
    ///         bounty. `liquidate()` leaves the slot vacant, and a vacant slot
    ///         costs only your own deposit — so anyone who wants it can evict
    ///         and take it atomically, with the bounty set to zero.
    function test_LiquidateAndTakeIsSelfIncentivising() public {
        Slot s = Slot(factory.createSlot(
            recipient, IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: true, mutablePolicy: false, manager: manager}),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(0),
                liquidationBountyBps: 0,          // no keeper subsidy at all
                minDepositSeconds: 0,
                occupancyPolicy: address(0)
            })
        ));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 1 ether, 100 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 3650 days);
        assertTrue(s.isInsolvent(), "alice is a deadbeat");

        // Bob wants the slot. One transaction: evict, then take.
        vm.startPrank(attacker);
        token.approve(address(s), type(uint256).max);
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSignature("liquidate()");
        calls[1] = abi.encodeWithSignature(
            "buy(address,uint256,uint256)", attacker, uint256(5 ether), uint256(50 ether)
        );
        s.multicall(calls);
        vm.stopPrank();

        assertEq(s.occupant(), attacker, "evicted and taken in one tx");
        assertEq(s.price(), 50 ether, "at his own price");
    }

    /// @notice And with no bounty, the recipient keeps 100% of the tax.
    function test_WithoutABountyTheRecipientKeepsEverything() public {
        Slot s = Slot(factory.createSlot(
            recipient, IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: true, mutablePolicy: false, manager: manager}),
            SlotInitParams({
                taxPercentage: 100, utility: address(0),
                liquidationBountyBps: 0, minDepositSeconds: 0,
                occupancyPolicy: address(0)
            })
        ));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 10 ether, 100 ether);
        vm.stopPrank();
        vm.warp(block.timestamp + 3650 days);

        uint256 before = token.balanceOf(recipient);
        vm.prank(attacker);
        s.liquidate();

        assertEq(
            token.balanceOf(recipient) - before,
            10 ether,
            "every unit of tax reached the recipient"
        );
    }
}
