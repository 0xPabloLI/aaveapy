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
  campaignType: z.string().optional(),
  totalBudget: z.number().optional(),
  aprCap: z.number().nullable().optional(),
  latestTvl: z.number().optional(),
  plannedDaily: z.number().optional(),
});

const MerklOpportunityGroupSchema = z.object({
  link: z.string().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(MerklCampaignBreakdownSchema),
});

const BrevisCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  perUserRewardCapUsd: z.number().optional(),
  campaignId: z.string().optional(),
}).passthrough();

// ── Brevis incentive ──
const BrevisIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema).optional(),
  campaignApr: z.number().optional(),
  campaignStartedAt: z.string().optional(),
  campaignEndedAt: z.string().optional(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  perUserRewardCapUsd: z.number().optional(),
  campaignId: z.string().optional(),
}).passthrough();

const BrevisGroupedIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema),
}).passthrough();

const BrevisRawIncentiveSchema = z.union([
  BrevisGroupedIncentiveSchema,
  BrevisIncentiveSchema,
]);

type BrevisRawIncentive = z.infer<typeof BrevisRawIncentiveSchema>;
type BrevisIncentive = z.infer<typeof BrevisIncentiveSchema>;

const isBrevisGroupedIncentive = (
  entry: BrevisRawIncentive
): entry is z.infer<typeof BrevisGroupedIncentiveSchema> =>
  Object.prototype.hasOwnProperty.call(entry, 'breakdowns');

const normalizeBrevisIncentives = (
  entries: BrevisRawIncentive[] | undefined,
): BrevisIncentive[] | undefined => {
  if (!entries?.length) return undefined;
  const normalized: BrevisIncentive[] = [];
  for (const entry of entries) {
    if (isBrevisGroupedIncentive(entry)) {
      const { breakdowns, ...groupFields } = entry;
      for (const breakdown of breakdowns) {
        normalized.push({
          ...groupFields,
          ...breakdown,
        });
      }
      continue;
    }
    normalized.push(entry);
  }
  return normalized.length > 0 ? normalized : undefined;
};

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
  reserveSizeUsd: z.number().optional(),
  supplyCapUsd: z.number().optional(),
  borrowCapUsd: z.number().optional(),
  utilizationPct: z.number().optional(),
  supplyDisabled: z.boolean().optional(),
  borrowDisabled: z.boolean().optional(),
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
  brevisSupplys: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
  brevisBorrows: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
}).passthrough(); // allow extra fields from API without breaking

// ── Markets response ── (current API: { snapshot, reserves })
export const MarketsResponseSchema = z.object({
  snapshot: z.object({
    lastUpdated: z.string(),
    version: z.string().optional(),
    staleTimeMs: z.number().optional(),
  }),
  reserves: z.array(ReserveWithSpreadSchema),
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

const MerklForecastItemSchema = z.object({
  campaignId: z.string(),
  requiredDaily: z.number().optional(),
  distributedSoFar: z.number().optional(),
  endTimestamp: z.number().optional(),
}).passthrough();

const MerklForecastErrorSchema = z.object({
  campaignId: z.string(),
  status: z.number().optional(),
  message: z.string(),
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
  forecast: z.object({
    items: z.array(MerklForecastItemSchema),
    errors: z.array(MerklForecastErrorSchema),
    staleTimeMs: z.number(),
  }).optional(),
}).passthrough();
