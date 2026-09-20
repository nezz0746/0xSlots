/**
 * The app-based Slots protocol.
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
  ALL_TERMS,
  assertSlotInit,
  BASIS_POINTS,
  type BookOffer,
  type BuyParams,
  createSlotsClient,
  SCOPE_BITS,
  type HookConfigCheck,
  type AppSettingsParam,
  type AppSettingsSchema,
  type AppDefinition,
  type Manifest,
  type HookOfferStatus,
  type Scopes,
  type AppTerms,
  NO_APP,
  type OfferBoard,
  MAX_PRICE,
  MAX_TAX_BPS,
  MONTH_SECONDS,
  type PendingTerms,
  type PostOfferParams,
  type ProposeTermsParams,
  type TaxTerms,
  type SlotInit,
  type SlotState,
  type SlotTerms,
  SlotsClient,
  type SlotsClientConfig,
  TERMS,
  TERMS_DELAY_SECONDS,
  unpackScopes,
  ZERO_SETTINGS,
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

export {
  assertCollectiveSplit,
  COLLECTIVE_ROLES,
  type CollectiveRole,
  type CollectiveRoles,
  type CollectiveSplit,
  CollectivesClient,
  type CollectivesClientConfig,
  createCollectivesClient,
  type CreateCollectiveParams,
  SPLITS_NATIVE_TOKEN,
} from "./collectives";
