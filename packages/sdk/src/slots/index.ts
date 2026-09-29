/**
 * The v1 Slots protocol.
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
  type SettingsCheck,
  type ModuleSettingsParam,
  type ModuleSettingsSchema,
  type ModuleMetadata,
  type ModuleFee,
  type ModuleUpdate,
  type SlotConstants,
  type Scopes,
  type ModuleTerms,
  NO_MODULE,
  type OfferBoard,
  MAX_PRICE,
  MAX_TAX_BPS,
  MAX_MIN_RUNWAY_SECONDS,
  MONTH_SECONDS,
  type Pending,
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
  packScopes,
  NO_SETTINGS,
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
