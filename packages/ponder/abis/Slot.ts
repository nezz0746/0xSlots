// Generated from apps/contracts/src/slots/Slot.sol. Copied from
// packages/contracts/src/abis/slots/slot.ts — kept here so the indexer's
// types do not depend on that package having been built.
export const SlotAbi = [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "buy",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "depositAmount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "selfAssessedPrice",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "cancelProposal",
      "inputs": [
        {
          "name": "cancelTax",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "cancelHook",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "cancelSellOrder",
      "inputs": [
        {
          "name": "nonce",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claim",
      "inputs": [
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
      "name": "collect",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "collectedTax",
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
      "name": "currency",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IERC20"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deposit",
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
      "name": "hook",
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
      "name": "hookFlags",
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
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "initialize",
      "inputs": [
        {
          "name": "p",
          "type": "tuple",
          "internalType": "struct SlotInit",
          "components": [
            {
              "name": "recipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "currency",
              "type": "address",
              "internalType": "contract IERC20"
            },
            {
              "name": "manager",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "hook",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "taxPercentage",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "minDepositSeconds",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "mutableTax",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "mutableHook",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "isInsolvent",
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
      "name": "isOperator",
      "inputs": [
        {
          "name": "operator",
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
      "name": "isVacant",
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
      "name": "lastSettled",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "liquidate",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "liquidateAndTake",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "depositAmount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "selfAssessedPrice",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "manager",
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
      "name": "minDepositForBuy",
      "inputs": [
        {
          "name": "price_",
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
      "name": "minDepositSeconds",
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
      "name": "multicall",
      "inputs": [
        {
          "name": "data",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "results",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "mutableHook",
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
      "name": "mutableTax",
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
      "name": "occupant",
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
      "name": "occupiedSince",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "orderNonce",
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
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "orderUsed",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
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
      "name": "pending",
      "inputs": [],
      "outputs": [
        {
          "name": "taxPercentage",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "hook",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "hasTax",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "hasHook",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "proposedAt",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "price",
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
      "name": "proposeTerms",
      "inputs": [
        {
          "name": "newTax",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "newHook",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "changeTax",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "changeHook",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "quoteBuy",
      "inputs": [
        {
          "name": "depositAmount",
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
      "name": "quoteLiquidateAndTake",
      "inputs": [
        {
          "name": "depositAmount",
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
      "name": "recipient",
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
      "name": "release",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "secondsUntilLiquidation",
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
      "name": "selfAssess",
      "inputs": [
        {
          "name": "newPrice",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "sell",
      "inputs": [
        {
          "name": "order",
          "type": "tuple",
          "internalType": "struct SlotOrders.SellOrder",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "buyer",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "price",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "deposit",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "deadline",
              "type": "uint64",
              "internalType": "uint64"
            }
          ]
        },
        {
          "name": "signature",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "sellOrderHash",
      "inputs": [
        {
          "name": "order",
          "type": "tuple",
          "internalType": "struct SlotOrders.SellOrder",
          "components": [
            {
              "name": "slot",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "buyer",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "price",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "deposit",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "deadline",
              "type": "uint64",
              "internalType": "uint64"
            }
          ]
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
      "name": "setOperator",
      "inputs": [
        {
          "name": "operator",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "taxOwed",
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
      "name": "taxPercentage",
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
      "name": "tenureId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "topUp",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "withdraw",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "withdrawableOf",
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
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "Bought",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "price",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "deposit",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Claimed",
      "inputs": [
        {
          "name": "account",
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
      "name": "Credited",
      "inputs": [
        {
          "name": "account",
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
      "name": "Deposited",
      "inputs": [
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "total",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "HookCallFailed",
      "inputs": [
        {
          "name": "hook",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "selector",
          "type": "bytes4",
          "indexed": false,
          "internalType": "bytes4"
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
      "name": "Initialized",
      "inputs": [
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "currency",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Liquidated",
      "inputs": [
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "occupant",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OperatorSet",
      "inputs": [
        {
          "name": "operator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OrderCancelled",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "nonce",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PriceSet",
      "inputs": [
        {
          "name": "by",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "oldPrice",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "newPrice",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ProposalCancelled",
      "inputs": [
        {
          "name": "tax",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "hook",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Released",
      "inputs": [
        {
          "name": "occupant",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "refund",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Settled",
      "inputs": [
        {
          "name": "owed",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "depositLeft",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Sold",
      "inputs": [
        {
          "name": "seller",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "price",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "deposit",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TaxCollected",
      "inputs": [
        {
          "name": "recipient",
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
      "name": "TaxPaid",
      "inputs": [
        {
          "name": "payer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "owed",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TermsApplied",
      "inputs": [
        {
          "name": "taxPercentage",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "hook",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TermsProposed",
      "inputs": [
        {
          "name": "taxPercentage",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "hook",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "tax",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "hook_",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Withdrawn",
      "inputs": [
        {
          "name": "occupant",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "left",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
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
      "name": "CannotBuyFromYourself",
      "inputs": []
    },
    {
      "type": "error",
      "name": "FailedCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidCurrency",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidDeposit",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidHook",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidInitialization",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidPrice",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidRecipient",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidTax",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidValue",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoPendingUpdate",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotInitializing",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotInsolvent",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotManager",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotMutable",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotOccupant",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotOccupantOrOperator",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NothingToClaim",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NothingToCollect",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NothingToWithdraw",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OrderBadSignature",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OrderExpired",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OrderUsed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OrderWrongSlot",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
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
      "name": "SellNeedsErc20",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TransferFailed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "Vacant",
      "inputs": []
    }
  ] as const;
