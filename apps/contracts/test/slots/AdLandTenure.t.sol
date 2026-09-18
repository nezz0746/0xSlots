// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, HookTerms} from "../../src/types/SlotTypes.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test} from "forge-std/Test.sol";
import {Slot} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {HookBounds, HookDescriptor} from "../../src/interfaces/IDescribedHook.sol";
import {MinimumTenure} from "../../src/hooks/MinimumTenure.sol";
import {SlotContext} from "../../src/interfaces/ISlotHook.sol";
import {AdConfig, ModerationMode} from "../../src/hooks/adland/IAdLand.sol";

/**
 * AdLand enforcing a minimum tenure, on the one hook a slot is allowed.
 *
 * An advertising slot wants both: creatives cleared when a tenure ends, AND a
 * window in which the advertiser who just paid cannot be outbid off the wall.
 * A slot takes one hook, so AdLand carries both — the rule from
 * {MinimumTenure}, shared with {MinimumTenureHook} rather than reimplemented.
 *
 * The window is `hookData`, and ZERO means none. That is what keeps the slots
 * already attached to AdLand working: they were configured when this hook took
 * no data at all.
 */
contract AdLandTenureTest is Test {
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
            abi.encodeCall(
                SlotFactory.initialize,
                (address(this), address(slotImpl))
            )
        );
        factory = SlotFactory(address(fProxy));

        AdLand adImpl = new AdLand();
        ERC1967Proxy aProxy = new ERC1967Proxy(
            address(adImpl),
            abi.encodeCall(AdLand.initialize, (owner))
        );
        adland = AdLand(address(aProxy));

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.warp(1_000_000);
    }

    /// @dev The window is a field of AdLand's registered configuration now, so
    ///      a slot's word is the hash that names it.
    function _config(uint256 window) internal returns (bytes32) {
        if (window == 0) return bytes32(0);
        return adland.registerHookConfig(
            abi.encode(
                AdConfig({
                    tenureWindow: uint64(window),
                    moderation: ModerationMode.Open,
                    key: bytes32(0)
                })
            )
        );
    }

    function _slot(uint256 window) internal returns (Slot s) {
        return _slotWithConfig(_config(window));
    }

    function _slotWithConfig(bytes32 hookData) internal returns (Slot s) {
        return
            Slot(
                payable(
                    factory.createSlot(
                        SlotInit({
                            currency: IERC20(address(0)),
                            manager: address(this),
                            mutableTax: true, mutableRecipient: true, mutableHook: true,
                            taxTerms: TaxTerms({recipient: address(this), rateBps: uint16(500), minRunwaySeconds: uint32(7 days)}),
                            hookTerms: HookTerms({target: address(adland), config: hookData})
                        })
                    )
                )
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
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.BuyoutBelowPremium.selector,
                10 ether
            )
        );
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
    /// @dev The point of the whole exercise: one hook, both behaviours.
    function test_TheCreativeStillPublishesAndClears() public {
        Slot s = _slot(WINDOW);
        _take(s, alice, 1 ether);

        vm.prank(alice);
        adland.publish(address(s), "data:text/plain,buy soap");
        assertEq(adland.creativeOf(address(s)), "data:text/plain,buy soap");

        // Out of the window, bob takes it — and the wall goes blank.
        vm.warp(block.timestamp + WINDOW + 1);
        _take(s, bob, 1.1 ether);
        assertEq(
            adland.creativeOf(address(s)),
            "",
            "the previous advertiser's creative is gone"
        );
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
        forged.hookTerms = HookTerms({target: address(adland), config: _config(WINDOW)});

        vm.expectRevert(MinimumTenure.NotTheSlot.selector);
        adland.afterRelease(forged);
        assertEq(adland.reentryAllowedAt(address(s), bob), 0);
    }

    // ── without one ─────────────────────────────────────────────────────────

    /// @notice Zero data is no window, which is every AdLand slot already on
    ///         chain. They were attached before this hook took any data.
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

    /// @notice A window is optional, but a malformed one is still refused.
    function test_AnImpossibleWindowIsRefusedAtAttach() public {
        bytes32 tooLong = _config(400 days);
        vm.expectRevert();
        _slotWithConfig(tooLong);
    }

    /// @notice An id nobody registered is not a configuration.
    function test_AnUnregisteredConfigurationIsRefusedAtAttach() public {
        vm.expectRevert();
        _slotWithConfig(keccak256("never registered"));
    }

    /**
     * @notice A consumer can tell that an AdLand slot enforces tenure, and how
     *         to configure one.
     */
    function test_AdLandAnnouncesBothFamilies() public view {
        HookDescriptor[] memory d = adland.descriptors();
        assertEq(d.length, 2, "creatives and tenure");
        assertEq(d[0].family, adland.FAMILY(), "its own family carries the schema");
        assertEq(
            d[1].family,
            keccak256("slots.hook.minimum-tenure"),
            "and the tenure rule, under the family it has always used"
        );
    }

    /// @notice The family is the rule's, so both hosts answer identically.
    function test_BothHostsNameTheSameFamily() public {
        MinimumTenureHook standalone = new MinimumTenureHook();
        assertEq(standalone.FAMILY(), adland.TENURE_FAMILY());
        assertEq(
            standalone.DESCRIPTOR_VERSION(),
            adland.TENURE_DESCRIPTOR_VERSION()
        );
    }

    /**
     * @notice The schema is enough to build a form nobody hard-coded: the three
     *         fields a slot registers together.
     */
    function test_TheSchemaDescribesTheWholeConfiguration() public view {
        HookDescriptor[] memory d = adland.descriptors();
        assertEq(d[0].signature, "uint64 tenureWindow, uint8 moderation, bytes32 key");

        HookBounds[] memory b = abi.decode(d[0].data, (HookBounds[]));
        assertEq(b.length, 3);
        assertEq(b[0].name, "tenureWindow");
        assertEq(b[0].unit, "seconds", "so a client shows 7 days, not 604800");
        assertEq(b[0].max, adland.MAX_TENURE());
        assertEq(b[1].name, "moderation");
        assertEq(b[1].max, 2, "three modes");
        assertEq(b[2].name, "key");
    }

    /**
     * @notice The published bounds are the enforced bounds.
     *
     * @dev A schema that drifts from the check is worse than none: the form
     *      accepts a value and the transaction refuses it.
     */
    function test_TheSchemaCannotDriftFromTheCheck() public {
        HookBounds[] memory b = abi.decode(adland.descriptors()[0].data, (HookBounds[]));

        // The top of the published range is accepted.
        adland.validateHookConfig(_config(b[0].max));

        // One past it is not, and the revert names the same number.
        bytes32 tooLong = _config(b[0].max + 1);
        vm.expectRevert(
            abi.encodeWithSelector(MinimumTenure.TenureTooLong.selector, b[0].max)
        );
        adland.validateHookConfig(tooLong);
    }
}
