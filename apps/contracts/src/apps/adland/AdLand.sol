// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MulticallUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {Versioned} from "../../utils/Versioned.sol";
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
 *      Called BY a slot it is that slot's app (`AdLandCreatives`). Called
 *      directly it is the registry (`AdLandRegistry`) and the lens
 *      (`AdLandLens`). Nothing is circular because nothing has to be discovered
 *      — the address is a constant in the SDK — and merging the three is what
 *      makes the lens cheap, because the creative is this contract's own storage
 *      rather than a cross-contract call.
 *
 *      Everything here is what is left once the three concerns are elsewhere:
 *      construction, identity, and who may replace the code.
 */
contract AdLand is
    AdLandLens,
    AdLandRegistry,
    MulticallUpgradeable
{
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    /**
     * @notice What this app claims to be, and what it takes.
     *
     * @dev Three values travelling together as one {AdConfig}, which is more
     *      than a `bytes32` holds — so they are registered with
     *      `registerSettings` and the slot's word is their id. The schema says
     *      so with `"x-settings-encoding":"registered"`, which is the difference a
     *      client cannot infer: an app with one field may register it too.
     *
     *      Optional as a whole. A slot that leaves the word empty is an
     *      ordinary advertising slot with no window, no key and `Open`
     *      moderation — not an unconfigured one.
     *
     *      The tenure field is the rule's own, declared by {MinimumTenure} with
     *      its bounds and its `x-semantic` tag, so an application recognises the
     *      behaviour here exactly as it does on {MinimumTenureApp} without
     *      learning that AdLand hosts it.
     *
     *      `pure`, so it says what the app CAN enforce. What a given slot is
     *      configured with is `Slot.appTerms().settings` and the bytes registered
     *      behind it.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
