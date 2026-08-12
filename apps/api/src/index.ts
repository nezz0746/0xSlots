import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { slotsClient } from "./services/indexer";

// import { startEventListener } from "./services/events";
// const alchemyKey = process.env.ALCHEMY_KEY as string;

const IPFS_GATEWAY = "https://ipfs-gateway.econome.studio";

const AdDataQueryError = {
  NO_AD: "NO_AD",
  ERROR: "ERROR",
} as const;

const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

app.get("/", (c) => {
  return c.json({ message: "0xSlots API" });
});

app.get("/ad/slot/:slotAddress", async (c) => {
  const { slotAddress } = c.req.param();

  try {
    const { metadataSlot } = await slotsClient.modules.metadata.getSlot({
      id: slotAddress.toLowerCase(),
    });

    if (!metadataSlot?.uri) {
      return c.json({ error: AdDataQueryError.NO_AD }, 404);
    }

    // Fetch ad content from URI (ipfs://, https://, etc.)
    const uri = metadataSlot.uri.startsWith("ipfs://")
      ? metadataSlot.uri.replace("ipfs://", `${IPFS_GATEWAY}/ipfs/`)
      : metadataSlot.uri;

    const ad = await fetch(uri).then((res) => res.json());
    return c.json(ad);
  } catch (error) {
    console.error("Error fetching ad data:", error);
    return c.json({ error: AdDataQueryError.ERROR }, 500);
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3069,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    // startEventListener(alchemyKey);
  },
);
