---
"@0xslots/contracts": minor
"@0xslots/sdk": minor
---

SlotData: one utility carrying any number of services.

`slotDataAbi` and `slotDataAddress` (anvil only for now) in `@0xslots/contracts`,
and `client.modules.slotData` plus four indexer queries in `@0xslots/sdk`.

Also a translator: a model you already have, turned into a registrable
signature.

`fromZodToSlotDataSchema` lives at `@0xslots/sdk/zod`, a separate entry point
because Zod is an OPTIONAL peer dependency — `z.toJSONSchema` is Zod 4 only, and
importing it from the root would break every consumer still on 3.x over a
function they never call. The work itself is `jsonSchemaToAbi` at the root,
which takes JSON Schema and depends on nothing, so models written in something
other than Zod get the same treatment.

Composites may nest two levels deep by default (`maxDepth`), which is what a
`{ data, metadata }` model needs once its metadata has structure of its own.
Arrays are free of the budget — `string[]` is as flat as `string` — but objects
inside one are not.

`assertSignatureUnchanged` / `assertZodSignatureUnchanged` pin the result. A
registered service is permanent, ABI encoding is positional, and reordering two
same-typed fields is a source edit that still decodes and silently returns every
value in the wrong field.

A service is a name and an ABI signature stored on chain, and anyone may
register one. Payloads are written against a service by whoever occupies the
slot, and carry their schema with them — so a client can decode a write from an
application it has never heard of, which is what a slot pointing at a single
`utility` address previously made impossible without a contract per app.

Two things to know when reading records back:

- A record is live only when its `generation` equals `tenancyRef.generation`.
  A tenancy ends with one increment on chain and leaves the previous tenant's
  payloads untouched, so the newest row for a slot is not necessarily current.
- A successful decode is not proof the schema is right. Dynamic types usually
  throw on a mismatch; a fixed-size type reads 32 bytes from wherever it lands
  and returns whatever was there.
