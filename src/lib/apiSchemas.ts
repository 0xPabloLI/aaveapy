import { z } from 'zod';

// ── Merit incentive ──
const MeritIncentiveSchema = z.object({
  apr: z.number(),
  selfApr: z.number().optional(),
  link: z.string(),
  name: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
  startDate: z.string(),
  endDate: z.string(),
  startBlock: z.string().optional(),
  endBlock: z.string().optional(),
  requiredBorrowTokens: z.union([z.array(z.string()), z.string()]).optional(),
  requiredSupplyTokens: z.union([z.array(z.string()), z.string()]).optional(),
  lastRoundRewardUsd: z.number().optional(),
});

// ── Merkl campaign breakdown ──
const MerklCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  whitelistOnly: z.boolean().optional(),
  distributionType: z.string().optional(),
  pointsPerThousandUsd: z.number().optional(),
  dailyPoints: z.number().optional(),
});

const MerklOpportunityGroupSchema = z.object({
  link: z.string().optional(),
  opportunityLink: z.string().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(MerklCampaignBreakdownSchema),
});

// ── Brevis incentive ──
const BrevisIncentiveSchema = z.object({
  apr: z.number(),
  link: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  name: z.string(),
});

// ── Token price entry ──
const TokenPriceEntrySchema = z.object({
  price: z.number(),
  updatedAt: z.number(),
  source: z.string(),
});

// ── Reserve ──
const ReserveWithSpreadSchema = z.object({
  marketName: z.string(),
  chainName: z.string(),
  chainId: z.number(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenAddress: z.string(),
  aTokenAddress: z.string().nullish(),
  vTokenAddress: z.string().nullish(),
  supplyApy: z.number().optional(),
  borrowApy: z.number().optional(),
  supplyIncentives: z.array(z.number()).optional(),
  borrowIncentives: z.array(z.number()).optional(),
  meritSupplys: z.array(MeritIncentiveSchema).optional(),
  meritBorrows: z.array(MeritIncentiveSchema).optional(),
  merklSupplys: z.array(MerklOpportunityGroupSchema).optional(),
  merklBorrows: z.array(MerklOpportunityGroupSchema).optional(),
  merklHolds: z.array(MerklOpportunityGroupSchema).optional(),
  brevisSupplys: z.array(BrevisIncentiveSchema).optional(),
  brevisBorrows: z.array(BrevisIncentiveSchema).optional(),
}).passthrough(); // allow extra fields from API without breaking

// ── Markets response ──
export const MarketsResponseSchema = z.object({
  data: z.array(ReserveWithSpreadSchema),
  lastUpdated: z.string(),
  isStale: z.boolean(),
  updateInProgress: z.boolean(),
  tokenPrices: z.record(z.string(), TokenPriceEntrySchema).optional(),
});

// ── Markets list ──
export const MarketListItemSchema = z.object({
  marketName: z.string(),
  chainName: z.string(),
}).passthrough();

export const MarketsListSchema = z.array(MarketListItemSchema);

// ── CoinGecko FDV ──
const CoingeckoFdvItemSchema = z.object({
  id: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  fdvUsd: z.number().nullable(),
}).passthrough();

export const CoingeckoFdvResponseSchema = z.object({
  items: z.array(CoingeckoFdvItemSchema),
  fetchedAt: z.string(),
}).passthrough();

// ── Token categories ──
export const CoingeckoCategoriesResponseSchema = z.object({
  uniqueSymbolsStablecoins: z.array(z.string()).optional(),
  uniqueSymbolsEth: z.array(z.string()).optional(),
}).passthrough();

// ── Rate inputs ──
const ReserveRateInputSchema = z.object({
  marketName: z.string(),
  chainId: z.number(),
  tokenAddress: z.string(),
  decimals: z.number(),
  availableLiquidity: z.string(),
  totalScaledVariableDebt: z.string(),
  variableBorrowIndex: z.string(),
  reserveFactor: z.string(),
  variableRateSlope1: z.string(),
  variableRateSlope2: z.string(),
  baseVariableBorrowRate: z.string(),
  optimalUsageRate: z.string(),
  source: z.string(),
  sourceDetail: z.string(),
}).passthrough();

export const RateInputsResponseSchema = z.object({
  data: z.array(ReserveRateInputSchema),
  lastUpdated: z.string(),
  isStale: z.boolean(),
  staleTimeMs: z.number(),
  sources: z.object({
    subgraphChains: z.array(z.number()),
    onchainChains: z.array(z.number()),
    subgraphMissingChains: z.array(z.number()),
  }),
}).passthrough();
