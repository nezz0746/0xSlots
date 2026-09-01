// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Slot, SlotInit} from "../../src/slots/Slot.sol";
import {SlotFactory} from "../../src/slots/SlotFactory.sol";
import {SlotsTestToken} from "./DeploySlots.s.sol";

/**
 * @title SeedSlots
 * @notice Populates a local chain so the indexer and explorer have something
 *         to render.
 *
 *   forge script script/slots/SeedSlots.s.sol:SeedSlots \
 *     --rpc-url http://127.0.0.1:8545 --broadcast \
 *     --private-key 0xac09... \
 *     --sig "run(address,address,address)" $FACTORY $HOOK $TOKEN
 *
 * @dev Aims at the axes the UI branches on rather than at volume: native vs
 *      ERC-20, hook vs no hook, occupied vs vacant, mutable vs immutable terms,
 *      a pending term change waiting on the next transition, and one slot
 *      funded to the exact minimum so a short warp makes it liquidatable —
 *      which is the state that is effectively untestable against a testnet.
 */
contract SeedSlots is Script {
    uint256 internal constant MONTH = 30 days;
    uint256 internal constant BASIS_POINTS = 10_000;

    SlotFactory internal factory;

    function run(address factory_, address hook, address token) external {
        factory = SlotFactory(factory_);
        vm.startBroadcast();
        address me = msg.sender;

        SlotsTestToken(token).mint(me, 1_000_000e18);

        // 1. Native, no hook, occupied. The plainest slot there is.
        Slot a = _create(me, address(0), address(0), 500, 7 days, true, true);
        uint256 depA = _minDeposit(0.05 ether, 500, 7 days);
        a.buy{value: depA}(me, depA, 0.05 ether, 0);

        // 2. ERC-20, no hook, occupied.
        Slot b = _create(me, token, address(0), 250, 3 days, true, true);
        uint256 depB = _minDeposit(1_000e18, 250, 3 days);
        IERC20(token).approve(address(b), depB);
        b.buy(me, depB, 1_000e18, 0);

        // 3. Native, tenure hook, occupied — inside its protection window, so
        //    the UI has a slot that renders as "not available yet".
        Slot c = _create(me, address(0), hook, 500, 7 days, true, true);
        uint256 depC = _minDeposit(0.1 ether, 500, 7 days);
        c.buy{value: depC}(me, depC, 0.1 ether, 0);

        // 4. Native, no hook, VACANT. The empty state.
        Slot d = _create(me, address(0), address(0), 1_000, 1 days, true, true);

        // 5. Immutable terms — neither tax nor hook may ever be proposed.
        Slot e = _create(me, address(0), address(0), 300, 1 days, false, false);
        uint256 depE = _minDeposit(0.02 ether, 300, 1 days);
        e.buy{value: depE}(me, depE, 0.02 ether, 0);

        // 6. A pending term change, parked until the next occupancy transition.
        Slot f = _create(me, address(0), address(0), 500, 1 days, true, true);
        uint256 depF = _minDeposit(0.02 ether, 500, 1 days);
        f.buy{value: depF}(me, depF, 0.02 ether, 0);
        f.proposeTerms(750, address(0), true, false);

        // 7. Funded to the exact minimum. `minDepositSeconds` is 1 hour, so an
        //    hour of warp — or an hour of anvil — makes this liquidatable by
        //    anyone. This is the slot the liquidation UI is built against.
        Slot g = _create(me, address(0), address(0), 2_000, 1 hours, true, true);
        uint256 depG = _minDeposit(0.01 ether, 2_000, 1 hours);
        g.buy{value: depG}(me, depG, 0.01 ether, 0);

        vm.stopBroadcast();

        console2.log("");
        console2.log("1 native/plain/occupied  ", address(a));
        console2.log("2 erc20/plain/occupied   ", address(b));
        console2.log("3 native/tenure/occupied ", address(c));
        console2.log("4 native/plain/VACANT    ", address(d));
        console2.log("5 native/immutable terms ", address(e));
        console2.log("6 native/pending terms   ", address(f));
        console2.log("7 native/liquidatable+1h ", address(g));
    }

    function _create(
        address recipient,
        address currency,
        address hook,
        uint256 tax,
        uint256 minDepositSeconds,
        bool mutableTax,
        bool mutableHook
    ) internal returns (Slot) {
        // A manager is required exactly when something is mutable and
        // forbidden otherwise — `initialize` enforces both halves.
        return
            Slot(
                payable(
                    factory.createSlot(
                        SlotInit({
                            recipient: recipient,
                            currency: IERC20(currency),
                            manager: (mutableTax || mutableHook)
                                ? recipient
                                : address(0),
                            hook: hook,
                            taxPercentage: tax,
                            minDepositSeconds: minDepositSeconds,
                            mutableTax: mutableTax,
                            mutableHook: mutableHook
                        })
                    )
                )
            );
    }

    function _minDeposit(uint256 price, uint256 tax, uint256 window)
        internal
        pure
        returns (uint256)
    {
        return Math.ceilDiv(price * tax * window, MONTH * BASIS_POINTS);
    }
}
