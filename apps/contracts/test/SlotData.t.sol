// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {SlotData} from "../src/modules/SlotData.sol";

contract Token is ERC20 {
    constructor() ERC20("Test", "TST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev `SlotData` reads `occupant`, `currency` and `price`, and calls `buy`.
///      A stub gives the tests control of occupancy without a tax clock, and
///      lets them fire the lifecycle hooks the way a real slot would.
contract MockSlot {
    address public occupant;
    address public currency;
    uint256 public price;
    SlotData public module;

    constructor(address _currency, SlotData _module) {
        currency = _currency;
        module = _module;
    }

    function buy(address account, uint256 depositAmount, uint256 price_)
        external
        payable
    {
        if (currency != address(0) && depositAmount + price > 0) {
            ERC20(currency).transferFrom(
                msg.sender,
                address(this),
                occupant == address(0) ? depositAmount : price + depositAmount
            );
        }
        address from = occupant;
        occupant = account;
        price = price_;
        // The slot notifies its utility, exactly as `Slot._notifyUtility` does.
        if (from != address(0)) module.onTransfer(0, from, account);
    }

    function release() external {
        address from = occupant;
        occupant = address(0);
        module.onRelease(0, from);
    }

    function seat(address who) external {
        occupant = who;
    }
}

contract SlotDataTest is Test {
    SlotData internal d;
    Token internal token;
    MockSlot internal slot;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event Wrote(
        address indexed slot,
        uint256 indexed serviceId,
        address indexed writer,
        uint256 generation,
        bytes data
    );
    event Cleared(address indexed slot, uint256 generation);

    uint256 internal uriService;
    uint256 internal postService;

    function setUp() public {
        SlotData impl = new SlotData();
        d = SlotData(
            address(
                new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(SlotData.initialize, (address(this)))
                )
            )
        );
        token = new Token();
        slot = new MockSlot(address(token), d);

        uriService = d.registerService("string uri", "Metadata", "");
        postService = d.registerService(
            "string text,string[] medias",
            "Post",
            "ipfs://post-schema"
        );

        slot.seat(alice);
        token.mint(bob, 1_000 ether);

        // Tests that drive `slot.buy` DIRECTLY pay the mock themselves, exactly
        // as a real buyer would. Without this the second buy in a test fails on
        // the standing price rather than on anything under test.
        token.mint(address(this), 1_000 ether);
        token.approve(address(slot), type(uint256).max);
    }

    function _uri(string memory u) internal pure returns (bytes memory) {
        return abi.encode(u);
    }

    // ═══════════════════════════════════════════════════════════
    // SERVICES
    // ═══════════════════════════════════════════════════════════

    /// @notice The schema string lives ON CHAIN, so anything with an RPC can
    ///         decode a write without the author's repo.
    function test_ServiceStoresItsSchemaOnChain() public view {
        SlotData.Service memory s = d.serviceOf(postService);
        assertEq(s.schema, "string text,string[] medias");
        assertEq(s.name, "Post");
        assertEq(s.metadataURI, "ipfs://post-schema");
        assertEq(s.registrar, address(this));
    }

    /// @notice Registration is permissionless — an owner-gated registry is a
    ///         whitelist wearing a registry's clothes.
    function test_AnyoneCanRegisterAService() public {
        vm.prank(bob);
        uint256 id = d.registerService("uint256 score", "Score", "");
        assertEq(id, 3);
        assertEq(d.serviceOf(id).registrar, bob);
    }

    /// @notice A service is a SHAPE, not a permission. Its registrar gets no
    ///         say over who writes against it.
    function test_RegistrarDoesNotGateWrites() public {
        vm.prank(bob);
        uint256 id = d.registerService("uint256 score", "Score", "");

        vm.prank(alice); // alice occupies, bob registered
        d.write(address(slot), id, abi.encode(uint256(42)));
        assertEq(abi.decode(d.read(address(slot), id), (uint256)), 42);
    }

    function test_RejectsEmptySchema() public {
        vm.expectRevert(SlotData.EmptySchema.selector);
        d.registerService("", "x", "");
    }

    function test_RejectsUnknownService() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SlotData.NoSuchService.selector, 99));
        d.write(address(slot), 99, _uri("x"));
    }

    // ═══════════════════════════════════════════════════════════
    // WRITING
    // ═══════════════════════════════════════════════════════════

    function test_OccupantCanWriteAndReadBack() public {
        vm.prank(alice);
        d.write(address(slot), uriService, _uri("ipfs://one"));
        assertEq(abi.decode(d.read(address(slot), uriService), (string)), "ipfs://one");
    }

    function test_NonOccupantCannotWrite() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(SlotData.NotOccupant.selector, address(slot))
        );
        d.write(address(slot), uriService, _uri("nope"));
    }

    /// @notice The payoff of one utility carrying many services: a slot holds
    ///         metadata AND a post at once, which two separate modules could
    ///         never do — a slot names only one `utility`.
    function test_OneSlotCarriesSeveralServicesAtOnce() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = uriService;
        ids[1] = postService;

        bytes[] memory datas = new bytes[](2);
        datas[0] = _uri("ipfs://banner");
        datas[1] = abi.encode("gm", new string[](0));

        vm.prank(alice);
        d.writeMany(address(slot), ids, datas);

        bytes[] memory got = d.readMany(address(slot), ids);
        assertEq(abi.decode(got[0], (string)), "ipfs://banner");
        assertEq(got[1], datas[1]);
    }

    function test_WriteManyRejectsMismatchedLengths() public {
        vm.prank(alice);
        vm.expectRevert(SlotData.LengthMismatch.selector);
        d.writeMany(address(slot), new uint256[](2), new bytes[](1));
    }

    // ═══════════════════════════════════════════════════════════
    // THE GENERATION TRICK
    // ═══════════════════════════════════════════════════════════

    /// @notice A transfer clears everything at once, whatever was attached.
    function test_TransferClearsEverySerivceInOneWrite() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = uriService;
        ids[1] = postService;
        bytes[] memory datas = new bytes[](2);
        datas[0] = _uri("ipfs://banner");
        datas[1] = abi.encode("gm", new string[](0));

        vm.prank(alice);
        d.writeMany(address(slot), ids, datas);

        vm.expectEmit(true, false, false, true);
        emit Cleared(address(slot), 1);
        slot.buy(bob, 0, 1 ether); // bob takes it from alice

        bytes[] memory got = d.readMany(address(slot), ids);
        assertEq(got[0].length, 0, "metadata must not survive the tenancy");
        assertEq(got[1].length, 0, "nor the post");
        assertEq(d.generationOf(address(slot)), 1);
    }

    /// @notice Clearing must be O(1). A module that looped would work with two
    ///         services and start silently failing at twenty, inside a
    ///         gas-capped hook whose revert the slot swallows — leaving the old
    ///         tenant's data live under the new one.
    function test_ClearCostIsFlatInTheNumberOfServices() public {
        // One service written.
        vm.prank(alice);
        d.write(address(slot), uriService, _uri("a"));
        uint256 gasOne = gasleft();
        slot.buy(bob, 0, 1 ether);
        gasOne -= gasleft();

        // Twenty services written.
        uint256[] memory ids = new uint256[](20);
        bytes[] memory datas = new bytes[](20);
        for (uint256 i; i < 20; ++i) {
            ids[i] = d.registerService("uint256 v", "v", "");
            datas[i] = abi.encode(i);
        }
        vm.prank(bob);
        d.writeMany(address(slot), ids, datas);

        uint256 gasMany = gasleft();
        slot.buy(alice, 0, 1 ether);
        gasMany -= gasleft();

        // Same order of magnitude — not 20x.
        assertLt(gasMany, gasOne * 2, "clearing must not scale with services");

        bytes[] memory got = d.readMany(address(slot), ids);
        for (uint256 i; i < 20; ++i) {
            assertEq(got[i].length, 0, "all twenty cleared");
        }
    }

    function test_ReleaseAlsoEndsTheTenancy() public {
        vm.prank(alice);
        d.write(address(slot), uriService, _uri("bye"));

        slot.release();
        assertEq(d.read(address(slot), uriService).length, 0);
        assertEq(d.generationOf(address(slot)), 1);
    }

    /// @notice Retaking a slot starts clean rather than resurrecting the old
    ///         tenancy's data.
    function test_RetakingDoesNotResurrectOldData() public {
        vm.prank(alice);
        d.write(address(slot), uriService, _uri("original"));

        slot.buy(bob, 0, 1 ether);
        slot.buy(alice, 0, 1 ether);

        assertEq(
            d.read(address(slot), uriService).length,
            0,
            "a new tenancy starts empty even for the same address"
        );
    }

    /// @notice The write event carries its generation, so an indexer can tell a
    ///         live write from a stale one without replaying transfers.
    function test_WriteEventCarriesItsGeneration() public {
        slot.buy(bob, 0, 1 ether); // generation 1

        vm.expectEmit(true, true, true, true);
        emit Wrote(address(slot), uriService, bob, 1, _uri("second tenancy"));
        vm.prank(bob);
        d.write(address(slot), uriService, _uri("second tenancy"));
    }

    // ═══════════════════════════════════════════════════════════
    // ATOMIC BUY + WRITE
    // ═══════════════════════════════════════════════════════════

    /// @notice The reason this lives in the module: between a separate buy and
    ///         write the slot is held with nothing on it, and anyone can outbid
    ///         into that gap.
    function test_BuyAndWriteTakesTheSlotAndPublishesAtOnce() public {
        vm.startPrank(bob);
        token.approve(address(d), type(uint256).max);
        d.buyAndWrite(address(slot), 10 ether, 5 ether, uriService, _uri("mine now"));
        vm.stopPrank();

        assertEq(slot.occupant(), bob, "the buyer occupies, not the module");
        assertEq(
            abi.decode(d.read(address(slot), uriService), (string)),
            "mine now"
        );
    }

    /// @notice The buy bumps the generation via `onTransfer`, and the write
    ///         still lands — it happens after, against the NEW generation.
    function test_BuyAndWriteSurvivesItsOwnClear() public {
        vm.prank(alice);
        d.write(address(slot), uriService, _uri("alice was here"));

        vm.startPrank(bob);
        token.approve(address(d), type(uint256).max);
        d.buyAndWrite(address(slot), 10 ether, 5 ether, uriService, _uri("bob now"));
        vm.stopPrank();

        assertEq(d.generationOf(address(slot)), 1);
        assertEq(
            abi.decode(d.read(address(slot), uriService), (string)),
            "bob now",
            "the write must land after the transfer cleared the old tenancy"
        );
    }

    function test_BuyAndWriteLeavesNoAllowanceOrDust() public {
        vm.startPrank(bob);
        token.approve(address(d), type(uint256).max);
        d.buyAndWrite(address(slot), 10 ether, 5 ether, uriService, _uri("x"));
        vm.stopPrank();

        assertEq(token.allowance(address(d), address(slot)), 0, "no standing allowance");
        assertEq(token.balanceOf(address(d)), 0, "nothing stranded in the module");
    }

    function test_BuyAndWriteRejectsValueOnAnErc20Slot() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(SlotData.UnexpectedValue.selector);
        d.buyAndWrite{value: 1 ether}(
            address(slot),
            1 ether,
            1 ether,
            uriService,
            _uri("x")
        );
    }

    function test_PermitPathRejectsNativeSlots() public {
        MockSlot native = new MockSlot(address(0), d);
        vm.prank(bob);
        vm.expectRevert(SlotData.NativeSlotHasNoPermit.selector);
        d.buyAndWriteWithPermit(
            address(native), 1, 1, uriService, _uri("x"), 1, 0, 0, 0, 0
        );
    }
}
