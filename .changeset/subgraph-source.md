---
"@0xslots/sdk": minor
---

Choose which subgraph deployment to read with a flag rather than a URL.

`SubgraphSource` is a new export — `Network` for the decentralized network through `gateway.thegraph.com`, `Studio` for the development deployment. `SlotsClientConfig` takes it as `subgraphSource`, and `subgraphUrlFor(chainId, source)` resolves one to an endpoint. The Studio endpoints ship here as `STUDIO_SUBGRAPH_URLS`, alongside the gateway ones that were already exported.

Studio exists in this package because of a gap the gateway has: a freshly published subgraph is not served there until an indexer allocates to it and syncs from `startBlock` — hours for these — and until then the gateway answers `subgraph not found: no allocations`. Studio serves a deployment as soon as it has indexed, so it is how a mapping or schema change gets exercised before the network catches up. It is rate-limited and a development surface; the default is unchanged and nothing switches to it on its own.

Both endpoint maps living together is the point. The Studio slugs are NOT symmetrical — `0-xslots-base` but `0-x-slots-base-sepolia` — and cannot be derived from the chain, so every consumer that hand-wrote them was one transcription away from a silent failure: Studio answers an unknown slug with HTTP 200 and a `{"message":"Not found"}` body, which no status check catches. Consumers now carry a two-value flag instead of a pair of URLs.

`subgraphApiKey` is withheld when this client resolves a Studio endpoint itself. The key authenticates against the gateway and is meaningless to Studio, so sending it would put a gateway credential in a request that has no use for it. An explicit `subgraphUrl` still receives the key — the caller named that endpoint and this package cannot tell what it is.

`subgraphUrl` is unchanged and still wins over `subgraphSource`, so a local graph-node or a pinned deployment ID works exactly as before.
