//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AdLand
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const adLandAbi = [
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
    name: 'PRIMARY',
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
                  { name: 'beforeSell', internalType: 'bool', type: 'bool' },
                  {
                    name: 'beforeSelfAssess',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterBuy', internalType: 'bool', type: 'bool' },
                  { name: 'afterSell', internalType: 'bool', type: 'bool' },
                  { name: 'afterRelease', internalType: 'bool', type: 'bool' },
                  {
                    name: 'afterLiquidate',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterSettle', internalType: 'bool', type: 'bool' },
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
                  { name: 'beforeSell', internalType: 'bool', type: 'bool' },
                  {
                    name: 'beforeSelfAssess',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterBuy', internalType: 'bool', type: 'bool' },
                  { name: 'afterSell', internalType: 'bool', type: 'bool' },
                  { name: 'afterRelease', internalType: 'bool', type: 'bool' },
                  {
                    name: 'afterLiquidate',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'afterSettle', internalType: 'bool', type: 'bool' },
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
    name: 'afterLiquidate',
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
    name: 'afterSell',
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
    name: 'beforeSell',
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
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
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
          { name: 'beforeSell', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterSell', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
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
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'NativeSlotHasNoPermit' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
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
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
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
 *
 */
export const adLandAddress = {
  31337: '0xBCAb83327128875D1d7Fcd1cA6937DbE81242139',
} as const

/**
 *
 */
export const adLandConfig = { address: adLandAddress, abi: adLandAbi } as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CompositeHook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const compositeHookAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'initial', internalType: 'address[]', type: 'address[]' },
      {
        name: 'flags',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSell', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterSell', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
        ],
      },
      { name: 'metadataURI_', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
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
    name: 'CHILD_GAS',
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
    name: 'MAX_CHILDREN',
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
    name: 'afterSell',
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
    name: 'beforeSell',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'childCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'children',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'declared',
    outputs: [
      { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
      { name: 'beforeSell', internalType: 'bool', type: 'bool' },
      { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
      { name: 'afterBuy', internalType: 'bool', type: 'bool' },
      { name: 'afterSell', internalType: 'bool', type: 'bool' },
      { name: 'afterRelease', internalType: 'bool', type: 'bool' },
      { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
      { name: 'afterSettle', internalType: 'bool', type: 'bool' },
    ],
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
          { name: 'data', internalType: 'bytes', type: 'bytes' },
          { name: 'metadataURI', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'metadataURI',
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
    inputs: [],
    name: 'subscriptions',
    outputs: [
      {
        name: '',
        internalType: 'struct HookFlags',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSell', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterSell', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'child',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'selector',
        internalType: 'bytes4',
        type: 'bytes4',
        indexed: false,
      },
    ],
    name: 'ChildCallFailed',
  },
  { type: 'error', inputs: [], name: 'ChildHasNoCode' },
  { type: 'error', inputs: [], name: 'TooManyChildren' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MinimumTenureHook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const minimumTenureHookAbi = [
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
    name: 'afterSell',
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
    name: 'beforeSell',
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
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
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
      { name: 'tenureSeconds', internalType: 'uint256', type: 'uint256' },
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
          { name: 'beforeSell', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterSell', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
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
    inputs: [{ name: 'data', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validateHookData',
    outputs: [],
    stateMutability: 'pure',
  },
  { type: 'error', inputs: [], name: 'PriceCutDuringTenure' },
  { type: 'error', inputs: [], name: 'TenureNotConfigured' },
  {
    type: 'error',
    inputs: [{ name: 'availableAt', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureNotElapsed',
  },
  {
    type: 'error',
    inputs: [{ name: 'max', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureTooLong',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'TenureUnderfunded',
  },
] as const

/**
 *
 */
export const minimumTenureHookAddress = {
  31337: '0xf78d2aD9d7aF6b10bC5Db7C8d162bf62C6Ed28C5',
} as const

/**
 *
 */
export const minimumTenureHookConfig = {
  address: minimumTenureHookAddress,
  abi: minimumTenureHookAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OfferBook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const offerBookAbi = [
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
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'bestOrder',
    outputs: [
      { name: 'found', internalType: 'bool', type: 'bool' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      {
        name: 'order',
        internalType: 'struct SellOrder',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'buyer', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
        ],
      },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
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
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
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
    inputs: [{ name: 'admin_', internalType: 'address', type: 'address' }],
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
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
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
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
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
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
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
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'orderOf',
    outputs: [
      {
        name: 'order',
        internalType: 'struct SellOrder',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'buyer', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
        ],
      },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
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
  { type: 'error', inputs: [], name: 'AlreadyCancelled' },
  { type: 'error', inputs: [], name: 'BadExpiry' },
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
  { type: 'error', inputs: [], name: 'NoSuchOffer' },
  { type: 'error', inputs: [], name: 'NotAdmin' },
  { type: 'error', inputs: [], name: 'NotBidder' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
  { type: 'error', inputs: [], name: 'ZeroAdmin' },
  { type: 'error', inputs: [], name: 'ZeroPrice' },
] as const

/**
 *
 */
export const offerBookAddress = {
  31337: '0xbB8662d362EE8312Ae1B15a6117F650933439347',
} as const

/**
 *
 */
export const offerBookConfig = {
  address: offerBookAddress,
  abi: offerBookAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Slot
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
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
    inputs: [{ name: 'nonce', internalType: 'uint256', type: 'uint256' }],
    name: 'cancelSellOrder',
    outputs: [],
    stateMutability: 'nonpayable',
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
              { name: 'beforeSell', internalType: 'bool', type: 'bool' },
              { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
              { name: 'afterBuy', internalType: 'bool', type: 'bool' },
              { name: 'afterSell', internalType: 'bool', type: 'bool' },
              { name: 'afterRelease', internalType: 'bool', type: 'bool' },
              { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
              { name: 'afterSettle', internalType: 'bool', type: 'bool' },
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
          { name: 'beforeSell', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterSell', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
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
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'orderNonce',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'orderUsed',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
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
      {
        name: 'order',
        internalType: 'struct SellOrder',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'buyer', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
        ],
      },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'sell',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'order',
        internalType: 'struct SellOrder',
        type: 'tuple',
        components: [
          { name: 'slot', internalType: 'address', type: 'address' },
          { name: 'buyer', internalType: 'address', type: 'address' },
          { name: 'price', internalType: 'uint256', type: 'uint256' },
          { name: 'deposit', internalType: 'uint256', type: 'uint256' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'deadline', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    name: 'sellOrderHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
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
      {
        name: 'buyer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'nonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'OrderCancelled',
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
        name: 'seller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'buyer',
        internalType: 'address',
        type: 'address',
        indexed: true,
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
    name: 'Sold',
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
  { type: 'error', inputs: [], name: 'OrderBadSignature' },
  { type: 'error', inputs: [], name: 'OrderExpired' },
  { type: 'error', inputs: [], name: 'OrderUsed' },
  { type: 'error', inputs: [], name: 'OrderWrongSlot' },
  { type: 'error', inputs: [], name: 'PaymentAboveMax' },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'SellNeedsErc20' },
  { type: 'error', inputs: [], name: 'TransferFailed' },
  { type: 'error', inputs: [], name: 'Vacant' },
] as const

/**
 *
 */
export const slotAddress = {
  31337: '0x32dAdCe13CEE40d01c8B807770a2418fF99e2B46',
} as const

/**
 *
 */
export const slotConfig = { address: slotAddress, abi: slotAbi } as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollective
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
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
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
    ],
    name: 'cancelHookProposal',
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
 *
 */
export const slotCollectiveAddress = {
  31337: '0x7a9436d5d20B3a3A66400d5DF85302cE49867671',
} as const

/**
 *
 */
export const slotCollectiveConfig = {
  address: slotCollectiveAddress,
  abi: slotCollectiveAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollectiveFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
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
 *
 */
export const slotCollectiveFactoryAddress = {
  31337: '0x13B0014f05438C430dC07b0A45C6FA52D7B6181d',
} as const

/**
 *
 */
export const slotCollectiveFactoryConfig = {
  address: slotCollectiveFactoryAddress,
  abi: slotCollectiveFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
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
    inputs: [
      { name: 'hook', internalType: 'address', type: 'address' },
      { name: 'attested', internalType: 'bool', type: 'bool' },
    ],
    name: 'attestHook',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'attestedHooks',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
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
      { name: 'hook', internalType: 'address', type: 'address', indexed: true },
      { name: 'attested', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'HookAttested',
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
 *
 */
export const slotFactoryAddress = {
  31337: '0x101082d0740310eC238dA7F728e30786Ae5CDd91',
} as const

/**
 *
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
