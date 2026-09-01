// Generated from src/hooks/MinimumTenureHookFactory.sol by scripts/sync-abis.mjs. Do not edit.
export const minimumTenureHookFactoryAbi = [
    {
      "type": "function",
      "name": "DEFAULT_METADATA_URI",
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
      "name": "getOrDeploy",
      "inputs": [
        {
          "name": "tenureSeconds",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "hook",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getOrDeploy",
      "inputs": [
        {
          "name": "tenureSeconds",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "hook",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "isDeployed",
      "inputs": [
        {
          "name": "tenureSeconds",
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
      "name": "isDeployed",
      "inputs": [
        {
          "name": "tenureSeconds",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "internalType": "string"
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
      "name": "predict",
      "inputs": [
        {
          "name": "tenureSeconds",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "internalType": "string"
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
      "name": "predict",
      "inputs": [
        {
          "name": "tenureSeconds",
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
      "name": "verify",
      "inputs": [
        {
          "name": "hook",
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
      "type": "event",
      "name": "TenureHookDeployed",
      "inputs": [
        {
          "name": "hook",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "tenureSeconds",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "metadataURI",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "InvalidTenure",
      "inputs": []
    }
  ] as const;
