// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test} from "forge-std/Test.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {AdLand} from "../../src/hooks/adland/AdLand.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {HookBounds, HookDescriptor} from "../../src/IDescribedHook.sol";
import {MinimumTenure} from "../../src/hooks/MinimumTenure.sol";

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

    function _slot(bytes32 hookData) internal returns (Slot s) {
        return
            Slot(
                payable(
                    factory.createSlot(
                        SlotInit({
                            recipient: address(this),
                            currency: IERC20(address(0)),
                            manager: address(this),
                            hook: address(adland),
                            hookData: hookData,
                            taxBps: 500,
                            minDepositSeconds: 7 days,
                            mutableTax: true,
                            mutableHook: true
                        })
                    )
                )
            );
    }

    /// @dev Funds the whole window, so the tenure rule's own funding check
    ///      cannot be what refuses a buy under test.
    function _take(Slot s, address who, uint256 price) internal {
        uint256 dep = adland.requiredDeposit(price, s.taxBps(), WINDOW);
        uint256 floor = s.minDepositForBuy(price);
        if (floor > dep) dep = floor;
        uint256 owed = s.quoteBuy(who, dep);
        vm.prank(who);
        s.buy{value: owed}(who, price, dep, type(uint256).max);
    }

    // ── with a window ───────────────────────────────────────────────────────

    /// @notice Inside the window, an ordinary outbid is refused.
    function test_AnAdvertiserCannotBeOutbidInsideTheirWindow() public {
        Slot s = _slot(bytes32(WINDOW));
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + 1 days);
        uint256 dep = adland.requiredDeposit(2 ether, s.taxBps(), WINDOW);
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
        Slot s = _slot(bytes32(WINDOW));
        _take(s, alice, 1 ether);
        vm.warp(block.timestamp + 1 days);

        _take(s, bob, 10 ether);
        assertEq(s.occupant(), bob, "bought at the premium");
        assertEq(s.price(), 10 ether, "and bound by what he declared");
    }

    /// @notice Past the window it is an ordinary slot again.
    function test_AfterTheWindowAnyPriceTakesIt() public {
        Slot s = _slot(bytes32(WINDOW));
        _take(s, alice, 1 ether);

        vm.warp(block.timestamp + WINDOW + 1);
        _take(s, bob, 1.1 ether);
        assertEq(s.occupant(), bob, "no protection left to buy through");
    }

    /// @notice The occupant cannot cut their price while protected.
    function test_NoCuttingThePriceWhileProtected() public {
        Slot s = _slot(bytes32(WINDOW));
        _take(s, alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(MinimumTenure.PriceCutDuringTenure.selector);
        s.selfAssess(0.1 ether);
    }

    /// @notice Creatives still work on a slot that also enforces tenure.
    /// @dev The point of the whole exercise: one hook, both behaviours.
    function test_TheCreativeStillPublishesAndClears() public {
        Slot s = _slot(bytes32(WINDOW));
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

    // ── without one ─────────────────────────────────────────────────────────

    /// @notice Zero data is no window, which is every AdLand slot already on
    ///         chain. They were attached before this hook took any data.
    function test_ASlotWithNoWindowIsUnaffected() public {
        Slot s = _slot(bytes32(0));
        _take(s, alice, 1 ether);

        // Outbid immediately, by a hair, inside what would have been a window.
        vm.warp(block.timestamp + 1 hours);
        _take(s, bob, 1.01 ether);
        assertEq(s.occupant(), bob, "no protection was configured");

        // And a price cut is nobody's business either.
        vm.prank(bob);
        s.selfAssess(0.5 ether);
        assertEq(s.price(), 0.5 ether);
    }

    /// @notice A window is optional, but a malformed one is still refused.
    function test_AnImpossibleWindowIsRefusedAtAttach() public {
        vm.expectRevert();
        _slot(bytes32(uint256(400 days)));
    }

    /**
     * @notice A consumer can tell that an AdLand slot enforces tenure.
     *
     * @dev Without this entry the hook announced only its creative family, and
     *      a client matching on families would conclude the slot was freely
     *      buyable — while `beforeBuy` refused every ordinary bid inside a
     *      window. Flags alone do not say it either: `beforeBuy = true` means
     *      "may refuse", not why.
     */
    function test_AdLandAnnouncesBothFamilies() public view {
        HookDescriptor[] memory d = adland.descriptors();
        assertEq(d.length, 2, "creatives and tenure");
        assertEq(d[0].family, adland.FAMILY(), "the creative family first");
        assertEq(
            d[1].family,
            keccak256("slots.hook.minimum-tenure"),
            "and the tenure rule, under the family it has always used"
        );
        assertEq(
            d[1].version,
            adland.TENURE_DESCRIPTOR_VERSION(),
            "at the rule's own version, not this contract's"
        );
    }

    /// @notice The family is the rule's, so both hosts answer identically.
    /// @dev A client that learned the family from {MinimumTenureHook} must
    ///      recognise the same behaviour on AdLand without a second mapping.
    function test_BothHostsNameTheSameFamily() public {
        MinimumTenureHook standalone = new MinimumTenureHook();
        assertEq(standalone.FAMILY(), adland.TENURE_FAMILY());
        assertEq(
            standalone.DESCRIPTOR_VERSION(),
            adland.TENURE_DESCRIPTOR_VERSION()
        );
    }

    /**
     * @notice The schema is enough to build a form nobody hard-coded.
     *
     * @dev The point of putting it on chain: a client that has never heard of
     *      minimum tenure renders the right control, with the right bounds,
     *      for a hook it does not recognise. The signature is an ordinary ABI
     *      type list, so a client parses it with the tools it already has
     *      rather than a decoder written for this protocol.
     */
    function test_TheSchemaDescribesTheWindow() public view {
        HookDescriptor[] memory d = adland.descriptors();
        // Read straight off the call — no decode to reach the type.
        assertEq(d[1].signature, "uint256 window", "one value, the whole word");
        HookBounds[] memory b = abi.decode(d[1].data, (HookBounds[]));

        assertEq(b.length, 1);
        assertEq(b[0].name, "window");
        assertEq(b[0].unit, "seconds", "so a client shows 7 days, not 604800");
        assertTrue(b[0].bounded, "a duration has a range");
        assertEq(b[0].min, 1, "zero is unconfigured, not short");
        assertEq(b[0].max, adland.MAX_TENURE());
    }

    /**
     * @notice The published bounds are the enforced bounds.
     *
     * @dev The reason this lives on chain rather than at `metadataURI`. A
     *      schema that drifts from the check is worse than none: the form
     *      accepts a value and the transaction refuses it.
     */
    function test_TheSchemaCannotDriftFromTheCheck() public {
        HookBounds[] memory b = abi.decode(
            adland.descriptors()[1].data,
            (HookBounds[])
        );

        // The top of the published range is accepted.
        adland.validateHookData(bytes32(b[0].max));

        // One past it is not, and the revert names the same number.
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenure.TenureTooLong.selector,
                b[0].max
            )
        );
        adland.validateHookData(bytes32(b[0].max + 1));
    }

    /// @notice Both hosts publish the same schema, byte for byte.
    function test_BothHostsPublishOneSchema() public {
        MinimumTenureHook standalone = new MinimumTenureHook();
        assertEq(
            standalone.descriptors()[0].signature,
            adland.descriptors()[1].signature,
            "the same type"
        );
        assertEq(
            keccak256(standalone.descriptors()[0].data),
            keccak256(adland.descriptors()[1].data),
            "a client configures either without knowing which it has"
        );
    }
}
