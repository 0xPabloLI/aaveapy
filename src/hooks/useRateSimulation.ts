import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  apyToApr,
  calculateTotalBorrowApy,
  calculateTotalBorrowApr,
  calculateTotalIncentiveApy,
  calculateTotalIncentiveApr,
  calculateTotalSupplyApy,
  calculateTotalSupplyApr,
  convertAprToApy,
} from '@/lib/formatters';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedRateInputsSnapshotEntry } from '@/lib/cache';
import { simulateNativeRatesAfterActions } from '@/lib/interestRateCalculator';
import { forecastWithTVL } from '@/lib/merklForecast';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { fetchMerklForecastStates } from '@/lib/merklForecastApi';
import { forecastMeritAprPercent } from '@/lib/meritForecast';
import { parseNumberInput } from '@/lib/numberFormat';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import { getMerklBreakdownApr, getMerklForecastUsdMultiplier } from '@/lib/tydro';
import type {
  BrevisIncentive,
  MeritIncentive,
  MerklCampaignBreakdown,
  MerklForecastStateResponse,
  MerklOpportunityGroup,
  RateInputsResponse,
  ReserveRateInput,
  ReserveWithSpread,
  TokenPricesIndex,
} from '@/types/aave';
import {
  fetchRateInputsSnapshot,
  findReserveRateInput,
  RATE_INPUTS_SNAPSHOT_QUERY_KEY,
} from '@/hooks/useReserveRateInputs';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORECAST_STATES_QUERY_KEY = ['merkl-forecast-states'] as const;
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

const isCampaignActive = (startDate: string | undefined, endDate: string | undefined, nowMs = Date.now()): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (startMs === null || endMs === null) return false;
  return nowMs >= startMs && nowMs <= endMs;
};

interface BuildForecastMerklOpportunitiesInput {
  opportunities?: MerklOpportunityGroup[];
  inputUsd: number;
  forecastStates: Record<string, MerklForecastStateResponse>;
  includeWhitelistOnlyMerkl: boolean;
  tydroPointToUsdRate: number;
}

const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

const forecastBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastStateResponse>,
  includeWhitelistOnlyMerkl: boolean,
  tydroPointToUsdRate: number
): number => {
  const currentApr = sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
  if (inputUsd <= 0) return currentApr;
  if (breakdown.whitelistOnly && !includeWhitelistOnlyMerkl) return currentApr;
  if (!breakdown.campaignId) return currentApr;

  const forecastState = forecastStates[String(breakdown.campaignId)];
  if (!forecastState) return currentApr;

  const hypotheticalTvl = Math.max((forecastState.latestTvl ?? 0) + inputUsd, 0);
  const forecast = forecastWithTVL(forecastState, hypotheticalTvl);
  const multiplier = Math.max(getMerklForecastUsdMultiplier(breakdown, tydroPointToUsdRate), 0);
  const forecastApr = sanitizePercent(forecast.apr * 100 * multiplier);
  return forecastApr;
};

export function buildForecastMerklOpportunities({
  opportunities,
  inputUsd,
  forecastStates,
  includeWhitelistOnlyMerkl,
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
        includeWhitelistOnlyMerkl,
        tydroPointToUsdRate
      ),
      pointsPerThousandUsd: undefined,
      dailyPoints: undefined,
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
    protocol: SimulationMetric;
    merit: SimulationMetric;
    merkl: SimulationMetric;
    brevis: SimulationMetric;
  };
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
  };
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
  reserveRateInput?: ReserveRateInput | null;
  isApy: boolean;
  includeWhitelistOnlyMerkl: boolean;
  tydroPointToUsdRate: number;
  tokenPrice?: number;
  supplyInput: string;
  borrowInput: string;
  inputMode?: ScenarioInputMode;
  forecastStates: Record<string, MerklForecastStateResponse>;
}

interface UseRateSimulationParams {
  reserve: ReserveWithSpread;
  isApy: boolean;
  includeWhitelistOnlyMerkl: boolean;
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
  includeWhitelistOnlyMerkl: boolean;
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
  includeWhitelistOnlyMerkl: boolean
): number => {
  const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  const protocol = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  return isApy
    ? calculateTotalIncentiveApy(merit, merkl, brevis, protocol, tydroPointToUsdRate, {
        includeWhitelistOnlyMerkl,
      })
    : calculateTotalIncentiveApr(merit, merkl, brevis, protocol, tydroPointToUsdRate, {
        includeWhitelistOnlyMerkl,
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

const sumForecastMeritValues = (values: MeritIncentive[] | undefined, isApy: boolean, inputUsd: number): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!isCampaignActive(value.startDate, value.endDate)) return sum;
    const aprPercent = forecastMeritAprPercent(value, inputUsd);
    if (aprPercent <= 0) return sum;
    return sum + (isApy ? convertAprToApy(aprPercent) : aprPercent);
  }, 0);
};

const sumBrevisValues = (values?: BrevisIncentive[], isApy = false): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!isCampaignActive(value.startDate, value.endDate)) return sum;
    const apr = sanitizePercent(value.apr);
    return sum + (isApy ? convertAprToApy(apr) : apr);
  }, 0);
};

const sumMerklValues = (
  opportunities: MerklOpportunityGroup[] | undefined,
  isApy: boolean,
  tydroPointToUsdRate: number,
  includeWhitelistOnlyMerkl: boolean
): number => {
  if (!opportunities || opportunities.length === 0) return 0;
  return opportunities.reduce((sum, opportunity) => {
    return (
      sum +
      (opportunity.breakdowns ?? []).reduce((breakdownSum, breakdown) => {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return breakdownSum;
        if (breakdown.whitelistOnly && !includeWhitelistOnlyMerkl) return breakdownSum;
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

const buildIncentiveAfter = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastStateResponse>,
  tydroPointToUsdRate: number,
  includeWhitelistOnlyMerkl: boolean
): number => {
  const merit = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merkl = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevis = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  const protocol = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  const forecastedMerkl = buildForecastMerklOpportunities({
    opportunities: merkl,
    inputUsd,
    forecastStates,
    includeWhitelistOnlyMerkl,
    tydroPointToUsdRate,
  });

  return (
    sumNumberArray(protocol, isApy) +
    sumForecastMeritValues(merit, isApy, inputUsd) +
    sumMerklValues(forecastedMerkl, isApy, tydroPointToUsdRate, includeWhitelistOnlyMerkl) +
    sumBrevisValues(brevis, isApy)
  );
};

const toDisplayNative = (rawApy: number | null | undefined, isApy: boolean): number | null => {
  if (rawApy === null || rawApy === undefined || !Number.isFinite(rawApy)) return null;
  return isApy ? rawApy : apyToApr(rawApy);
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
  includeWhitelistOnlyMerkl,
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
  const supplyInputUsd = inputMode === 'usd' ? rawSupply : (tokenPrice ? rawSupply * tokenPrice : 0);
  const borrowInputUsd = inputMode === 'usd' ? rawBorrow : (tokenPrice ? rawBorrow * tokenPrice : 0);

  const currentNativeSimulation = reserveRateInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: '0',
        borrowAmount: '0',
      })
    : null;

  const combinedNativeSimulation = reserveRateInput && hasAnyInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: String(supplyAmount),
        borrowAmount: String(borrowAmount),
      })
    : null;

  const supplyCurrentNative = toDisplayNative(reserve.supplyApy, isApy);
  const borrowCurrentNative = toDisplayNative(reserve.borrowApy, isApy);
  const supplyCurrentIncentive = buildIncentiveCurrent(
    reserve,
    'supply',
    isApy,
    tydroPointToUsdRate,
    includeWhitelistOnlyMerkl
  );
  const borrowCurrentIncentive = buildIncentiveCurrent(
    reserve,
    'borrow',
    isApy,
    tydroPointToUsdRate,
    includeWhitelistOnlyMerkl
  );

  const supplyCurrentTotal = isApy
    ? calculateTotalSupplyApy(reserve.supplyApy, supplyCurrentIncentive)
    : calculateTotalSupplyApr(reserve.supplyApy, supplyCurrentIncentive);
  const borrowCurrentTotal = isApy
    ? calculateTotalBorrowApy(reserve.borrowApy, borrowCurrentIncentive)
    : calculateTotalBorrowApr(reserve.borrowApy, borrowCurrentIncentive);

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

  const supplyAfterIncentive = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'supply',
        isApy,
        supplyInputUsd,
        forecastStates,
        tydroPointToUsdRate,
        includeWhitelistOnlyMerkl
      )
    : null;
  const borrowAfterIncentive = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'borrow',
        isApy,
        borrowInputUsd,
        forecastStates,
        tydroPointToUsdRate,
        includeWhitelistOnlyMerkl
      )
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
    merkl: sumMerklValues(reserve.merklSupplys, isApy, tydroPointToUsdRate, includeWhitelistOnlyMerkl),
    brevis: sumBrevisValues(reserve.brevisSupplys, isApy),
  };
  const borrowCurrentSources = {
    protocol: sumNumberArray(reserve.borrowIncentives, isApy),
    merit: sumMeritValues(reserve.meritBorrows, isApy),
    merkl: sumMerklValues(reserve.merklBorrows, isApy, tydroPointToUsdRate, includeWhitelistOnlyMerkl),
    brevis: sumBrevisValues(reserve.brevisBorrows, isApy),
  };

  const supplyAfterSources = hasAnyInput
    ? {
        protocol: supplyCurrentSources.protocol,
        merit: sumForecastMeritValues(reserve.meritSupplys, isApy, supplyInputUsd),
        merkl: sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklSupplys,
            inputUsd: supplyInputUsd,
            forecastStates,
            includeWhitelistOnlyMerkl,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          includeWhitelistOnlyMerkl
        ),
        brevis: supplyCurrentSources.brevis,
      }
    : null;

  const borrowAfterSources = hasAnyInput
    ? {
        protocol: borrowCurrentSources.protocol,
        merit: sumForecastMeritValues(reserve.meritBorrows, isApy, borrowInputUsd),
        merkl: sumMerklValues(
          buildForecastMerklOpportunities({
            opportunities: reserve.merklBorrows,
            inputUsd: borrowInputUsd,
            forecastStates,
            includeWhitelistOnlyMerkl,
            tydroPointToUsdRate,
          }),
          isApy,
          tydroPointToUsdRate,
          includeWhitelistOnlyMerkl
        ),
        brevis: borrowCurrentSources.brevis,
      }
    : null;

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
      protocol: buildMetric(supplyCurrentSources.protocol, supplyAfterSources?.protocol ?? null),
      merit: buildMetric(supplyCurrentSources.merit, supplyAfterSources?.merit ?? null),
      merkl: buildMetric(supplyCurrentSources.merkl, supplyAfterSources?.merkl ?? null),
      brevis: buildMetric(supplyCurrentSources.brevis, supplyAfterSources?.brevis ?? null),
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
      protocol: buildMetric(borrowCurrentSources.protocol, borrowAfterSources?.protocol ?? null),
      merit: buildMetric(borrowCurrentSources.merit, borrowAfterSources?.merit ?? null),
      merkl: buildMetric(borrowCurrentSources.merkl, borrowAfterSources?.merkl ?? null),
      brevis: buildMetric(borrowCurrentSources.brevis, borrowAfterSources?.brevis ?? null),
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
  const forecastUnavailableCampaignCount = hasAnyInput
    ? Array.from(
        new Set([
          ...collectActiveCampaignIds(reserve.merklSupplys),
          ...collectActiveCampaignIds(reserve.merklBorrows),
        ])
      ).filter((id) => !forecastStates[id]).length
    : 0;

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
    },
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
  includeWhitelistOnlyMerkl,
  tydroPointToUsdRate,
  tokenPrices,
  enabled = true,
  supplyInput,
  borrowInput,
  inputMode = 'token',
}: UseSharedRateSimulationsParams) => {
  const cachedEntry = getCachedRateInputsSnapshotEntry<RateInputsResponse>();
  const hasAnyInput = useMemo(() => parseNumberInput(supplyInput) > 0 || parseNumberInput(borrowInput) > 0, [borrowInput, supplyInput]);

  const rateInputsQuery = useQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    enabled: enabled && reserves.length > 0,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });

  const reserveRateInputsById = useMemo(() => {
    const map: Record<string, ReserveRateInput | null> = {};
    if (!rateInputsQuery.data) return map;

    reserves.forEach((reserve) => {
      map[getReserveSimulationId(reserve)] = findReserveRateInput(
        rateInputsQuery.data,
        reserve.chainId,
        reserve.tokenAddress,
        reserve.marketName
      );
    });

    return map;
  }, [rateInputsQuery.data, reserves]);

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
            (await resolveForecastTokenPriceWithBackup(buildPriceLookup(reserve, tokenPrices, 'Supply'))) ??
            (await resolveForecastTokenPriceWithBackup(buildPriceLookup(reserve, tokenPrices, 'Borrow')))
          );
        },
        enabled: enabled && hasAnyInput && localPrice === undefined,
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const tokenPriceById = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    reserves.forEach((reserve, index) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      map[getReserveSimulationId(reserve)] = localPrice ?? priceQueries[index]?.data;
    });
    return map;
  }, [priceQueries, reserves, tokenPrices]);

  const tokenPriceLoadingById = useMemo(() => {
    const map: Record<string, boolean> = {};
    reserves.forEach((reserve, index) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      map[getReserveSimulationId(reserve)] =
        localPrice === undefined && Boolean(priceQueries[index]?.isPending || priceQueries[index]?.isFetching);
    });
    return map;
  }, [priceQueries, reserves, tokenPrices]);

  const allCampaignIds = useMemo(() => {
    if (!enabled || !hasAnyInput) return [];
    return Array.from(
      new Set(
        reserves.flatMap((reserve) => [
          ...collectActiveCampaignIds(reserve.merklSupplys),
          ...collectActiveCampaignIds(reserve.merklBorrows),
        ])
      )
    ).sort();
  }, [enabled, hasAnyInput, reserves]);

  const forecastQuery = useQuery({
    queryKey: [...FORECAST_STATES_QUERY_KEY, ...allCampaignIds],
    queryFn: async () => {
      const result = await fetchMerklForecastStates(allCampaignIds);
      const states: Record<string, MerklForecastStateResponse> = {};
      const errors: Record<string, string> = {};
      result.items.forEach((item) => {
        states[item.campaignId] = item;
      });
      result.errors
        .filter((item) => shouldSurfaceForecastError(item))
        .forEach((item) => {
          errors[item.campaignId] = item.message;
        });
      return { states, errors };
    },
    enabled: enabled && allCampaignIds.length > 0,
    staleTime: 60 * 1000,
  });

  const forecastStates = useMemo(
    () => forecastQuery.data?.states ?? {},
    [forecastQuery.data?.states]
  );
  const forecastErrors = useMemo(
    () => forecastQuery.data?.errors ?? {},
    [forecastQuery.data?.errors]
  );

  const simulationsById = useMemo(() => {
    return reserves.reduce<Record<string, RateSimulationResult>>((acc, reserve) => {
      const reserveId = getReserveSimulationId(reserve);
      const reserveRateInput = reserveRateInputsById[reserveId] ?? null;
      acc[reserveId] = {
        ...buildRateSimulationResult({
          reserve,
          reserveRateInput,
          isApy,
          includeWhitelistOnlyMerkl,
          tydroPointToUsdRate,
          tokenPrice: tokenPriceById[reserveId],
          supplyInput,
          borrowInput,
          inputMode,
          forecastStates,
        }),
        tokenPriceLoading: tokenPriceLoadingById[reserveId] ?? false,
        reserveRateInputLoading: rateInputsQuery.isPending || rateInputsQuery.isFetching,
        reserveRateInputError: rateInputsQuery.error,
        forecastLoading: allCampaignIds.length > 0 && (forecastQuery.isPending || forecastQuery.isFetching),
        forecastErrors,
        hasRateInput: Boolean(reserveRateInput),
      };
      return acc;
    }, {});
  }, [
    allCampaignIds.length,
    borrowInput,
    forecastErrors,
    forecastQuery.isFetching,
    forecastQuery.isPending,
    forecastStates,
    includeWhitelistOnlyMerkl,
    inputMode,
    isApy,
    rateInputsQuery.error,
    rateInputsQuery.isFetching,
    rateInputsQuery.isPending,
    reserveRateInputsById,
    reserves,
    supplyInput,
    tokenPriceById,
    tokenPriceLoadingById,
    tydroPointToUsdRate,
  ]);

  return {
    hasAnyInput,
    simulationsById,
    rateInputsSnapshotLoading: rateInputsQuery.isPending || rateInputsQuery.isFetching,
    rateInputsSnapshotError: rateInputsQuery.error,
    forecastLoading: allCampaignIds.length > 0 && (forecastQuery.isPending || forecastQuery.isFetching),
    forecastErrors,
  };
};

export const useRateSimulation = ({
  reserve,
  isApy,
  includeWhitelistOnlyMerkl,
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
    includeWhitelistOnlyMerkl,
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
      includeWhitelistOnlyMerkl,
      tydroPointToUsdRate,
      tokenPrice: resolveLocalReserveTokenPrice(reserve, tokenPrices),
      supplyInput,
      borrowInput,
      forecastStates: {},
    })
  );
};
