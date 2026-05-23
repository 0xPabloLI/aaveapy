import { z } from 'zod';

export {
  MarketsResponseSchema,
  ReserveWithSpreadSchema,
  MeritIncentiveSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisIncentiveSchema,
  BrevisCampaignBreakdownSchema,
} from '../shared/market-contract/schemas.ts';

export const MarketsErrorResponseSchema = z.object({
  errorCode: z.enum(['MARKETS_SNAPSHOT_NOT_READY', 'MARKETS_SNAPSHOT_STALE']),
  error: z.string(),
  message: z.string(),
});

// ── Token price entry ──
const TokenPriceEntrySchema = z.object({
  price: z.number(),
}).passthrough();

// ── CoinGecko FDV ──
// Kept: symbol + fdvUsd are consumed by InkAprCalculator.
// Removed: id, name, source — frontend never reads them (backend may still send; passthrough strips).
const CoingeckoFdvItemSchema = z.object({
  symbol: z.string().nullable(),
  fdvUsd: z.number().nullable(),
}).passthrough();
// Schema accepts the union shape: MAX has requiredDaily; FIX omits it.
// Both have distributedSoFar and endTimestamp.
const MerklForecastItemSchema = z.object({
  campaignId: z.string(),
  requiredDaily: z.number().optional(),
  distributedSoFar: z.number(),
  endTimestamp: z.number(),
}).passthrough();

const MerklForecastErrorSchema = z.object({
  campaignId: z.string(),
  status: z.number().optional(),
  message: z.string(),
}).passthrough();

export const SideDataMetaResponseSchema = z.object({
  // Kept: debug timestamp for side-data generation time (zero cost, aids debugging)
  generatedAt: z.string().optional(),
  // Kept: indicates side-data is partially generated (a sub-source fetch failed); UI may surface warning
  partial: z.boolean().optional(),
  categories: z.object({
    uniqueSymbolsStablecoins: z.array(z.string()),
    uniqueSymbolsEth: z.array(z.string()),
    // Kept: debug timestamp for category fetch time
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

// ── Campaign access (dead code — see useCampaignAccess.ts) ──
// Kept: will be reimplemented per aav_66_plan.md (embed in side-data, not separate endpoint).
// Tracked in Epic: wallet-merkl-portfolio.
const CampaignAccessEntrySchema = z.object({
  chainId: z.number(),
  whitelist: z.array(z.string()),
  blacklist: z.array(z.string()),
});

export const CampaignAccessResponseSchema = z.object({
  generatedAt: z.string(),
  campaigns: z.record(z.string(), CampaignAccessEntrySchema),
  updatedAt: z.string(),
  staleTimeMs: z.number(),
});