// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SettingsStore
 * @notice Configuration larger than a slot's `bytes32`, kept by the module and
 *         referenced from the slot by its hash.
 *
 * @dev A slot stores `ModuleTerms.settings` as one word and hands it to every
 *      callback. A module needing more registers the full configuration here and
 *      the slot carries only `keccak256(settings)`: callbacks stay one word, and
 *      the module reads the bytes when it needs them.
 *
 *      Content-addressed, so a registered configuration can never change under
 *      a slot. Changing it means registering new bytes and proposing the new id
 *      through the slot's terms, which keeps the mutability gate and the delay.
 *
 *      Registration is permissionless and idempotent. Anyone can register any
 *      bytes, and registering the same bytes twice is the same id.
 *
 *      ERC-7201 storage, so an upgradeable module can inherit this without
 *      disturbing its own layout.
 */
abstract contract SettingsStore {
    /// @custom:storage-location erc7201:slots.module.settings
    struct SettingsStorage {
        mapping(bytes32 id => bytes settings) settingsOf;
    }

    // keccak256(abi.encode(uint256(keccak256("slots.module.settings")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant SETTINGS_STORE =
        0x7c038ec424105ec1a5fb3f9c6639a88dad1ddf8f19d10f439393b53e75062100;

    event SettingsRegistered(bytes32 indexed id, bytes settings);

    error UnknownSettings(bytes32 id);
    error EmptySettings();

    function _settingsStorage() private pure returns (SettingsStorage storage $) {
        assembly ("memory-safe") {
            $.slot := SETTINGS_STORE
        }
    }

    /// @notice Register `settings` and return the id a slot stores for it.
    function registerSettings(bytes calldata settings) external returns (bytes32 id) {
        if (settings.length == 0) revert EmptySettings();
        id = keccak256(settings);
        SettingsStorage storage $ = _settingsStorage();
        if ($.settingsOf[id].length != 0) return id;
        $.settingsOf[id] = settings;
        emit SettingsRegistered(id, settings);
    }

    /// @notice The configuration registered under `id`. Empty if none.
    function settingsById(bytes32 id) external view returns (bytes memory) {
        return _settingsStorage().settingsOf[id];
    }

    /// @notice Whether `id` names a registered configuration.
    function areSettingsRegistered(bytes32 id) public view returns (bool) {
        return _settingsStorage().settingsOf[id].length != 0;
    }

    /// @dev The configuration under `id`, or a revert. Call from
    ///      `checkSettings` so a slot cannot attach an id nobody registered.
    function _settingsById(bytes32 id) internal view returns (bytes memory settings) {
        settings = _settingsStorage().settingsOf[id];
        if (settings.length == 0) revert UnknownSettings(id);
    }
}
