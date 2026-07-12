import type { SimulationCampaignDetail, SimulationSourceDetail } from '@/lib/rateSimulationCalculator';
import type { IncentiveNote } from '@/lib/incentiveCaps';

/** Same threshold as table cells: hide noise below ~0.005 percentage points. */
export const MEANINGFUL_INCENTIVE_PCT = 0.005;

export function hasMeaningfulIncentivePercent(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && Math.abs(value) >= MEANINGFUL_INCENTIVE_PCT;
}

/** True if any non-zero finite contribution (catches Brevis/Merit slices below the display threshold but still in totals). */
function hasNonZeroIncentivePercent(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && Math.abs(value) > 1e-12;
}

/**
 * Whether to list this source in the simulation breakdown table.
 * Uses the display threshold first, then falls back to any non-zero so small incentives are not dropped
 * while they still roll into aggregate Incentive / APY totals.
 */
export function includeIncentiveSourceInBreakdown(src: IncentiveSourceRow): boolean {
  if (hasMeaningfulIncentivePercent(src.current) || hasMeaningfulIncentivePercent(src.after)) return true;
  const campaigns = src.campaigns;
  if (
    campaigns?.some(
      (c) =>
        hasMeaningfulIncentivePercent(c.current) ||
        hasMeaningfulIncentivePercent(c.after) ||
        hasMeaningfulIncentivePercent(c.delta),
    )
  ) {
    return true;
  }
  if (hasNonZeroIncentivePercent(src.current) || hasNonZeroIncentivePercent(src.after)) return true;
  return (
    campaigns?.some(
      (c) =>
        hasNonZeroIncentivePercent(c.current) ||
        hasNonZeroIncentivePercent(c.after) ||
        hasNonZeroIncentivePercent(c.delta),
    ) ?? false
  );
}

export type RowType = 'usd' | 'rate' | 'spread';

/** Rows built for Supply/Borrow simulation breakdown tables (rate + USD rows use same shape). */
export interface SimulationTableRow {
  rowKey: string;
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  type: RowType;
  cap?: number | null;
  href?: string | null;
  isBreakdown?: boolean;
  isSubBreakdown?: boolean;
  warning?: boolean;
  nestedUnderIncentive?: boolean;
  notes?: IncentiveNote[];
}

export interface IncentiveSourceRow extends SimulationSourceDetail {
  label: string;
  href: string | null;
  /** When one campaign, merge into the source row so notes show under the main label (Brevis cap/duration). */
  mergeSingleCampaignRow?: boolean;
  /** Hide source aggregate row when campaigns exist; only list campaign rows (fallback href on src). */
  hideAggregateWhenCampaigns?: boolean;
}

/**
 * First per-campaign link, else source-level link (e.g. Merkl opportunity group), else fallback (usually Aave reserve).
 */
export function resolveFirstIncentiveSourceHref(sources: IncentiveSourceRow[], fallback: string): string {
  for (const src of sources) {
    const campaigns = src.campaigns;
    if (campaigns?.length) {
      for (const c of campaigns) {
        if (c.href) return c.href;
      }
    }
    if (src.href) return src.href;
  }
  return fallback;
}

/** True when any source has at least one campaign-level link. */
export function hasAnyCampaignIncentiveHref(sources: IncentiveSourceRow[]): boolean {
  return sources.some((src) => src.campaigns?.some((campaign) => Boolean(campaign.href)) ?? false);
}

/**
 * True when any rendered child row under aggregate Incentive can navigate.
 * This follows the same fallback as table rows: campaign href falls back to src.href.
 */
export function hasAnyIncentiveBreakdownHref(sources: IncentiveSourceRow[]): boolean {
  return sources.some((src) => {
    const campaigns = src.campaigns;
    if (!campaigns?.length) return Boolean(src.href);
    return campaigns.some((campaign) => Boolean(campaign.href ?? src.href));
  });
}

/**
 * Maps one incentive source (protocol / merit / merkl / brevis) to table rows.
 * Campaign rows use `c.href ?? src.href` so Merkl group links apply when the API omits per-campaign URLs.
 */
export function incentiveSourceToTableRows(
  src: IncentiveSourceRow,
  sourceIndex: number,
  side: 'supply' | 'borrow',
  nestedUnderIncentive = false,
): SimulationTableRow[] {
  const prefix = `${side}-${sourceIndex}`;
  const campaigns = src.campaigns;
  const sourceNotesForMainRow = !campaigns?.length ? src.notes : undefined;
  const main: SimulationTableRow = {
    rowKey: `${prefix}-agg`,
    label: src.label,
    current: src.current,
    after: src.after,
    delta: src.delta,
    type: 'rate',
    href: src.href,
    isBreakdown: true,
    isSubBreakdown: nestedUnderIncentive,
    nestedUnderIncentive,
    notes: sourceNotesForMainRow,
  };
  if (!campaigns?.length) return [main];
  if (campaigns.length === 1 && src.mergeSingleCampaignRow) {
    const c = campaigns[0];
      return [
        {
          rowKey: `${prefix}-merged`,
          label: src.label,
          current: src.current,
          after: src.after,
          delta: src.delta,
          type: 'rate',
          href: c.href ?? src.href,
          isBreakdown: true,
          isSubBreakdown: nestedUnderIncentive,
          nestedUnderIncentive,
          notes: c.notes,
        },
      ];
  }
  if (src.hideAggregateWhenCampaigns) {
    return campaigns.map((c: SimulationCampaignDetail, ci: number) => ({
      rowKey: `${prefix}-c-${ci}-${c.id}`,
      label: c.label,
      current: c.current,
      after: c.after,
      delta: c.delta,
      type: 'rate' as RowType,
      href: c.href ?? src.href ?? null,
      isBreakdown: true,
      isSubBreakdown: true,
      nestedUnderIncentive,
      notes: c.notes,
    }));
  }
  return [
    main,
    ...campaigns.map((c: SimulationCampaignDetail) => ({
      rowKey: `${prefix}-c-${campaigns.indexOf(c)}-${c.id}`,
      label: c.label,
      current: c.current,
      after: c.after,
      delta: c.delta,
      type: 'rate' as RowType,
      href: c.href ?? src.href ?? null,
      isBreakdown: true,
      isSubBreakdown: true,
      nestedUnderIncentive,
      notes: c.notes,
    })),
  ];
}
