// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Slot} from "../src/Slot.sol";
import "../src/interfaces/SlotErrors.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MinimumPricePolicyFactory} from "../src/policies/MinimumPricePolicyFactory.sol";
import {MinimumPricePolicy} from "../src/policies/MinimumPricePolicy.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Burns every wei of gas forwarded to it. Models an occupant trying to
///      make their own eviction fail. Can never receive ETH by any means —
///      which is the point: it must still not be able to block a buy.
contract GasBurner {
    function buyInto(Slot slot, uint256 dep, uint256 price) external payable {
        slot.buy{value: msg.value}(address(this), dep, price);
    }

    receive() external payable {
        while (true) {}
    }
}

/// @dev Needs far more than the 30k push cap but succeeds at full gas.
///      Models a legitimate smart-contract occupant: credited on eviction,
///      paid on claim.
contract GasHog {
    uint256[] private junk;

    function buyInto(Slot slot, uint256 dep, uint256 price) external payable {
        slot.buy{value: msg.value}(address(this), dep, price);
    }

    receive() external payable {
        // Four cold SSTOREs — roughly 80k gas, comfortably over the 30k cap
        // and comfortably under a full-gas claim.
        for (uint256 i = 0; i < 4; i++) junk.push(i);
    }
}

/// @dev Rejects ETH outright. The simplest form of an unpayable recipient,
///      distinct from GasBurner in that it fails immediately rather than by
///      exhausting gas — both must degrade to a credit.
contract RevertingReceiver {
    function buyInto(Slot slot, uint256 dep, uint256 price) external payable {
        slot.buy{value: msg.value}(address(this), dep, price);
    }

    receive() external payable {
        revert("no ETH thanks");
    }
}

contract NativeEthTest is Test {
    SlotFactory factory;
    MockERC20 token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address liquidator = makeAddr("liquidator");

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));
        token = new MockERC20();
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    function _config() internal view returns (SlotConfig memory) {
        return SlotConfig({
            mutableTax: true,
            mutableUtility: false,
            mutablePolicy: false,
            manager: manager
        });
    }

    function _init() internal pure returns (SlotInitParams memory) {
        return SlotInitParams({
            taxPercentage: 100,          // 1% per 30 days
            utility: address(0),
            liquidationBountyBps: 500,   // 5%
            minDepositSeconds: 86400,    // 1 day
            occupancyPolicy: address(0)
        });
    }

    function _createNativeSlot() internal returns (Slot) {
        return Slot(factory.createSlot(recipient, IERC20(address(0)), _config(), _init()));
    }

    function _createTokenSlot() internal returns (Slot) {
        return Slot(factory.createSlot(recipient, IERC20(address(token)), _config(), _init()));
    }

    /// @dev Buys a native slot, dealing the buyer exactly what they owe.
    ///      Vacant slots cost only the deposit; occupied ones also cost price.
    function _buyNative(
        Slot slot,
        address buyer,
        uint256 depositAmt,
        uint256 selfPrice
    ) internal {
        uint256 owed = slot.occupant() == address(0)
            ? depositAmt
            : depositAmt + slot.price();
        vm.deal(buyer, owed);
        vm.prank(buyer);
        slot.buy{value: owed}(buyer, depositAmt, selfPrice);
    }

    // ═══════════════════════════════════════════════════════════
    // SENTINEL
    // ═══════════════════════════════════════════════════════════

    function test_createNativeSlot() public {
        Slot slot = _createNativeSlot();
        assertEq(address(slot.currency()), address(0));
        assertEq(slot.recipient(), recipient);
        assertTrue(slot.isVacant());
    }

    function test_createSlot_rejectsCodelessCurrency() public {
        address notAToken = makeAddr("notAToken");
        vm.expectRevert(InvalidCurrency.selector);
        factory.createSlot(recipient, IERC20(notAToken), _config(), _init());
    }

    // ═══════════════════════════════════════════════════════════
    // INBOUND
    // ═══════════════════════════════════════════════════════════

    function test_native_buyRecordsDeposit() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        assertEq(slot.occupant(), alice);
        assertEq(slot.price(), 10 ether);
        assertEq(slot.deposit(), 1 ether);
        assertEq(address(slot).balance, 1 ether);
    }

    function test_native_buyRejectsWrongValue() public {
        Slot slot = _createNativeSlot();
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        vm.expectRevert(InvalidValue.selector);
        slot.buy{value: 0.5 ether}(alice, 1 ether, 10 ether); // too little

        vm.prank(alice);
        vm.expectRevert(InvalidValue.selector);
        slot.buy{value: 2 ether}(alice, 1 ether, 10 ether);   // too much
    }

    function test_tokenSlot_rejectsValue() public {
        Slot slot = _createTokenSlot();
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(InvalidValue.selector);
        slot.buy{value: 1 wei}(alice, 1 ether, 10 ether);
    }

    function test_native_topUp() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.deal(bob, 2 ether);
        vm.prank(bob);
        slot.topUp{value: 2 ether}(2 ether);

        assertEq(slot.deposit(), 3 ether);
        assertEq(address(slot).balance, 3 ether);
    }

    function test_native_topUpRejectsMismatch() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.deal(bob, 2 ether);
        vm.prank(bob);
        vm.expectRevert(InvalidValue.selector);
        slot.topUp{value: 1 ether}(2 ether);
    }

    function test_native_hasNoReceiveFunction() public {
        Slot slot = _createNativeSlot();
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        (bool ok, ) = address(slot).call{value: 1 ether}("");
        assertFalse(ok, "slot must not accept unaccounted ETH");
        assertEq(address(slot).balance, 0);
    }

    // ═══════════════════════════════════════════════════════════
    // OUTBOUND
    // ═══════════════════════════════════════════════════════════

    function test_native_withdrawRoundTrip() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 5 ether, 10 ether);

        // minDepositSeconds is 1 day at 1%/30d on a 10 ether price,
        // so the floor is tiny and 1 ether is comfortably withdrawable.
        uint256 before = alice.balance;
        vm.prank(alice);
        slot.withdraw(1 ether);

        assertEq(alice.balance, before + 1 ether);
        assertEq(slot.deposit(), 4 ether);
        assertEq(address(slot).balance, 4 ether);
    }

    function test_native_evictionRefundsOutgoingOccupant() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        uint256 before = alice.balance;
        _buyNative(slot, bob, 1 ether, 12 ether);

        // Alice gets her remaining deposit plus the sale price, pushed
        // inline because an EOA fits well inside the 30k cap.
        assertEq(slot.occupant(), bob);
        assertGt(alice.balance, before);
        assertEq(slot.withdrawableOf(alice), 0);
    }

    // ═══════════════════════════════════════════════════════════
    // ADVERSARIAL RECEIVERS
    // ═══════════════════════════════════════════════════════════

    function test_native_gasBurnerCannotBlockEviction() public {
        Slot slot = _createNativeSlot();
        GasBurner burner = new GasBurner();

        vm.deal(address(burner), 1 ether);
        burner.buyInto{value: 1 ether}(slot, 1 ether, 10 ether);
        assertEq(slot.occupant(), address(burner));

        // The eviction must succeed despite the burner's hostile receive().
        //
        // The explicit gas bound is load-bearing, NOT decoration. Forge's
        // default test gas limit is i64::MAX, and the 63/64 rule leaves the
        // outer frame 1/64 of whatever remains — which at that limit is still
        // enormous. Without a realistic bound the buy would survive even with
        // an uncapped push, and this test would pass for the wrong reason.
        // 2M gas models an ordinary transaction.
        uint256 owed = 1 ether + slot.price();
        vm.deal(alice, owed);
        vm.prank(alice);
        slot.buy{value: owed, gas: 2_000_000}(alice, 1 ether, 12 ether);

        assertEq(slot.occupant(), alice);
        assertGt(slot.withdrawableOf(address(burner)), 0, "refund must be credited");
    }

    function test_native_revertingReceiverIsCredited() public {
        Slot slot = _createNativeSlot();
        RevertingReceiver rejecter = new RevertingReceiver();

        vm.deal(address(rejecter), 1 ether);
        rejecter.buyInto{value: 1 ether}(slot, 1 ether, 10 ether);

        _buyNative(slot, alice, 1 ether, 12 ether);

        assertEq(slot.occupant(), alice);
        assertGt(
            slot.withdrawableOf(address(rejecter)),
            0,
            "a reverting recipient must degrade to a credit, not fail the buy"
        );
    }

    function test_native_gasHogIsCreditedThenClaims() public {
        Slot slot = _createNativeSlot();
        GasHog hog = new GasHog();

        vm.deal(address(hog), 1 ether);
        hog.buyInto{value: 1 ether}(slot, 1 ether, 10 ether);

        _buyNative(slot, alice, 1 ether, 12 ether);

        // Too gas-hungry for the 30k push, so it was credited...
        uint256 credited = slot.withdrawableOf(address(hog));
        assertGt(credited, 0, "hog must be credited, not paid inline");

        // ...and claim(), which is uncapped, delivers it.
        uint256 before = address(hog).balance;
        slot.claim(address(hog));

        assertEq(address(hog).balance, before + credited);
        assertEq(slot.withdrawableOf(address(hog)), 0);
    }

    function test_native_gasBurnerClaimReverts() public {
        Slot slot = _createNativeSlot();
        GasBurner burner = new GasBurner();

        vm.deal(address(burner), 1 ether);
        burner.buyInto{value: 1 ether}(slot, 1 ether, 10 ether);
        _buyNative(slot, alice, 1 ether, 12 ether);

        // A contract that burns ALL gas can never receive ETH by any mechanism.
        // claim() reverts rather than silently zeroing the credit.
        vm.expectRevert(TransferFailed.selector);
        slot.claim(address(burner));

        assertGt(slot.withdrawableOf(address(burner)), 0, "credit must survive");
    }

    // ═══════════════════════════════════════════════════════════
    // LIFECYCLE + INVARIANT
    // ═══════════════════════════════════════════════════════════

    /// @dev Every wei the slot holds is attributed to exactly one of three
    ///      places. This holds only because Slot has no `receive()`: nothing
    ///      can enter without being recorded. `withdrawableOf` is not
    ///      enumerable, so the known actors are summed explicitly.
    function _assertBalanceInvariant(Slot slot, address[] memory credited) internal view {
        uint256 credits;
        for (uint256 i = 0; i < credited.length; i++) {
            credits += slot.withdrawableOf(credited[i]);
        }
        assertEq(
            address(slot).balance,
            slot.deposit() + slot.collectedTax() + credits,
            "balance must equal deposit + collectedTax + credits"
        );
    }

    function _actors() internal view returns (address[] memory a) {
        a = new address[](4);
        a[0] = alice;
        a[1] = bob;
        a[2] = recipient;
        a[3] = liquidator;
    }

    function test_native_releaseRefundsAndFlushesTax() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.warp(block.timestamp + 15 days);

        uint256 recipientBefore = recipient.balance;
        uint256 aliceBefore = alice.balance;

        vm.prank(alice);
        slot.release();

        assertEq(slot.occupant(), address(0));
        assertTrue(slot.isVacant());
        assertGt(recipient.balance, recipientBefore, "tax must flush to recipient");
        assertGt(alice.balance, aliceBefore, "remaining deposit must refund");
        _assertBalanceInvariant(slot, _actors());
    }

    function test_native_liquidatePaysBounty() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        // Run the deposit dry. 1% per 30 days on a 10 ether price is
        // 0.1 ether per 30 days, so a 1 ether deposit lasts ~300 days.
        vm.warp(block.timestamp + 5000 days);
        assertTrue(slot.isInsolvent());

        uint256 bountyBefore = liquidator.balance;
        vm.prank(liquidator);
        slot.liquidate();

        assertEq(slot.occupant(), address(0));
        assertGt(liquidator.balance, bountyBefore, "bounty must be paid in ETH");
        _assertBalanceInvariant(slot, _actors());
    }

    function test_native_collectFlushesTax() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.warp(block.timestamp + 10 days);

        uint256 before = recipient.balance;
        slot.collect();

        assertGt(recipient.balance, before);
        assertEq(slot.collectedTax(), 0);
        _assertBalanceInvariant(slot, _actors());
    }

    function test_native_taxChargesOutgoingOccupant() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.warp(block.timestamp + 10 days);

        // Buying charges the OUTGOING occupant for their own tenure, so
        // alice's deposit funds the tax, not bob's.
        _buyNative(slot, bob, 1 ether, 12 ether);

        assertEq(slot.occupant(), bob);
        assertEq(slot.deposit(), 1 ether, "bob's deposit must be untouched");
        assertGt(slot.collectedTax(), 0, "alice's tenure must be charged");
        _assertBalanceInvariant(slot, _actors());
    }

    function test_native_selfAssessWorks() public {
        Slot slot = _createNativeSlot();
        _buyNative(slot, alice, 1 ether, 10 ether);

        vm.prank(alice);
        slot.selfAssess(20 ether);

        assertEq(slot.price(), 20 ether);
        _assertBalanceInvariant(slot, _actors());
    }

    // ═══════════════════════════════════════════════════════════
    // PRICE FLOOR ON A NATIVE SLOT
    // ═══════════════════════════════════════════════════════════

    function test_native_minimumPriceFloor() public {
        MinimumPricePolicyFactory policyFactory = new MinimumPricePolicyFactory();
        address policy = policyFactory.getOrDeploy(address(0), 5 ether);

        SlotInitParams memory init = _init();
        init.occupancyPolicy = policy;
        Slot slot = Slot(factory.createSlot(recipient, IERC20(address(0)), _config(), init));

        // Below the floor is rejected.
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumPricePolicy.PriceBelowFloor.selector, 5 ether)
        );
        slot.buy{value: 1 ether}(alice, 1 ether, 4 ether);

        // At or above the floor is accepted.
        _buyNative(slot, alice, 1 ether, 5 ether);
        assertEq(slot.price(), 5 ether);
    }

    function test_native_tokenBoundPolicyRejectsNativeSlot() public {
        MinimumPricePolicyFactory policyFactory = new MinimumPricePolicyFactory();
        address policy = policyFactory.getOrDeploy(address(token), 5 ether);

        SlotInitParams memory init = _init();
        init.occupancyPolicy = policy;
        Slot slot = Slot(factory.createSlot(recipient, IERC20(address(0)), _config(), init));

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(MinimumPricePolicy.WrongCurrency.selector);
        slot.buy{value: 1 ether}(alice, 1 ether, 10 ether);
    }
}
