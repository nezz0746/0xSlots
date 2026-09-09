// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotCollective} from "../../src/collectives/SlotCollective.sol";
import {SlotCollectiveFactory} from "../../src/collectives/SlotCollectiveFactory.sol";
import {
    SlotBoundNFTFactory,
    CollectionInit
} from "../../src/hooks/nft/SlotBoundNFTFactory.sol";

contract Tok is ERC20 {
    constructor() ERC20("T", "T") {}
}

/**
 * @notice A factory's children must not share an address across chains.
 *
 * @dev ── The bug this pins ───────────────────────────────────────────────
 *
 *      All three factories deployed their children with plain `new`, which is
 *      CREATE, whose address is `keccak(rlp(deployer, nonce))` and nothing
 *      else — constructor arguments do not enter it at all.
 *
 *      Every one of these factories is deployed at the SAME address on every
 *      chain. Each therefore ran through the same nonce sequence on each of
 *      them, so child #N on base and child #N on sepolia were not merely
 *      likely to collide: they were the same address, by arithmetic.
 *
 *      That took the indexer down. Its `slot` table was keyed on the address
 *      alone, so the second chain's row was a duplicate key, the insert threw
 *      unhandled, and the container restart-looped. The indexer is now keyed
 *      on (address, chainId), and these tests are the other half — the chains
 *      stop producing the same address in the first place.
 *
 *      ── How each test isolates the variable ──────────────────────────────
 *
 *      Snapshot, create on chain A, revert, create on chain B. Both children
 *      are therefore #0: same factory address, same counter, same init, same
 *      initcode. `block.chainid` is the ONLY difference between the two runs,
 *      so a difference in the address can have come from nowhere else.
 *
 *      Deliberately NOT written as "create two children on two chains from one
 *      factory without reverting" — that passes on the broken code too, since
 *      the counter alone would already have separated them.
 */
contract CrossChainAddressesTest is Test {
    uint256 constant BASE = 8453;
    uint256 constant SEPOLIA = 11155111;

    address admin = makeAddr("admin");
    address recipient = makeAddr("recipient");
    address payeeA = makeAddr("payeeA");
    address payeeB = makeAddr("payeeB");

    SlotFactory slots;
    SlotCollectiveFactory collectives;
    SlotBoundNFTFactory collections;
    Tok token;

    function setUp() public {
        token = new Tok();

        slots = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(
                SlotFactory.initialize, (address(this), address(new Slot()))
            )
        )));

        SlotsWarehouseHolder holder = new SlotsWarehouseHolder();
        collectives = SlotCollectiveFactory(address(new ERC1967Proxy(
            address(new SlotCollectiveFactory()),
            abi.encodeCall(
                SlotCollectiveFactory.initialize,
                (admin, address(holder.implementation()))
            )
        )));

        collections = SlotBoundNFTFactory(address(new ERC1967Proxy(
            address(new SlotBoundNFTFactory()),
            abi.encodeCall(SlotBoundNFTFactory.initialize, (admin, slots))
        )));

        vm.warp(1_000_000);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _slotInit() internal view returns (SlotInit memory) {
        return SlotInit({
            recipient: recipient,
            currency: IERC20(address(token)),
            manager: address(0),
            hook: address(0),
            hookData: bytes32(0),
            taxBps: 1000,
            minDepositSeconds: 7 days,
            mutableTax: false,
            mutableHook: false
        });
    }

    function _split() internal view returns (SplitV2Lib.Split memory s) {
        address[] memory r = new address[](2);
        r[0] = payeeA;
        r[1] = payeeB;
        uint256[] memory a = new uint256[](2);
        a[0] = 1;
        a[1] = 1;
        s = SplitV2Lib.Split({
            recipients: r,
            allocations: a,
            totalAllocation: 2,
            distributionIncentive: 0
        });
    }

    function _roles()
        internal
        view
        returns (SlotCollective.InitialRoles memory r)
    {
        r.admin = admin;
    }

    function _collectionInit() internal view returns (CollectionInit memory c) {
        c = CollectionInit({
            name: "Bound",
            symbol: "BND",
            maxSupply: 3,
            currency: IERC20(address(token)),
            taxBps: 1000,
            minDepositSeconds: 7 days,
            recipient: recipient,
            manager: address(0),
            owner: admin
        });
    }

    // ── the property ────────────────────────────────────────────────────────

    /// @notice The first slot on base and the first slot on sepolia are
    ///         different addresses.
    function test_SlotAddressesDifferAcrossChains() public {
        uint256 snap = vm.snapshotState();

        vm.chainId(BASE);
        address onBase = slots.createSlot(_slotInit());

        vm.revertToState(snap);

        vm.chainId(SEPOLIA);
        address onSepolia = slots.createSlot(_slotInit());

        assertEq(slots.slotCount(), 1, "both were slot #0");
        assertTrue(
            onBase != onSepolia,
            "slot #0 must not be the same address on two chains"
        );
    }

    /// @notice The same, for collectives.
    function test_CollectiveAddressesDifferAcrossChains() public {
        uint256 snap = vm.snapshotState();

        vm.chainId(BASE);
        address onBase = collectives.createCollective(_split(), _roles());

        vm.revertToState(snap);

        vm.chainId(SEPOLIA);
        address onSepolia = collectives.createCollective(_split(), _roles());

        assertEq(collectives.collectiveCount(), 1, "both were collective #0");
        assertTrue(onBase != onSepolia, "collective #0 collided across chains");
    }

    /// @notice The same, for slot-bound collections.
    function test_CollectionAddressesDifferAcrossChains() public {
        uint256 snap = vm.snapshotState();

        vm.chainId(BASE);
        address onBase = collections.createCollection(_collectionInit());

        vm.revertToState(snap);

        vm.chainId(SEPOLIA);
        address onSepolia = collections.createCollection(_collectionInit());

        assertEq(collections.collectionCount(), 1, "both were collection #0");
        assertTrue(onBase != onSepolia, "collection #0 collided across chains");
    }

    /**
     * @notice The address is no longer the one CREATE would have produced.
     *
     * @dev The direct statement of the regression. `computeCreateAddress` is
     *      exactly the old derivation — factory address and nonce — so this
     *      fails the moment anyone drops the salt and goes back to `new`.
     *
     *      The factory's nonce is 1 after `initialize` deployed the beacon, so
     *      the first slot under CREATE would have taken nonce 2.
     */
    function test_TheSlotIsNotAtItsCreateAddress() public {
        vm.chainId(BASE);
        address created = slots.createSlot(_slotInit());

        assertTrue(
            created != vm.computeCreateAddress(address(slots), 2),
            "back on CREATE: the address depends on the nonce again"
        );
    }

    /// @notice Within one chain, the counter still separates them — and no
    ///         CREATE2 deploy reverts on an already-occupied address.
    function test_SlotsOnOneChainAreStillDistinct() public {
        vm.chainId(BASE);

        address first = slots.createSlot(_slotInit());
        address second = slots.createSlot(_slotInit());
        address third = slots.createSlot(_slotInit());

        assertTrue(first != second && second != third && first != third);
        assertEq(slots.slotCount(), 3);
    }

    /**
     * @notice Two chains, both running to slot #2, and no address is shared.
     *
     * @dev The whole-sequence version of the first test: it is not enough that
     *      #0 differs, since a scheme could offset one chain by a single step
     *      and re-collide at the next index.
     */
    function test_NoAddressIsSharedAcrossTheFirstSlots() public {
        uint256 snap = vm.snapshotState();

        vm.chainId(BASE);
        address[3] memory base;
        for (uint256 i = 0; i < 3; i++) base[i] = slots.createSlot(_slotInit());

        vm.revertToState(snap);

        vm.chainId(SEPOLIA);
        for (uint256 i = 0; i < 3; i++) {
            address s = slots.createSlot(_slotInit());
            for (uint256 j = 0; j < 3; j++) {
                assertTrue(s != base[j], "an address is shared across chains");
            }
        }
    }
}

/// @dev `SlotCollective`'s constructor takes the splits warehouse, and the
///      warehouse has to exist before the implementation does. Wrapping the
///      pair keeps `setUp` readable.
contract SlotsWarehouseHolder {
    SlotCollective public implementation;

    constructor() {
        implementation =
            new SlotCollective(address(new SplitsWarehouse("Ether", "ETH")));
    }
}
