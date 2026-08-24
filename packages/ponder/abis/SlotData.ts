/**
 * SlotData — events only.
 *
 * Narrow on purpose, like the other module ABIs here: ponder needs the log
 * shapes and nothing else, and a full artifact would drag every function
 * signature into a file that exists to decode three events.
 *
 * The writable ABI lives in `@0xslots/contracts` (`slotDataAbi`), which is what
 * the app calls. These two are edited together — see the note there.
 */
export const SlotDataAbi = [
  {
    type: "event",
    name: "ServiceRegistered",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      {
        name: "registrar",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "schema",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      { name: "name", type: "string", indexed: false, internalType: "string" },
      {
        name: "metadataURI",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Wrote",
    inputs: [
      { name: "slot", type: "address", indexed: true, internalType: "address" },
      {
        name: "serviceId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "writer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "generation",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      { name: "data", type: "bytes", indexed: false, internalType: "bytes" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Cleared",
    inputs: [
      { name: "slot", type: "address", indexed: true, internalType: "address" },
      {
        name: "generation",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
] as const;
