import { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: string; output: string; }
  JSON: { input: unknown; output: unknown; }
};

export type Meta = {
  __typename?: 'Meta';
  status?: Maybe<Scalars['JSON']['output']>;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  _meta?: Maybe<Meta>;
  account?: Maybe<Account>;
  accountChain?: Maybe<AccountChain>;
  accountChains: AccountChainPage;
  accountSlot?: Maybe<AccountSlot>;
  accountSlots: AccountSlotPage;
  accounts: AccountPage;
  boughtEvent?: Maybe<BoughtEvent>;
  boughtEvents: BoughtEventPage;
  collectiveActionEvent?: Maybe<CollectiveActionEvent>;
  collectiveActionEvents: CollectiveActionEventPage;
  collectiveDistributionEvent?: Maybe<CollectiveDistributionEvent>;
  collectiveDistributionEvents: CollectiveDistributionEventPage;
  collectiveRole?: Maybe<CollectiveRole>;
  collectiveRoles: CollectiveRolePage;
  collectiveSplitRecipient?: Maybe<CollectiveSplitRecipient>;
  collectiveSplitRecipients: CollectiveSplitRecipientPage;
  collectiveSplitUpdatedEvent?: Maybe<CollectiveSplitUpdatedEvent>;
  collectiveSplitUpdatedEvents: CollectiveSplitUpdatedEventPage;
  currency?: Maybe<Currency>;
  currencys: CurrencyPage;
  depositedEvent?: Maybe<DepositedEvent>;
  depositedEvents: DepositedEventPage;
  factory?: Maybe<Factory>;
  factorys: FactoryPage;
  feed?: Maybe<Feed>;
  feedCreatedEvent?: Maybe<FeedCreatedEvent>;
  feedCreatedEvents: FeedCreatedEventPage;
  feedHub?: Maybe<FeedHub>;
  feedHubs: FeedHubPage;
  feedMetadataURIUpdatedEvent?: Maybe<FeedMetadataUriUpdatedEvent>;
  feedMetadataURIUpdatedEvents: FeedMetadataUriUpdatedEventPage;
  feedNameUpdatedEvent?: Maybe<FeedNameUpdatedEvent>;
  feedNameUpdatedEvents: FeedNameUpdatedEventPage;
  feedRecipientUpdatedEvent?: Maybe<FeedRecipientUpdatedEvent>;
  feedRecipientUpdatedEvents: FeedRecipientUpdatedEventPage;
  feedSlotAddedEvent?: Maybe<FeedSlotAddedEvent>;
  feedSlotAddedEvents: FeedSlotAddedEventPage;
  feedSlotRemovedEvent?: Maybe<FeedSlotRemovedEvent>;
  feedSlotRemovedEvents: FeedSlotRemovedEventPage;
  feeds: FeedPage;
  liquidatedEvent?: Maybe<LiquidatedEvent>;
  liquidatedEvents: LiquidatedEventPage;
  metadataSlot?: Maybe<MetadataSlot>;
  metadataSlots: MetadataSlotPage;
  metadataUpdatedEvent?: Maybe<MetadataUpdatedEvent>;
  metadataUpdatedEvents: MetadataUpdatedEventPage;
  module?: Maybe<Module>;
  moduleFeePaidEvent?: Maybe<ModuleFeePaidEvent>;
  moduleFeePaidEvents: ModuleFeePaidEventPage;
  moduleUpdateProposedEvent?: Maybe<ModuleUpdateProposedEvent>;
  moduleUpdateProposedEvents: ModuleUpdateProposedEventPage;
  modules: ModulePage;
  operatorSetEvent?: Maybe<OperatorSetEvent>;
  operatorSetEvents: OperatorSetEventPage;
  pendingUpdateCancelledEvent?: Maybe<PendingUpdateCancelledEvent>;
  pendingUpdateCancelledEvents: PendingUpdateCancelledEventPage;
  pendingUpdateEvent?: Maybe<PendingUpdateEvent>;
  pendingUpdateEvents: PendingUpdateEventPage;
  policyUpdateAppliedEvent?: Maybe<PolicyUpdateAppliedEvent>;
  policyUpdateAppliedEvents: PolicyUpdateAppliedEventPage;
  policyUpdateProposedEvent?: Maybe<PolicyUpdateProposedEvent>;
  policyUpdateProposedEvents: PolicyUpdateProposedEventPage;
  priceUpdatedEvent?: Maybe<PriceUpdatedEvent>;
  priceUpdatedEvents: PriceUpdatedEventPage;
  refundClaimedEvent?: Maybe<RefundClaimedEvent>;
  refundClaimedEvents: RefundClaimedEventPage;
  refundCreditedEvent?: Maybe<RefundCreditedEvent>;
  refundCreditedEvents: RefundCreditedEventPage;
  releasedEvent?: Maybe<ReleasedEvent>;
  releasedEvents: ReleasedEventPage;
  settledEvent?: Maybe<SettledEvent>;
  settledEvents: SettledEventPage;
  slot?: Maybe<Slot>;
  slotCollective?: Maybe<SlotCollective>;
  slotCollectives: SlotCollectivePage;
  slotDeployedEvent?: Maybe<SlotDeployedEvent>;
  slotDeployedEvents: SlotDeployedEventPage;
  slotOperator?: Maybe<SlotOperator>;
  slotOperators: SlotOperatorPage;
  slotRefund?: Maybe<SlotRefund>;
  slotRefunds: SlotRefundPage;
  slots: SlotPage;
  taxCollectedEvent?: Maybe<TaxCollectedEvent>;
  taxCollectedEvents: TaxCollectedEventPage;
  taxPaidEvent?: Maybe<TaxPaidEvent>;
  taxPaidEvents: TaxPaidEventPage;
  taxUpdateProposedEvent?: Maybe<TaxUpdateProposedEvent>;
  taxUpdateProposedEvents: TaxUpdateProposedEventPage;
  withdrawnEvent?: Maybe<WithdrawnEvent>;
  withdrawnEvents: WithdrawnEventPage;
};


export type QueryAccountArgs = {
  id: Scalars['String']['input'];
};


export type QueryAccountChainArgs = {
  account: Scalars['String']['input'];
  chainId: Scalars['Float']['input'];
};


export type QueryAccountChainsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountChainFilter>;
};


export type QueryAccountSlotArgs = {
  account: Scalars['String']['input'];
  slot: Scalars['String']['input'];
};


export type QueryAccountSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountSlotFilter>;
};


export type QueryAccountsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountFilter>;
};


export type QueryBoughtEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryBoughtEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<BoughtEventFilter>;
};


export type QueryCollectiveActionEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryCollectiveActionEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveActionEventFilter>;
};


export type QueryCollectiveDistributionEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryCollectiveDistributionEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveDistributionEventFilter>;
};


export type QueryCollectiveRoleArgs = {
  account: Scalars['String']['input'];
  collective: Scalars['String']['input'];
  role: Scalars['String']['input'];
};


export type QueryCollectiveRolesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveRoleFilter>;
};


export type QueryCollectiveSplitRecipientArgs = {
  collective: Scalars['String']['input'];
  index: Scalars['Float']['input'];
};


export type QueryCollectiveSplitRecipientsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveSplitRecipientFilter>;
};


export type QueryCollectiveSplitUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryCollectiveSplitUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveSplitUpdatedEventFilter>;
};


export type QueryCurrencyArgs = {
  id: Scalars['String']['input'];
};


export type QueryCurrencysArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CurrencyFilter>;
};


export type QueryDepositedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryDepositedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<DepositedEventFilter>;
};


export type QueryFactoryArgs = {
  id: Scalars['String']['input'];
};


export type QueryFactorysArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FactoryFilter>;
};


export type QueryFeedArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedCreatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedCreatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedCreatedEventFilter>;
};


export type QueryFeedHubArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedHubsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedHubFilter>;
};


export type QueryFeedMetadataUriUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedMetadataUriUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedMetadataUriUpdatedEventFilter>;
};


export type QueryFeedNameUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedNameUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedNameUpdatedEventFilter>;
};


export type QueryFeedRecipientUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedRecipientUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedRecipientUpdatedEventFilter>;
};


export type QueryFeedSlotAddedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedSlotAddedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedSlotAddedEventFilter>;
};


export type QueryFeedSlotRemovedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryFeedSlotRemovedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedSlotRemovedEventFilter>;
};


export type QueryFeedsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedFilter>;
};


export type QueryLiquidatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryLiquidatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<LiquidatedEventFilter>;
};


export type QueryMetadataSlotArgs = {
  id: Scalars['String']['input'];
};


export type QueryMetadataSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<MetadataSlotFilter>;
};


export type QueryMetadataUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryMetadataUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<MetadataUpdatedEventFilter>;
};


export type QueryModuleArgs = {
  id: Scalars['String']['input'];
};


export type QueryModuleFeePaidEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryModuleFeePaidEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleFeePaidEventFilter>;
};


export type QueryModuleUpdateProposedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryModuleUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleUpdateProposedEventFilter>;
};


export type QueryModulesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleFilter>;
};


export type QueryOperatorSetEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryOperatorSetEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<OperatorSetEventFilter>;
};


export type QueryPendingUpdateCancelledEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryPendingUpdateCancelledEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PendingUpdateCancelledEventFilter>;
};


export type QueryPendingUpdateEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryPendingUpdateEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PendingUpdateEventFilter>;
};


export type QueryPolicyUpdateAppliedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryPolicyUpdateAppliedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PolicyUpdateAppliedEventFilter>;
};


export type QueryPolicyUpdateProposedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryPolicyUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PolicyUpdateProposedEventFilter>;
};


export type QueryPriceUpdatedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryPriceUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PriceUpdatedEventFilter>;
};


export type QueryRefundClaimedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryRefundClaimedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<RefundClaimedEventFilter>;
};


export type QueryRefundCreditedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryRefundCreditedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<RefundCreditedEventFilter>;
};


export type QueryReleasedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryReleasedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ReleasedEventFilter>;
};


export type QuerySettledEventArgs = {
  id: Scalars['String']['input'];
};


export type QuerySettledEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SettledEventFilter>;
};


export type QuerySlotArgs = {
  id: Scalars['String']['input'];
};


export type QuerySlotCollectiveArgs = {
  id: Scalars['String']['input'];
};


export type QuerySlotCollectivesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotCollectiveFilter>;
};


export type QuerySlotDeployedEventArgs = {
  id: Scalars['String']['input'];
};


export type QuerySlotDeployedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotDeployedEventFilter>;
};


export type QuerySlotOperatorArgs = {
  occupant: Scalars['String']['input'];
  operator: Scalars['String']['input'];
  slot: Scalars['String']['input'];
};


export type QuerySlotOperatorsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotOperatorFilter>;
};


export type QuerySlotRefundArgs = {
  account: Scalars['String']['input'];
  slot: Scalars['String']['input'];
};


export type QuerySlotRefundsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotRefundFilter>;
};


export type QuerySlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};


export type QueryTaxCollectedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryTaxCollectedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxCollectedEventFilter>;
};


export type QueryTaxPaidEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryTaxPaidEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxPaidEventFilter>;
};


export type QueryTaxUpdateProposedEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryTaxUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxUpdateProposedEventFilter>;
};


export type QueryWithdrawnEventArgs = {
  id: Scalars['String']['input'];
};


export type QueryWithdrawnEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<WithdrawnEventFilter>;
};

export type ViewPageInfo = {
  __typename?: 'ViewPageInfo';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
};

export type Account = {
  __typename?: 'account';
  accountSlots?: Maybe<AccountSlotPage>;
  chains?: Maybe<AccountChainPage>;
  id: Scalars['String']['output'];
  metadataUpdateCount: Scalars['BigInt']['output'];
  occupiedCount: Scalars['Int']['output'];
  slotCount: Scalars['Int']['output'];
  slotsAsOccupant?: Maybe<SlotPage>;
  slotsAsRecipient?: Maybe<SlotPage>;
  totalHoldTime: Scalars['BigInt']['output'];
  type: AccountType;
};


export type AccountAccountSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountSlotFilter>;
};


export type AccountChainsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountChainFilter>;
};


export type AccountSlotsAsOccupantArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};


export type AccountSlotsAsRecipientArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};

export type AccountChain = {
  __typename?: 'accountChain';
  account: Scalars['String']['output'];
  accountRef?: Maybe<Account>;
  chainId: Scalars['Int']['output'];
  occupiedAsRecipient: Scalars['Int']['output'];
  occupiedCount: Scalars['Int']['output'];
  slotCount: Scalars['Int']['output'];
};

export type AccountChainFilter = {
  AND?: InputMaybe<Array<InputMaybe<AccountChainFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<AccountChainFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupiedAsRecipient?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_gt?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_gte?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupiedAsRecipient_lt?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_lte?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_not?: InputMaybe<Scalars['Int']['input']>;
  occupiedAsRecipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupiedCount?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_gt?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_gte?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupiedCount_lt?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_lte?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_not?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  slotCount?: InputMaybe<Scalars['Int']['input']>;
  slotCount_gt?: InputMaybe<Scalars['Int']['input']>;
  slotCount_gte?: InputMaybe<Scalars['Int']['input']>;
  slotCount_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  slotCount_lt?: InputMaybe<Scalars['Int']['input']>;
  slotCount_lte?: InputMaybe<Scalars['Int']['input']>;
  slotCount_not?: InputMaybe<Scalars['Int']['input']>;
  slotCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type AccountChainPage = {
  __typename?: 'accountChainPage';
  items: Array<AccountChain>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AccountFilter = {
  AND?: InputMaybe<Array<InputMaybe<AccountFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<AccountFilter>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataUpdateCount?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  metadataUpdateCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  occupiedCount?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_gt?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_gte?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupiedCount_lt?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_lte?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_not?: InputMaybe<Scalars['Int']['input']>;
  occupiedCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  slotCount?: InputMaybe<Scalars['Int']['input']>;
  slotCount_gt?: InputMaybe<Scalars['Int']['input']>;
  slotCount_gte?: InputMaybe<Scalars['Int']['input']>;
  slotCount_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  slotCount_lt?: InputMaybe<Scalars['Int']['input']>;
  slotCount_lte?: InputMaybe<Scalars['Int']['input']>;
  slotCount_not?: InputMaybe<Scalars['Int']['input']>;
  slotCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  totalHoldTime?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalHoldTime_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalHoldTime_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  type?: InputMaybe<AccountType>;
  type_in?: InputMaybe<Array<InputMaybe<AccountType>>>;
  type_not?: InputMaybe<AccountType>;
  type_not_in?: InputMaybe<Array<InputMaybe<AccountType>>>;
};

export type AccountPage = {
  __typename?: 'accountPage';
  items: Array<Account>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AccountSlot = {
  __typename?: 'accountSlot';
  account: Scalars['String']['output'];
  accountRef?: Maybe<Account>;
  chainId: Scalars['Int']['output'];
  firstInteractedAt: Scalars['BigInt']['output'];
  holdTime: Scalars['BigInt']['output'];
  lastInteractedAt: Scalars['BigInt']['output'];
  lastOccupiedAt?: Maybe<Scalars['BigInt']['output']>;
  metadataUpdateCount: Scalars['BigInt']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  taxPaid: Scalars['BigInt']['output'];
};

export type AccountSlotFilter = {
  AND?: InputMaybe<Array<InputMaybe<AccountSlotFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<AccountSlotFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  firstInteractedAt?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  firstInteractedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  firstInteractedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  holdTime?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_gt?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_gte?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  holdTime_lt?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_lte?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_not?: InputMaybe<Scalars['BigInt']['input']>;
  holdTime_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  lastInteractedAt?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  lastInteractedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  lastInteractedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  lastOccupiedAt?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  lastOccupiedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  lastOccupiedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  metadataUpdateCount?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  metadataUpdateCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  metadataUpdateCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  taxPaid?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaid_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type AccountSlotPage = {
  __typename?: 'accountSlotPage';
  items: Array<AccountSlot>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AccountType =
  | 'CONTRACT'
  | 'DELEGATED'
  | 'EOA'
  | 'SPLIT';

export type BoughtEvent = {
  __typename?: 'boughtEvent';
  blockNumber: Scalars['BigInt']['output'];
  buyer: Scalars['String']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  deposit: Scalars['BigInt']['output'];
  id: Scalars['String']['output'];
  previousOccupant: Scalars['String']['output'];
  price: Scalars['BigInt']['output'];
  selfAssessedPrice: Scalars['BigInt']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type BoughtEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<BoughtEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<BoughtEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  buyer?: InputMaybe<Scalars['String']['input']>;
  buyer_contains?: InputMaybe<Scalars['String']['input']>;
  buyer_ends_with?: InputMaybe<Scalars['String']['input']>;
  buyer_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  buyer_not?: InputMaybe<Scalars['String']['input']>;
  buyer_not_contains?: InputMaybe<Scalars['String']['input']>;
  buyer_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  buyer_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  buyer_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  buyer_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  deposit?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  deposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  previousOccupant?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_contains?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  previousOccupant_not?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  previousOccupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  previousOccupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['BigInt']['input']>;
  price_gt?: InputMaybe<Scalars['BigInt']['input']>;
  price_gte?: InputMaybe<Scalars['BigInt']['input']>;
  price_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  price_lt?: InputMaybe<Scalars['BigInt']['input']>;
  price_lte?: InputMaybe<Scalars['BigInt']['input']>;
  price_not?: InputMaybe<Scalars['BigInt']['input']>;
  price_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  selfAssessedPrice?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_gt?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_gte?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  selfAssessedPrice_lt?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_lte?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_not?: InputMaybe<Scalars['BigInt']['input']>;
  selfAssessedPrice_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type BoughtEventPage = {
  __typename?: 'boughtEventPage';
  items: Array<BoughtEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectiveActionEvent = {
  __typename?: 'collectiveActionEvent';
  action: Scalars['String']['output'];
  blockNumber: Scalars['BigInt']['output'];
  by: Scalars['String']['output'];
  chainId: Scalars['Int']['output'];
  collective: Scalars['String']['output'];
  collectiveRef?: Maybe<SlotCollective>;
  id: Scalars['String']['output'];
  kind?: Maybe<Scalars['String']['output']>;
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type CollectiveActionEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<CollectiveActionEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CollectiveActionEventFilter>>>;
  action?: InputMaybe<Scalars['String']['input']>;
  action_contains?: InputMaybe<Scalars['String']['input']>;
  action_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  action_ends_with?: InputMaybe<Scalars['String']['input']>;
  action_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  action_not?: InputMaybe<Scalars['String']['input']>;
  action_not_contains?: InputMaybe<Scalars['String']['input']>;
  action_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  action_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  action_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  action_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  action_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_starts_with?: InputMaybe<Scalars['String']['input']>;
  action_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  by?: InputMaybe<Scalars['String']['input']>;
  by_contains?: InputMaybe<Scalars['String']['input']>;
  by_ends_with?: InputMaybe<Scalars['String']['input']>;
  by_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  by_not?: InputMaybe<Scalars['String']['input']>;
  by_not_contains?: InputMaybe<Scalars['String']['input']>;
  by_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  by_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  by_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  by_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collective?: InputMaybe<Scalars['String']['input']>;
  collective_contains?: InputMaybe<Scalars['String']['input']>;
  collective_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not?: InputMaybe<Scalars['String']['input']>;
  collective_not_contains?: InputMaybe<Scalars['String']['input']>;
  collective_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collective_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  kind?: InputMaybe<Scalars['String']['input']>;
  kind_contains?: InputMaybe<Scalars['String']['input']>;
  kind_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  kind_ends_with?: InputMaybe<Scalars['String']['input']>;
  kind_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  kind_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  kind_not?: InputMaybe<Scalars['String']['input']>;
  kind_not_contains?: InputMaybe<Scalars['String']['input']>;
  kind_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  kind_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  kind_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  kind_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  kind_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  kind_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  kind_starts_with?: InputMaybe<Scalars['String']['input']>;
  kind_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
  value_contains?: InputMaybe<Scalars['String']['input']>;
  value_ends_with?: InputMaybe<Scalars['String']['input']>;
  value_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value_not?: InputMaybe<Scalars['String']['input']>;
  value_not_contains?: InputMaybe<Scalars['String']['input']>;
  value_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  value_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  value_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type CollectiveActionEventPage = {
  __typename?: 'collectiveActionEventPage';
  items: Array<CollectiveActionEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectiveDistributionEvent = {
  __typename?: 'collectiveDistributionEvent';
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  collective: Scalars['String']['output'];
  collectiveRef?: Maybe<SlotCollective>;
  distributor: Scalars['String']['output'];
  id: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  token: Scalars['String']['output'];
  tx: Scalars['String']['output'];
};

export type CollectiveDistributionEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<CollectiveDistributionEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CollectiveDistributionEventFilter>>>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collective?: InputMaybe<Scalars['String']['input']>;
  collective_contains?: InputMaybe<Scalars['String']['input']>;
  collective_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not?: InputMaybe<Scalars['String']['input']>;
  collective_not_contains?: InputMaybe<Scalars['String']['input']>;
  collective_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collective_starts_with?: InputMaybe<Scalars['String']['input']>;
  distributor?: InputMaybe<Scalars['String']['input']>;
  distributor_contains?: InputMaybe<Scalars['String']['input']>;
  distributor_ends_with?: InputMaybe<Scalars['String']['input']>;
  distributor_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  distributor_not?: InputMaybe<Scalars['String']['input']>;
  distributor_not_contains?: InputMaybe<Scalars['String']['input']>;
  distributor_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  distributor_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  distributor_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  distributor_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
  token_contains?: InputMaybe<Scalars['String']['input']>;
  token_ends_with?: InputMaybe<Scalars['String']['input']>;
  token_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token_not?: InputMaybe<Scalars['String']['input']>;
  token_not_contains?: InputMaybe<Scalars['String']['input']>;
  token_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  token_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  token_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type CollectiveDistributionEventPage = {
  __typename?: 'collectiveDistributionEventPage';
  items: Array<CollectiveDistributionEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectiveRole = {
  __typename?: 'collectiveRole';
  account: Scalars['String']['output'];
  accountRef?: Maybe<Account>;
  chainId: Scalars['Int']['output'];
  collective: Scalars['String']['output'];
  collectiveRef?: Maybe<SlotCollective>;
  granted: Scalars['Boolean']['output'];
  grantedAt?: Maybe<Scalars['BigInt']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  revokedAt?: Maybe<Scalars['BigInt']['output']>;
  role: Scalars['String']['output'];
  updatedAt: Scalars['BigInt']['output'];
};

export type CollectiveRoleFilter = {
  AND?: InputMaybe<Array<InputMaybe<CollectiveRoleFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CollectiveRoleFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collective?: InputMaybe<Scalars['String']['input']>;
  collective_contains?: InputMaybe<Scalars['String']['input']>;
  collective_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not?: InputMaybe<Scalars['String']['input']>;
  collective_not_contains?: InputMaybe<Scalars['String']['input']>;
  collective_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collective_starts_with?: InputMaybe<Scalars['String']['input']>;
  granted?: InputMaybe<Scalars['Boolean']['input']>;
  grantedAt?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  grantedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  grantedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  granted_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  granted_not?: InputMaybe<Scalars['Boolean']['input']>;
  granted_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  label?: InputMaybe<Scalars['String']['input']>;
  label_contains?: InputMaybe<Scalars['String']['input']>;
  label_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  label_ends_with?: InputMaybe<Scalars['String']['input']>;
  label_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  label_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  label_not?: InputMaybe<Scalars['String']['input']>;
  label_not_contains?: InputMaybe<Scalars['String']['input']>;
  label_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  label_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  label_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  label_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  label_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  label_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  label_starts_with?: InputMaybe<Scalars['String']['input']>;
  label_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  revokedAt?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  revokedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  revokedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  role?: InputMaybe<Scalars['String']['input']>;
  role_contains?: InputMaybe<Scalars['String']['input']>;
  role_ends_with?: InputMaybe<Scalars['String']['input']>;
  role_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  role_not?: InputMaybe<Scalars['String']['input']>;
  role_not_contains?: InputMaybe<Scalars['String']['input']>;
  role_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  role_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  role_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  role_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type CollectiveRolePage = {
  __typename?: 'collectiveRolePage';
  items: Array<CollectiveRole>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectiveSplitRecipient = {
  __typename?: 'collectiveSplitRecipient';
  account: Scalars['String']['output'];
  accountRef?: Maybe<Account>;
  allocation: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  collective: Scalars['String']['output'];
  collectiveRef?: Maybe<SlotCollective>;
  index: Scalars['Int']['output'];
  shareBps: Scalars['Int']['output'];
  updatedAt: Scalars['BigInt']['output'];
};

export type CollectiveSplitRecipientFilter = {
  AND?: InputMaybe<Array<InputMaybe<CollectiveSplitRecipientFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CollectiveSplitRecipientFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  allocation?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_gt?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_gte?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  allocation_lt?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_lte?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_not?: InputMaybe<Scalars['BigInt']['input']>;
  allocation_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collective?: InputMaybe<Scalars['String']['input']>;
  collective_contains?: InputMaybe<Scalars['String']['input']>;
  collective_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not?: InputMaybe<Scalars['String']['input']>;
  collective_not_contains?: InputMaybe<Scalars['String']['input']>;
  collective_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collective_starts_with?: InputMaybe<Scalars['String']['input']>;
  index?: InputMaybe<Scalars['Int']['input']>;
  index_gt?: InputMaybe<Scalars['Int']['input']>;
  index_gte?: InputMaybe<Scalars['Int']['input']>;
  index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  index_lt?: InputMaybe<Scalars['Int']['input']>;
  index_lte?: InputMaybe<Scalars['Int']['input']>;
  index_not?: InputMaybe<Scalars['Int']['input']>;
  index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  shareBps?: InputMaybe<Scalars['Int']['input']>;
  shareBps_gt?: InputMaybe<Scalars['Int']['input']>;
  shareBps_gte?: InputMaybe<Scalars['Int']['input']>;
  shareBps_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  shareBps_lt?: InputMaybe<Scalars['Int']['input']>;
  shareBps_lte?: InputMaybe<Scalars['Int']['input']>;
  shareBps_not?: InputMaybe<Scalars['Int']['input']>;
  shareBps_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type CollectiveSplitRecipientPage = {
  __typename?: 'collectiveSplitRecipientPage';
  items: Array<CollectiveSplitRecipient>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectiveSplitUpdatedEvent = {
  __typename?: 'collectiveSplitUpdatedEvent';
  allocations: Scalars['String']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  collective: Scalars['String']['output'];
  collectiveRef?: Maybe<SlotCollective>;
  distributionIncentive: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  recipients: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  totalAllocation: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type CollectiveSplitUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<CollectiveSplitUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CollectiveSplitUpdatedEventFilter>>>;
  allocations?: InputMaybe<Scalars['String']['input']>;
  allocations_contains?: InputMaybe<Scalars['String']['input']>;
  allocations_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  allocations_ends_with?: InputMaybe<Scalars['String']['input']>;
  allocations_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  allocations_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  allocations_not?: InputMaybe<Scalars['String']['input']>;
  allocations_not_contains?: InputMaybe<Scalars['String']['input']>;
  allocations_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  allocations_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  allocations_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  allocations_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  allocations_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  allocations_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  allocations_starts_with?: InputMaybe<Scalars['String']['input']>;
  allocations_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collective?: InputMaybe<Scalars['String']['input']>;
  collective_contains?: InputMaybe<Scalars['String']['input']>;
  collective_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not?: InputMaybe<Scalars['String']['input']>;
  collective_not_contains?: InputMaybe<Scalars['String']['input']>;
  collective_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collective_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  collective_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collective_starts_with?: InputMaybe<Scalars['String']['input']>;
  distributionIncentive?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_gt?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_gte?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  distributionIncentive_lt?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_lte?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_not?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients?: InputMaybe<Scalars['String']['input']>;
  recipients_contains?: InputMaybe<Scalars['String']['input']>;
  recipients_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipients_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipients_not?: InputMaybe<Scalars['String']['input']>;
  recipients_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipients_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipients_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipients_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipients_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipients_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipients_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalAllocation?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalAllocation_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type CollectiveSplitUpdatedEventPage = {
  __typename?: 'collectiveSplitUpdatedEventPage';
  items: Array<CollectiveSplitUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Currency = {
  __typename?: 'currency';
  decimals: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
};

export type CurrencyFilter = {
  AND?: InputMaybe<Array<InputMaybe<CurrencyFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CurrencyFilter>>>;
  decimals?: InputMaybe<Scalars['Int']['input']>;
  decimals_gt?: InputMaybe<Scalars['Int']['input']>;
  decimals_gte?: InputMaybe<Scalars['Int']['input']>;
  decimals_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  decimals_lt?: InputMaybe<Scalars['Int']['input']>;
  decimals_lte?: InputMaybe<Scalars['Int']['input']>;
  decimals_not?: InputMaybe<Scalars['Int']['input']>;
  decimals_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  symbol_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_ends_with?: InputMaybe<Scalars['String']['input']>;
  symbol_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol_not?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  symbol_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  symbol_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_starts_with?: InputMaybe<Scalars['String']['input']>;
  symbol_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type CurrencyPage = {
  __typename?: 'currencyPage';
  items: Array<Currency>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type DepositedEvent = {
  __typename?: 'depositedEvent';
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  depositor: Scalars['String']['output'];
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type DepositedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<DepositedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<DepositedEventFilter>>>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  depositor?: InputMaybe<Scalars['String']['input']>;
  depositor_contains?: InputMaybe<Scalars['String']['input']>;
  depositor_ends_with?: InputMaybe<Scalars['String']['input']>;
  depositor_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  depositor_not?: InputMaybe<Scalars['String']['input']>;
  depositor_not_contains?: InputMaybe<Scalars['String']['input']>;
  depositor_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  depositor_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  depositor_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  depositor_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type DepositedEventPage = {
  __typename?: 'depositedEventPage';
  items: Array<DepositedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Factory = {
  __typename?: 'factory';
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  modules?: Maybe<ModulePage>;
  slotCount: Scalars['BigInt']['output'];
  slots?: Maybe<SlotPage>;
};


export type FactoryModulesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleFilter>;
};


export type FactorySlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};

export type FactoryFilter = {
  AND?: InputMaybe<Array<InputMaybe<FactoryFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FactoryFilter>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  slotCount?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slotCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type FactoryPage = {
  __typename?: 'factoryPage';
  items: Array<Factory>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Feed = {
  __typename?: 'feed';
  banner?: Maybe<Scalars['String']['output']>;
  chainId: Scalars['Int']['output'];
  createdAt: Scalars['BigInt']['output'];
  createdEvents?: Maybe<FeedCreatedEventPage>;
  createdTx: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  externalLink?: Maybe<Scalars['String']['output']>;
  hub: Scalars['String']['output'];
  hubRef?: Maybe<FeedHub>;
  id: Scalars['String']['output'];
  image?: Maybe<Scalars['String']['output']>;
  index: Scalars['BigInt']['output'];
  metadataCid?: Maybe<Scalars['String']['output']>;
  metadataName?: Maybe<Scalars['String']['output']>;
  metadataRaw?: Maybe<Scalars['String']['output']>;
  metadataURI: Scalars['String']['output'];
  metadataUpdates?: Maybe<FeedMetadataUriUpdatedEventPage>;
  nameUpdates?: Maybe<FeedNameUpdatedEventPage>;
  onchainName: Scalars['String']['output'];
  owner: Scalars['String']['output'];
  recipient: Scalars['String']['output'];
  recipientUpdates?: Maybe<FeedRecipientUpdatedEventPage>;
  slotCount: Scalars['BigInt']['output'];
  slots?: Maybe<SlotPage>;
  slotsAdded?: Maybe<FeedSlotAddedEventPage>;
  slotsRemoved?: Maybe<FeedSlotRemovedEventPage>;
  updatedAt: Scalars['BigInt']['output'];
};


export type FeedCreatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedCreatedEventFilter>;
};


export type FeedMetadataUpdatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedMetadataUriUpdatedEventFilter>;
};


export type FeedNameUpdatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedNameUpdatedEventFilter>;
};


export type FeedRecipientUpdatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedRecipientUpdatedEventFilter>;
};


export type FeedSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};


export type FeedSlotsAddedArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedSlotAddedEventFilter>;
};


export type FeedSlotsRemovedArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedSlotRemovedEventFilter>;
};

export type FeedCreatedEvent = {
  __typename?: 'feedCreatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  hub: Scalars['String']['output'];
  id: Scalars['String']['output'];
  index: Scalars['BigInt']['output'];
  owner: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type FeedCreatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedCreatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedCreatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  hub?: InputMaybe<Scalars['String']['input']>;
  hub_contains?: InputMaybe<Scalars['String']['input']>;
  hub_ends_with?: InputMaybe<Scalars['String']['input']>;
  hub_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  hub_not?: InputMaybe<Scalars['String']['input']>;
  hub_not_contains?: InputMaybe<Scalars['String']['input']>;
  hub_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  hub_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  hub_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  hub_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  index?: InputMaybe<Scalars['BigInt']['input']>;
  index_gt?: InputMaybe<Scalars['BigInt']['input']>;
  index_gte?: InputMaybe<Scalars['BigInt']['input']>;
  index_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  index_lt?: InputMaybe<Scalars['BigInt']['input']>;
  index_lte?: InputMaybe<Scalars['BigInt']['input']>;
  index_not?: InputMaybe<Scalars['BigInt']['input']>;
  index_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  owner?: InputMaybe<Scalars['String']['input']>;
  owner_contains?: InputMaybe<Scalars['String']['input']>;
  owner_ends_with?: InputMaybe<Scalars['String']['input']>;
  owner_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  owner_not?: InputMaybe<Scalars['String']['input']>;
  owner_not_contains?: InputMaybe<Scalars['String']['input']>;
  owner_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  owner_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  owner_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  owner_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedCreatedEventPage = {
  __typename?: 'feedCreatedEventPage';
  items: Array<FeedCreatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedFilter>>>;
  banner?: InputMaybe<Scalars['String']['input']>;
  banner_contains?: InputMaybe<Scalars['String']['input']>;
  banner_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  banner_ends_with?: InputMaybe<Scalars['String']['input']>;
  banner_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  banner_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  banner_not?: InputMaybe<Scalars['String']['input']>;
  banner_not_contains?: InputMaybe<Scalars['String']['input']>;
  banner_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  banner_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  banner_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  banner_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  banner_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  banner_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  banner_starts_with?: InputMaybe<Scalars['String']['input']>;
  banner_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdTx?: InputMaybe<Scalars['String']['input']>;
  createdTx_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_starts_with?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  description_contains?: InputMaybe<Scalars['String']['input']>;
  description_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_ends_with?: InputMaybe<Scalars['String']['input']>;
  description_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not?: InputMaybe<Scalars['String']['input']>;
  description_not_contains?: InputMaybe<Scalars['String']['input']>;
  description_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  description_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  description_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_starts_with?: InputMaybe<Scalars['String']['input']>;
  description_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  displayName_contains?: InputMaybe<Scalars['String']['input']>;
  displayName_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName_ends_with?: InputMaybe<Scalars['String']['input']>;
  displayName_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  displayName_not?: InputMaybe<Scalars['String']['input']>;
  displayName_not_contains?: InputMaybe<Scalars['String']['input']>;
  displayName_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  displayName_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  displayName_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  displayName_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  displayName_starts_with?: InputMaybe<Scalars['String']['input']>;
  displayName_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink?: InputMaybe<Scalars['String']['input']>;
  externalLink_contains?: InputMaybe<Scalars['String']['input']>;
  externalLink_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink_ends_with?: InputMaybe<Scalars['String']['input']>;
  externalLink_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  externalLink_not?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_contains?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  externalLink_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  externalLink_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  externalLink_starts_with?: InputMaybe<Scalars['String']['input']>;
  externalLink_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  hub?: InputMaybe<Scalars['String']['input']>;
  hub_contains?: InputMaybe<Scalars['String']['input']>;
  hub_ends_with?: InputMaybe<Scalars['String']['input']>;
  hub_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  hub_not?: InputMaybe<Scalars['String']['input']>;
  hub_not_contains?: InputMaybe<Scalars['String']['input']>;
  hub_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  hub_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  hub_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  hub_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  image_contains?: InputMaybe<Scalars['String']['input']>;
  image_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  image_ends_with?: InputMaybe<Scalars['String']['input']>;
  image_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  image_not?: InputMaybe<Scalars['String']['input']>;
  image_not_contains?: InputMaybe<Scalars['String']['input']>;
  image_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  image_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  image_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  image_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  image_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_starts_with?: InputMaybe<Scalars['String']['input']>;
  image_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  index?: InputMaybe<Scalars['BigInt']['input']>;
  index_gt?: InputMaybe<Scalars['BigInt']['input']>;
  index_gte?: InputMaybe<Scalars['BigInt']['input']>;
  index_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  index_lt?: InputMaybe<Scalars['BigInt']['input']>;
  index_lte?: InputMaybe<Scalars['BigInt']['input']>;
  index_not?: InputMaybe<Scalars['BigInt']['input']>;
  index_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  metadataCid?: InputMaybe<Scalars['String']['input']>;
  metadataCid_contains?: InputMaybe<Scalars['String']['input']>;
  metadataCid_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataCid_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataCid_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataCid_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataCid_not?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataCid_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataCid_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataCid_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataCid_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName?: InputMaybe<Scalars['String']['input']>;
  metadataName_contains?: InputMaybe<Scalars['String']['input']>;
  metadataName_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataName_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataName_not?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataName_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataName_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataName_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataName_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_contains?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataRaw_not?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataRaw_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataRaw_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI?: InputMaybe<Scalars['String']['input']>;
  metadataURI_contains?: InputMaybe<Scalars['String']['input']>;
  metadataURI_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataURI_not?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataURI_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName?: InputMaybe<Scalars['String']['input']>;
  onchainName_contains?: InputMaybe<Scalars['String']['input']>;
  onchainName_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName_ends_with?: InputMaybe<Scalars['String']['input']>;
  onchainName_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  onchainName_not?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_contains?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  onchainName_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  onchainName_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  onchainName_starts_with?: InputMaybe<Scalars['String']['input']>;
  onchainName_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  owner?: InputMaybe<Scalars['String']['input']>;
  owner_contains?: InputMaybe<Scalars['String']['input']>;
  owner_ends_with?: InputMaybe<Scalars['String']['input']>;
  owner_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  owner_not?: InputMaybe<Scalars['String']['input']>;
  owner_not_contains?: InputMaybe<Scalars['String']['input']>;
  owner_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  owner_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  owner_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  owner_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient?: InputMaybe<Scalars['String']['input']>;
  recipient_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not?: InputMaybe<Scalars['String']['input']>;
  recipient_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_starts_with?: InputMaybe<Scalars['String']['input']>;
  slotCount?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slotCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  slotCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type FeedHub = {
  __typename?: 'feedHub';
  chainId: Scalars['Int']['output'];
  feedCount: Scalars['BigInt']['output'];
  feeds?: Maybe<FeedPage>;
  id: Scalars['String']['output'];
};


export type FeedHubFeedsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<FeedFilter>;
};

export type FeedHubFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedHubFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedHubFilter>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feedCount?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  feedCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  feedCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedHubPage = {
  __typename?: 'feedHubPage';
  items: Array<FeedHub>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedMetadataUriUpdatedEvent = {
  __typename?: 'feedMetadataURIUpdatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
  uri: Scalars['String']['output'];
};

export type FeedMetadataUriUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedMetadataUriUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedMetadataUriUpdatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri?: InputMaybe<Scalars['String']['input']>;
  uri_contains?: InputMaybe<Scalars['String']['input']>;
  uri_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type FeedMetadataUriUpdatedEventPage = {
  __typename?: 'feedMetadataURIUpdatedEventPage';
  items: Array<FeedMetadataUriUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedNameUpdatedEvent = {
  __typename?: 'feedNameUpdatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type FeedNameUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedNameUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedNameUpdatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedNameUpdatedEventPage = {
  __typename?: 'feedNameUpdatedEventPage';
  items: Array<FeedNameUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedPage = {
  __typename?: 'feedPage';
  items: Array<Feed>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedRecipientUpdatedEvent = {
  __typename?: 'feedRecipientUpdatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  recipient: Scalars['String']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type FeedRecipientUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedRecipientUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedRecipientUpdatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipient?: InputMaybe<Scalars['String']['input']>;
  recipient_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not?: InputMaybe<Scalars['String']['input']>;
  recipient_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedRecipientUpdatedEventPage = {
  __typename?: 'feedRecipientUpdatedEventPage';
  items: Array<FeedRecipientUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedSlotAddedEvent = {
  __typename?: 'feedSlotAddedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type FeedSlotAddedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedSlotAddedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedSlotAddedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedSlotAddedEventPage = {
  __typename?: 'feedSlotAddedEventPage';
  items: Array<FeedSlotAddedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type FeedSlotRemovedEvent = {
  __typename?: 'feedSlotRemovedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  feed: Scalars['String']['output'];
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type FeedSlotRemovedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<FeedSlotRemovedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FeedSlotRemovedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type FeedSlotRemovedEventPage = {
  __typename?: 'feedSlotRemovedEventPage';
  items: Array<FeedSlotRemovedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type LiquidatedEvent = {
  __typename?: 'liquidatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  bounty: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  liquidator: Scalars['String']['output'];
  occupant: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type LiquidatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<LiquidatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<LiquidatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  bounty?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_gt?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_gte?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  bounty_lt?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_lte?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_not?: InputMaybe<Scalars['BigInt']['input']>;
  bounty_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  liquidator?: InputMaybe<Scalars['String']['input']>;
  liquidator_contains?: InputMaybe<Scalars['String']['input']>;
  liquidator_ends_with?: InputMaybe<Scalars['String']['input']>;
  liquidator_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  liquidator_not?: InputMaybe<Scalars['String']['input']>;
  liquidator_not_contains?: InputMaybe<Scalars['String']['input']>;
  liquidator_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  liquidator_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  liquidator_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  liquidator_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type LiquidatedEventPage = {
  __typename?: 'liquidatedEventPage';
  items: Array<LiquidatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type MetadataSlot = {
  __typename?: 'metadataSlot';
  adType?: Maybe<Scalars['String']['output']>;
  chainId: Scalars['Int']['output'];
  cid?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['BigInt']['output'];
  createdTx: Scalars['String']['output'];
  id: Scalars['String']['output'];
  rawJson?: Maybe<Scalars['String']['output']>;
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  updateCount: Scalars['BigInt']['output'];
  updatedAt: Scalars['BigInt']['output'];
  updatedBy: Scalars['String']['output'];
  updatedTx: Scalars['String']['output'];
  uri: Scalars['String']['output'];
};

export type MetadataSlotFilter = {
  AND?: InputMaybe<Array<InputMaybe<MetadataSlotFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<MetadataSlotFilter>>>;
  adType?: InputMaybe<Scalars['String']['input']>;
  adType_contains?: InputMaybe<Scalars['String']['input']>;
  adType_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_ends_with?: InputMaybe<Scalars['String']['input']>;
  adType_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  adType_not?: InputMaybe<Scalars['String']['input']>;
  adType_not_contains?: InputMaybe<Scalars['String']['input']>;
  adType_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  adType_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  adType_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  adType_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_starts_with?: InputMaybe<Scalars['String']['input']>;
  adType_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  cid?: InputMaybe<Scalars['String']['input']>;
  cid_contains?: InputMaybe<Scalars['String']['input']>;
  cid_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_ends_with?: InputMaybe<Scalars['String']['input']>;
  cid_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cid_not?: InputMaybe<Scalars['String']['input']>;
  cid_not_contains?: InputMaybe<Scalars['String']['input']>;
  cid_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  cid_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cid_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  cid_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_starts_with?: InputMaybe<Scalars['String']['input']>;
  cid_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdTx?: InputMaybe<Scalars['String']['input']>;
  createdTx_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  rawJson?: InputMaybe<Scalars['String']['input']>;
  rawJson_contains?: InputMaybe<Scalars['String']['input']>;
  rawJson_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_ends_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  rawJson_not?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_contains?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  rawJson_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_starts_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  updateCount?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updateCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  updateCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
  updatedBy_contains?: InputMaybe<Scalars['String']['input']>;
  updatedBy_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedBy_not?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_contains?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedBy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedTx?: InputMaybe<Scalars['String']['input']>;
  updatedTx_contains?: InputMaybe<Scalars['String']['input']>;
  updatedTx_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedTx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedTx_not?: InputMaybe<Scalars['String']['input']>;
  updatedTx_not_contains?: InputMaybe<Scalars['String']['input']>;
  updatedTx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedTx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedTx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedTx_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri?: InputMaybe<Scalars['String']['input']>;
  uri_contains?: InputMaybe<Scalars['String']['input']>;
  uri_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type MetadataSlotPage = {
  __typename?: 'metadataSlotPage';
  items: Array<MetadataSlot>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type MetadataUpdatedEvent = {
  __typename?: 'metadataUpdatedEvent';
  adType?: Maybe<Scalars['String']['output']>;
  author: Scalars['String']['output'];
  authorRef?: Maybe<Account>;
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  cid?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  rawJson?: Maybe<Scalars['String']['output']>;
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
  updatedBy: Scalars['String']['output'];
  uri: Scalars['String']['output'];
};

export type MetadataUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<MetadataUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<MetadataUpdatedEventFilter>>>;
  adType?: InputMaybe<Scalars['String']['input']>;
  adType_contains?: InputMaybe<Scalars['String']['input']>;
  adType_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_ends_with?: InputMaybe<Scalars['String']['input']>;
  adType_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  adType_not?: InputMaybe<Scalars['String']['input']>;
  adType_not_contains?: InputMaybe<Scalars['String']['input']>;
  adType_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  adType_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  adType_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  adType_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  adType_starts_with?: InputMaybe<Scalars['String']['input']>;
  adType_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  author?: InputMaybe<Scalars['String']['input']>;
  author_contains?: InputMaybe<Scalars['String']['input']>;
  author_ends_with?: InputMaybe<Scalars['String']['input']>;
  author_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  author_not?: InputMaybe<Scalars['String']['input']>;
  author_not_contains?: InputMaybe<Scalars['String']['input']>;
  author_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  author_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  author_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  author_starts_with?: InputMaybe<Scalars['String']['input']>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  cid?: InputMaybe<Scalars['String']['input']>;
  cid_contains?: InputMaybe<Scalars['String']['input']>;
  cid_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_ends_with?: InputMaybe<Scalars['String']['input']>;
  cid_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cid_not?: InputMaybe<Scalars['String']['input']>;
  cid_not_contains?: InputMaybe<Scalars['String']['input']>;
  cid_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  cid_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cid_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  cid_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  cid_starts_with?: InputMaybe<Scalars['String']['input']>;
  cid_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson?: InputMaybe<Scalars['String']['input']>;
  rawJson_contains?: InputMaybe<Scalars['String']['input']>;
  rawJson_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_ends_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  rawJson_not?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_contains?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  rawJson_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rawJson_starts_with?: InputMaybe<Scalars['String']['input']>;
  rawJson_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
  updatedBy_contains?: InputMaybe<Scalars['String']['input']>;
  updatedBy_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedBy_not?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_contains?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  updatedBy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedBy_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri?: InputMaybe<Scalars['String']['input']>;
  uri_contains?: InputMaybe<Scalars['String']['input']>;
  uri_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains?: InputMaybe<Scalars['String']['input']>;
  uri_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  uri_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with?: InputMaybe<Scalars['String']['input']>;
  uri_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type MetadataUpdatedEventPage = {
  __typename?: 'metadataUpdatedEventPage';
  items: Array<MetadataUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Module = {
  __typename?: 'module';
  chainId: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  factory: Scalars['String']['output'];
  factoryRef?: Maybe<Factory>;
  feeBps: Scalars['BigInt']['output'];
  feesPaid?: Maybe<ModuleFeePaidEventPage>;
  id: Scalars['String']['output'];
  image?: Maybe<Scalars['String']['output']>;
  metadataURI?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  slots?: Maybe<SlotPage>;
  totalFeesCollected: Scalars['BigInt']['output'];
  verified: Scalars['Boolean']['output'];
  version: Scalars['String']['output'];
};


export type ModuleFeesPaidArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleFeePaidEventFilter>;
};


export type ModuleSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};

export type ModuleFeePaidEvent = {
  __typename?: 'moduleFeePaidEvent';
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  feeBps: Scalars['BigInt']['output'];
  id: Scalars['String']['output'];
  module: Scalars['String']['output'];
  moduleRef?: Maybe<Module>;
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type ModuleFeePaidEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<ModuleFeePaidEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ModuleFeePaidEventFilter>>>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  feeBps?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_gt?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_gte?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  feeBps_lt?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_lte?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_not?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  module?: InputMaybe<Scalars['String']['input']>;
  module_contains?: InputMaybe<Scalars['String']['input']>;
  module_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not?: InputMaybe<Scalars['String']['input']>;
  module_not_contains?: InputMaybe<Scalars['String']['input']>;
  module_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  module_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type ModuleFeePaidEventPage = {
  __typename?: 'moduleFeePaidEventPage';
  items: Array<ModuleFeePaidEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ModuleFilter = {
  AND?: InputMaybe<Array<InputMaybe<ModuleFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ModuleFilter>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  description?: InputMaybe<Scalars['String']['input']>;
  description_contains?: InputMaybe<Scalars['String']['input']>;
  description_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_ends_with?: InputMaybe<Scalars['String']['input']>;
  description_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not?: InputMaybe<Scalars['String']['input']>;
  description_not_contains?: InputMaybe<Scalars['String']['input']>;
  description_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  description_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  description_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  description_starts_with?: InputMaybe<Scalars['String']['input']>;
  description_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  factory?: InputMaybe<Scalars['String']['input']>;
  factory_contains?: InputMaybe<Scalars['String']['input']>;
  factory_ends_with?: InputMaybe<Scalars['String']['input']>;
  factory_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  factory_not?: InputMaybe<Scalars['String']['input']>;
  factory_not_contains?: InputMaybe<Scalars['String']['input']>;
  factory_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  factory_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  factory_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  factory_starts_with?: InputMaybe<Scalars['String']['input']>;
  feeBps?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_gt?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_gte?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  feeBps_lt?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_lte?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_not?: InputMaybe<Scalars['BigInt']['input']>;
  feeBps_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  image_contains?: InputMaybe<Scalars['String']['input']>;
  image_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  image_ends_with?: InputMaybe<Scalars['String']['input']>;
  image_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  image_not?: InputMaybe<Scalars['String']['input']>;
  image_not_contains?: InputMaybe<Scalars['String']['input']>;
  image_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  image_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  image_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  image_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  image_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  image_starts_with?: InputMaybe<Scalars['String']['input']>;
  image_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI?: InputMaybe<Scalars['String']['input']>;
  metadataURI_contains?: InputMaybe<Scalars['String']['input']>;
  metadataURI_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataURI_not?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadataURI_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataURI_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataURI_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  name_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  name_starts_with?: InputMaybe<Scalars['String']['input']>;
  name_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  totalFeesCollected?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalFeesCollected_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalFeesCollected_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  version?: InputMaybe<Scalars['String']['input']>;
  version_contains?: InputMaybe<Scalars['String']['input']>;
  version_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  version_ends_with?: InputMaybe<Scalars['String']['input']>;
  version_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  version_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  version_not?: InputMaybe<Scalars['String']['input']>;
  version_not_contains?: InputMaybe<Scalars['String']['input']>;
  version_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  version_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  version_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  version_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  version_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  version_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  version_starts_with?: InputMaybe<Scalars['String']['input']>;
  version_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type ModulePage = {
  __typename?: 'modulePage';
  items: Array<Module>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ModuleUpdateProposedEvent = {
  __typename?: 'moduleUpdateProposedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  newModule: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type ModuleUpdateProposedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<ModuleUpdateProposedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ModuleUpdateProposedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  newModule?: InputMaybe<Scalars['String']['input']>;
  newModule_contains?: InputMaybe<Scalars['String']['input']>;
  newModule_ends_with?: InputMaybe<Scalars['String']['input']>;
  newModule_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newModule_not?: InputMaybe<Scalars['String']['input']>;
  newModule_not_contains?: InputMaybe<Scalars['String']['input']>;
  newModule_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  newModule_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newModule_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  newModule_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type ModuleUpdateProposedEventPage = {
  __typename?: 'moduleUpdateProposedEventPage';
  items: Array<ModuleUpdateProposedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type OperatorSetEvent = {
  __typename?: 'operatorSetEvent';
  approved: Scalars['Boolean']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  occupant: Scalars['String']['output'];
  operator: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type OperatorSetEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<OperatorSetEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<OperatorSetEventFilter>>>;
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  approved_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  approved_not?: InputMaybe<Scalars['Boolean']['input']>;
  approved_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  operator?: InputMaybe<Scalars['String']['input']>;
  operator_contains?: InputMaybe<Scalars['String']['input']>;
  operator_ends_with?: InputMaybe<Scalars['String']['input']>;
  operator_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  operator_not?: InputMaybe<Scalars['String']['input']>;
  operator_not_contains?: InputMaybe<Scalars['String']['input']>;
  operator_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  operator_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  operator_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  operator_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type OperatorSetEventPage = {
  __typename?: 'operatorSetEventPage';
  items: Array<OperatorSetEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PendingUpdateCancelledEvent = {
  __typename?: 'pendingUpdateCancelledEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type PendingUpdateCancelledEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<PendingUpdateCancelledEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PendingUpdateCancelledEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type PendingUpdateCancelledEventPage = {
  __typename?: 'pendingUpdateCancelledEventPage';
  items: Array<PendingUpdateCancelledEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PendingUpdateEvent = {
  __typename?: 'pendingUpdateEvent';
  action: Scalars['String']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  kind: Scalars['Int']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type PendingUpdateEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<PendingUpdateEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PendingUpdateEventFilter>>>;
  action?: InputMaybe<Scalars['String']['input']>;
  action_contains?: InputMaybe<Scalars['String']['input']>;
  action_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  action_ends_with?: InputMaybe<Scalars['String']['input']>;
  action_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  action_not?: InputMaybe<Scalars['String']['input']>;
  action_not_contains?: InputMaybe<Scalars['String']['input']>;
  action_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  action_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  action_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  action_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  action_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  action_starts_with?: InputMaybe<Scalars['String']['input']>;
  action_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  kind?: InputMaybe<Scalars['Int']['input']>;
  kind_gt?: InputMaybe<Scalars['Int']['input']>;
  kind_gte?: InputMaybe<Scalars['Int']['input']>;
  kind_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  kind_lt?: InputMaybe<Scalars['Int']['input']>;
  kind_lte?: InputMaybe<Scalars['Int']['input']>;
  kind_not?: InputMaybe<Scalars['Int']['input']>;
  kind_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
  value_contains?: InputMaybe<Scalars['String']['input']>;
  value_ends_with?: InputMaybe<Scalars['String']['input']>;
  value_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value_not?: InputMaybe<Scalars['String']['input']>;
  value_not_contains?: InputMaybe<Scalars['String']['input']>;
  value_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  value_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  value_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type PendingUpdateEventPage = {
  __typename?: 'pendingUpdateEventPage';
  items: Array<PendingUpdateEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PolicyUpdateAppliedEvent = {
  __typename?: 'policyUpdateAppliedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  newPolicy: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type PolicyUpdateAppliedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<PolicyUpdateAppliedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PolicyUpdateAppliedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  newPolicy?: InputMaybe<Scalars['String']['input']>;
  newPolicy_contains?: InputMaybe<Scalars['String']['input']>;
  newPolicy_ends_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newPolicy_not?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_contains?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newPolicy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type PolicyUpdateAppliedEventPage = {
  __typename?: 'policyUpdateAppliedEventPage';
  items: Array<PolicyUpdateAppliedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PolicyUpdateProposedEvent = {
  __typename?: 'policyUpdateProposedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  newPolicy: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type PolicyUpdateProposedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<PolicyUpdateProposedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PolicyUpdateProposedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  newPolicy?: InputMaybe<Scalars['String']['input']>;
  newPolicy_contains?: InputMaybe<Scalars['String']['input']>;
  newPolicy_ends_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newPolicy_not?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_contains?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  newPolicy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  newPolicy_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type PolicyUpdateProposedEventPage = {
  __typename?: 'policyUpdateProposedEventPage';
  items: Array<PolicyUpdateProposedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PriceUpdatedEvent = {
  __typename?: 'priceUpdatedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  newPrice: Scalars['BigInt']['output'];
  oldPrice: Scalars['BigInt']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type PriceUpdatedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<PriceUpdatedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PriceUpdatedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  newPrice?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_gt?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_gte?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  newPrice_lt?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_lte?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_not?: InputMaybe<Scalars['BigInt']['input']>;
  newPrice_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  oldPrice?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_gt?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_gte?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  oldPrice_lt?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_lte?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_not?: InputMaybe<Scalars['BigInt']['input']>;
  oldPrice_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type PriceUpdatedEventPage = {
  __typename?: 'priceUpdatedEventPage';
  items: Array<PriceUpdatedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RefundClaimedEvent = {
  __typename?: 'refundClaimedEvent';
  account: Scalars['String']['output'];
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type RefundClaimedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<RefundClaimedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<RefundClaimedEventFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type RefundClaimedEventPage = {
  __typename?: 'refundClaimedEventPage';
  items: Array<RefundClaimedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RefundCreditedEvent = {
  __typename?: 'refundCreditedEvent';
  account: Scalars['String']['output'];
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type RefundCreditedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<RefundCreditedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<RefundCreditedEventFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type RefundCreditedEventPage = {
  __typename?: 'refundCreditedEventPage';
  items: Array<RefundCreditedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ReleasedEvent = {
  __typename?: 'releasedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  occupant: Scalars['String']['output'];
  refund: Scalars['BigInt']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type ReleasedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<ReleasedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ReleasedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  refund?: InputMaybe<Scalars['BigInt']['input']>;
  refund_gt?: InputMaybe<Scalars['BigInt']['input']>;
  refund_gte?: InputMaybe<Scalars['BigInt']['input']>;
  refund_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  refund_lt?: InputMaybe<Scalars['BigInt']['input']>;
  refund_lte?: InputMaybe<Scalars['BigInt']['input']>;
  refund_not?: InputMaybe<Scalars['BigInt']['input']>;
  refund_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type ReleasedEventPage = {
  __typename?: 'releasedEventPage';
  items: Array<ReleasedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SettledEvent = {
  __typename?: 'settledEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  depositRemaining: Scalars['BigInt']['output'];
  id: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  taxOwed: Scalars['BigInt']['output'];
  taxPaid: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type SettledEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<SettledEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SettledEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  depositRemaining?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  depositRemaining_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositRemaining_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  taxOwed?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxOwed_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaid?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaid_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type SettledEventPage = {
  __typename?: 'settledEventPage';
  items: Array<SettledEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type Slot = {
  __typename?: 'slot';
  accountSlots?: Maybe<AccountSlotPage>;
  boughtEvents?: Maybe<BoughtEventPage>;
  chainId: Scalars['Int']['output'];
  collectedTax: Scalars['BigInt']['output'];
  createdAt: Scalars['BigInt']['output'];
  createdTx: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  deployedEvents?: Maybe<SlotDeployedEventPage>;
  deposit: Scalars['BigInt']['output'];
  depositedEvents?: Maybe<DepositedEventPage>;
  factory: Scalars['String']['output'];
  factoryRef?: Maybe<Factory>;
  feed?: Maybe<Scalars['String']['output']>;
  feedRef?: Maybe<Feed>;
  id: Scalars['String']['output'];
  isOccupied: Scalars['Boolean']['output'];
  liquidatedEvents?: Maybe<LiquidatedEventPage>;
  liquidationBountyBps: Scalars['BigInt']['output'];
  manager: Scalars['String']['output'];
  managerCollectiveRef?: Maybe<SlotCollective>;
  metadata?: Maybe<MetadataSlot>;
  metadataUpdates?: Maybe<MetadataUpdatedEventPage>;
  minDepositSeconds: Scalars['BigInt']['output'];
  module?: Maybe<Scalars['String']['output']>;
  moduleFeePaidEvents?: Maybe<ModuleFeePaidEventPage>;
  moduleRef?: Maybe<Module>;
  moduleUpdateProposedEvents?: Maybe<ModuleUpdateProposedEventPage>;
  mutableModule: Scalars['Boolean']['output'];
  mutablePolicy: Scalars['Boolean']['output'];
  mutableTax: Scalars['Boolean']['output'];
  occupancyPolicy?: Maybe<Scalars['String']['output']>;
  occupant?: Maybe<Scalars['String']['output']>;
  occupantAccount?: Maybe<Scalars['String']['output']>;
  occupantAccountRef?: Maybe<Account>;
  occupiedSince: Scalars['BigInt']['output'];
  operatorSetEvents?: Maybe<OperatorSetEventPage>;
  operators?: Maybe<SlotOperatorPage>;
  pendingPolicy?: Maybe<Scalars['String']['output']>;
  pendingTaxPercentage?: Maybe<Scalars['BigInt']['output']>;
  pendingUpdateCancelledEvents?: Maybe<PendingUpdateCancelledEventPage>;
  pendingUpdateEvents?: Maybe<PendingUpdateEventPage>;
  pendingUtility?: Maybe<Scalars['String']['output']>;
  policyProposedAt?: Maybe<Scalars['BigInt']['output']>;
  policyUpdateAppliedEvents?: Maybe<PolicyUpdateAppliedEventPage>;
  policyUpdateProposedEvents?: Maybe<PolicyUpdateProposedEventPage>;
  price: Scalars['BigInt']['output'];
  priceUpdatedEvents?: Maybe<PriceUpdatedEventPage>;
  recipient: Scalars['String']['output'];
  recipientAccount: Scalars['String']['output'];
  recipientAccountRef?: Maybe<Account>;
  recipientCollectiveRef?: Maybe<SlotCollective>;
  refundClaimedEvents?: Maybe<RefundClaimedEventPage>;
  refundCreditedEvents?: Maybe<RefundCreditedEventPage>;
  refunds?: Maybe<SlotRefundPage>;
  releasedEvents?: Maybe<ReleasedEventPage>;
  settledEvents?: Maybe<SettledEventPage>;
  taxCollectedEvents?: Maybe<TaxCollectedEventPage>;
  taxPaidEvents?: Maybe<TaxPaidEventPage>;
  taxPaidTotal: Scalars['BigInt']['output'];
  taxPercentage: Scalars['BigInt']['output'];
  taxProposedAt?: Maybe<Scalars['BigInt']['output']>;
  taxUpdateProposedEvents?: Maybe<TaxUpdateProposedEventPage>;
  totalCollected: Scalars['BigInt']['output'];
  updatedAt: Scalars['BigInt']['output'];
  utilityProposedAt?: Maybe<Scalars['BigInt']['output']>;
  withdrawnEvents?: Maybe<WithdrawnEventPage>;
};


export type SlotAccountSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountSlotFilter>;
};


export type SlotBoughtEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<BoughtEventFilter>;
};


export type SlotDeployedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotDeployedEventFilter>;
};


export type SlotDepositedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<DepositedEventFilter>;
};


export type SlotLiquidatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<LiquidatedEventFilter>;
};


export type SlotMetadataUpdatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<MetadataUpdatedEventFilter>;
};


export type SlotModuleFeePaidEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleFeePaidEventFilter>;
};


export type SlotModuleUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ModuleUpdateProposedEventFilter>;
};


export type SlotOperatorSetEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<OperatorSetEventFilter>;
};


export type SlotOperatorsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotOperatorFilter>;
};


export type SlotPendingUpdateCancelledEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PendingUpdateCancelledEventFilter>;
};


export type SlotPendingUpdateEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PendingUpdateEventFilter>;
};


export type SlotPolicyUpdateAppliedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PolicyUpdateAppliedEventFilter>;
};


export type SlotPolicyUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PolicyUpdateProposedEventFilter>;
};


export type SlotPriceUpdatedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PriceUpdatedEventFilter>;
};


export type SlotRefundClaimedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<RefundClaimedEventFilter>;
};


export type SlotRefundCreditedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<RefundCreditedEventFilter>;
};


export type SlotRefundsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotRefundFilter>;
};


export type SlotReleasedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ReleasedEventFilter>;
};


export type SlotSettledEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SettledEventFilter>;
};


export type SlotTaxCollectedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxCollectedEventFilter>;
};


export type SlotTaxPaidEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxPaidEventFilter>;
};


export type SlotTaxUpdateProposedEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxUpdateProposedEventFilter>;
};


export type SlotWithdrawnEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<WithdrawnEventFilter>;
};

export type SlotCollective = {
  __typename?: 'slotCollective';
  actions?: Maybe<CollectiveActionEventPage>;
  admin: Scalars['String']['output'];
  chainId: Scalars['Int']['output'];
  createdAt: Scalars['BigInt']['output'];
  createdTx: Scalars['String']['output'];
  deployer: Scalars['String']['output'];
  distributionIncentive: Scalars['Int']['output'];
  distributions?: Maybe<CollectiveDistributionEventPage>;
  id: Scalars['String']['output'];
  managedSlots?: Maybe<SlotPage>;
  paused: Scalars['Boolean']['output'];
  receivingSlots?: Maybe<SlotPage>;
  roles?: Maybe<CollectiveRolePage>;
  splitHash?: Maybe<Scalars['String']['output']>;
  splitRecipientCount: Scalars['Int']['output'];
  splitRecipients?: Maybe<CollectiveSplitRecipientPage>;
  splitUpdates?: Maybe<CollectiveSplitUpdatedEventPage>;
  totalAllocation: Scalars['BigInt']['output'];
  updatedAt: Scalars['BigInt']['output'];
};


export type SlotCollectiveActionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveActionEventFilter>;
};


export type SlotCollectiveDistributionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveDistributionEventFilter>;
};


export type SlotCollectiveManagedSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};


export type SlotCollectiveReceivingSlotsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
};


export type SlotCollectiveRolesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveRoleFilter>;
};


export type SlotCollectiveSplitRecipientsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveSplitRecipientFilter>;
};


export type SlotCollectiveSplitUpdatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<CollectiveSplitUpdatedEventFilter>;
};

export type SlotCollectiveFilter = {
  AND?: InputMaybe<Array<InputMaybe<SlotCollectiveFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SlotCollectiveFilter>>>;
  admin?: InputMaybe<Scalars['String']['input']>;
  admin_contains?: InputMaybe<Scalars['String']['input']>;
  admin_ends_with?: InputMaybe<Scalars['String']['input']>;
  admin_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  admin_not?: InputMaybe<Scalars['String']['input']>;
  admin_not_contains?: InputMaybe<Scalars['String']['input']>;
  admin_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  admin_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  admin_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  admin_starts_with?: InputMaybe<Scalars['String']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdTx?: InputMaybe<Scalars['String']['input']>;
  createdTx_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_starts_with?: InputMaybe<Scalars['String']['input']>;
  deployer?: InputMaybe<Scalars['String']['input']>;
  deployer_contains?: InputMaybe<Scalars['String']['input']>;
  deployer_ends_with?: InputMaybe<Scalars['String']['input']>;
  deployer_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  deployer_not?: InputMaybe<Scalars['String']['input']>;
  deployer_not_contains?: InputMaybe<Scalars['String']['input']>;
  deployer_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  deployer_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  deployer_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  deployer_starts_with?: InputMaybe<Scalars['String']['input']>;
  distributionIncentive?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_gt?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_gte?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  distributionIncentive_lt?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_lte?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_not?: InputMaybe<Scalars['Int']['input']>;
  distributionIncentive_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  paused?: InputMaybe<Scalars['Boolean']['input']>;
  paused_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  paused_not?: InputMaybe<Scalars['Boolean']['input']>;
  paused_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  splitHash?: InputMaybe<Scalars['String']['input']>;
  splitHash_contains?: InputMaybe<Scalars['String']['input']>;
  splitHash_ends_with?: InputMaybe<Scalars['String']['input']>;
  splitHash_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  splitHash_not?: InputMaybe<Scalars['String']['input']>;
  splitHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  splitHash_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  splitHash_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  splitHash_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  splitHash_starts_with?: InputMaybe<Scalars['String']['input']>;
  splitRecipientCount?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_gt?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_gte?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  splitRecipientCount_lt?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_lte?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_not?: InputMaybe<Scalars['Int']['input']>;
  splitRecipientCount_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  totalAllocation?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalAllocation_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalAllocation_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type SlotCollectivePage = {
  __typename?: 'slotCollectivePage';
  items: Array<SlotCollective>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SlotDeployedEvent = {
  __typename?: 'slotDeployedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  deployer: Scalars['String']['output'];
  id: Scalars['String']['output'];
  liquidationBountyBps: Scalars['BigInt']['output'];
  manager: Scalars['String']['output'];
  minDepositSeconds: Scalars['BigInt']['output'];
  module: Scalars['String']['output'];
  mutableModule: Scalars['Boolean']['output'];
  mutablePolicy: Scalars['Boolean']['output'];
  mutableTax: Scalars['Boolean']['output'];
  occupancyPolicy?: Maybe<Scalars['String']['output']>;
  recipient: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  taxPercentage: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type SlotDeployedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<SlotDeployedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SlotDeployedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  deployer?: InputMaybe<Scalars['String']['input']>;
  deployer_contains?: InputMaybe<Scalars['String']['input']>;
  deployer_ends_with?: InputMaybe<Scalars['String']['input']>;
  deployer_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  deployer_not?: InputMaybe<Scalars['String']['input']>;
  deployer_not_contains?: InputMaybe<Scalars['String']['input']>;
  deployer_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  deployer_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  deployer_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  deployer_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  liquidationBountyBps?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_gt?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_gte?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  liquidationBountyBps_lt?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_lte?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_not?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  manager?: InputMaybe<Scalars['String']['input']>;
  manager_contains?: InputMaybe<Scalars['String']['input']>;
  manager_ends_with?: InputMaybe<Scalars['String']['input']>;
  manager_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  manager_not?: InputMaybe<Scalars['String']['input']>;
  manager_not_contains?: InputMaybe<Scalars['String']['input']>;
  manager_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  manager_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  manager_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  manager_starts_with?: InputMaybe<Scalars['String']['input']>;
  minDepositSeconds?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_gt?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_gte?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  minDepositSeconds_lt?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_lte?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_not?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  module?: InputMaybe<Scalars['String']['input']>;
  module_contains?: InputMaybe<Scalars['String']['input']>;
  module_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not?: InputMaybe<Scalars['String']['input']>;
  module_not_contains?: InputMaybe<Scalars['String']['input']>;
  module_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  module_starts_with?: InputMaybe<Scalars['String']['input']>;
  mutableModule?: InputMaybe<Scalars['Boolean']['input']>;
  mutableModule_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableModule_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutableModule_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutablePolicy?: InputMaybe<Scalars['Boolean']['input']>;
  mutablePolicy_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutablePolicy_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutablePolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableTax?: InputMaybe<Scalars['Boolean']['input']>;
  mutableTax_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableTax_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutableTax_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  occupancyPolicy?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_contains?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupancyPolicy_not?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupancyPolicy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient?: InputMaybe<Scalars['String']['input']>;
  recipient_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not?: InputMaybe<Scalars['String']['input']>;
  recipient_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  taxPercentage?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPercentage_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type SlotDeployedEventPage = {
  __typename?: 'slotDeployedEventPage';
  items: Array<SlotDeployedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SlotFilter = {
  AND?: InputMaybe<Array<InputMaybe<SlotFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SlotFilter>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  collectedTax?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_gt?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_gte?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  collectedTax_lt?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_lte?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_not?: InputMaybe<Scalars['BigInt']['input']>;
  collectedTax_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  createdTx?: InputMaybe<Scalars['String']['input']>;
  createdTx_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_contains?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdTx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  createdTx_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  deposit?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  deposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  factory?: InputMaybe<Scalars['String']['input']>;
  factory_contains?: InputMaybe<Scalars['String']['input']>;
  factory_ends_with?: InputMaybe<Scalars['String']['input']>;
  factory_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  factory_not?: InputMaybe<Scalars['String']['input']>;
  factory_not_contains?: InputMaybe<Scalars['String']['input']>;
  factory_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  factory_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  factory_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  factory_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed?: InputMaybe<Scalars['String']['input']>;
  feed_contains?: InputMaybe<Scalars['String']['input']>;
  feed_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not?: InputMaybe<Scalars['String']['input']>;
  feed_not_contains?: InputMaybe<Scalars['String']['input']>;
  feed_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  feed_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  feed_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  feed_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  isOccupied?: InputMaybe<Scalars['Boolean']['input']>;
  isOccupied_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  isOccupied_not?: InputMaybe<Scalars['Boolean']['input']>;
  isOccupied_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  liquidationBountyBps?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_gt?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_gte?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  liquidationBountyBps_lt?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_lte?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_not?: InputMaybe<Scalars['BigInt']['input']>;
  liquidationBountyBps_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  manager?: InputMaybe<Scalars['String']['input']>;
  manager_contains?: InputMaybe<Scalars['String']['input']>;
  manager_ends_with?: InputMaybe<Scalars['String']['input']>;
  manager_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  manager_not?: InputMaybe<Scalars['String']['input']>;
  manager_not_contains?: InputMaybe<Scalars['String']['input']>;
  manager_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  manager_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  manager_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  manager_starts_with?: InputMaybe<Scalars['String']['input']>;
  minDepositSeconds?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_gt?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_gte?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  minDepositSeconds_lt?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_lte?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_not?: InputMaybe<Scalars['BigInt']['input']>;
  minDepositSeconds_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  module?: InputMaybe<Scalars['String']['input']>;
  module_contains?: InputMaybe<Scalars['String']['input']>;
  module_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not?: InputMaybe<Scalars['String']['input']>;
  module_not_contains?: InputMaybe<Scalars['String']['input']>;
  module_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  module_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  module_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  module_starts_with?: InputMaybe<Scalars['String']['input']>;
  mutableModule?: InputMaybe<Scalars['Boolean']['input']>;
  mutableModule_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableModule_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutableModule_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutablePolicy?: InputMaybe<Scalars['Boolean']['input']>;
  mutablePolicy_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutablePolicy_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutablePolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableTax?: InputMaybe<Scalars['Boolean']['input']>;
  mutableTax_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  mutableTax_not?: InputMaybe<Scalars['Boolean']['input']>;
  mutableTax_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  occupancyPolicy?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_contains?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupancyPolicy_not?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupancyPolicy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupancyPolicy_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupantAccount?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_contains?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupantAccount_not?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupantAccount_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupantAccount_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupiedSince?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_gt?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_gte?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  occupiedSince_lt?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_lte?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_not?: InputMaybe<Scalars['BigInt']['input']>;
  occupiedSince_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  pendingPolicy?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_contains?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_ends_with?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  pendingPolicy_not?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_not_contains?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  pendingPolicy_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  pendingPolicy_starts_with?: InputMaybe<Scalars['String']['input']>;
  pendingTaxPercentage?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_gt?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_gte?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  pendingTaxPercentage_lt?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_lte?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_not?: InputMaybe<Scalars['BigInt']['input']>;
  pendingTaxPercentage_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  pendingUtility?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_contains?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_ends_with?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  pendingUtility_not?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_not_contains?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  pendingUtility_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  pendingUtility_starts_with?: InputMaybe<Scalars['String']['input']>;
  policyProposedAt?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  policyProposedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  policyProposedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  price?: InputMaybe<Scalars['BigInt']['input']>;
  price_gt?: InputMaybe<Scalars['BigInt']['input']>;
  price_gte?: InputMaybe<Scalars['BigInt']['input']>;
  price_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  price_lt?: InputMaybe<Scalars['BigInt']['input']>;
  price_lte?: InputMaybe<Scalars['BigInt']['input']>;
  price_not?: InputMaybe<Scalars['BigInt']['input']>;
  price_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  recipient?: InputMaybe<Scalars['String']['input']>;
  recipientAccount?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_contains?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipientAccount_not?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipientAccount_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipientAccount_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not?: InputMaybe<Scalars['String']['input']>;
  recipient_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_starts_with?: InputMaybe<Scalars['String']['input']>;
  taxPaidTotal?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaidTotal_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaidTotal_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPercentage?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPercentage_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPercentage_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxProposedAt?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxProposedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxProposedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalCollected?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  totalCollected_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalCollected_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  utilityProposedAt?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  utilityProposedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  utilityProposedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type SlotOperator = {
  __typename?: 'slotOperator';
  approved: Scalars['Boolean']['output'];
  chainId: Scalars['Int']['output'];
  occupant: Scalars['String']['output'];
  operator: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  updatedAt: Scalars['BigInt']['output'];
};

export type SlotOperatorFilter = {
  AND?: InputMaybe<Array<InputMaybe<SlotOperatorFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SlotOperatorFilter>>>;
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  approved_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  approved_not?: InputMaybe<Scalars['Boolean']['input']>;
  approved_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  operator?: InputMaybe<Scalars['String']['input']>;
  operator_contains?: InputMaybe<Scalars['String']['input']>;
  operator_ends_with?: InputMaybe<Scalars['String']['input']>;
  operator_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  operator_not?: InputMaybe<Scalars['String']['input']>;
  operator_not_contains?: InputMaybe<Scalars['String']['input']>;
  operator_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  operator_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  operator_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  operator_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type SlotOperatorPage = {
  __typename?: 'slotOperatorPage';
  items: Array<SlotOperator>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SlotPage = {
  __typename?: 'slotPage';
  items: Array<Slot>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type SlotRefund = {
  __typename?: 'slotRefund';
  account: Scalars['String']['output'];
  balance: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  claimed: Scalars['BigInt']['output'];
  credited: Scalars['BigInt']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  updatedAt: Scalars['BigInt']['output'];
};

export type SlotRefundFilter = {
  AND?: InputMaybe<Array<InputMaybe<SlotRefundFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<SlotRefundFilter>>>;
  account?: InputMaybe<Scalars['String']['input']>;
  account_contains?: InputMaybe<Scalars['String']['input']>;
  account_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not?: InputMaybe<Scalars['String']['input']>;
  account_not_contains?: InputMaybe<Scalars['String']['input']>;
  account_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  account_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  account_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  account_starts_with?: InputMaybe<Scalars['String']['input']>;
  balance?: InputMaybe<Scalars['BigInt']['input']>;
  balance_gt?: InputMaybe<Scalars['BigInt']['input']>;
  balance_gte?: InputMaybe<Scalars['BigInt']['input']>;
  balance_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  balance_lt?: InputMaybe<Scalars['BigInt']['input']>;
  balance_lte?: InputMaybe<Scalars['BigInt']['input']>;
  balance_not?: InputMaybe<Scalars['BigInt']['input']>;
  balance_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  claimed?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_gt?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_gte?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  claimed_lt?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_lte?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_not?: InputMaybe<Scalars['BigInt']['input']>;
  claimed_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  credited?: InputMaybe<Scalars['BigInt']['input']>;
  credited_gt?: InputMaybe<Scalars['BigInt']['input']>;
  credited_gte?: InputMaybe<Scalars['BigInt']['input']>;
  credited_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  credited_lt?: InputMaybe<Scalars['BigInt']['input']>;
  credited_lte?: InputMaybe<Scalars['BigInt']['input']>;
  credited_not?: InputMaybe<Scalars['BigInt']['input']>;
  credited_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
};

export type SlotRefundPage = {
  __typename?: 'slotRefundPage';
  items: Array<SlotRefund>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TaxCollectedEvent = {
  __typename?: 'taxCollectedEvent';
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  recipient: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type TaxCollectedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<TaxCollectedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<TaxCollectedEventFilter>>>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  recipient?: InputMaybe<Scalars['String']['input']>;
  recipient_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not?: InputMaybe<Scalars['String']['input']>;
  recipient_not_contains?: InputMaybe<Scalars['String']['input']>;
  recipient_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  recipient_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  recipient_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  recipient_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type TaxCollectedEventPage = {
  __typename?: 'taxCollectedEventPage';
  items: Array<TaxCollectedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TaxPaidEvent = {
  __typename?: 'taxPaidEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  matchedOccupant: Scalars['Boolean']['output'];
  occupant: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  taxOwed: Scalars['BigInt']['output'];
  taxPaid: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type TaxPaidEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<TaxPaidEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<TaxPaidEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  matchedOccupant?: InputMaybe<Scalars['Boolean']['input']>;
  matchedOccupant_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  matchedOccupant_not?: InputMaybe<Scalars['Boolean']['input']>;
  matchedOccupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  taxOwed?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxOwed_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxOwed_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaid?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_gte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  taxPaid_lt?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_lte?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not?: InputMaybe<Scalars['BigInt']['input']>;
  taxPaid_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type TaxPaidEventPage = {
  __typename?: 'taxPaidEventPage';
  items: Array<TaxPaidEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TaxUpdateProposedEvent = {
  __typename?: 'taxUpdateProposedEvent';
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  newPercentage: Scalars['BigInt']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type TaxUpdateProposedEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<TaxUpdateProposedEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<TaxUpdateProposedEventFilter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  newPercentage?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_gt?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_gte?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  newPercentage_lt?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_lte?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_not?: InputMaybe<Scalars['BigInt']['input']>;
  newPercentage_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type TaxUpdateProposedEventPage = {
  __typename?: 'taxUpdateProposedEventPage';
  items: Array<TaxUpdateProposedEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type WithdrawnEvent = {
  __typename?: 'withdrawnEvent';
  amount: Scalars['BigInt']['output'];
  blockNumber: Scalars['BigInt']['output'];
  chainId: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  currencyRef?: Maybe<Currency>;
  id: Scalars['String']['output'];
  occupant: Scalars['String']['output'];
  slot: Scalars['String']['output'];
  slotRef?: Maybe<Slot>;
  timestamp: Scalars['BigInt']['output'];
  tx: Scalars['String']['output'];
};

export type WithdrawnEventFilter = {
  AND?: InputMaybe<Array<InputMaybe<WithdrawnEventFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<WithdrawnEventFilter>>>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
  chainId_gt?: InputMaybe<Scalars['Int']['input']>;
  chainId_gte?: InputMaybe<Scalars['Int']['input']>;
  chainId_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  chainId_lt?: InputMaybe<Scalars['Int']['input']>;
  chainId_lte?: InputMaybe<Scalars['Int']['input']>;
  chainId_not?: InputMaybe<Scalars['Int']['input']>;
  chainId_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  currency?: InputMaybe<Scalars['String']['input']>;
  currency_contains?: InputMaybe<Scalars['String']['input']>;
  currency_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not?: InputMaybe<Scalars['String']['input']>;
  currency_not_contains?: InputMaybe<Scalars['String']['input']>;
  currency_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  currency_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  currency_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  currency_starts_with?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  id_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id_starts_with?: InputMaybe<Scalars['String']['input']>;
  id_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  occupant?: InputMaybe<Scalars['String']['input']>;
  occupant_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not?: InputMaybe<Scalars['String']['input']>;
  occupant_not_contains?: InputMaybe<Scalars['String']['input']>;
  occupant_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  occupant_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  occupant_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  occupant_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot?: InputMaybe<Scalars['String']['input']>;
  slot_contains?: InputMaybe<Scalars['String']['input']>;
  slot_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not?: InputMaybe<Scalars['String']['input']>;
  slot_not_contains?: InputMaybe<Scalars['String']['input']>;
  slot_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slot_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  slot_starts_with?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  timestamp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  tx_starts_with?: InputMaybe<Scalars['String']['input']>;
};

export type WithdrawnEventPage = {
  __typename?: 'withdrawnEventPage';
  items: Array<WithdrawnEvent>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AccountSlotFieldsFragment = { __typename?: 'accountSlot', account: string, slot: string, chainId: number, metadataUpdateCount: string, taxPaid: string, holdTime: string, lastOccupiedAt?: string | null, firstInteractedAt: string, lastInteractedAt: string };

export type GetAccountSlotQueryVariables = Exact<{
  account: Scalars['String']['input'];
  slot: Scalars['String']['input'];
}>;


export type GetAccountSlotQuery = { __typename?: 'Query', accountSlot?: { __typename?: 'accountSlot', account: string, slot: string, chainId: number, metadataUpdateCount: string, taxPaid: string, holdTime: string, lastOccupiedAt?: string | null, firstInteractedAt: string, lastInteractedAt: string, accountRef?: { __typename?: 'account', id: string, type: AccountType } | null, slotRef?: { __typename?: 'slot', id: string, price: string, isOccupied: boolean } | null } | null };

export type GetAccountSlotsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountSlotFilter>;
}>;


export type GetAccountSlotsQuery = { __typename?: 'Query', accountSlots: { __typename?: 'accountSlotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'accountSlot', account: string, slot: string, chainId: number, metadataUpdateCount: string, taxPaid: string, holdTime: string, lastOccupiedAt?: string | null, firstInteractedAt: string, lastInteractedAt: string }> } };

export type AccountFieldsFragment = { __typename?: 'account', id: string, type: AccountType, slotCount: number, metadataUpdateCount: string, totalHoldTime: string, slotsAsRecipient?: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, occupant?: string | null }> } | null };

export type GetAccountQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetAccountQuery = { __typename?: 'Query', account?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, metadataUpdateCount: string, totalHoldTime: string, slotsAsRecipient?: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, occupant?: string | null }> } | null } | null };

export type GetAccountsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountFilter>;
}>;


export type GetAccountsQuery = { __typename?: 'Query', accounts: { __typename?: 'accountPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'account', id: string, type: AccountType, slotCount: number, metadataUpdateCount: string, totalHoldTime: string, slotsAsRecipient?: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, occupant?: string | null }> } | null }> } };

export type GetAccountWithSlotsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAccountWithSlotsQuery = { __typename?: 'Query', account?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, metadataUpdateCount: string, totalHoldTime: string, slotsAsRecipient?: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, occupant?: string | null }> } | null } | null, asRecipient: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, chainId: number, occupant?: string | null, isOccupied: boolean, price: string }> }, asOccupant: { __typename?: 'slotPage', totalCount: number, items: Array<{ __typename?: 'slot', id: string, chainId: number, price: string, deposit: string, occupiedSince: string }> } };

export type AccountChainFieldsFragment = { __typename?: 'accountChain', account: string, chainId: number, slotCount: number, occupiedAsRecipient: number, occupiedCount: number, accountRef?: { __typename?: 'account', id: string, type: AccountType } | null };

export type GetAccountChainsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<AccountChainFilter>;
}>;


export type GetAccountChainsQuery = { __typename?: 'Query', accountChains: { __typename?: 'accountChainPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'accountChain', account: string, chainId: number, slotCount: number, occupiedAsRecipient: number, occupiedCount: number, accountRef?: { __typename?: 'account', id: string, type: AccountType } | null }> } };

export type CurrencyFieldsFragment = { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number };

export type GetSlotDeployedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotDeployedEventFilter>;
}>;


export type GetSlotDeployedEventsQuery = { __typename?: 'Query', slotDeployedEvents: { __typename?: 'slotDeployedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'slotDeployedEvent', id: string, chainId: number, slot: string, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module: string, occupancyPolicy?: string | null, liquidationBountyBps: string, minDepositSeconds: string, deployer: string, timestamp: string, blockNumber: string, tx: string, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null }> } };

export type GetBoughtEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<BoughtEventFilter>;
}>;


export type GetBoughtEventsQuery = { __typename?: 'Query', boughtEvents: { __typename?: 'boughtEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'boughtEvent', id: string, chainId: number, slot: string, currency: string, buyer: string, previousOccupant: string, price: string, deposit: string, selfAssessedPrice: string, timestamp: string, blockNumber: string, tx: string, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null }> } };

export type GetReleasedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<ReleasedEventFilter>;
}>;


export type GetReleasedEventsQuery = { __typename?: 'Query', releasedEvents: { __typename?: 'releasedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'releasedEvent', id: string, chainId: number, slot: string, currency: string, occupant: string, refund: string, timestamp: string, blockNumber: string, tx: string, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null }> } };

export type GetLiquidatedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<LiquidatedEventFilter>;
}>;


export type GetLiquidatedEventsQuery = { __typename?: 'Query', liquidatedEvents: { __typename?: 'liquidatedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'liquidatedEvent', id: string, chainId: number, slot: string, currency: string, liquidator: string, occupant: string, bounty: string, timestamp: string, blockNumber: string, tx: string, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null }> } };

export type GetPriceUpdatedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<PriceUpdatedEventFilter>;
}>;


export type GetPriceUpdatedEventsQuery = { __typename?: 'Query', priceUpdatedEvents: { __typename?: 'priceUpdatedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'priceUpdatedEvent', id: string, chainId: number, slot: string, currency: string, oldPrice: string, newPrice: string, timestamp: string, blockNumber: string, tx: string }> } };

export type GetDepositedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<DepositedEventFilter>;
}>;


export type GetDepositedEventsQuery = { __typename?: 'Query', depositedEvents: { __typename?: 'depositedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'depositedEvent', id: string, chainId: number, slot: string, currency: string, depositor: string, amount: string, timestamp: string, blockNumber: string, tx: string }> } };

export type GetWithdrawnEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<WithdrawnEventFilter>;
}>;


export type GetWithdrawnEventsQuery = { __typename?: 'Query', withdrawnEvents: { __typename?: 'withdrawnEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'withdrawnEvent', id: string, chainId: number, slot: string, currency: string, occupant: string, amount: string, timestamp: string, blockNumber: string, tx: string }> } };

export type GetSettledEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SettledEventFilter>;
}>;


export type GetSettledEventsQuery = { __typename?: 'Query', settledEvents: { __typename?: 'settledEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'settledEvent', id: string, chainId: number, slot: string, currency: string, taxOwed: string, taxPaid: string, depositRemaining: string, timestamp: string, blockNumber: string, tx: string }> } };

export type GetTaxPaidEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxPaidEventFilter>;
}>;


export type GetTaxPaidEventsQuery = { __typename?: 'Query', taxPaidEvents: { __typename?: 'taxPaidEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'taxPaidEvent', id: string, chainId: number, slot: string, currency: string, occupant: string, taxOwed: string, taxPaid: string, matchedOccupant: boolean, timestamp: string, blockNumber: string, tx: string }> } };

export type GetTaxCollectedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<TaxCollectedEventFilter>;
}>;


export type GetTaxCollectedEventsQuery = { __typename?: 'Query', taxCollectedEvents: { __typename?: 'taxCollectedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'taxCollectedEvent', id: string, chainId: number, slot: string, currency: string, recipient: string, amount: string, timestamp: string, blockNumber: string, tx: string }> } };

export type GetSlotRefundsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<SlotRefundFilter>;
}>;


export type GetSlotRefundsQuery = { __typename?: 'Query', slotRefunds: { __typename?: 'slotRefundPage', totalCount: number, items: Array<{ __typename?: 'slotRefund', slot: string, account: string, chainId: number, currency: string, credited: string, claimed: string, balance: string, updatedAt: string }> } };

export type GetSlotOperatorsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<SlotOperatorFilter>;
}>;


export type GetSlotOperatorsQuery = { __typename?: 'Query', slotOperators: { __typename?: 'slotOperatorPage', totalCount: number, items: Array<{ __typename?: 'slotOperator', slot: string, occupant: string, operator: string, chainId: number, approved: boolean, updatedAt: string }> } };

export type GetRecentEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  chainId?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetRecentEventsQuery = { __typename?: 'Query', slotDeployedEvents: { __typename?: 'slotDeployedEventPage', items: Array<{ __typename?: 'slotDeployedEvent', id: string, chainId: number, slot: string, recipient: string, deployer: string, timestamp: string, tx: string }> }, boughtEvents: { __typename?: 'boughtEventPage', items: Array<{ __typename?: 'boughtEvent', id: string, chainId: number, slot: string, buyer: string, previousOccupant: string, price: string, selfAssessedPrice: string, deposit: string, timestamp: string, tx: string }> }, releasedEvents: { __typename?: 'releasedEventPage', items: Array<{ __typename?: 'releasedEvent', id: string, chainId: number, slot: string, occupant: string, refund: string, timestamp: string, tx: string }> }, liquidatedEvents: { __typename?: 'liquidatedEventPage', items: Array<{ __typename?: 'liquidatedEvent', id: string, chainId: number, slot: string, liquidator: string, occupant: string, bounty: string, timestamp: string, tx: string }> }, priceUpdatedEvents: { __typename?: 'priceUpdatedEventPage', items: Array<{ __typename?: 'priceUpdatedEvent', id: string, chainId: number, slot: string, oldPrice: string, newPrice: string, timestamp: string, tx: string }> }, taxCollectedEvents: { __typename?: 'taxCollectedEventPage', items: Array<{ __typename?: 'taxCollectedEvent', id: string, chainId: number, slot: string, recipient: string, amount: string, timestamp: string, tx: string }> } };

export type GetSlotActivityQueryVariables = Exact<{
  slot: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetSlotActivityQuery = { __typename?: 'Query', boughtEvents: { __typename?: 'boughtEventPage', items: Array<{ __typename?: 'boughtEvent', id: string, buyer: string, previousOccupant: string, price: string, selfAssessedPrice: string, deposit: string, timestamp: string, tx: string }> }, releasedEvents: { __typename?: 'releasedEventPage', items: Array<{ __typename?: 'releasedEvent', id: string, occupant: string, refund: string, timestamp: string, tx: string }> }, liquidatedEvents: { __typename?: 'liquidatedEventPage', items: Array<{ __typename?: 'liquidatedEvent', id: string, liquidator: string, occupant: string, bounty: string, timestamp: string, tx: string }> }, priceUpdatedEvents: { __typename?: 'priceUpdatedEventPage', items: Array<{ __typename?: 'priceUpdatedEvent', id: string, oldPrice: string, newPrice: string, timestamp: string, tx: string }> }, depositedEvents: { __typename?: 'depositedEventPage', items: Array<{ __typename?: 'depositedEvent', id: string, depositor: string, amount: string, timestamp: string, tx: string }> }, withdrawnEvents: { __typename?: 'withdrawnEventPage', items: Array<{ __typename?: 'withdrawnEvent', id: string, occupant: string, amount: string, timestamp: string, tx: string }> }, taxPaidEvents: { __typename?: 'taxPaidEventPage', items: Array<{ __typename?: 'taxPaidEvent', id: string, occupant: string, taxOwed: string, taxPaid: string, matchedOccupant: boolean, timestamp: string, tx: string }> }, taxCollectedEvents: { __typename?: 'taxCollectedEventPage', items: Array<{ __typename?: 'taxCollectedEvent', id: string, recipient: string, amount: string, timestamp: string, tx: string }> }, pendingUpdateEvents: { __typename?: 'pendingUpdateEventPage', items: Array<{ __typename?: 'pendingUpdateEvent', id: string, kind: number, action: string, value?: string | null, timestamp: string, tx: string }> } };

export type GetFactoryQueryVariables = Exact<{
  chainId?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetFactoryQuery = { __typename?: 'Query', factorys: { __typename?: 'factoryPage', totalCount: number, items: Array<{ __typename?: 'factory', id: string, chainId: number, slotCount: string }> } };

export type GetModulesQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<ModuleFilter>;
}>;


export type GetModulesQuery = { __typename?: 'Query', modules: { __typename?: 'modulePage', totalCount: number, items: Array<{ __typename?: 'module', id: string, chainId: number, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string }> } };

export type MetadataSlotFieldsFragment = { __typename?: 'metadataSlot', id: string, chainId: number, slot: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, updatedBy: string, updateCount: string, createdAt: string, createdTx: string, updatedAt: string, updatedTx: string };

export type GetMetadataSlotsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<MetadataSlotFilter>;
}>;


export type GetMetadataSlotsQuery = { __typename?: 'Query', metadataSlots: { __typename?: 'metadataSlotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'metadataSlot', id: string, chainId: number, slot: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, updatedBy: string, updateCount: string, createdAt: string, createdTx: string, updatedAt: string, updatedTx: string }> } };

export type GetMetadataSlotQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetMetadataSlotQuery = { __typename?: 'Query', metadataSlot?: { __typename?: 'metadataSlot', id: string, chainId: number, slot: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, updatedBy: string, updateCount: string, createdAt: string, createdTx: string, updatedAt: string, updatedTx: string, slotRef?: { __typename?: 'slot', id: string, occupant?: string | null, recipient: string, price: string } | null } | null };

export type GetMetadataSlotsBySlotsQueryVariables = Exact<{
  slots?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetMetadataSlotsBySlotsQuery = { __typename?: 'Query', metadataSlots: { __typename?: 'metadataSlotPage', totalCount: number, items: Array<{ __typename?: 'metadataSlot', id: string, chainId: number, slot: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, updatedBy: string, updateCount: string, createdAt: string, createdTx: string, updatedAt: string, updatedTx: string }> } };

export type GetMetadataUpdatedEventsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<MetadataUpdatedEventFilter>;
}>;


export type GetMetadataUpdatedEventsQuery = { __typename?: 'Query', metadataUpdatedEvents: { __typename?: 'metadataUpdatedEventPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'metadataUpdatedEvent', id: string, chainId: number, slot: string, author: string, updatedBy: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, timestamp: string, blockNumber: string, tx: string, authorRef?: { __typename?: 'account', id: string, type: AccountType } | null }> } };

export type SlotFieldsFragment = { __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null };

export type GetSlotsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
}>;


export type GetSlotsQuery = { __typename?: 'Query', slots: { __typename?: 'slotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null }, items: Array<{ __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null }> } };

export type GetSlotQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetSlotQuery = { __typename?: 'Query', slot?: { __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null } | null };

export type GetSlotsByRecipientQueryVariables = Exact<{
  recipient: Scalars['String']['input'];
  chainId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetSlotsByRecipientQuery = { __typename?: 'Query', slots: { __typename?: 'slotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null }> } };

export type GetSlotsByOccupantQueryVariables = Exact<{
  occupant: Scalars['String']['input'];
  chainId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetSlotsByOccupantQuery = { __typename?: 'Query', slots: { __typename?: 'slotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null }> } };

export type GetSlotsWithMetadataQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Scalars['String']['input']>;
  orderDirection?: InputMaybe<Scalars['String']['input']>;
  where?: InputMaybe<SlotFilter>;
}>;


export type GetSlotsWithMetadataQuery = { __typename?: 'Query', slots: { __typename?: 'slotPage', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items: Array<{ __typename?: 'slot', id: string, chainId: number, recipient: string, currency: string, manager: string, mutableTax: boolean, mutableModule: boolean, mutablePolicy: boolean, taxPercentage: string, module?: string | null, occupant?: string | null, isOccupied: boolean, occupiedSince: string, price: string, deposit: string, collectedTax: string, taxPaidTotal: string, totalCollected: string, liquidationBountyBps: string, minDepositSeconds: string, occupancyPolicy?: string | null, pendingTaxPercentage?: string | null, taxProposedAt?: string | null, pendingUtility?: string | null, utilityProposedAt?: string | null, pendingPolicy?: string | null, policyProposedAt?: string | null, createdAt: string, createdTx: string, updatedAt: string, metadata?: { __typename?: 'metadataSlot', id: string, uri: string, cid?: string | null, rawJson?: string | null, adType?: string | null, updatedBy: string, updateCount: string, updatedAt: string } | null, recipientAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null, currencyRef?: { __typename?: 'currency', id: string, name?: string | null, symbol?: string | null, decimals: number } | null, moduleRef?: { __typename?: 'module', id: string, verified: boolean, name: string, version: string, feeBps: string, metadataURI?: string | null, image?: string | null, description?: string | null, totalFeesCollected: string } | null, occupantAccountRef?: { __typename?: 'account', id: string, type: AccountType, slotCount: number, occupiedCount: number } | null }> } };

export const AccountSlotFieldsFragmentDoc = gql`
    fragment AccountSlotFields on accountSlot {
  account
  slot
  chainId
  metadataUpdateCount
  taxPaid
  holdTime
  lastOccupiedAt
  firstInteractedAt
  lastInteractedAt
}
    `;
export const AccountFieldsFragmentDoc = gql`
    fragment AccountFields on account {
  id
  type
  slotCount
  metadataUpdateCount
  totalHoldTime
  slotsAsRecipient(limit: 500) {
    totalCount
    items {
      id
      occupant
    }
  }
}
    `;
export const AccountChainFieldsFragmentDoc = gql`
    fragment AccountChainFields on accountChain {
  account
  chainId
  slotCount
  occupiedAsRecipient
  occupiedCount
  accountRef {
    id
    type
  }
}
    `;
export const CurrencyFieldsFragmentDoc = gql`
    fragment CurrencyFields on currency {
  id
  name
  symbol
  decimals
}
    `;
export const MetadataSlotFieldsFragmentDoc = gql`
    fragment MetadataSlotFields on metadataSlot {
  id
  chainId
  slot
  uri
  cid
  rawJson
  adType
  updatedBy
  updateCount
  createdAt
  createdTx
  updatedAt
  updatedTx
}
    `;
export const SlotFieldsFragmentDoc = gql`
    fragment SlotFields on slot {
  id
  chainId
  recipient
  recipientAccountRef {
    id
    type
    slotCount
    occupiedCount
  }
  currency
  currencyRef {
    id
    name
    symbol
    decimals
  }
  manager
  mutableTax
  mutableModule
  mutablePolicy
  taxPercentage
  module
  moduleRef {
    id
    verified
    name
    version
    feeBps
    metadataURI
    image
    description
    totalFeesCollected
  }
  occupant
  occupantAccountRef {
    id
    type
    slotCount
    occupiedCount
  }
  isOccupied
  occupiedSince
  price
  deposit
  collectedTax
  taxPaidTotal
  totalCollected
  liquidationBountyBps
  minDepositSeconds
  occupancyPolicy
  pendingTaxPercentage
  taxProposedAt
  pendingUtility
  utilityProposedAt
  pendingPolicy
  policyProposedAt
  createdAt
  createdTx
  updatedAt
}
    `;
export const GetAccountSlotDocument = gql`
    query GetAccountSlot($account: String!, $slot: String!) {
  accountSlot(account: $account, slot: $slot) {
    ...AccountSlotFields
    accountRef {
      id
      type
    }
    slotRef {
      id
      price
      isOccupied
    }
  }
}
    ${AccountSlotFieldsFragmentDoc}`;
export const GetAccountSlotsDocument = gql`
    query GetAccountSlots($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: accountSlotFilter) {
  accountSlots(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...AccountSlotFields
    }
  }
}
    ${AccountSlotFieldsFragmentDoc}`;
export const GetAccountDocument = gql`
    query GetAccount($id: String!) {
  account(id: $id) {
    ...AccountFields
  }
}
    ${AccountFieldsFragmentDoc}`;
export const GetAccountsDocument = gql`
    query GetAccounts($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: accountFilter) {
  accounts(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...AccountFields
    }
  }
}
    ${AccountFieldsFragmentDoc}`;
export const GetAccountWithSlotsDocument = gql`
    query GetAccountWithSlots($id: String!, $limit: Int, $chainId: Int) {
  account(id: $id) {
    ...AccountFields
  }
  asRecipient: slots(
    where: {recipient: $id, chainId: $chainId}
    limit: $limit
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    totalCount
    items {
      id
      chainId
      occupant
      isOccupied
      price
    }
  }
  asOccupant: slots(
    where: {occupant: $id, chainId: $chainId}
    limit: $limit
    orderBy: "occupiedSince"
    orderDirection: "desc"
  ) {
    totalCount
    items {
      id
      chainId
      price
      deposit
      occupiedSince
    }
  }
}
    ${AccountFieldsFragmentDoc}`;
export const GetAccountChainsDocument = gql`
    query GetAccountChains($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: accountChainFilter) {
  accountChains(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...AccountChainFields
    }
  }
}
    ${AccountChainFieldsFragmentDoc}`;
export const GetSlotDeployedEventsDocument = gql`
    query GetSlotDeployedEvents($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: slotDeployedEventFilter) {
  slotDeployedEvents(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      recipient
      currency
      currencyRef {
        ...CurrencyFields
      }
      manager
      mutableTax
      mutableModule
      mutablePolicy
      taxPercentage
      module
      occupancyPolicy
      liquidationBountyBps
      minDepositSeconds
      deployer
      timestamp
      blockNumber
      tx
    }
  }
}
    ${CurrencyFieldsFragmentDoc}`;
export const GetBoughtEventsDocument = gql`
    query GetBoughtEvents($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: boughtEventFilter) {
  boughtEvents(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      currencyRef {
        ...CurrencyFields
      }
      buyer
      previousOccupant
      price
      deposit
      selfAssessedPrice
      timestamp
      blockNumber
      tx
    }
  }
}
    ${CurrencyFieldsFragmentDoc}`;
export const GetReleasedEventsDocument = gql`
    query GetReleasedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: releasedEventFilter) {
  releasedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      currencyRef {
        ...CurrencyFields
      }
      occupant
      refund
      timestamp
      blockNumber
      tx
    }
  }
}
    ${CurrencyFieldsFragmentDoc}`;
export const GetLiquidatedEventsDocument = gql`
    query GetLiquidatedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: liquidatedEventFilter) {
  liquidatedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      currencyRef {
        ...CurrencyFields
      }
      liquidator
      occupant
      bounty
      timestamp
      blockNumber
      tx
    }
  }
}
    ${CurrencyFieldsFragmentDoc}`;
export const GetPriceUpdatedEventsDocument = gql`
    query GetPriceUpdatedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: priceUpdatedEventFilter) {
  priceUpdatedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      oldPrice
      newPrice
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetDepositedEventsDocument = gql`
    query GetDepositedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: depositedEventFilter) {
  depositedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      depositor
      amount
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetWithdrawnEventsDocument = gql`
    query GetWithdrawnEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: withdrawnEventFilter) {
  withdrawnEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      occupant
      amount
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetSettledEventsDocument = gql`
    query GetSettledEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: settledEventFilter) {
  settledEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      taxOwed
      taxPaid
      depositRemaining
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetTaxPaidEventsDocument = gql`
    query GetTaxPaidEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: taxPaidEventFilter) {
  taxPaidEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      occupant
      taxOwed
      taxPaid
      matchedOccupant
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetTaxCollectedEventsDocument = gql`
    query GetTaxCollectedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: taxCollectedEventFilter) {
  taxCollectedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      currency
      recipient
      amount
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetSlotRefundsDocument = gql`
    query GetSlotRefunds($limit: Int, $where: slotRefundFilter) {
  slotRefunds(where: $where, limit: $limit) {
    totalCount
    items {
      slot
      account
      chainId
      currency
      credited
      claimed
      balance
      updatedAt
    }
  }
}
    `;
export const GetSlotOperatorsDocument = gql`
    query GetSlotOperators($limit: Int, $where: slotOperatorFilter) {
  slotOperators(where: $where, limit: $limit) {
    totalCount
    items {
      slot
      occupant
      operator
      chainId
      approved
      updatedAt
    }
  }
}
    `;
export const GetRecentEventsDocument = gql`
    query GetRecentEvents($limit: Int, $chainId: Int) {
  slotDeployedEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      recipient
      deployer
      timestamp
      tx
    }
  }
  boughtEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      buyer
      previousOccupant
      price
      selfAssessedPrice
      deposit
      timestamp
      tx
    }
  }
  releasedEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      occupant
      refund
      timestamp
      tx
    }
  }
  liquidatedEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      liquidator
      occupant
      bounty
      timestamp
      tx
    }
  }
  priceUpdatedEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      oldPrice
      newPrice
      timestamp
      tx
    }
  }
  taxCollectedEvents(
    limit: $limit
    where: {chainId: $chainId}
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      chainId
      slot
      recipient
      amount
      timestamp
      tx
    }
  }
}
    `;
export const GetSlotActivityDocument = gql`
    query GetSlotActivity($slot: String!, $limit: Int) {
  boughtEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      buyer
      previousOccupant
      price
      selfAssessedPrice
      deposit
      timestamp
      tx
    }
  }
  releasedEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      occupant
      refund
      timestamp
      tx
    }
  }
  liquidatedEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      liquidator
      occupant
      bounty
      timestamp
      tx
    }
  }
  priceUpdatedEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      oldPrice
      newPrice
      timestamp
      tx
    }
  }
  depositedEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      depositor
      amount
      timestamp
      tx
    }
  }
  withdrawnEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      occupant
      amount
      timestamp
      tx
    }
  }
  taxPaidEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      occupant
      taxOwed
      taxPaid
      matchedOccupant
      timestamp
      tx
    }
  }
  taxCollectedEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      recipient
      amount
      timestamp
      tx
    }
  }
  pendingUpdateEvents(
    where: {slot: $slot}
    limit: $limit
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      kind
      action
      value
      timestamp
      tx
    }
  }
}
    `;
export const GetFactoryDocument = gql`
    query GetFactory($chainId: Int) {
  factorys(where: {chainId: $chainId}, limit: 1) {
    totalCount
    items {
      id
      chainId
      slotCount
    }
  }
}
    `;
export const GetModulesDocument = gql`
    query GetModules($limit: Int, $where: moduleFilter) {
  modules(where: $where, limit: $limit) {
    totalCount
    items {
      id
      chainId
      verified
      name
      version
      feeBps
      metadataURI
      image
      description
      totalFeesCollected
    }
  }
}
    `;
export const GetMetadataSlotsDocument = gql`
    query GetMetadataSlots($limit: Int, $offset: Int, $after: String, $orderBy: String, $orderDirection: String, $where: metadataSlotFilter) {
  metadataSlots(
    limit: $limit
    offset: $offset
    after: $after
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...MetadataSlotFields
    }
  }
}
    ${MetadataSlotFieldsFragmentDoc}`;
export const GetMetadataSlotDocument = gql`
    query GetMetadataSlot($id: String!) {
  metadataSlot(id: $id) {
    ...MetadataSlotFields
    slotRef {
      id
      occupant
      recipient
      price
    }
  }
}
    ${MetadataSlotFieldsFragmentDoc}`;
export const GetMetadataSlotsBySlotsDocument = gql`
    query GetMetadataSlotsBySlots($slots: [String!], $limit: Int) {
  metadataSlots(where: {slot_in: $slots}, limit: $limit) {
    totalCount
    items {
      ...MetadataSlotFields
    }
  }
}
    ${MetadataSlotFieldsFragmentDoc}`;
export const GetMetadataUpdatedEventsDocument = gql`
    query GetMetadataUpdatedEvents($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: metadataUpdatedEventFilter) {
  metadataUpdatedEvents(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      id
      chainId
      slot
      author
      authorRef {
        id
        type
      }
      updatedBy
      uri
      cid
      rawJson
      adType
      timestamp
      blockNumber
      tx
    }
  }
}
    `;
export const GetSlotsDocument = gql`
    query GetSlots($limit: Int, $offset: Int, $after: String, $before: String, $orderBy: String, $orderDirection: String, $where: slotFilter) {
  slots(
    limit: $limit
    offset: $offset
    after: $after
    before: $before
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    items {
      ...SlotFields
    }
  }
}
    ${SlotFieldsFragmentDoc}`;
export const GetSlotDocument = gql`
    query GetSlot($id: String!) {
  slot(id: $id) {
    ...SlotFields
  }
}
    ${SlotFieldsFragmentDoc}`;
export const GetSlotsByRecipientDocument = gql`
    query GetSlotsByRecipient($recipient: String!, $chainId: Int, $limit: Int, $offset: Int) {
  slots(
    where: {recipient: $recipient, chainId: $chainId}
    limit: $limit
    offset: $offset
    orderBy: "createdAt"
    orderDirection: "desc"
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...SlotFields
    }
  }
}
    ${SlotFieldsFragmentDoc}`;
export const GetSlotsByOccupantDocument = gql`
    query GetSlotsByOccupant($occupant: String!, $chainId: Int, $limit: Int, $offset: Int) {
  slots(
    where: {occupant: $occupant, chainId: $chainId}
    limit: $limit
    offset: $offset
    orderBy: "occupiedSince"
    orderDirection: "desc"
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...SlotFields
    }
  }
}
    ${SlotFieldsFragmentDoc}`;
export const GetSlotsWithMetadataDocument = gql`
    query GetSlotsWithMetadata($limit: Int, $offset: Int, $orderBy: String, $orderDirection: String, $where: slotFilter) {
  slots(
    limit: $limit
    offset: $offset
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    items {
      ...SlotFields
      metadata {
        id
        uri
        cid
        rawJson
        adType
        updatedBy
        updateCount
        updatedAt
      }
    }
  }
}
    ${SlotFieldsFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetAccountSlot(variables: GetAccountSlotQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountSlotQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountSlotQuery>({ document: GetAccountSlotDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccountSlot', 'query', variables);
    },
    GetAccountSlots(variables?: GetAccountSlotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountSlotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountSlotsQuery>({ document: GetAccountSlotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccountSlots', 'query', variables);
    },
    GetAccount(variables: GetAccountQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountQuery>({ document: GetAccountDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccount', 'query', variables);
    },
    GetAccounts(variables?: GetAccountsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountsQuery>({ document: GetAccountsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccounts', 'query', variables);
    },
    GetAccountWithSlots(variables: GetAccountWithSlotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountWithSlotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountWithSlotsQuery>({ document: GetAccountWithSlotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccountWithSlots', 'query', variables);
    },
    GetAccountChains(variables?: GetAccountChainsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAccountChainsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAccountChainsQuery>({ document: GetAccountChainsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAccountChains', 'query', variables);
    },
    GetSlotDeployedEvents(variables?: GetSlotDeployedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotDeployedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotDeployedEventsQuery>({ document: GetSlotDeployedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotDeployedEvents', 'query', variables);
    },
    GetBoughtEvents(variables?: GetBoughtEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetBoughtEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetBoughtEventsQuery>({ document: GetBoughtEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetBoughtEvents', 'query', variables);
    },
    GetReleasedEvents(variables?: GetReleasedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetReleasedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetReleasedEventsQuery>({ document: GetReleasedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetReleasedEvents', 'query', variables);
    },
    GetLiquidatedEvents(variables?: GetLiquidatedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetLiquidatedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetLiquidatedEventsQuery>({ document: GetLiquidatedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetLiquidatedEvents', 'query', variables);
    },
    GetPriceUpdatedEvents(variables?: GetPriceUpdatedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPriceUpdatedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPriceUpdatedEventsQuery>({ document: GetPriceUpdatedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPriceUpdatedEvents', 'query', variables);
    },
    GetDepositedEvents(variables?: GetDepositedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetDepositedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetDepositedEventsQuery>({ document: GetDepositedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetDepositedEvents', 'query', variables);
    },
    GetWithdrawnEvents(variables?: GetWithdrawnEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWithdrawnEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWithdrawnEventsQuery>({ document: GetWithdrawnEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWithdrawnEvents', 'query', variables);
    },
    GetSettledEvents(variables?: GetSettledEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSettledEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSettledEventsQuery>({ document: GetSettledEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSettledEvents', 'query', variables);
    },
    GetTaxPaidEvents(variables?: GetTaxPaidEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTaxPaidEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTaxPaidEventsQuery>({ document: GetTaxPaidEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTaxPaidEvents', 'query', variables);
    },
    GetTaxCollectedEvents(variables?: GetTaxCollectedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetTaxCollectedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetTaxCollectedEventsQuery>({ document: GetTaxCollectedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetTaxCollectedEvents', 'query', variables);
    },
    GetSlotRefunds(variables?: GetSlotRefundsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotRefundsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotRefundsQuery>({ document: GetSlotRefundsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotRefunds', 'query', variables);
    },
    GetSlotOperators(variables?: GetSlotOperatorsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotOperatorsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotOperatorsQuery>({ document: GetSlotOperatorsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotOperators', 'query', variables);
    },
    GetRecentEvents(variables?: GetRecentEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetRecentEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRecentEventsQuery>({ document: GetRecentEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetRecentEvents', 'query', variables);
    },
    GetSlotActivity(variables: GetSlotActivityQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotActivityQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotActivityQuery>({ document: GetSlotActivityDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotActivity', 'query', variables);
    },
    GetFactory(variables?: GetFactoryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetFactoryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetFactoryQuery>({ document: GetFactoryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetFactory', 'query', variables);
    },
    GetModules(variables?: GetModulesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetModulesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetModulesQuery>({ document: GetModulesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetModules', 'query', variables);
    },
    GetMetadataSlots(variables?: GetMetadataSlotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMetadataSlotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMetadataSlotsQuery>({ document: GetMetadataSlotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMetadataSlots', 'query', variables);
    },
    GetMetadataSlot(variables: GetMetadataSlotQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMetadataSlotQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMetadataSlotQuery>({ document: GetMetadataSlotDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMetadataSlot', 'query', variables);
    },
    GetMetadataSlotsBySlots(variables?: GetMetadataSlotsBySlotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMetadataSlotsBySlotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMetadataSlotsBySlotsQuery>({ document: GetMetadataSlotsBySlotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMetadataSlotsBySlots', 'query', variables);
    },
    GetMetadataUpdatedEvents(variables?: GetMetadataUpdatedEventsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetMetadataUpdatedEventsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMetadataUpdatedEventsQuery>({ document: GetMetadataUpdatedEventsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetMetadataUpdatedEvents', 'query', variables);
    },
    GetSlots(variables?: GetSlotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotsQuery>({ document: GetSlotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlots', 'query', variables);
    },
    GetSlot(variables: GetSlotQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotQuery>({ document: GetSlotDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlot', 'query', variables);
    },
    GetSlotsByRecipient(variables: GetSlotsByRecipientQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotsByRecipientQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotsByRecipientQuery>({ document: GetSlotsByRecipientDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotsByRecipient', 'query', variables);
    },
    GetSlotsByOccupant(variables: GetSlotsByOccupantQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotsByOccupantQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotsByOccupantQuery>({ document: GetSlotsByOccupantDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotsByOccupant', 'query', variables);
    },
    GetSlotsWithMetadata(variables?: GetSlotsWithMetadataQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetSlotsWithMetadataQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSlotsWithMetadataQuery>({ document: GetSlotsWithMetadataDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetSlotsWithMetadata', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;