---
"@0xslots/sdk": minor
---

**Breaking:** remove `apiKey` from `SlotsClientConfig`.

Ponder serves the GraphQL API unauthenticated. The endpoint answers `200` with
no `Authorization` header and `200` with a deliberately invalid bearer token —
the header is not checked at all, so the key never bought anything.

It was inherited from The Graph's gateway, which does reject unauthenticated
queries, and it survived the migration untouched because nothing failed when it
stopped mattering.

Worse than dead weight: consumers wired it through `NEXT_PUBLIC_*`, and Next
inlines those into the client bundle. That published a billable gateway
credential to every visitor in exchange for nothing.

`useSlotsClient(chainId, apiKey)` loses its second parameter for the same reason.

### Migration

Drop the option:

```diff
  new SlotsClient({
    chainId,
    apiUrl,
-   apiKey: process.env.NEXT_PUBLIC_PONDER_API_KEY,
  })
```

If you have put your own deployment behind auth, `headers` still carries it —
that path is unchanged and now the only one:

```ts
new SlotsClient({
  chainId,
  apiUrl,
  headers: { Authorization: `Bearer ${token}` },
});
```

Any key that was exposed through a `NEXT_PUBLIC_` var is worth rotating: it has
been readable in the deployed bundle for as long as it was set.
