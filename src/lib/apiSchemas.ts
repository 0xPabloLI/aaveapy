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

// ── Token price entry ──
const TokenPriceEntrySchema = z.object({
  price: z.number(),
}).passthrough();

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