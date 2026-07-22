/**
 * TypeScript types inferred from generated Zod schemas.
 *
 * These types represent the API contract as defined by the backend
 * OpenAPI spec. Frontend code should prefer these over hand-written
 * interfaces for pure API types.
 *
 * DO NOT EDIT — regenerate via `npm run schema:codegen`.
 */
import type { z } from 'zod';
import { schemas } from './schemas';

// ── Campaign types ──
export type ForecastCampaignTypeLite = z.infer<typeof schemas.ForecastCampaignTypeLite>;
export type ApiMeritCampaignBreakdown = z.infer<typeof schemas.ApiMeritCampaignBreakdown>;
export type ApiMeritCampaignGroup = z.infer<typeof schemas.ApiMeritCampaignGroup>;
export type MerklCampaignBreakdown = z.infer<typeof schemas.MerklCampaignBreakdown>;
export type ApiMerklOpportunityGroup = z.infer<typeof schemas.ApiMerklOpportunityGroup>;
export type ApiBrevisBreakdown = z.infer<typeof schemas.ApiBrevisBreakdown>;
export type ApiBrevisCampaignItem = z.infer<typeof schemas.ApiBrevisCampaignItem>;

// ── Reserve / Market types ──
export type MarketWithSpread = z.infer<typeof schemas.MarketWithSpread>;
export type MarketsResponse = z.infer<typeof schemas.MarketsResponse>;
export type MarketsErrorResponse = z.infer<typeof schemas.MarketsErrorResponse>;

// ── Side data types ──
export type SideDataPayload = z.infer<typeof schemas.SideDataPayload>;
export type SideDataSubSourceErrors = z.infer<typeof schemas.SideDataSubSourceErrors>;
