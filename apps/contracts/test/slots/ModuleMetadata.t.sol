// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AskModule, Ask} from "../utils/AskModule.sol";

import {SlotInit, TaxTerms, ModuleTerms, ModuleFee} from "../../src/types/SlotTypes.sol";

import {Test} from "forge-std/Test.sol";
import {LibString} from "solady/utils/LibString.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {ISlotModule, SlotContext, Scopes} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";
import {IModuleMetadata} from "../../src/interfaces/IModuleMetadata.sol";
import {MinimumTenureModule} from "../../src/modules/MinimumTenureModule.sol";

/// @dev A module that works but describes nothing — the case a client must
///      degrade on rather than fail on.
contract SilentModule is AskModule {
    function validateSettings(bytes calldata) external pure {}

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        Scopes memory f;
        f.beforeBuy = true;
        o.scopes = ScopesLib.pack(f);
    }
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterLiquidate(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}

    function onUninstall(SlotContext calldata) external {}

    function onInstall(SlotContext calldata) external {}
}

/// @dev A module whose `metadata()` reverts. It must still be usable — the
///      discovery layer is advisory and cannot be load-bearing.
contract LyingModule is SilentModule, IModuleMetadata {
    function metadata() external pure returns (string memory) {
        revert("no");
    }
}

contract DescribedModuleTest is Test {
    SlotFactory factory;
    MinimumTenureModule tenure;

    uint256 constant TENURE = 7 days;

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        tenure = new MinimumTenureModule();
    }

    function _slot(address module) internal returns (Slot) {
        return _slot(module, "");
    }

    function _slot(address module, bytes memory data) internal returns (Slot) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(0xF00D),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(1 hours)
                        }),
                        moduleTerms: ModuleTerms({module: module, settings: data})
                    })
                ))
        );
    }

    // ── the definition itself ───────────────────────────────────────────────

    function test_TheTenureModuleDescribesItself() public view {
        string memory d = tenure.metadata();
        assertEq(vm.parseJsonUint(d, ".version"), 1, "the document's own version");
        assertEq(vm.parseJsonString(d, ".title"), "Minimum tenure");
        assertEq(
            vm.parseJsonString(d, ".settings.$schema"),
            "https://json-schema.org/draft/2020-12/schema",
            "a standard schema, handed to a form library untouched"
        );
    }

    /// @notice The definition names a window's SHAPE, never a window.
    ///
    /// @dev One deployment serves every duration, so any number published here
    ///      would be one slot's terms reported to every other slot's reader.
    ///      What it carries instead is this contract's own limits, from the
    ///      same constant the check reads — which is what stops a form and a
    ///      revert disagreeing.
    function test_TheDefinitionNamesAShapeNotAWindow() public view {
        string memory d = tenure.metadata();

        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][0].name"), "window");
        assertEq(
            vm.parseJsonString(d, ".settings[\'x-abi\'][0].type"), "uint256", "a type, not a value"
        );

        assertEq(
            vm.parseUint(vm.parseJsonString(d, ".settings.properties.window[\'x-maximum\']")),
            tenure.MAX_TENURE(),
            "a limit, not a setting"
        );
        assertEq(
            vm.parseJsonString(d, ".settings.properties.window[\'x-minimum\']"),
            "1",
            "and zero is unconfigured, not short"
        );
    }

    /// @notice Settings are `abi.encode` of the `x-abi` fields, so a client
    ///         encodes and attaches, with no flag to consult.
    function test_SettingsAreTheEncodedFields() public view {
        string memory d = tenure.metadata();
        assertFalse(vm.keyExistsJson(d, '.settings["x-settings-encoding"]'));
        assertEq(
            vm.parseJsonString(d, ".settings.properties.window[\'x-semantic\']"),
            "minimum-tenure",
            "how an application recognises the rule without knowing this address"
        );
    }

    /// @notice Two deployments of this module are indistinguishable, which is
    ///         the point: nothing about a slot's terms lives in the address.
    /// @notice A refusal is named and worded in the document itself, so a
    ///         client can explain a module it has never seen.
    function test_TheDocumentListsHowSettingsAreRefused() public view {
        string memory json = tenure.metadata();
        assertTrue(LibString.contains(json, '"errors":[{"signature":"TenureNotConfigured()"'));
        assertTrue(
            LibString.contains(
                json,
                '{"signature":"TenureTooLong(uint256)","message":"Too long. The most this module allows is {0}.","x-unit":"seconds"}'
            )
        );
        assertTrue(LibString.endsWith(json, "]}"), "still one closed object");
    }

    function test_EveryDeploymentDescribesItselfIdentically() public {
        MinimumTenureModule other = new MinimumTenureModule();
        assertEq(tenure.metadata(), other.metadata());
    }

    /// @notice The window comes from the slot's `settings` and nowhere else.
    function test_TheWindowIsReadOffTheSlotsConfiguration() public view {
        assertEq(tenure.tenureOf(abi.encode(uint256(3 days))), 3 days);
        assertEq(tenure.tenureOf(abi.encode(TENURE)), TENURE);
    }

    // ── the rule that keeps it safe ──────────────────────────────────────────

    /// @notice The protocol must never read this. A module whose `metadata()`
    ///         reverts has to remain completely usable, or the advisory layer
    ///         has quietly become load-bearing.
    function test_AModuleWhoseDefinitionRevertsStillWorks() public {
        LyingModule liar = new LyingModule();
        Slot s = _slot(address(liar));

        vm.expectRevert();
        IModuleMetadata(address(liar)).metadata();

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        uint256 need = s.minDepositForBuy(0.01 ether);
        vm.prank(buyer);
        s.buy{value: s.quoteBuy(address(this), need)}(buyer, 0.01 ether, need, 0);

        assertEq(s.occupant(), buyer, "execution is unaffected by discovery");
        assertEq(s.module(), address(liar));
        assertTrue(s.scopes().beforeBuy, "authority still comes from scopes");
    }

    /// @notice A module that does not implement discovery at all is equally
    ///         usable; the client just gets nothing to render.
    function test_AModuleThatDescribesNothingIsStillAFineModule() public {
        SilentModule quiet = new SilentModule();
        Slot s = _slot(address(quiet));

        (bool ok,) = address(quiet).staticcall(abi.encodeCall(IModuleMetadata.metadata, ()));
        assertFalse(ok, "no such function; the client falls back to scopes");

        address buyer = address(0xB0B);
        vm.deal(buyer, 10 ether);
        uint256 need = s.minDepositForBuy(0.01 ether);
        vm.prank(buyer);
        s.buy{value: s.quoteBuy(address(this), need)}(buyer, 0.01 ether, need, 0);
        assertEq(s.occupant(), buyer);
    }

    /// @notice And the slot itself never calls it — asserted against bytecode,
    ///         not by reading the source and hoping.
    ///
    /// @dev Scans the IMPLEMENTATION, not the slot. A slot is a BeaconProxy,
    ///      so `address(slot).code` is the proxy stub and contains no selector
    ///      from the logic at all — scanning it would pass for every possible
    ///      implementation, including one that reads `metadata()` on every
    ///      buy. Mutation-checked: adding such a read to `Slot` fails this.
    function test_TheSlotBytecodeDoesNotContainTheDefinitionSelector() public {
        _slot(address(tenure), abi.encode(TENURE));
        bytes4 sel = IModuleMetadata.metadata.selector;
        bytes memory code = factory.implementation().code;
        assertGt(code.length, 1000, "must be scanning the logic, not a proxy");

        bool found;
        for (uint256 i; i + 4 <= code.length; ++i) {
            if (
                code[i] == sel[0] && code[i + 1] == sel[1] && code[i + 2] == sel[2]
                    && code[i + 3] == sel[3]
            ) found = true;
            break;
        }
        assertFalse(found, "the protocol must not know this selector exists");
    }
}
