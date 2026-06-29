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
  capNote?: string;
  capWarning?: boolean;
  offsetNote?: string;
}

export type PortfolioCapWarning = ProtocolCapWarning | IncentiveCapWarning;

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
  sources: { merit: { campaigns?: SimulationCampaignDetail[]; offsetNote?: string }; brevis: { campaigns?: SimulationCampaignDetail[]; offsetNote?: string }; merkl: { campaigns?: SimulationCampaignDetail[]; offsetNote?: string } },
  otherSideEntries: OtherSideEntry[],
): IncentiveCapWarning[] {
  const warnings: IncentiveCapWarning[] = [];
  const seenSourcesForCap = new Set<string>();
  const seenSourcesForOffset = new Set<string>();

  const brevisCampaigns = sources.brevis.campaigns ?? [];
  for (const c of brevisCampaigns) {
    if (c.capWarning && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('brevis')) continue;
      seenSourcesForCap.add('brevis');
      seenSourcesForOffset.add('brevis');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'brevis',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        capNote: c.capNote,
        capWarning: c.capWarning,
        offsetNote: sources.brevis.offsetNote,
      });
    } else if (!seenSourcesForOffset.has('brevis') && sources.brevis.offsetNote) {
      seenSourcesForOffset.add('brevis');
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'brevis',
        capUsd: 0,
        isCapBinding: false,
        adjustToUsd: 0,
        offsetNote: sources.brevis.offsetNote,
      });
    }
  }

  const meritCampaigns = sources.merit.campaigns ?? [];
  for (const c of meritCampaigns) {
    if (c.capWarning && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('merit')) continue;
      seenSourcesForCap.add('merit');
      seenSourcesForOffset.add('merit');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merit',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        capNote: c.capNote,
        capWarning: c.capWarning,
        offsetNote: sources.merit.offsetNote,
      });
    } else if (!seenSourcesForOffset.has('merit') && sources.merit.offsetNote) {
      seenSourcesForOffset.add('merit');
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merit',
        capUsd: 0,
        isCapBinding: false,
        adjustToUsd: 0,
        offsetNote: sources.merit.offsetNote,
      });
    }
  }

  const merklCampaigns = sources.merkl.campaigns ?? [];
  for (const c of merklCampaigns) {
    if (c.capWarning && c.capMetrics?.positionCapUsd != null) {
      if (seenSourcesForCap.has('merkl')) continue;
      seenSourcesForCap.add('merkl');
      seenSourcesForOffset.add('merkl');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merkl',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: true,
        adjustToUsd,
        isCombineCap: c.capMetrics.isCombineCap || undefined,
        capNote: c.capNote,
        capWarning: c.capWarning,
        offsetNote: sources.merkl.offsetNote,
      });
    } else if (!seenSourcesForOffset.has('merkl') && sources.merkl.offsetNote) {
      seenSourcesForOffset.add('merkl');
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merkl',
        capUsd: 0,
        isCapBinding: false,
        adjustToUsd: 0,
        offsetNote: sources.merkl.offsetNote,
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
