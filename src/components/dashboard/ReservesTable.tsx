import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ReservesTableShowMore, ReservesTableFloatingScroll } from './ReservesTablePagination';
import { Table, TableBody } from '@/components/ui/table';
import { ReserveWithSpread, TokenPricesIndex, MerklForecastWireItem } from '@/types/aave';
import {
  formatPercent,
  formatSpread,
  formatUsd,
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  getReserveIncentiveValues,
  resolveVisibleIncentiveBadgeValue,
} from '@/lib/formatters';
import ScenarioControls, { type ScenarioControlsHandle } from './ScenarioControls';
import { compareIncentiveWithNative } from '@/lib/sorters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { buildAaveUrl } from '@/lib/aaveLinks';
import { openExternalUrl } from '@/lib/externalNavigation';
import { calculateDeficitShareRatio, getReserveDeficitUsdAmount } from '@/lib/deficit';
import { getReserveKey } from '@/lib/reserveKey';
import ReservesTableTooltipOverlay, { type TooltipState } from './ReservesTableTooltipOverlay';
import DesktopReserveRow from './DesktopReserveRow';
import ReservesTableDesktopHeader from './ReservesTableDesktopHeader';
import ReservesTableMobileGrid from './ReservesTableMobileGrid';
import ReservesTableMobileSortBar, {
  type MobileSortOption,
} from './ReservesTableMobileSortBar';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useReservesTableSort,
  selectSortOption,
  toggleSortOrder,
  toggleSortOrderAscFirst,
  type SortMode,
  type SortableColumn,
} from '@/hooks/reserves-table/useReservesTableSort';
import {
  useReservesPagination,
  DEFAULT_VISIBLE_COUNT,
} from '@/hooks/reserves-table/useReservesPagination';
import { useReserveExpansion } from '@/hooks/reserves-table/useReserveExpansion';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getDisplayAvailableLiquidityUsd as computeDisplayAvailableLiquidityUsd, getDisplayTotalBorrowedUsd as computeDisplayTotalBorrowedUsd, getAvailableToBorrowUsd, nativeToUsd, getSuppliableUsd, getBorrowableUsd, getScenarioSupplySizeUsd } from '@/lib/scenarioSize';
import { getProtocolVersion } from '@/lib/protocolVersion';
import {
  scrollExpandedSimulationIntoView,
  shouldScrollExpandedSimulationIntoView,
} from '@/lib/scrollExpandedSimulationIntoView';
import { createScenarioPinControllerState, transitionScenarioPinController } from '@/lib/scenarioPinController';
import ReservesTableDesktopSkeleton from './ReservesTableDesktopSkeleton';

import PortfolioModeToggle, { type SimulationMode } from './PortfolioModeToggle';
import type { PortfolioPosition, PortfolioPositionResult, PortfolioSummary } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import { resolvePositionAmountUsd, buildPortfolioPositionResult } from '@/hooks/usePortfolioSimulation';
import { aggregatePortfolioSummary } from '@/lib/portfolioCalculator';
import PortfolioPanel from './PortfolioPanel';
import PortfolioPanelSkeleton from './PortfolioPanelSkeleton';

interface ReservesTableProps {
  reserves: ReserveWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
  isLoading?: boolean;
  onSelectMarket?: (marketName: string) => void;
  onSelectHub?: (hubName: string) => void;
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  tokenPrices?: TokenPricesIndex;
  scrollToReserveId?: string | null;
  /** Portfolio simulation mode. */
  simulationMode?: SimulationMode;
  onSimulationModeChange?: (mode: SimulationMode) => void;
  portfolioPositions?: PortfolioPosition[];
  portfolioActions?: PortfolioSimulationActions;
  portfolioSnapshots?: import('@/types/portfolio').PortfolioSnapshot[];
  onRefresh?: () => Promise<void>;
  dataUpdatedAt?: number;
  topOppsRef?: React.RefObject<HTMLDivElement | null>;
}

// Stable sentinel used as a gate dependency for `sortedData` when the active
// sort column does not read simulation values. Sharing one frozen reference
// across renders lets `useMemo` skip recomputing on simulation churn.
const EMPTY_SIMULATIONS_GATE: Readonly<Record<string, unknown>> = Object.freeze({});

const ReservesTable = ({
  reserves,
  sortField,
  sortOrder,
  onSort,
  isApy,
  isLoading,
  onSelectMarket,
  onSelectHub,
  tydroPointToUsdRate,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
  tokenPrices,
  scrollToReserveId,
  simulationMode = 'single',
  onSimulationModeChange,
  portfolioPositions,
  portfolioActions,
  portfolioSnapshots,
  onRefresh,
  dataUpdatedAt,
  topOppsRef,
}: ReservesTableProps) => {
  const isMobile = useIsMobile();

  // Extract forecastStates from side-data (React Query cache — no extra fetch).
  const sideDataMetaQuery = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);
  const forecastStates = useMemo<Record<string, MerklForecastWireItem>>(() => {
    const forecast = sideDataMetaQuery.data?.forecast;
    if (!forecast) return {};
    const states: Record<string, MerklForecastWireItem> = {};
    forecast.items.forEach((item) => { states[item.campaignId] = item; });
    return states;
  }, [sideDataMetaQuery.data?.forecast]);

  const scenarioControlsRef = useRef<ScenarioControlsHandle>(null);
  const scenarioPinControllerRef = useRef(createScenarioPinControllerState());
  const scenarioPinScheduleTokenRef = useRef(0);
  const cancelScenarioPinScrollRef = useRef<(() => void) | null>(null);
  const lastReservesKeyForFilterPinRef = useRef<string | null>(null);
  const cancelFilterPinScrollRef = useRef<(() => void) | null>(null);
  const pendingMarketFilterPinReserveIdRef = useRef<string | null>(null);
  const {
    expandedReserveId,
    setExpandedReserveId,
    collapseExpanded: collapseExpandedOnSort,
    handleToggleExpand,
    suppressNextToggleReserveIdRef,
  } = useReserveExpansion({ isMobile });
  const [debouncedSharedSupplyInput, setDebouncedSharedSupplyInput] = useState('');
  const [debouncedSharedBorrowInput, setDebouncedSharedBorrowInput] = useState('');
  const [sharedInputMode, setSharedInputMode] = useState<import('@/hooks/useRateSimulation').ScenarioInputMode>('usd');
  const [meritMerklNetPosition, setMeritMerklNetPosition] = useState(true);
  const [mobileNetOpen, setMobileNetOpen] = useState(false);
  const handleMobileNetToggle = useCallback(() => setMobileNetOpen(prev => !prev), []);
  const handleScenarioChange = useCallback((supply: string, borrow: string, mode: import('@/components/dashboard/ScenarioControls').ScenarioInputMode) => {
    setDebouncedSharedSupplyInput(supply);
    setDebouncedSharedBorrowInput(borrow);
    setSharedInputMode(mode);
  }, []);

  const handleCorrectSupplyInput = useCallback((correctedValue: string) => {
    scenarioControlsRef.current?.setSupplyInput(correctedValue);
  }, []);

  const handleCorrectBorrowInput = useCallback((correctedValue: string) => {
    scenarioControlsRef.current?.setBorrowInput(correctedValue);
  }, []);

  const sortState = useReservesTableSort({ collapseExpanded: collapseExpandedOnSort });
  const {
    activeSortColumn,
    setActiveSortColumn,
    tokenSortOrder,
    marketSortOrder,
    priceSortOrder,
    sizeSortMode,
    setSizeSortMode,
    sizeSortOrder,
    utilSortOrder,
    utilSortMode,
    setUtilSortMode,
    supplySortMode,
    setSupplySortMode,
    supplySortOrder,
    borrowSortMode,
    setBorrowSortMode,
    borrowSortOrder,
    spreadSortOrder,
    showUtilSortMenu,
    setShowUtilSortMenu,
    utilSortButtonRef,
    utilMenuPos,
    showSizeSortMenu,
    setShowSizeSortMenu,
    sizeSortButtonRef,
    sizeMenuPos,
    showSupplySortMenu,
    setShowSupplySortMenu,
    supplySortButtonRef,
    supplyMenuPos,
    showBorrowSortMenu,
    setShowBorrowSortMenu,
    borrowSortButtonRef,
    borrowMenuPos,
    showExtraSortMenu,
    setShowExtraSortMenu,
    handleSortToken,
    handleSortMarket,
    handleSortPrice,
    handleSortSize,
    handleSortUtil,
    toggleSupplySortOrder,
    toggleBorrowSortOrder,
    toggleSpreadSortOrder,
    closeAllMobileSortMenus,
    toggleMobileSortMenu,
  } = sortState;

  const handleMarketChipClick = useCallback((reserveId: string) => {
    // Preserve an already-expanded row across filter updates, but do not
    // implicitly expand a collapsed row just because its market chip was clicked.
    // The chip stops propagation, so row expansion stays an explicit action.
    const shouldKeepExpanded = expandedReserveId === reserveId;
    pendingMarketFilterPinReserveIdRef.current = shouldKeepExpanded ? reserveId : null;
    if (shouldKeepExpanded) {
      setExpandedReserveId(reserveId);
    }
  }, [expandedReserveId, setExpandedReserveId]);

  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  const { simulationsById, hasAnyInput: hasSharedScenario } = useSharedRateSimulations({
    reserves,
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    tokenPrices,
    supplyInput: debouncedSharedSupplyInput,
    borrowInput: debouncedSharedBorrowInput,
    inputMode: sharedInputMode,
    meritMerklNetPosition,
  });

  /** Scroll-on-expand only when list order can change with shared scenario (matches `pickScenarioValue` / size supply USD). */
  const expandScrollFollowsScenarioSort = useMemo(() => {
    if (!hasSharedScenario) return false;
    const col = activeSortColumn ?? 'supply';
    if (col === 'token' || col === 'market' || col === 'price') return false;
    if (col === 'size' && sizeSortMode !== 'supply') return false;
    return true;
  }, [hasSharedScenario, activeSortColumn, sizeSortMode]);

  const schedulePinScrollToReserve = useCallback((reserveId: string, delayMs: number, opts?: { instant?: boolean; onSettled?: () => void }) => {
    const mode = isMobile ? 'minimal-if-clipped' : 'pin-main-row-top';
    const instant = opts?.instant ?? false;
    const escapeId = (raw: string) => (
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(raw) : raw
    );
    const escapedId = escapeId(reserveId);

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 12;
    const retryMs = 70;
    let finalized = false;

    const finalizeAttempt = () => {
      if (finalized) return;
      finalized = true;
      opts?.onSettled?.();
    };

    const runAttempt = () => {
      if (cancelled) return;
      const anchor = document.querySelector(`[data-reserve-expanded-anchor="${escapedId}"]`);
      const row = document.querySelector(`tr[data-reserve-id="${escapedId}"]`);
      if (anchor instanceof HTMLElement || row instanceof HTMLElement) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cancelled) return;
            // Keep pin-scroll deterministic: one primary pass + at most one
            // follow-up correction after layout settles. Repeated corrections
            // create visible "stair-step" jank on long pages.
            if (!shouldScrollExpandedSimulationIntoView(reserveId, { mode })) {
              finalizeAttempt();
              return;
            }
            scrollExpandedSimulationIntoView(reserveId, {
              mode,
              instant,
            });
            finalizeAttempt();
          });
        });
        return;
      }
      attempt += 1;
      if (attempt >= maxAttempts) {
        finalizeAttempt();
        return;
      }
      window.setTimeout(runAttempt, retryMs);
    };

    const starter = window.setTimeout(runAttempt, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(starter);
      finalizeAttempt();
    };
  }, [isMobile]);

  // Helper: Get incentive values for a reserve (supply or borrow).
  // `forecastStates` is included here so the fallback path (used when
  // `simulationsById` is the stable empty object — i.e. no scenario input)
  // matches the previous behavior of `buildIncentiveCurrent`, which always
  // factored Merkl forecast adjustments into "current" incentive values.
  const getIncentiveValues = (reserve: ReserveWithSpread, type: 'supply' | 'borrow') =>
    getReserveIncentiveValues(reserve, type, tydroPointToUsdRate, { whitelistMerklCampaignIds, forecastStates });

  // Calculate totals for a reserve (frontend calculates incentive totals from details)
  const getTotalSupplyApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApy(reserve.supplyApy, getIncentiveValues(reserve, 'supply').apy);
  };

  const getTotalSupplyApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApr(reserve.supplyApy ?? null, getIncentiveValues(reserve, 'supply').apr);
  };

  const getTotalBorrowApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApy(reserve.borrowApy, getIncentiveValues(reserve, 'borrow').apy);
  };

  const getTotalBorrowApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApr(reserve.borrowApy ?? null, getIncentiveValues(reserve, 'borrow').apr);
  };

  // Calculate native values (already in percentage form, number type)
  const getNativeSupplyApy = (reserve: ReserveWithSpread): number | null => {
    return reserve.supplyApy ?? null;
  };

  const getNativeBorrowApy = (reserve: ReserveWithSpread): number | null => {
    return reserve.borrowApy ?? null;
  };

  // Calculate spread for a reserve
  const getSpread = (reserve: ReserveWithSpread): number | null => {
    const totalSupplyApy = isApy ? getTotalSupplyApy(reserve) : getTotalSupplyApr(reserve);
    const totalBorrowApy = isApy ? getTotalBorrowApy(reserve) : getTotalBorrowApr(reserve);
    if (totalSupplyApy === null || totalBorrowApy === null) return null;
    return totalSupplyApy - totalBorrowApy;
  };

  const getSimulation = (reserve: ReserveWithSpread) => simulationsById[getReserveSimulationId(reserve)];

  const pickScenarioValue = (current: number | null, after: number | null): number | null =>
    hasSharedScenario ? after ?? current : current;

  const getDisplaySupplyTotal = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return isApy ? getTotalSupplyApy(reserve) : getTotalSupplyApr(reserve);
    return pickScenarioValue(simulation.supply.currentTotal, simulation.supply.afterTotal);
  };

  const getDisplayBorrowTotal = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return isApy ? getTotalBorrowApy(reserve) : getTotalBorrowApr(reserve);
    return pickScenarioValue(simulation.borrow.currentTotal, simulation.borrow.afterTotal);
  };

  const getDisplaySupplyNative = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return getNativeSupplyApy(reserve);
    }
    return pickScenarioValue(simulation.supply.currentNative, simulation.supply.afterNative);
  };

  const getDisplayBorrowNative = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return getNativeBorrowApy(reserve);
    }
    return pickScenarioValue(simulation.borrow.currentNative, simulation.borrow.afterNative);
  };

  const getDisplaySupplyIncentive = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return isApy ? getIncentiveValues(reserve, 'supply').apy : getIncentiveValues(reserve, 'supply').apr;
    }
    return pickScenarioValue(simulation.supply.currentIncentive, simulation.supply.afterIncentive);
  };

  const hasSupplyIncentiveSource = (reserve: ReserveWithSpread): boolean => {
    const simulation = getSimulation(reserve);
    if (simulation) return simulation.supply.currentIncentive > 0;
    return getIncentiveValues(reserve, 'supply').apy > 0;
  };

  const getDisplayBorrowIncentive = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return isApy ? getIncentiveValues(reserve, 'borrow').apy : getIncentiveValues(reserve, 'borrow').apr;
    }
    return pickScenarioValue(simulation.borrow.currentIncentive, simulation.borrow.afterIncentive);
  };

  const hasBorrowIncentiveSource = (reserve: ReserveWithSpread): boolean => {
    const simulation = getSimulation(reserve);
    if (simulation) return simulation.borrow.currentIncentive > 0;
    return getIncentiveValues(reserve, 'borrow').apy > 0;
  };

  const getDisplaySpread = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return getSpread(reserve);
    return pickScenarioValue(simulation.spread.current, simulation.spread.after);
  };

  const getDisplayUtilization = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return reserve.utilizationPct ?? null;
    const baseUtilization = reserve.utilizationPct ?? simulation.utilization.current ?? null;
    return pickScenarioValue(baseUtilization, simulation.utilization.after);
  };

  const getDisplayReserveSizeUsd = (reserve: ReserveWithSpread): number | null => {
    const usd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
    if (usd == null || !Number.isFinite(usd)) return usd ?? null;
    return getScenarioSupplySizeUsd({
      reserveSizeUsd: usd,
      supplyCapUsd: nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice),
      rawSupplyInput: debouncedSharedSupplyInput,
      inputMode: sharedInputMode,
      tokenPrice: getSimulation(reserve)?.tokenPrice ?? reserve.tokenPrice,
    });
  };

  const getTotalBorrowedUsd = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    return simulation?.marketMetrics.totalBorrowedUsd ?? computeDisplayTotalBorrowedUsd(reserve, getProtocolVersion(reserve.marketName));
  };

  const getDisplayLiquidityUsd = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    return simulation?.marketMetrics.availableLiquidityUsd ?? computeDisplayAvailableLiquidityUsd(reserve, getProtocolVersion(reserve.marketName));
  };

  const getDisplaySupplyAvailabilityUsd = (reserve: ReserveWithSpread): number | null => {
    return getSuppliableUsd(reserve);
  };

  const getDisplayAvailableToBorrowUsd = (reserve: ReserveWithSpread): number | null => {
    return getBorrowableUsd(reserve);
  };

  const getDisplayDeficit = (reserve: ReserveWithSpread): number | null => {
    const tokenPrice = getSimulation(reserve)?.tokenPrice ?? reserve.tokenPrice;
    return getReserveDeficitUsdAmount(reserve, tokenPrice);
  };

  const getDisplayDeficitRatio = (reserve: ReserveWithSpread): number | null => {
    return calculateDeficitShareRatio({
      deficitUsd: getDisplayDeficit(reserve),
      totalSuppliedUsd: getDisplayReserveSizeUsd(reserve),
    });
  };

  // Token/market/price sort bodies never read `simulation` — they only compare
  // raw reserve fields. Gating the simulation dep behind the active sort column
  // prevents background simulation churn (e.g. price-query refreshes during an
  // open scenario) from triggering a needless full re-sort + table re-render
  // when the user is sorting alphabetically or by raw price.
  const sortNeedsSimulation = useMemo(() => {
    const col = activeSortColumn ?? 'supply';
    return col !== 'token' && col !== 'market' && col !== 'price';
  }, [activeSortColumn]);
  const sortedDataSimGate = sortNeedsSimulation ? simulationsById : EMPTY_SIMULATIONS_GATE;

  // Sort data based on active column and its sort mode
  const sortedData = useMemo(() => {
    return [...reserves].sort((a, b) => {
      let comparison: number;

      // Default to supply total desc when no column is selected
      const sortColumn = activeSortColumn ?? 'supply';

      if (sortColumn === 'token') {
        const order = tokenSortOrder === 'asc' ? 1 : -1;
        const byToken = a.tokenSymbol.localeCompare(b.tokenSymbol, undefined, { sensitivity: 'base' });
        if (byToken !== 0) return order * byToken;
        const byMarket = a.marketName.localeCompare(b.marketName, undefined, { sensitivity: 'base' });
        if (byMarket !== 0) return order * byMarket;
        return order * a.reserveId.localeCompare(b.reserveId);
      }
      if (sortColumn === 'market') {
        const order = marketSortOrder === 'asc' ? 1 : -1;
        const byMarket = a.marketName.localeCompare(b.marketName, undefined, { sensitivity: 'base' });
        if (byMarket !== 0) return order * byMarket;
        const byToken = a.tokenSymbol.localeCompare(b.tokenSymbol, undefined, { sensitivity: 'base' });
        if (byToken !== 0) return order * byToken;
        return order * a.reserveId.localeCompare(b.reserveId);
      }
      if (sortColumn === 'price') {
        const aP = a.tokenPrice ?? -Infinity;
        const bP = b.tokenPrice ?? -Infinity;
        comparison = aP - bP;
        if (comparison !== 0) return priceSortOrder === 'desc' ? -comparison : comparison;
        return a.reserveId.localeCompare(b.reserveId);
      }
      if (sortColumn === 'size') {
        if (sizeSortMode === 'borrow') {
          const aT = getTotalBorrowedUsd(a) ?? -Infinity;
          const bT = getTotalBorrowedUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'borrowAvailability') {
          const aT = getDisplayAvailableToBorrowUsd(a) ?? -Infinity;
          const bT = getDisplayAvailableToBorrowUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'supplyAvailability') {
          const aT = getDisplaySupplyAvailabilityUsd(a) ?? -Infinity;
          const bT = getDisplaySupplyAvailabilityUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'deficitRatio') {
          const aT = getDisplayDeficitRatio(a) ?? -Infinity;
          const bT = getDisplayDeficitRatio(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'deficitAmount') {
          const aT = getDisplayDeficit(a) ?? -Infinity;
          const bT = getDisplayDeficit(b) ?? -Infinity;
          comparison = aT - bT;
        } else {
          const aT = getDisplayReserveSizeUsd(a) ?? -Infinity;
          const bT = getDisplayReserveSizeUsd(b) ?? -Infinity;
          comparison = aT - bT;
        }
        if (comparison !== 0) return sizeSortOrder === 'desc' ? -comparison : comparison;
        return a.reserveId.localeCompare(b.reserveId);
      }
      if (sortColumn === 'util') {
        if (utilSortMode === 'liquidity') {
          const aL = getDisplayLiquidityUsd(a) ?? -Infinity;
          const bL = getDisplayLiquidityUsd(b) ?? -Infinity;
          comparison = aL - bL;
        } else {
          const aU = getDisplayUtilization(a) ?? -Infinity;
          const bU = getDisplayUtilization(b) ?? -Infinity;
          comparison = aU - bU;
        }
        if (comparison !== 0) return utilSortOrder === 'desc' ? -comparison : comparison;
        return a.reserveId.localeCompare(b.reserveId);
      }

      if (sortColumn === 'supply') {
        // Supply sorting
        if (supplySortMode === 'native') {
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          if (aNative === null && bNative === null) return a.reserveId.localeCompare(b.reserveId);
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (supplySortMode === 'incentive') {
          const aIncentive = getDisplaySupplyIncentive(a);
          const bIncentive = getDisplaySupplyIncentive(b);
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          const aHasIncentiveSource = hasSupplyIncentiveSource(a);
          const bHasIncentiveSource = hasSupplyIncentiveSource(b);
          const result = compareIncentiveWithNative(
            aIncentive,
            bIncentive,
            aNative,
            bNative,
            supplySortOrder,
            aHasIncentiveSource,
            bHasIncentiveSource,
          );
          if (result !== 0) return result;
          return a.reserveId.localeCompare(b.reserveId);
        } else {
          // Total sorting - use totalSupplyApy (Native + Incentive)
          const aTotal = getDisplaySupplyTotal(a);
          const bTotal = getDisplaySupplyTotal(b);
          if (aTotal === null && bTotal === null) return a.reserveId.localeCompare(b.reserveId);
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        if (comparison !== 0) return supplySortOrder === 'desc' ? comparison : -comparison;
        return a.reserveId.localeCompare(b.reserveId);
      } else if (sortColumn === 'borrow') {
        // Borrow sorting
        if (borrowSortMode === 'native') {
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          if (aNative === null && bNative === null) return a.reserveId.localeCompare(b.reserveId);
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (borrowSortMode === 'incentive') {
          const aIncentive = getDisplayBorrowIncentive(a);
          const bIncentive = getDisplayBorrowIncentive(b);
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          const aHasIncentiveSource = hasBorrowIncentiveSource(a);
          const bHasIncentiveSource = hasBorrowIncentiveSource(b);
          const result = compareIncentiveWithNative(
            aIncentive,
            bIncentive,
            aNative,
            bNative,
            borrowSortOrder,
            aHasIncentiveSource,
            bHasIncentiveSource,
          );
          if (result !== 0) return result;
          return a.reserveId.localeCompare(b.reserveId);
        } else {
          // Total sorting
          const aTotal = getDisplayBorrowTotal(a);
          const bTotal = getDisplayBorrowTotal(b);
          if (aTotal === null && bTotal === null) return a.reserveId.localeCompare(b.reserveId);
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        if (comparison !== 0) return borrowSortOrder === 'desc' ? comparison : -comparison;
        return a.reserveId.localeCompare(b.reserveId);
      } else {
        // Spread sorting (or default when activeSortColumn is null)
        const aSpread = getDisplaySpread(a);
        const bSpread = getDisplaySpread(b);
        if (aSpread === null && bSpread === null) return a.reserveId.localeCompare(b.reserveId);
        if (aSpread === null) return 1;
        if (bSpread === null) return -1;
        comparison = bSpread - aSpread;
        if (comparison !== 0) return spreadSortOrder === 'desc' ? comparison : -comparison;
        return a.reserveId.localeCompare(b.reserveId);
      }
      if (sortColumn === 'size') {
        if (sizeSortMode === 'borrow') {
          const aT = getTotalBorrowedUsd(a) ?? -Infinity;
          const bT = getTotalBorrowedUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'borrowAvailability') {
          const aT = getDisplayAvailableToBorrowUsd(a) ?? -Infinity;
          const bT = getDisplayAvailableToBorrowUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'supplyAvailability') {
          const aT = getDisplaySupplyAvailabilityUsd(a) ?? -Infinity;
          const bT = getDisplaySupplyAvailabilityUsd(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'deficitRatio') {
          const aT = getDisplayDeficitRatio(a) ?? -Infinity;
          const bT = getDisplayDeficitRatio(b) ?? -Infinity;
          comparison = aT - bT;
        } else if (sizeSortMode === 'deficitAmount') {
          const aT = getDisplayDeficit(a) ?? -Infinity;
          const bT = getDisplayDeficit(b) ?? -Infinity;
          comparison = aT - bT;
        } else {
          const aT = getDisplayReserveSizeUsd(a) ?? -Infinity;
          const bT = getDisplayReserveSizeUsd(b) ?? -Infinity;
          comparison = aT - bT;
        }
        return sizeSortOrder === 'desc' ? -comparison : comparison;
      }
      if (sortColumn === 'util') {
        if (utilSortMode === 'liquidity') {
          const aL = getDisplayLiquidityUsd(a) ?? -Infinity;
          const bL = getDisplayLiquidityUsd(b) ?? -Infinity;
          comparison = aL - bL;
        } else {
          const aU = getDisplayUtilization(a) ?? -Infinity;
          const bU = getDisplayUtilization(b) ?? -Infinity;
          comparison = aU - bU;
        }
        return utilSortOrder === 'desc' ? -comparison : comparison;
      }

      if (sortColumn === 'supply') {
        // Supply sorting
        if (supplySortMode === 'native') {
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          if (aNative === null && bNative === null) return 0;
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (supplySortMode === 'incentive') {
          const aIncentive = getDisplaySupplyIncentive(a);
          const bIncentive = getDisplaySupplyIncentive(b);
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          const aHasIncentiveSource = hasSupplyIncentiveSource(a);
          const bHasIncentiveSource = hasSupplyIncentiveSource(b);
          return compareIncentiveWithNative(
            aIncentive,
            bIncentive,
            aNative,
            bNative,
            supplySortOrder,
            aHasIncentiveSource,
            bHasIncentiveSource,
          );
        } else {
          // Total sorting - use totalSupplyApy (Native + Incentive)
          const aTotal = getDisplaySupplyTotal(a);
          const bTotal = getDisplaySupplyTotal(b);
          if (aTotal === null && bTotal === null) return 0;
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        return supplySortOrder === 'desc' ? comparison : -comparison;
      } else if (sortColumn === 'borrow') {
        // Borrow sorting
        if (borrowSortMode === 'native') {
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          if (aNative === null && bNative === null) return 0;
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (borrowSortMode === 'incentive') {
          const aIncentive = getDisplayBorrowIncentive(a);
          const bIncentive = getDisplayBorrowIncentive(b);
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          const aHasIncentiveSource = hasBorrowIncentiveSource(a);
          const bHasIncentiveSource = hasBorrowIncentiveSource(b);
          return compareIncentiveWithNative(
            aIncentive,
            bIncentive,
            aNative,
            bNative,
            borrowSortOrder,
            aHasIncentiveSource,
            bHasIncentiveSource,
          );
        } else {
          // Total sorting
          const aTotal = getDisplayBorrowTotal(a);
          const bTotal = getDisplayBorrowTotal(b);
          if (aTotal === null && bTotal === null) return 0;
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        return borrowSortOrder === 'desc' ? comparison : -comparison;
      } else {
        // Spread sorting (or default when activeSortColumn is null)
        const aSpread = getDisplaySpread(a);
        const bSpread = getDisplaySpread(b);
        if (aSpread === null && bSpread === null) return 0;
        if (aSpread === null) return 1;
        if (bSpread === null) return -1;
        comparison = bSpread - aSpread;
        return spreadSortOrder === 'desc' ? comparison : -comparison;
      }
    });
  // sortedDataSimGate replaces a raw `simulationsById` dep so token/market/price
  // sorts (which never touch simulation) skip needless re-sorts when background
  // sim/price queries resolve. Other deps preserved verbatim from original.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserves, activeSortColumn, tokenSortOrder, marketSortOrder, priceSortOrder, sizeSortMode, sizeSortOrder, utilSortMode, utilSortOrder, supplySortMode, supplySortOrder, borrowSortMode, borrowSortOrder, spreadSortOrder, sortedDataSimGate, hasSharedScenario, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, debouncedSharedSupplyInput, debouncedSharedBorrowInput, sharedInputMode, meritMerklNetPosition]);

  const {
    displayData,
    showAll,
    minVisibleCount,
    showAllRows,
    resetVisibleCount,
  } = useReservesPagination({ sortedData, scrollToReserveId, expandedReserveId });

  /**
   * Simulation pin scroll — normative spec + implementation steps:
   * `docs/design/frontend-interaction-guardrails.md` § "Simulation pin scroll".
   * Do not move to `expandedReserveId`-only effects or index-based scroll without updating that doc.
   */
  useEffect(() => {
    const scenarioKey = `${debouncedSharedSupplyInput}\0${debouncedSharedBorrowInput}\0${sharedInputMode}\0${meritMerklNetPosition ? '1' : '0'}`;
    const ids = sortedData.map((r) => getReserveSimulationId(r));
    const expandedIndex = expandedReserveId
      ? sortedData.findIndex((r) => getReserveSimulationId(r) === expandedReserveId)
      : -1;
    const currentCount = minVisibleCount ?? DEFAULT_VISIBLE_COUNT;
    const requiredCount =
      expandedIndex >= 0 ? Math.min(expandedIndex + 6, sortedData.length) : 0;
    const hasRequiredVisibleCount =
      expandedIndex >= 0 ? currentCount >= requiredCount : false;

    const controllerResult = transitionScenarioPinController(
      scenarioPinControllerRef.current,
      {
        scenarioKey,
        sortedIds: ids,
        expandedReserveId,
        hasScenarioInput: hasSharedScenario,
        expandScrollFollowsScenarioSort,
        hasRequiredVisibleCount,
        isExpandedStillVisible: expandedIndex >= 0,
      },
    );
    scenarioPinControllerRef.current = controllerResult.nextState;

    if (!controllerResult.shouldSchedulePin || !controllerResult.pinReserveId) return;

    cancelFilterPinScrollRef.current?.();
    cancelFilterPinScrollRef.current = null;
    cancelScenarioPinScrollRef.current?.();
    const scheduleToken = scenarioPinScheduleTokenRef.current + 1;
    scenarioPinScheduleTokenRef.current = scheduleToken;
    cancelScenarioPinScrollRef.current = schedulePinScrollToReserve(
      controllerResult.pinReserveId,
      320,
      {
        // Keep first pass smooth; follow-up corrections (if any) remain instant.
        instant: false,
        onSettled: () => {
          if (scenarioPinScheduleTokenRef.current !== scheduleToken) return;
          cancelScenarioPinScrollRef.current = null;
        },
      },
    ) ?? null;
  }, [
    debouncedSharedSupplyInput,
    debouncedSharedBorrowInput,
    sharedInputMode,
    meritMerklNetPosition,
    sortedData,
    expandedReserveId,
    minVisibleCount,
    hasSharedScenario,
    expandScrollFollowsScenarioSort,
    schedulePinScrollToReserve,
  ]);

  useEffect(() => {
    const reservesKey = reserves.map((r) => getReserveSimulationId(r)).join('\0');
    if (lastReservesKeyForFilterPinRef.current === null) {
      lastReservesKeyForFilterPinRef.current = reservesKey;
      return;
    }
    if (reservesKey === lastReservesKeyForFilterPinRef.current) return;
    lastReservesKeyForFilterPinRef.current = reservesKey;

    const targetReserveId = pendingMarketFilterPinReserveIdRef.current ?? expandedReserveId;
    if (!targetReserveId) return;
    const stillVisible = sortedData.some((r) => getReserveSimulationId(r) === targetReserveId);
    if (!stillVisible) {
      pendingMarketFilterPinReserveIdRef.current = null;
      return;
    }

    pendingMarketFilterPinReserveIdRef.current = null;
    // Cancel any prior scheduled pin so filter-driven pin is the only jump.
    // Store the cancel fn in a ref so that unrelated sortedData changes
    // (which re-run this effect but bail at the reservesKey guard) do
    // not invoke effect cleanup and cancel the pending scroll.
    cancelScenarioPinScrollRef.current?.();
    cancelScenarioPinScrollRef.current = null;
    cancelFilterPinScrollRef.current?.();
    cancelFilterPinScrollRef.current = schedulePinScrollToReserve(targetReserveId, 280, { instant: true }) ?? null;
  }, [reserves, sortedData, expandedReserveId, schedulePinScrollToReserve]);

  useEffect(() => {
    return () => {
      cancelFilterPinScrollRef.current?.();
      cancelScenarioPinScrollRef.current?.();
    };
  }, []);

  // Clear the filter-pin staging ref whenever expansion drops to null.
  // The matching cleanup of `suppressNextToggleReserveIdRef` is handled
  // inside `useReserveExpansion`. The mobile→desktop transition collapse
  // also lives there.
  useEffect(() => {
    if (!expandedReserveId) {
      pendingMarketFilterPinReserveIdRef.current = null;
    }
  }, [expandedReserveId]);

  // Keep expansion even when reserves change (e.g., market filter applied)
  // Previously this auto-collapsed when the expanded row was not in the filtered list
  // Now we preserve the expansion state so it re-appears when switching back markets

  const supplySortLabel = {
    total: 'Total',
    native: 'Native',
    incentive: 'Incentive',
  }[supplySortMode];

  const borrowSortLabel = {
    total: 'Total',
    native: 'Native',
    incentive: 'Incentive',
  }[borrowSortMode];

  const sizeSortAccentClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-700'
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability' || sizeSortMode === 'supplyAvailability'
        ? 'ds-text-brand-cyan'
        : 'text-foreground';
  const utilSortAccentClass =
    utilSortMode === 'liquidity'
      ? 'ds-text-purple-700'
      : 'text-foreground';
  const sizeSortActiveHeadingClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-600 font-bold scale-105'
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability' || sizeSortMode === 'supplyAvailability'
        ? 'ds-text-brand-cyan font-bold scale-105'
        : 'text-foreground font-bold scale-105';
  const mobileCardDefaultTab: 'supply' | 'borrow' =
    activeSortColumn === 'borrow' || activeSortColumn === 'spread' || (activeSortColumn === 'size' && (sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability'))
      ? 'borrow'
      : 'supply';

  const mobileExtraSortChipLabel = 'Extra';

  const mobileExtraSortActive =
    activeSortColumn === 'spread' ||
    activeSortColumn === 'token' ||
    activeSortColumn === 'market' ||
    activeSortColumn === 'price';

  const sizeSortOptions: MobileSortOption[] = [
    {
      key: 'supply',
      label: 'Supplied',
      isSelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'supply',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'supplyAvailability',
      label: 'Suppliable',
      isSelected: sizeSortMode === 'supplyAvailability' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'supplyAvailability' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'supplyAvailability',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrow',
      label: 'Borrowed',
      isSelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'borrow',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrowAvailability',
      label: 'Borrowable',
      isSelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'borrowAvailability',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'deficitAmount',
      label: 'Deficit',
      isSelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'deficitAmount',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'deficitRatio',
      label: 'Deficit (%)',
      isSelected: sizeSortMode === 'deficitRatio' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'deficitRatio' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'deficitRatio',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  const supplySortOptions: MobileSortOption[] = (['total', 'native', 'incentive'] as SortMode[]).map((mode) => ({
    key: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
    isSelected: supplySortMode === mode && activeSortColumn === 'supply',
    order: supplySortOrder,
    activeClassName: 'ds-text-emerald-600',
    onSelect: () => {
      selectSortOption({
        isAlreadySelected: supplySortMode === mode && activeSortColumn === 'supply',
        setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
        setSortMode: setSupplySortMode, targetMode: mode,
        setActiveSortColumn, targetColumn: 'supply',
      });
      closeAllMobileSortMenus();
    },
  }));

  const borrowSortOptions: MobileSortOption[] = (['total', 'native', 'incentive'] as SortMode[]).map((mode) => ({
    key: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
    isSelected: borrowSortMode === mode && activeSortColumn === 'borrow',
    order: borrowSortOrder,
    activeClassName: 'ds-text-brand-cyan',
    onSelect: () => {
      selectSortOption({
        isAlreadySelected: borrowSortMode === mode && activeSortColumn === 'borrow',
        setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
        setSortMode: setBorrowSortMode, targetMode: mode,
        setActiveSortColumn, targetColumn: 'borrow',
      });
      closeAllMobileSortMenus();
    },
  }));

  const utilSortOptions: MobileSortOption[] = [
    {
      key: 'util',
      label: 'Utilization',
      isSelected: activeSortColumn === 'util' && utilSortMode === 'util',
      order: utilSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: utilSortMode === 'util' && activeSortColumn === 'util',
          setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setUtilSortMode, targetMode: 'util',
          setActiveSortColumn, targetColumn: 'util',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'liquidity',
      label: 'Liquidity',
      isSelected: activeSortColumn === 'util' && utilSortMode === 'liquidity',
      order: utilSortOrder,
      activeClassName: 'ds-text-purple-600',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: utilSortMode === 'liquidity' && activeSortColumn === 'util',
          setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setUtilSortMode, targetMode: 'liquidity',
          setActiveSortColumn, targetColumn: 'util',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  const extraSortOptions: MobileSortOption[] = [
    {
      key: 'spread',
      label: 'Spread',
      isSelected: activeSortColumn === 'spread',
      order: spreadSortOrder,
      activeClassName: 'ds-text-purple-600',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'spread',
          setSortOrder: setSpreadSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setActiveSortColumn, targetColumn: 'spread',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'token',
      label: 'Token',
      isSelected: activeSortColumn === 'token',
      order: tokenSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'token',
          setSortOrder: setTokenSortOrder, toggleOrderFn: toggleSortOrderAscFirst, defaultOrder: 'asc',
          setActiveSortColumn, targetColumn: 'token',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'market',
      label: 'Market',
      isSelected: activeSortColumn === 'market',
      order: marketSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'market',
          setSortOrder: setMarketSortOrder, toggleOrderFn: toggleSortOrderAscFirst, defaultOrder: 'asc',
          setActiveSortColumn, targetColumn: 'market',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'price',
      label: 'Price',
      isSelected: activeSortColumn === 'price',
      order: priceSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'price',
          setSortOrder: setPriceSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setActiveSortColumn, targetColumn: 'price',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  const handleIncentiveClick = useCallback((
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null,
  ) => {
    e.stopPropagation();
    if (apy === null || isNaN(apy)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      reserve,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
      triggerHeight: rect.height,
      triggerRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  }, []);

  

  const handleRowClick = (reserve: ReserveWithSpread) => {
    const url = buildAaveUrl({
      marketName: reserve.marketName,
      tokenAddress: reserve.tokenAddress,
      aaveProReserveId: reserve.aaveProReserveId,
    });
    if (url) {
      openExternalUrl(url, isMobile);
    }
  };

  const isPortfolioMode = simulationMode === 'portfolio';

  // Set of reserveIds currently in the portfolio
  const portfolioReserveIds = useMemo(() => {
    if (!portfolioPositions) return new Set<string>();
    return new Set(portfolioPositions.map((p) => p.reserveId));
  }, [portfolioPositions]);

  // Callback: toggle a reserve in/out of portfolio (adds as specific side if provided, else defaults to supply)
  const handlePortfolioToggle = useCallback((reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => {
    if (!portfolioActions) return;

    if (side) {
      const existing = portfolioPositions?.find((p) => p.reserveId === reserveId && p.side === side);
      if (existing) {
        portfolioActions.removePosition(existing.positionId);
      } else {
        portfolioActions.addPosition({
          reserveId,
          marketName: reserve.marketName,
          chainName: reserve.chainName,
          tokenSymbol: reserve.tokenSymbol,
          side,
        });
      }
    } else {
      if (portfolioReserveIds.has(reserveId)) {
        const toRemove = portfolioPositions?.filter((p) => p.reserveId === reserveId) ?? [];
        toRemove.forEach((p) => portfolioActions.removePosition(p.positionId));
      } else {
        portfolioActions.addPosition({
          reserveId,
          marketName: reserve.marketName,
          chainName: reserve.chainName,
          tokenSymbol: reserve.tokenSymbol,
          side: 'supply',
        });
        portfolioActions.addPosition({
          reserveId,
          marketName: reserve.marketName,
          chainName: reserve.chainName,
          tokenSymbol: reserve.tokenSymbol,
          side: 'borrow',
        });
      }
    }
  }, [portfolioActions, portfolioPositions, portfolioReserveIds]);

  // Portfolio results computation (Phase 3)
  const { portfolioResults, portfolioSummary } = useMemo<{
    portfolioResults: PortfolioPositionResult[];
    portfolioSummary: PortfolioSummary;
  }>(() => {
    if (!isPortfolioMode || !portfolioPositions || portfolioPositions.length === 0) {
      return { portfolioResults: [], portfolioSummary: aggregatePortfolioSummary([]) };
    }
    const reserveMap = new Map(
      reserves.map((r) => [getReserveKey(r), r]),
    );
    const results: PortfolioPositionResult[] = portfolioPositions
      .map((pos) => {
        const reserve = reserveMap.get(pos.reserveId);
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        if (amountUsd <= 0 || !reserve) return null;
        // Use current reserve APY as baseline (full sim integration in later phase)
        const nativePercent = pos.side === 'supply'
          ? (reserve.supplyApy ?? 0)
          : (reserve.borrowApy ?? 0);
        // Sum incentive arrays
        const incentiveArr = pos.side === 'supply'
          ? (reserve.supplyIncentives ?? [])
          : (reserve.borrowIncentives ?? []);
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        return buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent);
      })
      .filter((r): r is PortfolioPositionResult => r !== null);
    return {
      portfolioResults: results,
      portfolioSummary: aggregatePortfolioSummary(results),
    };
  }, [isPortfolioMode, portfolioPositions, reserves]);

  const scenarioControls = (
    <div className={cn("space-y-2", isMobile && "rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1.5")}>
      {isMobile ? (
        <div className="flex items-stretch gap-2">
          {!isPortfolioMode && (
            <div className="flex-1 min-w-0">
              <ScenarioControls
                ref={scenarioControlsRef}
                onDebouncedChange={handleScenarioChange}
                meritMerklNetPosition={meritMerklNetPosition}
                onMeritMerklNetPositionChange={setMeritMerklNetPosition}
                mobileNetOpen={mobileNetOpen}
                onMobileNetToggle={handleMobileNetToggle}
              />
            </div>
          )}
          {onSimulationModeChange && (
            <div className="ml-auto shrink-0 flex flex-col items-center">
              {/* Upper section: Batch toggle — vertically centered in the input row */}
              <div className="flex flex-1 items-center justify-center">
                <PortfolioModeToggle
                  mode={simulationMode}
                  onModeChange={onSimulationModeChange}
                  positionCount={portfolioPositions ? new Set(portfolioPositions.map(p => p.reserveId)).size : 0}
                />
              </div>
              {/* Lower section: expand icon — vertically centered in the Net checkbox area */}
              {!isPortfolioMode && (
                <div className="flex flex-1 items-center justify-center">
                  <button
                    type="button"
                    onClick={handleMobileNetToggle}
                    className={cn(
                      'shrink-0 inline-flex h-7 w-7 items-center justify-center text-muted-foreground/65 transition-colors',
                      mobileNetOpen ? 'text-foreground' : 'hover:text-foreground/85',
                    )}
                    aria-label={mobileNetOpen ? 'Collapse advanced controls' : 'Expand advanced controls'}
                    aria-expanded={mobileNetOpen}
                  >
                    <SlidersHorizontal
                      className={cn('size-3.5 transition-transform duration-300', mobileNetOpen && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {!isPortfolioMode && (
            <div className="flex-1 min-w-0">
              <ScenarioControls
                ref={scenarioControlsRef}
                onDebouncedChange={handleScenarioChange}
                meritMerklNetPosition={meritMerklNetPosition}
                onMeritMerklNetPositionChange={setMeritMerklNetPosition}
              />
            </div>
          )}
          {onSimulationModeChange && (
            <div className="ml-auto shrink-0">
              <PortfolioModeToggle
                mode={simulationMode}
                onModeChange={onSimulationModeChange}
                positionCount={portfolioPositions ? new Set(portfolioPositions.map(p => p.reserveId)).size : 0}
              />
            </div>
          )}
        </div>
      )}
      {isPortfolioMode && (
        isLoading && reserves.length === 0 ? (
          <PortfolioPanelSkeleton />
        ) : portfolioPositions && portfolioActions ? (
          <PortfolioPanel
            positions={portfolioPositions}
            actions={portfolioActions}
            reserves={reserves}
            positionResults={portfolioResults}
            summary={portfolioSummary}
            snapshots={portfolioSnapshots}
          />
        ) : null
      )}
    </div>
  );

  const mobileTableRef = useRef<HTMLDivElement>(null);
  const desktopTableCardRef = useRef<HTMLDivElement>(null);
  const desktopTableBottomAnchorRef = useRef<HTMLDivElement>(null);
  const desktopStickyScenarioRef = useRef<HTMLDivElement>(null);
  const desktopStickyTheadRef = useRef<HTMLTableSectionElement>(null);
  const [tableInView, setTableInView] = useState(false);

  useEffect(() => {
    const target = isMobile ? mobileTableRef.current : desktopTableCardRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setTableInView(entry.isIntersecting),
      { threshold: 0, rootMargin: '200px 0px 200px 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const stickyEl = desktopStickyScenarioRef.current;
    const theadEl = desktopStickyTheadRef.current;
    const card = desktopTableCardRef.current;
    if (!stickyEl || !card) return undefined;
    const apply = () => {
      const scenarioH = stickyEl.getBoundingClientRect().height;
      card.style.setProperty('--reserves-sticky-scenario-height', `${scenarioH}px`);
      const theadH =
        theadEl instanceof HTMLElement ? theadEl.getBoundingClientRect().height : 0;
      if (theadH > 0) {
        card.style.setProperty(
          '--reserves-expanded-main-row-top',
          `${scenarioH + theadH}px`,
        );
      } else {
        card.style.removeProperty('--reserves-expanded-main-row-top');
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stickyEl);
    if (theadEl instanceof HTMLElement) {
      ro.observe(theadEl);
    }
    return () => {
      ro.disconnect();
      card.style.removeProperty('--reserves-sticky-scenario-height');
      card.style.removeProperty('--reserves-expanded-main-row-top');
    };
  }, [isMobile]);

  // Mobile card view — compact bottom padding (safe area + small breathing room)
  if (isMobile) {
    return (
      <div ref={mobileTableRef} className="space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div
          data-reserves-sticky-scenario
          className={cn(
            '-mx-[var(--ds-space-3)] px-[var(--ds-space-3)] pt-1 pb-0',
            // In portfolio (batch) mode, the panel can grow taller than the viewport
            // (search + suggested chips + many position rows + summary). If we keep
            // it sticky, the content overflows the sticky box and becomes unscrollable
            // — only the cards below it scroll. Disable sticky in batch mode so the
            // entire panel scrolls naturally with the page.
            !isPortfolioMode && 'sticky top-[env(safe-area-inset-top,0px)] z-20',
          )}
        >
          {scenarioControls}
        </div>
        <ReservesTableMobileSortBar
          activeSortColumn={activeSortColumn}
          sizeSortAccentClass={sizeSortAccentClass}
          utilSortAccentClass={utilSortAccentClass}
          mobileExtraSortActive={mobileExtraSortActive}
          mobileExtraSortChipLabel={mobileExtraSortChipLabel}
          showSizeSortMenu={showSizeSortMenu}
          showUtilSortMenu={showUtilSortMenu}
          showSupplySortMenu={showSupplySortMenu}
          showBorrowSortMenu={showBorrowSortMenu}
          showExtraSortMenu={showExtraSortMenu}
          sizeSortOptions={sizeSortOptions}
          utilSortOptions={utilSortOptions}
          supplySortOptions={supplySortOptions}
          borrowSortOptions={borrowSortOptions}
          extraSortOptions={extraSortOptions}
          onToggleMenu={toggleMobileSortMenu}
          onCloseMenus={closeAllMobileSortMenus}
        />
        
        {/* 2x2 Grid layout for mobile */}
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          <ReservesTableMobileGrid
            displayData={displayData}
            expandedReserveId={expandedReserveId}
            isLoading={isLoading}
            reservesCount={reserves.length}
            isApy={isApy}
            tydroPointToUsdRate={tydroPointToUsdRate}
            hasSharedScenario={hasSharedScenario}
            inputMode={sharedInputMode}
            supplyInput={debouncedSharedSupplyInput}
            borrowInput={debouncedSharedBorrowInput}
            mobileCardDefaultTab={mobileCardDefaultTab}
            simulationsById={simulationsById}
            onIncentiveClick={handleIncentiveClick}
            onToggleExpand={handleToggleExpand}
            onCorrectSupplyInput={handleCorrectSupplyInput}
            onCorrectBorrowInput={handleCorrectBorrowInput}
            isPortfolioMode={isPortfolioMode}
            portfolioReserveIds={portfolioReserveIds}
            onPortfolioToggle={handlePortfolioToggle}
            onSelectHub={onSelectHub}
          />
        </div>
        
        <ReservesTableShowMore
          totalCount={sortedData.length}
          displayCount={displayData.length}
          showAll={showAll}
          defaultVisibleCount={DEFAULT_VISIBLE_COUNT}
          variant="mobile"
          onShowAll={showAllRows}
          onShowLess={resetVisibleCount}
        />


        <ReservesTableTooltipOverlay tooltipState={tooltipState} onClose={() => setTooltipState(null)} isApy={isApy} tydroPointToUsdRate={tydroPointToUsdRate} whitelistMerklCampaignIds={whitelistMerklCampaignIds} onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign} forecastStates={forecastStates} />

        <ReservesTableFloatingScroll
          tableInView={tableInView}
          variant="mobile"
          onScrollToTop={() => {
            const el = topOppsRef?.current;
            if (el) {
              const y = el.getBoundingClientRect().bottom + window.scrollY;
              window.scrollTo({ top: y, behavior: 'smooth' });
            } else {
              mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          onScrollToBottom={() => mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          onRefresh={onRefresh}
          dataUpdatedAt={dataUpdatedAt}
        />
      </div>
    );
  }


  return (
    <div
      ref={desktopTableCardRef}
      className="relative min-w-0 w-full rounded-2xl bg-border/60 p-px shadow-sm"
    >
      {/*
        1px “gutter” border: native border on a rounded card is painted under full-bleed sticky
        children, so top corner arcs look broken. Outer p-px + inner smaller radius keeps a
        continuous ring without overflow:hidden (sticky stack stays viewport-relative).
        Aligns with DESIGN-SYSTEM-REFERENCE § 轮廓与圆角拼接 (prefer structural fix over masks).
      */}
      <div className="min-w-0 w-full overflow-visible rounded-[calc(1rem-1px)] bg-card">
      <div
        ref={desktopStickyScenarioRef}
        data-reserves-sticky-scenario
        className="sticky top-0 z-20 rounded-t-[calc(1rem-1px)] border-b border-border/60 bg-card p-[var(--ds-space-3)]"
      >
        {scenarioControls}
      </div>
      {/*
        Do not wrap the table in overflow-x-auto: that creates a scrollport so thead’s
        sticky `top` is relative to that box, not the viewport — scenario uses viewport top-0,
        producing a huge gap and tbody bleeding above the header. Horizontal overflow falls
        through to the page when the table is wider than the container.
      */}
      <Table className="w-full table-fixed min-w-0" wrapperClassName="overflow-visible">
          <colgroup>
            {/* 列顺序：Token → Market → Price → ...（DeFi/lending 协议表惯例：
             * Asset → Network/Market 紧贴，参考 Aave UI / Compound / Spark / Morpho）。
             * 优化列宽分布：确保 Utilization 刚好撑开，平衡其他列 */}
            {/* Token — +1% from Price，给 ↗ + symbol 多一点呼吸 */}
            <col style={{ width: '14%' }} />
            {/* Market — +1% from Price，让 chip 离 Price 数字不至于太空 */}
            <col style={{ width: '14.5%' }} />
            {/* Price — Price 内容固定为 $X.XX 短数字，10% 留给数字左侧的余量过大 */}
            <col style={{ width: '8%' }} />
            {/* Size */}
            <col style={{ width: '12%' }} />
            {/* Utilization */}
            <col style={{ width: '13%' }} />
            {/* Supply */}
            <col style={{ width: '12.5%' }} />
            {/* Spread */}
            <col style={{ width: '12%' }} />
            {/* Borrow */}
            <col style={{ width: '14%' }} />
          </colgroup>
          <ReservesTableDesktopHeader
            tableHeaderRef={desktopStickyTheadRef}
            tableHeaderClassName="overflow-visible [&_tr]:border-b-0 [&_th]:sticky [&_th]:z-30 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-card [&_th]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_th]:[top:var(--reserves-sticky-scenario-height,4.5rem)]"
            activeSortColumn={activeSortColumn}
            tokenSortOrder={tokenSortOrder}
            marketSortOrder={marketSortOrder}
            priceSortOrder={priceSortOrder}
            sizeSortMode={sizeSortMode}
            sizeSortOrder={sizeSortOrder}
            sizeSortActiveHeadingClass={sizeSortActiveHeadingClass}
            utilSortOrder={utilSortOrder}
            supplySortLabel={supplySortLabel}
            supplySortMode={supplySortMode}
            supplySortOrder={supplySortOrder}
            showSupplySortMenu={showSupplySortMenu}
            supplyMenuPos={supplyMenuPos}
            borrowSortLabel={borrowSortLabel}
            borrowSortMode={borrowSortMode}
            borrowSortOrder={borrowSortOrder}
            showBorrowSortMenu={showBorrowSortMenu}
            borrowMenuPos={borrowMenuPos}
            spreadSortOrder={spreadSortOrder}
            showSizeSortMenu={showSizeSortMenu}
            sizeMenuPos={sizeMenuPos}
            sizeSortButtonRef={sizeSortButtonRef}
            supplySortButtonRef={supplySortButtonRef}
            borrowSortButtonRef={borrowSortButtonRef}
            onSortToken={handleSortToken}
            onSortMarket={handleSortMarket}
            onSortPrice={handleSortPrice}
            utilSortMode={utilSortMode}
            showUtilSortMenu={showUtilSortMenu}
            utilMenuPos={utilMenuPos}
            utilSortButtonRef={utilSortButtonRef}
            onToggleUtilMenu={() => setShowUtilSortMenu(!showUtilSortMenu)}
            onCloseUtilMenu={() => setShowUtilSortMenu(false)}
            onSelectUtilSortUtil={() => {
              collapseExpandedOnSort();
              selectSortOption({
                isAlreadySelected: utilSortMode === 'util' && activeSortColumn === 'util',
                setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
                setSortMode: setUtilSortMode, targetMode: 'util',
                setActiveSortColumn, targetColumn: 'util',
              });
              setShowUtilSortMenu(false);
            }}
            onSelectUtilSortLiquidity={() => {
              collapseExpandedOnSort();
              selectSortOption({
                isAlreadySelected: utilSortMode === 'liquidity' && activeSortColumn === 'util',
                setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
                setSortMode: setUtilSortMode, targetMode: 'liquidity',
                setActiveSortColumn, targetColumn: 'util',
              });
              setShowUtilSortMenu(false);
            }}
            onToggleSpreadSort={() => {
              if (activeSortColumn === 'spread') {
                toggleSpreadSortOrder();
              } else {
                collapseExpandedOnSort();
                setActiveSortColumn('spread');
                setSpreadSortOrder('desc');
              }
            }}
            onToggleSizeMenu={() => setShowSizeSortMenu(!showSizeSortMenu)}
            onCloseSizeMenu={() => setShowSizeSortMenu(false)}
            onSelectSizeSortSupply={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'supply' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'supply', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortBorrow={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'borrow' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'borrow', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortBorrowAvailability={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'borrowAvailability', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortSupplyAvailability={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'supplyAvailability' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'supplyAvailability', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortDeficitAmount={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'deficitAmount', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortDeficitRatio={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: sizeSortMode === 'deficitRatio' && activeSortColumn === 'size', setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSizeSortMode, targetMode: 'deficitRatio', setActiveSortColumn, targetColumn: 'size' });
              setShowSizeSortMenu(false);
            }}
            onToggleSupplyMenu={() => setShowSupplySortMenu(!showSupplySortMenu)}
            onCloseSupplyMenu={() => setShowSupplySortMenu(false)}
            onSelectSupplySortTotal={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'total' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'total', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortNative={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'native' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'native', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortIncentive={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'incentive' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'incentive', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortNative={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'native' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'native', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortIncentive={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'incentive' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'incentive', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onToggleBorrowMenu={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
            onCloseBorrowMenu={() => setShowBorrowSortMenu(false)}
            onSelectBorrowSortTotal={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'total' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'total', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortNative={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'native' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'native', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortIncentive={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'incentive' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'incentive', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
          />
          <TableBody>
            {(isLoading && reserves.length === 0) || (reserves.length > 0 && displayData.length === 0) ? (
              <ReservesTableDesktopSkeleton />
            ) : displayData.map((reserve) => {
              const reserveId = getReserveSimulationId(reserve);
              const simulation = simulationsById[reserveId];
              const displaySupplyIncentive = resolveVisibleIncentiveBadgeValue(
                getDisplaySupplyIncentive(reserve),
                reserve,
                'supply',
                isApy,
                tydroPointToUsdRate,
              );
              const displayBorrowIncentive = resolveVisibleIncentiveBadgeValue(
                getDisplayBorrowIncentive(reserve),
                reserve,
                'borrow',
                isApy,
                tydroPointToUsdRate,
              );
              return (
                <DesktopReserveRow
                  key={reserveId}
                  reserve={reserve}
                  reserveId={reserveId}
                  isExpanded={expandedReserveId === reserveId}
                  onToggleExpand={handleToggleExpand}
                  onSelectMarket={onSelectMarket}
                  onMarketChipClick={handleMarketChipClick}
                  onSelectHub={onSelectHub}
                  onIncentiveClick={handleIncentiveClick}
                  displaySupplyTotal={getDisplaySupplyTotal(reserve)}
                  displaySupplyNative={getDisplaySupplyNative(reserve)}
                  displaySupplyIncentive={displaySupplyIncentive}
                  displayBorrowTotal={getDisplayBorrowTotal(reserve)}
                  displayBorrowNative={getDisplayBorrowNative(reserve)}
                  displayBorrowIncentive={displayBorrowIncentive}
                  displayUtilization={getDisplayUtilization(reserve)}
                  spread={getDisplaySpread(reserve)}
                  simulation={simulation}
                  supplyInput={debouncedSharedSupplyInput}
                  borrowInput={debouncedSharedBorrowInput}
                  inputMode={sharedInputMode}
                  isApy={isApy}
                  isMobile={isMobile}
                  onCorrectSupplyInput={handleCorrectSupplyInput}
                  onCorrectBorrowInput={handleCorrectBorrowInput}
                  isPortfolioMode={isPortfolioMode}
                  isInPortfolio={portfolioReserveIds.has(reserveId)}
                  onPortfolioToggle={handlePortfolioToggle}
                />
              );
            })
            }
          </TableBody>
        </Table>

      <ReservesTableShowMore
        totalCount={sortedData.length}
        displayCount={displayData.length}
        showAll={showAll}
        defaultVisibleCount={DEFAULT_VISIBLE_COUNT}
        variant="desktop"
        onShowAll={showAllRows}
        onShowLess={resetVisibleCount}
      />
      
      <div ref={desktopTableBottomAnchorRef} aria-hidden className="h-px w-full" />

      {/* Spacer: ensures enough scroll room to pin-scroll the last expanded row to the sticky band */}
      {expandedReserveId && (
        <div aria-hidden style={{ height: 'calc(100dvh - var(--reserves-expanded-main-row-top, 5.75rem))' }} />
      )}

      <ReservesTableTooltipOverlay tooltipState={tooltipState} onClose={() => setTooltipState(null)} isApy={isApy} tydroPointToUsdRate={tydroPointToUsdRate} whitelistMerklCampaignIds={whitelistMerklCampaignIds} onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign} forecastStates={forecastStates} />

      <ReservesTableFloatingScroll
        tableInView={tableInView}
        variant="desktop"
        onScrollToTop={() => {
          const el = topOppsRef?.current;
          if (el) {
            const y = el.getBoundingClientRect().bottom + window.scrollY;
            window.scrollTo({ top: y, behavior: 'smooth' });
          } else {
            desktopTableCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        onScrollToBottom={() => {
          const target = desktopTableBottomAnchorRef.current ?? desktopTableCardRef.current;
          target?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }}
        onRefresh={onRefresh}
        dataUpdatedAt={dataUpdatedAt}
      />
      </div>
    </div>
  );
};

export default ReservesTable;
