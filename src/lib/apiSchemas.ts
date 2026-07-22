/**
 * API schemas — Phase 2 wrapper layer (AAV-1214).
 *
 * Re-exports core schemas from `schemas.ts` (which wraps generated schemas).
 * Additional schemas (SideDataMetaResponse, helper schemas) are based on
 * generated schemas where available.
 */
import { z } from 'zod';
import { schemas as generated } from '@/generated/api/schemas';

export {
  MarketsResponseSchema,
  ReserveWithSpreadSchema,
  MeritCampaignGroupSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisIncentiveSchema,
  BrevisCampaignBreakdownSchema,
} from '../shared/market-contract/schemas.ts';

// ── Error response schema ──
// Based on generated MarketsErrorResponse + passthrough for tolerance.
export const MarketsErrorResponseSchema = generated.MarketsErrorResponse.passthrough();

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

// ── Side data errors schema ──
// Override generated SideDataSubSourceErrors: all fields should be optional
// (backend type is Partial<Record<SideDataSubSource, string>>).
const SideDataSubSourceErrorsSchema = z.object({
  categories: z.string().optional(),
  fdv: z.string().optional(),
  forecast: z.string().optional(),
  campaignAccess: z.string().optional(),
});

// ── Side data response schema ──
// Based on generated SideDataPayload + frontend-specific overrides.
// Overrides:
//   - generatedAt: optional (generated has required)
//   - errors: use optional-fields schema (generated has all required)
//   - sub-source schemas: use frontend-specific versions where they differ
export const SideDataMetaResponseSchema = generated.SideDataPayload
  .extend({
    generatedAt: z.string().optional(),
    errors: SideDataSubSourceErrorsSchema.optional(),
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
    campaignAccess: z.object({
      campaigns: z.record(z.string(), z.object({
        chainId: z.number(),
        whitelist: z.array(z.string()),
        blacklist: z.array(z.string()),
      })),
      updatedAt: z.string(),
    }).optional(),
  })
  .passthrough();
