// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    MulticallUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {Versioned} from "../../utils/Versioned.sol";
import {AdLandLens} from "./AdLandLens.sol";
import {AdLandRegistry} from "./AdLandRegistry.sol";
import {SlotLens} from "../../periphery/lens/SlotLens.sol";

/**
 * @title AdLand
 * @notice AdLand on the V2 slot surface: the creative, the key that names a
 *         slot, and one call that reads both.
 *
 * @dev ── One contract, three roles ────────────────────────────────────────
 *
 *      Called BY a slot it is that slot's module (`AdLandCreatives`). Called
 *      directly it is the registry (`AdLandRegistry`) and the lens
 *      (`AdLandLens`). Nothing is circular because nothing has to be discovered
 *      — the address is a constant in the SDK — and merging the three is what
 *      makes the lens cheap, because the creative is this contract's own storage
 *      rather than a cross-contract call.
 *
 *      Everything here is what is left once the three concerns are elsewhere:
 *      construction, identity, and who may replace the code.
 */
contract AdLand is AdLandLens, AdLandRegistry, MulticallUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(SlotLens slotLens) AdLandLens(slotLens) {}

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
