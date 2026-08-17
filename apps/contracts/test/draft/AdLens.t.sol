// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AdLens} from "../../src/draft/AdLens.sol";
import {SlotRegistry} from "../../src/draft/SlotRegistry.sol";

contract MockModule {
    mapping(address => string) public tokenURI;

    function set(address slot, string calldata uri) external {
        tokenURI[slot] = uri;
    }
}

contract MockSlot {
    address public module;
    address public occupant = address(0xDEAD);
    uint256 public price = 3e6;
    uint256 public deposit = 9e6;
    uint256 public taxOwed = 1e5;
    uint256 public collectedTax = 2e5;
    uint256 public taxPercentage = 5000;
    address public currency = address(0xC0FFEE);
    uint256 public occupiedSince = 1_700_000_000;

    function isVacant() external pure returns (bool) {
        return false;
    }

    function setModule(address m) external {
        module = m;
    }
}

/// @dev A slot-shaped contract whose getters all revert, standing in for one
///      deployed on the other side of a protocol change.
contract HostileSlot {
    fallback() external {
        revert("nope");
    }
}

contract AdLensTest is Test {
    SlotRegistry registry;
    AdLens lens;
    MockSlot slot;
    MockModule module;

    address owner = address(0xA11CE);
    bytes32 KEY;

    function setUp() public {
        registry = new SlotRegistry(owner);
        lens = new AdLens(registry);
        slot = new MockSlot();
        module = new MockModule();
        slot.setModule(address(module));
        module.set(address(slot), "data:application/json;base64,eyJ0eXBlIjoidG9rZW4ifQ==");
        KEY = registry.PRIMARY();

        vm.prank(owner);
        registry.set(KEY, address(slot));
    }

    function test_OneCallReturnsSlotUriAndTerms() public view {
        AdLens.AdView memory v = lens.adByKey(KEY);

        assertEq(v.slot, address(slot));
        assertEq(v.module, address(module));
        assertEq(v.uri, "data:application/json;base64,eyJ0eXBlIjoidG9rZW4ifQ==");
        assertEq(v.occupant, address(0xDEAD));
        assertEq(v.price, 3e6);
        assertEq(v.taxOwed, 1e5);
        assertEq(v.currency, address(0xC0FFEE));
        assertFalse(v.vacant);
    }

    /**
     * The one that would have shipped a lie.
     *
     * A staticcall to an address with no code SUCCEEDS and returns nothing,
     * which decodes as zero. Without the `code.length` probe this would report
     * `slot` set, no occupant, price zero, vacant false — a plausible, entirely
     * fictional ad space — for any typo'd address a publisher passes.
     */
    function test_NonContractAddressReportsNothing() public view {
        AdLens.AdView memory v = lens.ad(address(0xB0B));
        assertEq(v.slot, address(0), "must not claim a slot exists");
        assertEq(v.price, 0);
    }

    function test_UnsetKeyReportsNothing() public view {
        AdLens.AdView memory v = lens.adByKey("never-set");
        assertEq(v.slot, address(0));
    }

    function test_SlotWithNoModuleStillReturnsTerms() public {
        MockSlot bare = new MockSlot();
        AdLens.AdView memory v = lens.ad(address(bare));

        assertEq(v.slot, address(bare));
        assertEq(v.module, address(0));
        assertEq(bytes(v.uri).length, 0);
        // An empty space still has a price, and that is what makes it buyable.
        assertEq(v.price, 3e6);
    }

    function test_RevertingSlotDoesNotRevertTheRead() public {
        HostileSlot hostile = new HostileSlot();
        AdLens.AdView memory v = lens.ad(address(hostile));

        // It is a contract, so it is reported as the slot asked for — but every
        // field is zero rather than the whole call failing.
        assertEq(v.slot, address(hostile));
        assertEq(v.module, address(0));
        assertEq(v.price, 0);
    }
}
