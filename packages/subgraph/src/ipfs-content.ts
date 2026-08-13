import {
  Bytes,
  dataSource,
  json,
  JSONValue,
  JSONValueKind,
  TypedMap,
} from "@graphprotocol/graph-ts";
import { IpfsContent } from "../generated/schema";

/**
 * File data source handler — the replacement for `ipfs.cat`.
 *
 * Graph Node spawns one of these per CID passed to `IpfsContent.create(...)`,
 * fetches the file (retrying until it succeeds), and calls this with the
 * contents. The old `ipfs.cat` ran inside the chain handler, blocked it, and
 * returned null on timeout — which the mappings recorded as "this file has no
 * metadata", permanently, with no retry.
 *
 * ── THIS FILE IS DELIBERATELY STANDALONE ──────────────────────────────────
 * It imports nothing but `graph-ts` and the generated schema. A file data
 * source handler that lives in a module which (even transitively) imports
 * generated CONTRACT bindings fails to instantiate with
 * `unknown import: ethereum::ethereum.call has not been defined`, because the
 * file-data-source host has no ethereum module. That is why this is not a
 * function inside `metadata.ts` or `factory.ts` — both import contract
 * bindings and would take this down with them.
 *
 * Do not import from `./helpers`, `./metadata` or any `../generated/<contract>`
 * module here, and do not load or touch a chain-based entity: file data sources
 * are isolated from them by design.
 */
export function handleIpfsContent(content: Bytes): void {
  // The CID this data source was created with. It is the entity id, which is
  // how a chain entity that stored the same CID finds this row.
  const entity = new IpfsContent(dataSource.stringParam());

  const raw = content.toString();
  const parsed = json.try_fromString(raw);
  if (parsed.isError) {
    // Keep the row. A file that fetched but is not JSON is a different fact
    // from a file that never arrived, and only one of them is worth chasing.
    entity.save();
    return;
  }

  entity.json = raw;

  const obj = parsed.value.toObject();
  entity.name = readString(obj, "name");
  entity.description = readString(obj, "description");
  entity.image = readString(obj, "image");
  entity.banner = readString(obj, "banner");
  entity.externalLink = readString(obj, "externalLink");
  entity.adType = readString(obj, "type");

  entity.save();
}

/**
 * A string field, or null when absent, JSON-null, or the wrong kind.
 *
 * The kind check is what stops `toString()` being called on a number or an
 * object, which does not throw in AssemblyScript — it returns something
 * meaningless and stores it.
 */
function readString(
  obj: TypedMap<string, JSONValue>,
  key: string,
): string | null {
  const value = obj.get(key);
  if (!value || value.isNull() || value.kind != JSONValueKind.STRING)
    return null;
  return value.toString();
}
