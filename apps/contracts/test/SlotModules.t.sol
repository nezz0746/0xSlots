// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SlotModules, IModuleRegistry} from "../src/v1/SlotModules.sol";
import {IModuleLifecycle, IModuleTopics} from "../src/v1/interfaces/IModuleLifecycle.sol";

// ───────────────────────────── doubles ──────────────────────────────────────

contract Registry is IModuleRegistry {
    mapping(address => bool) public verified;

    function set(address m, bool v) external {
        verified[m] = v;
    }

    function isUtilityVerified(address m) external view returns (bool) {
        return verified[m];
    }
}

/// @dev Records that it was called, so fan-out is observable.
contract Mod {
    uint256 public calls;
    bytes public lastData;

    function poke(uint256) external {
        calls++;
        lastData = msg.data;
    }

    /// @dev Explicit no-ops rather than letting the counting `fallback` catch
    ///      them: the lifecycle callbacks are not hook deliveries, and folding
    ///      them into the same counter makes every assertion below off by one.
    function onInstall(uint256, bytes calldata) external {}

    function onUninstall(uint256, bytes calldata) external {}

    fallback() external {
        calls++;
    }
}

/// @dev Always reverts. Must not be able to block anything.
/// @dev Declares a narrow subscription and records its lifecycle callbacks.
contract Picky is IModuleTopics, IModuleLifecycle {
    uint256 public calls;
    uint256 public installs;
    uint256 public uninstalls;
    uint32 public want;

    constructor(uint32 want_) { want = want_; }

    function topics() external view returns (uint32) { return want; }
    function setWant(uint32 w) external { want = w; }
    function onInstall(uint256, bytes calldata) external { installs++; }
    function onUninstall(uint256, bytes calldata) external { uninstalls++; }
    fallback() external { calls++; }
}

/// @dev Reverts in both lifecycle callbacks. Must not be able to block its own
///      install — and above all must not be able to block its own removal.
contract BadLifecycle is IModuleLifecycle {
    function onInstall(uint256, bytes calldata) external pure {
        revert("no install");
    }
    function onUninstall(uint256, bytes calldata) external pure {
        revert("no uninstall");
    }
    fallback() external {}
}

contract Hostile {
    fallback() external {
        revert("no");
    }
}

/// @dev Burns everything it is given. Must not starve modules after it.
contract GasBurner {
    uint256 public sink;

    fallback() external {
        while (true) sink++;
    }
}

/**
 * @dev A host with its own storage laid out BEFORE it inherits SlotModules.
 *
 *      The variable positions here are the point of `test_LayoutIsUntouched`:
 *      they are what would move if SlotModules used ordinary state variables.
 */
contract Host is SlotModules {
    address public recipient; // slot 0
    uint256 public price; // slot 1
    address public manager; // slot 2
    address public factory; // slot 3
    address public head; // slot 4

    constructor(address manager_, address factory_) {
        recipient = address(uint160(0xBEEFCAFE));
        price = 12345;
        manager = manager_;
        factory = factory_;
    }

    function setHead(address h) external {
        head = h;
    }

    error NotTheManager();

    function _requireModuleAdmin() internal view override {
        if (msg.sender != manager) revert NotTheManager();
    }

    function _moduleRegistry() internal view override returns (address) {
        return factory;
    }

    function _moduleHead() internal view override returns (address) {
        return head;
    }

    /// @dev Stands in for `Slot.mutableUtility` — the promise that gates
    ///      whether the head may ever be vacated.
    bool public headMutable = true;

    function freezeHead() external {
        headMutable = false;
    }

    function _clearModuleHead() internal override {
        _requireModulesMutable();
        head = address(0);
    }

    function _requireModulesMutable() internal view override {
        require(headMutable, "modules frozen");
    }

    /// @dev Stands in for `Slot._applyPendingUpdates`.
    function TOPIC_ALL_FOR_TEST() external pure returns (uint32) {
        return TOPIC_TRANSFER | TOPIC_PRICE | TOPIC_RELEASE | TOPIC_SETTLE;
    }

    function transition() external {
        _applyPendingModules();
    }

    function notify(uint256 n) external {
        notify(TOPIC_TRANSFER, n);
    }

    function notify(uint32 topic, uint256 n) public {
        _notifyModules(topic, "poke", abi.encodeWithSignature("poke(uint256)", n));
    }
}

// ───────────────────────────── tests ────────────────────────────────────────

contract SlotModulesTest is Test {
    Host host;
    Registry registry;
    address manager = address(uint160(0xA11CE));

    function setUp() public {
        registry = new Registry();
        host = new Host(manager, address(registry));
    }

    function _verified() internal returns (Mod m) {
        m = new Mod();
        registry.set(address(m), true);
    }

    function _install(address m) internal {
        vm.prank(manager);
        host.addModule(m);
        host.transition();
    }

    // ─── the layout proof ───────────────────────────────────────────────────

    /// @notice The reason this uses ERC-7201 at all.
    ///
    /// @dev Solidity allocates BASE storage before a derived contract's own, so
    ///      `Host is SlotModules` with ordinary state variables in the base
    ///      would push `recipient` off slot 0 — and doing that to `Slot` would
    ///      destroy every one of the 237+ live proxies. Namespacing means the
    ///      host's layout is untouched no matter where the base appears.
    function test_LayoutIsUntouched() public view {
        assertEq(
            uint256(vm.load(address(host), bytes32(uint256(0)))),
            uint256(uint160(address(uint160(0xBEEFCAFE)))),
            "slot 0 is still recipient"
        );
        assertEq(
            uint256(vm.load(address(host), bytes32(uint256(1)))),
            12345,
            "slot 1 is still price"
        );
        assertEq(
            uint256(vm.load(address(host), bytes32(uint256(2)))),
            uint256(uint160(manager)),
            "slot 2 is still manager"
        );
    }

    /// @notice The constant must actually be the ERC-7201 slot it claims to be.
    /// @dev Recomputed rather than trusted: a hand-copied constant that is
    ///      merely *a* slot still works in tests while colliding with something
    ///      else in production.
    function test_NamespaceSlotIsCorrectlyDerived() public pure {
        bytes32 expected = keccak256(
            abi.encode(
                uint256(keccak256("slots.storage.SlotModules")) - 1
            )
        ) & ~bytes32(uint256(0xff));
        assertEq(
            expected,
            0x061cd7483ff54f2472e032129df3dd760514cda92e74b589ff7fbf49d2ba7b00
        );
    }

    /// @dev The gallery must write only inside its namespace. Anything landing
    ///      in low slots would be corrupting host state.
    function test_GalleryWritesNothingInLowSlots() public {
        Mod m = _verified();
        _install(address(m));

        for (uint256 i = 5; i < 40; ++i) {
            assertEq(
                uint256(vm.load(address(host), bytes32(i))),
                0,
                "gallery wrote outside its namespace"
            );
        }
    }

    // ─── add is deferred, remove is immediate ───────────────────────────────

    function test_AddIsDeferredUntilTransition() public {
        Mod m = _verified();

        vm.prank(manager);
        host.addModule(address(m));

        assertEq(host.pendingModules().length, 1);
        assertEq(host.galleryModules().length, 0, "not live yet");
        assertFalse(host.isModuleInstalled(address(m)));

        host.transition();

        assertEq(host.pendingModules().length, 0);
        assertEq(host.galleryModules().length, 1);
        assertTrue(host.isModuleInstalled(address(m)));
        assertEq(host.moduleData(address(m)).installedAt, block.timestamp);
    }

    /// @notice Removal must NOT wait for a transition.
    ///
    /// @dev A slot can be occupied for years. If removal deferred like install
    ///      does, a module discovered to be hostile could not be detached for
    ///      the length of that tenure. Granting is gated; revoking is not.
    function test_RemoveIsImmediate() public {
        Mod m = _verified();
        _install(address(m));

        vm.prank(manager);
        host.removeModule(address(m));

        assertEq(host.galleryModules().length, 0, "gone without a transition");
        assertFalse(host.isModuleInstalled(address(m)));
    }

    function test_RemoveCancelsAQueuedAdd() public {
        Mod m = _verified();

        vm.startPrank(manager);
        host.addModule(address(m));
        host.removeModule(address(m));
        vm.stopPrank();

        host.transition();
        assertEq(host.galleryModules().length, 0, "the mistake never landed");
    }

    // ─── verification ───────────────────────────────────────────────────────

    function test_UnverifiedModuleIsRefused() public {
        Mod m = new Mod(); // never registered

        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleNotVerified.selector);
        host.addModule(address(m));
    }

    /// @notice Revocation stops NEW installs. It must not reach backwards.
    ///
    /// @dev If verification were checked at call time, the registry admin could
    ///      silently disable hooks under every occupant already using a module,
    ///      mid-tenure, with none of the deferral that protects them from every
    ///      other change. This is the test that pins that.
    function test_RevokingVerificationDoesNotDisturbInstalledModules() public {
        Mod m = _verified();
        _install(address(m));

        registry.set(address(m), false);

        host.notify(1);
        assertEq(m.calls(), 1, "still notified after revocation");
        assertTrue(host.isModuleInstalled(address(m)));

        // But a fresh install of the same address is now refused.
        vm.prank(manager);
        host.removeModule(address(m));
        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleNotVerified.selector);
        host.addModule(address(m));
    }

    // ─── guards ─────────────────────────────────────────────────────────────

    function test_OnlyAdminMayAddOrRemove() public {
        Mod m = _verified();

        vm.expectRevert(Host.NotTheManager.selector);
        host.addModule(address(m));

        _install(address(m));
        vm.expectRevert(Host.NotTheManager.selector);
        host.removeModule(address(m));
    }

    function test_RejectsDuplicatesAndTheHead() public {
        Mod m = _verified();
        _install(address(m));

        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleAlreadyInstalled.selector);
        host.addModule(address(m));

        Mod h = _verified();
        host.setHead(address(h));
        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleAlreadyInstalled.selector);
        host.addModule(address(h));
    }

    function test_RejectsAnAddressWithNoCode() public {
        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleHasNoCode.selector);
        host.addModule(address(0xDEAD));
    }

    /// @notice The cap counts QUEUED installs too.
    /// @dev Counting only live ones would let a manager queue thirty and blow
    ///      past the bound the moment a transition applied them all.
    function test_CapCountsPendingAdds() public {
        for (uint256 i; i < host.MAX_MODULES(); ++i) {
            Mod m = _verified();
            vm.prank(manager);
            host.addModule(address(m));
        }

        Mod extra = _verified();
        vm.prank(manager);
        vm.expectRevert(SlotModules.TooManyModules.selector);
        host.addModule(address(extra));

        host.transition();
        assertEq(host.galleryModules().length, host.MAX_MODULES());
    }

    // ─── the swap-and-pop has to keep the index honest ──────────────────────

    function test_RemovingFromTheMiddleKeepsIndicesConsistent() public {
        Mod a = _verified();
        Mod b = _verified();
        Mod c = _verified();
        _install(address(a));
        _install(address(b));
        _install(address(c));

        vm.prank(manager);
        host.removeModule(address(a)); // c gets swapped into slot 0

        assertTrue(host.isModuleInstalled(address(c)), "c survived the swap");
        assertTrue(host.isModuleInstalled(address(b)));
        assertFalse(host.isModuleInstalled(address(a)));

        // And c must still be removable by its NEW index.
        vm.prank(manager);
        host.removeModule(address(c));
        assertFalse(host.isModuleInstalled(address(c)));
        assertEq(host.galleryModules().length, 1);
    }

    // ─── fan-out ────────────────────────────────────────────────────────────

    function test_NotifiesHeadAndEveryGalleryModule() public {
        Mod head = new Mod();
        host.setHead(address(head));
        Mod a = _verified();
        Mod b = _verified();
        _install(address(a));
        _install(address(b));

        address[] memory list = host.modules();
        assertEq(list.length, 3);
        assertEq(list[0], address(head), "head is first");

        host.notify(7);
        assertEq(head.calls(), 1);
        assertEq(a.calls(), 1);
        assertEq(b.calls(), 1);
    }

    function test_ModulesIsEmptyWithNoHeadAndNoGallery() public view {
        assertEq(host.modules().length, 0);
    }

    /// @notice One broken module must not block a buy — still less a
    ///         liquidation.
    function test_ARevertingModuleDoesNotBlockTheOthers() public {
        Hostile bad = new Hostile();
        registry.set(address(bad), true);
        Mod good = _verified();

        _install(address(bad));
        _install(address(good));

        host.notify(1);
        assertEq(good.calls(), 1, "the good module still ran");
    }

    /// @notice A module that burns everything it is given must not starve the
    ///         ones after it — which is what a shared, divided gas budget would
    ///         allow.
    function test_AGasBurnerDoesNotStarveLaterModules() public {
        GasBurner burner = new GasBurner();
        registry.set(address(burner), true);
        Mod good = _verified();

        _install(address(burner));
        _install(address(good));

        host.notify(1);
        assertEq(good.calls(), 1, "later module still got its stipend");
    }

    /// @dev The bound exists so `liquidate` cannot be priced out of existence.
    ///      A full gallery of burners is the worst case; it must stay payable.
    function test_AFullGalleryOfBurnersStaysWithinBlockGas() public {
        for (uint256 i; i < host.MAX_MODULES(); ++i) {
            GasBurner b = new GasBurner();
            registry.set(address(b), true);
            _install(address(b));
        }

        uint256 before = gasleft();
        host.notify(1);
        uint256 used = before - gasleft();

        assertLt(used, 30_000_000, "worst case must fit in a block");
    }

    // ─── the head is shrink-only ────────────────────────────────────────────

    /// @notice `removeModule` accepts the head, which is now the ONLY way to
    ///         change it.
    /// @dev `proposeUtilityUpdate` was retired because it checked only
    ///      `code.length` — an unverified back door into the same hooks
    ///      `addModule` guards. Vacating is all that remains.
    function test_RemoveModuleVacatesTheHead() public {
        Mod h = new Mod();
        host.setHead(address(h));
        assertEq(host.modules().length, 1);

        vm.prank(manager);
        host.removeModule(address(h));

        assertEq(host.modules().length, 0, "head vacated");
        assertFalse(host.isModuleInstalled(address(h)));
    }

    /// @notice And it cannot be refilled — there is no `_setModuleHead`.
    /// @dev A re-added address becomes an ordinary gallery module, and only
    ///      after passing verification. That is the point: every module
    ///      installed from here on is verified, with no exceptions.
    function test_TheHeadCannotBeRefilled() public {
        Mod h = new Mod();
        host.setHead(address(h));
        vm.prank(manager);
        host.removeModule(address(h));

        // Unverified: refused outright.
        vm.prank(manager);
        vm.expectRevert(SlotModules.ModuleNotVerified.selector);
        host.addModule(address(h));

        // Verified: allowed, but into the GALLERY — the head stays empty.
        registry.set(address(h), true);
        _install(address(h));
        assertEq(host.galleryModules().length, 1);
        assertEq(host.modules()[0], address(h), "gallery only; no head above it");
    }

    /// @notice Vacating honours the slot's immutability promise.
    /// @dev A slot that advertised a fixed utility must not be able to drop it,
    ///      any more than it could have swapped it.
    function test_AFrozenHeadCannotBeVacated() public {
        Mod h = new Mod();
        host.setHead(address(h));
        host.freezeHead();

        vm.prank(manager);
        vm.expectRevert("modules frozen");
        host.removeModule(address(h));

        assertEq(host.modules().length, 1, "head survived");
    }

    /// @notice The same promise governs the gallery.
    /// @dev `mutableUtility` always meant "what holding this grants is fixed".
    ///      Gating only the head would keep the letter of that and break it in
    ///      substance, since a gallery install changes exactly the same thing.
    function test_FrozenModulesCannotBeAdded() public {
        Mod m = _verified();
        host.freezeHead();

        vm.prank(manager);
        vm.expectRevert("modules frozen");
        host.addModule(address(m));
    }

    /// @notice Removal stays reachable even when installs are frozen.
    /// @dev Withdrawing behaviour cannot violate a promise that behaviour would
    ///      not change — and removal is the lever for detaching a module found
    ///      to be broken.
    function test_FrozenModulesCanStillBeRemoved() public {
        Mod m = _verified();
        _install(address(m));
        host.freezeHead();

        vm.prank(manager);
        host.removeModule(address(m));
        assertEq(host.galleryModules().length, 0);
    }

    // ─── topics ─────────────────────────────────────────────────────────────

    /// @notice A module is only woken for what it subscribed to. Without this,
    ///         the cost of every occupancy change scales with modules that had
    ///         no interest in it.
    function test_ModuleIsSkippedForTopicsItDidNotWant() public {
        Picky p = new Picky(host.TOPIC_SETTLE());
        registry.set(address(p), true);
        _install(address(p));

        host.notify(host.TOPIC_TRANSFER(), 1);
        assertEq(p.calls(), 0, "not subscribed to transfers");

        host.notify(host.TOPIC_SETTLE(), 1);
        assertEq(p.calls(), 1, "but is woken for settlements");
    }

    /// @notice A module that declares nothing gets everything — which is what
    ///         every module written before topics existed already does.
    function test_ModuleWithoutTopicsGetsEverything() public {
        Mod m = _verified();
        _install(address(m));

        host.notify(host.TOPIC_TRANSFER(), 1);
        host.notify(host.TOPIC_SETTLE(), 1);
        assertEq(m.calls(), 2, "no declaration means all topics");
    }

    /// @notice The subscription is snapshotted, not re-read. A module able to
    ///         widen it later could start charging the occupant gas they never
    ///         agreed to.
    function test_TopicsAreSnapshottedAtInstall() public {
        Picky p = new Picky(host.TOPIC_SETTLE());
        registry.set(address(p), true);
        _install(address(p));

        p.setWant(host.TOPIC_TRANSFER() | host.TOPIC_SETTLE());

        host.notify(host.TOPIC_TRANSFER(), 1);
        assertEq(p.calls(), 0, "widening after install has no effect");
    }

    // ─── lifecycle ──────────────────────────────────────────────────────────

    function test_ModuleIsToldWhenInstalledAndRemoved() public {
        Picky p = new Picky(host.TOPIC_ALL_FOR_TEST());
        registry.set(address(p), true);
        _install(address(p));
        assertEq(p.installs(), 1, "told on install");
        assertEq(p.uninstalls(), 0);

        vm.prank(manager);
        host.removeModule(address(p));
        assertEq(p.uninstalls(), 1, "told on removal");
    }

    /// @notice A module cannot veto its own removal.
    /// @dev The whole point of immediate removal is detaching something
    ///      broken. If a reverting `onUninstall` could block it, the lever
    ///      would fail exactly when it is needed.
    function test_ARevertingModuleCannotBlockItsOwnRemoval() public {
        BadLifecycle bad = new BadLifecycle();
        registry.set(address(bad), true);
        _install(address(bad));
        assertTrue(host.isModuleInstalled(address(bad)), "installed anyway");

        vm.prank(manager);
        host.removeModule(address(bad));
        assertFalse(host.isModuleInstalled(address(bad)), "and removed anyway");
    }

    /// @notice Nor can it block the occupancy transition that installs it.
    /// @dev Installs land inside `_applyPendingUpdates`, which runs during
    ///      `buy`/`sell`/`release`/`liquidate`. A module that could revert
    ///      there would block liquidation.
    function test_ARevertingInstallDoesNotBlockTheTransition() public {
        BadLifecycle bad = new BadLifecycle();
        registry.set(address(bad), true);
        Mod good = _verified();

        vm.startPrank(manager);
        host.addModule(address(bad));
        host.addModule(address(good));
        vm.stopPrank();

        host.transition();   // must not revert

        assertTrue(host.isModuleInstalled(address(good)), "the good one landed");
    }
}
