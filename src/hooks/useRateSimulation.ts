import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import {
  calculateTotalBorrowApy,
  calculateTotalBorrowApr,
  calculateTotalIncentiveApy,
  calculateTotalIncentiveApr,
  calculateTotalSupplyApy,
  calculateTotalSupplyApr,
  convertAprToApy,
  isMerklWhitelistBreakdownIncluded,
} from '@/lib/formatters';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { simulateNativeRatesAfterActions, hasRateCalcFields } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import {
  forecastWithTVL,
  merklAprCapPercentToForecastDecimal,
  type MerklForecastState,
} from '@/lib/merklForecast';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import {
  extractMeritSelfCapUsd,
  forecastMeritAprPercent,
  forecastMeritCampaign,
  splitMeritMessageBySelfAuth,
} from '@/lib/meritForecast';
import { forecastBrevisAprPercent, forecastBrevisDetailed } from '@/lib/brevisForecast';
import {
  buildBrevisCalendarEndOnlyEffect,
  buildBrevisRewardCeilingEffect,
  buildMeritSelfDepositCeilingEffect,
  buildMerklAprCeilingEffect,
  buildMerklFixPoolBudgetEffect,
  ceilingEffectToSimulationFields,
} from '@/lib/incentiveCeilings';
import {
  getBrevisCampaignApr,
  getBrevisCampaignEndedAt,
  getBrevisCampaignStartedAt,
} from '@/lib/brevis';
import { parseNumberInput } from '@/lib/numberFormat';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import {
  convertMerklPointsAmountToUsd,
  getMerklBreakdownApr,
  isMerklPointsCampaign,
} from '@/lib/tydro';
import type {
  BrevisIncentive,
  MeritIncentive,
  MerklCampaignBreakdown,
  MerklForecastWireItem,
  MerklOpportunityGroup,
  ReserveWithSpread,
  TokenPricesIndex,
} from '@/types/aave';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORECAST_TOKEN_PRICE_QUERY_KEY = ['forecast-token-price'] as const;

const parseCampaignBoundaryMs = (value: string | undefined, boundary: 'start' | 'end'): number | null => {
  if (!value) return null;
  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isCampaignActive = (
  startDate: string | undefined,
  endDate: string | undefined,
  nowMs = Date.now(),
  allowOpenEnd = false,
): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  if (startMs === null || nowMs < startMs) return false;
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (endMs === null) return allowOpenEnd;
  return nowMs <= endMs;
};

interface BuildForecastMerklOpportunitiesInput {
  opportunities?: MerklOpportunityGroup[];
  inputUsd: number;
  forecastStates: Record<string, MerklForecastWireItem>;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
}

const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

/**
 * Merge opportunity-only fields from breakdown (1-min) with metrics-only fields from forecast (10-min).
 * Points-based campaigns still follow the actual Merkl campaignType; forecast constraints stay
 * type-driven even when the campaign's display intensity comes from pointsPerThousandUsd.
 */
const mergeForecastState = (
  breakdown: MerklCampaignBreakdown,
  forecastStates: Record<string, MerklForecastWireItem>,
  tydroPointToUsdRate: number,
): MerklForecastState | null => {
  if (!breakdown.campaignId || !breakdown.campaignType) return null;
  const metrics = forecastStates[String(breakdown.campaignId)];
  const normalizeUsdUnit = (value: number | null | undefined): number | undefined => {
    if (isMerklPointsCampaign(breakdown)) {
      return convertMerklPointsAmountToUsd(value, tydroPointToUsdRate);
    }
    return value ?? undefined;
  };
  return {
    campaignType: breakdown.campaignType,
    totalBudget: normalizeUsdUnit(breakdown.totalBudget),
    aprCap: merklAprCapPercentToForecastDecimal(breakdown.aprCap),
    latestTvl: normalizeUsdUnit(breakdown.latestTvl),
    plannedDaily: normalizeUsdUnit(breakdown.plannedDaily),
    requiredDaily: normalizeUsdUnit(metrics?.requiredDaily),
    distributedSoFar: normalizeUsdUnit(metrics?.distributedSoFar),
    endTimestamp: metrics?.endTimestamp,
  };
};

const forecastBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number
): number => {
  const currentApr = sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
  if (inputUsd <= 0) return currentApr;
  if (!isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds)) return currentApr;

  const merged = mergeForecastState(breakdown, forecastStates, tydroPointToUsdRate);
  if (!merged) return currentApr;

  const hypotheticalTvl = Math.max((merged.latestTvl ?? 0) + inputUsd, 0);
  const forecast = forecastWithTVL(merged, hypotheticalTvl);
  const forecastApr = sanitizePercent(forecast.apr * 100);
  return forecastApr;
};

export function buildForecastMerklOpportunities({
  opportunities,
  inputUsd,
  forecastStates,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
}: BuildForecastMerklOpportunitiesInput): MerklOpportunityGroup[] {
  if (!opportunities || opportunities.length === 0) return [];

  return opportunities.map((opportunity) => ({
    ...opportunity,
    breakdowns: (opportunity.breakdowns ?? []).map((breakdown) => ({
      ...breakdown,
      campaignApr: forecastBreakdownApr(
        breakdown,
        inputUsd,
        forecastStates,
        whitelistMerklCampaignIds,
        tydroPointToUsdRate
      ),
      pointsPerThousandUsd: undefined,
    })),
  }));
}

const collectActiveCampaignIds = (opportunities?: MerklOpportunityGroup[]): string[] => {
  if (!opportunities || opportunities.length === 0) return [];
  const ids = new Set<string>();
  opportunities.forEach((opportunity) => {
    opportunity.breakdowns?.forEach((breakdown) => {
      if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
      if (breakdown.campaignId) ids.add(String(breakdown.campaignId));
    });
  });
  return Array.from(ids);
};

type RateSide = 'supply' | 'borrow';

export interface SimulationMetric {
  current: number | null;
  after: number | null;
  delta: number | null;
}

/** Per-campaign incentive row for the simulation breakdown (Merit/Merkl/Brevis sub-campaigns). */
export interface SimulationCampaignDetail {
  id: string;
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  capNote?: string;
  capWarning?: boolean;
  /** Optional deep-link for the specific Merkl opportunity/breakdown row. */
  href?: string | null;
}

export interface SimulationSourceDetail extends SimulationMetric {
  campaigns?: SimulationCampaignDetail[];
}

export interface SimulationLane {
  hasInput: boolean;
  inputAmount: number;
  inputUsd: number;
  currentNative: number | null;
  currentIncentive: number;
  currentTotal: number | null;
  afterNative: number | null;
  afterIncentive: number | null;
  afterTotal: number | null;
  deltaNative: number | null;
  deltaIncentive: number | null;
  deltaTotal: number | null;
  sources: {
    protocol: SimulationSourceDetail;
    merit: SimulationSourceDetail;
    merkl: SimulationSourceDetail;
    brevis: SimulationSourceDetail;
  };
}

export interface MarketMetrics {
  availableLiquidityUsd: number | null;
  availableLiquidityUsdAfter: number | null;
  availableLiquidityUsdDelta: number | null;
  totalBorrowedUsd: number | null;
  totalBorrowedUsdAfter: number | null;
  totalBorrowedUsdDelta: number | null;
  supplyCapUsd: number | null;
  borrowCapUsd: number | null;
  reserveFactor: number | null;
  optimalUtilization: number | null;
  availableSupplyRoomUsd: number | null;
  supplyCapExceeded: boolean;
  supplyCapExceededByUsd: number | null;
  availableBorrowRoomUsd: number | null;
  borrowCapExceeded: boolean;
  borrowCapExceededByUsd: number | null;
  borrowLimitedByLiquidity: boolean;
}

export interface RateSimulationComputedResult {
  tokenPrice?: number;
  supply: SimulationLane;
  borrow: SimulationLane;
  spread: {
    current: number | null;
    after: number | null;
    delta: number | null;
    usesCurrentSide: null;
  };
  utilization: {
    current: number | null;
    after: number | null;
    delta: number | null;
    optimal: number | null;
  };
  marketMetrics: MarketMetrics;
  forecastUnavailableCampaignCount: number;
}

export interface RateSimulationResult extends RateSimulationComputedResult {
  tokenPriceLoading: boolean;
  reserveRateInputLoading: boolean;
  reserveRateInputError: unknown;
  forecastLoading: boolean;
  forecastErrors: Record<string, string>;
  hasRateInput: boolean;
}

export type ScenarioInputMode = 'usd' | 'token';

interface BuildRateSimulationResultParams {
  reserve: ReserveWithSpread;
  reserveRateInput?: RateCalcInput | null;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  tokenPrice?: number;
  supplyInput: string;
  borrowInput: string;
  inputMode?: ScenarioInputMode;
  forecastStates: Record<string, MerklForecastWireItem>;
}

interface UseRateSimulationParams {
  reserve: ReserveWithSpread;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  tokenPrices?: TokenPricesIndex;
  enabled?: boolean;
  supplyInput: string;
  borrowInput: string;
  inputMode?: ScenarioInputMode;
}

interface UseSharedRateSimulationsParams {
  reserves: ReserveWithSpread[];
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  tokenPrices?: TokenPricesIndex;
  enabled?: boolean;
  supplyInput: string;
  borrowInput: string;
  inputMode?: ScenarioInputMode;
}

const buildIncentiveCurrent = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined
): number => {
  const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  const protocol = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  return isApy
    ? calculateTotalIncentiveApy(merit, merkl, brevis, protocol, tydroPointToUsdRate, {
        whitelistMerklCampaignIds,
      })
    : calculateTotalIncentiveApr(merit, merkl, brevis, protocol, tydroPointToUsdRate, {
        whitelistMerklCampaignIds,
      });
};

const sumNumberArray = (values?: number[], isApy = false): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!Number.isFinite(value) || value < 0) return sum;
    return sum + (isApy ? convertAprToApy(value) : value);
  }, 0);
};

const sumMeritValues = (values?: MeritIncentive[], isApy = false): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!isCampaignActive(value.startDate, value.endDate)) return sum;
    const apr = sanitizePercent(value.apr);
    const selfApr = sanitizePercent(value.selfApr ?? 0);
    if (isApy) {
      return sum + (apr > 0 ? convertAprToApy(apr) : 0) + (selfApr > 0 ? convertAprToApy(selfApr) : 0);
    }
    return sum + apr + selfApr;
  }, 0);
};

/**
 * Supply: `reserveSizeUsd`. Borrow: borrowed USD ≈ reserveSize × utilization (Merit TVL proxy when no campaign TVL exists).
 */
const getMeritAnchorTvlUsd = (reserve: ReserveWithSpread, side: RateSide): number | undefined => {
  const size = reserve.reserveSizeUsd;
  if (!Number.isFinite(size) || size === undefined || size <= 0) return undefined;
  if (side === 'supply') return size;
  const u = reserve.utilizationPct;
  if (typeof u === 'number' && Number.isFinite(u) && u > 0 && u <= 100) {
    return size * (u / 100);
  }
  return undefined;
};

const sumForecastMeritValues = (
  values: MeritIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  anchorTvlUsd?: number,
): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!isCampaignActive(value.startDate, value.endDate)) return sum;
    const aprPercent = forecastMeritAprPercent(value, inputUsd, anchorTvlUsd);
    if (aprPercent <= 0) return sum;
    return sum + (isApy ? convertAprToApy(aprPercent) : aprPercent);
  }, 0);
};

const sumBrevisValues = (values?: BrevisIncentive[], isApy = false): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    const startDate = getBrevisCampaignStartedAt(value);
    const endDate = getBrevisCampaignEndedAt(value);
    if (!isCampaignActive(startDate, endDate, Date.now(), true)) return sum;
    const apr = sanitizePercent(getBrevisCampaignApr(value));
    return sum + (isApy ? convertAprToApy(apr) : apr);
  }, 0);
};

type BrevisSharedCampaignSnapshot = {
  campaignApr: number;
  campaignStartedAt?: string;
  campaignEndedAt?: string;
  latestTvl?: number;
  totalBudget?: number;
  perUserRewardCapUsd?: number;
  message?: string;
  link: string;
};

const getBrevisSharedCampaignSnapshot = (brevis: BrevisIncentive): BrevisSharedCampaignSnapshot => ({
  campaignApr: sanitizePercent(getBrevisCampaignApr(brevis)),
  campaignStartedAt: getBrevisCampaignStartedAt(brevis),
  campaignEndedAt: getBrevisCampaignEndedAt(brevis),
  latestTvl: brevis.latestTvl,
  totalBudget: brevis.totalBudget,
  perUserRewardCapUsd: brevis.perUserRewardCapUsd,
  message: brevis.message,
  link: brevis.link,
});

const areBrevisSharedSnapshotsEqual = (
  left: BrevisSharedCampaignSnapshot,
  right: BrevisSharedCampaignSnapshot,
): boolean => (
  left.campaignApr === right.campaignApr &&
  left.campaignStartedAt === right.campaignStartedAt &&
  left.campaignEndedAt === right.campaignEndedAt &&
  left.latestTvl === right.latestTvl &&
  left.totalBudget === right.totalBudget &&
  left.perUserRewardCapUsd === right.perUserRewardCapUsd &&
  left.message === right.message &&
  left.link === right.link
);

/**
 * Canonical shared-cap rule for Brevis:
 * only campaigns on the same reserve that appear on both supply and borrow with
 * the same `campaignId` share a single per-user reward cap, and the campaign
 * metadata must match exactly across both sides.
 */
const computeBrevisSharedCampaignDeposits = (
  reserve: ReserveWithSpread,
  supplyInputUsd: number,
  borrowInputUsd: number,
): ReadonlyMap<string, number> => {
  const activeSupply = (reserve.brevisSupplys ?? []).filter((b) =>
    Boolean(b.campaignId) && isCampaignActive(getBrevisCampaignStartedAt(b), getBrevisCampaignEndedAt(b), Date.now(), true)
  );
  const activeBorrow = (reserve.brevisBorrows ?? []).filter((b) =>
    Boolean(b.campaignId) && isCampaignActive(getBrevisCampaignStartedAt(b), getBrevisCampaignEndedAt(b), Date.now(), true)
  );

  const supplyByCampaignId = new Map<string, BrevisIncentive[]>();
  const borrowByCampaignId = new Map<string, BrevisIncentive[]>();
  activeSupply.forEach((item) => {
    const campaignId = item.campaignId!;
    const existing = supplyByCampaignId.get(campaignId);
    if (existing) existing.push(item);
    else supplyByCampaignId.set(campaignId, [item]);
  });
  activeBorrow.forEach((item) => {
    const campaignId = item.campaignId!;
    const existing = borrowByCampaignId.get(campaignId);
    if (existing) existing.push(item);
    else borrowByCampaignId.set(campaignId, [item]);
  });

  const combinedDepositUsd = supplyInputUsd + borrowInputUsd;
  const sharedDeposits = new Map<string, number>();

  supplyByCampaignId.forEach((supplyItems, campaignId) => {
    const borrowItems = borrowByCampaignId.get(campaignId);
    if (!borrowItems?.length) return;

    const entries = [...supplyItems, ...borrowItems];
    const canonical = getBrevisSharedCampaignSnapshot(entries[0]);
    const mismatch = entries.slice(1).some((entry) => (
      !areBrevisSharedSnapshotsEqual(canonical, getBrevisSharedCampaignSnapshot(entry))
    ));

    if (mismatch) {
      console.warn(
        `[Brevis] Skipping shared-cap simulation for ${reserve.marketName} ${reserve.tokenSymbol} campaignId=${campaignId} because supply/borrow metadata differ.`,
      );
      return;
    }

    sharedDeposits.set(campaignId, combinedDepositUsd);
  });

  return sharedDeposits;
};

const getBrevisCombinedDepositUsd = (
  brevis: BrevisIncentive,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
): number | undefined => {
  if (!brevis.campaignId || !sharedDepositsByCampaignId) return undefined;
  return sharedDepositsByCampaignId.get(brevis.campaignId);
};

const sumForecastBrevisValues = (
  values: BrevisIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  sharedDepositsByCampaignId?: ReadonlyMap<string, number>,
): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    const startDate = getBrevisCampaignStartedAt(value);
    const endDate = getBrevisCampaignEndedAt(value);
    if (!isCampaignActive(startDate, endDate, Date.now(), true)) return sum;
    const combined = getBrevisCombinedDepositUsd(value, sharedDepositsByCampaignId);
    const aprPercent = forecastBrevisAprPercent(value, inputUsd, Date.now(), combined);
    if (aprPercent <= 0) return sum;
    return sum + (isApy ? convertAprToApy(aprPercent) : aprPercent);
  }, 0);
};

const sumMerklValues = (
  opportunities: MerklOpportunityGroup[] | undefined,
  isApy: boolean,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined
): number => {
  if (!opportunities || opportunities.length === 0) return 0;
  return opportunities.reduce((sum, opportunity) => {
    return (
      sum +
      (opportunity.breakdowns ?? []).reduce((breakdownSum, breakdown) => {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return breakdownSum;
        if (!isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds)) return breakdownSum;
        const apr = sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
        return breakdownSum + (isApy ? convertAprToApy(apr) : apr);
      }, 0)
    );
  }, 0);
};

const buildMetric = (current: number | null, after: number | null): SimulationMetric => ({
  current,
  after,
  delta: current !== null && after !== null ? after - current : null,
});

const meritAprToDisplay = (aprPercent: number, isApy: boolean): number => {
  const s = sanitizePercent(aprPercent);
  return isApy ? convertAprToApy(s) : s;
};

const meritForecastAprToDisplay = (aprDecimal: number, isApy: boolean): number => {
  const pct = aprDecimal * 100;
  return isApy ? convertAprToApy(pct) : pct;
};

/** Show per-campaign rows when the user entered a scenario, or when multiple campaigns stack. */
const shouldExposeCampaignRows = (
  rows: SimulationCampaignDetail[],
  hasAnyInput: boolean,
): boolean => rows.length > 1 || (hasAnyInput && rows.length > 0);

const buildMeritCampaignDetails = (
  merits: MeritIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  hasAnyInput: boolean,
  meritAnchorTvlUsd?: number,
): SimulationCampaignDetail[] => {
  const rows: SimulationCampaignDetail[] = [];
  if (!merits?.length) return rows;

  const activeMerits = merits.filter((m) => isCampaignActive(m.startDate, m.endDate));
  const multiMerit = activeMerits.length > 1;

  activeMerits.forEach((merit, meritIndex) => {
    const { selfMessage } = splitMeritMessageBySelfAuth(merit.message);
    const selfCapUsd = extractMeritSelfCapUsd(selfMessage);
    const baseAprPercent = sanitizePercent(merit.apr);
    const selfAprPercent = sanitizePercent(merit.selfApr ?? 0);
    const namePrefix = multiMerit && merit.name ? `${merit.name} · ` : '';

    if (baseAprPercent > 0) {
      const baseCurrent = meritAprToDisplay(baseAprPercent, isApy);
      let baseAfter: number | null = null;
      if (inputUsd > 0) {
        const fp = forecastMeritCampaign({
          mode: 'MERIT_BASE',
          depositUsd: inputUsd,
          forecastAprPercent: baseAprPercent,
          startDate: merit.startDate,
          endDate: merit.endDate,
          lastRoundRewardUsd: merit.lastRoundRewardUsd,
          anchorTvlUsd: meritAnchorTvlUsd,
        });
        if (fp) {
          baseAfter = meritForecastAprToDisplay(fp.apr, isApy);
        }
      }
      const delta = baseAfter !== null ? baseAfter - baseCurrent : null;
      // Merit Base: no capNote — same product rule as Merkl DUTCH_AUCTION (scenario APR only). If Dutch gains a row note, add Merit Base in the same change (see buildMerklCampaignDetails).
      rows.push({
        id: `merit-${meritIndex}-base`,
        label: `${namePrefix}Base`,
        current: baseCurrent,
        after: baseAfter,
        delta,
        capWarning: false,
      });
    }

    if (selfAprPercent > 0) {
      const selfCurrent = meritAprToDisplay(selfAprPercent, isApy);
      let selfAfter: number | null = null;
      let capNote: string | undefined;
      let capWarning = false;
      if (inputUsd > 0) {
        const fp = forecastMeritCampaign({
          mode: 'MERIT_SELF_CAP',
          depositUsd: inputUsd,
          forecastAprPercent: selfAprPercent,
          selfCapUsd: selfCapUsd ?? undefined,
          startDate: merit.startDate,
          endDate: merit.endDate,
          baseAprPercent: baseAprPercent > 0 ? baseAprPercent : undefined,
          baseLastRoundRewardUsd: merit.lastRoundRewardUsd,
          anchorTvlUsd: meritAnchorTvlUsd,
        });
        if (fp) {
          selfAfter = meritForecastAprToDisplay(fp.apr, isApy);
          if (typeof fp.selfCapUsd === 'number' && typeof fp.selfEligibleUsd === 'number') {
            const ceiling = buildMeritSelfDepositCeilingEffect({
              inputUsd,
              selfEligibleUsd: fp.selfEligibleUsd,
              depositCeilingUsd: fp.selfCapUsd,
            });
            ({ capNote, capWarning } = ceilingEffectToSimulationFields(ceiling));
          }
        } else {
          selfAfter = selfCurrent;
        }
      }
      const delta = selfAfter !== null ? selfAfter - selfCurrent : null;
      rows.push({
        id: `merit-${meritIndex}-self`,
        label: `${namePrefix}Self`,
        current: selfCurrent,
        after: selfAfter,
        delta,
        capNote,
        capWarning,
      });
    }
  });

  return shouldExposeCampaignRows(rows, hasAnyInput) ? rows : [];
};

const buildMerklCampaignDetails = (
  opportunities: MerklOpportunityGroup[] | undefined,
  isApy: boolean,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number,
  hasAnyInput: boolean,
): SimulationCampaignDetail[] => {
  const rows: SimulationCampaignDetail[] = [];
  if (!opportunities?.length) return rows;

  // User-friendly labels; when the same opportunity name appears on multiple rows, add a stable "#n" suffix
  // (same rule with or without scenario input so the list does not change shape).
  const collected: Array<Omit<SimulationCampaignDetail, 'label'> & { baseLabel: string }> = [];

  opportunities.forEach((opportunity, oppIndex) => {
    (opportunity.breakdowns ?? []).forEach((bd, bdIndex) => {
      if (!isCampaignActive(bd.campaignStartedAt, bd.campaignEndedAt)) return;
      if (!isMerklWhitelistBreakdownIncluded(bd, whitelistMerklCampaignIds)) return;

      const currentApr = sanitizePercent(getMerklBreakdownApr(bd, tydroPointToUsdRate));
      const current = isApy ? convertAprToApy(currentApr) : currentApr;
      let after: number | null = null;
      let capNote: string | undefined;
      let capWarning = false;

      if (inputUsd > 0) {
        const forecastApr = forecastBreakdownApr(bd, inputUsd, forecastStates, whitelistMerklCampaignIds, tydroPointToUsdRate);
        const forecastAprSan = sanitizePercent(forecastApr);
        after = isApy ? convertAprToApy(forecastAprSan) : forecastAprSan;

        const merged = mergeForecastState(bd, forecastStates, tydroPointToUsdRate);
        const merklType = merged?.campaignType;
        if (
          merged &&
          (merklType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' || merklType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE')
        ) {
          const hypotheticalTvl = Math.max((merged.latestTvl ?? 0) + inputUsd, 0);
          const forecast = forecastWithTVL(merged, hypotheticalTvl);
          if (merklType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' && typeof forecast.fixRewardableDays === 'number') {
            ({ capNote, capWarning } = ceilingEffectToSimulationFields(
              buildMerklFixPoolBudgetEffect(forecast.fixRewardableDays),
            ));
          } else if (merklType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE' && forecast.regime === 'APR_CAPPED') {
            ({ capNote, capWarning } = ceilingEffectToSimulationFields(buildMerklAprCeilingEffect()));
          }
          // DUTCH_AUCTION and other types: no extra capNote here (Merit Base rows follow the same rule).
        }
      }

      const delta = after !== null ? after - current : null;
      const oppLabel = opportunity.name?.trim() || 'Merkl';
      const oppLink = opportunity.link;
      collected.push({
        id: `merkl-${oppIndex}-${bdIndex}-${bd.campaignId ?? 'x'}`,
        baseLabel: oppLabel,
        current,
        after,
        delta,
        capNote,
        capWarning,
        href: oppLink ?? null,
      });
    });
  });

  if (collected.length === 0) return [];

  const totalsByLabel = new Map<string, number>();
  for (const item of collected) {
    totalsByLabel.set(item.baseLabel, (totalsByLabel.get(item.baseLabel) ?? 0) + 1);
  }
  const idxByLabel = new Map<string, number>();
  for (const item of collected) {
    const total = totalsByLabel.get(item.baseLabel) ?? 0;
    const nextIdx = (idxByLabel.get(item.baseLabel) ?? 0) + 1;
    idxByLabel.set(item.baseLabel, nextIdx);
    const { baseLabel, ...rest } = item;
    rows.push({
      ...rest,
      label: total > 1 ? `${baseLabel} #${nextIdx}` : baseLabel,
    });
  }

  return shouldExposeCampaignRows(rows, hasAnyInput) ? rows : [];
};

const buildBrevisCampaignDetails = (
  items: BrevisIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
  hasAnyInput: boolean,
): SimulationCampaignDetail[] => {
  const rows: SimulationCampaignDetail[] = [];
  if (!items?.length) return rows;

  items.forEach((b, i) => {
    const startDate = getBrevisCampaignStartedAt(b);
    const endDate = getBrevisCampaignEndedAt(b);
    if (!isCampaignActive(startDate, endDate, Date.now(), true)) return;
    const nominal = sanitizePercent(getBrevisCampaignApr(b));
    const current = isApy ? convertAprToApy(nominal) : nominal;
    let after: number | null = null;
    let capNote: string | undefined;
    let capWarning = false;
    const combined = getBrevisCombinedDepositUsd(b, sharedDepositsByCampaignId);
    const noteDepositUsd = combined ?? inputUsd;

    if (inputUsd > 0) {
      const aprPercent = forecastBrevisAprPercent(b, inputUsd, Date.now(), combined);
      after = isApy ? convertAprToApy(aprPercent) : aprPercent;
    }

    if (hasAnyInput && noteDepositUsd > 0) {
      const det = forecastBrevisDetailed(b, noteDepositUsd, Date.now(), combined);
      if (b.perUserRewardCapUsd !== undefined && b.perUserRewardCapUsd > 0) {
        ({ capNote, capWarning } = ceilingEffectToSimulationFields(
          buildBrevisRewardCeilingEffect({
            rewardCeilingUsd: b.perUserRewardCapUsd,
            isSharedSupplyBorrow: combined !== undefined,
            isCapBinding: det.isCapBinding,
            daysToHitCap: det.daysToHitCap,
            remainingDays: det.remainingDays,
          }),
        ));
      } else if (det.remainingDays !== null && Number.isFinite(det.remainingDays) && det.remainingDays > 0) {
        ({ capNote, capWarning } = ceilingEffectToSimulationFields(
          buildBrevisCalendarEndOnlyEffect(det.remainingDays),
        ));
      }
    }

    const delta = after !== null ? after - current : null;
    rows.push({
      id: `brevis-${i}-${b.campaignId ?? 'b'}`,
      label: b.message || 'Brevis',
      current,
      after,
      delta,
      capNote,
      capWarning,
    });
  });

  return shouldExposeCampaignRows(rows, hasAnyInput) ? rows : [];
};

const attachCampaigns = (
  metric: SimulationMetric,
  campaigns: SimulationCampaignDetail[],
): SimulationSourceDetail =>
  campaigns.length > 0 ? { ...metric, campaigns } : { ...metric };

const buildIncentiveAfter = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  brevisSharedDepositsByCampaignId?: ReadonlyMap<string, number>,
): number => {
  const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  const protocol = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  const forecastedMerkl = buildForecastMerklOpportunities({
    opportunities: merkl,
    inputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
  });

  return (
    sumNumberArray(protocol, isApy) +
    sumForecastMeritValues(merit, isApy, inputUsd, getMeritAnchorTvlUsd(reserve, side)) +
    sumMerklValues(forecastedMerkl, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds) +
    sumForecastBrevisValues(brevis, isApy, inputUsd, brevisSharedDepositsByCampaignId)
  );
};

const toDisplayNative = (rawApy: number | null | undefined): number | null => {
  if (rawApy === null || rawApy === undefined || !Number.isFinite(rawApy)) return null;
  return rawApy;
};

export const getReserveSimulationId = (reserve: Pick<ReserveWithSpread, 'marketName' | 'tokenAddress'>): string =>
  `${reserve.marketName}-${reserve.tokenAddress}`;

const buildPriceLookup = (reserve: ReserveWithSpread, tokenPrices?: TokenPricesIndex, actionType: 'Supply' | 'Borrow' = 'Supply') => ({
  tokenPrices,
  chainId: reserve.chainId,
  actionType,
  tokenSymbol: reserve.tokenSymbol,
  tokenAddress: reserve.tokenAddress,
  aTokenAddress: reserve.aTokenAddress,
  vTokenAddress: reserve.vTokenAddress,
});

const resolveLocalReserveTokenPrice = (reserve: ReserveWithSpread, tokenPrices?: TokenPricesIndex): number | undefined => {
  return (
    resolveForecastTokenPrice(buildPriceLookup(reserve, tokenPrices, 'Supply')) ??
    resolveForecastTokenPrice(buildPriceLookup(reserve, tokenPrices, 'Borrow'))
  );
};

export function buildRateSimulationResult({
  reserve,
  reserveRateInput,
  isApy,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  tokenPrice,
  supplyInput,
  borrowInput,
  inputMode = 'token',
  forecastStates,
}: BuildRateSimulationResultParams): RateSimulationComputedResult {
  const rawSupply = parseNumberInput(supplyInput);
  const rawBorrow = parseNumberInput(borrowInput);

  // In USD mode, convert to token amounts for native simulation
  const supplyAmount = inputMode === 'usd' && tokenPrice ? rawSupply / tokenPrice : rawSupply;
  const borrowAmount = inputMode === 'usd' && tokenPrice ? rawBorrow / tokenPrice : rawBorrow;
  const hasSupplyInput = rawSupply > 0;
  const hasBorrowInput = rawBorrow > 0;
  const hasAnyInput = hasSupplyInput || hasBorrowInput;

  // For incentive forecasts, we need USD values
  const rawSupplyInputUsd = inputMode === 'usd' ? rawSupply : (tokenPrice ? rawSupply * tokenPrice : 0);
  const rawBorrowInputUsd = inputMode === 'usd' ? rawBorrow : (tokenPrice ? rawBorrow * tokenPrice : 0);

  // Calculate cap constraints for capping inputs
  const supplyCapUsd = reserve.supplyCapUsd ?? null;
  const borrowCapUsd = reserve.borrowCapUsd ?? null;
  const currentReserveSizeUsd = reserve.reserveSizeUsd ?? null;
  
  // Calculate available supply room
  const availableSupplyRoomUsd = 
    supplyCapUsd !== null && supplyCapUsd > 0 && currentReserveSizeUsd !== null
      ? Math.max(supplyCapUsd - currentReserveSizeUsd, 0)
      : null;

  // Cap supply input
  const supplyInputUsd = 
    availableSupplyRoomUsd !== null && rawSupplyInputUsd > availableSupplyRoomUsd
      ? availableSupplyRoomUsd
      : rawSupplyInputUsd;

  // Calculate current native simulation first to get totalBorrowedUsd for borrow cap
  const currentNativeSimulation = reserveRateInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: '0',
        borrowAmount: '0',
      })
    : null;

  // Calculate totalBorrowedUsd for borrow cap constraint
  const currentTotalBorrowedUsd = reserveRateInput && tokenPrice
    ? (() => {
        const decimals = reserveRateInput.decimals ?? 18;
        const scale = Math.pow(10, decimals);
        const totalDebt = Number(reserveRateInput.totalVariableDebt) / scale;
        return totalDebt * tokenPrice;
      })()
    : null;

  // Calculate borrow cap remaining (if cap exists)
  const borrowCapRemainingUsd = 
    borrowCapUsd !== null && borrowCapUsd > 0 && currentTotalBorrowedUsd !== null
      ? Math.max(borrowCapUsd - currentTotalBorrowedUsd, 0)
      : null;

  // Calculate available liquidity for borrow (pool liquidity + any new supply)
  const poolLiquidityForBorrowUsd = reserveRateInput && tokenPrice
    ? (() => {
        const decimals = reserveRateInput.decimals ?? 18;
        const scale = Math.pow(10, decimals);
        const availableLiquidityRaw = Number(reserveRateInput.availableLiquidity) / scale;
        return availableLiquidityRaw * tokenPrice + supplyInputUsd;
      })()
    : null;

  // Available to borrow = min(borrow cap remaining, pool liquidity)
  // If no borrow cap, use pool liquidity; if no liquidity data, use cap remaining
  const availableBorrowRoomUsd = (() => {
    if (borrowCapRemainingUsd !== null && poolLiquidityForBorrowUsd !== null) {
      return Math.min(borrowCapRemainingUsd, poolLiquidityForBorrowUsd);
    }
    if (borrowCapRemainingUsd !== null) return borrowCapRemainingUsd;
    if (poolLiquidityForBorrowUsd !== null) return poolLiquidityForBorrowUsd;
    return null;
  })();

  // Track which constraint is binding (for UI messaging)
  const borrowLimitedByLiquidity = 
    poolLiquidityForBorrowUsd !== null && 
    (borrowCapRemainingUsd === null || poolLiquidityForBorrowUsd < borrowCapRemainingUsd);

  // Cap borrow input by available borrow room (which already considers both constraints)
  let borrowInputUsd = rawBorrowInputUsd;
  if (availableBorrowRoomUsd !== null && borrowInputUsd > availableBorrowRoomUsd) {
    borrowInputUsd = Math.max(0, availableBorrowRoomUsd);
  }

  // Convert capped USD back to token amounts for native rate simulation
  const cappedSupplyAmount = tokenPrice && tokenPrice > 0
    ? supplyInputUsd / tokenPrice
    : supplyAmount;
  const cappedBorrowAmount = tokenPrice && tokenPrice > 0
    ? borrowInputUsd / tokenPrice
    : borrowAmount;

  const combinedNativeSimulation = reserveRateInput && hasAnyInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: String(cappedSupplyAmount),
        borrowAmount: String(cappedBorrowAmount),
      })
    : null;

  const supplyCurrentNative = toDisplayNative(reserve.supplyApy);
  const borrowCurrentNative = toDisplayNative(reserve.borrowApy);
  const supplyCurrentIncentive = buildIncentiveCurrent(
    reserve,
    'supply',
    isApy,
    tydroPointToUsdRate,
    whitelistMerklCampaignIds
  );
  const borrowCurrentIncentive = buildIncentiveCurrent(
    reserve,
    'borrow',
    isApy,
    tydroPointToUsdRate,
    whitelistMerklCampaignIds
  );

  const supplyCurrentTotal = isApy
    ? calculateTotalSupplyApy(reserve.supplyApy, supplyCurrentIncentive)
    : calculateTotalSupplyApr(supplyCurrentNative, supplyCurrentIncentive);
  const borrowCurrentTotal = isApy
    ? calculateTotalBorrowApy(reserve.borrowApy, borrowCurrentIncentive)
    : calculateTotalBorrowApr(borrowCurrentNative, borrowCurrentIncentive);

  const supplyAfterNative = combinedNativeSimulation
    ? isApy
      ? combinedNativeSimulation.supplyApyPercent
      : combinedNativeSimulation.supplyAprPercent
    : null;
  const borrowAfterNative = combinedNativeSimulation
    ? isApy
      ? combinedNativeSimulation.borrowApyPercent
      : combinedNativeSimulation.borrowAprPercent
    : null;

  const brevisSharedDepositsByCampaignId = hasAnyInput
    ? computeBrevisSharedCampaignDeposits(reserve, supplyInputUsd, borrowInputUsd)
    : undefined;

  const supplyAfterIncentiveRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'supply',
        isApy,
        supplyInputUsd,
        forecastStates,
        tydroPointToUsdRate,
        whitelistMerklCampaignIds,
        brevisSharedDepositsByCampaignId,
      )
    : null;
  const borrowAfterIncentiveRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'borrow',
        isApy,
        borrowInputUsd,
        forecastStates,
        tydroPointToUsdRate,
        whitelistMerklCampaignIds,
        brevisSharedDepositsByCampaignId,
      )
    : null;
  // Shared scenario represents extra market-side size, so same-side incentive should not increase.
  const supplyAfterIncentive =
    supplyAfterIncentiveRaw !== null ? Math.min(supplyAfterIncentiveRaw, supplyCurrentIncentive) : null;
  const borrowAfterIncentive =
    borrowAfterIncentiveRaw !== null ? Math.min(borrowAfterIncentiveRaw, borrowCurrentIncentive) : null;

  const supplyAfterTotal =
    hasAnyInput && supplyAfterNative !== null && supplyAfterIncentive !== null
      ? isApy
        ? calculateTotalSupplyApy(supplyAfterNative, supplyAfterIncentive)
        : calculateTotalSupplyApr(supplyAfterNative, supplyAfterIncentive)
      : null;
  const borrowAfterTotal =
    hasAnyInput && borrowAfterNative !== null && borrowAfterIncentive !== null
      ? isApy
        ? calculateTotalBorrowApy(borrowAfterNative, borrowAfterIncentive)
        : calculateTotalBorrowApr(borrowAfterNative, borrowAfterIncentive)
      : null;

  const supplyCurrentSources = {
    protocol: sumNumberArray(reserve.supplyIncentives, isApy),
    merit: sumMeritValues(reserve.meritSupplys, isApy),
    merkl: sumMerklValues(reserve.merklSupplys, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds),
    brevis: sumBrevisValues(reserve.brevisSupplys, isApy),
  };
  const borrowCurrentSources = {
    protocol: sumNumberArray(reserve.borrowIncentives, isApy),
    merit: sumMeritValues(reserve.meritBorrows, isApy),
    merkl: sumMerklValues(reserve.merklBorrows, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds),
    brevis: sumBrevisValues(reserve.brevisBorrows, isApy),
  };

  const supplyAfterSources = hasAnyInput
    ? (() => {
        const meritAfterRaw = sumForecastMeritValues(reserve.meritSupplys, isApy, supplyInputUsd);
        const merklAfterRaw = sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklSupplys,
            inputUsd: supplyInputUsd,
            forecastStates,
            whitelistMerklCampaignIds,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          whitelistMerklCampaignIds
        );
        const brevisAfterRaw = sumForecastBrevisValues(
          reserve.brevisSupplys,
          isApy,
          supplyInputUsd,
          brevisSharedDepositsByCampaignId,
        );
        return {
          protocol: supplyCurrentSources.protocol,
          merit: Math.min(meritAfterRaw, supplyCurrentSources.merit),
          merkl: Math.min(merklAfterRaw, supplyCurrentSources.merkl),
          brevis: Math.min(brevisAfterRaw, supplyCurrentSources.brevis),
        };
      })()
    : null;

  const borrowAfterSources = hasAnyInput
    ? (() => {
        const meritAfterRaw = sumForecastMeritValues(reserve.meritBorrows, isApy, borrowInputUsd);
        const merklAfterRaw = sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklBorrows,
            inputUsd: borrowInputUsd,
            forecastStates,
            whitelistMerklCampaignIds,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          whitelistMerklCampaignIds
        );
        const brevisAfterRaw = sumForecastBrevisValues(
          reserve.brevisBorrows,
          isApy,
          borrowInputUsd,
          brevisSharedDepositsByCampaignId,
        );
        return {
          protocol: borrowCurrentSources.protocol,
          merit: Math.min(meritAfterRaw, borrowCurrentSources.merit),
          merkl: Math.min(merklAfterRaw, borrowCurrentSources.merkl),
          brevis: Math.min(brevisAfterRaw, borrowCurrentSources.brevis),
        };
      })()
    : null;

  const supplyMeritCampaignRows = buildMeritCampaignDetails(
    reserve.meritSupplys,
    isApy,
    supplyInputUsd,
    hasAnyInput,
    getMeritAnchorTvlUsd(reserve, 'supply'),
  );
  const supplyMerklCampaignRows = buildMerklCampaignDetails(
    reserve.merklSupplys,
    isApy,
    supplyInputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    hasAnyInput,
  );
  const supplyBrevisCampaignRows = buildBrevisCampaignDetails(
    reserve.brevisSupplys,
    isApy,
    supplyInputUsd,
    brevisSharedDepositsByCampaignId,
    hasAnyInput,
  );
  const borrowMeritCampaignRows = buildMeritCampaignDetails(
    reserve.meritBorrows,
    isApy,
    borrowInputUsd,
    hasAnyInput,
    getMeritAnchorTvlUsd(reserve, 'borrow'),
  );
  const borrowMerklCampaignRows = buildMerklCampaignDetails(
    reserve.merklBorrows,
    isApy,
    borrowInputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    hasAnyInput,
  );
  const borrowBrevisCampaignRows = buildBrevisCampaignDetails(
    reserve.brevisBorrows,
    isApy,
    borrowInputUsd,
    brevisSharedDepositsByCampaignId,
    hasAnyInput,
  );

  const supplyLane: SimulationLane = {
    hasInput: hasSupplyInput,
    inputAmount: supplyAmount,
    inputUsd: supplyInputUsd,
    currentNative: supplyCurrentNative,
    currentIncentive: supplyCurrentIncentive,
    currentTotal: supplyCurrentTotal,
    afterNative: supplyAfterNative,
    afterIncentive: supplyAfterIncentive,
    afterTotal: supplyAfterTotal,
    deltaNative:
      supplyAfterNative !== null && supplyCurrentNative !== null ? supplyAfterNative - supplyCurrentNative : null,
    deltaIncentive:
      supplyAfterIncentive !== null ? supplyAfterIncentive - supplyCurrentIncentive : null,
    deltaTotal:
      supplyAfterTotal !== null && supplyCurrentTotal !== null ? supplyAfterTotal - supplyCurrentTotal : null,
    sources: {
      protocol: attachCampaigns(buildMetric(supplyCurrentSources.protocol, supplyAfterSources?.protocol ?? null), []),
      merit: attachCampaigns(
        buildMetric(supplyCurrentSources.merit, supplyAfterSources?.merit ?? null),
        supplyMeritCampaignRows,
      ),
      merkl: attachCampaigns(
        buildMetric(supplyCurrentSources.merkl, supplyAfterSources?.merkl ?? null),
        supplyMerklCampaignRows,
      ),
      brevis: attachCampaigns(
        buildMetric(supplyCurrentSources.brevis, supplyAfterSources?.brevis ?? null),
        supplyBrevisCampaignRows,
      ),
    },
  };

  const borrowLane: SimulationLane = {
    hasInput: hasBorrowInput,
    inputAmount: borrowAmount,
    inputUsd: borrowInputUsd,
    currentNative: borrowCurrentNative,
    currentIncentive: borrowCurrentIncentive,
    currentTotal: borrowCurrentTotal,
    afterNative: borrowAfterNative,
    afterIncentive: borrowAfterIncentive,
    afterTotal: borrowAfterTotal,
    deltaNative:
      borrowAfterNative !== null && borrowCurrentNative !== null ? borrowAfterNative - borrowCurrentNative : null,
    deltaIncentive:
      borrowAfterIncentive !== null ? borrowAfterIncentive - borrowCurrentIncentive : null,
    deltaTotal:
      borrowAfterTotal !== null && borrowCurrentTotal !== null ? borrowAfterTotal - borrowCurrentTotal : null,
    sources: {
      protocol: attachCampaigns(buildMetric(borrowCurrentSources.protocol, borrowAfterSources?.protocol ?? null), []),
      merit: attachCampaigns(
        buildMetric(borrowCurrentSources.merit, borrowAfterSources?.merit ?? null),
        borrowMeritCampaignRows,
      ),
      merkl: attachCampaigns(
        buildMetric(borrowCurrentSources.merkl, borrowAfterSources?.merkl ?? null),
        borrowMerklCampaignRows,
      ),
      brevis: attachCampaigns(
        buildMetric(borrowCurrentSources.brevis, borrowAfterSources?.brevis ?? null),
        borrowBrevisCampaignRows,
      ),
    },
  };

  const spreadCurrent =
    supplyCurrentTotal !== null && borrowCurrentTotal !== null
      ? supplyCurrentTotal - borrowCurrentTotal
      : null;
  const spreadAfter =
    supplyAfterTotal !== null && borrowAfterTotal !== null ? supplyAfterTotal - borrowAfterTotal : null;
  const spreadDelta = spreadAfter !== null && spreadCurrent !== null ? spreadAfter - spreadCurrent : null;

  const utilizationCurrent = currentNativeSimulation?.utilizationRatePercent ?? null;
  const utilizationAfter = combinedNativeSimulation?.utilizationRatePercent ?? null;
  const utilizationOptimal = currentNativeSimulation?.optimalUtilizationPercent ?? null;
  const forecastUnavailableCampaignCount = hasAnyInput
    ? Array.from(
        new Set([
          ...collectActiveCampaignIds(reserve.merklSupplys),
          ...collectActiveCampaignIds(reserve.merklBorrows),
        ])
      ).filter((id) => !forecastStates[id]).length
    : 0;

  const RAY_SCALE = 1e27;
  const computeMarketMetrics = (): MarketMetrics => {
    // Use raw input values to determine if caps are exceeded (for warnings)
    // But use capped values for actual calculations (supplyInputUsd, borrowInputUsd are already capped)
    
    const computeSupplyCapFields = () => {
      if (supplyCapUsd === null || supplyCapUsd <= 0) {
        return {
          availableSupplyRoomUsd: null,
          supplyCapExceeded: false,
          supplyCapExceededByUsd: null,
        };
      }
      // Use raw input to check if exceeded
      const rawAfterSizeUsd = currentReserveSizeUsd !== null 
        ? currentReserveSizeUsd + rawSupplyInputUsd 
        : null;
      const exceeded = rawAfterSizeUsd !== null && rawAfterSizeUsd > supplyCapUsd;
      const exceededBy = exceeded ? rawAfterSizeUsd - supplyCapUsd : null;
      return {
        availableSupplyRoomUsd: availableSupplyRoomUsd,
        supplyCapExceeded: exceeded,
        supplyCapExceededByUsd: exceededBy,
      };
    };

    const computeBorrowCapFields = (totalBorrowedUsdBase: number | null) => {
      // Available borrow room considers both liquidity and cap
      // Check if user input exceeds available room
      const exceeded = availableBorrowRoomUsd !== null && rawBorrowInputUsd > availableBorrowRoomUsd;
      const exceededBy = exceeded ? rawBorrowInputUsd - availableBorrowRoomUsd : null;
      
      return {
        availableBorrowRoomUsd,
        borrowCapExceeded: exceeded,
        borrowCapExceededByUsd: exceededBy,
        borrowLimitedByLiquidity,
      };
    };

    if (!reserveRateInput || !tokenPrice) {
      const supplyCapFields = computeSupplyCapFields();
      const borrowCapFields = computeBorrowCapFields(null);
      return {
        availableLiquidityUsd: null,
        availableLiquidityUsdAfter: null,
        availableLiquidityUsdDelta: null,
        totalBorrowedUsd: null,
        totalBorrowedUsdAfter: null,
        totalBorrowedUsdDelta: null,
        supplyCapUsd,
        borrowCapUsd,
        reserveFactor: null,
        optimalUtilization: null,
        ...supplyCapFields,
        ...borrowCapFields,
      };
    }

    const decimals = reserveRateInput.decimals ?? 18;
    const scale = Math.pow(10, decimals);

    const availableLiquidityRaw = Number(reserveRateInput.availableLiquidity) / scale;
    const availableLiquidityUsd = availableLiquidityRaw * tokenPrice;

    const totalBorrowedRaw = Number(reserveRateInput.totalVariableDebt) / scale;
    const totalBorrowedUsd = totalBorrowedRaw * tokenPrice;

    const reserveFactorRaw = Number(reserveRateInput.reserveFactor);
    const reserveFactor = reserveFactorRaw > 0 ? (reserveFactorRaw / 10000) * 100 : null;

    const optimalUsageRateRaw = Number(reserveRateInput.optimalUsageRate);
    const optimalUtilization = optimalUsageRateRaw > 0 ? (optimalUsageRateRaw / RAY_SCALE) * 100 : null;

    // Use capped inputs for after values (supplyInputUsd and borrowInputUsd are already capped)
    const availableLiquidityUsdAfter = hasAnyInput
      ? availableLiquidityUsd + supplyInputUsd - borrowInputUsd
      : null;
    const totalBorrowedUsdAfter = hasAnyInput
      ? totalBorrowedUsd + borrowInputUsd
      : null;

    const supplyCapFields = computeSupplyCapFields();
    const borrowCapFields = computeBorrowCapFields(totalBorrowedUsd);

    return {
      availableLiquidityUsd,
      availableLiquidityUsdAfter,
      availableLiquidityUsdDelta: availableLiquidityUsdAfter !== null
        ? availableLiquidityUsdAfter - availableLiquidityUsd
        : null,
      totalBorrowedUsd,
      totalBorrowedUsdAfter,
      totalBorrowedUsdDelta: totalBorrowedUsdAfter !== null
        ? totalBorrowedUsdAfter - totalBorrowedUsd
        : null,
      supplyCapUsd,
      borrowCapUsd,
      reserveFactor,
      optimalUtilization,
      ...supplyCapFields,
      ...borrowCapFields,
    };
  };

  const marketMetrics = computeMarketMetrics();

  return {
    tokenPrice,
    supply: supplyLane,
    borrow: borrowLane,
    spread: {
      current: spreadCurrent,
      after: spreadAfter,
      delta: spreadDelta,
      usesCurrentSide: null,
    },
    utilization: {
      current: utilizationCurrent,
      after: utilizationAfter,
      delta:
        utilizationCurrent !== null && utilizationAfter !== null
          ? utilizationAfter - utilizationCurrent
          : null,
      optimal: utilizationOptimal,
    },
    marketMetrics,
    forecastUnavailableCampaignCount,
  };
}

const buildEmptyRateSimulationResult = (
  reserve: ReserveWithSpread,
  params: Omit<BuildRateSimulationResultParams, 'reserve'>
): RateSimulationResult => ({
  ...buildRateSimulationResult({
    reserve,
    ...params,
  }),
  tokenPriceLoading: false,
  reserveRateInputLoading: false,
  reserveRateInputError: null,
  forecastLoading: false,
  forecastErrors: {},
  hasRateInput: false,
});

export const useSharedRateSimulations = ({
  reserves,
  isApy,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  tokenPrices,
  enabled = true,
  supplyInput,
  borrowInput,
  inputMode = 'token',
}: UseSharedRateSimulationsParams) => {
  const hasAnyInput = useMemo(() => parseNumberInput(supplyInput) > 0 || parseNumberInput(borrowInput) > 0, [borrowInput, supplyInput]);
  const needsTokenPrice = inputMode === 'token';

  const priceQueries = useQueries({
    queries: reserves.map((reserve) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      return {
        queryKey: [
          ...FORECAST_TOKEN_PRICE_QUERY_KEY,
          reserve.chainId,
          reserve.tokenAddress,
          reserve.aTokenAddress ?? '',
          reserve.vTokenAddress ?? '',
          reserve.tokenSymbol,
        ],
        queryFn: async () => {
          return (
            (await resolveForecastTokenPriceWithBackup(
              buildPriceLookup(reserve, tokenPrices, 'Supply'),
              fetch
            )) ??
            (await resolveForecastTokenPriceWithBackup(
              buildPriceLookup(reserve, tokenPrices, 'Borrow'),
              fetch
            )) ??
            null
          );
        },
        // Shared simulation in token mode relies on backend-provided prices only.
        // Table-wide third-party fetches create a request storm and hit browser CORS/rate limits.
        enabled: enabled && hasAnyInput && needsTokenPrice && localPrice === undefined,
        staleTime: QUERY_STALE_TIMES.default,
      };
    }),
  });

  const tokenPriceById = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    reserves.forEach((reserve, index) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      map[getReserveSimulationId(reserve)] = localPrice ?? priceQueries[index]?.data ?? undefined;
    });
    return map;
  }, [priceQueries, reserves, tokenPrices]);

  const tokenPriceLoadingById = useMemo(() => {
    const map: Record<string, boolean> = {};
    reserves.forEach((reserve, index) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      map[getReserveSimulationId(reserve)] =
        needsTokenPrice &&
        localPrice === undefined &&
        Boolean(priceQueries[index]?.isPending || priceQueries[index]?.isFetching);
    });
    return map;
  }, [needsTokenPrice, priceQueries, reserves, tokenPrices]);

  // Get forecast data directly from side-data-meta (prefetched in App.tsx)
  const sideDataMetaQuery = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);

  const { forecastStates, forecastErrors } = useMemo(() => {
    const forecast = sideDataMetaQuery.data?.forecast;
    if (!forecast) return { forecastStates: {}, forecastErrors: {} };

    const states: Record<string, MerklForecastWireItem> = {};
    const errors: Record<string, string> = {};
    forecast.items.forEach((item) => {
      states[item.campaignId] = item;
    });
    forecast.errors
      .filter((item) => shouldSurfaceForecastError(item))
      .forEach((item) => {
        errors[item.campaignId] = item.message;
      });
    return { forecastStates: states, forecastErrors: errors };
  }, [sideDataMetaQuery.data?.forecast]);

  const forecastLoading = sideDataMetaQuery.isPending || sideDataMetaQuery.isFetching;

  const simulationsById = useMemo(() => {
    return reserves.reduce<Record<string, RateSimulationResult>>((acc, reserve) => {
      const reserveId = getReserveSimulationId(reserve);
      const reserveRateInput = hasRateCalcFields(reserve) ? reserve : null;
      acc[reserveId] = {
        ...buildRateSimulationResult({
          reserve,
          reserveRateInput,
          isApy,
          whitelistMerklCampaignIds,
          tydroPointToUsdRate,
          tokenPrice: tokenPriceById[reserveId],
          supplyInput,
          borrowInput,
          inputMode,
          forecastStates,
        }),
        tokenPriceLoading: tokenPriceLoadingById[reserveId] ?? false,
        reserveRateInputLoading: false,
        reserveRateInputError: null,
        forecastLoading: hasAnyInput && forecastLoading,
        forecastErrors,
        hasRateInput: Boolean(reserveRateInput),
      };
      return acc;
    }, {});
  }, [
    borrowInput,
    hasAnyInput,
    forecastErrors,
    forecastLoading,
    forecastStates,
    whitelistMerklCampaignIds,
    inputMode,
    isApy,
    reserves,
    supplyInput,
    tokenPriceById,
    tokenPriceLoadingById,
    tydroPointToUsdRate,
  ]);

  return {
    hasAnyInput,
    simulationsById,
    rateInputsSnapshotLoading: false,
    rateInputsSnapshotError: null,
    forecastLoading: hasAnyInput && forecastLoading,
    forecastErrors,
  };
};

export const useRateSimulation = ({
  reserve,
  isApy,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  tokenPrices,
  enabled = true,
  supplyInput,
  borrowInput,
}: UseRateSimulationParams): RateSimulationResult => {
  const reserveId = getReserveSimulationId(reserve);
  const { simulationsById } = useSharedRateSimulations({
    reserves: [reserve],
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    tokenPrices,
    enabled,
    supplyInput,
    borrowInput,
  });

  return (
    simulationsById[reserveId] ??
    buildEmptyRateSimulationResult(reserve, {
      reserveRateInput: null,
      isApy,
      whitelistMerklCampaignIds,
      tydroPointToUsdRate,
      tokenPrice: resolveLocalReserveTokenPrice(reserve, tokenPrices),
      supplyInput,
      borrowInput,
      forecastStates: {},
    })
  );
};
