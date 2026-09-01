// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {HookDescriptor} from "../../src/IDescribedHook.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";
import {MinimumTenureHookFactory} from "../../src/hooks/MinimumTenureHookFactory.sol";

contract FT is ERC20 {
    constructor() ERC20("FT", "FT") {}
    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/**
 * @notice A contract that says everything a real hook says, and is not one.
 *
 * @dev The whole point of `verify`. `descriptors()` is self-reported by an
 *      untrusted contract, so is `FAMILY()`, so is `tenureSeconds()`. This
 *      impostor returns the genuine family id and a plausible duration, and it
 *      would sail through any check built on what a hook claims about itself.
 */
contract FamilyImpostor {
    bytes32 public constant FAMILY = keccak256("slots.hook.minimum-tenure");
    uint256 public immutable tenureSeconds;
    string public metadataURI;

    constructor(uint256 tenureSeconds_, string memory metadataURI_) {
        tenureSeconds = tenureSeconds_;
        metadataURI = metadataURI_;
    }

    function descriptors() external view returns (HookDescriptor[] memory r) {
        r = new HookDescriptor[](1);
        r[0] = HookDescriptor({
            family: FAMILY,
            version: 1,
            data: abi.encode(tenureSeconds),
            metadataURI: metadataURI
        });
    }
}

/// @notice Reverts on everything. `verify` must answer false, not blow up.
contract HostileHook {
    fallback() external {
        revert("no");
    }
}

contract MinimumTenureHookFactoryTest is Test {
    MinimumTenureHookFactory hookFactory;

    SlotFactory factory;
    FT token;

    uint256 constant TENURE = 7 days;
    uint256 constant TAX = 1000; // 10% / month

    address recipient = makeAddr("recipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Empty default: nothing has been published yet, and `IDescribedHook`
        // says empty is legal and means exactly that.
        hookFactory = new MinimumTenureHookFactory();

        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(fi),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(impl))
                    )
                )
            )
        );
        token = new FT();
        token.mint(alice, 1_000_000 ether);
        token.mint(bob, 1_000_000 ether);
        vm.warp(1_000_000);
    }

    // ─── one address per configuration ──────────────────────────────────────

    /// @notice The reason the factory exists: the second slot wanting 7 days
    ///         gets the first slot's hook, not a second deployment.
    function test_TheSameDurationDeploysOnceAndReturnsTheSameAddress() public {
        vm.recordLogs();
        address first = hookFactory.getOrDeploy(TENURE);
        assertEq(_deployEvents(), 1, "first call deploys");
        assertGt(first.code.length, 0);

        vm.recordLogs();
        address second = hookFactory.getOrDeploy(TENURE);
        assertEq(second, first, "same duration, same hook");
        assertEq(_deployEvents(), 0, "second call is a no-op");
    }

    function test_DifferentDurationsAreDifferentHooks() public {
        address week = hookFactory.getOrDeploy(7 days);
        address day = hookFactory.getOrDeploy(1 days);
        assertTrue(week != day);
        assertEq(MinimumTenureHook(week).tenureSeconds(), 7 days);
        assertEq(MinimumTenureHook(day).tenureSeconds(), 1 days);
    }

    /// @notice `predict` is what lets a client skip the transaction, so it has
    ///         to be right BEFORE the deployment exists, not merely after.
    function test_PredictMatchesWhatGetOrDeployActuallyDeploys() public {
        address predicted = hookFactory.predict(TENURE);
        assertEq(predicted.code.length, 0, "nothing there yet");
        assertFalse(hookFactory.isDeployed(TENURE));

        address deployed = hookFactory.getOrDeploy(TENURE);
        assertEq(deployed, predicted);
        assertTrue(hookFactory.isDeployed(TENURE));
    }

    function test_PredictMatchesForACustomMetadataURI() public {
        string memory uri = "ipfs://bafyminimumtenure";
        address predicted = hookFactory.predict(TENURE, uri);
        assertEq(hookFactory.getOrDeploy(TENURE, uri), predicted);
        assertEq(MinimumTenureHook(predicted).metadataURI(), uri);
    }

    // ─── the wrinkle: metadataURI is in the initcode ────────────────────────

    /// @notice A custom URI is a different configuration and a different
    ///         address — not a silent substitution of somebody else's hook.
    function test_ACustomMetadataURIIsADifferentDeployment() public {
        address plain = hookFactory.getOrDeploy(TENURE);
        address labelled = hookFactory.getOrDeploy(TENURE, "ipfs://labelled");

        assertTrue(plain != labelled, "the URI is part of the initcode");
        assertEq(
            MinimumTenureHook(plain).tenureSeconds(),
            MinimumTenureHook(labelled).tenureSeconds(),
            "same enforcement either way"
        );
        assertEq(MinimumTenureHook(plain).metadataURI(), "");
        assertEq(MinimumTenureHook(labelled).metadataURI(), "ipfs://labelled");
    }

    /// @notice The one-argument path is exactly the two-argument path with the
    ///         empty URI filled in — so it is the canonical address for a
    ///         duration, not an address relative to a deployment choice.
    function test_TheOneArgumentPathIsTheTwoArgumentPathWithAnEmptyURI() public {
        assertEq(hookFactory.predict(TENURE), hookFactory.predict(TENURE, ""));

        address viaDefault = hookFactory.getOrDeploy(TENURE);
        assertEq(viaDefault, hookFactory.getOrDeploy(TENURE, ""));
        assertEq(MinimumTenureHook(viaDefault).metadataURI(), "");
    }

    /// @notice A URI is a different configuration, so it lands elsewhere —
    ///         the alternative would be handing the second caller the first
    ///         caller's hook while they believed their URI shipped.
    function test_AURIIsADifferentConfigurationAndADifferentAddress() public {
        assertTrue(
            hookFactory.predict(TENURE) !=
                hookFactory.predict(TENURE, "ipfs://canonical")
        );
        address withURI = hookFactory.getOrDeploy(TENURE, "ipfs://canonical");
        assertEq(MinimumTenureHook(withURI).metadataURI(), "ipfs://canonical");
        assertTrue(hookFactory.verify(withURI), "still a genuine hook");
    }

    function test_RejectsAZeroTenure() public {
        vm.expectRevert(MinimumTenureHookFactory.InvalidTenure.selector);
        hookFactory.getOrDeploy(0);

        vm.expectRevert(MinimumTenureHookFactory.InvalidTenure.selector);
        hookFactory.getOrDeploy(0, "ipfs://whatever");
    }

    // ─── the hook it deploys is a real hook ─────────────────────────────────

    /// @notice A factory that produced hooks which did not enforce the duration
    ///         they were asked for would be worse than no factory at all.
    function test_ADeployedHookEnforcesTheDurationItWasAskedFor() public {
        MinimumTenureHook hook = MinimumTenureHook(
            hookFactory.getOrDeploy(TENURE)
        );
        assertEq(hook.tenureSeconds(), TENURE);

        Slot s = Slot(
            payable(
                factory.createSlot(
                    SlotInit({
                        recipient: recipient,
                        currency: IERC20(address(token)),
                        manager: address(0),
                        hook: address(hook),
                        taxPercentage: TAX,
                        minDepositSeconds: 0,
                        mutableTax: false,
                        mutableHook: false
                    })
                )
            )
        );

        uint256 need = hook.requiredDeposit(100 ether, TAX);
        vm.startPrank(alice);
        token.approve(address(s), type(uint256).max);
        s.buy(alice, need + 10 ether, 100 ether, 0);
        vm.stopPrank();
        assertEq(s.occupant(), alice);

        uint256 availableAt = block.timestamp + TENURE;

        vm.startPrank(bob);
        token.approve(address(s), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                MinimumTenureHook.TenureNotElapsed.selector,
                availableAt
            )
        );
        s.buy(bob, 500 ether, 200 ether, 0);
        vm.stopPrank();

        // ...and released the moment the window it was asked for is over.
        vm.warp(availableAt + 1);
        vm.startPrank(bob);
        s.buy(bob, hook.requiredDeposit(200 ether, TAX) + 10 ether, 200 ether, 0);
        vm.stopPrank();
        assertEq(s.occupant(), bob);
    }

    // ─── verify ─────────────────────────────────────────────────────────────

    function test_VerifyAcceptsAGenuineHook() public {
        assertTrue(hookFactory.verify(hookFactory.getOrDeploy(TENURE)));
        assertTrue(
            hookFactory.verify(hookFactory.getOrDeploy(TENURE, "ipfs://x"))
        );
    }

    /**
     * @notice The test that matters.
     *
     * @dev The impostor returns the real family from `descriptors()`, the real
     *      family from `FAMILY()`, and a real-looking duration. Every check
     *      built on what a hook says about itself passes. It fails on the only
     *      thing it cannot forge — sitting at the address CREATE2 assigns to
     *      the configuration it claims.
     */
    function test_VerifyRejectsAnImpostorThatReportsTheRightFamily() public {
        // A genuine hook exists for this duration, so the impostor is not even
        // claiming something impossible — just claiming to be the one at a
        // different address.
        address genuine = hookFactory.getOrDeploy(TENURE);
        FamilyImpostor impostor = new FamilyImpostor(TENURE, "");

        assertEq(impostor.FAMILY(), hookFactory.FAMILY(), "family matches");
        assertEq(
            impostor.descriptors()[0].family,
            hookFactory.FAMILY(),
            "and it says so through the discovery interface too"
        );
        assertEq(impostor.tenureSeconds(), TENURE, "and reports a real window");

        assertTrue(address(impostor) != genuine);
        assertFalse(
            hookFactory.verify(address(impostor)),
            "self-reported family is not provenance; derivation is"
        );
    }

    /// @notice Genuine code, genuine family, wrong provenance.
    /// @dev Deployed with plain CREATE from this test rather than by the
    ///      factory, so it lands nowhere `predict` points.
    function test_VerifyRejectsAHookDeployedOutsideTheFactory() public {
        MinimumTenureHook rogue = new MinimumTenureHook(TENURE, "");
        assertEq(rogue.FAMILY(), hookFactory.FAMILY());
        assertEq(rogue.tenureSeconds(), TENURE);
        assertFalse(hookFactory.verify(address(rogue)));
    }

    /// @notice A hook from a sibling factory is somebody else's hook.
    function test_VerifyRejectsAnotherFactorysHook() public {
        MinimumTenureHookFactory other = new MinimumTenureHookFactory();
        address theirs = other.getOrDeploy(TENURE);

        assertTrue(other.verify(theirs));
        assertFalse(hookFactory.verify(theirs));
    }

    /// @notice False, never a revert — callers loop over candidates.
    function test_VerifyAnswersFalseForNonHooks() public {
        assertFalse(hookFactory.verify(address(0)), "no code");
        assertFalse(hookFactory.verify(alice), "an EOA");
        assertFalse(hookFactory.verify(address(new HostileHook())));
        assertFalse(hookFactory.verify(address(token)), "an unrelated contract");
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    function _deployEvents() internal view returns (uint256 n) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("TenureHookDeployed(address,uint256,string)");
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) n++;
        }
    }
}
