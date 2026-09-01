// Generated from src/periphery/SlotTaker.sol. Do not edit.
export const slotTakerAbi = [
    {
      "type": "function",
      "name": "liquidateAndTake",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract Slot"
        },
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
        },
        {
          "name": "maxPayment",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "quote",
      "inputs": [
        {
          "name": "slot",
          "type": "address",
          "internalType": "contract Slot"
        },
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        },
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
      "type": "error",
      "name": "UseMulticallForErc20",
      "inputs": []
    }
  ] as const;
