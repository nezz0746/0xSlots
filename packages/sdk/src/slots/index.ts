/**
 * The hook-based Slots protocol.
 *
 * A separate entry point from the package root, not more names on it. Both
 * protocols have a `SlotsClient`, a `SlotInit`-shaped creation type and a
 * shapes, and they are not interchangeable — one import path per protocol
 * is what stops a half-migrated app mixing them silently. The root export keeps
 * serving the old protocol until cutover; nothing here touches it.
 *
 * React bindings live at `@0xslots/sdk/slots/react`.
 */

export { SlotsError } from "../errors";
export { isNativeCurrency, NATIVE_CURRENCY_ADDRESS } from "../native";
export {
  assertSlotInit,
  BASIS_POINTS,
  type BuyParams,
  createSlotsClient,
  type HookFlags,
  MAX_PRICE,
  MAX_TAX_BPS,
  MONTH_SECONDS,
  type PendingTerms,
  type ProposeTermsParams,
  type SlotInit,
  type SlotState,
  SlotsClient,
  type SlotsClientConfig,
  TERMS_DELAY_SECONDS,
  ZERO_HOOK_DATA,
} from "./client";

export {
  assertCollectionInit,
  type CollectionInit,
  type CollectionSummary,
  type CollectionTerms,
  CollectionsClient,
  type CollectionsClientConfig,
  createCollectionsClient,
  depositFor,
  type MintQuote,
} from "./collections";
