// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../src/v1/Slot.sol";

/**
 * @notice Post-upgrade check against LIVE Base Sepolia state and bytecode.
 *
 * @dev The unit tests forge `epochSeconds` with `vm.store`. This one uses a
 *      slot that really carries a non-zero epoch from before the v4 upgrade,
 *      running the deployed implementation, to confirm the beacon swap actually
 *      changed behaviour for slots already in the wild.
 *
 *      Skipped automatically when no RPC is configured, so `forge test` stays
 *      offline by default.
 */
contract ForkV4NoEpochsTest is Test {
    // Occupied, epochSeconds == 3600, drained of its pending transfer.
    address constant LEGACY_EPOCH_SLOT =
        0x147De881d0A564097f0b0158488A553730607Eca;

    address buyer = makeAddr("forkBuyer");

    function test_Fork_LegacyEpochSlot_BuyAppliesImmediately() public {
        try vm.createSelectFork("https://sepolia.base.org") {} catch {
            vm.skip(true);
            return;
        }

        Slot s = Slot(LEGACY_EPOCH_SLOT);

        assertEq(s.epochSeconds(), 3600, "fixture: slot must still carry an epoch");
        address before = s.occupant();
        assertTrue(before != address(0), "fixture: slot must be occupied");
        assertTrue(before != buyer, "fixture: buyer must not be the occupant");

        IERC20 currency = IERC20(address(s.currency()));
        uint256 price = s.price();
        uint256 need = price + 100 ether;
        deal(address(currency), buyer, need);

        vm.startPrank(buyer);
        currency.approve(address(s), type(uint256).max);
        s.buy(buyer, 100 ether, price + 1);
        vm.stopPrank();

        // The whole point: no boundary wait, no pending transfer.
        assertEq(s.occupant(), buyer, "buy must apply in the same transaction");
        (, uint96 effectiveAt, , , ) = s.pendingTransfer();
        assertEq(uint256(effectiveAt), 0, "nothing may be scheduled");
    }
}
