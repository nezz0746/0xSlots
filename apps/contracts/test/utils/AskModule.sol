// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotModule} from "../../src/interfaces/ISlotModule.sol";
import {ModuleFee} from "../../src/types/SlotTypes.sol";

/// @dev Test-only: a module's scopes and fee declared together, as most test
///      modules find it easiest to write them.
struct Ask {
    uint16 scopes;
    uint16 feeBps;
    address feeRecipient;
}

/// @dev Test-only base. A mock implements `_ask` once; this answers the
///      slot's two reads from it.
abstract contract AskModule is ISlotModule {
    function _ask(bytes calldata settings) internal view virtual returns (Ask memory);

    function scopes(bytes calldata settings) external view returns (uint16) {
        return _ask(settings).scopes;
    }

    function fee(bytes calldata settings) external view returns (ModuleFee memory f) {
        Ask memory a = _ask(settings);
        f.bps = a.feeBps;
        f.recipient = a.feeRecipient;
    }
}
