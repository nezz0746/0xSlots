// Generated from src/slots/hooks/CompositeHook.sol. Do not edit.
export const compositeHookAbi = [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "owner_",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "initial",
          "type": "address[]",
          "internalType": "address[]"
        },
        {
          "name": "flags",
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
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "CHILD_GAS",
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
      "name": "MAX_CHILDREN",
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
      "name": "add",
      "inputs": [
        {
          "name": "child",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterBuy",
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
      "name": "afterSettle",
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
      "name": "childCount",
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
      "name": "children",
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
      "type": "function",
      "name": "declared",
      "inputs": [],
      "outputs": [
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
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "hooks",
      "inputs": [],
      "outputs": [
        {
          "name": "",
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
      "stateMutability": "view"
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
      "type": "event",
      "name": "ChildAdded",
      "inputs": [
        {
          "name": "child",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "NotOwner",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TooManyChildren",
      "inputs": []
    }
  ] as const;
