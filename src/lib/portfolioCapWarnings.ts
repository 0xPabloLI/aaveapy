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
  source: 'brevis' | 'merit';
  capUsd: number;
  isCapBinding: boolean;
  adjustToUsd: number;
  isSharedSupplyBorrow?: boolean;
  capNote?: string;
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
  sources: { merit: { campaigns?: SimulationCampaignDetail[] }; brevis: { campaigns?: SimulationCampaignDetail[] }; merkl: { campaigns?: SimulationCampaignDetail[] } },
  otherSideEntries: OtherSideEntry[],
): IncentiveCapWarning[] {
  const warnings: IncentiveCapWarning[] = [];
  const seenSources = new Set<string>();

  const brevisCampaigns = sources.brevis.campaigns ?? [];
  for (const c of brevisCampaigns) {
    if (c.capWarning && c.capMetrics?.positionCapUsd != null) {
      if (seenSources.has('brevis')) continue;
      seenSources.add('brevis');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isSharedSupplyBorrow, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'brevis',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: true,
        adjustToUsd,
        isSharedSupplyBorrow: c.capMetrics.isSharedSupplyBorrow || undefined,
        capNote: c.capNote,
      });
    }
  }

  const meritCampaigns = sources.merit.campaigns ?? [];
  for (const c of meritCampaigns) {
    if (c.capWarning && c.capMetrics?.positionCapUsd != null) {
      if (seenSources.has('merit')) continue;
      seenSources.add('merit');
      const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isSharedSupplyBorrow, side, reserveId, otherSideEntries);
      warnings.push({
        kind: 'incentive_cap',
        side,
        source: 'merit',
        capUsd: c.capMetrics.positionCapUsd,
        isCapBinding: true,
        adjustToUsd,
        isSharedSupplyBorrow: c.capMetrics.isSharedSupplyBorrow || undefined,
        capNote: c.capNote,
      });
    }
  }

  return warnings;
}

function computeIncentiveAdjustToUsd(
  positionCapUsd: number,
  isSharedSupplyBorrow: boolean | undefined,
  side: 'supply' | 'borrow',
  reserveId: string,
  otherSideEntries: OtherSideEntry[],
): number {
  if (!isSharedSupplyBorrow) return positionCapUsd;

  const entry = otherSideEntries.find(e => e.reserveId === reserveId);
  if (!entry) return positionCapUsd;

  const otherSideUsd = side === 'supply'
    ? (entry.borrowAmountUsd ?? 0)
    : (entry.supplyAmountUsd ?? 0);

  return Math.max(positionCapUsd - otherSideUsd, 0);
}
