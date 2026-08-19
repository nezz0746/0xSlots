// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IOccupancyPolicy, OccupancyContext} from "../src/interfaces/IOccupancyPolicy.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";
import {CompositePolicy} from "../src/policies/CompositePolicy.sol";
import {AllOfPolicy} from "../src/policies/AllOfPolicy.sol";
import {OneOfPolicy} from "../src/policies/OneOfPolicy.sol";
import {MinimumPricePolicy} from "../src/policies/MinimumPricePolicy.sol";
import {TokenHolderPolicy} from "../src/policies/TokenHolderPolicy.sol";

contract CPMockERC20 is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract CPMembers is ERC721 {
    uint256 public next = 1;
    constructor() ERC721("Members", "M") {}
    function mint(address to) external { _mint(to, next++); }
}

/// @notice Always refuses, with a distinctive error so bubbling can be proven.
contract AlwaysNo is IOccupancyPolicy {
    error Nope(string why);
    string public why;
    constructor(string memory w) { why = w; }
    function checkBuy(OccupancyContext calldata) external view { revert Nope(why); }
    function checkPriceUpdate(OccupancyContext calldata) external view { revert Nope(why); }
    function name() external pure returns (string memory) { return "AlwaysNo"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @notice Always permits.
contract AlwaysYes is IOccupancyPolicy {
    function checkBuy(OccupancyContext calldata) external view {}
    function checkPriceUpdate(OccupancyContext calldata) external view {}
    function name() external pure returns (string memory) { return "AlwaysYes"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @notice Records that it was consulted, so short-circuiting can be observed.
contract CountingYes is IOccupancyPolicy {
    uint256 public calls;
    function checkBuy(OccupancyContext calldata) external view {}
    function checkPriceUpdate(OccupancyContext calldata) external view {}
    function bump() external { calls++; }
    function name() external pure returns (string memory) { return "CountingYes"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function metadataURI() external pure returns (string memory) { return ""; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == type(IERC165).interfaceId;
    }
}

/// @notice Implements the hooks but denies being a policy. Rejected at construction.
contract NotReallyAPolicy {
    function checkBuy(OccupancyContext calldata) external view {}
    function checkPriceUpdate(OccupancyContext calldata) external view {}
    function supportsInterface(bytes4) external pure returns (bool) { return false; }
}

/**
 * @title CompositePolicyTest
 * @notice `AllOfPolicy` (conjunction) and `OneOfPolicy` (disjunction).
 *
 * @dev The asymmetry is the thing under test. A conjunction is as strict as its
 *      STRICTEST child and bubbles that child's own error; a disjunction is as
 *      permissive as its LOOSEST child and can only report that everything
 *      refused. Both properties are load-bearing for anyone reviewing a
 *      composite, and neither is visible from the type signature.
 */
contract CompositePolicyTest is Test {
    SlotFactory factory;
    CPMockERC20 usdc;
    CPMembers members;

    MinimumPricePolicy floor;      // 100 USDC
    TokenHolderPolicy gate;        // holders of `members`

    address recipient = makeAddr("recipient");
    address holder = makeAddr("holder");       // has an NFT
    address outsider = makeAddr("outsider");   // has none

    uint256 constant FLOOR = 100e6;

    function setUp() public {
        Slot slotImpl = new Slot();
        SlotFactory factoryImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(proxy));

        usdc = new CPMockERC20();
        members = new CPMembers();
        floor = new MinimumPricePolicy(IERC20(address(usdc)), FLOOR);
        gate = new TokenHolderPolicy(IERC721(address(members)));

        usdc.mint(holder, 1e12);
        usdc.mint(outsider, 1e12);
        members.mint(holder);

        vm.warp(1_000_000);
    }

    function _two(address a, address b) internal pure returns (address[] memory out) {
        out = new address[](2);
        out[0] = a;
        out[1] = b;
    }

    function _one(address a) internal pure returns (address[] memory out) {
        out = new address[](1);
        out[0] = a;
    }

    function _slot(address policy) internal returns (Slot) {
        return Slot(factory.createSlot(
            recipient,
            IERC20(address(usdc)),
            SlotConfig({mutableTax: false, mutableUtility: false, mutablePolicy: false, manager: address(0)}),
            SlotInitParams({
                taxPercentage: 100,
                utility: address(0),
                liquidationBountyBps: 500,
                minDepositSeconds: 0,
                occupancyPolicy: policy
            })
        ));
    }

    function _buy(Slot s, address who, uint256 px) internal {
        vm.startPrank(who);
        usdc.approve(address(s), type(uint256).max);
        s.buy(who, 10e6, px);
        vm.stopPrank();
    }

    function _tryBuy(Slot s, address who, uint256 px) internal {
        vm.startPrank(who);
        usdc.approve(address(s), type(uint256).max);
        s.buy(who, 10e6, px);
        vm.stopPrank();
    }

    // ══ AllOf ══════════════════════════════════════════════════════════════

    function test_AllOf_BothSatisfied_Succeeds() public {
        AllOfPolicy p = new AllOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        _buy(s, holder, FLOOR);
        assertEq(s.occupant(), holder);
    }

    function test_AllOf_FirstRefuses_Blocks() public {
        AllOfPolicy p = new AllOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        vm.startPrank(outsider);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TokenHolderPolicy.NotAHolder.selector, outsider));
        s.buy(outsider, 10e6, FLOOR);
        vm.stopPrank();
    }

    function test_AllOf_SecondRefuses_Blocks() public {
        AllOfPolicy p = new AllOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        vm.startPrank(holder);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(MinimumPricePolicy.PriceBelowFloor.selector, FLOOR));
        s.buy(holder, 10e6, 1e6);
        vm.stopPrank();
    }

    /// @dev The reason children are called plainly rather than wrapped: the
    ///      buyer learns WHICH rule refused and with what parameters, exactly
    ///      as if that policy were installed alone.
    function test_AllOf_BubblesTheChildsOwnError() public {
        AllOfPolicy p = new AllOfPolicy(_one(address(new AlwaysNo("because"))));
        Slot s = _slot(address(p));

        vm.startPrank(holder);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(AlwaysNo.Nope.selector, "because"));
        s.buy(holder, 10e6, FLOOR);
        vm.stopPrank();
    }

    function test_AllOf_GatesPriceUpdatesToo() public {
        AllOfPolicy p = new AllOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));
        _buy(s, holder, FLOOR);

        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(MinimumPricePolicy.PriceBelowFloor.selector, FLOOR));
        s.selfAssess(1e6);
    }

    // ══ OneOf ══════════════════════════════════════════════════════════════

    /// @dev The canonical use: members enter freely, everyone else may still
    ///      take the slot by declaring above a reserve. This is what restores
    ///      forced sale that a narrow gate had removed.
    function test_OneOf_HolderEntersBelowTheFloor() public {
        OneOfPolicy p = new OneOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        _buy(s, holder, 1e6); // under the floor, but a member
        assertEq(s.occupant(), holder);
    }

    function test_OneOf_OutsiderEntersAboveTheFloor() public {
        OneOfPolicy p = new OneOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        _buy(s, outsider, FLOOR); // not a member, but clears the reserve
        assertEq(s.occupant(), outsider);
    }

    function test_OneOf_NeitherRoute_Refuses() public {
        OneOfPolicy p = new OneOfPolicy(_two(address(gate), address(floor)));
        Slot s = _slot(address(p));

        vm.startPrank(outsider);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(OneOfPolicy.NoneSatisfied.selector);
        s.buy(outsider, 10e6, 1e6);
        vm.stopPrank();
    }

    /// @dev The cost of catching: the children's own errors are gone. Pinned so
    ///      nobody later "improves" this into a misleading single reason.
    function test_OneOf_LosesTheChildrensErrors() public {
        OneOfPolicy p = new OneOfPolicy(
            _two(address(new AlwaysNo("first")), address(new AlwaysNo("second")))
        );
        Slot s = _slot(address(p));

        vm.startPrank(holder);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(OneOfPolicy.NoneSatisfied.selector);
        s.buy(holder, 10e6, FLOOR);
        vm.stopPrank();
    }

    /// @dev A disjunction is as permissive as its LOOSEST member. One
    ///      misconfigured child makes every other rule decorative.
    function test_OneOf_OneOpenChildOpensEverything() public {
        OneOfPolicy p = new OneOfPolicy(
            _two(address(gate), address(new AlwaysYes()))
        );
        Slot s = _slot(address(p));

        _buy(s, outsider, 1e6); // no NFT, under any floor — in anyway
        assertEq(s.occupant(), outsider);
    }

    /// @dev A broken child is indistinguishable from a refusing one, and both
    ///      are treated as "not this route" — fail-closed for that child.
    function test_OneOf_ABrokenChildIsJustNotARoute() public {
        // `NotReallyAPolicy` is rejected at construction, so a *reverting*
        // policy stands in for a broken one here.
        OneOfPolicy p = new OneOfPolicy(
            _two(address(new AlwaysNo("broken")), address(floor))
        );
        Slot s = _slot(address(p));

        _buy(s, outsider, FLOOR); // falls through to the floor
        assertEq(s.occupant(), outsider);
    }

    // ══ Construction ═══════════════════════════════════════════════════════

    function test_RejectsAnEmptyList() public {
        address[] memory none = new address[](0);
        vm.expectRevert(CompositePolicy.NoPolicies.selector);
        new AllOfPolicy(none);
        vm.expectRevert(CompositePolicy.NoPolicies.selector);
        new OneOfPolicy(none);
    }

    function test_RejectsMoreThanTheMaximum() public {
        address[] memory many = new address[](9);
        for (uint256 i; i < 9; ++i) many[i] = address(new AlwaysYes());
        vm.expectRevert(abi.encodeWithSelector(CompositePolicy.TooManyPolicies.selector, 9, 8));
        new AllOfPolicy(many);
    }

    function test_AcceptsExactlyTheMaximum() public {
        address[] memory eight = new address[](8);
        for (uint256 i; i < 8; ++i) eight[i] = address(new AlwaysYes());
        AllOfPolicy p = new AllOfPolicy(eight);
        assertEq(p.policyCount(), 8);
    }

    function test_RejectsANonPolicy() public {
        address bad = address(new NotReallyAPolicy());
        vm.expectRevert(abi.encodeWithSelector(CompositePolicy.NotAPolicy.selector, bad));
        new AllOfPolicy(_one(bad));
    }

    function test_RejectsAnEoaAndTheZeroAddress() public {
        address eoa = makeAddr("eoa");
        vm.expectRevert(abi.encodeWithSelector(CompositePolicy.NotAPolicy.selector, eoa));
        new AllOfPolicy(_one(eoa));
        vm.expectRevert(abi.encodeWithSelector(CompositePolicy.NotAPolicy.selector, address(0)));
        new AllOfPolicy(_one(address(0)));
    }

    // ══ Nesting ════════════════════════════════════════════════════════════

    /// @dev Composites are policies, so they nest. `AllOf(gate, OneOf(a, b))`.
    function test_CompositesNest() public {
        OneOfPolicy inner = new OneOfPolicy(
            _two(address(floor), address(new AlwaysNo("no")))
        );
        AllOfPolicy outer = new AllOfPolicy(_two(address(gate), address(inner)));
        Slot s = _slot(address(outer));

        // Member AND clears the floor via the inner disjunction.
        _buy(s, holder, FLOOR);
        assertEq(s.occupant(), holder);
    }

    function test_NestedCompositeStillRefuses() public {
        OneOfPolicy inner = new OneOfPolicy(
            _two(address(floor), address(new AlwaysNo("no")))
        );
        AllOfPolicy outer = new AllOfPolicy(_two(address(gate), address(inner)));
        Slot s = _slot(address(outer));

        // Member, but nothing inside the disjunction permits a dust price.
        vm.startPrank(holder);
        usdc.approve(address(s), type(uint256).max);
        vm.expectRevert(OneOfPolicy.NoneSatisfied.selector);
        s.buy(holder, 10e6, 1e6);
        vm.stopPrank();
    }

    // ══ Wiring ═════════════════════════════════════════════════════════════

    function test_ExposesItsChildrenInOrder() public {
        AllOfPolicy p = new AllOfPolicy(_two(address(gate), address(floor)));
        address[] memory kids = p.policies();
        assertEq(kids.length, 2);
        assertEq(kids[0], address(gate));
        assertEq(kids[1], address(floor));
    }

    function test_BothAdvertiseTheRequiredInterfaceIds() public {
        AllOfPolicy a = new AllOfPolicy(_one(address(floor)));
        OneOfPolicy o = new OneOfPolicy(_one(address(floor)));
        for (uint256 i; i < 2; ++i) {
            IOccupancyPolicy p = i == 0
                ? IOccupancyPolicy(address(a))
                : IOccupancyPolicy(address(o));
            assertTrue(p.supportsInterface(type(IOccupancyPolicy).interfaceId));
            assertTrue(p.supportsInterface(type(IModuleMetadata).interfaceId));
            assertTrue(p.supportsInterface(type(IERC165).interfaceId));
        }
    }
}
