// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SlotFactory} from "../../SlotFactory.sol";
import {VersionedUUPS} from "../../VersionedUUPS.sol";
import {Versioned} from "../../Versioned.sol";
import {InvalidRecipient} from "../../SlotErrors.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {SlotBoundNFT} from "./SlotBoundNFT.sol";
import {SlotBoundNFTWrapper} from "./SlotBoundNFTWrapper.sol";

/// @notice Everything a collection is fixed with. See {SlotBoundNFT}.
struct CollectionInit {
    string name;
    string symbol;
    uint256 maxSupply;
    IERC20 currency;
    uint256 taxBps;
    uint256 minDepositSeconds;
    address recipient;
    /// May change the rent, on the slots directly. Zero fixes it forever.
    address manager;
    /// Holds the metadata, and nothing else.
    address owner;
}

/// @notice Everything a wrapper is fixed with — which is almost nothing. Each
///         wrap brings its own asset, its own rate and its own mode.
struct WrapperInit {
    string name;
    string symbol;
    /// Takes the wrap fee and nothing else. Zero fixes the wrapper feeless.
    address owner;
    /// A flat fee in wei on {SlotBoundNFTWrapper-wrap}. Must be zero when
    /// `owner` is.
    uint256 wrapFeeWei;
}

/**
 * @title SlotBoundNFTFactory
 * @notice Deploys slot-bound collections. Upgradeable itself; they are not.
 *
 * @dev The asymmetry is the point. This contract is a UUPS proxy so the way
 *      collections are made can improve — a new field, a better default, a
 *      fixed mistake — without redeploying anything or asking permission.
 *
 *      A collection is a plain `new`, and permanently so. Behind a beacon,
 *      whoever held its key could rewrite what `ownerOf` means for tokens
 *      people already hold, and could make {_sync} revert, which under `strict`
 *      turns every slot in that collection into a permanent hold. Immutable,
 *      the code a minter read is the code that runs for as long as they hold.
 *
 *      So an upgrade here changes what the NEXT collection is, never what an
 *      existing one does.
 */
contract SlotBoundNFTFactory is VersionedUUPS {
    error NotAdmin();

    /// @inheritdoc Versioned
    function version() public pure virtual override returns (uint64) {
        return 3;
    }

    /// @notice The slot factory every collection creates its slots through.
    /// @dev Fixed for this proxy: collections already deployed hold their own
    ///      reference, so changing it here would only split the protocol.
    SlotFactory public slotFactory;

    /// @notice May upgrade this factory.
    address public admin;

    mapping(address => bool) public isCollection;
    uint256 public collectionCount;

    event CollectionCreated(
        address indexed collection,
        address indexed creator,
        address indexed recipient,
        address currency,
        uint256 maxSupply
    );
    event AdminTransferred(address indexed from, address indexed to);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function initialize(address admin_, SlotFactory slotFactory_)
        external
        initializer
    {
        if (admin_ == address(0)) revert InvalidRecipient();
        if (address(slotFactory_) == address(0)) revert InvalidRecipient();
        admin = admin_;
        slotFactory = slotFactory_;
        emit AdminTransferred(address(0), admin_);
    }

    /**
     * @notice Deploy a collection. Its terms are fixed from this moment.
     *
     * @dev One creation function, and a struct rather than ten arguments — a
     *      new field goes in `CollectionInit`, never into a suffixed second
     *      creator that splits every caller and every indexer handler in two.
     *
     *      The collection validates its own terms in its constructor, so this
     *      re-checks nothing. One validation, one authority.
     */
    function createCollection(CollectionInit calldata init)
        external
        returns (address collection)
    {
        // CREATE2, salted with the chain id and the collection's index — the
        // same reasoning as `SlotFactory.createSlot`, written out in full
        // there. The constructor arguments below do NOT make the address
        // unique on their own: under plain `new` they are invisible to it
        // entirely, and under CREATE2 two identical collections created on
        // two chains would still share one address without `block.chainid`.
        collection = address(
            new SlotBoundNFT{
                salt: keccak256(abi.encode(block.chainid, collectionCount))
            }(
                slotFactory,
                init.name,
                init.symbol,
                init.maxSupply,
                init.currency,
                init.taxBps,
                init.minDepositSeconds,
                init.recipient,
                init.manager,
                init.owner
            )
        );

        isCollection[collection] = true;
        unchecked {
            ++collectionCount;
        }
        emit CollectionCreated(
            collection,
            msg.sender,
            init.recipient,
            address(init.currency),
            init.maxSupply
        );
    }

    // ─── wrappers ───────────────────────────────────────────────────────────
    //
    // Appended, never inserted: this factory is live and slots 0-3 are spoken
    // for by `slotFactory`, `admin`, `isCollection`, `collectionCount`.
    //
    // Collections are a plain `new` and permanently so — the reasoning is at
    // the top of this file and it has not changed. Wrappers take the opposite
    // trade knowingly: they hold OTHER PEOPLE'S escrowed assets, so this
    // beacon's key can rewrite `withdraw` as well as `ownerOf`. Accepted, and
    // recorded in the design spec rather than mitigated here.

    /// @notice The beacon every wrapper proxy points at.
    UpgradeableBeacon public wrapperBeacon;

    mapping(address => bool) public isWrapper;
    uint256 public wrapperCount;

    event WrapperCreated(
        address indexed wrapper,
        address indexed creator,
        address indexed owner,
        string name,
        string symbol,
        uint256 wrapFeeWei
    );
    event WrapperBeaconUpgraded(address indexed newImplementation);

    /// @notice Stand up the wrapper beacon on an already-deployed factory.
    ///
    /// @dev Cannot live in `initialize`, which already ran on the live proxy.
    ///      `onlyAdmin` is load-bearing: a `reinitializer` on an external
    ///      function is otherwise callable by anyone, and the caller would be
    ///      choosing the implementation behind every wrapper.
    function initializeWrappers(
        address wrapperImplementation
    ) external reinitializer(2) onlyAdmin {
        if (wrapperImplementation == address(0)) revert InvalidRecipient();
        wrapperBeacon = new UpgradeableBeacon(
            wrapperImplementation,
            address(this)
        );
    }

    /// @notice Deploy a wrapper. Anyone may; it has no privileged party.
    function createWrapper(
        WrapperInit calldata init
    ) external returns (address wrapper) {
        bytes memory initData = abi.encodeCall(
            SlotBoundNFTWrapper.initialize,
            (init.name, init.symbol, slotFactory, init.owner, init.wrapFeeWei)
        );
        // CREATE2, salted with the chain id and the wrapper's index — the same
        // reasoning as `SlotFactory.createSlot`, written out in full there. The
        // literal is a domain separator: this counter and `collectionCount`
        // both start at zero, and while the differing initcode already parts
        // the two addresses, a reader should not have to derive that.
        wrapper = address(
            new BeaconProxy{
                salt: keccak256(
                    abi.encode(block.chainid, "wrapper", wrapperCount)
                )
            }(address(wrapperBeacon), initData)
        );

        isWrapper[wrapper] = true;
        unchecked {
            ++wrapperCount;
        }
        emit WrapperCreated(
            wrapper,
            msg.sender,
            init.owner,
            init.name,
            init.symbol,
            init.wrapFeeWei
        );
    }

    /// @dev Read the note above `wrapperBeacon` before using this.
    function upgradeWrapperBeacon(address newImplementation) external onlyAdmin {
        wrapperBeacon.upgradeTo(newImplementation);
        emit WrapperBeaconUpgraded(newImplementation);
    }

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert InvalidRecipient();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
