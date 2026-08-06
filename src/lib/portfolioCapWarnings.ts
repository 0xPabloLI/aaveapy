import type { RateSimulationComputedResult, SimulationCampaignDetail } from './rateSimulationCalculator';

export interface ProtocolCapWarning {
  kind: 'protocol_cap';
  side: 'supply' | 'borrow';
  capUsd: number;
  exceededByUsd: number;
  adjustToUsd: number;
  limitedByLiquidity?: boolean;
}

export interface IncentiveCapWarning {
  kind: 'incentive_cap';
  side: 'supply' | 'borrow';
  source: 'brevis' | 'merit' | 'merkl';
  capUsd: number;
  isCapBinding: boolean;
  adjustToUsd: number;
  isCombineCap?: boolean;
  notes?: import('./incentiveCaps').IncentiveNote[];
}

export interface IncentiveOffsetWarning {
  kind: 'incentive_offset';
  side: 'supply' | 'borrow';
  source: 'brevis' | 'merit' | 'merkl';
  notes?: import('./incentiveCaps').IncentiveNote[];
}

export interface LtvCapWarning {
  kind: 'ltv_cap';
  side: 'supply' | 'borrow';
  /** USD amount after LTV clamping (the maxBorrow limit). */
  clampedUsd: number;
}

export type PortfolioCapWarning = ProtocolCapWarning | IncentiveCapWarning | IncentiveOffsetWarning | LtvCapWarning;

interface OtherSideEntry {
  reserveId: string;
  borrowAmountUsd?: number;
  supplyAmountUsd?: number;
}

export function extractCapWarnings(
  reserveId: string,
  side: 'supply' | 'borrow',
  simResult: RateSimulationComputedResult | undefined,
  otherSideEntries: OtherSideEntry[],
): PortfolioCapWarning[] {
  if (!simResult) return [];

  const warnings: PortfolioCapWarning[] = [];
  const metrics = simResult.marketMetrics;

  if (side === 'supply' && metrics.supplyCapExceeded && metrics.supplyCapExceededByUsd != null && metrics.availableSupplyRoomUsd != null && metrics.supplyCapUsd != null) {
    warnings.push({
      kind: 'protocol_cap',
      side: 'supply',
      capUsd: metrics.supplyCapUsd,
      exceededByUsd: metrics.supplyCapExceededByUsd,
      adjustToUsd: metrics.availableSupplyRoomUsd,
    });
  }

  if (side === 'borrow' && metrics.borrowCapExceeded && metrics.borrowCapExceededByUsd != null && metrics.availableBorrowRoomUsd != null && metrics.borrowCapUsd != null) {
    warnings.push({
      kind: 'protocol_cap',
      side: 'borrow',
      capUsd: metrics.borrowCapUsd,
      exceededByUsd: metrics.borrowCapExceededByUsd,
      adjustToUsd: metrics.availableBorrowRoomUsd,
      limitedByLiquidity: metrics.borrowLimitedByLiquidity || undefined,
    });
  }

  const lane = side === 'supply' ? simResult.supply : simResult.borrow;

  const incentiveWarnings = extractIncentiveCapWarnings(
    reserveId,
    side,
    lane.sources,
    otherSideEntries,
  );
  warnings.push(...incentiveWarnings);

  return warnings;
}

function extractIncentiveCapWarnings(
  reserveId: string,
  side: 'supply' | 'borrow',
  sources: { merit: { campaigns?: SimulationCampaignDetail[]; notes?: import('./incentiveCaps').IncentiveNote[] }; brevis: { campaigns?: SimulationCampaignDetail[]; notes?: import('./incentiveCaps').IncentiveNote[] }; merkl: { campaigns?: SimulationCampaignDetail[]; notes?: import('./incentiveCaps').IncentiveNote[] } },
  otherSideEntries: OtherSideEntry[],
): IncentiveCapWarning[] {
  const warnings: IncentiveCapWarning[] = [];
  const seenSourcesForCap = new Set<string>();
  const seenSourcesForOffset = new Set<string>();

  const brevisCampaigns = sources.brevis.campaigns ?? [];
  for (const c of brevisCampaigns) {
    const hasCapNote = c.notes?.some(n => n.type === 'position_cap' || n.type === 'pool_budget' || n.type === 'apr_cap');
    if (hasCapNote && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('brevis')) continue;
      seenSourcesForCap.add('brevis');
      seenSourcesForOffset.add('brevis');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'brevis',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: c.notes?.some(n => n.color === 'amber') ?? true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        notes: c.notes,
      });
    } else if (!seenSourcesForOffset.has('brevis') && sources.brevis.notes?.length) {
      seenSourcesForOffset.add('brevis');
      warnings.push({
        kind: 'incentive_offset',
        side,
        source: 'brevis',
        notes: sources.brevis.notes,
      });
    }
  }

  const meritCampaigns = sources.merit.campaigns ?? [];
  for (const c of meritCampaigns) {
    const hasCapNote = c.notes?.some(n => n.type === 'position_cap' || n.type === 'pool_budget' || n.type === 'apr_cap');
    if (hasCapNote && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('merit')) continue;
      seenSourcesForCap.add('merit');
      seenSourcesForOffset.add('merit');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merit',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: c.notes?.some(n => n.color === 'amber') ?? true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        notes: c.notes,
      });
    } else if (!seenSourcesForOffset.has('merit') && sources.merit.notes?.length) {
      seenSourcesForOffset.add('merit');
      warnings.push({
        kind: 'incentive_offset',
        side,
        source: 'merit',
        notes: sources.merit.notes,
      });
    }
  }

  const merklCampaigns = sources.merkl.campaigns ?? [];
  for (const c of merklCampaigns) {
    const hasCapNote = c.notes?.some(n => n.type === 'position_cap' || n.type === 'pool_budget' || n.type === 'apr_cap');
    if (hasCapNote && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('merkl')) continue;
      seenSourcesForCap.add('merkl');
      seenSourcesForOffset.add('merkl');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merkl',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: c.notes?.some(n => n.color === 'amber') ?? true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        notes: c.notes,
      });
    } else if (!seenSourcesForOffset.has('merkl') && sources.merkl.notes?.length) {
      seenSourcesForOffset.add('merkl');
      warnings.push({
        kind: 'incentive_offset',
        side,
        source: 'merkl',
        notes: sources.merkl.notes,
      });
    }
  }

  return warnings;
}

function computeIncentiveAdjustToUsd(
  positionCapUsd: number,
  isCombineCap: boolean | undefined,
  side: 'supply' | 'borrow',
  reserveId: string,
  otherSideEntries: OtherSideEntry[],
): number {
  if (!isCombineCap) return positionCapUsd;

  const entry = otherSideEntries.find(e => e.reserveId === reserveId);
  if (!entry) return positionCapUsd;

  const otherSideUsd = side === 'supply'
    ? (entry.borrowAmountUsd ?? 0)
    : (entry.supplyAmountUsd ?? 0);

  return Math.max(positionCapUsd - otherSideUsd, 0);
}

/**
 * Unified protocol cap warning text — shared by SimulationSubRow (Reserve Table)
 * and PortfolioTokenRow (Portfolio). Accepts pre-formatted `availableFormatted`
 * string because Reserve Table uses formatScenarioSize (USD/Token mode) while
 * Portfolio uses formatUsd (pure USD).
 *
 * - `currentExceeded`: chain position already exceeds cap (not user input).
 *   Shows "Current {Supply|Borrow} limited to X available".
 * - `limitedByLiquidity`: borrow cap is constrained by available liquidity.
 *   Appends " (liquidity)" suffix.
 */
export function formatProtocolCapText(options: {
  side: 'supply' | 'borrow';
  availableFormatted: string;
  limitedByLiquidity?: boolean;
  currentExceeded?: boolean;
}): string {
  const sideLabel = options.side === 'supply' ? 'Supply' : 'Borrow';
  const prefix = options.currentExceeded ? 'Current ' : '';
  const suffix = options.limitedByLiquidity ? ' (liquidity)' : '';
  return `${prefix}${sideLabel} limited to ${options.availableFormatted} available${suffix}`;
}
