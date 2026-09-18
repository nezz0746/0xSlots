// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HookConfigStore
 * @notice Configuration larger than a slot's `bytes32`, kept by the hook and
 *         referenced from the slot by its hash.
 *
 * @dev A slot stores `HookTerms.config` as one word and hands it to every
 *      callback. A hook needing more registers the full configuration here and
 *      the slot carries only `keccak256(config)`: callbacks stay one word, and
 *      the hook reads the bytes when it needs them.
 *
 *      Content-addressed, so a registered configuration can never change under
 *      a slot. Changing it means registering new bytes and proposing the new id
 *      through the slot's terms, which keeps the mutability gate and the delay.
 *
 *      Registration is permissionless and idempotent. Anyone can register any
 *      bytes, and registering the same bytes twice is the same id.
 *
 *      ERC-7201 storage, so an upgradeable hook can inherit this without
 *      disturbing its own layout.
 */
abstract contract HookConfigStore {
    /// @custom:storage-location erc7201:slots.hook.config.store
    struct ConfigStore {
        mapping(bytes32 id => bytes config) configOf;
    }

    // keccak256(abi.encode(uint256(keccak256("slots.hook.config.store")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CONFIG_STORE =
        0x78d493b50518107e182071aab3728ccac4e9fdffb630d82e2022123280230100;

    event HookConfigRegistered(bytes32 indexed id, bytes config);

    error UnknownHookConfig(bytes32 id);
    error EmptyHookConfig();

    function _configStore() private pure returns (ConfigStore storage $) {
        assembly ("memory-safe") {
            $.slot := CONFIG_STORE
        }
    }

    /// @notice Register `config` and return the id a slot stores for it.
    function registerHookConfig(bytes calldata config) external returns (bytes32 id) {
        if (config.length == 0) revert EmptyHookConfig();
        id = keccak256(config);
        ConfigStore storage $ = _configStore();
        if ($.configOf[id].length != 0) return id;
        $.configOf[id] = config;
        emit HookConfigRegistered(id, config);
    }

    /// @notice The configuration registered under `id`. Empty if none.
    function hookConfigOf(bytes32 id) external view returns (bytes memory) {
        return _configStore().configOf[id];
    }

    /// @notice Whether `id` names a registered configuration.
    function isHookConfigRegistered(bytes32 id) public view returns (bool) {
        return _configStore().configOf[id].length != 0;
    }

    /// @dev The configuration under `id`, or a revert. Call from
    ///      `validateHookConfig` so a slot cannot attach an id nobody registered.
    function _hookConfig(bytes32 id) internal view returns (bytes memory config) {
        config = _configStore().configOf[id];
        if (config.length == 0) revert UnknownHookConfig(id);
    }
}
