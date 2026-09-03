// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SellOrder} from "../../src/SlotOrders.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {NotAdmin, ZeroAdmin} from "../../src/periphery/book/OfferBookErrors.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev A distinguishable implementation, so an upgrade is observable.
contract OfferBookV2 is OfferBook {
    function version() public pure override returns (uint64) {
        return 2;
    }
}

/**
 * @notice The board is upgradeable; settlement is not. These pin both halves.
 */
contract OfferBookUpgradeTest is Test {
    SlotFactory factory;
    OfferBook book;
    Tok token;
    Slot slot;

    address admin = address(0xA11CE);
    address stranger = address(0xBAD);
    uint256 bidderKey = 0xB1D;
    address bidder = vm.addr(0xB1D);
    address occ = address(0x0CC);

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (admin, address(new Slot())))
        )));
        token = new Tok();
        book = OfferBook(address(new ERC1967Proxy(
            address(new OfferBook()),
            abi.encodeCall(OfferBook.initialize, (admin))
        )));
        slot = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(token)),
            manager: address(this),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: 500,
            minDepositSeconds: 1 days,
            mutableTax: true,
            mutableHook: true
        }))));
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? occ : bidder;
            token.mint(who, 1e24);
            vm.prank(who);
            token.approve(address(slot), type(uint256).max);
        }
        uint256 dep = slot.minDepositForBuy(100e18);
        vm.prank(occ);
        slot.buy(occ, 100e18, dep, 0);
    }

    function test_TheAdminCanUpgradeTheBoard() public {
        // Hoisted: `vm.prank` is consumed by the next CALL **or CREATE**, so
        // `new OfferBookV2()` inside the argument list eats it and the upgrade
        // runs as the test contract.
        address v2 = address(new OfferBookV2());
        vm.prank(admin);
        book.upgradeToAndCall(v2, "");
        assertEq(OfferBookV2(address(book)).version(), 2);
    }

    function test_AStrangerCannotUpgradeTheBoard() public {
        address v2 = address(new OfferBookV2());
        vm.prank(stranger);
        vm.expectRevert(NotAdmin.selector);
        book.upgradeToAndCall(v2, "");
    }

    function test_UpgradeRightsFollowTheHandover() public {
        address next = address(0xBEEF);
        vm.prank(admin);
        book.transferAdmin(next);

        address v2 = address(new OfferBookV2());
        vm.prank(admin);
        vm.expectRevert(NotAdmin.selector);
        book.upgradeToAndCall(v2, "");

        vm.prank(next);
        book.upgradeToAndCall(v2, "");
        assertEq(OfferBookV2(address(book)).version(), 2);
    }

    function test_TheImplementationCannotBeInitialized() public {
        OfferBook impl = new OfferBook();
        vm.expectRevert();
        impl.initialize(admin);
    }

    function test_InitializeRefusesAZeroAdmin() public {
        address impl = address(new OfferBook());
        vm.expectRevert();
        new ERC1967Proxy(impl, abi.encodeCall(OfferBook.initialize, (address(0))));
    }

    /// @notice Standing bids survive an upgrade — the whole reason the board
    ///         is upgradeable rather than replaceable.
    function test_StandingBidsSurviveAnUpgrade() public {
        uint256 dep = slot.minDepositForBuy(120e18);
        uint64 deadline = uint64(block.timestamp + 30 days);
        SellOrder memory o = SellOrder({
            slot: address(slot), buyer: bidder, price: 120e18,
            deposit: dep, nonce: 0, deadline: deadline
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bidderKey, slot.sellOrderHash(o));
        vm.prank(bidder);
        book.offer(address(slot), 120e18, dep, deadline, 0, abi.encodePacked(r, s, v));

        assertEq(book.liveCount(address(slot)), 1);

        address v2 = address(new OfferBookV2());
        vm.prank(admin);
        book.upgradeToAndCall(v2, "");

        assertEq(book.liveCount(address(slot)), 1, "the bid is still there");

        // And it still settles — against the SLOT, which was never upgraded.
        (, , SellOrder memory best, bytes memory sig) = book.bestOrder(address(slot));
        vm.prank(occ);
        slot.sell(best, sig);
        assertEq(slot.occupant(), bidder, "settlement is unaffected");
    }
}
