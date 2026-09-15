//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AdLand
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 */
export const adLandAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'BUYOUT_PREMIUM_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CHANGE_DELAY',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'FAMILY',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_TENURE',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'PRIMARY',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TENURE_DESCRIPTOR_VERSION',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TENURE_FAMILY',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'UPGRADE_INTERFACE_VERSION',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'ad',
    outputs: [
      {
        name: 'v',
        internalType: 'struct AdView',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'uri', internalType: 'string', type: 'string' },
          { name: 'managed', internalType: 'bool', type: 'bool' },
          {
            name: 'info',
            internalType: 'struct SlotInfo',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              {
                name: 'currency',
                internalType: 'contract IERC20',
                type: 'address',
              },
              { name: 'manager', internalType: 'address', type: 'address' },
              { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
              {
                name: 'minDepositSeconds',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'mutableTax', internalType: 'bool', type: 'bool' },
              { name: 'mutableHook', internalType: 'bool', type: 'bool' },
              { name: 'hook', internalType: 'address', type: 'address' },
              { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'hookFlags',
                internalType: 'struct HookFlags',
                type: 'tuple',
                components: [
                  { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
                  {
                    name: 'beforeSelfAssess',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterBuy', internalType: 'bool', type: 'bool' },
                  { name: 'afterRelease', internalType: 'bool', type: 'bool' },
                  {
                    name: 'afterLiquidate',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterSettle', internalType: 'bool', type: 'bool' },
                  { name: 'strict', internalType: 'bool', type: 'bool' },
                ],
              },
              { name: 'occupant', internalType: 'address', type: 'address' },
              { name: 'price', internalType: 'uint256', type: 'uint256' },
              { name: 'deposit', internalType: 'uint256', type: 'uint256' },
              { name: 'occupiedSince', internalType: 'uint64', type: 'uint64' },
              { name: 'tenureId', internalType: 'uint64', type: 'uint64' },
              { name: 'lastSettled', internalType: 'uint64', type: 'uint64' },
              { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
              {
                name: 'collectedTax',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'isVacant', internalType: 'bool', type: 'bool' },
              { name: 'isInsolvent', internalType: 'bool', type: 'bool' },
              {
                name: 'secondsUntilLiquidation',
                internalType: 'uint256',
                type: 'uint256',
              },
              {
                name: 'pendingTaxBps',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'pendingHook', internalType: 'address', type: 'address' },
              {
                name: 'pendingHookData',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              { name: 'pendingHasTax', internalType: 'bool', type: 'bool' },
              { name: 'pendingHasHook', internalType: 'bool', type: 'bool' },
              {
                name: 'pendingProposedAt',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'adByKey',
    outputs: [
      {
        name: '',
        internalType: 'struct AdView',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'uri', internalType: 'string', type: 'string' },
          { name: 'managed', internalType: 'bool', type: 'bool' },
          {
            name: 'info',
            internalType: 'struct SlotInfo',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              {
                name: 'currency',
                internalType: 'contract IERC20',
                type: 'address',
              },
              { name: 'manager', internalType: 'address', type: 'address' },
              { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
              {
                name: 'minDepositSeconds',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'mutableTax', internalType: 'bool', type: 'bool' },
              { name: 'mutableHook', internalType: 'bool', type: 'bool' },
              { name: 'hook', internalType: 'address', type: 'address' },
              { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'hookFlags',
                internalType: 'struct HookFlags',
                type: 'tuple',
                components: [
                  { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
                  {
                    name: 'beforeSelfAssess',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterBuy', internalType: 'bool', type: 'bool' },
                  { name: 'afterRelease', internalType: 'bool', type: 'bool' },
                  {
                    name: 'afterLiquidate',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterSettle', internalType: 'bool', type: 'bool' },
                  { name: 'strict', internalType: 'bool', type: 'bool' },
                ],
              },
              { name: 'occupant', internalType: 'address', type: 'address' },
              { name: 'price', internalType: 'uint256', type: 'uint256' },
              { name: 'deposit', internalType: 'uint256', type: 'uint256' },
              { name: 'occupiedSince', internalType: 'uint64', type: 'uint64' },
              { name: 'tenureId', internalType: 'uint64', type: 'uint64' },
              { name: 'lastSettled', internalType: 'uint64', type: 'uint64' },
              { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
              {
                name: 'collectedTax',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'isVacant', internalType: 'bool', type: 'bool' },
              { name: 'isInsolvent', internalType: 'bool', type: 'bool' },
              {
                name: 'secondsUntilLiquidation',
                internalType: 'uint256',
                type: 'uint256',
              },
              {
                name: 'pendingTaxBps',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'pendingHook', internalType: 'address', type: 'address' },
              {
                name: 'pendingHookData',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              { name: 'pendingHasTax', internalType: 'bool', type: 'bool' },
              { name: 'pendingHasHook', internalType: 'bool', type: 'bool' },
              {
                name: 'pendingProposedAt',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterBuy',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterLiquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterRelease',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterSettle',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeBuy',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'selfAssessedPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'maxPayment', internalType: 'uint256', type: 'uint256' },
      { name: 'uri', internalType: 'string', type: 'string' },
    ],
    name: 'buyAndPublish',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'selfAssessedPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'maxPayment', internalType: 'uint256', type: 'uint256' },
      { name: 'uri', internalType: 'string', type: 'string' },
      { name: 'permitValue', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'buyAndPublishWithPermit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'cancelSlot',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'commitSlot',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'currency', internalType: 'contract IERC20', type: 'address' },
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'minDepositSeconds', internalType: 'uint256', type: 'uint256' },
      { name: 'tenureWindow', internalType: 'uint256', type: 'uint256' },
      { name: 'manager', internalType: 'address', type: 'address' },
      { name: 'key', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'createAdSlot',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct AdLandCreate.AdSlotParams[]',
        type: 'tuple[]',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'tenureWindow', internalType: 'uint256', type: 'uint256' },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'key', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'createAdSlotMany',
    outputs: [{ name: 'slots', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'creativeOf',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'descriptors',
    outputs: [
      {
        name: 'd',
        internalType: 'struct HookDescriptor[]',
        type: 'tuple[]',
        components: [
          { name: 'family', internalType: 'bytes32', type: 'bytes32' },
          { name: 'version', internalType: 'uint32', type: 'uint32' },
          { name: 'signature', internalType: 'string', type: 'string' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
          { name: 'metadataURI', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'initializedVersion',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'keyOwner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes[]', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', internalType: 'bytes[]', type: 'bytes[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'pendingOf',
    outputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'readyAt', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'primary',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proxiableUUID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'uri', internalType: 'string', type: 'string' },
    ],
    name: 'publish',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'rawCreativeOf',
    outputs: [
      { name: 'uri', internalType: 'string', type: 'string' },
      { name: 'tenureId', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'reentryAllowedAt',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'window', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'requiredDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'key', internalType: 'bytes32', type: 'bytes32' },
      { name: 'slot', internalType: 'address', type: 'address' },
    ],
    name: 'setSlot',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'factory', internalType: 'address', type: 'address' }],
    name: 'setSlotFactory',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'slotFactory',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'slotOf',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'subscriptions',
    outputs: [
      {
        name: 'f',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          { name: 'strict', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureBounds',
    outputs: [
      {
        name: 'b',
        internalType: 'struct HookBounds[]',
        type: 'tuple[]',
        components: [
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'unit', internalType: 'string', type: 'string' },
          { name: 'bounded', internalType: 'bool', type: 'bool' },
          { name: 'min', internalType: 'uint256', type: 'uint256' },
          { name: 'max', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureBounds_',
    outputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'tenureOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureSignature',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'tenureWindow',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'AdSlotCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'fromTenure',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'toTenure',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Cleared',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'uri', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'tenureId',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Published',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previous',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'next',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'SlotFactorySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'key', internalType: 'bytes32', type: 'bytes32', indexed: true },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'SlotProposalCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'key', internalType: 'bytes32', type: 'bytes32', indexed: true },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'readyAt',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'SlotProposed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'key', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'previous',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'SlotSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'BuyoutBelowPremium',
  },
  {
    type: 'error',
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'EmptyBatch' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  {
    type: 'error',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'KeyTaken',
  },
  { type: 'error', inputs: [], name: 'NativeSlotHasNoPermit' },
  { type: 'error', inputs: [], name: 'NoFactory' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  {
    type: 'error',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'NotKeyOwner',
  },
  { type: 'error', inputs: [], name: 'NotOccupant' },
  { type: 'error', inputs: [], name: 'NothingPending' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'PriceCutDuringTenure' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'TenureNotConfigured' },
  {
    type: 'error',
    inputs: [{ name: 'allowedAt', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureNotElapsed',
  },
  {
    type: 'error',
    inputs: [{ name: 'maxTenure', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureTooLong',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureUnderfunded',
  },
  {
    type: 'error',
    inputs: [{ name: 'readyAt', internalType: 'uint64', type: 'uint64' }],
    name: 'TooEarly',
  },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
  { type: 'error', inputs: [], name: 'UnexpectedValue' },
  { type: 'error', inputs: [], name: 'ZeroSlot' },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 */
export const adLandAddress = {
  8453: '0x27b8E0D543547D6094ACf3592d17a74f43d6B899',
  31337: '0xE739d3dBd10CeCE45c73c408B3e22543Ff609aAD',
  84532: '0x27b8E0D543547D6094ACf3592d17a74f43d6B899',
  11155111: '0x27b8E0D543547D6094ACf3592d17a74f43d6B899',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x27b8E0D543547D6094ACf3592d17a74f43d6B899)
 */
export const adLandConfig = { address: adLandAddress, abi: adLandAbi } as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MinimumTenureHook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 */
export const minimumTenureHookAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'BUYOUT_PREMIUM_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DESCRIPTOR_VERSION',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'FAMILY',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_TENURE',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TENURE_DESCRIPTOR_VERSION',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TENURE_FAMILY',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterBuy',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterLiquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterRelease',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterSettle',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeBuy',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'descriptors',
    outputs: [
      {
        name: 'result',
        internalType: 'struct HookDescriptor[]',
        type: 'tuple[]',
        components: [
          { name: 'family', internalType: 'bytes32', type: 'bytes32' },
          { name: 'version', internalType: 'uint32', type: 'uint32' },
          { name: 'signature', internalType: 'string', type: 'string' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
          { name: 'metadataURI', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'reentryAllowedAt',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'window', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'requiredDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'subscriptions',
    outputs: [
      {
        name: 'f',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          { name: 'strict', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureBounds',
    outputs: [
      {
        name: 'b',
        internalType: 'struct HookBounds[]',
        type: 'tuple[]',
        components: [
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'unit', internalType: 'string', type: 'string' },
          { name: 'bounded', internalType: 'bool', type: 'bool' },
          { name: 'min', internalType: 'uint256', type: 'uint256' },
          { name: 'max', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureBounds_',
    outputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'tenureOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureSignature',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'BuyoutBelowPremium',
  },
  { type: 'error', inputs: [], name: 'PriceCutDuringTenure' },
  { type: 'error', inputs: [], name: 'TenureNotConfigured' },
  {
    type: 'error',
    inputs: [{ name: 'allowedAt', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureNotElapsed',
  },
  {
    type: 'error',
    inputs: [{ name: 'maxTenure', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureTooLong',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureUnderfunded',
  },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 */
export const minimumTenureHookAddress = {
  8453: '0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F',
  31337: '0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F',
  84532: '0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F',
  11155111: '0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x32dc981b9622B8ae5e90716ED07a275cCAd1Ba9F)
 */
export const minimumTenureHookConfig = {
  address: minimumTenureHookAddress,
  abi: minimumTenureHookAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OfferBook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 */
export const offerBookAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'acceptOffer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'best',
    outputs: [
      { name: 'found', internalType: 'bool', type: 'bool' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      {
        name: 'o',
        internalType: 'struct OfferBookStorage.Offer',
        type: 'tuple',
        components: [
          { name: 'bidder', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'cancelled', internalType: 'bool', type: 'bool' },
          { name: 'filled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'board',
    outputs: [
      {
        name: 'list',
        internalType: 'struct OfferBookStorage.Offer[]',
        type: 'tuple[]',
        components: [
          { name: 'bidder', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'cancelled', internalType: 'bool', type: 'bool' },
          { name: 'filled', internalType: 'bool', type: 'bool' },
        ],
      },
      { name: 'live', internalType: 'bool[]', type: 'bool[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'isFundable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'isLive',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'liveCount',
    outputs: [{ name: 'n', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'deposit', internalType: 'uint256', type: 'uint256' },
      { name: 'expiry', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'offer',
    outputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'offerAt',
    outputs: [
      {
        name: '',
        internalType: 'struct OfferBookStorage.Offer',
        type: 'tuple',
        components: [
          { name: 'bidder', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'cancelled', internalType: 'bool', type: 'bool' },
          { name: 'filled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'offerCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'bidder', internalType: 'address', type: 'address' },
    ],
    name: 'offerOf',
    outputs: [
      { name: 'has', internalType: 'bool', type: 'bool' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      {
        name: 'o',
        internalType: 'struct OfferBookStorage.Offer',
        type: 'tuple',
        components: [
          { name: 'bidder', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'cancelled', internalType: 'bool', type: 'bool' },
          { name: 'filled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'offers',
    outputs: [
      {
        name: '',
        internalType: 'struct OfferBookStorage.Offer[]',
        type: 'tuple[]',
        components: [
          { name: 'bidder', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'cancelled', internalType: 'bool', type: 'bool' },
          { name: 'filled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'bidder',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
    ],
    name: 'Cancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'bidder',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'seller',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'price',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'deposit',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Filled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'bidder',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'price',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'deposit',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'expiry',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Offered',
  },
  { type: 'error', inputs: [], name: 'AlreadyCancelled' },
  { type: 'error', inputs: [], name: 'BadExpiry' },
  { type: 'error', inputs: [], name: 'FillFailed' },
  { type: 'error', inputs: [], name: 'NativeSlotNotSupported' },
  { type: 'error', inputs: [], name: 'NoSuchOffer' },
  { type: 'error', inputs: [], name: 'NotBidder' },
  { type: 'error', inputs: [], name: 'NotOccupant' },
  { type: 'error', inputs: [], name: 'NotOperator' },
  { type: 'error', inputs: [], name: 'OfferNotLive' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'error',
    inputs: [{ name: 'shortfall', internalType: 'uint256', type: 'uint256' }],
    name: 'TopUpRequired',
  },
  { type: 'error', inputs: [], name: 'ZeroPrice' },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 */
export const offerBookAddress = {
  8453: '0x691C6010F6953e632405d3c3fBaF561914F095D1',
  31337: '0x691C6010F6953e632405d3c3fBaF561914F095D1',
  84532: '0x691C6010F6953e632405d3c3fBaF561914F095D1',
  11155111: '0x691C6010F6953e632405d3c3fBaF561914F095D1',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x691C6010F6953e632405d3c3fBaF561914F095D1)
 */
export const offerBookConfig = {
  address: offerBookAddress,
  abi: offerBookAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Slot
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 */
export const slotAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'BASIS_POINTS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'HOOK_GAS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'HOOK_READ_FLOOR',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_PRICE',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_TAX_BPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MONTH',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'PAYOUT_GAS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TERMS_DELAY',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'arrearsOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'selfAssessedPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'maxPayment', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'buy',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'cancelTax', internalType: 'bool', type: 'bool' },
      { name: 'cancelHook', internalType: 'bool', type: 'bool' },
    ],
    name: 'cancelTerms',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collect',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collectedTax',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currency',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'deposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getSlotConstants',
    outputs: [
      {
        name: 'c',
        internalType: 'struct SlotConstantsInfo',
        type: 'tuple',
        components: [
          { name: 'maxPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'maxTaxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'basisPoints', internalType: 'uint256', type: 'uint256' },
          { name: 'month', internalType: 'uint256', type: 'uint256' },
          { name: 'hookGas', internalType: 'uint256', type: 'uint256' },
          { name: 'payoutGas', internalType: 'uint256', type: 'uint256' },
          { name: 'termsDelay', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getSlotInfo',
    outputs: [
      {
        name: 'info',
        internalType: 'struct SlotInfo',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableHook', internalType: 'bool', type: 'bool' },
          { name: 'hook', internalType: 'address', type: 'address' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'hookFlags',
            internalType: 'struct HookFlags',
            type: 'tuple',
            components: [
              { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
              { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
              { name: 'afterBuy', internalType: 'bool', type: 'bool' },
              { name: 'afterRelease', internalType: 'bool', type: 'bool' },
              { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
              { name: 'afterSettle', internalType: 'bool', type: 'bool' },
              { name: 'strict', internalType: 'bool', type: 'bool' },
            ],
          },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'occupiedSince', internalType: 'uint64', type: 'uint64' },
          { name: 'tenureId', internalType: 'uint64', type: 'uint64' },
          { name: 'lastSettled', internalType: 'uint64', type: 'uint64' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'collectedTax', internalType: 'uint256', type: 'uint256' },
          { name: 'isVacant', internalType: 'bool', type: 'bool' },
          { name: 'isInsolvent', internalType: 'bool', type: 'bool' },
          {
            name: 'secondsUntilLiquidation',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'pendingTaxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'pendingHook', internalType: 'address', type: 'address' },
          { name: 'pendingHookData', internalType: 'bytes32', type: 'bytes32' },
          { name: 'pendingHasTax', internalType: 'bool', type: 'bool' },
          { name: 'pendingHasHook', internalType: 'bool', type: 'bool' },
          { name: 'pendingProposedAt', internalType: 'uint64', type: 'uint64' },
          { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'hasRipeTerms',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'hook',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'hookData',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'hookFlags',
    outputs: [
      {
        name: 'f',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          { name: 'strict', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'p',
        internalType: 'struct SlotInit',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'hook', internalType: 'address', type: 'address' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableHook', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isInsolvent',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'isOperator',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isVacant',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'lastSettled',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'liquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'manager',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'price_', internalType: 'uint256', type: 'uint256' }],
    name: 'minDepositForBuy',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'minDepositSeconds',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes[]', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', internalType: 'bytes[]', type: 'bytes[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'mutableHook',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'mutableTax',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'occupant',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'occupiedSince',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pending',
    outputs: [
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'hook', internalType: 'address', type: 'address' },
      { name: 'hasTax', internalType: 'bool', type: 'bool' },
      { name: 'hasHook', internalType: 'bool', type: 'bool' },
      { name: 'proposedAt', internalType: 'uint64', type: 'uint64' },
      { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'price',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newTaxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'newHook', internalType: 'address', type: 'address' },
      { name: 'newHookData', internalType: 'bytes32', type: 'bytes32' },
      { name: 'changeTax', internalType: 'bool', type: 'bool' },
      { name: 'changeHook', internalType: 'bool', type: 'bool' },
    ],
    name: 'proposeTerms',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'quoteBuy',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'recipient',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'release',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'secondsUntilLiquidation',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newPrice', internalType: 'uint256', type: 'uint256' }],
    name: 'selfAssess',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'allowed', internalType: 'bool', type: 'bool' },
    ],
    name: 'setOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'taxBps',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'taxOwed',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tenureId',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'topUp',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'withdrawableOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'buyer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'price',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'deposit',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'paid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Bought',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Claimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Credited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'total',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'hook', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'selector',
        internalType: 'bytes4',
        type: 'bytes4',
        indexed: false,
      },
    ],
    name: 'HookCallFailed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'hook', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'HookDetached',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'currency',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'occupant',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Liquidated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'allowed', internalType: 'bool', type: 'bool', indexed: false },
      {
        name: 'tenureId',
        internalType: 'uint64',
        type: 'uint64',
        indexed: true,
      },
    ],
    name: 'OperatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'oldPrice',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'newPrice',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'PriceSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'occupant',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'refund',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Released',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owed',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'paid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'depositLeft',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Settled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'TaxCollected',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'payer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'owed',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'paid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'TaxPaid',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'taxBps',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'hook', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'hookData',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'TermsApplied',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'cancelTax', internalType: 'bool', type: 'bool', indexed: false },
      {
        name: 'cancelHook',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
    ],
    name: 'TermsCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'taxBps',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'hook', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'hookData',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      { name: 'changeTax', internalType: 'bool', type: 'bool', indexed: false },
      {
        name: 'changeHook',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
    ],
    name: 'TermsProposed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'occupant',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'left',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  { type: 'error', inputs: [], name: 'CannotBuyFromYourself' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InsufficientGasForTerms' },
  { type: 'error', inputs: [], name: 'InvalidCurrency' },
  { type: 'error', inputs: [], name: 'InvalidDeposit' },
  { type: 'error', inputs: [], name: 'InvalidHook' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'InvalidPrice' },
  { type: 'error', inputs: [], name: 'InvalidRecipient' },
  { type: 'error', inputs: [], name: 'InvalidTax' },
  { type: 'error', inputs: [], name: 'InvalidValue' },
  { type: 'error', inputs: [], name: 'NoPendingTerms' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'NotInsolvent' },
  { type: 'error', inputs: [], name: 'NotManager' },
  { type: 'error', inputs: [], name: 'NotMutable' },
  { type: 'error', inputs: [], name: 'NotOccupant' },
  { type: 'error', inputs: [], name: 'NotOccupantOrOperator' },
  { type: 'error', inputs: [], name: 'NothingProposed' },
  { type: 'error', inputs: [], name: 'NothingToClaim' },
  { type: 'error', inputs: [], name: 'NothingToCollect' },
  { type: 'error', inputs: [], name: 'NothingToWithdraw' },
  { type: 'error', inputs: [], name: 'PaymentAboveMax' },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'TransferFailed' },
  { type: 'error', inputs: [], name: 'Vacant' },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 */
export const slotAddress = {
  8453: '0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168',
  31337: '0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168',
  84532: '0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168',
  11155111: '0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfc2c57aF25f3E12a25475d4645ef9Cd94cD34168)
 */
export const slotConfig = { address: slotAddress, abi: slotAbi } as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotBoundNFT
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const slotBoundNftAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'factory_',
        internalType: 'contract SlotFactory',
        type: 'address',
      },
      { name: 'name_', internalType: 'string', type: 'string' },
      { name: 'symbol_', internalType: 'string', type: 'string' },
      { name: 'maxSupply_', internalType: 'uint256', type: 'uint256' },
      { name: 'currency_', internalType: 'contract IERC20', type: 'address' },
      { name: 'taxBps_', internalType: 'uint256', type: 'uint256' },
      { name: 'minDepositSeconds_', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient_', internalType: 'address', type: 'address' },
      { name: 'manager_', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'FACTORY',
    outputs: [
      { name: '', internalType: 'contract SlotFactory', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_SUPPLY',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterBuy',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterLiquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterRelease',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterSettle',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'baseURI',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeBuy',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currency',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'getApproved',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'getSlotInfoOf',
    outputs: [
      {
        name: '',
        internalType: 'struct SlotInfo',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableHook', internalType: 'bool', type: 'bool' },
          { name: 'hook', internalType: 'address', type: 'address' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'hookFlags',
            internalType: 'struct HookFlags',
            type: 'tuple',
            components: [
              { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
              { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
              { name: 'afterBuy', internalType: 'bool', type: 'bool' },
              { name: 'afterRelease', internalType: 'bool', type: 'bool' },
              { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
              { name: 'afterSettle', internalType: 'bool', type: 'bool' },
              { name: 'strict', internalType: 'bool', type: 'bool' },
            ],
          },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'occupiedSince', internalType: 'uint64', type: 'uint64' },
          { name: 'tenureId', internalType: 'uint64', type: 'uint64' },
          { name: 'lastSettled', internalType: 'uint64', type: 'uint64' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'collectedTax', internalType: 'uint256', type: 'uint256' },
          { name: 'isVacant', internalType: 'bool', type: 'bool' },
          { name: 'isInsolvent', internalType: 'bool', type: 'bool' },
          {
            name: 'secondsUntilLiquidation',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'pendingTaxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'pendingHook', internalType: 'address', type: 'address' },
          { name: 'pendingHookData', internalType: 'bytes32', type: 'bytes32' },
          { name: 'pendingHasTax', internalType: 'bool', type: 'bool' },
          { name: 'pendingHasHook', internalType: 'bool', type: 'bool' },
          { name: 'pendingProposedAt', internalType: 'uint64', type: 'uint64' },
          { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'operator', internalType: 'address', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'valuation', internalType: 'uint256', type: 'uint256' }],
    name: 'mint',
    outputs: [
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'slot', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'valuation', internalType: 'uint256', type: 'uint256' }],
    name: 'quoteMint',
    outputs: [
      { name: 'total', internalType: 'uint256', type: 'uint256' },
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'deposit', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'approved', internalType: 'bool', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newBaseURI', internalType: 'string', type: 'string' }],
    name: 'setBaseURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'slotOf',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'subscriptions',
    outputs: [
      {
        name: 'f',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          { name: 'strict', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'terms',
    outputs: [
      {
        name: '',
        internalType: 'struct SlotInit',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'hook', internalType: 'address', type: 'address' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableHook', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'tokenOf',
    outputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalMinted',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'approved',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'approved', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'ApprovalForAll',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'uri', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'BaseURISet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SlotMinted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sent', internalType: 'uint256', type: 'uint256' },
      { name: 'received', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'CurrencyTakesACut',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'ERC721IncorrectOwner',
  },
  {
    type: 'error',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC721InsufficientApproval',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOperator',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ERC721NonexistentToken',
  },
  { type: 'error', inputs: [], name: 'FailedCall' },
  {
    type: 'error',
    inputs: [
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'NoSuchToken',
  },
  { type: 'error', inputs: [], name: 'NoSupply' },
  { type: 'error', inputs: [], name: 'NotTransferable' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'SoldOut' },
  { type: 'error', inputs: [], name: 'TermsCannotBeMinted' },
  {
    type: 'error',
    inputs: [{ name: 'expected', internalType: 'uint256', type: 'uint256' }],
    name: 'WrongValue',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotBoundNFTFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 */
export const slotBoundNftFactoryAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'UPGRADE_INTERFACE_VERSION',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'admin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collectionCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'init',
        internalType: 'struct CollectionInit',
        type: 'tuple',
        components: [
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'symbol', internalType: 'string', type: 'string' },
          { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'owner', internalType: 'address', type: 'address' },
        ],
      },
    ],
    name: 'createCollection',
    outputs: [{ name: 'collection', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'init',
        internalType: 'struct WrapperInit',
        type: 'tuple',
        components: [
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'symbol', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'createWrapper',
    outputs: [{ name: 'wrapper', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'admin_', internalType: 'address', type: 'address' },
      {
        name: 'slotFactory_',
        internalType: 'contract SlotFactory',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'wrapperImplementation',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'initializeWrappers',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'initializedVersion',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isCollection',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isWrapper',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proxiableUUID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'slotFactory',
    outputs: [
      { name: '', internalType: 'contract SlotFactory', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'next', internalType: 'address', type: 'address' }],
    name: 'transferAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
    ],
    name: 'upgradeWrapperBeacon',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'wrapperBeacon',
    outputs: [
      { name: '', internalType: 'contract UpgradeableBeacon', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'wrapperCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'AdminTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'collection',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'currency',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'maxSupply',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'CollectionCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newImplementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'WrapperBeaconUpgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'wrapper',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'name', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'symbol',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'WrapperCreated',
  },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  {
    type: 'error',
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'InvalidRecipient' },
  { type: 'error', inputs: [], name: 'NotAdmin' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 */
export const slotBoundNftFactoryAddress = {
  8453: '0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4',
  31337: '0x5E3eF051FfC7edC5763697c67D46aeBfED4ea4CB',
  84532: '0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4',
  11155111: '0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xb6eD3130fB37D55B1289E0D65d751FC9d267Daf4)
 */
export const slotBoundNftFactoryConfig = {
  address: slotBoundNftFactoryAddress,
  abi: slotBoundNftFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotBoundNFTWrapper
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const slotBoundNftWrapperAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    inputs: [],
    name: 'MIN_DEPOSIT_SECONDS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterBuy',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterLiquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'ctx',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterRelease',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'afterSettle',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeBuy',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct SlotContext',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'caller', internalType: 'address', type: 'address' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'occupant', internalType: 'address', type: 'address' },
          { name: 'occupiedSince', internalType: 'uint256', type: 'uint256' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'owed', internalType: 'uint256', type: 'uint256' },
          { name: 'paid', internalType: 'uint256', type: 'uint256' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'getApproved',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'name_', internalType: 'string', type: 'string' },
      { name: 'symbol_', internalType: 'string', type: 'string' },
      {
        name: 'factory_',
        internalType: 'contract SlotFactory',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'operator', internalType: 'address', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'valuation', internalType: 'uint256', type: 'uint256' },
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'quoteWrap',
    outputs: [{ name: 'deposit', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'approved', internalType: 'bool', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'slotFactory',
    outputs: [
      { name: '', internalType: 'contract SlotFactory', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'slotOf',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'subscriptions',
    outputs: [
      {
        name: 'f',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          { name: 'strict', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'tokenOf',
    outputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalWrapped',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'underlying', internalType: 'contract IERC721', type: 'address' },
      { name: 'underlyingId', internalType: 'uint256', type: 'uint256' },
      { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
      { name: 'valuation', internalType: 'uint256', type: 'uint256' },
      { name: 'mode', internalType: 'enum Mode', type: 'uint8' },
    ],
    name: 'wrap',
    outputs: [
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'slot', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'wrapOf',
    outputs: [
      {
        name: '',
        internalType: 'struct Wrap',
        type: 'tuple',
        components: [
          { name: 'underlying', internalType: 'address', type: 'address' },
          { name: 'mode', internalType: 'enum Mode', type: 'uint8' },
          { name: 'retired', internalType: 'bool', type: 'bool' },
          { name: 'depositor', internalType: 'address', type: 'address' },
          { name: 'underlyingId', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'approved',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'approved', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'ApprovalForAll',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'depositor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'underlying',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'underlyingId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'tokenId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'depositor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'underlying',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'underlyingId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'mode',
        internalType: 'enum Mode',
        type: 'uint8',
        indexed: false,
      },
      {
        name: 'taxBps',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Wrapped',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'ERC721IncorrectOwner',
  },
  {
    type: 'error',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC721InsufficientApproval',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOperator',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ERC721NonexistentToken',
  },
  { type: 'error', inputs: [], name: 'InvalidFactory' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  {
    type: 'error',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'NoSuchToken',
  },
  { type: 'error', inputs: [], name: 'NotDepositor' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'NotReclaimable' },
  { type: 'error', inputs: [], name: 'NotTransferable' },
  { type: 'error', inputs: [], name: 'Occupied' },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  { type: 'error', inputs: [], name: 'SlotRetired' },
  { type: 'error', inputs: [], name: 'UnsolicitedTransfer' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollective
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 */
export const slotCollectiveAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'splitsWarehouse', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'DEFAULT_ADMIN_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'FACTORY',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'NATIVE_TOKEN',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'POLICY_MANAGER_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'SPLITS_WAREHOUSE',
    outputs: [
      { name: '', internalType: 'contract ISplitsWarehouse', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'SPLIT_MANAGER_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TAX_MANAGER_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
    ],
    name: 'cancelAllProposals',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
    ],
    name: 'cancelAllProposalsBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
    ],
    name: 'cancelHookProposal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
    ],
    name: 'cancelHookProposalBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
    ],
    name: 'cancelTaxProposal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
    ],
    name: 'cancelTaxProposalBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
      { name: '_token', internalType: 'address', type: 'address' },
      { name: '_distributor', internalType: 'address', type: 'address' },
    ],
    name: 'distribute',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
      { name: '_token', internalType: 'address', type: 'address' },
      { name: '_distributeAmount', internalType: 'uint256', type: 'uint256' },
      { name: '_performWarehouseTransfer', internalType: 'bool', type: 'bool' },
      { name: '_distributor', internalType: 'address', type: 'address' },
    ],
    name: 'distribute',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { name: 'fields', internalType: 'bytes1', type: 'bytes1' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'version', internalType: 'string', type: 'string' },
      { name: 'chainId', internalType: 'uint256', type: 'uint256' },
      { name: 'verifyingContract', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'extensions', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_calls',
        internalType: 'struct Wallet.Call[]',
        type: 'tuple[]',
        components: [
          { name: 'to', internalType: 'address', type: 'address' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'execCalls',
    outputs: [
      { name: 'blockNumber', internalType: 'uint256', type: 'uint256' },
      { name: 'returnData', internalType: 'bytes[]', type: 'bytes[]' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'role', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getRoleAdmin',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_token', internalType: 'address', type: 'address' }],
    name: 'getSplitBalance',
    outputs: [
      { name: 'splitBalance', internalType: 'uint256', type: 'uint256' },
      { name: 'warehouseBalance', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
      { name: '_owner', internalType: 'address', type: 'address' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
      {
        name: 'roles',
        internalType: 'struct SlotCollective.InitialRoles',
        type: 'tuple',
        components: [
          { name: 'admin', internalType: 'address', type: 'address' },
          { name: 'taxManagers', internalType: 'address[]', type: 'address[]' },
          {
            name: 'hookManagers',
            internalType: 'address[]',
            type: 'address[]',
          },
          {
            name: 'splitManagers',
            internalType: 'address[]',
            type: 'address[]',
          },
        ],
      },
    ],
    name: 'initializeCollective',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'bytes32', type: 'bytes32' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'isValidSignature',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
      { name: 'newHook', internalType: 'address', type: 'address' },
      { name: 'newHookData', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'proposeHook',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
      { name: 'newHook', internalType: 'address', type: 'address' },
      { name: 'newHookData', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'proposeHookBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
      { name: 'newTaxBps', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'proposeTax',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
      { name: 'newTaxBps', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'proposeTaxBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'callerConfirmation', internalType: 'address', type: 'address' },
    ],
    name: 'renounceRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'hash', internalType: 'bytes32', type: 'bytes32' }],
    name: 'replaySafeHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_paused', internalType: 'bool', type: 'bool' }],
    name: 'setPaused',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
    ],
    name: 'setSplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'splitHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
      },
    ],
    name: 'sweep',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'updateBlockNumber',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
    ],
    name: 'updateSplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: '_token', internalType: 'address', type: 'address' }],
    name: 'withdrawFromWarehouse',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'AllTermsCancelled',
  },
  { type: 'event', anonymous: false, inputs: [], name: 'EIP712DomainChanged' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'calls',
        internalType: 'struct Wallet.Call[]',
        type: 'tuple[]',
        components: [
          { name: 'to', internalType: 'address', type: 'address' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
        indexed: false,
      },
    ],
    name: 'ExecCalls',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'previousAdminRole',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'newAdminRole',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'RoleAdminChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RoleGranted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RoleRevoked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'paused', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'SetPaused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'distributor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'SplitDistributed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: '_split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
        indexed: false,
      },
    ],
    name: 'SplitUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'kind',
        internalType: 'enum Dimension',
        type: 'uint8',
        indexed: true,
      },
    ],
    name: 'TermsCancelRelayed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'kind',
        internalType: 'enum Dimension',
        type: 'uint8',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'TermsRelayed',
  },
  { type: 'error', inputs: [], name: 'AccessControlBadConfirmation' },
  {
    type: 'error',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'neededRole', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'AccessControlUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'AdminRequired' },
  { type: 'error', inputs: [], name: 'EmptySplit' },
  {
    type: 'error',
    inputs: [
      {
        name: 'call',
        internalType: 'struct Wallet.Call',
        type: 'tuple',
        components: [
          { name: 'to', internalType: 'address', type: 'address' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'InvalidCalldataForEOA',
  },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidSplit' },
  { type: 'error', inputs: [], name: 'InvalidSplit_LengthMismatch' },
  { type: 'error', inputs: [], name: 'InvalidSplit_TotalAllocationMismatch' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'OwnershipIsSelfBound' },
  { type: 'error', inputs: [], name: 'Paused' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'Unauthorized' },
  { type: 'error', inputs: [], name: 'UnauthorizedInitializer' },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 */
export const slotCollectiveAddress = {
  8453: '0x879352c146CF7498F2738ff83202748Db5cB9c21',
  31337: '0xB9c6D7c0C5D7E82CA8B1FC8C35bE2489Dd2d4dad',
  84532: '0x879352c146CF7498F2738ff83202748Db5cB9c21',
  11155111: '0x879352c146CF7498F2738ff83202748Db5cB9c21',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x879352c146CF7498F2738ff83202748Db5cB9c21)
 */
export const slotCollectiveConfig = {
  address: slotCollectiveAddress,
  abi: slotCollectiveAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollectiveFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 */
export const slotCollectiveFactoryAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'UPGRADE_INTERFACE_VERSION',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'admin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beacon',
    outputs: [
      { name: '', internalType: 'contract UpgradeableBeacon', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collectiveCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'collectives',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'split',
        internalType: 'struct SplitV2Lib.Split',
        type: 'tuple',
        components: [
          { name: 'recipients', internalType: 'address[]', type: 'address[]' },
          { name: 'allocations', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'totalAllocation', internalType: 'uint256', type: 'uint256' },
          {
            name: 'distributionIncentive',
            internalType: 'uint16',
            type: 'uint16',
          },
        ],
      },
      {
        name: 'roles',
        internalType: 'struct SlotCollective.InitialRoles',
        type: 'tuple',
        components: [
          { name: 'admin', internalType: 'address', type: 'address' },
          { name: 'taxManagers', internalType: 'address[]', type: 'address[]' },
          {
            name: 'hookManagers',
            internalType: 'address[]',
            type: 'address[]',
          },
          {
            name: 'splitManagers',
            internalType: 'address[]',
            type: 'address[]',
          },
        ],
      },
    ],
    name: 'createCollective',
    outputs: [{ name: 'collective', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_admin', internalType: 'address', type: 'address' },
      {
        name: '_collectiveImplementation',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'initializedVersion',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isSlotCollective',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proxiableUUID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newAdmin', internalType: 'address', type: 'address' }],
    name: 'transferAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
    ],
    name: 'upgradeBeacon',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousAdmin',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newAdmin',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'AdminTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newImplementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'BeaconUpgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'collective',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'admin',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'deployer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SlotCollectiveDeployed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  { type: 'error', inputs: [], name: 'AdminRequired' },
  {
    type: 'error',
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'ImplementationRequired' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'NotAdmin' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 */
export const slotCollectiveFactoryAddress = {
  8453: '0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1',
  31337: '0x6c40003Ac3cB4c4188b38061A078c6a8b2E0FcD6',
  84532: '0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1',
  11155111: '0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x6201cC28977df3A8C10FC185984Cc933d18C2Fb1)
 */
export const slotCollectiveFactoryConfig = {
  address: slotCollectiveFactoryAddress,
  abi: slotCollectiveFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 */
export const slotFactoryAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'UPGRADE_INTERFACE_VERSION',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'admin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beacon',
    outputs: [
      { name: '', internalType: 'contract UpgradeableBeacon', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slots', internalType: 'address[]', type: 'address[]' }],
    name: 'collectAll',
    outputs: [
      { name: 'collected', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'collectFrom',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'init',
        internalType: 'struct SlotInit',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'hook', internalType: 'address', type: 'address' },
          { name: 'hookData', internalType: 'bytes32', type: 'bytes32' },
          { name: 'taxBps', internalType: 'uint256', type: 'uint256' },
          {
            name: 'minDepositSeconds',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableHook', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    name: 'createSlot',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'admin_', internalType: 'address', type: 'address' },
      { name: 'implementation_', internalType: 'address', type: 'address' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'initializedVersion',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isSlot',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proxiableUUID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'slotCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'next', internalType: 'address', type: 'address' }],
    name: 'transferAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'implementation_', internalType: 'address', type: 'address' },
    ],
    name: 'upgradeBeacon',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'AdminTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'BeaconUpgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'currency',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'hook',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'SlotCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  {
    type: 'error',
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'InvalidRecipient' },
  { type: 'error', inputs: [], name: 'NotASlot' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'NotManager' },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 */
export const slotFactoryAddress = {
  8453: '0x4416f23E3d8de4E35937448FD221549b6E38483B',
  31337: '0x87Da6e2A1E5623589cdf90a97E235133D37046e5',
  84532: '0x4416f23E3d8de4E35937448FD221549b6E38483B',
  11155111: '0x4416f23E3d8de4E35937448FD221549b6E38483B',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x4416f23E3d8de4E35937448FD221549b6E38483B)
 */
export const slotFactoryConfig = {
  address: slotFactoryAddress,
  abi: slotFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotsTestToken
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const slotsTestTokenAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
] as const

/**
 *
 */
export const slotsTestTokenAddress = {
  31337: '0xeE7d50f1E410c9B42Ae0D39C4549C17FA135add5',
} as const

/**
 *
 */
export const slotsTestTokenConfig = {
  address: slotsTestTokenAddress,
  abi: slotsTestTokenAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DeployBlocks
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The block each contract was deployed at, by chain id.
 *
 * Written by the deploy script, read here, and the lower bound for
 * every historical log query. See `deployBlockOf` in ./slots.ts.
 */
export const deployBlocks = {
  AdLand: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  MinimumTenureHook: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  OfferBook: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  Slot: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  SlotBoundNFTFactory: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  SlotCollective: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  SlotCollectiveFactory: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  SlotFactory: {
    '8453': 51090927,
    '31337': 0,
    '84532': 46601439,
    '11155111': 11669103,
  },
  SlotsTestToken: {
    '31337': 0,
  },
} as const
