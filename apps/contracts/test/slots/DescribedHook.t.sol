// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotHook, SlotContext, HookFlags} from "../../src/ISlotHook.sol";
import {IDescribedHook, HookDescriptor} from "../../src/IDescribedHook.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {CompositeHook} from "../../src/hooks/CompositeHook.sol";

/// @dev A hook that works but describes nothing — the case a client must
///      degrade on rather than fail on.
contract SilentHook is ISlotHook {
    function hooks() external pure returns (HookFlags memory f) {
        f.beforeBuy = true;
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSell(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterSell(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
}

/// @dev A hook whose `descriptors()` reverts. It must still be usable — the
///      discovery layer is advisory and cannot be load-bearing.
contract LyingHook is SilentHook, IDescribedHook {
    function descriptors() external pure returns (HookDescriptor[] memory) {
        revert("no");
    }
}

contract DescribedHookTest is Test {
    SlotFactory factory;
    MinimumTenureHook tenure;

    uint256 constant TENURE = 7 days;

    function setUp() public {
        factory = SlotFactory(address(new ERC1967Proxy(
            address(new SlotFactory()),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
        )));
        tenure = new MinimumTenureHook(TENURE, "ipfs://bafyMinimumTenure");
    }

    function _slot(address hook) internal returns (Slot) {
        return Slot(payable(factory.createSlot(SlotInit({
            recipient: address(0xF00D),
            currency: IERC20(address(0)),
            manager: address(this),
            hook: hook,
            taxPercentage: 500,
            minDepositSeconds: 1 hours,
            mutableTax: true,
            mutableHook: true
        }))));
    }

    // ── the descriptor itself ────────────────────────────────────────────────

    function test_TheTenureHookDescribesItself() public view {
        HookDescriptor[] memory d = tenure.descriptors();
        assertEq(d.length, 1);
        assertEq(d[0].family, keccak256("slots.hook.minimum-tenure"));
        assertEq(d[0].version, 1);
        assertEq(abi.decode(d[0].data, (uint256)), TENURE);
        assertEq(d[0].metadataURI, "ipfs://bafyMinimumTenure");
    }

    /// @notice The family id is a published constant. Pinned to its literal so
    ///         a rename cannot silently repoint every client that matches it.
    function test_TheFamilyIdsArePinned() public {
        assertEq(tenure.FAMILY(), 0x0d7513dbf4adcafafb5452802cd9f31f7756b1fea3b6105f694902aa59312b8b);

        address[] memory none = new address[](0);
        HookFlags memory f;
        assertEq(
            new CompositeHook(address(this), none, f, "").FAMILY(),
            0x30bc90144852326f874d76845bb88e420cc26b298e3d6879b68e2947d22f4af1
        );
    }

    /// @notice Data decodes to the value the hook actually enforces, not to a
    ///         number it was told to report.
    function test_TheDescribedTenureIsTheEnforcedTenure() public {
        MinimumTenureHook other = new MinimumTenureHook(3 days, "");
        assertEq(abi.decode(other.descriptors()[0].data, (uint256)), 3 days);
        assertEq(other.tenureSeconds(), 3 days);
        assertEq(other.descriptors()[0].metadataURI, "", "empty is legal");
    }

    // ── composition ──────────────────────────────────────────────────────────

    function test_TheCompositeDescribesItselfAndNamesItsChildren() public {
        address[] memory kids = new address[](2);
        kids[0] = address(tenure);
        kids[1] = address(new SilentHook());
        HookFlags memory f;
        f.beforeBuy = true;

        CompositeHook c = new CompositeHook(address(this), kids, f, "ipfs://bafyComposite");

        HookDescriptor[] memory d = c.descriptors();
        assertEq(d.length, 1, "its own descriptor only");
        assertEq(d[0].family, keccak256("slots.hook.composite"));

        address[] memory named = abi.decode(d[0].data, (address[]));
        assertEq(named.length, 2);
        assertEq(named[0], address(tenure));
        assertEq(named[1], kids[1]);
    }

    /// @notice The consumer's walk: read the composite, then each child. This
    ///         is what recursion buys — the tree survives, so a UI can tell a
    ///         composite of two from a slot wearing two.
    function test_AConsumerRecoversTheTreeByWalkingChildren() public {
        address[] memory inner = new address[](1);
        inner[0] = address(tenure);
        HookFlags memory f;
        f.beforeBuy = true;
        CompositeHook leaf = new CompositeHook(address(this), inner, f, "");

        address[] memory outerKids = new address[](1);
        outerKids[0] = address(leaf);
        CompositeHook root = new CompositeHook(address(this), outerKids, f, "");

        // depth 0
        assertEq(root.descriptors()[0].family, keccak256("slots.hook.composite"));
        address[] memory l1 = abi.decode(root.descriptors()[0].data, (address[]));
        // depth 1 — still a composite
        assertEq(
            CompositeHook(l1[0]).descriptors()[0].family,
            keccak256("slots.hook.composite")
        );
        address[] memory l2 = abi.decode(
            CompositeHook(l1[0]).descriptors()[0].data, (address[])
        );
        // depth 2 — the leaf, and the tenure it enforces
        assertEq(
            MinimumTenureHook(l2[0]).descriptors()[0].family,
            keccak256("slots.hook.minimum-tenure")
        );
        assertEq(
            abi.decode(MinimumTenureHook(l2[0]).descriptors()[0].data, (uint256)),
            TENURE
        );
    }

    // ── the rule that keeps it safe ──────────────────────────────────────────

    /// @notice The protocol must never read this. A hook whose `descriptors()`
    ///         reverts has to remain completely usable, or the advisory layer
    ///         has quietly become load-bearing.
    function test_AHookWhoseDescriptorRevertsStillWorks() public {
        LyingHook liar = new LyingHook();
        Slot s = _slot(address(liar));

        vm.expectRevert();
        IDescribedHook(address(liar)).descriptors();

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        uint256 need = s.minDepositForBuy(0.01 ether);
        vm.prank(buyer);
        s.buy{value: s.quoteBuy(address(this), need)}(buyer, need, 0.01 ether, 0);

        assertEq(s.occupant(), buyer, "execution is unaffected by discovery");
        assertEq(s.hook(), address(liar));
        assertTrue(s.hookFlags().beforeBuy, "authority still comes from flags");
    }

    /// @notice A hook that does not implement discovery at all is equally
    ///         usable; the client just gets nothing to render.
    function test_AHookThatDescribesNothingIsStillAFineHook() public {
        SilentHook quiet = new SilentHook();
        Slot s = _slot(address(quiet));

        (bool ok, ) = address(quiet).staticcall(
            abi.encodeCall(IDescribedHook.descriptors, ())
        );
        assertFalse(ok, "no such function; the client falls back to flags");

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        uint256 need = s.minDepositForBuy(0.01 ether);
        vm.prank(buyer);
        s.buy{value: s.quoteBuy(address(this), need)}(buyer, need, 0.01 ether, 0);
        assertEq(s.occupant(), buyer);
    }

    /// @notice And the slot itself never calls it — asserted against bytecode,
    ///         not by reading the source and hoping.
    ///
    /// @dev Scans the IMPLEMENTATION, not the slot. A slot is a BeaconProxy,
    ///      so `address(slot).code` is the proxy stub and contains no selector
    ///      from the logic at all — scanning it would pass for every possible
    ///      implementation, including one that reads `descriptors()` on every
    ///      buy. Mutation-checked: adding such a read to `Slot` fails this.
    function test_TheSlotBytecodeDoesNotContainTheDescriptorsSelector() public {
        _slot(address(tenure));
        bytes4 sel = IDescribedHook.descriptors.selector;
        bytes memory code = factory.implementation().code;
        assertGt(code.length, 1000, "must be scanning the logic, not a proxy");

        bool found;
        for (uint256 i; i + 4 <= code.length; ++i) {
            if (
                code[i] == sel[0] && code[i + 1] == sel[1] &&
                code[i + 2] == sel[2] && code[i + 3] == sel[3]
            ) { found = true; break; }
        }
        assertFalse(found, "the protocol must not know this selector exists");
    }
}
