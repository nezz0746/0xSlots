export const SlotFactoryAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "UPGRADE_INTERFACE_VERSION",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "admin",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "beacon",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract UpgradeableBeacon",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectAll",
    inputs: [
      {
        name: "slots",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [
      {
        name: "collected",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createSlot",
    inputs: [
      {
        name: "recipient",
        type: "address",
        internalType: "address",
      },
      {
        name: "currency",
        type: "address",
        internalType: "contract IERC20",
      },
      {
        name: "config",
        type: "tuple",
        internalType: "struct SlotConfig",
        components: [
          {
            name: "mutableTax",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutableUtility",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutablePolicy",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "manager",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "initParams",
        type: "tuple",
        internalType: "struct SlotInitParams",
        components: [
          {
            name: "taxPercentage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "utility",
            type: "address",
            internalType: "address",
          },
          {
            name: "liquidationBountyBps",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minDepositSeconds",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "occupancyPolicy",
            type: "address",
            internalType: "address",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "slot",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createSlots",
    inputs: [
      {
        name: "recipient",
        type: "address",
        internalType: "address",
      },
      {
        name: "currency",
        type: "address",
        internalType: "contract IERC20",
      },
      {
        name: "config",
        type: "tuple",
        internalType: "struct SlotConfig",
        components: [
          {
            name: "mutableTax",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutableUtility",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutablePolicy",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "manager",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "initParams",
        type: "tuple",
        internalType: "struct SlotInitParams",
        components: [
          {
            name: "taxPercentage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "utility",
            type: "address",
            internalType: "address",
          },
          {
            name: "liquidationBountyBps",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minDepositSeconds",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "occupancyPolicy",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "count",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "slots",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emitEvent",
    inputs: [
      {
        name: "eventType",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "implementation",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "_admin",
        type: "address",
        internalType: "address",
      },
      {
        name: "_slotImplementation",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isModuleVerified",
    inputs: [
      {
        name: "_utility",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSlot",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isUtilityVerified",
    inputs: [
      {
        name: "_utility",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "proxiableUUID",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerSlots",
    inputs: [
      {
        name: "slots",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setModuleVerified",
    inputs: [
      {
        name: "_utility",
        type: "address",
        internalType: "address",
      },
      {
        name: "verified",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPolicyVerified",
    inputs: [
      {
        name: "_policy",
        type: "address",
        internalType: "address",
      },
      {
        name: "verified",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setUtilityVerified",
    inputs: [
      {
        name: "_utility",
        type: "address",
        internalType: "address",
      },
      {
        name: "verified",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferAdmin",
    inputs: [
      {
        name: "newAdmin",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "upgradeBeacon",
    inputs: [
      {
        name: "newImplementation",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "upgradeToAndCall",
    inputs: [
      {
        name: "newImplementation",
        type: "address",
        internalType: "address",
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "verifiedModules",
    inputs: [
      {
        name: "_utility",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifiedPolicies",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifiedUtilities",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AdminTransferred",
    inputs: [
      {
        name: "previousAdmin",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newAdmin",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BeaconUpgraded",
    inputs: [
      {
        name: "newImplementation",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ModuleVerified",
    inputs: [
      {
        name: "utility",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "verified",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "name",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "version",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "feeBps",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "moduleURI",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PolicyVerified",
    inputs: [
      {
        name: "policy",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "verified",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "name",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "version",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "policyURI",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SlotDeployed",
    inputs: [
      {
        name: "slot",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "recipient",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "currency",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "config",
        type: "tuple",
        indexed: false,
        internalType: "struct SlotConfig",
        components: [
          {
            name: "mutableTax",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutableUtility",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "mutablePolicy",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "manager",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "initParams",
        type: "tuple",
        indexed: false,
        internalType: "struct SlotInitParams",
        components: [
          {
            name: "taxPercentage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "utility",
            type: "address",
            internalType: "address",
          },
          {
            name: "liquidationBountyBps",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minDepositSeconds",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "occupancyPolicy",
            type: "address",
            internalType: "address",
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SlotEvent",
    inputs: [
      {
        name: "slot",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "eventType",
        type: "uint8",
        indexed: true,
        internalType: "uint8",
      },
      {
        name: "data",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Upgraded",
    inputs: [
      {
        name: "implementation",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AddressEmptyCode",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "AlreadyInitialized",
    inputs: [],
  },
  {
    type: "error",
    name: "ERC1967InvalidImplementation",
    inputs: [
      {
        name: "implementation",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC1967NonPayable",
    inputs: [],
  },
  {
    type: "error",
    name: "FailedCall",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidConfig_ManagerMustBeZero",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidConfig_ManagerRequired",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidCount",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidModule_NoCode",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidTaxPercentage",
    inputs: [],
  },
  {
    type: "error",
    name: "NotAdmin",
    inputs: [],
  },
  {
    type: "error",
    name: "UUPSUnauthorizedCallContext",
    inputs: [],
  },
  {
    type: "error",
    name: "UUPSUnsupportedProxiableUUID",
    inputs: [
      {
        name: "slot",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
] as const;
