import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { hasRateCalcFields } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { buildHubAggregationMap, getHubAssetKey, validateHubAggregateConsistency } from '@/lib/hubAggregation';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { parseNumberInput } from '@/lib/numberFormat';
import { resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import type {
  MerklForecastWireItem,
  ReserveWithSpread,
  TokenPricesIndex,
} from '@/types/aave';
import type { ReservePositions } from '@/lib/netLendingCrossReserve';
import type { PerReserveInput } from '@/lib/portfolioSimulator';
import { buildPointRateMap, type PointRateMap } from '@/lib/tydro';
import {
  buildRateSimulationResult,
  buildEmptyRateSimulationResult,
  buildPriceDataSignature,
  buildPriceLoadingSignature,
  buildPriceLookup,
  getReserveSimulationId,
  resolveLocalReserveTokenPrice,
  EMPTY_PRICE_LOADING_LIST,
  type RateSimulationResult,
  type ScenarioInputMode,
} from '@/lib/rateSimulationCalculator';

// Re-export all public types and pure functions so existing consumers
// importing from '@/hooks/useRateSimulation' continue to compile.
export {
  buildForecastMerklOpportunities,
  buildRateSimulationResult,
  getReserveSimulationId,
  buildPriceDataSignature,
  buildPriceLoadingSignature,
  type SimulationMetric,
  type SimulationCampaignDetail,
  type SimulationSourceDetail,
  type SimulationLane,
  type ScenarioUsdAccrualSide,
  type ScenarioUsdAccrual,
  type MarketMetrics,
  type RateSimulationComputedResult,
  type RateSimulationResult,
  type ScenarioInputMode,
} from '@/lib/rateSimulationCalculator';

const FORECAST_TOKEN_PRICE_QUERY_KEY = ['forecast-token-price'] as const;

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
  crossReservePositions?: Map<string, ReservePositions>;
  reserveSymbolById?: Map<string, string>;
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
  crossReservePositions?: Map<string, ReservePositions>;
  reserveSymbolById?: Map<string, string>;
  perReserveInputs?: Map<string, PerReserveInput>;
}

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
  crossReservePositions,
  reserveSymbolById,
  perReserveInputs,
}: UseSharedRateSimulationsParams) => {
  const pointRateMap = useMemo(() => buildPointRateMap(tydroPointToUsdRate), [tydroPointToUsdRate]);
  const hasPerReserveInput = useMemo(
    () =>
      perReserveInputs != null &&
      Array.from(perReserveInputs.values()).some(
        (v) => parseNumberInput(v.supplyInput) > 0 || parseNumberInput(v.borrowInput) > 0,
      ),
    [perReserveInputs],
  );
  const hasAnyInput = useMemo(
    () =>
      parseNumberInput(supplyInput) > 0 ||
      parseNumberInput(borrowInput) > 0 ||
      hasPerReserveInput,
    [borrowInput, supplyInput, hasPerReserveInput],
  );
  const needsTokenPrice = inputMode === 'token';

  const priceQueries = useQueries({
    queries: reserves.map((reserve) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      const reserveId = getReserveSimulationId(reserve);
      const perReserve = perReserveInputs?.get(reserveId);
      const reserveNeedsPrice =
        parseNumberInput(supplyInput) > 0 ||
        parseNumberInput(borrowInput) > 0 ||
        (perReserve != null &&
          (parseNumberInput(perReserve.supplyInput) > 0 || parseNumberInput(perReserve.borrowInput) > 0));
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
        // Per-reserve price query is enabled when either shared or per-reserve
        // input exists for that reserve, avoiding request storms when no input.
        enabled: enabled && reserveNeedsPrice && needsTokenPrice && localPrice === undefined,
        staleTime: QUERY_STALE_TIMES.default,
      };
    }),
  });

  // `useQueries` returns a fresh array reference every render even when the
  // underlying data is unchanged. Deriving stable structural signatures from
  // the actual data/loading values lets `tokenPriceById` /
  // `tokenPriceLoadingById` (and the downstream `simulationsById`) skip
  // rebuilding on background re-renders triggered by unrelated state, removing
  // a major source of ReservesTable re-render churn.
  // See `buildPriceDataSignature` / `buildPriceLoadingSignature` for the
  // collision-resistant signature contract (covered by unit tests).
  const priceDataKey = useMemo(
    () => buildPriceDataSignature(priceQueries),
    [priceQueries],
  );
  const priceLoadingKey = useMemo(
    () => buildPriceLoadingSignature(priceQueries, needsTokenPrice),
    [needsTokenPrice, priceQueries],
  );

  const tokenPriceById = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    reserves.forEach((reserve, index) => {
      const localPrice = resolveLocalReserveTokenPrice(reserve, tokenPrices);
      map[getReserveSimulationId(reserve)] = localPrice ?? priceQueries[index]?.data ?? undefined;
    });
    return map;
    // priceQueries is intentionally referenced via priceDataKey to avoid ref-only churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceDataKey, reserves, tokenPrices]);

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
    // priceQueries is intentionally referenced via priceLoadingKey to avoid ref-only churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTokenPrice, priceLoadingKey, reserves, tokenPrices]);

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

  const hubAggregationMap = useMemo(
    () => buildHubAggregationMap(reserves),
    [reserves]
  );

  if (import.meta.env.DEV) {
    const warnings = validateHubAggregateConsistency(reserves, hubAggregationMap);
    if (warnings.length > 0) {
      console.warn('[V4 HubAggregation] utilization mismatch:', warnings);
    }
  }

  const simulationsById = useMemo(() => {
    return reserves.reduce<Record<string, RateSimulationResult>>((acc, reserve) => {
      const reserveId = getReserveSimulationId(reserve);
      const perReserve = perReserveInputs?.get(reserveId);
      const effectiveSupplyInput = perReserve?.supplyInput ?? supplyInput;
      const effectiveBorrowInput = perReserve?.borrowInput ?? borrowInput;
      const effectiveInputMode = perReserve?.inputMode ?? inputMode;
      const reserveRateInput: RateCalcInput | null = hasRateCalcFields(reserve) ? { ...reserve } : null;
      let hubSupplied: string | undefined;
      let hubBorrowed: string | undefined;
      if (reserve.hubId) {
        const hubKey = getHubAssetKey(reserve);
        const hubAgg = hubKey ? hubAggregationMap.get(hubKey) : undefined;
        if (hubAgg) {
          hubSupplied = hubAgg.hubSupplied;
          hubBorrowed = hubAgg.hubBorrowed;
          if (reserveRateInput) {
            reserveRateInput.borrowed = hubAgg.hubBorrowed;
            reserveRateInput.hubBorrowed = hubAgg.hubBorrowed;
            reserveRateInput.hubSupplied = hubAgg.hubSupplied;
          }
        }
      }
      const hasEffectiveInput =
        parseNumberInput(effectiveSupplyInput) > 0 || parseNumberInput(effectiveBorrowInput) > 0;

      // totalSupplyUsd/totalBorrowUsd: total position (wallet + delta) for cap dilution & accrual.
      // In portfolio mode, perReserve carries the full position.
      // In single simulation mode (no perReserve), the input IS the total position
      // — there is no separate wallet, so total = delta = input.
      // The fallback is resolved HERE, not in buildRateSimulationResult, so the calculator
      // always receives an explicit total position (or undefined when no input).
      const effectiveTotalSupplyUsd = perReserve?.totalSupplyUsd;
      const effectiveTotalBorrowUsd = perReserve?.totalBorrowUsd;

      acc[reserveId] = {
        ...buildRateSimulationResult({
          reserve,
          reserveRateInput,
          isApy,
          whitelistMerklCampaignIds,
          tydroPointToUsdRate,
          tokenPrice: tokenPriceById[reserveId],
          supplyInput: effectiveSupplyInput,
          borrowInput: effectiveBorrowInput,
          inputMode: effectiveInputMode,
          forecastStates,
          meritMerklNetPosition,
          crossReservePositions,
          reserveSymbolById,
          hubSupplied,
          hubBorrowed,
          totalSupplyUsd: effectiveTotalSupplyUsd,
          totalBorrowUsd: effectiveTotalBorrowUsd,
          pointRateMap,
        }),
        tokenPriceLoading: tokenPriceLoadingById[reserveId] ?? false,
        forecastLoading: hasEffectiveInput && forecastLoading,
        forecastErrors,
      };
      return acc;
    }, {});
  }, [
    borrowInput,
    forecastErrors,
    forecastLoading,
    forecastStates,
    hubAggregationMap,
    whitelistMerklCampaignIds,
    inputMode,
    isApy,
    meritMerklNetPosition,
    perReserveInputs,
    reserves,
    supplyInput,
    tokenPriceById,
    tokenPriceLoadingById,
    tydroPointToUsdRate,
    pointRateMap,
    crossReservePositions,
    reserveSymbolById,
  ]);

  return {
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
  crossReservePositions,
  reserveSymbolById,
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
    crossReservePositions,
    reserveSymbolById,
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
