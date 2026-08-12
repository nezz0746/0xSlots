import {
  type SlotConfig,
  type SlotInitParams,
  SlotsChain,
  SlotsClient,
} from "@0xslots/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { z } from "zod";

// @0xslots/contracts used internally by SDK
// ── Config ──────────────────────────────────────────────────────────────────
const RPC_URL =
  process.env.RPC_URL ||
  "https://base-sepolia.g.alchemy.com/v2/4XrtaFg8OqFaNxv45MreCFT3ekifcxWm";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
// MetadataModule is per-deployment and not in the addresses map, so writes need
// it supplied explicitly.
const METADATA_MODULE = process.env.METADATA_MODULE_ADDRESS as
  | Address
  | undefined;
const CHAIN_ID = Number(
  process.env.CHAIN_ID || SlotsChain.BASE_SEPOLIA,
) as SlotsChain;

const chain = baseSepolia;
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

function getWalletClient() {
  if (!PRIVATE_KEY)
    throw new Error("PRIVATE_KEY env required for write operations");
  const key = (
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain, transport: http(RPC_URL) });
}

const walletClient = PRIVATE_KEY ? getWalletClient() : undefined;

const client = new SlotsClient({
  chainId: CHAIN_ID,
  publicClient: publicClient as any,
  walletClient: walletClient as any,
  apiUrl: process.env.PONDER_URL,
});

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function msg(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function getCurrencyDecimals(currency: Address): Promise<number> {
  try {
    return (await publicClient.readContract({
      address: currency,
      abi: erc20Abi,
      functionName: "decimals",
    })) as number;
  } catch {
    return 18;
  }
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "0xSlots MCP",
  version: "1.0.0",
});

// ════════════════════════════════════════════════════════════════════════════
// READ TOOLS
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "get_slot",
  "Get full slot info via on-chain RPC (real-time deposit, tax owed, liquidation timer, etc.)",
  { slot: z.string().describe("Slot contract address") },
  async ({ slot }) => {
    const info = await client.getSlotInfo(slot as Address);
    const decimals = await getCurrencyDecimals(info.currency as Address);
    return ok({
      recipient: info.recipient,
      currency: info.currency,
      manager: info.manager,
      mutableTax: info.mutableTax,
      mutableUtility: info.mutableUtility,
      mutablePolicy: info.mutablePolicy,
      occupant: info.occupant,
      price: formatUnits(info.price, decimals),
      taxPercentage: `${Number(info.taxPercentage) / 100}%`,
      utility: info.utility,
      liquidationBountyBps: Number(info.liquidationBountyBps),
      minDepositSeconds: Number(info.minDepositSeconds),
      deposit: formatUnits(info.deposit, decimals),
      collectedTax: formatUnits(info.collectedTax, decimals),
      taxOwed: formatUnits(info.taxOwed, decimals),
      secondsUntilLiquidation: Number(info.secondsUntilLiquidation),
      insolvent: info.insolvent,
      // Queued changes, one per dimension. `proposedAt` is surfaced because a
      // caller cannot otherwise tell a change queued last week from one queued
      // seconds ago — and a buy applies whatever is queued at that moment.
      // Null timestamps mean the slot predates the contract recording them.
      hasPendingTax: info.hasPendingTax,
      pendingTaxPercentage: info.hasPendingTax
        ? `${Number(info.pendingTaxPercentage) / 100}%`
        : null,
      taxProposedAt: info.taxProposedAt ? Number(info.taxProposedAt) : null,
      hasPendingUtility: info.hasPendingUtility,
      pendingUtility: info.hasPendingUtility ? info.pendingUtility : null,
      utilityProposedAt: info.utilityProposedAt
        ? Number(info.utilityProposedAt)
        : null,
      hasPendingPolicy: info.hasPendingPolicy,
      pendingPolicy: info.hasPendingPolicy ? info.pendingPolicy : null,
      policyProposedAt: info.policyProposedAt
        ? Number(info.policyProposedAt)
        : null,
    });
  },
);

server.tool(
  "list_slots",
  "List slots from subgraph (filter by recipient, occupant, or all)",
  {
    recipient: z.string().optional().describe("Filter by recipient address"),
    occupant: z.string().optional().describe("Filter by occupant address"),
    first: z.number().optional().describe("Number of results (default 20)"),
  },
  async ({ recipient, occupant, first }) => {
    if (recipient) {
      const data = await client.getSlotsByRecipient({
        recipient: recipient.toLowerCase(),
        limit: first || 20,
      });
      return ok(data);
    }
    if (occupant) {
      const data = await client.getSlotsByOccupant({
        occupant: occupant.toLowerCase(),
        limit: first || 20,
      });
      return ok(data);
    }
    const data = await client.getSlots({ limit: first || 20 });
    return ok(data);
  },
);

server.tool(
  "list_events",
  "List recent protocol events across all slots",
  {
    first: z.number().optional().describe("Number of results (default 20)"),
  },
  async ({ first }) => {
    const data = await client.getRecentEvents({ limit: first || 20 });
    return ok(data);
  },
);

server.tool(
  "get_slot_activity",
  "Get all activity for a specific slot (all event types)",
  {
    slot: z.string().describe("Slot contract address"),
    first: z
      .number()
      .optional()
      .describe("Number of results per type (default 10)"),
  },
  async ({ slot, first }) => {
    const data = await client.getSlotActivity({
      slot: slot.toLowerCase(),
      limit: first || 10,
    });
    return ok(data);
  },
);

server.tool(
  "get_modules",
  "List verified modules registered on the factory",
  {},
  async () => {
    const data = await client.getModules({});
    return ok(data);
  },
);

server.tool(
  "get_account",
  "Get account info (slots as recipient, slots as occupant)",
  { address: z.string().describe("Account address") },
  async ({ address }) => {
    const data = await client.getAccount({ id: address.toLowerCase() });
    return ok(data);
  },
);

server.tool(
  "get_factory",
  "Get factory info (slot count, modules)",
  {},
  async () => {
    const data = await client.getFactory();
    return ok(data);
  },
);

server.tool(
  "get_subgraph_meta",
  "Get subgraph indexing status (latest block, indexing errors)",
  {},
  async () => {
    const data = await client.getMeta();
    return ok(data);
  },
);

server.tool(
  "get_metadata",
  "Get metadata URI for a slot via MetadataModule",
  { slot: z.string().describe("Slot contract address") },
  async ({ slot }) => {
    const data = await client.modules.metadata.getSlot({
      id: slot.toLowerCase(),
    });
    return ok(data);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// WRITE TOOLS
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "buy_slot",
  "Buy or force-buy a slot. Auto-handles ERC20 approval. Provide self-assessed price and deposit.",
  {
    slot: z.string().describe("Slot contract address"),
    selfAssessedPrice: z
      .string()
      .describe("Your self-assessed price (in token units, e.g. '100')"),
    deposit: z.string().describe("Deposit amount (in token units)"),
    decimals: z
      .number()
      .optional()
      .describe("Token decimals (default 6 for USDC)"),
  },
  async ({ slot, selfAssessedPrice, deposit, decimals: dec }) => {
    const decimals = dec || 6;
    const hash = await client.buy({
      slot: slot as Address,
      // The occupant to buy for. This server only ever holds one key, so the
      // wallet's own address is the only sensible answer.
      account: getWalletClient().account.address,
      selfAssessedPrice: parseUnits(selfAssessedPrice, decimals),
      depositAmount: parseUnits(deposit, decimals),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(
      `Slot bought! Price: ${selfAssessedPrice}, Deposit: ${deposit}\ntx: ${hash}\nStatus: ${receipt.status}`,
    );
  },
);

server.tool(
  "release_slot",
  "Release a slot you occupy (refunds remaining deposit)",
  { slot: z.string().describe("Slot contract address") },
  async ({ slot }) => {
    const hash = await client.release(slot as Address);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Slot released! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "deposit_to_slot",
  "Add deposit to a slot you occupy (extends time before liquidation). Auto-handles ERC20 approval.",
  {
    slot: z.string().describe("Slot contract address"),
    amount: z.string().describe("Amount to deposit (in token units)"),
    decimals: z.number().optional().describe("Token decimals (default 6)"),
  },
  async ({ slot, amount, decimals: dec }) => {
    const decimals = dec || 6;
    const hash = await client.topUp(
      slot as Address,
      parseUnits(amount, decimals),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Deposited ${amount}! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "withdraw_from_slot",
  "Withdraw deposit from a slot you occupy (must keep minimum deposit)",
  {
    slot: z.string().describe("Slot contract address"),
    amount: z.string().describe("Amount to withdraw (in token units)"),
    decimals: z.number().optional().describe("Token decimals (default 6)"),
  },
  async ({ slot, amount, decimals: dec }) => {
    const decimals = dec || 6;
    const hash = await client.withdraw(
      slot as Address,
      parseUnits(amount, decimals),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Withdrawn ${amount}! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "self_assess",
  "Update the self-assessed price of a slot you occupy",
  {
    slot: z.string().describe("Slot contract address"),
    newPrice: z.string().describe("New price (in token units)"),
    decimals: z.number().optional().describe("Token decimals (default 6)"),
  },
  async ({ slot, newPrice, decimals: dec }) => {
    const decimals = dec || 6;
    const hash = await client.selfAssess(
      slot as Address,
      parseUnits(newPrice, decimals),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(
      `Price updated to ${newPrice}! tx: ${hash}\nStatus: ${receipt.status}`,
    );
  },
);

server.tool(
  "collect_tax",
  "Collect accumulated tax from a slot (permissionless — anyone can call)",
  { slot: z.string().describe("Slot contract address") },
  async ({ slot }) => {
    const hash = await client.collect(slot as Address);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Tax collected! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "collect_all",
  "Batch-collect tax from multiple slots in a single transaction via the factory. Skips unregistered slots and slots with nothing to collect.",
  { slots: z.array(z.string()).describe("Array of slot contract addresses") },
  async ({ slots }) => {
    const hash = await client.collectAll(slots as Address[]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(
      `Batch collect done! tx: ${hash}\nStatus: ${receipt.status}\nSlots processed: ${slots.length}`,
    );
  },
);

server.tool(
  "liquidate_slot",
  "Liquidate an insolvent slot (permissionless — earn bounty if configured)",
  { slot: z.string().describe("Slot contract address") },
  async ({ slot }) => {
    const hash = await client.liquidate(slot as Address);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Slot liquidated! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "create_slot",
  "Deploy a new Harberger-taxed slot via the factory",
  {
    recipient: z.string().describe("Address that receives tax revenue"),
    currency: z.string().describe("ERC20 token address for payments"),
    mutableTax: z.boolean().describe("Can tax be changed by manager?"),
    mutableModule: z.boolean().describe("Can module be changed by manager?"),
    manager: z
      .string()
      .optional()
      .describe("Manager address (required if mutableTax or mutableModule)"),
    taxPercentage: z
      .number()
      .describe("Tax rate in basis points (e.g. 1000 = 10%)"),
    module: z.string().optional().describe("Module address (default: none)"),
    liquidationBountyBps: z
      .number()
      .optional()
      .describe("Liquidation bounty in bps (default 0)"),
    minDepositSeconds: z
      .number()
      .optional()
      .describe("Minimum deposit in seconds (default 86400 = 1 day)"),
  },
  async ({
    recipient,
    currency,
    mutableTax,
    mutableModule,
    manager,
    taxPercentage,
    module,
    liquidationBountyBps,
    minDepositSeconds,
  }) => {
    const wallet = getWalletClient();
    const mgr =
      mutableTax || mutableModule
        ? (manager as Address) || wallet.account!.address
        : "0x0000000000000000000000000000000000000000";

    const hash = await client.createSlot({
      recipient: recipient as Address,
      currency: currency as Address,
      config: {
        mutableTax,
        mutableUtility: mutableModule,
        // The occupancy policy is not exposed as a tool argument yet; an
        // immutable policy is the conservative default.
        mutablePolicy: false,
        manager: mgr as Address,
      },
      initParams: {
        taxPercentage: BigInt(taxPercentage),
        module: (module ||
          "0x0000000000000000000000000000000000000000") as Address,
        liquidationBountyBps: BigInt(liquidationBountyBps || 0),
        minDepositSeconds: BigInt(minDepositSeconds || 86400),
        // Zero = plain instant buy, no forced-sale veto.
        occupancyPolicy: "0x0000000000000000000000000000000000000000",
      },
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Slot created!\ntx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "update_metadata",
  "Update metadata URI on a slot via MetadataModule (must be occupant)",
  {
    slot: z.string().describe("Slot contract address"),
    uri: z.string().describe("New metadata URI"),
  },
  async ({ slot, uri }) => {
    if (!METADATA_MODULE)
      throw new Error("METADATA_MODULE_ADDRESS env required to write metadata");
    const hash = await client.modules.metadata.updateMetadata(
      METADATA_MODULE,
      slot as Address,
      uri,
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return msg(`Metadata updated! tx: ${hash}\nStatus: ${receipt.status}`);
  },
);

server.tool(
  "wallet_info",
  "Get the MCP wallet address and ETH balance",
  {},
  async () => {
    const wallet = getWalletClient();
    const address = wallet.account!.address;
    const balance = await publicClient.getBalance({ address });
    return ok({
      address,
      ethBalance: formatUnits(balance, 18),
      chain: chain.name,
      chainId: chain.id,
    });
  },
);

// ── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
