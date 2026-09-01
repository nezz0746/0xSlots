// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Script.sol";

abstract contract BaseScript is Script {
  /// @dev Included to enable compilation of the script without a $MNEMONIC environment variable.
  string internal constant TEST_MNEMONIC =
    "test test test test test test test test test test test junk";

  /// @dev Needed for the deterministic deployments.
  bytes32 internal constant ZERO_SALT = bytes32(0);

  // @dev The chain we are deploying to.
  enum DeployementChain {
    Anvil,
    Sepolia,
    BaseSepolia,
    OptimismSepolia,
    Base,
    Arbitrum,
    Optimism
  }

  // @dev The current chain we are deploying to.
  DeployementChain internal currentChain;

  uint256 internal deployerPrivateKey;

  mapping(DeployementChain => string forkId) public forks;

  /// @dev Initializes the transaction broadcaster like this:
  ///
  /// - If $ETH_FROM is defined, use it.
  /// - Otherwise, derive the broadcaster address from $MNEMONIC.
  /// - If $MNEMONIC is not defined, default to a test mnemonic.
  ///
  /// The use case for $ETH_FROM is to specify the broadcaster key and its address via the command line.
  constructor() {
    forks[DeployementChain.Anvil] = "local";
    forks[DeployementChain.Sepolia] = "sepolia";
    forks[DeployementChain.BaseSepolia] = "basesepolia";
    forks[DeployementChain.OptimismSepolia] = "optsepolia";
    forks[DeployementChain.Base] = "base";
    forks[DeployementChain.Arbitrum] = "arbitrum";
    forks[DeployementChain.Optimism] = "optimism";
  }

  modifier broadcast() {
    vm.startBroadcast(deployerPrivateKey);
    _;
    vm.stopBroadcast();
  }

  modifier broadcastOnOnly(DeployementChain chain) {
    vm.createSelectFork(forks[chain]);
    currentChain = chain;
    _loadSender();
    console2.log("Broadcasting on chain: ", forks[chain]);
    _;
  }

  modifier broadcastOn(DeployementChain chain) {
    vm.createSelectFork(forks[chain]);
    currentChain = chain;
    _loadSender();
    console2.log("Broadcasting on chain: ", forks[chain]);
    vm.startBroadcast(deployerPrivateKey);
    _;
    vm.stopBroadcast();
  }

  /// @dev `startBlock` here is a LOWER BOUND, not the creation block.
  ///
  ///      `block.number` during a broadcast script is the block forge forked at
  ///      when the script began — the transactions are only sent afterwards, so
  ///      on a live chain they land some blocks later. Measured: the collective
  ///      factory recorded 49962971 on base and was actually created in 49962974,
  ///      and 45393268 vs 45393270 on base-sepolia. Anvil shows no skew because
  ///      nothing else is producing blocks.
  ///
  ///      Safe for an indexer startBlock, which is the only consumer — too early
  ///      costs a few empty `eth_getLogs` and can never miss a log. NOT safe as
  ///      "the block this was created in": confirm against the broadcast receipt
  ///      before quoting it as that.
  function _saveDeployment(
    address contractAddress,
    string memory contractName
  ) internal {
    string memory objectName = "export";
    string memory json;

    string memory filePathWithEncodePacked = string(
      abi.encodePacked(
        "./deployments/",
        vm.toString(block.chainid),
        "/",
        contractName,
        ".json"
      )
    );

    json = vm.serializeAddress(objectName, "address", contractAddress);
    json = vm.serializeUint(objectName, "startBlock", block.number);

    vm.writeFile(filePathWithEncodePacked, json);
  }

  function _loadSender() internal {
    if (currentChain == DeployementChain.Anvil) {
      (, deployerPrivateKey) = deriveRememberKey({
        mnemonic: TEST_MNEMONIC,
        index: 0
      });
    } else {
      deployerPrivateKey = vm.envUint("PK");
    }
  }

  function _readDeployment(
    string memory contractName
  ) internal returns (address) {
    string memory filePathWithEncodePacked = string(
      abi.encodePacked(
        "./deployments/",
        vm.toString(block.chainid),
        "/",
        contractName,
        ".json"
      )
    );

    string memory json = vm.readFile(filePathWithEncodePacked);

    return vm.parseJsonAddress(json, ".address");
  }
}
