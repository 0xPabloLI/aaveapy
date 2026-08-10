import type { RateSimulationComputedResult, SimulationCampaignDetail, SimulationSourceDetail } from './rateSimulationCalculator';

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
  sources: { merit: SimulationSourceDetail; brevis: SimulationSourceDetail; merkl: SimulationSourceDetail },
  otherSideEntries: OtherSideEntry[],
): PortfolioCapWarning[] {
  const warnings: PortfolioCapWarning[] = [];
  const seenSourcesForCap = new Set<string>();

  const sourceKeys = ['brevis', 'merit', 'merkl'] as const;
  for (const sourceKey of sourceKeys) {
    const src = sources[sourceKey];

    // Cap warnings from campaign notes
    const campaigns = src.campaigns ?? [];
    for (const c of campaigns) {
      const hasCapNote = c.notes?.some(n => n.type === 'position_cap' || n.type === 'pool_budget' || n.type === 'apr_cap');
      if (hasCapNote && c.capMetrics?.positionCapUsd != null) {
        if (seenSourcesForCap.has(sourceKey)) continue;
        seenSourcesForCap.add(sourceKey);
        const adjustToUsd = computeIncentiveAdjustToUsd(c.capMetrics.positionCapUsd, c.capMetrics.isCombineCap, side, reserveId, otherSideEntries);
        warnings.push({
          kind: 'incentive_cap',
          side,
          source: sourceKey,
          capUsd: c.capMetrics.positionCapUsd,
          isCapBinding: c.notes?.some(n => n.color === 'amber') ?? true,
          adjustToUsd,
          isCombineCap: c.capMetrics.isCombineCap || undefined,
          notes: c.notes,
        });
      }
    }

    // Offset warnings from source.offsetNotes (AAV-1036: separated from cap notes)
    if (src.offsetNotes?.length) {
      warnings.push({
        kind: 'incentive_offset',
        side,
        source: sourceKey,
        notes: src.offsetNotes,
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
