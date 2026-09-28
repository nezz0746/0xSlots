// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotConstants} from "../../src/slot/SlotConstants.sol";

import {SlotInit, TaxTerms, ModuleTerms} from "../../src/types/SlotTypes.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test} from "forge-std/Test.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/modules/adland/AdLand.sol";
import {SlotLens} from "../../src/periphery/lens/SlotLens.sol";
import {MinimumTenureModule} from "../../src/modules/MinimumTenureModule.sol";
import {MinimumTenure} from "../../src/modules/MinimumTenure.sol";
import {SlotContext} from "../../src/interfaces/ISlotModule.sol";
import {AdConfig, ModerationMode, IAdLand} from "../../src/modules/adland/IAdLand.sol";
import {ScopesLib} from "../../src/libraries/ScopesLib.sol";

/**
 * AdLand enforcing a minimum tenure, on the one module a slot is allowed.
 *
 * An advertising slot wants both: creatives cleared when a tenure ends, AND a
 * window in which the advertiser who just paid cannot be outbid off the wall.
 * A slot takes one module, so AdLand carries both — the rule from
 * {MinimumTenure}, shared with {MinimumTenureModule} rather than reimplemented.
 *
 * The window is `settings`, and ZERO means none. That is what keeps the slots
 * already attached to AdLand working: they were configured when this module took
 * no data at all.
 */
contract AdLandTenureTest is Test, SlotConstants {
    SlotFactory factory;
    AdLand adland;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant WINDOW = 7 days;

    function setUp() public {
        SlotFactory factoryImpl = new SlotFactory();
        Slot slotImpl = new Slot();
        ERC1967Proxy fProxy = new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(slotImpl)))
        );
        factory = SlotFactory(address(fProxy));

        AdLand adImpl = new AdLand(new SlotLens());
        ERC1967Proxy aProxy =
            new ERC1967Proxy(address(adImpl), abi.encodeCall(AdLand.initialize, (owner)));
        adland = AdLand(address(aProxy));

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.warp(1_000_000);
    }

    /// @dev The window is a field of AdLand's configuration, encoded as the
    ///      slot's settings.
    function _config(uint256 window) internal pure returns (bytes memory) {
        if (window == 0) return "";
        return abi.encode(
            AdConfig({
                tenureWindow: uint64(window), moderation: ModerationMode.Open, key: bytes32(0)
            })
        );
    }

    function _slot(uint256 window) internal returns (Slot s) {
        return _slotWithSettings(_config(window));
    }

    function _slotWithSettings(bytes memory settings) internal returns (Slot s) {
        return Slot(
            payable(factory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(this),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(this),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(7 days)
                        }),
                        moduleTerms: ModuleTerms({module: address(adland), settings: settings})
                    })
                ))
        );
    }

    /// @dev Funds the whole window, so the tenure rule's own funding check
    ///      cannot be what refuses a buy under test.
    function _take(Slot s, address who, uint256 price) internal {
        uint256 dep = adland.requiredDeposit(price, s.taxRateBps(), WINDOW);
        uint256 floor = s.minDepositForBuy(price);
        if (floor > dep) dep = floor;
        uint256 owed = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: owed}(who, price, dep, type(uint256).max);
    }

    // ── with a window ───────────────────────────────────────────────────────

    /// @notice Inside the window, an ordinary outbid is refused.
    function test_AnAdvertiserCannotBeOutbidInsideTheirWindow() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + 1 days);
        uint256 dep = adland.requiredDeposit(2 ether, s.taxRateBps(), WINDOW);
        uint256 owed = s.quoteBuy(bob, dep);

        // Double the price is not enough; the rule asks ten times.
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MinimumTenure.BuyoutBelowPremium.selector, 10 ether));
        s.buy{value: owed}(bob, 2 ether, dep, type(uint256).max);

        assertEq(s.occupant(), alice, "alice keeps the wall");
    }

    /// @notice And the premium is a price, not a wall.
    function test_TenTimesTakesItEvenInsideTheWindow() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);
        vm.warp(block.timestamp + 1 days);

        _take(s, bob, 10 ether);
        assertEq(s.occupant(), bob, "bought at the premium");
        assertEq(s.price(), 10 ether, "and bound by what he declared");
    }

    /// @notice Past the window it is an ordinary slot again.
    function test_AfterTheWindowAnyPriceTakesIt() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + WINDOW + 1);
        _take(s, bob, 1.1 ether);
        assertEq(s.occupant(), bob, "no protection left to buy through");
    }

    /// @notice The occupant cannot cut their price while protected.
    function test_NoCuttingThePriceWhileProtected() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(MinimumTenure.PriceCutDuringTenure.selector);
        s.selfAssess(0.1 ether);
    }

    /// @notice Creatives still work on a slot that also enforces tenure.
    /// @dev The point of the whole exercise: one module, both behaviours.
    function test_TheCreativeStillPublishesAndClears() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.prank(alice);
        adland.publish(address(s), "data:text/plain,buy soap");
        assertEq(adland.creativeOf(address(s)), "data:text/plain,buy soap");

        // Out of the window, bob takes it — and the wall goes blank.
        vm.warp(block.timestamp + WINDOW + 1);
        _take(s, bob, 1.1 ether);
        assertEq(adland.creativeOf(address(s)), "", "the previous advertiser's creative is gone");
    }

    /// @notice Whoever leaves cannot buy the vacant slot straight back and
    ///         restart their window, which would make the protection permanent.
    function test_AnAdvertiserWhoLeavesCannotBuyStraightBackIn() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        s.release();
        uint256 allowedAt = adland.reentryAllowedAt(address(s), alice);
        assertEq(allowedAt, block.timestamp + WINDOW, "the bar was recorded");

        uint256 dep = s.minDepositForBuy(1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MinimumTenure.TenureNotElapsed.selector, allowedAt));
        s.buy{value: dep}(alice, 1, dep, type(uint256).max);

        // Anyone else may take it, and alice may come back once barred time is up.
        vm.warp(allowedAt);
        _take(s, alice, 1 ether);
        assertEq(s.occupant(), alice);
    }

    /// @notice Liquidation bars the evicted advertiser the same way.
    function test_ALiquidatedAdvertiserIsBarredToo() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + 3650 days);
        s.liquidate();
        assertEq(adland.reentryAllowedAt(address(s), alice), block.timestamp + WINDOW);
    }

    /// @notice A forged context cannot write a bar through AdLand either.
    function test_NobodyButTheSlotCanBarOnAdLand() public {
        Slot s = _slot(WINDOW);
        SlotContext memory forged;
        forged.slot = address(s);
        forged.account = bob;
        forged.moduleTerms = ModuleTerms({module: address(adland), settings: _config(WINDOW)});

        vm.expectRevert(MinimumTenure.NotTheSlot.selector);
        adland.afterRelease(forged);
        assertEq(adland.reentryAllowedAt(address(s), bob), 0);
    }

    // ── without one ─────────────────────────────────────────────────────────

    /// @notice Zero data is no window, which is every AdLand slot already on
    ///         chain. They were attached before this module took any data.
    function test_ASlotWithNoWindowIsUnaffected() public {
        Slot s = _slot(0);
        _take(s, alice, 1 ether);

        // Outbid immediately, by a hair, inside what would have been a window.
        vm.warp(block.timestamp + 1 hours);
        _take(s, bob, 1.01 ether);
        assertEq(s.occupant(), bob, "no protection was configured");

        // And a price cut is nobody's business either.
        vm.prank(bob);
        s.selfAssess(0.5 ether);
        assertEq(s.price(), 0.5 ether);

        // Nor is leaving and coming back.
        vm.prank(bob);
        s.release();
        assertEq(adland.reentryAllowedAt(address(s), bob), 0, "no window, no bar");
        _take(s, bob, 1 ether);
        assertEq(s.occupant(), bob);
    }

    uint16 constant VETO = ScopesLib.BEFORE_BUY | ScopesLib.BEFORE_SELF_ASSESS;
    uint16 constant EXITS =
        ScopesLib.AFTER_BUY | ScopesLib.AFTER_RELEASE | ScopesLib.AFTER_LIQUIDATE;

    /// @notice Its scopes read the configuration: a veto is asked for only
    ///         where a window gives it something to veto.
    function test_OnlyAWindowAsksForAVeto() public {
        assertEq(ScopesLib.pack(_slot(0).scopes()) & VETO, 0, "nothing configured, no veto");
        assertEq(ScopesLib.pack(_slot(WINDOW).scopes()) & VETO, VETO, "a window, a veto");

        // A registered configuration without a window is no different from zero.
        bytes memory moderatedOnly = abi.encode(
            AdConfig({tenureWindow: 0, moderation: ModerationMode.Every, key: bytes32(0)})
        );
        assertEq(
            ScopesLib.pack(_slotWithSettings(moderatedOnly).scopes()) & VETO,
            0,
            "moderation alone, no veto"
        );

        // Every configuration still hears a tenure end: that is what clears the creative.
        assertEq(ScopesLib.pack(_slot(0).scopes()) & EXITS, EXITS, "exits, without a window");
        assertEq(ScopesLib.pack(_slot(WINDOW).scopes()) & EXITS, EXITS, "exits, with one");
    }

    /// @notice A window added later brings its veto with it: the new
    ///         configuration is read when proposed, and lands with it.
    function test_AWindowAddedLaterBringsItsVeto() public {
        Slot s = _slot(0);
        TaxTerms memory none;
        s.proposeTerms(
            none, ModuleTerms({module: address(adland), settings: _config(WINDOW)}), TERM_MODULE
        );
        vm.warp(block.timestamp + TERMS_DELAY + 1);
        s.applyTerms();
        assertEq(ScopesLib.pack(s.scopes()) & VETO, VETO, "the veto landed with the window");

        _take(s, alice, 1 ether);
        vm.warp(block.timestamp + 1 days);
        uint256 dep = adland.requiredDeposit(2 ether, s.taxRateBps(), WINDOW);
        uint256 owed = s.quoteBuy(bob, dep);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MinimumTenure.BuyoutBelowPremium.selector, 10 ether));
        s.buy{value: owed}(bob, 2 ether, dep, type(uint256).max);
    }

    /// @notice A window is optional, but a malformed one is still refused.
    function test_AnImpossibleWindowIsRefusedAtAttach() public {
        bytes memory tooLong = _config(400 days);
        vm.expectRevert();
        _slotWithSettings(tooLong);
    }

    /// @notice Bytes that are not one encoded `AdConfig` are not a configuration.
    function test_MalformedSettingsAreRefusedAtAttach() public {
        vm.expectRevert(IAdLand.MalformedSettings.selector);
        _slotWithSettings(abi.encode(uint256(7 days)));
    }

    /**
     * @notice The definition is enough to build a form nobody hard-coded: the
     *         three fields a slot registers together, in encoding order.
     */
    function test_TheDefinitionDescribesTheWholeConfiguration() public view {
        string memory d = adland.metadata();

        assertEq(vm.parseJsonString(d, ".settings.title"), "AdLand");
        assertFalse(
            vm.keyExistsJson(d, '.settings["x-settings-encoding"]'),
            "three values or one, the slot holds the encoded bytes"
        );
        assertTrue(vm.parseJsonBool(d, '.settings["x-optional"]'), "a slot may configure nothing");

        // In ENCODING order: what `abi.encode` expects.
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][0].name"), "tenureWindow");
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][0].type"), "uint64");
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][1].name"), "moderation");
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][1].type"), "uint8");
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][2].name"), "key");
        assertEq(vm.parseJsonString(d, ".settings[\'x-abi\'][2].type"), "bytes32");

        assertEq(
            vm.parseJsonString(d, ".settings.properties.tenureWindow[\'x-unit\']"),
            "seconds",
            "so a client shows 7 days, not 604800"
        );
    }

    /// @notice Every value is a string, so no client rounds a `uint64`.
    function test_EveryValueIsAStringWithAPattern() public view {
        string memory d = adland.metadata();
        assertEq(vm.parseJsonString(d, ".settings.properties.tenureWindow.type"), "string");
        assertEq(vm.parseJsonString(d, ".settings.properties.tenureWindow.pattern"), "^[0-9]+$");
        assertEq(vm.parseJsonString(d, ".settings.properties.key.pattern"), "^0x[0-9a-fA-F]{64}$");
    }

    /**
     * @notice Both hosts of the rule are recognisable as the same rule.
     *
     * @dev By the field's `x-semantic` tag, not by the contract: an application
     *      that knows what a minimum tenure is finds it wherever it is hosted,
     *      and under whatever name that host gave the field.
     */
    function test_BothHostsTagTheWindowTheSameWay() public {
        MinimumTenureModule standalone = new MinimumTenureModule();

        assertEq(
            vm.parseJsonString(
                adland.metadata(), ".settings.properties.tenureWindow[\'x-semantic\']"
            ),
            "minimum-tenure"
        );
        assertEq(
            vm.parseJsonString(
                standalone.metadata(), ".settings.properties.window[\'x-semantic\']"
            ),
            "minimum-tenure"
        );
        assertFalse(vm.keyExistsJson(standalone.metadata(), '.settings["x-settings-encoding"]'));
    }

    /**
     * @notice The published bounds are the enforced bounds.
     *
     * @dev A schema that drifts from the check is worse than none: the form
     *      accepts a value and the transaction refuses it. The maximum is
     *      interpolated from `MAX_TENURE`, which is what `tenureOf` reads.
     */
    function test_TheSchemaCannotDriftFromTheCheck() public {
        uint256 max = vm.parseUint(
            vm.parseJsonString(
                adland.metadata(), ".settings.properties.tenureWindow[\'x-maximum\']"
            )
        );
        assertEq(max, adland.MAX_TENURE());

        // The top of the published range is accepted.
        adland.validateSettings(_config(max));

        // One past it is not, and the revert names the same number.
        bytes memory tooLong = _config(max + 1);
        vm.expectRevert(abi.encodeWithSelector(MinimumTenure.TenureTooLong.selector, max));
        adland.validateSettings(tooLong);
    }
}
