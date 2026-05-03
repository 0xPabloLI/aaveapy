import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import {
  annualPercentToDailyFraction,
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
  forecastBreakdownApr,
  getMerklBreakdownApr,
  mergeForecastState,
  sanitizePercent,
  forecastWithTVL,
} from '@/lib/merklForecast';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { getProtocolVersion, type ProtocolVersion } from '@/lib/protocolVersion';
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
  buildNetEligibilityNote,
  ceilingEffectToSimulationFields,
} from '@/lib/incentiveCeilings';
import {
  getBrevisCampaignBreakdowns,
  getBrevisCampaignId,
  getBrevisResolvedBreakdown,
} from '@/lib/brevis';
import { getReserveKey } from '@/lib/reserveKey';
import {
  applyStableCampaignLabels,
  flattenCampaignBreakdowns,
  isCampaignActive,
  sumActiveCampaignBreakdownValues,
} from '@/lib/campaignGroups';
import { parseNumberInput } from '@/lib/numberFormat';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import {
  convertMerklPointsAmountToUsd,
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
import { nativeToUsd } from '@/lib/scenarioSize';

const FORECAST_TOKEN_PRICE_QUERY_KEY = ['forecast-token-price'] as const;

type BrevisCampaignRow = {
  source: BrevisIncentive;
  breakdown: NonNullable<BrevisIncentive['breakdowns']>[number];
};

const flattenBrevisCampaignRows = (values?: BrevisIncentive[]): BrevisCampaignRow[] => {
  return flattenCampaignBreakdowns(
    values?.map((source) => ({
      ...source,
      breakdowns: getBrevisCampaignBreakdowns(source),
    }))
  ).map(({ group, breakdown }) => ({
    source: group,
    breakdown,
  }));
};

interface BuildForecastMerklOpportunitiesInput {
  opportunities?: MerklOpportunityGroup[];
  inputUsd: number;
  forecastStates: Record<string, MerklForecastWireItem>;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
}

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
      campaignApr: forecastBreakdownApr(breakdown, inputUsd, forecastStates, tydroPointToUsdRate),
      pointsPerThousandUsd: undefined,
    })),
  }));
}

const FORECAST_REQUIRING_CAMPAIGN_TYPES = new Set([
  'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
]);

const collectActiveCampaignIds = (opportunities?: MerklOpportunityGroup[]): string[] => {
  if (!opportunities || opportunities.length === 0) return [];
  const ids = new Set<string>();
  opportunities.forEach((opportunity) => {
    opportunity.breakdowns?.forEach((breakdown) => {
      if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
      if (breakdown.campaignType && !FORECAST_REQUIRING_CAMPAIGN_TYPES.has(breakdown.campaignType)) return;
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
  /** Optional deep-link (Merit incentive, Merkl opportunity, or Brevis campaign). */
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

/** Estimated USD cashflow per day from simulated **after** rates × scenario principal. */
export interface ScenarioUsdAccrualSide {
  /** Supply: positive earnings. Borrow native: negative (interest paid). */
  nativeUsdPerDay: number | null;
  /** Supply: positive. Borrow: positive (rebate reduces borrow cost). */
  incentiveUsdPerDay: number | null;
  /** Net of native + incentive for this side (borrow total uses combined after rate, see build). */
  totalUsdPerDay: number | null;
}

export interface ScenarioUsdAccrual {
  supply: ScenarioUsdAccrualSide | null;
  borrow: ScenarioUsdAccrualSide | null;
  /** Sum of supply and borrow totals (supply positive, borrow negative when paying interest). */
  netUsdPerDay: number | null;
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
  /** Present when at least one side has scenario principal; uses after-simulation rates. */
  scenarioUsdAccrual: ScenarioUsdAccrual | null;
}

export interface RateSimulationResult extends RateSimulationComputedResult {
  tokenPriceLoading: boolean;
  forecastLoading: boolean;
  forecastErrors: Record<string, string>;
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
  /**
   * When true (default), Merit/Merkl hypothetical TVL uses net position per side
   * (supply net = max(supply−borrow,0), borrow net = max(borrow−supply,0)) with eligibility scaling.
   * When false, each side uses its full scenario USD independently. Brevis is always gross per side.
   */
  meritMerklNetPosition?: boolean;
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
  meritMerklNetPosition?: boolean;
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
  meritMerklNetPosition?: boolean;
}

const buildIncentiveCurrent = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  forecastStates?: Record<string, MerklForecastWireItem>,
): number => {
  const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  const protocol = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  const options = { whitelistMerklCampaignIds, forecastStates };
  return isApy
    ? calculateTotalIncentiveApy(merit, merkl, brevis, protocol, tydroPointToUsdRate, options)
    : calculateTotalIncentiveApr(merit, merkl, brevis, protocol, tydroPointToUsdRate, options);
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
 * Supply: reserveSize (native → USD). Borrow: borrowed USD ≈ reserveSize × utilization (Merit TVL proxy when no campaign TVL exists).
 * V4: reserveSize may be 0 or a per-Spoke slice — use on-chain totalVariableDebt for borrow side,
 *     and return undefined for supply side when reserveSize-derived USD is 0/unreliable.
 */
const getMeritAnchorTvlUsd = (reserve: ReserveWithSpread, side: RateSide, protocolVersion: ProtocolVersion): number | undefined => {
  if (protocolVersion === 'v4') {
    // V4: reserveSizeUsd is unreliable for both supply and borrow anchor
    if (side === 'supply') {
      const size = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
      if (size != null && Number.isFinite(size) && size > 0) return size;
      return undefined;
    }
    // Borrow: use on-chain totalVariableDebt if available
    const { totalVariableDebt, decimals, tokenPrice } = reserve;
    if (totalVariableDebt && decimals != null && tokenPrice != null && tokenPrice > 0) {
      const raw = Number(totalVariableDebt);
      if (Number.isFinite(raw) && raw >= 0) {
        const tokens = raw / Math.pow(10, decimals);
        const usd = tokens * tokenPrice;
        if (usd > 0) return usd;
      }
    }
    return undefined;
  }
  // V3: reserveSize is reliable
  const size = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
  if (size == null || !Number.isFinite(size) || size <= 0) return undefined;
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
    const breakdowns = getBrevisCampaignBreakdowns(value);
    if (breakdowns.length === 0) return sum;
    return (
      sum +
      breakdowns.reduce((breakdownSum, breakdown) => {
        const resolved = getBrevisResolvedBreakdown(value, breakdown);
        if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) {
          return breakdownSum;
        }
        const apr = sanitizePercent(resolved.campaignApr);
        return breakdownSum + (isApy ? convertAprToApy(apr) : apr);
      }, 0)
    );
  }, 0);
};

const areBrevisSharedSnapshotsEqual = (
  left: ReturnType<typeof getBrevisResolvedBreakdown>,
  right: ReturnType<typeof getBrevisResolvedBreakdown>,
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
  const supplyRows = flattenBrevisCampaignRows(reserve.brevisSupplys);
  const borrowRows = flattenBrevisCampaignRows(reserve.brevisBorrows);

  const supplyByCampaignId = new Map<string, Array<{ source: BrevisIncentive; breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] }>>();
  const borrowByCampaignId = new Map<string, Array<{ source: BrevisIncentive; breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] }>>();
  supplyRows.forEach((item) => {
    const campaignId = item.breakdown.campaignId ?? getBrevisCampaignId(item.source);
    if (!campaignId) return;
    const resolved = getBrevisResolvedBreakdown(item.source, item.breakdown);
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) return;
    const existing = supplyByCampaignId.get(campaignId);
    if (existing) existing.push(item);
    else supplyByCampaignId.set(campaignId, [item]);
  });
  borrowRows.forEach((item) => {
    const campaignId = item.breakdown.campaignId ?? getBrevisCampaignId(item.source);
    if (!campaignId) return;
    const resolved = getBrevisResolvedBreakdown(item.source, item.breakdown);
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) return;
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
    const canonical = getBrevisResolvedBreakdown(entries[0].source, entries[0].breakdown);
    const mismatch = entries.slice(1).some((entry) => (
      !areBrevisSharedSnapshotsEqual(canonical, getBrevisResolvedBreakdown(entry.source, entry.breakdown))
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
  breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] | undefined,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
): number | undefined => {
  const campaignId = breakdown?.campaignId ?? getBrevisCampaignId(brevis);
  if (!campaignId || !sharedDepositsByCampaignId) return undefined;
  return sharedDepositsByCampaignId.get(campaignId);
};

const sumForecastBrevisValues = (
  values: BrevisIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  sharedDepositsByCampaignId?: ReadonlyMap<string, number>,
): number => {
  return sumActiveCampaignBreakdownValues(values, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const combined = getBrevisCombinedDepositUsd(group, breakdown, sharedDepositsByCampaignId);
      const aprPercent = forecastBrevisAprPercent(
        { ...group, ...breakdown },
        inputUsd,
        Date.now(),
        combined
      );
      if (aprPercent <= 0) return 0;
      return isApy ? convertAprToApy(aprPercent) : aprPercent;
    },
  });
};

const sumMerklValues = (
  opportunities: MerklOpportunityGroup[] | undefined,
  isApy: boolean,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  forecastStates?: Record<string, MerklForecastWireItem>,
): number => {
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds),
    mapValue: (_group, breakdown) => {
      const apr = forecastStates
        ? sanitizePercent(forecastBreakdownApr(breakdown, 0, forecastStates, tydroPointToUsdRate))
        : sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
      return isApy ? convertAprToApy(apr) : apr;
    },
  });
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

/** Show per-campaign rows whenever campaign details exist (even without scenario input). */
const shouldExposeCampaignRows = (rows: SimulationCampaignDetail[]): boolean => rows.length > 0;

type LabeledCampaignRow = Omit<SimulationCampaignDetail, 'label'> & { baseLabel: string };

const finalizeCampaignDetailRows = (
  collected: LabeledCampaignRow[],
): SimulationCampaignDetail[] => {
  if (collected.length === 0) return [];
  const rows = applyStableCampaignLabels(
    collected.map(({ baseLabel, ...rest }) => ({
      ...rest,
      label: baseLabel,
    }))
  );
  return shouldExposeCampaignRows(rows) ? rows : [];
};

const extractActionLabelFromMeritMessage = (message: MeritIncentive['message']): string | null => {
  if (!message) return null;
  if (Array.isArray(message)) {
    for (const item of message) {
      const label = extractActionLabelFromMeritMessage(item as MeritIncentive['message']);
      if (label) return label;
    }
    return null;
  }
  if (typeof message === 'object') {
    const actionValue = (message as Record<string, unknown>).action;
    if (typeof actionValue === 'string' && actionValue.trim()) return actionValue.trim();
    for (const value of Object.values(message)) {
      const label = extractActionLabelFromMeritMessage(value as MeritIncentive['message']);
      if (label) return label;
    }
    return null;
  }
  return null;
};

const buildMeritCampaignDetails = (
  merits: MeritIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  hasAnyInput: boolean,
  meritAnchorTvlUsd?: number,
  eligibilityRatio = 1,
  grossInputUsd?: number,
): SimulationCampaignDetail[] => {
  const rows: SimulationCampaignDetail[] = [];
  if (!merits?.length) return rows;

  const netNote = grossInputUsd !== undefined ? buildNetEligibilityNote(inputUsd, grossInputUsd) : null;
  const appendNetNote = (note: string | undefined): string | undefined => {
    if (!netNote) return note;
    return note ? `${note} · ${netNote}` : netNote;
  };

  const activeMerits = merits.filter((m) => isCampaignActive(m.startDate, m.endDate));

  activeMerits.forEach((merit, meritIndex) => {
    const { baseMessage, selfMessage } = splitMeritMessageBySelfAuth(merit.message);
    const selfCapUsd = extractMeritSelfCapUsd(selfMessage);
    const baseAprPercent = sanitizePercent(merit.apr);
    const selfAprPercent = sanitizePercent(merit.selfApr ?? 0);
    const meritName = (merit.name?.trim() || 'Merit');
    const hasBaseLeg = baseAprPercent > 0;
    const baseLabel = extractActionLabelFromMeritMessage(baseMessage) ?? meritName;
    const selfLabel = extractActionLabelFromMeritMessage(selfMessage) ?? (hasBaseLeg ? `${baseLabel} #2` : meritName);
    const meritHref = typeof merit.link === 'string' && merit.link.trim() ? merit.link.trim() : null;

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
          baseAfter = meritForecastAprToDisplay(fp.apr, isApy) * eligibilityRatio;
        }
      } else if (hasAnyInput) {
        baseAfter = 0;
      }
      const delta = baseAfter !== null ? baseAfter - baseCurrent : null;
      rows.push({
        id: `merit-${meritIndex}-base`,
        label: baseLabel,
        current: baseCurrent,
        after: baseAfter,
        delta,
        capNote: appendNetNote(undefined),
        capWarning: false,
        href: meritHref,
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
          selfAfter = meritForecastAprToDisplay(fp.apr, isApy) * eligibilityRatio;
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
      } else if (hasAnyInput) {
        selfAfter = 0;
      }
      const delta = selfAfter !== null ? selfAfter - selfCurrent : null;
      rows.push({
        id: `merit-${meritIndex}-self`,
        label: selfLabel,
        current: selfCurrent,
        after: selfAfter,
        delta,
        capNote: appendNetNote(capNote),
        capWarning,
        href: meritHref,
      });
    }
  });

  return shouldExposeCampaignRows(rows) ? rows : [];
};

const buildMerklCampaignDetails = (
  opportunities: MerklOpportunityGroup[] | undefined,
  isApy: boolean,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number,
  hasAnyInput: boolean,
  eligibilityRatio = 1,
  grossInputUsd?: number,
): SimulationCampaignDetail[] => {
  if (!opportunities?.length) return [];

  const netNote = grossInputUsd !== undefined ? buildNetEligibilityNote(inputUsd, grossInputUsd) : null;
  const appendNetNote = (note: string | undefined): string | undefined => {
    if (!netNote) return note;
    return note ? `${note} · ${netNote}` : netNote;
  };

  // User-friendly labels; when the same opportunity name appears on multiple rows, add a stable "#n" suffix
  // (same rule with or without scenario input so the list does not change shape).
  const collected: LabeledCampaignRow[] = [];

  opportunities.forEach((opportunity, oppIndex) => {
    (opportunity.breakdowns ?? []).forEach((bd, bdIndex) => {
      if (!isCampaignActive(bd.campaignStartedAt, bd.campaignEndedAt)) return;
      if (!isMerklWhitelistBreakdownIncluded(bd, whitelistMerklCampaignIds)) return;

      const currentApr = sanitizePercent(forecastBreakdownApr(bd, 0, forecastStates, tydroPointToUsdRate));
      const current = isApy ? convertAprToApy(currentApr) : currentApr;
      let after: number | null = null;
      let capNote: string | undefined;
      let capWarning = false;

      if (inputUsd > 0) {
        const forecastApr = forecastBreakdownApr(bd, inputUsd, forecastStates, tydroPointToUsdRate);
        const forecastAprSan = sanitizePercent(forecastApr);
        after = (isApy ? convertAprToApy(forecastAprSan) : forecastAprSan) * eligibilityRatio;

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
        }
      } else if (hasAnyInput) {
        // Net-eligible USD is 0 on this lane but the user entered a scenario: show 0% after (matches aggregate Merkl), not em dash.
        after = 0;
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
        capNote: appendNetNote(capNote),
        capWarning,
        href: oppLink ?? null,
      });
    });
  });

  return finalizeCampaignDetailRows(collected);
};

const buildBrevisCampaignDetails = (
  items: BrevisIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
  hasAnyInput: boolean,
): SimulationCampaignDetail[] => {
  if (!items?.length) return [];

  const flattened = flattenBrevisCampaignRows(items);
  const collected: LabeledCampaignRow[] = [];
  flattened.forEach(({ source, breakdown }) => {
    const resolved = getBrevisResolvedBreakdown(source, breakdown);
    const baseLabel = (resolved.name?.trim() || resolved.message?.trim() || 'Brevis');
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) return;
    const nominal = sanitizePercent(resolved.campaignApr);
    const current = isApy ? convertAprToApy(nominal) : nominal;
    let after: number | null = null;
    let capNote: string | undefined;
    let capWarning = false;
    const combined = getBrevisCombinedDepositUsd(source, breakdown, sharedDepositsByCampaignId);
    const noteDepositUsd = combined ?? inputUsd;

    if (inputUsd > 0) {
      const aprPercent = forecastBrevisAprPercent({ ...source, ...breakdown }, inputUsd, Date.now(), combined);
      after = isApy ? convertAprToApy(aprPercent) : aprPercent;
    }

    if (hasAnyInput && noteDepositUsd > 0) {
      const det = forecastBrevisDetailed({ ...source, ...breakdown }, noteDepositUsd, Date.now(), combined);
      const perUserRewardCapUsd = resolved.perUserRewardCapUsd;
      if (perUserRewardCapUsd !== undefined && perUserRewardCapUsd > 0) {
        ({ capNote, capWarning } = ceilingEffectToSimulationFields(
          buildBrevisRewardCeilingEffect({
            rewardCeilingUsd: perUserRewardCapUsd,
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
    collected.push({
      id: `brevis-${collected.length}-${breakdown.campaignId ?? 'b'}`,
      baseLabel,
      current,
      after,
      delta,
      capNote,
      capWarning,
    });
  });

  return finalizeCampaignDetailRows(collected);
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
  netInputUsd: number,
  grossInputUsd: number,
  eligibilityRatio: number,
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
    inputUsd: netInputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
  });

  return (
    sumNumberArray(protocol, isApy) +
    sumForecastMeritValues(merit, isApy, netInputUsd, getMeritAnchorTvlUsd(reserve, side, getProtocolVersion(reserve.marketName))) * eligibilityRatio +
    sumMerklValues(forecastedMerkl, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds) * eligibilityRatio +
    sumForecastBrevisValues(brevis, isApy, grossInputUsd, brevisSharedDepositsByCampaignId)
  );
};

const toDisplayNative = (rawApy: number | null | undefined): number | null => {
  if (rawApy === null || rawApy === undefined || !Number.isFinite(rawApy)) return null;
  return rawApy;
};

export const getReserveSimulationId = (reserve: Pick<ReserveWithSpread, 'reserveId'>): string =>
  getReserveKey(reserve);

const buildPriceLookup = (reserve: ReserveWithSpread, tokenPrices?: TokenPricesIndex, actionType: 'Supply' | 'Borrow' = 'Supply') => ({
  tokenPrices,
  chainId: reserve.chainId,
  actionType,
  tokenSymbol: reserve.tokenSymbol,
  tokenAddress: reserve.tokenAddress,
  aTokenAddress: reserve.aTokenAddress,
  vTokenAddress: reserve.vTokenAddress,
});

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

function nativeAprPercentToApyPercent(aprPercent: number): number {
  if (!Number.isFinite(aprPercent) || aprPercent <= 0) return 0;
  const aprDecimal = aprPercent / 100;
  const apyDecimal = Math.pow(1 + aprDecimal / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
  return apyDecimal * 100;
}

function buildSupplyUsdAccrualSide(
  principalUsd: number,
  nativeAprPercent: number | null,
  incentiveAprPercent: number | null
): ScenarioUsdAccrualSide | null {
  if (!Number.isFinite(principalUsd) || principalUsd <= 0) return null;
  const nativeUsd = (ratePercent: number) =>
    principalUsd * annualPercentToDailyFraction(nativeAprPercentToApyPercent(ratePercent), true);
  const incentiveUsd = (ratePercent: number) => principalUsd * annualPercentToDailyFraction(ratePercent, false);
  const nativeUsdPerDay = nativeAprPercent !== null ? nativeUsd(nativeAprPercent) : null;
  const incentiveUsdPerDay = incentiveAprPercent !== null ? incentiveUsd(incentiveAprPercent) : null;
  return {
    nativeUsdPerDay,
    incentiveUsdPerDay,
    totalUsdPerDay:
      nativeUsdPerDay !== null || incentiveUsdPerDay !== null
        ? (nativeUsdPerDay ?? 0) + (incentiveUsdPerDay ?? 0)
        : null,
  };
}

function buildBorrowUsdAccrualSide(
  principalUsd: number,
  nativeAprPercent: number | null,
  incentiveAprPercent: number | null
): ScenarioUsdAccrualSide | null {
  if (!Number.isFinite(principalUsd) || principalUsd <= 0) return null;
  const nativePay = (ratePercent: number) =>
    -principalUsd * annualPercentToDailyFraction(nativeAprPercentToApyPercent(ratePercent), true);
  const incentiveRebate = (ratePercent: number) =>
    principalUsd * annualPercentToDailyFraction(ratePercent, false);
  const nativeUsdPerDay = nativeAprPercent !== null ? nativePay(nativeAprPercent) : null;
  const incentiveUsdPerDay = incentiveAprPercent !== null ? incentiveRebate(incentiveAprPercent) : null;
  return {
    nativeUsdPerDay,
    incentiveUsdPerDay,
    totalUsdPerDay:
      nativeUsdPerDay !== null || incentiveUsdPerDay !== null
        ? (nativeUsdPerDay ?? 0) + (incentiveUsdPerDay ?? 0)
        : null,
  };
}

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
  meritMerklNetPosition = true,
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
  const supplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice) ?? null;
  const borrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice) ?? null;
  // V4: reserveSize may be 0 or a per-Spoke slice — treat as null to avoid misleading cap room
  const currentReserveSizeUsd = (() => {
    const size = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice) ?? null;
    if (getProtocolVersion(reserve.marketName) === 'v4' && (size === null || size === 0)) return null;
    return size;
  })();
  
  // Calculate available supply room (prefer API suppliable, fallback to cap-size)
  const availableSupplyRoomUsd = (() => {
    const fromApi = nativeToUsd(reserve.suppliable, reserve.decimals, reserve.tokenPrice) ?? null;
    if (fromApi !== null) return fromApi;
    return supplyCapUsd !== null && supplyCapUsd > 0 && currentReserveSizeUsd !== null
      ? Math.max(supplyCapUsd - currentReserveSizeUsd, 0)
      : null;
  })();

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

  // Calculate available liquidity for borrow (on-chain available liquidity + any new supply)
  const availableLiquidityForBorrowUsd = reserveRateInput && tokenPrice
    ? (() => {
        const decimals = reserveRateInput.decimals ?? 18;
        const scale = Math.pow(10, decimals);
        const availableLiquidityRaw = Number(reserveRateInput.availableLiquidity) / scale;
        return availableLiquidityRaw * tokenPrice + supplyInputUsd;
      })()
    : null;

  // Available to borrow = min(borrow cap remaining, available liquidity + scenario supply)
  // For static display (no input), prefer API borrowable; for simulation, recalculate with supply added
  const apiBorrowableUsd = nativeToUsd(reserve.borrowable, reserve.decimals, reserve.tokenPrice) ?? null;
  const availableBorrowRoomUsd = (() => {
    if (borrowCapRemainingUsd !== null && availableLiquidityForBorrowUsd !== null) {
      return Math.min(borrowCapRemainingUsd, availableLiquidityForBorrowUsd);
    }
    if (borrowCapRemainingUsd !== null) return borrowCapRemainingUsd;
    if (availableLiquidityForBorrowUsd !== null) return availableLiquidityForBorrowUsd;
    return apiBorrowableUsd;
  })();

  // Track which constraint is binding (for UI messaging)
  const borrowLimitedByLiquidity =
    availableLiquidityForBorrowUsd !== null &&
    (borrowCapRemainingUsd === null || availableLiquidityForBorrowUsd < borrowCapRemainingUsd);

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
    reserve, 'supply', isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates,
  );
  const borrowCurrentIncentive = buildIncentiveCurrent(
    reserve, 'borrow', isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates,
  );
  const supplyCurrentIncentiveApr = buildIncentiveCurrent(
    reserve, 'supply', false, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates,
  );
  const borrowCurrentIncentiveApr = buildIncentiveCurrent(
    reserve, 'borrow', false, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates,
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

  // Net eligible amounts: supply incentive eligible = max(supply - borrow, 0),
  // borrow incentive eligible = max(borrow - supply, 0).
  // Gross amounts are used by incentive sources that reward both sides independently.
  const supplyNetInputUsd = Math.max(supplyInputUsd - borrowInputUsd, 0);
  const borrowNetInputUsd = Math.max(borrowInputUsd - supplyInputUsd, 0);
  // Eligibility ratio: fraction of gross capital that is net-eligible.
  // Pool-level APR applies only to the eligible portion; scale to effective APR on gross capital.
  const supplyEligibilityRatio = supplyInputUsd > 0 ? supplyNetInputUsd / supplyInputUsd : 1;
  const borrowEligibilityRatio = borrowInputUsd > 0 ? borrowNetInputUsd / borrowInputUsd : 1;

  const supplyMeritMerklInputUsd = meritMerklNetPosition ? supplyNetInputUsd : supplyInputUsd;
  const borrowMeritMerklInputUsd = meritMerklNetPosition ? borrowNetInputUsd : borrowInputUsd;
  const supplyMeritMerklEligibilityRatio = meritMerklNetPosition ? supplyEligibilityRatio : 1;
  const borrowMeritMerklEligibilityRatio = meritMerklNetPosition ? borrowEligibilityRatio : 1;

  const supplyAfterIncentiveRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'supply',
        isApy,
        supplyMeritMerklInputUsd,
        supplyInputUsd,
        supplyMeritMerklEligibilityRatio,
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
        borrowMeritMerklInputUsd,
        borrowInputUsd,
        borrowMeritMerklEligibilityRatio,
        forecastStates,
        tydroPointToUsdRate,
        whitelistMerklCampaignIds,
        brevisSharedDepositsByCampaignId,
      )
    : null;
  const supplyAfterIncentiveAprRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'supply',
        false,
        supplyMeritMerklInputUsd,
        supplyInputUsd,
        supplyMeritMerklEligibilityRatio,
        forecastStates,
        tydroPointToUsdRate,
        whitelistMerklCampaignIds,
        brevisSharedDepositsByCampaignId,
      )
    : null;
  const borrowAfterIncentiveAprRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'borrow',
        false,
        borrowMeritMerklInputUsd,
        borrowInputUsd,
        borrowMeritMerklEligibilityRatio,
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
  const supplyAfterIncentiveApr =
    supplyAfterIncentiveAprRaw !== null
      ? Math.min(supplyAfterIncentiveAprRaw, supplyCurrentIncentiveApr)
      : null;
  const borrowAfterIncentiveApr =
    borrowAfterIncentiveAprRaw !== null
      ? Math.min(borrowAfterIncentiveAprRaw, borrowCurrentIncentiveApr)
      : null;

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
    merkl: sumMerklValues(reserve.merklSupplys, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates),
    brevis: sumBrevisValues(reserve.brevisSupplys, isApy),
  };
  const borrowCurrentSources = {
    protocol: sumNumberArray(reserve.borrowIncentives, isApy),
    merit: sumMeritValues(reserve.meritBorrows, isApy),
    merkl: sumMerklValues(reserve.merklBorrows, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates),
    brevis: sumBrevisValues(reserve.brevisBorrows, isApy),
  };

  const supplyAfterSources = hasAnyInput
    ? (() => {
        const meritAfterRaw =
          sumForecastMeritValues(reserve.meritSupplys, isApy, supplyMeritMerklInputUsd) * supplyMeritMerklEligibilityRatio;
        const merklAfterRaw = sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklSupplys,
            inputUsd: supplyMeritMerklInputUsd,
            forecastStates,
            whitelistMerklCampaignIds,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          whitelistMerklCampaignIds
        ) * supplyMeritMerklEligibilityRatio;
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
        const meritAfterRaw =
          sumForecastMeritValues(reserve.meritBorrows, isApy, borrowMeritMerklInputUsd) * borrowMeritMerklEligibilityRatio;
        const merklAfterRaw = sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklBorrows,
            inputUsd: borrowMeritMerklInputUsd,
            forecastStates,
            whitelistMerklCampaignIds,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          whitelistMerklCampaignIds
        ) * borrowMeritMerklEligibilityRatio;
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
    supplyMeritMerklInputUsd,
    hasAnyInput,
    getMeritAnchorTvlUsd(reserve, 'supply', getProtocolVersion(reserve.marketName)),
    supplyMeritMerklEligibilityRatio,
    supplyInputUsd,
  );
  const supplyMerklCampaignRows = buildMerklCampaignDetails(
    reserve.merklSupplys,
    isApy,
    supplyMeritMerklInputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    hasAnyInput,
    supplyMeritMerklEligibilityRatio,
    supplyInputUsd,
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
    borrowMeritMerklInputUsd,
    hasAnyInput,
    getMeritAnchorTvlUsd(reserve, 'borrow', getProtocolVersion(reserve.marketName)),
    borrowMeritMerklEligibilityRatio,
    borrowInputUsd,
  );
  const borrowMerklCampaignRows = buildMerklCampaignDetails(
    reserve.merklBorrows,
    isApy,
    borrowMeritMerklInputUsd,
    forecastStates,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    hasAnyInput,
    borrowMeritMerklEligibilityRatio,
    borrowInputUsd,
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

  const supplyUsdAccrualSide =
    supplyLane.hasInput && supplyLane.inputUsd > 0
      ? buildSupplyUsdAccrualSide(
          supplyLane.inputUsd,
          combinedNativeSimulation?.supplyAprPercent ?? null,
          supplyAfterIncentiveApr
        )
      : null;
  const borrowUsdAccrualSide =
    borrowLane.hasInput && borrowLane.inputUsd > 0
      ? buildBorrowUsdAccrualSide(
          borrowLane.inputUsd,
          combinedNativeSimulation?.borrowAprPercent ?? null,
          borrowAfterIncentiveApr
        )
      : null;

  let scenarioNetUsdPerDay: number | null = null;
  if (
    supplyUsdAccrualSide?.totalUsdPerDay != null ||
    borrowUsdAccrualSide?.totalUsdPerDay != null
  ) {
    scenarioNetUsdPerDay =
      (supplyUsdAccrualSide?.totalUsdPerDay ?? 0) + (borrowUsdAccrualSide?.totalUsdPerDay ?? 0);
  }

  const scenarioUsdAccrual: ScenarioUsdAccrual | null =
    supplyUsdAccrualSide || borrowUsdAccrualSide
      ? {
          supply: supplyUsdAccrualSide,
          borrow: borrowUsdAccrualSide,
          netUsdPerDay: scenarioNetUsdPerDay,
        }
      : null;

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

  const deriveTotalBorrowedUsd = (
    reserveSizeUsd: number | null | undefined,
    utilizationPct: number | null | undefined,
  ): number | null => {
    if (
      reserveSizeUsd == null || utilizationPct == null ||
      !Number.isFinite(reserveSizeUsd) || !Number.isFinite(utilizationPct)
    ) return null;
    return reserveSizeUsd * (utilizationPct / 100);
  };

  const deriveAvailableLiquidityUsd = (
    reserveSizeUsd: number | null | undefined,
    totalBorrowedUsd: number | null | undefined,
  ): number | null => {
    if (
      reserveSizeUsd == null || totalBorrowedUsd == null ||
      !Number.isFinite(reserveSizeUsd) || !Number.isFinite(totalBorrowedUsd)
    ) return null;
    return reserveSizeUsd - totalBorrowedUsd;
  };

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
      // Use raw input to check if exceeded (only when user entered scenario supply).
      // On-chain reserve can already be above cap; without a scenario amount we do not warn.
      const rawAfterSizeUsd =
        currentReserveSizeUsd !== null ? currentReserveSizeUsd + rawSupplyInputUsd : null;
      const exceeded =
        rawSupplyInputUsd > 0 &&
        rawAfterSizeUsd !== null &&
        rawAfterSizeUsd > supplyCapUsd;
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
      const protocolVersion = getProtocolVersion(reserve.marketName);
      const isV3 = protocolVersion === 'v3';
      const computedReserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
      const fallbackTotalBorrowedUsd = isV3
        ? deriveTotalBorrowedUsd(computedReserveSizeUsd, reserve.utilizationPct)
        : null;
      const fallbackAvailableLiquidityUsd = isV3
        ? deriveAvailableLiquidityUsd(computedReserveSizeUsd, fallbackTotalBorrowedUsd)
        : null;
      const supplyCapFields = computeSupplyCapFields();
      const borrowCapFields = computeBorrowCapFields(fallbackTotalBorrowedUsd);
      return {
        availableLiquidityUsd: fallbackAvailableLiquidityUsd,
        availableLiquidityUsdAfter: null,
        availableLiquidityUsdDelta: null,
        totalBorrowedUsd: fallbackTotalBorrowedUsd,
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
    const onChainAvailableLiquidityUsd = availableLiquidityRaw * tokenPrice;

    const totalBorrowedRaw = Number(reserveRateInput.totalVariableDebt) / scale;
    const onChainTotalBorrowedUsd = totalBorrowedRaw * tokenPrice;

    const protocolVersion = getProtocolVersion(reserve.marketName);
    const isV3 = protocolVersion === 'v3';
    const computedReserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);

    const totalBorrowedUsd =
      Number.isFinite(onChainTotalBorrowedUsd) && onChainTotalBorrowedUsd >= 0
        ? onChainTotalBorrowedUsd
        : isV3
          ? deriveTotalBorrowedUsd(computedReserveSizeUsd, reserve.utilizationPct)
          : null;

    const availableLiquidityUsd =
      Number.isFinite(onChainAvailableLiquidityUsd) && onChainAvailableLiquidityUsd >= 0
        ? onChainAvailableLiquidityUsd
        : isV3
          ? deriveAvailableLiquidityUsd(computedReserveSizeUsd, totalBorrowedUsd)
          : null;

    const reserveFactor = Number.isFinite(reserveRateInput.reserveFactor) && reserveRateInput.reserveFactor > 0
      ? reserveRateInput.reserveFactor
      : null;

    const optimalUtilization = Number.isFinite(reserveRateInput.optimalUsageRate) && reserveRateInput.optimalUsageRate > 0
      ? reserveRateInput.optimalUsageRate
      : null;

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
    scenarioUsdAccrual,
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
  forecastLoading: false,
  forecastErrors: {},
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
  meritMerklNetPosition = true,
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
          meritMerklNetPosition,
        }),
        tokenPriceLoading: tokenPriceLoadingById[reserveId] ?? false,
        forecastLoading: hasAnyInput && forecastLoading,
        forecastErrors,
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
    meritMerklNetPosition,
    reserves,
    supplyInput,
    tokenPriceById,
    tokenPriceLoadingById,
    tydroPointToUsdRate,
  ]);

  return {
    hasAnyInput,
    simulationsById,
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
  inputMode = 'token',
  meritMerklNetPosition = true,
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
    inputMode,
    meritMerklNetPosition,
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
      inputMode,
      forecastStates: {},
      meritMerklNetPosition,
    })
  );
};
