// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {Slot} from "../src/v1/Slot.sol";
import {SlotFactory} from "../src/v1/SlotFactory.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/**
 * @title UpgradeSlotImplementation
 * @notice Ships a new `Slot` implementation to every slot on a chain, and the
 *         `SlotFactory` implementation alongside it when the two must move
 *         together.
 *
 * @dev Replaces a series of one-shot scripts named after the version they
 *      shipped. Those were completed migrations; git remembers them. This is
 *      the operation that actually recurs.
 *
 *      ── Why both, in one transaction ──────────────────────────────────────
 *      The factory constructs slots by calling `Slot.initialize`. When that
 *      signature changes, an old factory calling a new implementation (or the
 *      reverse) reverts, so slot creation is broken for as long as the two are
 *      out of step. `upgradeToAndCall` closes that: the factory upgrades
 *      itself and, in the same call, upgrades the beacon — so the pair is
 *      never observably mismatched.
 *
 *      Set `UPGRADE_FACTORY = false` when only the slot implementation
 *      changed; the beacon is then upgraded on its own and the factory keeps
 *      the implementation it already has. Redeploying identical factory code
 *      would only churn the address recorded in deployments.json.
 */
contract UpgradeSlotImplementation is BaseScript {
    /// @dev True only when the change touches `Slot.initialize`'s signature or
    ///      anything else the factory calls into. A `SlotInfo`-only change does
    ///      not: the factory never reads that struct.
    bool internal constant UPGRADE_FACTORY = false;

    /// @notice Base Sepolia. `forge script ... UpgradeSlotImplementation`
    function run() external broadcastOn(DeployementChain.BaseSepolia) {
        _upgrade(address(0));
    }

    /// @notice Base mainnet. `forge script ... --sig "runBase()"`
    ///
    /// @dev A separate entry point rather than a separate script. Mainnet used
    ///      to need one — `UpgradeBaseMainnet` existed because its beacon was
    ///      owned by the admin EOA while Sepolia's was owned by its factory, so
    ///      `factory.upgradeBeacon` reverted here. That script transferred
    ///      ownership to the factory as its last act, which is why the two
    ///      chains now take the identical path and that script is spent: its
    ///      `beacon.owner() == factory.admin()` pre-flight can never pass again.
    ///
    ///      What mainnet still deserves, and testnet does not, is the layout
    ///      witness below.
    function runBase() external broadcastOn(DeployementChain.Base) {
        // A live mainnet slot, used as the layout witness. Vacant, so its
        // expected values are founding terms rather than occupancy state.
        _upgrade(0xec38Ff9e462b34A7053951bD59deF8745C3Cff33);
    }

    /// @dev `witness`, when non-zero, is a live slot read through the CURRENT
    ///      code before the upgrade and again after — so the two runs compare
    ///      the old implementation's view of storage with the new one's.
    ///
    ///      This is the one check that cannot be recovered from. A beacon
    ///      upgrade reinterprets the storage of every proxy at once; if a slot
    ///      moved, every live slot misreads its own terms and there is no
    ///      second chance. `forge inspect Slot storage-layout` proves the
    ///      layout is unchanged in source, but only this proves it against the
    ///      storage that actually exists.
    function _upgrade(address witness) internal {
        SlotFactory factory = SlotFactory(_readDeployment("SlotFactoryV3"));
        UpgradeableBeacon beacon = UpgradeableBeacon(factory.beacon());

        console2.log("factory      ", address(factory));
        console2.log("beacon       ", address(beacon));
        console2.log("impl (before)", beacon.implementation());

        // Both chains' beacons are owned by their factory. Fail here with a
        // readable message rather than deep inside `upgradeBeacon`.
        require(
            beacon.owner() == address(factory),
            "beacon is not factory-owned: upgrade it directly and transfer ownership first"
        );

        if (witness != address(0)) {
            require(factory.isSlot(witness), "witness is not a slot of this factory");
            _assertLayout(witness);
        }

        Slot slotImpl = new Slot();
        console2.log("slot impl    ", address(slotImpl));

        if (UPGRADE_FACTORY) {
            // One transaction: the factory swaps its own implementation and
            // then, as the new code, points the beacon at the new slot
            // implementation — the pair is never observably mismatched.
            SlotFactory factoryImpl = new SlotFactory();
            console2.log("factory impl ", address(factoryImpl));
            factory.upgradeToAndCall(
                address(factoryImpl),
                abi.encodeCall(SlotFactory.upgradeBeacon, (address(slotImpl)))
            );
            _saveDeployment(address(factoryImpl), "SlotFactoryImplementation");
        } else {
            // The beacon is owned by the factory, so the upgrade goes through
            // it. Deployer is the factory owner.
            factory.upgradeBeacon(address(slotImpl));
        }

        require(
            beacon.implementation() == address(slotImpl),
            "beacon did not take the new implementation"
        );
        console2.log("impl (after) ", beacon.implementation());

        if (witness != address(0)) _assertLayout(witness);

        _saveDeployment(address(slotImpl), "SlotImplementation");
    }

    /// @dev Founding terms, which no upgrade may alter. `currency` is the one
    ///      that matters most to the native-ETH change: it shares slot 1 with
    ///      three bools, so a mistake in that packing would show up here as a
    ///      USDC address that no longer reads back.
    function _assertLayout(address witness) internal view {
        Slot s = Slot(witness);
        require(
            s.recipient() == 0xc0e5E0E823aDf148b4c39b96b20848d29CCAE188,
            "layout: recipient moved"
        );
        require(
            address(s.currency()) == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
            "layout: currency moved"
        );
        require(s.taxPercentage() == 100, "layout: taxPercentage moved");
        require(!s.mutablePolicy(), "layout: mutablePolicy moved");
        require(
            s.occupancyPolicy() == address(0),
            "layout: occupancyPolicy moved"
        );
    }
}
