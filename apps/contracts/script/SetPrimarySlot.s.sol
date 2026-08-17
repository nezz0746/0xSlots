// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseScript, console2} from "./Base.s.sol";
import {AdModule} from "../src/modules/AdModule.sol";

/**
 * @title SetPrimarySlot
 * @notice Name the slot an SDK resolves when the publisher named none.
 *
 * @dev Separate from the upgrade deliberately. An upgrade that lands and a key
 *      that resolves are two different facts, and running them as one
 *      transaction would leave no moment at which the first could be checked
 *      alone. It is also the only write here that is immediate: `setSlot` waits
 *      `CHANGE_DELAY` when a key ALREADY has a value, so this is a one-off and
 *      every later repoint is a two-day, publicly visible affair.
 *
 *      Idempotent by accident rather than design — running it twice on a key
 *      that is already set proposes a change instead of reverting, which is why
 *      it prints what it found before writing.
 *
 *      Run: forge script script/SetPrimarySlot.s.sol \
 *             --sig 'setChain(uint8,address)' <idx> <slot> --broadcast
 *           (idx: 2 = BaseSepolia, 4 = Base)
 */
contract SetPrimarySlot is BaseScript {
    function setChain(uint8 chainIdx, address slot) external {
        _run(DeployementChain(chainIdx), "primary", slot);
    }

    /// @notice Name any key, not just `primary`.
    /// @dev The key is a plain string here and `bytes32` on the contract, and
    ///      the conversion is a right-pad — the same one the SDK does locally
    ///      so it never has to ask the chain what a name encodes to. Anything
    ///      over 31 bytes would silently truncate, so it does not.
    function setKey(uint8 chainIdx, string calldata key, address slot)
        external
    {
        require(bytes(key).length <= 31, "key too long for bytes32");
        _run(DeployementChain(chainIdx), key, slot);
    }

    function _run(DeployementChain chain, string memory key, address slot)
        internal
        broadcastOn(chain)
    {
        bytes32 k = bytes32(bytes(key));
        AdModule mm = AdModule(_readDeployment("MetadataModule"));

        console2.log("=== SetPrimarySlot ===");
        console2.log("module ", address(mm));
        console2.log("key    ", key);
        console2.log("before ", mm.slotOf(k));
        console2.log("target ", slot);

        require(slot.code.length > 0, "slot is not a contract");

        mm.setSlot(k, slot);

        address now_ = mm.slotOf(k);
        console2.log("after  ", now_);
        // A key that already had a value goes to `pendingOf` instead, so this
        // is the difference between "set" and "proposed" — worth failing on,
        // because the two look identical in a transaction receipt.
        require(now_ == slot, "not live: a change was proposed, not applied");

        console2.log("=== Done ===");
    }
}
