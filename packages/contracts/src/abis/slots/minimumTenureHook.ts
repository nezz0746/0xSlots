// Generated from src/slots/hooks/MinimumTenureHook.sol. Do not edit.
export const minimumTenureHookAbi = [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "tenureSeconds_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI_",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "DESCRIPTOR_VERSION",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "FAMILY",
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
      "name": "afterBuy",
      "inputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterLiquidate",
      "inputs": [
        {
          "name": "ctx",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterRelease",
      "inputs": [
        {
          "name": "ctx",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterSell",
      "inputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterSettle",
      "inputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeBuy",
      "inputs": [
        {
          "name": "ctx",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "beforeSelfAssess",
      "inputs": [
        {
          "name": "ctx",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "beforeSell",
      "inputs": [
        {
          "name": "ctx",
          "type": "tuple",
          "internalType": "struct SlotContext",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "caller",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "account",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupant",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "occupiedSince",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "currentPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "newPrice",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "depositAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "owed",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "paid",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "descriptors",
      "inputs": [],
      "outputs": [
        {
          "name": "result",
          "type": "tuple[]",
          "internalType": "struct HookDescriptor[]",
          "components": [
            {
              "name": "family",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "version",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "data",
              "type": "bytes",
              "internalType": "bytes"
            },
            {
              "name": "metadataURI",
              "type": "string",
              "internalType": "string"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "hooks",
      "inputs": [],
      "outputs": [
        {
          "name": "f",
          "type": "tuple",
          "internalType": "struct HookFlags",
          "components": [
            {
              "name": "beforeBuy",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeSell",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeSelfAssess",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterBuy",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterSell",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterRelease",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterLiquidate",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterSettle",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "metadataURI",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "reentryAllowedAt",
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
        }
      ],
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
      "name": "requiredDeposit",
      "inputs": [
        {
          "name": "price",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "taxPercentage",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
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
      "name": "tenureSeconds",
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
      "type": "error",
      "name": "PriceCutDuringTenure",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TenureNotElapsed",
      "inputs": [
        {
          "name": "availableAt",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "TenureUnderfunded",
      "inputs": [
        {
          "name": "required",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    }
  ] as const;
