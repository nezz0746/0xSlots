// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotCollective} from "./SlotCollective.sol";
import {Versioned} from "../Versioned.sol";
import {VersionedUUPS} from "../VersionedUUPS.sol";

/// @title SlotCollectiveFactory — deploys SlotCollectives behind one upgradeable beacon
///
/// @notice A `SlotCollective` is a 0xSplits PushSplit wearing a role-gated control
///         panel: it receives a slot's tax AND governs that slot's tax
///         and hook. Deploying one by hand means getting a warehouse
///         address, a validated split, three role arrays and a self-bound owner
///         right in a single constructor call, on every chain, every time.
///
///         This mints them instead, from one implementation, with the same
///         upgrade path `SlotFactory` gives slots.
///
/// @dev ── SHAPE, AND WHY IT MATCHES SlotFactory ───────────────────────────────
///      UUPS proxy for the factory, `UpgradeableBeacon` for the collectives. The
///      protocol already has exactly this arrangement one layer down, and a
///      second pattern for the same job would mean two upgrade runbooks and two
///      sets of assumptions about who can move what.
///
///      ── WHAT A BEACON MEANS HERE, WHICH IS NOT WHAT IT MEANS FOR SLOTS ─────
///      Read this before shipping it. A slot holds a deposit; a collective holds
///      *revenue* and is the named `recipient` of every slot pointed at it. One
///      `upgradeBeacon` call rewrites the code of every collective at once — so
///      whoever holds `admin` here can, in one transaction, change how every
///      collective on the chain distributes money that is not theirs.
///
///      That is the same authority the slot beacon already carries, which is why
///      this is a considered trade rather than an oversight. But slots and
///      collectives are not equally attractive targets, and if these are ever
///      handed to third parties the honest answer may be immutable clones
///      (EIP-1167) with no beacon at all. `createCollective` would be unchanged;
///      only `_deployCollective` and the beacon plumbing would go.
///
///      ── WHY MANAGERS ARE PROXIES AT ALL ───────────────────────────────────
///      `SplitWalletV2` keeps `SPLITS_WAREHOUSE`, `NATIVE_TOKEN` and `FACTORY`
///      in `immutable`s, which live in the implementation's runtime bytecode and
///      are therefore read correctly through a delegatecall. The first two are
///      chain-wide constants and want to be shared. The third would have been a
///      problem — it gates the inherited `initialize` on `msg.sender == FACTORY`
///      — except `SlotCollective.initializeCollective` does that work itself and never
///      touches it. See the constructor note over there.
contract SlotCollectiveFactory is VersionedUUPS {

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 3;
    }

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error NotAdmin();
    error AdminRequired();
    error ImplementationRequired();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @dev `admin` is the collective's own `DEFAULT_ADMIN_ROLE` holder, which is
    ///      NOT this factory's admin. Indexed because "which collectives can this
    ///      address govern" is the question a UI actually asks, and it cannot be
    ///      answered from the split or from role events alone.
    event SlotCollectiveDeployed(
        address indexed collective,
        address indexed admin,
        address indexed deployer
    );
    event BeaconUpgraded(address indexed newImplementation);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice The beacon every collective proxy points at.
    UpgradeableBeacon public beacon;

    /// @notice Can upgrade this factory and the beacon.
    address public admin;


    /// @notice Managers deployed here. The provenance check a slot creator needs
    ///         before naming an address as both `recipient` and `manager`.
    mapping(address => bool) public isSlotCollective;

    /// @notice Deployed collectives, in order, so a UI can enumerate without
    ///         logs.
    address[] public collectives;

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════



    /// @notice Initialize the factory (called once, through its proxy).
    /// @param _admin Upgrades this factory and the beacon.
    /// @param _collectiveImplementation A deployed `SlotCollective`, constructed with
    ///        this chain's canonical `SplitsWarehouse`.
    function initialize(
        address _admin,
        address _collectiveImplementation
    ) external initializer {
        if (_admin == address(0)) revert AdminRequired();
        if (_collectiveImplementation.code.length == 0)
            revert ImplementationRequired();

        admin = _admin;
        // The genesis admin, emitted so an indexer can build the whole custody
        // chain from logs alone rather than reading storage for the first link.
        emit AdminTransferred(address(0), _admin);
        // Owned by this factory from the start, exactly as `SlotFactory` does
        // it — the factory must be the beacon's owner for `upgradeBeacon` to
        // work at all.
        beacon = new UpgradeableBeacon(_collectiveImplementation, address(this));
    }


    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT
    // ═══════════════════════════════════════════════════════════

    /// @notice Deploy a collective.
    ///
    /// @dev Permissionless. A collective is only powerful over slots that have
    ///      NAMED it as its `manager` — set at creation and never moved — so
    ///      minting one grants nothing by itself. Gating this would only stop
    ///      people from creating their own payout contracts.
    ///
    ///      The split and roles are validated inside `initializeCollective`, in the
    ///      proxy's constructor, so a collective is never briefly live with an
    ///      empty split or no admin.
    ///
    /// @param split Initial payout configuration. Must have recipients and a
    ///        non-zero total allocation.
    /// @param roles Initial role assignment. `roles.admin` is required.
    /// @return collective The deployed collective's address.
    function createCollective(
        SplitV2Lib.Split calldata split,
        SlotCollective.InitialRoles calldata roles
    ) external returns (address collective) {
        collective = _deployCollective(split, roles);
    }

    /// @notice How many collectives this factory has deployed.
    function collectiveCount() external view returns (uint256) {
        return collectives.length;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /// @notice Point every collective at new code.
    /// @dev Read the beacon note at the top of this contract before using it.
    function upgradeBeacon(address newImplementation) external onlyAdmin {
        beacon.upgradeTo(newImplementation);
        emit BeaconUpgraded(newImplementation);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert AdminRequired();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _deployCollective(
        SplitV2Lib.Split calldata split,
        SlotCollective.InitialRoles calldata roles
    ) internal returns (address collective) {
        bytes memory initData = abi.encodeCall(
            SlotCollective.initializeCollective,
            (split, roles)
        );
        // CREATE2, salted with the chain id and the collective's index. Plain
        // `new` derives the address from `keccak(rlp(factory, nonce))` alone,
        // and this factory sits at ONE address across chains — so collective
        // #N was the same address on every chain it was deployed to. The
        // index makes them distinct within a chain, `block.chainid` across
        // chains; the initcode alone would not, since `(beacon, initData)`
        // can be byte-identical on two chains. Same reasoning as
        // `SlotFactory.createSlot`, written out in full there.
        collective = address(
            new BeaconProxy{
                salt: keccak256(abi.encode(block.chainid, collectives.length))
            }(address(beacon), initData)
        );

        isSlotCollective[collective] = true;
        collectives.push(collective);

        emit SlotCollectiveDeployed(collective, roles.admin, msg.sender);
    }
}
