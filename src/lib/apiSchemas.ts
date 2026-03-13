import { z } from 'zod';
import type { IncentiveMessage } from '@/types/aave';

const IncentiveMessageScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const IncentiveMessageSchema: z.ZodType<IncentiveMessage> = z.lazy(() =>
  z.union([
    z.string(),
    z.record(z.string(), z.union([IncentiveMessageScalarSchema, IncentiveMessageSchema])),
    z.array(IncentiveMessageSchema),
  ])
);

// ── Merit incentive ──
const MeritIncentiveSchema = z.object({
  apr: z.number(),
  selfApr: z.number().optional(),
  link: z.string(),
  name: z.string().optional(),
  message: IncentiveMessageSchema.optional(),
  startDate: z.string(),
  endDate: z.string(),
  lastRoundRewardUsd: z.number().optional(),
});

// ── Merkl campaign breakdown ──
const MerklCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  whitelistOnly: z.boolean().optional(),
  pointsPerThousandUsd: z.number().optional(),
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
}).passthrough();

// ── Reserve ── (matches backend /markets reserves[])
const ReserveWithSpreadSchema = z.object({
  reserveId: z.string().optional(),
  marketName: z.string(),
  chainName: z.string(),
  chainId: z.number(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenAddress: z.string(),
  tokenPrice: z.number().optional(),
  tvlUsd: z.number().optional(),
  utilizationPct: z.number().optional(),
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

// ── Markets response ── (legacy shape: data + lastUpdated; current API uses snapshot + reserves)
export const MarketsResponseSchema = z.object({
  data: z.array(ReserveWithSpreadSchema),
  lastUpdated: z.string(),
});

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

export const SideDataMetaResponseSchema = z.object({
  generatedAt: z.string().optional(),
  partial: z.boolean().optional(),
  categories: z.object({
    uniqueSymbolsStablecoins: z.array(z.string()),
    uniqueSymbolsEth: z.array(z.string()),
    fetchedAt: z.string(),
    staleTimeMs: z.number(),
  }).optional(),
  fdv: z.object({
    items: z.array(CoingeckoFdvItemSchema),
    fetchedAt: z.string(),
    staleTimeMs: z.number(),
  }).optional(),
  errors: z.record(z.string(), z.string()).optional(),
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
  source: z.string().optional(),
  sourceDetail: z.string().optional(),
}).passthrough();

export const RateInputsResponseSchema = z
  .object({
    data: z.array(ReserveRateInputSchema),
    lastUpdated: z.string().optional(),
    last_updated: z.string().optional(),
    isStale: z.boolean().optional(),
    is_stale: z.boolean().optional(),
    staleTimeMs: z.number().optional(),
    stale_time_ms: z.number().optional(),
    sources: z
      .object({
        subgraphChains: z.array(z.number()),
        onchainChains: z.array(z.number()),
        subgraphMissingChains: z.array(z.number()),
      })
      .optional(),
  })
  .passthrough()
  .transform((v) => ({
    ...v,
    lastUpdated: v.lastUpdated ?? v.last_updated,
  }));
