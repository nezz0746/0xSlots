//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AdLand
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 */
export const adLandAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'slotLens', internalType: 'contract SlotLens', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
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
    name: 'SLOT_LENS',
    outputs: [{ name: '', internalType: 'contract SlotLens', type: 'address' }],
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
              {
                name: 'currency',
                internalType: 'contract IERC20',
                type: 'address',
              },
              { name: 'manager', internalType: 'address', type: 'address' },
              { name: 'mutableTax', internalType: 'bool', type: 'bool' },
              { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
              { name: 'mutableModule', internalType: 'bool', type: 'bool' },
              {
                name: 'terms',
                internalType: 'struct Terms',
                type: 'tuple',
                components: [
                  {
                    name: 'taxTerms',
                    internalType: 'struct TaxTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'rateBps',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'minRunwaySeconds',
                        internalType: 'uint32',
                        type: 'uint32',
                      },
                    ],
                  },
                  {
                    name: 'moduleTerms',
                    internalType: 'struct ModuleTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'module',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'settings',
                        internalType: 'bytes',
                        type: 'bytes',
                      },
                    ],
                  },
                ],
              },
              {
                name: 'scopes',
                internalType: 'struct Scopes',
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
                  {
                    name: 'afterCallbacksMustSucceed',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'onInstall', internalType: 'bool', type: 'bool' },
                  { name: 'onUninstall', internalType: 'bool', type: 'bool' },
                ],
              },
              {
                name: 'fee',
                internalType: 'struct ModuleFee',
                type: 'tuple',
                components: [
                  { name: 'bps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
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
                name: 'pending',
                internalType: 'struct Pending',
                type: 'tuple',
                components: [
                  {
                    name: 'taxTerms',
                    internalType: 'struct TaxTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'rateBps',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'minRunwaySeconds',
                        internalType: 'uint32',
                        type: 'uint32',
                      },
                    ],
                  },
                  {
                    name: 'nextModule',
                    internalType: 'struct InstalledModule',
                    type: 'tuple',
                    components: [
                      {
                        name: 'module',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'scopes',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'fee',
                        internalType: 'struct ModuleFee',
                        type: 'tuple',
                        components: [
                          {
                            name: 'bps',
                            internalType: 'uint16',
                            type: 'uint16',
                          },
                          {
                            name: 'recipient',
                            internalType: 'address',
                            type: 'address',
                          },
                        ],
                      },
                      {
                        name: 'settings',
                        internalType: 'bytes',
                        type: 'bytes',
                      },
                    ],
                  },
                  { name: 'mask', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'proposedAt',
                    internalType: 'uint64',
                    type: 'uint64',
                  },
                ],
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
              {
                name: 'currency',
                internalType: 'contract IERC20',
                type: 'address',
              },
              { name: 'manager', internalType: 'address', type: 'address' },
              { name: 'mutableTax', internalType: 'bool', type: 'bool' },
              { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
              { name: 'mutableModule', internalType: 'bool', type: 'bool' },
              {
                name: 'terms',
                internalType: 'struct Terms',
                type: 'tuple',
                components: [
                  {
                    name: 'taxTerms',
                    internalType: 'struct TaxTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'rateBps',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'minRunwaySeconds',
                        internalType: 'uint32',
                        type: 'uint32',
                      },
                    ],
                  },
                  {
                    name: 'moduleTerms',
                    internalType: 'struct ModuleTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'module',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'settings',
                        internalType: 'bytes',
                        type: 'bytes',
                      },
                    ],
                  },
                ],
              },
              {
                name: 'scopes',
                internalType: 'struct Scopes',
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
                  {
                    name: 'afterCallbacksMustSucceed',
                    internalType: 'bool',
                    type: 'bool',
                  },
                  { name: 'onInstall', internalType: 'bool', type: 'bool' },
                  { name: 'onUninstall', internalType: 'bool', type: 'bool' },
                ],
              },
              {
                name: 'fee',
                internalType: 'struct ModuleFee',
                type: 'tuple',
                components: [
                  { name: 'bps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
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
                name: 'pending',
                internalType: 'struct Pending',
                type: 'tuple',
                components: [
                  {
                    name: 'taxTerms',
                    internalType: 'struct TaxTerms',
                    type: 'tuple',
                    components: [
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'rateBps',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'minRunwaySeconds',
                        internalType: 'uint32',
                        type: 'uint32',
                      },
                    ],
                  },
                  {
                    name: 'nextModule',
                    internalType: 'struct InstalledModule',
                    type: 'tuple',
                    components: [
                      {
                        name: 'module',
                        internalType: 'address',
                        type: 'address',
                      },
                      {
                        name: 'scopes',
                        internalType: 'uint16',
                        type: 'uint16',
                      },
                      {
                        name: 'fee',
                        internalType: 'struct ModuleFee',
                        type: 'tuple',
                        components: [
                          {
                            name: 'bps',
                            internalType: 'uint16',
                            type: 'uint16',
                          },
                          {
                            name: 'recipient',
                            internalType: 'address',
                            type: 'address',
                          },
                        ],
                      },
                      {
                        name: 'settings',
                        internalType: 'bytes',
                        type: 'bytes',
                      },
                    ],
                  },
                  { name: 'mask', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'proposedAt',
                    internalType: 'uint64',
                    type: 'uint64',
                  },
                ],
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
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'adConfig',
    outputs: [
      {
        name: 'c',
        internalType: 'struct AdConfig',
        type: 'tuple',
        components: [
          { name: 'tenureWindow', internalType: 'uint64', type: 'uint64' },
          {
            name: 'moderation',
            internalType: 'enum ModerationMode',
            type: 'uint8',
          },
          { name: 'key', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'settings', internalType: 'bytes', type: 'bytes' }],
    name: 'adConfigOf',
    outputs: [
      {
        name: 'c',
        internalType: 'struct AdConfig',
        type: 'tuple',
        components: [
          { name: 'tenureWindow', internalType: 'uint64', type: 'uint64' },
          {
            name: 'moderation',
            internalType: 'enum ModerationMode',
            type: 'uint8',
          },
          { name: 'key', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'pure',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'uriHash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'approveCreative',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'claimKey',
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
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'fee',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
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
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'moderationOf',
    outputs: [
      { name: 'current', internalType: 'enum ModerationMode', type: 'uint8' },
      {
        name: 'nextTenure',
        internalType: 'enum ModerationMode',
        type: 'uint8',
      },
      { name: 'submission', internalType: 'string', type: 'string' },
    ],
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onInstall',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onUninstall',
    outputs: [],
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
      { name: 'byOwner', internalType: 'bool', type: 'bool' },
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
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'uriHash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'rejectCreative',
    outputs: [],
    stateMutability: 'nonpayable',
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
      { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
      { name: 'window', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'requiredDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'settings', internalType: 'bytes', type: 'bytes' }],
    name: 'scopes',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
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
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'slotOf',
    outputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'tenureOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [],
    name: 'uiMetadata',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
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
    inputs: [{ name: 'settings', internalType: 'bytes', type: 'bytes' }],
    name: 'validateSettings',
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
      { name: 'uri', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'tenureId',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Approved',
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
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'uri', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'tenureId',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Rejected',
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
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'uri', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'tenureId',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Submitted',
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
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  {
    type: 'error',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'KeyTaken',
  },
  { type: 'error', inputs: [], name: 'MalformedSettings' },
  { type: 'error', inputs: [], name: 'NativeSlotHasNoPermit' },
  { type: 'error', inputs: [], name: 'NoSlotLens' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  {
    type: 'error',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'NotKeyOwner',
  },
  { type: 'error', inputs: [], name: 'NotOccupant' },
  { type: 'error', inputs: [], name: 'NotSlotManager' },
  { type: 'error', inputs: [], name: 'NotTheSlot' },
  { type: 'error', inputs: [], name: 'NothingPending' },
  { type: 'error', inputs: [], name: 'NothingToModerate' },
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
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'OwnerProposalPending',
  },
  { type: 'error', inputs: [], name: 'PriceCutDuringTenure' },
  {
    type: 'error',
    inputs: [{ name: 'key', internalType: 'bytes32', type: 'bytes32' }],
    name: 'ReservedKey',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'SubmissionChanged' },
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 */
export const adLandAddress = {
  31337: '0x74689fd663503fa619490Dc3Cd8E59B0CB37c713',
  84532: '0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B',
  11155111: '0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xCE7d6a6AFca496e2B5d0c5eFb93506Cf96a8906B)
 */
export const adLandConfig = { address: adLandAddress, abi: adLandAbi } as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MinimumTenureModule
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 */
export const minimumTenureModuleAbi = [
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'fee',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
      },
    ],
    stateMutability: 'pure',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onInstall',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'nonpayable',
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
      { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
      { name: 'window', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'requiredDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'scopes',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'tenureOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'uiMetadata',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'validateSettings',
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'BuyoutBelowPremium',
  },
  { type: 'error', inputs: [], name: 'NotTheSlot' },
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 */
export const minimumTenureModuleAddress = {
  31337: '0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048',
  84532: '0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048',
  11155111: '0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xfe1C478EaA1CE048A7Edc71529745cAbC9D9D048)
 */
export const minimumTenureModuleConfig = {
  address: minimumTenureModuleAddress,
  abi: minimumTenureModuleAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OfferBook
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 */
export const offerBookAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'minPrice', internalType: 'uint256', type: 'uint256' },
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
    inputs: [
      { name: 'slot', internalType: 'address', type: 'address' },
      { name: 'start', internalType: 'uint256', type: 'uint256' },
      { name: 'count', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'bestIn',
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
      { name: 'start', internalType: 'uint256', type: 'uint256' },
      { name: 'count', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'boardPage',
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
      { name: 'start', internalType: 'uint256', type: 'uint256' },
      { name: 'count', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'liveCountIn',
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
    inputs: [
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'minPrice', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'PriceBelowMinimum',
  },
  {
    type: 'error',
    inputs: [
      { name: 'owed', internalType: 'uint256', type: 'uint256' },
      { name: 'ceiling', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'QuoteAboveOffer',
  },
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 */
export const offerBookAddress = {
  31337: '0xa1AaceF14fe29Fd6f30496a80383A1DD87429f95',
  84532: '0x9d59B43895BAA9e53df3439eA77369132e0b167F',
  11155111: '0x9d59B43895BAA9e53df3439eA77369132e0b167F',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x9d59B43895BAA9e53df3439eA77369132e0b167F)
 */
export const offerBookConfig = {
  address: offerBookAddress,
  abi: offerBookAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Slot
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
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
    name: 'MAX_MIN_RUNWAY',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
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
    name: 'MODULE_CALLBACK_GAS_LIMIT',
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
    name: 'NATIVE_PAYOUT_GAS_LIMIT',
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
    inputs: [],
    name: 'TERM_MIN_RUNWAY',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TERM_MODULE',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TERM_RECIPIENT',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TERM_SCOPES',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'TERM_TAX_RATE',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'expected',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
      },
    ],
    name: 'acceptFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'expected', internalType: 'uint16', type: 'uint16' }],
    name: 'acceptScopes',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'applyTerms',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [{ name: 'mask', internalType: 'uint16', type: 'uint16' }],
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
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'claimableOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'debtOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    name: 'fee',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
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
    inputs: [
      {
        name: 'p',
        internalType: 'struct SlotInit',
        type: 'tuple',
        components: [
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
          { name: 'mutableModule', internalType: 'bool', type: 'bool' },
          {
            name: 'taxTerms',
            internalType: 'struct TaxTerms',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
              {
                name: 'minRunwaySeconds',
                internalType: 'uint32',
                type: 'uint32',
              },
            ],
          },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
    inputs: [{ name: 'price_', internalType: 'uint256', type: 'uint256' }],
    name: 'minDepositToHold',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'minRunwaySeconds',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'module',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'moduleTerms',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
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
    name: 'mutableModule',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'mutableRecipient',
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
      {
        name: '',
        internalType: 'struct Pending',
        type: 'tuple',
        components: [
          {
            name: 'taxTerms',
            internalType: 'struct TaxTerms',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
              {
                name: 'minRunwaySeconds',
                internalType: 'uint32',
                type: 'uint32',
              },
            ],
          },
          {
            name: 'nextModule',
            internalType: 'struct InstalledModule',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'scopes', internalType: 'uint16', type: 'uint16' },
              {
                name: 'fee',
                internalType: 'struct ModuleFee',
                type: 'tuple',
                components: [
                  { name: 'bps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
                ],
              },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
          { name: 'mask', internalType: 'uint16', type: 'uint16' },
          { name: 'proposedAt', internalType: 'uint64', type: 'uint64' },
        ],
      },
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
      {
        name: 'taxTerms',
        internalType: 'struct TaxTerms',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
        ],
      },
      {
        name: 'moduleTerms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
      },
      { name: 'mask', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'proposeTerms',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
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
    name: 'scopes',
    outputs: [
      {
        name: '',
        internalType: 'struct Scopes',
        type: 'tuple',
        components: [
          { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
          { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
          { name: 'afterBuy', internalType: 'bool', type: 'bool' },
          { name: 'afterRelease', internalType: 'bool', type: 'bool' },
          { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
          { name: 'afterSettle', internalType: 'bool', type: 'bool' },
          {
            name: 'afterCallbacksMustSucceed',
            internalType: 'bool',
            type: 'bool',
          },
          { name: 'onInstall', internalType: 'bool', type: 'bool' },
          { name: 'onUninstall', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
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
    inputs: [{ name: 'next', internalType: 'address', type: 'address' }],
    name: 'setManager',
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
    name: 'taxOwed',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'taxRateBps',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'taxTerms',
    outputs: [
      {
        name: '',
        internalType: 'struct TaxTerms',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
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
    inputs: [],
    name: 'terms',
    outputs: [
      {
        name: '',
        internalType: 'struct Terms',
        type: 'tuple',
        components: [
          {
            name: 'taxTerms',
            internalType: 'struct TaxTerms',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
              {
                name: 'minRunwaySeconds',
                internalType: 'uint32',
                type: 'uint32',
              },
            ],
          },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
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
    name: 'DebtRepaid',
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
      {
        name: 'fee',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
        indexed: false,
      },
    ],
    name: 'FeeAccepted',
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
        name: 'currency',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'manager',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'mutableTax',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
      {
        name: 'mutableRecipient',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
      {
        name: 'mutableModule',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
      {
        name: 'taxTerms',
        internalType: 'struct TaxTerms',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'moduleTerms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
        indexed: false,
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
        name: 'previous',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'next', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'ManagerSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'module',
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
    name: 'ModuleCallFailed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'module',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ModuleDropped',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'module',
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
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ModuleFeePaid',
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
        name: 'scopes',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'ScopesAccepted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'module',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'scopes',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'ScopesDropped',
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
        name: 'taxTerms',
        internalType: 'struct TaxTerms',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'moduleTerms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
        indexed: false,
      },
      {
        name: 'scopes',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'fee',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
        indexed: false,
      },
      { name: 'mask', internalType: 'uint16', type: 'uint16', indexed: false },
    ],
    name: 'TermsApplied',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'mask', internalType: 'uint16', type: 'uint16', indexed: false },
    ],
    name: 'TermsCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'taxTerms',
        internalType: 'struct TaxTerms',
        type: 'tuple',
        components: [
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'moduleTerms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
        indexed: false,
      },
      { name: 'mask', internalType: 'uint16', type: 'uint16', indexed: false },
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
  {
    type: 'error',
    inputs: [
      { name: 'sent', internalType: 'uint256', type: 'uint256' },
      { name: 'received', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'CurrencyTakesACut',
  },
  { type: 'error', inputs: [], name: 'DebtOutstanding' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'FeeChanged' },
  { type: 'error', inputs: [], name: 'InvalidCurrency' },
  { type: 'error', inputs: [], name: 'InvalidDeposit' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'InvalidManager' },
  { type: 'error', inputs: [], name: 'InvalidModule' },
  { type: 'error', inputs: [], name: 'InvalidModuleFee' },
  { type: 'error', inputs: [], name: 'InvalidPrice' },
  { type: 'error', inputs: [], name: 'InvalidRecipient' },
  { type: 'error', inputs: [], name: 'InvalidRunway' },
  { type: 'error', inputs: [], name: 'InvalidTax' },
  { type: 'error', inputs: [], name: 'InvalidValue' },
  { type: 'error', inputs: [], name: 'ModuleChangeQueued' },
  { type: 'error', inputs: [], name: 'ModuleGasTooLow' },
  { type: 'error', inputs: [], name: 'ModuleTooExpensive' },
  { type: 'error', inputs: [], name: 'NoPendingTerms' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  { type: 'error', inputs: [], name: 'NotInsolvent' },
  { type: 'error', inputs: [], name: 'NotManager' },
  { type: 'error', inputs: [], name: 'NotMutable' },
  { type: 'error', inputs: [], name: 'NotOccupant' },
  { type: 'error', inputs: [], name: 'NotOccupantOrOperator' },
  { type: 'error', inputs: [], name: 'NothingProposed' },
  { type: 'error', inputs: [], name: 'NothingToAccept' },
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
  { type: 'error', inputs: [], name: 'ScopesChanged' },
  { type: 'error', inputs: [], name: 'TransferFailed' },
  { type: 'error', inputs: [], name: 'UnknownTerms' },
  { type: 'error', inputs: [], name: 'Vacant' },
] as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
 */
export const slotAddress = {
  31337: '0xd24e03b69Ed80Bbf6Bb320F826CFF21d203452A1',
  84532: '0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1',
  11155111: '0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x5a6369D32722a3a5b1E9e7239271c3Bd10d450C1)
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
      { name: 'taxRateBps_', internalType: 'uint16', type: 'uint16' },
      { name: 'minRunwaySeconds_', internalType: 'uint32', type: 'uint32' },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'fee',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
      },
    ],
    stateMutability: 'pure',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onInstall',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onUninstall',
    outputs: [],
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
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'scopes',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'pure',
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
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
          { name: 'mutableModule', internalType: 'bool', type: 'bool' },
          {
            name: 'taxTerms',
            internalType: 'struct TaxTerms',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
              {
                name: 'minRunwaySeconds',
                internalType: 'uint32',
                type: 'uint32',
              },
            ],
          },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'validateSettings',
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
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
          { name: 'taxRateBps', internalType: 'uint16', type: 'uint16' },
          { name: 'minRunwaySeconds', internalType: 'uint32', type: 'uint32' },
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
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'wrapFeeWei', internalType: 'uint256', type: 'uint256' },
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
      {
        name: 'wrapperImplementation',
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
      {
        name: 'owner',
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
      {
        name: 'wrapFeeWei',
        internalType: 'uint256',
        type: 'uint256',
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
 */
export const slotBoundNftFactoryAddress = {
  31337: '0x49f182E33e6f803A3f74F3EB4FD6b23A6811C526',
  84532: '0x930B546078c110E43Bbf8A6c18651120c8a7b820',
  11155111: '0x930B546078c110E43Bbf8A6c18651120c8a7b820',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x930B546078c110E43Bbf8A6c18651120c8a7b820)
 */
export const slotBoundNftFactoryConfig = {
  address: slotBoundNftFactoryAddress,
  abi: slotBoundNftFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotBoundNFTWrapper
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 */
export const slotBoundNftWrapperAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    inputs: [],
    name: 'MIN_RUNWAY_SECONDS',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'beforeSelfAssess',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'fee',
    outputs: [
      {
        name: '',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
      },
    ],
    stateMutability: 'pure',
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
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'wrapFeeWei_', internalType: 'uint256', type: 'uint256' },
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onInstall',
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
          { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
          { name: 'currentPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'newPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'taxOwed', internalType: 'uint256', type: 'uint256' },
          { name: 'taxPaid', internalType: 'uint256', type: 'uint256' },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    name: 'onUninstall',
    outputs: [],
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
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'valuation', internalType: 'uint256', type: 'uint256' },
      { name: 'taxRateBps', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'quoteWrap',
    outputs: [
      { name: 'total', internalType: 'uint256', type: 'uint256' },
      { name: 'deposit', internalType: 'uint256', type: 'uint256' },
      { name: 'wrapFee', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
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
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'scopes',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'pure',
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
    inputs: [{ name: 'feeWei', internalType: 'uint256', type: 'uint256' }],
    name: 'setWrapFee',
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
    inputs: [
      { name: 'underlying', internalType: 'contract IERC721', type: 'address' },
      { name: 'underlyingId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'tokenIdOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [{ name: 'next', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    name: 'validateSettings',
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
      { name: 'taxRateBps', internalType: 'uint16', type: 'uint16' },
      { name: 'valuation', internalType: 'uint256', type: 'uint256' },
      { name: 'mode', internalType: 'enum Mode', type: 'uint8' },
      { name: 'maxFee', internalType: 'uint256', type: 'uint256' },
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
    inputs: [],
    name: 'wrapFeeWei',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    ],
    name: 'OwnershipTransferred',
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
      { name: 'fee', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'WrapFeeSet',
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
        name: 'taxRateBps',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'fee', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'Wrapped',
  },
  { type: 'error', inputs: [], name: 'AlreadyWrapped' },
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
      { name: 'fee', internalType: 'uint256', type: 'uint256' },
      { name: 'maxFee', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'FeeAboveMax',
  },
  {
    type: 'error',
    inputs: [{ name: 'required', internalType: 'uint256', type: 'uint256' }],
    name: 'FeeUnpaid',
  },
  {
    type: 'error',
    inputs: [
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
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
  { type: 'error', inputs: [], name: 'NotOwner' },
  { type: 'error', inputs: [], name: 'NotReceived' },
  { type: 'error', inputs: [], name: 'NotReclaimable' },
  { type: 'error', inputs: [], name: 'NotTransferable' },
  { type: 'error', inputs: [], name: 'Occupied' },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  { type: 'error', inputs: [], name: 'SlotRetired' },
  { type: 'error', inputs: [], name: 'UnsolicitedTransfer' },
] as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 */
export const slotBoundNftWrapperAddress = {
  31337: '0x508C83eefCEC4FfeEa64De5f7581892644068e6e',
  84532: '0x508C83eefCEC4FfeEa64De5f7581892644068e6e',
  11155111: '0x508C83eefCEC4FfeEa64De5f7581892644068e6e',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x508C83eefCEC4FfeEa64De5f7581892644068e6e)
 */
export const slotBoundNftWrapperConfig = {
  address: slotBoundNftWrapperAddress,
  abi: slotBoundNftWrapperAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollective
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x0409B7539f5bd5701771551F361CFA415b547453)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x0409B7539f5bd5701771551F361CFA415b547453)
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
      {
        name: 'expected',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
      },
    ],
    name: 'acceptFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
      { name: 'expected', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'acceptScopes',
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'cancelModuleProposal',
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
    name: 'cancelModuleProposalBatch',
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
            name: 'policyManagers',
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
    inputs: [{ name: 'data', internalType: 'bytes[]', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', internalType: 'bytes[]', type: 'bytes[]' }],
    stateMutability: 'nonpayable',
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
      {
        name: 'terms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'proposeModule',
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
      {
        name: 'terms',
        internalType: 'struct ModuleTerms',
        type: 'tuple',
        components: [
          { name: 'module', internalType: 'address', type: 'address' },
          { name: 'settings', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'proposeModuleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'slot', internalType: 'contract IManagedSlot', type: 'address' },
      { name: 'newTaxRateBps', internalType: 'uint16', type: 'uint16' },
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
      { name: 'newTaxRateBps', internalType: 'uint16', type: 'uint16' },
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
        name: 'current',
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
        name: 'next',
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
      { name: 'tokens', internalType: 'address[]', type: 'address[]' },
      {
        name: 'slots',
        internalType: 'contract IManagedSlot[]',
        type: 'address[]',
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
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'fee',
        internalType: 'struct ModuleFee',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'recipient', internalType: 'address', type: 'address' },
        ],
        indexed: false,
      },
    ],
    name: 'FeeAcceptRelayed',
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
      { name: 'slot', internalType: 'address', type: 'address', indexed: true },
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'scopes',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'ScopesAcceptRelayed',
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
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  { type: 'error', inputs: [], name: 'AdminRequired' },
  { type: 'error', inputs: [], name: 'DeployedByAnAccount' },
  { type: 'error', inputs: [], name: 'EmptySplit' },
  { type: 'error', inputs: [], name: 'FailedCall' },
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x0409B7539f5bd5701771551F361CFA415b547453)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x0409B7539f5bd5701771551F361CFA415b547453)
 */
export const slotCollectiveAddress = {
  31337: '0xE339626ee3ee6781847aaC705d0Bb4Ee5aC2786D',
  84532: '0x0409B7539f5bd5701771551F361CFA415b547453',
  11155111: '0x0409B7539f5bd5701771551F361CFA415b547453',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x0409B7539f5bd5701771551F361CFA415b547453)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x0409B7539f5bd5701771551F361CFA415b547453)
 */
export const slotCollectiveConfig = {
  address: slotCollectiveAddress,
  abi: slotCollectiveAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotCollectiveFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
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
            name: 'policyManagers',
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
 */
export const slotCollectiveFactoryAddress = {
  31337: '0x479763e6b4041aDB4d9a302CCbB8CB17a7BFe69A',
  84532: '0x019a3a241e5326e79Bc31F1F2008866737468e5d',
  11155111: '0x019a3a241e5326e79Bc31F1F2008866737468e5d',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0x019a3a241e5326e79Bc31F1F2008866737468e5d)
 */
export const slotCollectiveFactoryConfig = {
  address: slotCollectiveFactoryAddress,
  abi: slotCollectiveFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
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
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
          { name: 'mutableModule', internalType: 'bool', type: 'bool' },
          {
            name: 'taxTerms',
            internalType: 'struct TaxTerms',
            type: 'tuple',
            components: [
              { name: 'recipient', internalType: 'address', type: 'address' },
              { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
              {
                name: 'minRunwaySeconds',
                internalType: 'uint32',
                type: 'uint32',
              },
            ],
          },
          {
            name: 'moduleTerms',
            internalType: 'struct ModuleTerms',
            type: 'tuple',
            components: [
              { name: 'module', internalType: 'address', type: 'address' },
              { name: 'settings', internalType: 'bytes', type: 'bytes' },
            ],
          },
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
        name: 'module',
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
 */
export const slotFactoryAddress = {
  31337: '0xce69CCac3c7bb8d03a37Fa6519b2c8893CbB85C8',
  84532: '0xc696f795584cFbbC837B04A69746E8DAC2b1B76c',
  11155111: '0xc696f795584cFbbC837B04A69746E8DAC2b1B76c',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xc696f795584cFbbC837B04A69746E8DAC2b1B76c)
 */
export const slotFactoryConfig = {
  address: slotFactoryAddress,
  abi: slotFactoryAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SlotLens
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 */
export const slotLensAbi = [
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
          {
            name: 'moduleCallbackGasLimit',
            internalType: 'uint256',
            type: 'uint256',
          },
          {
            name: 'nativePayoutGasLimit',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'termsDelay', internalType: 'uint64', type: 'uint64' },
          { name: 'maxMinRunway', internalType: 'uint256', type: 'uint256' },
          { name: 'termTaxRate', internalType: 'uint16', type: 'uint16' },
          { name: 'termRecipient', internalType: 'uint16', type: 'uint16' },
          { name: 'termMinRunway', internalType: 'uint16', type: 'uint16' },
          { name: 'termModule', internalType: 'uint16', type: 'uint16' },
          { name: 'termScopes', internalType: 'uint16', type: 'uint16' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'getSlotInfo',
    outputs: [
      {
        name: 'info',
        internalType: 'struct SlotInfo',
        type: 'tuple',
        components: [
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
          { name: 'mutableModule', internalType: 'bool', type: 'bool' },
          {
            name: 'terms',
            internalType: 'struct Terms',
            type: 'tuple',
            components: [
              {
                name: 'taxTerms',
                internalType: 'struct TaxTerms',
                type: 'tuple',
                components: [
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
                  { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'minRunwaySeconds',
                    internalType: 'uint32',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'moduleTerms',
                internalType: 'struct ModuleTerms',
                type: 'tuple',
                components: [
                  { name: 'module', internalType: 'address', type: 'address' },
                  { name: 'settings', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          {
            name: 'scopes',
            internalType: 'struct Scopes',
            type: 'tuple',
            components: [
              { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
              { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
              { name: 'afterBuy', internalType: 'bool', type: 'bool' },
              { name: 'afterRelease', internalType: 'bool', type: 'bool' },
              { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
              { name: 'afterSettle', internalType: 'bool', type: 'bool' },
              {
                name: 'afterCallbacksMustSucceed',
                internalType: 'bool',
                type: 'bool',
              },
              { name: 'onInstall', internalType: 'bool', type: 'bool' },
              { name: 'onUninstall', internalType: 'bool', type: 'bool' },
            ],
          },
          {
            name: 'fee',
            internalType: 'struct ModuleFee',
            type: 'tuple',
            components: [
              { name: 'bps', internalType: 'uint16', type: 'uint16' },
              { name: 'recipient', internalType: 'address', type: 'address' },
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
          {
            name: 'pending',
            internalType: 'struct Pending',
            type: 'tuple',
            components: [
              {
                name: 'taxTerms',
                internalType: 'struct TaxTerms',
                type: 'tuple',
                components: [
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
                  { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'minRunwaySeconds',
                    internalType: 'uint32',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'nextModule',
                internalType: 'struct InstalledModule',
                type: 'tuple',
                components: [
                  { name: 'module', internalType: 'address', type: 'address' },
                  { name: 'scopes', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'fee',
                    internalType: 'struct ModuleFee',
                    type: 'tuple',
                    components: [
                      { name: 'bps', internalType: 'uint16', type: 'uint16' },
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                    ],
                  },
                  { name: 'settings', internalType: 'bytes', type: 'bytes' },
                ],
              },
              { name: 'mask', internalType: 'uint16', type: 'uint16' },
              { name: 'proposedAt', internalType: 'uint64', type: 'uint64' },
            ],
          },
          { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'slots', internalType: 'address[]', type: 'address[]' }],
    name: 'getSlotInfos',
    outputs: [
      {
        name: 'infos',
        internalType: 'struct SlotInfo[]',
        type: 'tuple[]',
        components: [
          {
            name: 'currency',
            internalType: 'contract IERC20',
            type: 'address',
          },
          { name: 'manager', internalType: 'address', type: 'address' },
          { name: 'mutableTax', internalType: 'bool', type: 'bool' },
          { name: 'mutableRecipient', internalType: 'bool', type: 'bool' },
          { name: 'mutableModule', internalType: 'bool', type: 'bool' },
          {
            name: 'terms',
            internalType: 'struct Terms',
            type: 'tuple',
            components: [
              {
                name: 'taxTerms',
                internalType: 'struct TaxTerms',
                type: 'tuple',
                components: [
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
                  { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'minRunwaySeconds',
                    internalType: 'uint32',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'moduleTerms',
                internalType: 'struct ModuleTerms',
                type: 'tuple',
                components: [
                  { name: 'module', internalType: 'address', type: 'address' },
                  { name: 'settings', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          {
            name: 'scopes',
            internalType: 'struct Scopes',
            type: 'tuple',
            components: [
              { name: 'beforeBuy', internalType: 'bool', type: 'bool' },
              { name: 'beforeSelfAssess', internalType: 'bool', type: 'bool' },
              { name: 'afterBuy', internalType: 'bool', type: 'bool' },
              { name: 'afterRelease', internalType: 'bool', type: 'bool' },
              { name: 'afterLiquidate', internalType: 'bool', type: 'bool' },
              { name: 'afterSettle', internalType: 'bool', type: 'bool' },
              {
                name: 'afterCallbacksMustSucceed',
                internalType: 'bool',
                type: 'bool',
              },
              { name: 'onInstall', internalType: 'bool', type: 'bool' },
              { name: 'onUninstall', internalType: 'bool', type: 'bool' },
            ],
          },
          {
            name: 'fee',
            internalType: 'struct ModuleFee',
            type: 'tuple',
            components: [
              { name: 'bps', internalType: 'uint16', type: 'uint16' },
              { name: 'recipient', internalType: 'address', type: 'address' },
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
          {
            name: 'pending',
            internalType: 'struct Pending',
            type: 'tuple',
            components: [
              {
                name: 'taxTerms',
                internalType: 'struct TaxTerms',
                type: 'tuple',
                components: [
                  {
                    name: 'recipient',
                    internalType: 'address',
                    type: 'address',
                  },
                  { name: 'rateBps', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'minRunwaySeconds',
                    internalType: 'uint32',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'nextModule',
                internalType: 'struct InstalledModule',
                type: 'tuple',
                components: [
                  { name: 'module', internalType: 'address', type: 'address' },
                  { name: 'scopes', internalType: 'uint16', type: 'uint16' },
                  {
                    name: 'fee',
                    internalType: 'struct ModuleFee',
                    type: 'tuple',
                    components: [
                      { name: 'bps', internalType: 'uint16', type: 'uint16' },
                      {
                        name: 'recipient',
                        internalType: 'address',
                        type: 'address',
                      },
                    ],
                  },
                  { name: 'settings', internalType: 'bytes', type: 'bytes' },
                ],
              },
              { name: 'mask', internalType: 'uint16', type: 'uint16' },
              { name: 'proposedAt', internalType: 'uint64', type: 'uint64' },
            ],
          },
          { name: 'hasRipeTerms', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
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
    inputs: [{ name: 'slot', internalType: 'address', type: 'address' }],
    name: 'moduleUpdate',
    outputs: [
      {
        name: 'u',
        internalType: 'struct ModuleUpdate',
        type: 'tuple',
        components: [
          { name: 'currentScopes', internalType: 'uint16', type: 'uint16' },
          {
            name: 'currentFee',
            internalType: 'struct ModuleFee',
            type: 'tuple',
            components: [
              { name: 'bps', internalType: 'uint16', type: 'uint16' },
              { name: 'recipient', internalType: 'address', type: 'address' },
            ],
          },
          { name: 'answered', internalType: 'bool', type: 'bool' },
          { name: 'declaredScopes', internalType: 'uint16', type: 'uint16' },
          {
            name: 'declaredFee',
            internalType: 'struct ModuleFee',
            type: 'tuple',
            components: [
              { name: 'bps', internalType: 'uint16', type: 'uint16' },
              { name: 'recipient', internalType: 'address', type: 'address' },
            ],
          },
          { name: 'feeDiffers', internalType: 'bool', type: 'bool' },
          { name: 'scopesDiffer', internalType: 'bool', type: 'bool' },
        ],
      },
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
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 */
export const slotLensAddress = {
  31337: '0x2F228AA7383d6D12B4160251F67b2010C134f614',
  84532: '0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2',
  11155111: '0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2',
} as const

/**
 * -
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 * - [__View Contract on Sepolia Etherscan__](https://sepolia.etherscan.io/address/0xAD9Bb2Af916eE7FA92371b143c3eBDD52f0825E2)
 */
export const slotLensConfig = {
  address: slotLensAddress,
  abi: slotLensAbi,
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
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  MinimumTenureModule: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  OfferBook: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  Slot: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotBoundNFTFactory: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotBoundNFTWrapper: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotCollective: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotCollectiveFactory: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotFactory: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotLens: {
    '31337': 3,
    '84532': 47415623,
    '11155111': 11800602,
  },
  SlotsTestToken: {
    '31337': 0,
  },
} as const
