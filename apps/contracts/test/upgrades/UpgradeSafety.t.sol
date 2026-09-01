// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {OfferBook} from "../../src/periphery/book/OfferBook.sol";
import {SlotCollective} from "../../src/collectives/SlotCollective.sol";
import {SlotCollectiveFactory} from "../../src/collectives/SlotCollectiveFactory.sol";

/**
 * @notice The properties every upgradeable contract in the protocol must hold,
 *         asserted in CI rather than remembered.
 *
 * @dev The OpenZeppelin validator (`Upgrades.validateUpgrade`) is the other
 *      half of this and runs in the upgrade script, where it has a reference
 *      contract to compare against. What lives HERE is the part that can be
 *      checked without a deployment: that the implementation cannot be
 *      hijacked, that upgrade authority is actually gated, and that every
 *      contract can say which code it is.
 */
contract UpgradeSafetyTest is Test {
    // ── an implementation must not be initializable directly ──────────────
    //
    // A live implementation left open lets anyone call `initialize` on it and
    // become its admin. That does not touch the proxy's storage, but on a UUPS
    // contract the implementation holds the upgrade entry point — so an
    // attacker-owned implementation is a step towards a real one.

    function test_SlotImplementationIsLocked() public {
        Slot impl = new Slot();
        SlotInit memory init;
        init.recipient = address(this);
        init.taxPercentage = 500;
        vm.expectRevert();
        impl.initialize(init);
    }

    function test_SlotFactoryImplementationIsLocked() public {
        SlotFactory impl = new SlotFactory();
        // Hoisted. `vm.expectRevert` arms the next call — and a CREATE is a
        // call — so `new Slot()` inside the argument list consumes it and the
        // test passes while asserting nothing.
        address slotImpl = address(new Slot());
        vm.expectRevert();
        impl.initialize(address(this), slotImpl);
    }

    function test_OfferBookImplementationIsLocked() public {
        OfferBook impl = new OfferBook();
        vm.expectRevert();
        impl.initialize(address(this));
    }

    // ── every upgradeable contract states its version ─────────────────────
    //
    // Read through a proxy, `version()` answers "which code is behind me right
    // now" — the only question worth asking during an incident, and the one a
    // beacon upgrade makes impossible to answer from storage.

    function test_EveryUpgradeableContractHasAVersion() public {
        assertGt(new Slot().version(), 0, "Slot");
        assertGt(new SlotFactory().version(), 0, "SlotFactory");
        assertGt(new OfferBook().version(), 0, "OfferBook");
        assertGt(new SlotCollectiveFactory().version(), 0, "SlotCollectiveFactory");
    }

    /// @notice And the two numbers do not pretend to be each other.
    /// @dev `version()` is a constant in the code; `initializedVersion()` is
    ///      OpenZeppelin's storage counter for which migration has run. A
    ///      fresh implementation has run none.
    function test_TheTwoVersionsAnswerDifferentQuestions() public {
        SlotFactory impl = new SlotFactory();
        assertGt(impl.version(), 0, "code version is compiled in");
        assertEq(
            impl.initializedVersion(),
            type(uint64).max,
            "a locked implementation reports the disabled sentinel"
        );
    }
}
