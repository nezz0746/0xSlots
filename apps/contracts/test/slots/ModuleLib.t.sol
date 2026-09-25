// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotConstants} from "../../src/slot/SlotConstants.sol";

import {AskModule, Ask} from "../utils/AskModule.sol";

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";
import {SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

contract LibToken is ERC20 {
    constructor() ERC20("T", "T") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev Hears about evictions and answers `afterLiquidate` with `size` bytes,
///      or nothing when `size` is zero.
contract ChattyModule is AskModule {
    uint256 public immutable size;

    constructor(uint256 size_) {
        size = size_;
    }

    function _ask(bytes calldata) internal pure override returns (Ask memory o) {
        o.scopes = ScopesLib.AFTER_LIQUIDATE;
    }

    function afterLiquidate(SlotContext calldata) external view {
        uint256 n = size;
        assembly {
            return(0, n)
        }
    }

    function validateSettings(bytes calldata) external pure {}
    function beforeBuy(SlotContext calldata) external view {}
    function beforeSelfAssess(SlotContext calldata) external view {}
    function afterBuy(SlotContext calldata) external {}
    function afterRelease(SlotContext calldata) external {}
    function afterSettle(SlotContext calldata) external {}
    function onInstall(SlotContext calldata) external {}
    function onUninstall(SlotContext calldata) external {}
}

/// @notice What `ModuleLib` promises the slot about calling its module.
contract ModuleLibTest is Test, SlotConstants {
    SlotFactory factory;
    LibToken token;
    address alice = makeAddr("alice");

    function setUp() public {
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (address(this), address(new Slot())))
                )
            )
        );
        token = new LibToken();
        token.mint(alice, 1e24);
        vm.warp(1_000_000);
    }

    function _insolventSlot(address module) internal returns (Slot s) {
        s = Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(token)),
                        manager: address(0),
                        mutableTax: false,
                        mutableRecipient: false,
                        mutableModule: false,
                        taxTerms: TaxTerms({
                            recipient: address(this), rateBps: 1_000, minRunwaySeconds: 0
                        }),
                        moduleTerms: ModuleTerms({module: module, settings: ""})
                    })
                ))
        );
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, 100 ether, 1, 0);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);
    }

    function _liquidationGas(address module) internal returns (uint256 used) {
        Slot s = _insolventSlot(module);
        uint256 before = gasleft();
        s.liquidate();
        used = before - gasleft();
        assertTrue(s.isVacant(), "the eviction went through");
    }

    /// @notice A module answering an eviction with a huge payload costs the
    ///         liquidator no more than the cap: the slot never copies it.
    function test_AHugeAnswerCannotInflateAnEviction() public {
        uint256 quiet = _liquidationGas(address(new ChattyModule(0)));
        // ~12.5k words: as much as the module can return inside its cap.
        uint256 loud = _liquidationGas(address(new ChattyModule(400_000)));

        assertLt(loud - quiet, MODULE_CALLBACK_GAS_LIMIT, "bounded by the cap");
    }
}
