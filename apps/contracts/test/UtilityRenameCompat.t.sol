// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import {IUtility} from "../src/interfaces/IUtility.sol";
import {ISlotsModule} from "../src/interfaces/ISlotsModule.sol";
import {IModuleMetadata} from "../src/interfaces/IModuleMetadata.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// A utility written against the OLD interface NAME (`ISlotsModule`), as third
/// parties have it. Still current on the wire: the alias is source-level.
contract LegacyUtility is ISlotsModule {
    uint256 public feeBpsValue;
    address public feeRecipientValue;

    constructor(uint256 bps, address to) {
        feeBpsValue = bps;
        feeRecipientValue = to;
    }

    function name() external pure returns (string memory) { return "Legacy"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function feeBps() external view returns (uint256) { return feeBpsValue; }
    function feeRecipient() external view returns (address) { return feeRecipientValue; }
    function metadataURI() external pure returns (string memory) { return "ipfs://legacy"; }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IUtility).interfaceId
            || id == type(IModuleMetadata).interfaceId
            || id == 0x01ffc9a7;
    }
}

/// A utility as it exists ON CHAIN today, compiled before the metadata rename:
/// `moduleURI()`, and an ERC165 id computed over the pre-rename selector set.
///
/// Declared standalone rather than against any interface, because no current
/// interface describes it any more — which is the whole point. It exists to pin
/// that the break is LOUD: verification must reject it, not accept it and then
/// silently report an empty URI.
contract PreRenameUtility {
    function name() external pure returns (string memory) { return "PreRename"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function onTransfer(uint256, address, address) external {}
    function onPriceUpdate(uint256, uint256, uint256) external {}
    function onRelease(uint256, address) external {}
    function onSettle(uint256, address, uint256, uint256) external {}
    function feeBps() external pure returns (uint256) { return 0; }
    function feeRecipient() external pure returns (address) { return address(0); }
    function moduleURI() external pure returns (string memory) { return "ipfs://old"; }

    /// The pre-rename id: XOR over the nine selectors the old interface owned.
    function supportsInterface(bytes4 id) external pure returns (bool) {
        bytes4 old = this.name.selector
            ^ this.version.selector
            ^ this.onTransfer.selector
            ^ this.onPriceUpdate.selector
            ^ this.onRelease.selector
            ^ this.onSettle.selector
            ^ this.feeBps.selector
            ^ this.feeRecipient.selector
            ^ this.moduleURI.selector;
        return id == old || id == 0x01ffc9a7;
    }
}

/// @notice The `module` → `utility` rename is source-level only. These tests are
///         the guardrail: they pin the parts that CANNOT move without breaking
///         contracts already deployed behind the beacon.
contract UtilityRenameCompatTest is Test {
    SlotFactory factory;
    MockToken token;
    address manager = makeAddr("manager");
    address recipient = makeAddr("recipient");
    address feeTo = makeAddr("feeTo");
    address alice = makeAddr("alice");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fImpl = new SlotFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(fImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl)))
        );
        factory = SlotFactory(address(proxy));
        token = new MockToken();
        token.mint(alice, 1000 ether);
    }

    function _slot(address utility) internal returns (Slot) {
        return Slot(
            factory.createSlot(
                recipient,
                IERC20(address(token)),
                SlotConfig({
                    mutableTax: true,
                    mutableUtility: true,
                    mutablePolicy: true,
                    manager: manager
                }),
                SlotInitParams({
                    taxPercentage: 1000,
                    utility: utility,
                    liquidationBountyBps: 0,
                    minDepositSeconds: 0,
                    occupancyPolicy: address(0)
                })
            )
        );
    }

    /// The old getter is the one deployed callers hold. It must still answer,
    /// and must agree with the new name.
    function test_DeprecatedGettersStillAnswer() public {
        LegacyUtility u = new LegacyUtility(0, feeTo);
        Slot s = _slot(address(u));

        assertEq(s.module(), address(u), "module() still resolves");
        assertEq(s.module(), s.utility(), "and agrees with utility()");
        assertTrue(s.mutableModule(), "mutableModule() still resolves");
        assertEq(s.mutableModule(), s.mutableUtility(), "and agrees");
    }

    /// Raw-selector call, i.e. exactly what an un-upgraded caller with an old
    /// ABI does. Compiling against the alias is not the same test.
    function test_OldSelectorsSurviveRawCalls() public {
        LegacyUtility u = new LegacyUtility(0, feeTo);
        Slot s = _slot(address(u));

        (bool ok, bytes memory data) =
            address(s).staticcall(abi.encodeWithSignature("module()"));
        assertTrue(ok, "module() selector still routed");
        assertEq(abi.decode(data, (address)), address(u));

        (ok, ) = address(s).staticcall(abi.encodeWithSignature("mutableModule()"));
        assertTrue(ok, "mutableModule() selector still routed");

        vm.prank(manager);
        (ok, ) = address(s).call(
            abi.encodeWithSignature("proposeModuleUpdate(address)", address(0))
        );
        assertTrue(ok, "proposeModuleUpdate(address) still routed");
    }

    /// The factory's registry kept its old selectors too.
    function test_FactoryDeprecatedSelectors() public {
        LegacyUtility u = new LegacyUtility(0, feeTo);
        factory.setUtilityVerified(address(u), true);

        assertTrue(factory.isUtilityVerified(address(u)));
        assertTrue(factory.isModuleVerified(address(u)), "old name agrees");
        assertTrue(factory.verifiedModules(address(u)), "old mapping getter agrees");

        (bool ok, bytes memory data) = address(factory).staticcall(
            abi.encodeWithSignature("isModuleVerified(address)", address(u))
        );
        assertTrue(ok && abi.decode(data, (bool)), "raw old selector works");
    }

    /// THE one that would bite hardest. The slot staticcalls `feeBps()` and
    /// `feeRecipient()` BY SIGNATURE on utilities it does not control and cannot
    /// upgrade. Renaming either would fail open and silently route 100% of tax
    /// to the recipient — no revert, no event, just a fee that stopped.
    function test_UtilityFeeSignaturesUnchanged() public {
        LegacyUtility u = new LegacyUtility(2000, feeTo); // 20%
        Slot s = _slot(address(u));

        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 100 ether, 100 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        s.collect();

        // A utility written against the old interface still gets paid.
        assertGt(token.balanceOf(feeTo), 0, "legacy utility still earns its fee");
        assertApproxEqRel(
            token.balanceOf(feeTo),
            (token.balanceOf(feeTo) + token.balanceOf(recipient)) / 5,
            0.01e18,
            "and it is still 20%"
        );
    }

    /// The alias interface must stay ABI-identical, or a utility compiled
    /// against either one would not satisfy the other.
    function test_AliasInterfaceIdMatches() public pure {
        assertEq(
            type(ISlotsModule).interfaceId,
            type(IUtility).interfaceId,
            "ISlotsModule and IUtility are the same ABI"
        );
    }

    /// The metadata rename is a WIRE break, and this pins that it fails loudly.
    ///
    /// Every other test in this file exists to prove a rename was source-level
    /// only. This one proves the opposite for `moduleURI()` → `metadataURI()`:
    /// a contract compiled before it must be REJECTED at verification. The
    /// alternative — accepting it and letting `Slot`'s `try` swallow the failed
    /// staticcall — is how a utility ends up silently reporting no metadata,
    /// which is exactly the failure mode this repo already hit once with a
    /// single-gateway IPFS fetch.
    function test_PreRenameUtilityIsRejected() public {
        PreRenameUtility u = new PreRenameUtility();

        // Its own id no longer matches, so the first assertion is what trips.
        vm.expectRevert(bytes("not IUtility"));
        factory.setUtilityVerified(address(u), true);

        assertFalse(
            factory.isUtilityVerified(address(u)),
            "must not be left verified"
        );
    }

    /// The two ids are independent, and the factory demands both. A utility
    /// implementing the hooks but not the metadata interface is not enough:
    /// `ModuleVerified` reads name/version/metadataURI in the same call, so
    /// accepting it would revert the event instead of the check.
    function test_MetadataInterfaceIdIsAssertedSeparately() public {
        LegacyUtility u = new LegacyUtility(0, feeTo);

        assertTrue(
            u.supportsInterface(type(IUtility).interfaceId),
            "hooks id"
        );
        assertTrue(
            u.supportsInterface(type(IModuleMetadata).interfaceId),
            "metadata id"
        );
        assertTrue(
            type(IUtility).interfaceId != type(IModuleMetadata).interfaceId,
            "ids must be distinct: an ERC165 id covers only own selectors"
        );

        factory.setUtilityVerified(address(u), true);
        assertTrue(factory.isUtilityVerified(address(u)));
    }
}
