/**
 * Frontend Zod schemas — Phase 3 strict layer (AAV-1216).
 *
 * All schemas are based on generated schemas from `src/generated/api/schemas.ts`
 * (which are auto-generated from the backend OpenAPI spec). Unknown keys are
 * stripped (Zod default strip mode) — the spec is now a strict contract.
 *
 * Frontend-specific extensions (transforms, recursive types, looser type overrides)
 * are applied via `.extend()` on the generated base. Nested schemas (e.g. `breakdowns`
 * inside campaign groups) are explicitly overridden to use wrapper versions, because
 * `.extend()` only overrides top-level keys — nested Zod schemas still reference the
 * generated versions.
 */
import { z } from 'zod';
import { schemas as generated } from '../../generated/api/schemas.ts';

// ── Campaign breakdown schemas ──
// The Merit schemas (`ApiMeritCampaignBreakdown` / `CampaignGroupApiMeritCampaignBreakdown`)
// are gone: the backend retired the Merit subsystem on 2026-09-24 (AAV-1289) and
// /api/markets now carries zero merit fields on staging and production (0 of 437
// reserves, measured 2026-11-11). The interim copy of the definitions kept for the
// rollback window was removed here (AAV-1303 second segment), so a merit key in the
// payload is now stripped rather than silently accepted.
// Merkl keeps its frontend loosenings: aprCap is nullable and group `link` is optional.

// MerklCampaignBreakdown: generated schema is compatible, just override aprCap for nullable.
export const MerklCampaignBreakdownSchema = generated.MerklCampaignBreakdown.extend({
  aprCap: z.number().nullable().optional(),
});

// MerklOpportunityGroup: override link to optional (generated has required),
// breakdowns to use wrapper version.
// AAV-895: crossAssetPairing added here because generated schema hasn't been regenerated yet.
export const MerklOpportunityGroupSchema = generated.ApiMerklOpportunityGroup.extend({
  link: z.string().optional(),
  breakdowns: z.array(MerklCampaignBreakdownSchema),
  crossAssetPairing: z
    .object({
      sourceSide: z.enum(['supply', 'borrow']),
      pairedReserveId: z.string(),
      pairedSide: z.enum(['supply', 'borrow']),
      discountFactor: z.number(),
    })
    .nullable()
    .optional(),
});

// ── Brevis schemas (frontend-specific normalization) ──
// Brevis API returns either grouped (with breakdowns array) or flat format.
// Frontend normalizes to flat via transform. Generated schema only models grouped format.
// These schemas stay hand-written because the transform is frontend-specific logic.
export const BrevisCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  campaignType: z.string().optional(),
  aprCap: z.number().nullable().optional(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  positionCapUsd: z.number().optional(),
  isCombineCap: z.boolean().optional(),
  rewardTokenSymbol: z.string().optional(),
});

export const BrevisIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema).optional(),
  campaignApr: z.number().optional(),
  campaignStartedAt: z.string().optional(),
  campaignEndedAt: z.string().optional(),
  campaignType: z.string().optional(),
  aprCap: z.number().nullable().optional(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  positionCapUsd: z.number().optional(),
  isCombineCap: z.boolean().optional(),
  campaignId: z.string().optional(),
});

const BrevisGroupedIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema),
});

const BrevisRawIncentiveSchema = z.union([BrevisGroupedIncentiveSchema, BrevisIncentiveSchema]);

type BrevisRawIncentive = z.infer<typeof BrevisRawIncentiveSchema>;
type BrevisIncentive = z.infer<typeof BrevisIncentiveSchema>;

const isBrevisGroupedIncentive = (entry: BrevisRawIncentive): entry is z.infer<typeof BrevisGroupedIncentiveSchema> =>
  Object.prototype.hasOwnProperty.call(entry, 'breakdowns');

const normalizeBrevisIncentives = (entries: BrevisRawIncentive[] | undefined): BrevisIncentive[] | undefined => {
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

// ── Reserve schema ──
// Based on generated MarketWithSpread + frontend-specific extensions.
// Nested campaign group arrays are overridden to use wrapper versions.
export const ReserveWithSpreadSchema = generated.MarketWithSpread.extend({
  // Frontend-specific fields not in generated spec
  supplyIncentives: z.array(z.number()).optional(),
  borrowIncentives: z.array(z.number()).optional(),
  suppliable: z.string().optional(),
  borrowable: z.string().optional(),
  // Type overrides for backward compat
  isActive: z.literal(false).optional(),
  aTokenAddress: z.string().nullish(),
  vTokenAddress: z.string().nullish(),
  // Override nested arrays to use wrapper schemas
  merklSupplys: z.array(MerklOpportunityGroupSchema).optional(),
  merklBorrows: z.array(MerklOpportunityGroupSchema).optional(),
  merklHolds: z.array(MerklOpportunityGroupSchema).optional(),
  // Brevis normalization transform (frontend-specific)
  brevisSupplys: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
  brevisBorrows: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
});

// ── Markets response schema ──
export const MarketsResponseSchema = z.object({
  snapshot: z.object({
    lastUpdated: z.string(),
    version: z.string().optional(),
    staleTimeMs: z.number().optional(),
    schemaFingerprint: z.string().optional(),
  }),
  reserves: z.array(ReserveWithSpreadSchema),
});
