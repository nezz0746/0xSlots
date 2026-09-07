// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal ENS registry interface
interface IENSRegistry {
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
    function setResolver(bytes32 node, address resolver) external;
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}
