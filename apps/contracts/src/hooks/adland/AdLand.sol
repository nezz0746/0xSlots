// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDescribedHook, HookDescriptor} from "../../IDescribedHook.sol";
import {Versioned} from "../../Versioned.sol";
import {AdLandCreatives} from "./AdLandCreatives.sol";
import {AdLandLens} from "./AdLandLens.sol";
import {AdLandRegistry} from "./AdLandRegistry.sol";

/**
 * @title AdLand
 * @notice AdLand on the V2 slot surface: the creative, the key that names a
 *         slot, and one call that reads both.
 *
 * @dev ── One contract, three roles ────────────────────────────────────────
 *
 *      Called BY a slot it is that slot's hook (`AdLandCreatives`). Called
 *      directly it is the registry (`AdLandRegistry`) and the lens
 *      (`AdLandLens`). V1's `AdModule` merged the same three for the same
 *      reason: nothing is circular because nothing has to be discovered — the
 *      address is a constant in the SDK — and merging is what makes the lens
 *      cheap, because the creative is this contract's own storage rather than a
 *      cross-contract call.
 *
 *      V1's `MetadataModule` / `AdModule` split is gone. That split was an
 *      upgrade seam, not a design: `AdModule` inherited `MetadataModule` so the
 *      live proxy's slot order was guaranteed by the compiler. This is a fresh
 *      deployment with no proxy to preserve.
 *
 *      Everything here is what is left once the three concerns are elsewhere:
 *      construction, identity, and who may replace the code.
 */
contract AdLand is AdLandCreatives, AdLandLens, AdLandRegistry, IDescribedHook {
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    function descriptors() external pure returns (HookDescriptor[] memory d) {
        d = new HookDescriptor[](1);
        d[0] = HookDescriptor({
            family: FAMILY,
            version: 1,
            // Nothing to configure: this hook behaves identically for every
            // slot pointing at it, so there is no per-slot parameter for a
            // client to decode.
            data: "",
            metadataURI: ""
        });
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
