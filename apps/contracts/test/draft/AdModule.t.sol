// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {AdModule} from "../../src/draft/AdModule.sol";
import {MetadataModule} from "../../src/modules/MetadataModule.sol";

/// @dev A slot whose occupant is whoever the test says, so `updateMetadata`'s
///      `onlyOccupant` check can be satisfied without a real purchase.
contract MockSlot {
    address public module;
    address public occupant;
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

    function setOccupant(address o) external {
        occupant = o;
    }
}

/// @dev Slot-shaped, but every call reverts — a slot from the other side of a
///      protocol change.
contract HostileSlot {
    fallback() external {
        revert("nope");
    }
}

contract AdModuleTest is Test {
    AdModule mod;
    MockSlot slot;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);
    bytes32 KEY;
    uint256 DELAY;

    function setUp() public {
        MetadataModule impl = new AdModule();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(MetadataModule.initialize, (owner)));
        mod = AdModule(address(proxy));

        slot = new MockSlot();
        slot.setModule(address(mod));
        slot.setOccupant(address(this));

        // Hoisted: these are external calls, so used as arguments they become
        // the "next call" that `vm.prank` and `vm.expectRevert` apply to.
        KEY = mod.PRIMARY();
        DELAY = mod.CHANGE_DELAY();

        vm.prank(owner);
        mod.setSlot(KEY, address(slot));
    }

    // ── The upgrade itself ───────────────────────────────────────────────

    /**
     * The only test that can fail catastrophically.
     *
     * This is an upgrade behind live proxies holding every slot's creative in
     * `tokenURI` at storage slot 0. If appending the registry mappings had
     * shifted that — by declaring them in a rewritten copy rather than by
     * inheriting — every ad in the protocol would decode as garbage, and it
     * would look like an IPFS problem rather than a storage one.
     *
     * Inheritance makes the ordering the compiler's job rather than review's.
     * This proves the compiler did it.
     */
    function test_UpgradePreservesEveryStoredCreative() public {
        // A proxy running the CURRENT module, with a creative in it.
        MetadataModule v1 = new MetadataModule();
        ERC1967Proxy proxy = new ERC1967Proxy(address(v1), abi.encodeCall(MetadataModule.initialize, (owner)));
        MetadataModule live = MetadataModule(address(proxy));

        MockSlot s = new MockSlot();
        s.setModule(address(live));
        s.setOccupant(address(this));
        live.updateMetadata(address(s), "data:application/json;base64,BEFORE");

        assertEq(live.tokenURI(address(s)), "data:application/json;base64,BEFORE");

        // Upgrade in place.
        AdModule v2 = new AdModule();
        vm.prank(owner);
        live.upgradeToAndCall(address(v2), "");

        AdModule upgraded = AdModule(address(proxy));
        assertEq(
            upgraded.tokenURI(address(s)),
            "data:application/json;base64,BEFORE",
            "the creative must survive the upgrade"
        );

        // And the new storage is genuinely new — not sharing a slot with it.
        vm.prank(owner);
        upgraded.setSlot("other", address(s));
        assertEq(upgraded.slotOf("other"), address(s));
        assertEq(
            upgraded.tokenURI(address(s)),
            "data:application/json;base64,BEFORE",
            "writing the registry must not disturb the creative"
        );
    }

    // ── Registry ─────────────────────────────────────────────────────────

    function test_FirstSetIsImmediate() public view {
        assertEq(mod.primary(), address(slot));
    }

    function test_OnlyOwnerCanSet() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, stranger));
        mod.setSlot(KEY, address(slot));
    }

    function test_RejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(AdModule.ZeroSlot.selector);
        mod.setSlot("fresh", address(0));
    }

    /**
     * The property the design rests on.
     *
     * If an existing key could be repointed in one transaction, this would give
     * a publisher nothing they do not already have by pasting an address —
     * worse, since they would have handed over the ability to change it.
     */
    function test_ChangingAnExistingKeyIsDelayed() public {
        MockSlot next = new MockSlot();

        vm.prank(owner);
        mod.setSlot(KEY, address(next));

        assertEq(mod.primary(), address(slot), "must not be live yet");
        (address pending, uint64 readyAt) = mod.pendingOf(KEY);
        assertEq(pending, address(next));
        assertEq(readyAt, uint64(block.timestamp + DELAY));

        skip(DELAY - 1);
        vm.expectRevert(abi.encodeWithSelector(AdModule.TooEarly.selector, uint64(block.timestamp + 1)));
        mod.commitSlot(KEY);

        skip(1);
        // Anyone may commit; the delay is the protection, not a second key.
        vm.prank(stranger);
        mod.commitSlot(KEY);
        assertEq(mod.primary(), address(next));
    }

    function test_CancelStopsIt() public {
        MockSlot next = new MockSlot();
        vm.startPrank(owner);
        mod.setSlot(KEY, address(next));
        mod.cancelSlot(KEY);
        vm.stopPrank();

        skip(DELAY * 10);
        vm.expectRevert(AdModule.NothingPending.selector);
        mod.commitSlot(KEY);
        assertEq(mod.primary(), address(slot));
    }

    // ── Lens ─────────────────────────────────────────────────────────────

    function test_OneCallReturnsSlotCreativeAndTerms() public {
        mod.updateMetadata(address(slot), "data:application/json;base64,eyJ0eXBlIjoidG9rZW4ifQ==");

        AdModule.AdView memory v = mod.adByKey(KEY);

        assertEq(v.slot, address(slot));
        assertEq(v.module, address(mod));
        assertEq(v.uri, "data:application/json;base64,eyJ0eXBlIjoidG9rZW4ifQ==");
        assertEq(v.occupant, address(this));
        assertEq(v.price, 3e6);
        assertEq(v.taxOwed, 1e5);
        assertEq(v.currency, address(0xC0FFEE));
        assertFalse(v.vacant);
    }

    /**
     * A staticcall to an address with no code SUCCEEDS and returns nothing,
     * which decodes as zero. Without the `code.length` probe this reports
     * `slot` set, no occupant, price zero, not vacant — a plausible and
     * entirely fictional ad space — for any address a publisher mistypes.
     */
    function test_NonContractReportsNothing() public view {
        AdModule.AdView memory v = mod.ad(address(0xB0B));
        assertEq(v.slot, address(0), "must not claim a slot exists");
    }

    function test_UnsetKeyReportsNothing() public view {
        AdModule.AdView memory v = mod.adByKey("never-set");
        assertEq(v.slot, address(0));
    }

    function test_RevertingSlotDoesNotRevertTheRead() public {
        HostileSlot hostile = new HostileSlot();
        AdModule.AdView memory v = mod.ad(address(hostile));

        assertEq(v.slot, address(hostile));
        assertEq(v.module, address(0));
        assertEq(v.price, 0);
    }

    function test_ReadsAnotherModulesUriThroughTheCall() public {
        // A slot on a DIFFERENT metadata module still resolves — the own-storage
        // shortcut must not become "only ads we host are visible".
        MetadataModule other = new AdModule();
        ERC1967Proxy p = new ERC1967Proxy(address(other), abi.encodeCall(MetadataModule.initialize, (owner)));
        MockSlot s = new MockSlot();
        s.setModule(address(p));
        s.setOccupant(address(this));
        MetadataModule(address(p)).updateMetadata(address(s), "ipfs://QmElsewhere");

        AdModule.AdView memory v = mod.ad(address(s));
        assertEq(v.module, address(p));
        assertEq(v.uri, "ipfs://QmElsewhere");
    }
}
