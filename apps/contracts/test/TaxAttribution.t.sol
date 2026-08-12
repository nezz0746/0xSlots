// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";

contract TAMockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { _mint(msg.sender, 1_000_000 ether); }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev The shape a launchpad would use: a per-address ledger of tax actually
///      paid, built only from `onSettle`.
contract LedgerModule is IUtility {
    mapping(address => uint256) public paidBy;
    mapping(address => uint256) public owedBy;
    uint256 public total;

    function onSettle(
        uint256,
        address occupant,
        uint256 owed,
        uint256 paid
    ) external override {
        paidBy[occupant] += paid;
        owedBy[occupant] += owed;
        total += paid;
    }

    function name() external pure returns (string memory) { return "Ledger"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external view returns (address) { return address(this); }
    function metadataURI() external pure returns (string memory) { return ""; }
    function onTransfer(uint256, address, address) external override {}
    function onPriceUpdate(uint256, uint256, uint256) external override {}
    function onRelease(uint256, address) external override {}
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

/// @dev Reverts on every hook. Proves a broken module cannot brick a slot, and
///      that the `TaxPaid` event survives regardless.
contract RevertingModule is IUtility {
    function onSettle(uint256, address, uint256, uint256) external pure override {
        revert("nope");
    }
    function name() external pure returns (string memory) { return "Reverting"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external view returns (address) { return address(this); }
    function metadataURI() external pure returns (string memory) { return ""; }
    function onTransfer(uint256, address, address) external override {}
    function onPriceUpdate(uint256, uint256, uint256) external override {}
    function onRelease(uint256, address) external override {}
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId || id == type(IModuleMetadata).interfaceId || id == type(IERC165).interfaceId;
    }
}

/**
 * @title TaxAttributionTest
 * @notice `onSettle` / `TaxPaid` — attributing tax to the address that paid it.
 *
 * @dev The three pre-existing module hooks report occupancy (who holds the
 *      slot, at what price, when they left) but never that money moved. Any
 *      module doing revenue share or contribution accounting had to
 *      reconstruct `price x time` from `onTransfer` + `onPriceUpdate`.
 *
 *      That reconstruction computes `owed`, and `owed != paid`: `_accrue` caps
 *      the charge at the remaining deposit. `test_Insolvent_*` below is the
 *      case that matters — it is exploitable in the worst direction, letting
 *      someone claim a large contribution for a tiny payment.
 */
contract TaxAttributionTest is Test {
    SlotFactory factory;
    TAMockERC20 token;
    LedgerModule ledger;

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant MONTH = 30 days;
    uint256 constant BPS = 10_000;

    /// @dev Warps use `T0 + N days` — compile-time constants that emit no
    ///      TIMESTAMP opcode. Anything derived from `block.timestamp` is
    ///      unreliable across `vm.warp` under via-IR: the optimiser may treat
    ///      TIMESTAMP as invariant within the call and fold a cached local back
    ///      into the opcode, so successive relative warps silently land on the
    ///      wrong instant.
    uint256 constant T0 = 1_000_000;

    event TaxPaid(address indexed occupant, uint256 taxOwed, uint256 taxPaid);

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new TAMockERC20();
        ledger = new LedgerModule();
        token.mint(alice, 100_000 ether);
        token.mint(bob, 100_000 ether);
        vm.warp(T0);
    }

    function _slot(address module) internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(token)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            SlotInitParams({
                taxPercentage: 1000, // 10%/month
                utility: module,
                liquidationBountyBps: 500,
                minDepositSeconds: 0,
            occupancyPolicy: address(0)
            })
        ));
    }

    function _buy(Slot s, address who, uint256 dep, uint256 px) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, dep, px);
        vm.stopPrank();
    }

    function _expectedTax(uint256 price, uint256 elapsed) internal pure returns (uint256) {
        return (price * 1000 * elapsed) / (MONTH * BPS);
    }

    // ── Attribution ─────────────────────────────────────────────────────────

    function test_Solvent_LedgerMatchesExpectedTax() public {
        Slot s = _slot(address(ledger));
        _buy(s, alice, 1_000 ether, 100 ether);

        vm.warp(T0 + 30 days);
        s.collect();

        uint256 expected = _expectedTax(100 ether, 30 days);
        assertEq(ledger.paidBy(alice), expected, "alice credited her own tax");
        assertEq(ledger.total(), expected);
        assertEq(ledger.paidBy(bob), 0);
    }

    /// A buy charges the OUTGOING occupant for their tenure, because `_settle()`
    /// runs before occupancy is reassigned.
    function test_Transfer_ChargesOutgoingOccupantNotBuyer() public {
        Slot s = _slot(address(ledger));
        _buy(s, alice, 1_000 ether, 100 ether);

        vm.warp(T0 + 10 days);
        _buy(s, bob, 1_000 ether, 200 ether); // bob takes it from alice

        uint256 aliceTax = _expectedTax(100 ether, 10 days);
        assertEq(ledger.paidBy(alice), aliceTax, "alice pays for her 10 days");
        assertEq(ledger.paidBy(bob), 0, "bob has not held it for any time yet");

        vm.warp(T0 + 15 days);
        s.collect();

        assertEq(ledger.paidBy(alice), aliceTax, "alice's total is unchanged");
        assertEq(
            ledger.paidBy(bob),
            _expectedTax(200 ether, 5 days),
            "bob pays his own tenure at his own price"
        );
    }

    /// Mid-tenure price changes are handled for free: the ledger sums payments
    /// rather than integrating price over time.
    /// @dev Absolute timestamps, not `block.timestamp + X`. Under via-IR the
    ///      TIMESTAMP opcode can be treated as invariant across the `vm.warp`
    ///      cheatcode call, so a second relative warp silently re-uses the
    ///      pre-warp value and time never advances.
    function test_PriceChangeMidTenure_IsAccountedCorrectly() public {
        Slot s = _slot(address(ledger));
        _buy(s, alice, 10_000 ether, 100 ether);

        vm.warp(T0 + 10 days);
        vm.prank(alice);
        s.selfAssess(500 ether); // settles at the old price first

        vm.warp(T0 + 20 days);
        s.collect();

        uint256 expected =
            _expectedTax(100 ether, 10 days) + _expectedTax(500 ether, 10 days);
        assertEq(ledger.paidBy(alice), expected, "each segment at its own price");
    }

    // ── The exploit this hook exists to prevent ─────────────────────────────

    /// @dev `_accrue` caps the charge at the remaining deposit:
    ///
    ///        if (owed >= _deposit) { paid = _deposit; ... }
    ///
    ///      So a huge self-assessed price with a tiny deposit accrues a huge
    ///      `owed` while only ever paying the deposit. A launchpad crediting
    ///      allocation by `price x time` would hand this address an enormous
    ///      share of supply for almost no money. Crediting `paid` does not.
    function test_Insolvent_PaidIsCappedByDeposit_OwedIsNot() public {
        Slot s = _slot(address(ledger));

        uint256 tinyDeposit = 1 ether;
        _buy(s, alice, tinyDeposit, 1_000_000 ether); // absurd price, no money

        vm.warp(T0 + 30 days);
        s.collect();

        uint256 owedIfNaive = _expectedTax(1_000_000 ether, 30 days);

        assertEq(ledger.paidBy(alice), tinyDeposit, "credited only what she paid");
        assertGt(owedIfNaive, tinyDeposit * 1000, "naive accounting is wildly larger");
        assertEq(
            ledger.owedBy(alice),
            owedIfNaive,
            "owed is the number a price x time reconstruction would produce"
        );
    }

    // ── Robustness ──────────────────────────────────────────────────────────

    /// The event is authoritative; the hook is a convenience. A module that
    /// reverts must neither brick the slot nor suppress the record.
    function test_RevertingModule_DoesNotBrickSlot_AndEventStillFires() public {
        RevertingModule bad = new RevertingModule();
        Slot s = _slot(address(bad));
        _buy(s, alice, 1_000 ether, 100 ether);

        vm.warp(T0 + 30 days);

        uint256 expected = _expectedTax(100 ether, 30 days);
        vm.expectEmit(true, false, false, true, address(s));
        emit TaxPaid(alice, expected, expected);

        s.collect(); // must not revert

        assertEq(s.occupant(), alice, "slot still usable");
        vm.prank(alice);
        s.release();
        assertEq(s.occupant(), address(0));
    }

    function test_NoModule_StillEmitsTaxPaid() public {
        Slot s = _slot(address(0));
        _buy(s, alice, 1_000 ether, 100 ether);

        vm.warp(T0 + 30 days);

        uint256 expected = _expectedTax(100 ether, 30 days);
        vm.expectEmit(true, false, false, true, address(s));
        emit TaxPaid(alice, expected, expected);
        s.collect();
    }

    /// A settle that moves no money must stay silent, or an indexer reducing
    /// TaxPaid would process a stream of zero-value rows on every interaction.
    function test_ZeroPaid_DoesNotNotify() public {
        Slot s = _slot(address(ledger));
        _buy(s, alice, 1_000 ether, 100 ether);
        assertEq(ledger.paidBy(alice), 0, "nothing accrued yet");

        // Another interaction in the same block: `_settle()` runs but no time
        // has passed, so there is nothing to charge.
        vm.startPrank(alice);
        s.topUp(1 ether);
        vm.stopPrank();

        assertEq(ledger.paidBy(alice), 0, "no zero-value attribution");
        assertEq(ledger.total(), 0);
    }

    /// Vacant slots accrue nothing and must not attribute to address(0).
    function test_VacantSlot_NoAttribution() public {
        Slot s = _slot(address(ledger));
        _buy(s, alice, 1_000 ether, 100 ether);
        vm.warp(T0 + 5 days);
        vm.prank(alice);
        s.release();

        uint256 afterRelease = ledger.paidBy(alice);

        vm.warp(T0 + 35 days);
        assertEq(ledger.paidBy(address(0)), 0, "no attribution to the zero address");
        assertEq(ledger.paidBy(alice), afterRelease, "no accrual while vacant");
    }
}
