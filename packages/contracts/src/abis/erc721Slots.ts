export const erc721SlotsAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "count",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
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
    name: "currency",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC20",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract SlotFactory",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getApproved",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
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
    name: "getTokenSlotInfo",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SlotInfo",
        components: [
          {
            name: "recipient",
            type: "address",
            internalType: "address",
          },
          {
            name: "currency",
            type: "address",
            internalType: "address",
          },
          {
            name: "manager",
            type: "address",
            internalType: "address",
          },
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
            name: "occupant",
            type: "address",
            internalType: "address",
          },
          {
            name: "price",
            type: "uint256",
            internalType: "uint256",
          },
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
            name: "deposit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "collectedTax",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "taxOwed",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "lastSettled",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "secondsUntilLiquidation",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "insolvent",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "utilityName",
            type: "string",
            internalType: "string",
          },
          {
            name: "utilityVersion",
            type: "string",
            internalType: "string",
          },
          {
            name: "utilityFeeBps",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "utilityFeeRecipient",
            type: "address",
            internalType: "address",
          },
          {
            name: "utilityURI",
            type: "string",
            internalType: "string",
          },
          {
            name: "hasPendingTax",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "pendingTaxPercentage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "hasPendingUtility",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "pendingUtility",
            type: "address",
            internalType: "address",
          },
          {
            name: "occupancyPolicy",
            type: "address",
            internalType: "address",
          },
          {
            name: "occupiedSince",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "hasPendingPolicy",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "pendingPolicy",
            type: "address",
            internalType: "address",
          },
          {
            name: "taxProposedAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "utilityProposedAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "policyProposedAt",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "name_",
        type: "string",
        internalType: "string",
      },
      {
        name: "symbol_",
        type: "string",
        internalType: "string",
      },
      {
        name: "factory_",
        type: "address",
        internalType: "address",
      },
      {
        name: "creator_",
        type: "address",
        internalType: "address",
      },
      {
        name: "currency_",
        type: "address",
        internalType: "address",
      },
      {
        name: "config_",
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
        name: "initParams_",
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
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "operator",
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
    name: "isHeld",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
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
    name: "mint",
    inputs: [
      {
        name: "uri",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
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
    name: "mintBatch",
    inputs: [
      {
        name: "uris",
        type: "string[]",
        internalType: "string[]",
      },
    ],
    outputs: [
      {
        name: "tokenIds",
        type: "uint256[]",
        internalType: "uint256[]",
      },
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
    name: "name",
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
    name: "nextTokenId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "onERC721Received",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
      {
        name: "",
        type: "address",
        internalType: "address",
      },
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
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
    name: "priceOf",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
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
    name: "setApprovalForAll",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "slotConfig",
    inputs: [],
    outputs: [
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
    stateMutability: "view",
  },
  {
    type: "function",
    name: "slotInitParams",
    inputs: [],
    outputs: [
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
    stateMutability: "view",
  },
  {
    type: "function",
    name: "slotToken",
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
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "interfaceId",
        type: "bytes4",
        internalType: "bytes4",
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
    name: "symbol",
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
    name: "tokenSlot",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
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
    name: "tokenURI",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
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
    name: "totalSupply",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "approved",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ApprovalForAll",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "operator",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "approved",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Initialized",
    inputs: [
      {
        name: "version",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TokenMinted",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "slot",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "uri",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      {
        name: "from",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ERC721IncorrectOwner",
    inputs: [
      {
        name: "sender",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InsufficientApproval",
    inputs: [
      {
        name: "operator",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidApprover",
    inputs: [
      {
        name: "approver",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidOperator",
    inputs: [
      {
        name: "operator",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidReceiver",
    inputs: [
      {
        name: "receiver",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidSender",
    inputs: [
      {
        name: "sender",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "ERC721NonexistentToken",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidInitialization",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidTokenURI",
    inputs: [],
  },
  {
    type: "error",
    name: "NotCreator",
    inputs: [],
  },
  {
    type: "error",
    name: "NotInitializing",
    inputs: [],
  },
  {
    type: "error",
    name: "TokenDoesNotExist",
    inputs: [],
  },
  {
    type: "error",
    name: "TransferDisabled",
    inputs: [],
  },
] as const;
