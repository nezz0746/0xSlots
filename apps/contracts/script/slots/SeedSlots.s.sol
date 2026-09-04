// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotsTestToken} from "./SlotsTestToken.sol";
import {SlotMath} from "../../src/SlotMath.sol";

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

    SlotFactory internal factory;

    /// @dev Takes only the factory now. The hook and the test token are
    ///      deployed here rather than passed in, because the caller used to
    ///      have to know three addresses that only this script cares about —
    ///      and getting one of them from a stale constant is how the local
    ///      chain and the app's pinned addresses drifted apart.
    function run(address factory_) external {
        factory = SlotFactory(factory_);
        vm.startBroadcast();
        address me = msg.sender;

        // CREATE2, so the addresses do not depend on this script's nonce.
        //
        // Plain `new` derives from (deployer, nonce), and the nonce here is
        // whatever `DeployProtocol` left it at — which differs between a fresh
        // chain, where it deploys everything, and a warm one, where CREATE2
        // lets it skip. So the token landed at one address under
        // `pnpm dev:local` and a different one on a chain that was already up,
        // the generated table matched only one of them, and the app offered a
        // token with no code behind it.
        //
        // The tenure hook is the protocol's, not the seed's. It used to be
        // deployed here because it was one hook PER WINDOW and the seed wanted
        // a seven-day one; now a single deployment serves every window, so it
        // belongs where the rest of the protocol is deployed and this script
        // reads the record like any other client would.
        address hook = _deployed("MinimumTenureHook");

        // Salted `new` makes the address a function of the bytecode alone.
        SlotsTestToken token = new SlotsTestToken{
            salt: "slots.seed.test-token"
        }();
        token.mint(me, 1_000_000e18);

        // Both are plain CREATE, so their addresses are a function of the seed's
        // nonce — they move whenever this script changes what it deploys or in
        // what order. The SDK pins the token address for the local chain, so
        // write it down rather than leaving the only copy in a broadcast log:
        // dev-chain.sh reads this back and fails if the constant has drifted.
        _record("SlotsTestToken", address(token));

        // 1. Native, no hook, occupied. The plainest slot there is.
        Slot a = _create(me, address(0), address(0), bytes32(0), 500, 7 days, true, true);
        uint256 depA = _minDeposit(0.05 ether, 500, 7 days);
        a.buy{value: depA}(me, 0.05 ether, depA, 0);

        // 2. ERC-20, no hook, occupied.
        Slot b = _create(me, address(token), address(0), bytes32(0), 250, 3 days, true, true);
        uint256 depB = _minDeposit(1_000e18, 250, 3 days);
        IERC20(address(token)).approve(address(b), depB);
        b.buy(me, 1_000e18, depB, 0);

        // 3. Native, tenure hook, occupied — inside its protection window, so
        //    the UI has a slot that renders as "not available yet".
        Slot c = _create(me, address(0), hook, bytes32(uint256(7 days)), 500, 7 days, true, true);
        uint256 depC = _minDeposit(0.1 ether, 500, 7 days);
        c.buy{value: depC}(me, 0.1 ether, depC, 0);

        // 4. Native, no hook, VACANT. The empty state.
        Slot d = _create(me, address(0), address(0), bytes32(0), 1_000, 1 days, true, true);

        // 5. Immutable terms — neither tax nor hook may ever be proposed.
        Slot e = _create(me, address(0), address(0), bytes32(0), 300, 1 days, false, false);
        uint256 depE = _minDeposit(0.02 ether, 300, 1 days);
        e.buy{value: depE}(me, 0.02 ether, depE, 0);

        // 6. A pending term change, parked until the next occupancy transition.
        Slot f = _create(me, address(0), address(0), bytes32(0), 500, 1 days, true, true);
        uint256 depF = _minDeposit(0.02 ether, 500, 1 days);
        f.buy{value: depF}(me, 0.02 ether, depF, 0);
        f.proposeTerms(750, address(0), bytes32(0), true, false);

        // 7. Funded to the exact minimum. `minDepositSeconds` is 1 hour, so an
        //    hour of warp — or an hour of anvil — makes this liquidatable by
        //    anyone. This is the slot the liquidation UI is built against.
        Slot g = _create(me, address(0), address(0), bytes32(0), 2_000, 1 hours, true, true);
        uint256 depG = _minDeposit(0.01 ether, 2_000, 1 hours);
        g.buy{value: depG}(me, 0.01 ether, depG, 0);

        // 8. ERC-20, tenure hook, THIRTY-day window. The same hook CONTRACT as
        //    slot 3 — the window is the slot's `hookData`, not a second
        //    deployment — so the explorer has two slots sharing one hook and
        //    enforcing different terms, which is the whole point of hookData.
        Slot h = _create(
            me, address(token), hook, bytes32(uint256(30 days)), 400, 30 days, true, true
        );
        uint256 depH = _minDeposit(500e18, 400, 30 days) + 1e18;
        IERC20(address(token)).approve(address(h), depH);
        h.buy(me, 500e18, depH, 0);

        // 9. Tenure hook on a VACANT slot: a rule with nobody to protect yet.
        //    The hook column has something to show on an empty slot, and the
        //    buy form has to price a window before anyone is inside one.
        Slot i = _create(
            me, address(0), hook, bytes32(uint256(1 days)), 600, 1 days, true, true
        );

        vm.stopBroadcast();

        console2.log("");
        console2.log("1 native/plain/occupied  ", address(a));
        console2.log("2 erc20/plain/occupied   ", address(b));
        console2.log("3 native/tenure/occupied ", address(c));
        console2.log("4 native/plain/VACANT    ", address(d));
        console2.log("5 native/immutable terms ", address(e));
        console2.log("6 native/pending terms   ", address(f));
        console2.log("7 native/liquidatable+1h ", address(g));
        console2.log("8 erc20/tenure-30d       ", address(h));
        console2.log("9 native/tenure/VACANT   ", address(i));
    }

    function _create(
        address recipient,
        address currency,
        address hook,
        bytes32 hookData,
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
                            hookData: hookData,
                            taxBps: tax,
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
        // The slot's own formula, not a copy of it. This hand-wrote
        // `ceilDiv(price * tax * window, MONTH * BASIS_POINTS)` against its own
        // local constants — the plain product being exactly the overflow
        // `SlotMath` exists to avoid, and the constants exactly what
        // `SlotConstants` exists to stop anyone hardcoding. A seed that funds
        // slots by a different formula than the slot charges by is a seed that
        // drifts, silently, into slots nobody can buy.
        return SlotMath.depositFor(price, tax, window);
    }

    /// @dev The address `DeployProtocol` wrote down. Reverts loudly when the
    ///      protocol has not been deployed to this chain, which is the only
    ///      honest answer — seeding against a half-built chain produces slots
    ///      whose hook has no code.
    function _deployed(string memory name) internal view returns (address) {
        string memory raw = vm.readFile(
            string.concat(
                "./deployments/",
                vm.toString(block.chainid),
                "/",
                name,
                ".json"
            )
        );
        return vm.parseJsonAddress(raw, ".address");
    }

    /// @dev The shape `DeployProtocol` writes, so every consumer reads one
    ///      format. `version` is not decoration: it is the discriminator that
    ///      tells a record written by this protocol from one the retired
    ///      protocol left under the same filename, and `sync-deployments`
    ///      ignores any record without it. No `startBlock` — nothing indexes
    ///      these two.
    function _record(string memory name, address addr) internal {
        string memory obj = name;
        vm.serializeUint(obj, "version", 1);
        string memory json = vm.serializeAddress(obj, "address", addr);
        vm.writeFile(
            string.concat(
                "./deployments/",
                vm.toString(block.chainid),
                "/",
                name,
                ".json"
            ),
            json
        );
    }
}
