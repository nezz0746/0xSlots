// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SlotFactory} from "../../SlotFactory.sol";
import {VersionedUUPS} from "../../VersionedUUPS.sol";
import {Versioned} from "../../Versioned.sol";
import {InvalidRecipient} from "../../SlotErrors.sol";
import {SlotBoundNFT} from "./SlotBoundNFT.sol";

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
        return 2;
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

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert InvalidRecipient();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
