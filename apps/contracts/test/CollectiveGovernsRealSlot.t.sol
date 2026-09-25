// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInit, TaxTerms, ModuleTerms, ModuleFee, Pending} from "../src/types/SlotTypes.sol";
import {InvalidModule} from "../src/errors/SlotErrors.sol";

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotCollective} from "../src/collectives/SlotCollective.sol";
import {SlotCollectiveFactory} from "../src/collectives/SlotCollectiveFactory.sol";
import {IManagedSlot} from "../src/collectives/SlotGovernance.sol";

import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {MinimumTenureModule} from "../src/modules/MinimumTenureModule.sol";
import {Scopes} from "../src/interfaces/ISlotModule.sol";

/**
 * @notice The collective driving a REAL v1 slot, not a mock.
 *
 * @dev The other collective suites use a `MockSlot`, which is fine for role
 *      boundaries and useless for this: a mock implements whatever the port
 *      was written to call, so it agrees with the relays by construction and
 *      would keep agreeing if both were wrong together. These bind the two
 *      real contracts across a real ABI.
 */
contract CollectiveGovernsRealSlotTest is Test {
    SplitsWarehouse warehouse;
    SlotCollective collective;
    SlotFactory slotFactory;
    Slot slot;
    address moduleA;

    address admin = makeAddr("admin");
    address taxMgr = makeAddr("taxMgr");
    address policyMgr = makeAddr("policyMgr");
    address payee = makeAddr("payee");
    address buyer = makeAddr("buyer");

    uint256 constant PRICE = 0.1 ether;

    function setUp() public {
        warehouse = new SplitsWarehouse("Ether", "ETH");
        SlotCollectiveFactory cf = SlotCollectiveFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotCollectiveFactory()),
                    abi.encodeCall(
                        SlotCollectiveFactory.initialize,
                        (admin, address(new SlotCollective(address(warehouse))))
                    )
                )
            )
        );
        collective = SlotCollective(payable(cf.createCollective(_split(), _roles())));

        slotFactory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(SlotFactory.initialize, (admin, address(new Slot())))
                )
            )
        );

        // The collective is both the manager and where the tax goes.
        slot = Slot(
            payable(slotFactory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(collective),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(collective),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(1 days)
                        }),
                        moduleTerms: ModuleTerms({module: address(0), settings: ""})
                    })
                ))
        );

        moduleA = address(new MinimumTenureModule());
        vm.deal(buyer, 100 ether);
    }

    function _split() internal view returns (SplitV2Lib.Split memory s) {
        address[] memory r = new address[](1);
        r[0] = payee;
        uint256[] memory a = new uint256[](1);
        a[0] = 100;
        s = SplitV2Lib.Split({
            recipients: r, allocations: a, totalAllocation: 100, distributionIncentive: 0
        });
    }

    function _roles() internal view returns (SlotCollective.InitialRoles memory r) {
        address[] memory tax = new address[](1);
        tax[0] = taxMgr;
        address[] memory modules = new address[](1);
        modules[0] = policyMgr;
        r = SlotCollective.InitialRoles({
            admin: admin, taxManagers: tax, policyManagers: modules, splitManagers: new address[](0)
        });
    }

    /// @dev Terms are queued, then ripen, then land at a transition.
    function _ripen() internal {
        vm.warp(block.timestamp + 1 days + 1);
    }

    /// @dev Funded generously on purpose: once a tenure module is attached its
    ///      own window requirement exceeds the core's `minRunwaySeconds`
    ///      floor, and this helper is used on both sides of that change.
    function _seat(address who) internal {
        // Native slot, and funded generously on purpose: once a tenure module is
        // attached its own window requirement exceeds the core's floor, and
        // this helper is used on both sides of that change.
        uint256 need = slot.minDepositForBuy(PRICE) + 1 ether;
        uint256 cost = slot.quoteBuy(who, need);
        vm.deal(who, cost + 1 ether);
        vm.prank(who);
        slot.buy{value: cost}(who, PRICE, need, 0);
    }

    function _pending()
        internal
        view
        returns (uint256 tax, address module, bool hasTax, bool hasModule)
    {
        Pending memory __p1 = slot.pending();
        TaxTerms memory __r1 = __p1.taxTerms;
        ModuleTerms memory __h1 = ModuleTerms(__p1.nextModule.module, __p1.nextModule.settings);
        uint16 __m1 = __p1.mask;
        uint64 __at1 = __p1.proposedAt;
        tax = __r1.rateBps;
        module = __h1.module;
        hasTax = (__m1 & 1 != 0);
        hasModule = (__m1 & 8 != 0);
    }

    /// @notice The tax manager's lever reaches a real slot.
    function test_TheTaxRelayReachesARealSlot() public {
        vm.prank(taxMgr);
        collective.proposeTax(IManagedSlot(address(slot)), 750);

        (uint256 tax,, bool hasTax,) = _pending();
        assertTrue(hasTax);
        assertEq(tax, 750);
        assertEq(slot.taxRateBps(), 500, "deferred, not immediate");

        _ripen();
        _seat(buyer);
        assertEq(slot.taxRateBps(), 750, "landed on the occupancy change");
    }

    /// @notice Accepting a module's fee reaches a real slot as its manager: the
    ///         slot answers with its own refusal, not `NotManager`.
    function test_TheAcceptFeeRelayReachesARealSlot() public {
        vm.prank(policyMgr);
        vm.expectRevert(InvalidModule.selector);
        collective.acceptFee(IManagedSlot(address(slot)), ModuleFee(0, address(0)));
    }

    /// @notice The policy manager's lever reaches a real slot, and the real slot
    ///         validates the module rather than trusting the relay.
    function test_TheModuleRelayReachesARealSlotAndTheSlotValidates() public {
        vm.prank(policyMgr);
        collective.proposeModule(
            IManagedSlot(address(slot)),
            ModuleTerms({module: moduleA, settings: abi.encode(uint256(7 days))})
        );

        _ripen();
        _seat(buyer);
        assertEq(slot.module(), moduleA);

        assertTrue(slot.scopes().beforeBuy, "scopes were copied from the real module");

        // A module that cannot answer `scopes` or `fee` is refused at the slot, not here.
        vm.prank(policyMgr);
        vm.expectRevert();
        collective.proposeModule(
            IManagedSlot(address(slot)), ModuleTerms({module: address(warehouse), settings: ""})
        );
    }

    /// @notice The assertion the whole port turns on, against real contracts:
    ///         one role retracting its own proposal must not destroy the
    ///         other's.
    function test_OneRoleCancellingDoesNotDestroyTheOthersQueuedWork() public {
        vm.prank(taxMgr);
        collective.proposeTax(IManagedSlot(address(slot)), 750);
        vm.prank(policyMgr);
        collective.proposeModule(
            IManagedSlot(address(slot)),
            ModuleTerms({module: moduleA, settings: abi.encode(uint256(7 days))})
        );

        vm.prank(policyMgr);
        collective.cancelModuleProposal(IManagedSlot(address(slot)));

        (uint256 tax, address module, bool hasTax, bool hasModule) = _pending();
        assertTrue(hasTax, "the tax manager never agreed to lose this");
        assertEq(tax, 750);
        assertFalse(hasModule);
        assertEq(module, address(0));

        _ripen();
        _seat(buyer);
        assertEq(slot.taxRateBps(), 750);
        assertEq(slot.module(), address(0), "the cancelled module did not land");
    }

    /// @notice Roles do not leak, across the real boundary.
    function test_RolesDoNotLeakAgainstARealSlot() public {
        vm.prank(policyMgr);
        vm.expectRevert();
        collective.proposeTax(IManagedSlot(address(slot)), 750);

        vm.prank(taxMgr);
        vm.expectRevert();
        collective.proposeModule(
            IManagedSlot(address(slot)),
            ModuleTerms({module: moduleA, settings: abi.encode(uint256(7 days))})
        );

        (,, bool hasTax, bool hasModule) = _pending();
        assertFalse(hasTax);
        assertFalse(hasModule);
    }

    /// @notice And a slot that never named this collective as its manager is
    ///         refused on the far side — which is why no registry is kept.
    function test_ASlotThisCollectiveDoesNotManageRefusesIt() public {
        Slot other = Slot(
            payable(slotFactory.createSlot(
                    SlotInit({
                        currency: IERC20(address(0)),
                        manager: address(0xA11CE),
                        mutableTax: true,
                        mutableRecipient: true,
                        mutableModule: true,
                        taxTerms: TaxTerms({
                            recipient: address(0xF00D),
                            rateBps: uint16(500),
                            minRunwaySeconds: uint32(1 days)
                        }),
                        moduleTerms: ModuleTerms({module: address(0), settings: ""})
                    })
                ))
        );

        vm.prank(taxMgr);
        vm.expectRevert();
        collective.proposeTax(IManagedSlot(address(other)), 750);
    }

    /// @notice Money still flows: sweep pulls a real slot's tax into the
    ///         payout engine.
    function test_SweepPullsRealTaxIntoTheCollective() public {
        _ripen();
        _seat(buyer);
        vm.warp(block.timestamp + 10 days);

        IManagedSlot[] memory slots = new IManagedSlot[](1);
        slots[0] = IManagedSlot(address(slot));

        uint256 before = address(collective).balance;
        collective.sweep(slots);
        assertGt(address(collective).balance, before, "tax reached the engine");
    }

    /// @notice The blanket cancel works against a real slot with only one
    ///         dimension queued — the case that would revert if it asked for
    ///         both at once.
    function test_TheBlanketCancelToleratesOneDimensionOnARealSlot() public {
        vm.prank(taxMgr);
        collective.proposeTax(IManagedSlot(address(slot)), 750);

        vm.prank(admin);
        collective.cancelAllProposals(IManagedSlot(address(slot)));

        (,, bool hasTax, bool hasModule) = _pending();
        assertFalse(hasTax);
        assertFalse(hasModule);
    }
}
