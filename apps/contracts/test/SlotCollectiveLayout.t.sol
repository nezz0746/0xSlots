// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";

import {SlotCollective} from "../src/SlotCollective.sol";
import {SlotCollectiveFactory} from "../src/SlotCollectiveFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

/// @notice Pins `SlotCollective`'s storage layout, slot by slot.
///
/// @dev `SlotCollective` is deployed behind a beacon with live proxies on Base
///      and Base Sepolia. A beacon upgrade replaces the CODE of every one of
///      them at once while their STORAGE stays exactly where it was — so any
///      change that moves a variable does not fail loudly, it silently makes
///      the new code read someone else's data. `splitHash` landing on
///      `updateBlockNumber` would make every distribution revert; `_roles`
///      shifting by one would hand every role to nobody, or to everybody.
///
///      The refactor that split the governance half into `SlotGovernance` is
///      exactly the kind of change that can do this: Solidity allocates storage
///      in C3-linearization order, most-base-first, so editing the inheritance
///      list moves slots.
///
///      What is and is not dangerous here was checked by experiment rather than
///      reasoned about, because the intuition points the wrong way:
///
///        SAFE — appending state to `SlotGovernance`. It is the LAST base in
///        the storage order (`SlotCollective is PushSplit, SlotGovernance`
///        linearizes to PushSplit's chain, then AccessControl, then this), so a
///        new variable lands above `_roles` at slot 6 and shifts nothing.
///        Confirmed by adding a `uint256` and re-running `forge inspect`.
///
///        FATAL — reordering that list. Writing
///        `SlotCollective is SlotGovernance, PushSplit` puts `_roles` at slot 0
///        and `owner` somewhere else, silently reinterpreting every live
///        collective's storage. That is what the assertions below catch: each
///        one names the slot a variable must be at, so a reorder fails four
///        tests at once instead of shipping.
contract SlotCollectiveLayoutTest is Test {
    SlotCollective internal collective;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        SplitsWarehouse warehouse = new SplitsWarehouse("Ether", "ETH");
        SlotCollective impl = new SlotCollective(address(warehouse));

        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory allocations = new uint256[](2);
        allocations[0] = 60;
        allocations[1] = 40;

        SplitV2Lib.Split memory split = SplitV2Lib.Split({
            recipients: recipients,
            allocations: allocations,
            totalAllocation: 100,
            distributionIncentive: 0
        });

        SlotCollective.InitialRoles memory roles = SlotCollective.InitialRoles({
            admin: admin,
            taxManagers: new address[](0),
            policyManagers: new address[](0),
            utilityManagers: new address[](0),
            splitManagers: new address[](0)
        });

        collective = SlotCollective(
            payable(
                address(
                    new ERC1967Proxy(
                        address(impl),
                        abi.encodeCall(
                            SlotCollective.initializeManager, (split, roles)
                        )
                    )
                )
            )
        );
    }

    /// @dev Slot 0 packs `owner` (20 bytes) and `paused` (1 byte) together.
    function test_Layout_Slot0_PacksOwnerAndPaused() public view {
        bytes32 raw = vm.load(address(collective), bytes32(uint256(0)));

        address ownerFromStorage = address(uint160(uint256(raw)));
        assertEq(ownerFromStorage, address(collective), "owner must be at slot 0 offset 0");
        assertEq(ownerFromStorage, collective.owner(), "getter and slot disagree");

        // `paused` sits immediately above the address, at byte offset 20.
        bool pausedFromStorage = uint256(raw) >> 160 & 1 == 1;
        assertEq(pausedFromStorage, collective.paused(), "paused must be at slot 0 offset 20");
    }

    /// @dev Slots 1 and 2 are ERC-5267 name/version fallbacks, unused here and
    ///      therefore empty — which is itself worth pinning, because something
    ///      appearing in them means a base grew a state variable.
    function test_Layout_Slots1And2_AreTheUnusedEip712Fallbacks() public view {
        assertEq(
            vm.load(address(collective), bytes32(uint256(1))),
            bytes32(0),
            "slot 1 (_nameFallback) should be empty"
        );
        assertEq(
            vm.load(address(collective), bytes32(uint256(2))),
            bytes32(0),
            "slot 2 (_versionFallback) should be empty"
        );
    }

    function test_Layout_Slot3_IsSplitHash() public view {
        assertEq(
            vm.load(address(collective), bytes32(uint256(3))),
            collective.splitHash(),
            "splitHash must be at slot 3"
        );
        assertTrue(collective.splitHash() != bytes32(0), "fixture: split must be set");
    }

    function test_Layout_Slot4_IsUpdateBlockNumber() public view {
        assertEq(
            uint256(vm.load(address(collective), bytes32(uint256(4)))),
            collective.updateBlockNumber(),
            "updateBlockNumber must be at slot 4"
        );
    }

    /// @dev The one that matters most. `_roles` is a mapping, so its base slot
    ///      is not readable directly — but a mapping entry's location is
    ///      `keccak256(key . slot)`, so reading the admin's `RoleData` at the
    ///      address derived from slot 5 proves the mapping is rooted there.
    ///      `RoleData` is `{mapping members; bytes32 adminRole}`, and its own
    ///      `members` mapping is at offset 0 of that struct.
    function test_Layout_Slot5_IsTheRolesMapping() public view {
        bytes32 role = collective.DEFAULT_ADMIN_ROLE();

        // _roles[role] — struct base
        bytes32 roleDataSlot = keccak256(abi.encode(role, uint256(5)));
        // _roles[role].members[admin] — offset 0 within the struct
        bytes32 memberSlot = keccak256(abi.encode(admin, roleDataSlot));

        assertEq(
            uint256(vm.load(address(collective), memberSlot)),
            1,
            "admin's role bit must be reachable from slot 5"
        );
        assertTrue(
            collective.hasRole(role, admin),
            "fixture: admin must hold DEFAULT_ADMIN_ROLE"
        );

        // And the negative: a non-holder must read as false through the same
        // derivation, so the assertion above cannot pass on a stray non-zero.
        bytes32 strangerSlot = keccak256(abi.encode(alice, roleDataSlot));
        assertEq(
            uint256(vm.load(address(collective), strangerSlot)),
            0,
            "a non-admin must not have the bit set"
        );
    }

    /// @dev A tripwire, and a weak one by nature — worth being explicit about.
    ///      A newly APPENDED variable reads as zero until something writes it,
    ///      so this does not detect a declaration; it detects live state having
    ///      appeared above `_roles`. That is still the thing worth knowing,
    ///      because appending is safe and writing to a slot the old code also
    ///      used is not. The reorder case — the fatal one — is caught by the
    ///      named-slot assertions above, not by this.
    function test_Layout_Slot6AndAbove_CarryNoLiveState() public view {
        for (uint256 i = 6; i < 12; ++i) {
            assertEq(
                vm.load(address(collective), bytes32(i)),
                bytes32(0),
                "no state expected above the roles mapping"
            );
        }
    }
}
