export const slotCollectiveFactoryAbi = [
  {
    "type": "function",
    "name": "admin",
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
    "name": "beacon",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract UpgradeableBeacon"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createManager",
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
            "name": "policyManagers",
            "type": "address[]",
            "internalType": "address[]"
          },
          {
            "name": "utilityManagers",
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
    "outputs": [
      {
        "name": "manager",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isSlotCollective",
    "inputs": [
      {
        "name": "",
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
    "name": "managers",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
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
    "type": "event",
    "name": "SlotCollectiveDeployed",
    "inputs": [
      {
        "name": "manager",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "admin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "deployer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AddressEmptyCode",
    "inputs": [
      {
        "name": "target",
        "type": "address",
        "internalType": "address"
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
    "name": "AlreadyInitialized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC1967InvalidImplementation",
    "inputs": [
      {
        "name": "implementation",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC1967NonPayable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FailedCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ImplementationRequired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAdmin",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UUPSUnauthorizedCallContext",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UUPSUnsupportedProxiableUUID",
    "inputs": [
      {
        "name": "slot",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  }
] as const;
