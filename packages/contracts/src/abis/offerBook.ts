export const offerBookAbi = [
    {
      "type": "function",
      "name": "best",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "found",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "o",
          "type": "tuple",
          "internalType": "struct OfferBook.Offer",
          "components": [
            {
              "name": "bidder",
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
              "name": "expiry",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "cancelled",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "bestOrder",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "found",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "order",
          "type": "tuple",
          "internalType": "struct SlotSellOrder.SellOrder",
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
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "board",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "list",
          "type": "tuple[]",
          "internalType": "struct OfferBook.Offer[]",
          "components": [
            {
              "name": "bidder",
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
              "name": "expiry",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "cancelled",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        },
        {
          "name": "live",
          "type": "bool[]",
          "internalType": "bool[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "cancel",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "fundable",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "id",
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
      "name": "offer",
      "inputs": [
        {
          "name": "slot",
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
          "name": "expiry",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "nonce",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "signature",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "offerAt",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct OfferBook.Offer",
          "components": [
            {
              "name": "bidder",
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
              "name": "expiry",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "cancelled",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "offerCount",
      "inputs": [
        {
          "name": "slot",
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
      "name": "offerOf",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "bidder",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "has",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "o",
          "type": "tuple",
          "internalType": "struct OfferBook.Offer",
          "components": [
            {
              "name": "bidder",
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
              "name": "expiry",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "cancelled",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "offers",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct OfferBook.Offer[]",
          "components": [
            {
              "name": "bidder",
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
              "name": "expiry",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "cancelled",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "nonce",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "orderOf",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "order",
          "type": "tuple",
          "internalType": "struct SlotSellOrder.SellOrder",
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
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "Cancelled",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "bidder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Offered",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "bidder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
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
          "name": "expiry",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AlreadyCancelled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BadExpiry",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoSuchOffer",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotBidder",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroPrice",
      "inputs": []
    }
  ] as const;
