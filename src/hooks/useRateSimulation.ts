import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import {
  apyToApr,
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
import { forecastWithTVL } from '@/lib/merklForecast';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
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
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
}

const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

const forecastBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastStateResponse>,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number
): number => {
  const currentApr = sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
  if (inputUsd <= 0) return currentApr;
  if (!isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds)) return currentApr;
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
  forecastStates: Record<string, MerklForecastStateResponse>;
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

const buildIncentiveAfter = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastStateResponse>,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined
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
    sumForecastMeritValues(merit, isApy, inputUsd) +
    sumMerklValues(forecastedMerkl, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds) +
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

  const supplyCurrentNative = toDisplayNative(reserve.supplyApy, isApy);
  const borrowCurrentNative = toDisplayNative(reserve.borrowApy, isApy);
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

  const supplyAfterIncentiveRaw = hasAnyInput
    ? buildIncentiveAfter(
        reserve,
        'supply',
        isApy,
        supplyInputUsd,
        forecastStates,
        tydroPointToUsdRate,
        whitelistMerklCampaignIds
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
        whitelistMerklCampaignIds
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
        return {
          protocol: supplyCurrentSources.protocol,
          merit: Math.min(meritAfterRaw, supplyCurrentSources.merit),
          merkl: Math.min(merklAfterRaw, supplyCurrentSources.merkl),
          brevis: supplyCurrentSources.brevis,
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
        return {
          protocol: borrowCurrentSources.protocol,
          merit: Math.min(meritAfterRaw, borrowCurrentSources.merit),
          merkl: Math.min(merklAfterRaw, borrowCurrentSources.merkl),
          brevis: borrowCurrentSources.brevis,
        };
      })()
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

    const states: Record<string, MerklForecastStateResponse> = {};
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
