// Generated from src/collectives/SlotCollective.sol by scripts/sync-abis.mjs. Do not edit.
export const slotCollectiveAbi = [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "splitsWarehouse",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "DEFAULT_ADMIN_ROLE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "FACTORY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "NATIVE_TOKEN",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "POLICY_MANAGER_ROLE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "SPLITS_WAREHOUSE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ISplitsWarehouse"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "SPLIT_MANAGER_ROLE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "TAX_MANAGER_ROLE",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "cancelAllProposals",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract IManagedSlot"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "cancelHookProposal",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract IManagedSlot"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "cancelTaxProposal",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract IManagedSlot"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "distribute",
      "inputs": [
        {
          "name": "_split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        },
        {
          "name": "_token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_distributor",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "distribute",
      "inputs": [
        {
          "name": "_split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        },
        {
          "name": "_token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_distributeAmount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "_performWarehouseTransfer",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "_distributor",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "eip712Domain",
      "inputs": [],
      "outputs": [
        {
          "name": "fields",
          "type": "bytes1",
          "internalType": "bytes1"
        },
        {
          "name": "name",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "version",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "chainId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "verifyingContract",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "salt",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "extensions",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "execCalls",
      "inputs": [
        {
          "name": "_calls",
          "type": "tuple[]",
          "internalType": "struct Wallet.Call[]",
          "components": [
            {
              "name": "to",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "value",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "data",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "returnData",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "getRoleAdmin",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getSplitBalance",
      "inputs": [
        {
          "name": "_token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "splitBalance",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "warehouseBalance",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "grantRole",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "hasRole",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "initialize",
      "inputs": [
        {
          "name": "_split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        },
        {
          "name": "_owner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "initializeManager",
      "inputs": [
        {
          "name": "split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        },
        {
          "name": "roles",
          "type": "tuple",
          "internalType": "struct SlotCollective.InitialRoles",
          "components": [
            {
              "name": "admin",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "taxManagers",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "hookManagers",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "splitManagers",
              "type": "address[]",
              "internalType": "address[]"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "isValidSignature",
      "inputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "onERC1155BatchReceived",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "onERC1155Received",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "onERC721Received",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "paused",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "proposeHook",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract IManagedSlot"
        },
        {
          "name": "newHook",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "proposeTax",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract IManagedSlot"
        },
        {
          "name": "newPct",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "renounceRole",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "callerConfirmation",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "replaySafeHash",
      "inputs": [
        {
          "name": "hash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "revokeRole",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setPaused",
      "inputs": [
        {
          "name": "_paused",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setSplit",
      "inputs": [
        {
          "name": "split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "splitHash",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "supportsInterface",
      "inputs": [
        {
          "name": "interfaceId",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sweep",
      "inputs": [
        {
          "name": "slots",
          "type": "address[]",
          "internalType": "contract IManagedSlot[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "updateBlockNumber",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "updateSplit",
      "inputs": [
        {
          "name": "_split",
          "type": "tuple",
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "version",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "withdrawFromWarehouse",
      "inputs": [
        {
          "name": "_token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "EIP712DomainChanged",
      "inputs": [],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ExecCalls",
      "inputs": [
        {
          "name": "calls",
          "type": "tuple[]",
          "indexed": false,
          "internalType": "struct Wallet.Call[]",
          "components": [
            {
              "name": "to",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "value",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "data",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Initialized",
      "inputs": [
        {
          "name": "version",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "oldOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PendingUpdatesCancelled",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoleAdminChanged",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "previousAdminRole",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "newAdminRole",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoleGranted",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "account",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "sender",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoleRevoked",
      "inputs": [
        {
          "name": "role",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "account",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "sender",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SetPaused",
      "inputs": [
        {
          "name": "paused",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SplitDistributed",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "distributor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SplitUpdated",
      "inputs": [
        {
          "name": "_split",
          "type": "tuple",
          "indexed": false,
          "internalType": "struct SplitV2Lib.Split",
          "components": [
            {
              "name": "recipients",
              "type": "address[]",
              "internalType": "address[]"
            },
            {
              "name": "allocations",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "totalAllocation",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "distributionIncentive",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "UpdateCancelRelayed",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "kind",
          "type": "uint8",
          "indexed": true,
          "internalType": "enum Dimension"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "UpdateRelayed",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "kind",
          "type": "uint8",
          "indexed": true,
          "internalType": "enum Dimension"
        },
        {
          "name": "value",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AccessControlBadConfirmation",
      "inputs": []
    },
    {
      "type": "error",
      "name": "AccessControlUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "neededRole",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "AdminRequired",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptySplit",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidCalldataForEOA",
      "inputs": [
        {
          "name": "call",
          "type": "tuple",
          "internalType": "struct Wallet.Call",
          "components": [
            {
              "name": "to",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "value",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "data",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidInitialization",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidShortString",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidSplit",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidSplit_LengthMismatch",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidSplit_TotalAllocationMismatch",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotInitializing",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OwnershipIsSelfBound",
      "inputs": []
    },
    {
      "type": "error",
      "name": "Paused",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "StringTooLong",
      "inputs": [
        {
          "name": "str",
          "type": "string",
          "internalType": "string"
        }
      ]
    },
    {
      "type": "error",
      "name": "Unauthorized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnauthorizedInitializer",
      "inputs": []
    }
  ] as const;
