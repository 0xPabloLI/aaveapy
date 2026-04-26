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
  type MobileSortMenuKey,
  type MobileSortOption,
} from './ReservesTableMobileSortBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getPoolLiquidityUsd, getScenarioSupplySizeUsd, getTotalBorrowedUsd as getReserveTotalBorrowedUsd, getAvailableToBorrowUsd } from '@/lib/scenarioSize';
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

interface ReservesTableProps {
  reserves: ReserveWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
  isLoading?: boolean;
  onSelectMarket?: (marketName: string) => void;
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
}

type SortMode = 'total' | 'native' | 'incentive';

type SortableColumn = 'token' | 'price' | 'market' | 'size' | 'util' | 'supply' | 'borrow' | 'spread';

const DEFAULT_VISIBLE_COUNT = 20;

const ReservesTable = ({
  reserves,
  sortField,
  sortOrder,
  onSort,
  isApy,
  isLoading,
  onSelectMarket,
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

  const [activeSortColumn, setActiveSortColumn] = useState<SortableColumn | null>('supply');
  const [tokenSortOrder, setTokenSortOrder] = useState<'asc' | 'desc'>('asc');
  const [marketSortOrder, setMarketSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sizeSortMode, setSizeSortMode] = useState<'supply' | 'borrow' | 'borrowAvailability' | 'deficitRatio' | 'deficitAmount'>('supply');
  const [sizeSortOrder, setSizeSortOrder] = useState<'asc' | 'desc'>('desc');
  const [utilSortOrder, setUtilSortOrder] = useState<'asc' | 'desc'>('desc');
  const [utilSortMode, setUtilSortMode] = useState<'util' | 'liquidity'>('liquidity');
  const [showUtilSortMenu, setShowUtilSortMenu] = useState(false);
  const utilSortButtonRef = useRef<HTMLButtonElement>(null);
  const [utilMenuPos, setUtilMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showSizeSortMenu, setShowSizeSortMenu] = useState(false);
  const sizeSortButtonRef = useRef<HTMLButtonElement>(null);
  const [sizeMenuPos, setSizeMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('incentive');
  const [supplySortOrder, setSupplySortOrder] = useState<'asc' | 'desc'>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<'asc' | 'desc'>('desc');
  const [spreadSortOrder, setSpreadSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
  const [showExtraSortMenu, setShowExtraSortMenu] = useState(false);
  const borrowSortButtonRef = useRef<HTMLButtonElement>(null);
  const supplySortButtonRef = useRef<HTMLButtonElement>(null);
  const scenarioControlsRef = useRef<ScenarioControlsHandle>(null);
  const scenarioPinControllerRef = useRef(createScenarioPinControllerState());
  const scenarioPinScheduleTokenRef = useRef(0);
  const cancelScenarioPinScrollRef = useRef<(() => void) | null>(null);
  const lastReservesKeyForFilterPinRef = useRef<string | null>(null);
  const cancelFilterPinScrollRef = useRef<(() => void) | null>(null);
  const suppressNextToggleReserveIdRef = useRef<string | null>(null);
  const pendingMarketFilterPinReserveIdRef = useRef<string | null>(null);
  const [borrowMenuPos, setBorrowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [supplyMenuPos, setSupplyMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [minVisibleCount, setMinVisibleCount] = useState<number | null>(null);
  const [expandedReserveId, setExpandedReserveId] = useState<string | null>(null);
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

  useEffect(() => {
    if (showBorrowSortMenu && borrowSortButtonRef.current) {
      const rect = borrowSortButtonRef.current.getBoundingClientRect();
      setBorrowMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showBorrowSortMenu]);

  useEffect(() => {
    if (showSupplySortMenu && supplySortButtonRef.current) {
      const rect = supplySortButtonRef.current.getBoundingClientRect();
      setSupplyMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showSupplySortMenu]);

  useEffect(() => {
    if (showSizeSortMenu && sizeSortButtonRef.current) {
      const rect = sizeSortButtonRef.current.getBoundingClientRect();
      setSizeMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showSizeSortMenu]);

  useEffect(() => {
    if (showUtilSortMenu && utilSortButtonRef.current) {
      const rect = utilSortButtonRef.current.getBoundingClientRect();
      setUtilMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
    }
  }, [showUtilSortMenu]);

  const handleToggleExpand = useCallback((reserveId: string) => {
    if (suppressNextToggleReserveIdRef.current === reserveId) {
      suppressNextToggleReserveIdRef.current = null;
      return;
    }
    setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId));
  }, []);

  const handleMarketChipClick = useCallback((reserveId: string) => {
    // Preserve an already-expanded row across filter updates, but do not
    // implicitly expand a collapsed row just because its market chip was clicked.
    // The chip stops propagation, so row expansion stays an explicit action.
    const shouldKeepExpanded = expandedReserveId === reserveId;
    pendingMarketFilterPinReserveIdRef.current = shouldKeepExpanded ? reserveId : null;
    if (shouldKeepExpanded) {
      setExpandedReserveId(reserveId);
    }
  }, [expandedReserveId]);

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

  // Helper: Get incentive values for a reserve (supply or borrow)
  const getIncentiveValues = (reserve: ReserveWithSpread, type: 'supply' | 'borrow') =>
    getReserveIncentiveValues(reserve, type, tydroPointToUsdRate, { whitelistMerklCampaignIds });

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
    return pickScenarioValue(simulation.utilization.current, simulation.utilization.after);
  };

  const getDisplayReserveSizeUsd = (reserve: ReserveWithSpread): number | null => {
    return getScenarioSupplySizeUsd({
      reserveSizeUsd: reserve.reserveSizeUsd,
      supplyCapUsd: reserve.supplyCapUsd,
      rawSupplyInput: debouncedSharedSupplyInput,
      inputMode: sharedInputMode,
      tokenPrice: getSimulation(reserve)?.tokenPrice ?? reserve.tokenPrice,
    });
  };

  const getTotalBorrowedUsd = (reserve: ReserveWithSpread): number | null => {
    return getReserveTotalBorrowedUsd({
      reserveSizeUsd: reserve.reserveSizeUsd,
      utilizationPct: reserve.utilizationPct,
    });
  };

  const getDisplayLiquidityUsd = (reserve: ReserveWithSpread): number | null => {
    const totalBorrowed = getTotalBorrowedUsd(reserve);
    return getPoolLiquidityUsd({ reserveSizeUsd: reserve.reserveSizeUsd, totalBorrowedUsd: totalBorrowed });
  };

  const getDisplayAvailableToBorrowUsd = (reserve: ReserveWithSpread): number | null => {
    const totalBorrowed = getTotalBorrowedUsd(reserve);
    const poolLiquidity = getPoolLiquidityUsd({ reserveSizeUsd: reserve.reserveSizeUsd, totalBorrowedUsd: totalBorrowed });
    return getAvailableToBorrowUsd({
      borrowedUsd: totalBorrowed,
      borrowCapUsd: reserve.borrowCapUsd,
      poolLiquidityUsd: poolLiquidity,
    });
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

  // Sort data based on active column and its sort mode
  const sortedData = useMemo(() => {
    return [...reserves].sort((a, b) => {
      let comparison: number;

      // Default to supply total desc when no column is selected
      const sortColumn = activeSortColumn ?? 'supply';

      if (sortColumn === 'token') {
        const order = tokenSortOrder === 'asc' ? 1 : -1;
        return order * (a.tokenSymbol.localeCompare(b.tokenSymbol, undefined, { sensitivity: 'base' }));
      }
      if (sortColumn === 'market') {
        const order = marketSortOrder === 'asc' ? 1 : -1;
        const byMarket = a.marketName.localeCompare(b.marketName, undefined, { sensitivity: 'base' });
        if (byMarket !== 0) return order * byMarket;
        return order * a.tokenSymbol.localeCompare(b.tokenSymbol, undefined, { sensitivity: 'base' });
      }
      if (sortColumn === 'price') {
        const aP = a.tokenPrice ?? -Infinity;
        const bP = b.tokenPrice ?? -Infinity;
        comparison = aP - bP;
        return priceSortOrder === 'desc' ? -comparison : comparison;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserves, activeSortColumn, tokenSortOrder, marketSortOrder, priceSortOrder, sizeSortMode, sizeSortOrder, utilSortMode, utilSortOrder, supplySortMode, supplySortOrder, borrowSortMode, borrowSortOrder, spreadSortOrder, simulationsById, hasSharedScenario, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, debouncedSharedSupplyInput, debouncedSharedBorrowInput, sharedInputMode, meritMerklNetPosition]);

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

  useEffect(() => {
    if (!expandedReserveId) {
      pendingMarketFilterPinReserveIdRef.current = null;
      suppressNextToggleReserveIdRef.current = null;
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
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability'
        ? 'ds-text-brand-cyan'
        : 'text-foreground';
  const utilSortAccentClass =
    utilSortMode === 'liquidity'
      ? 'ds-text-purple-700'
      : 'text-foreground';
  const sizeSortActiveHeadingClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-600 font-bold scale-105'
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability'
        ? 'ds-text-brand-cyan font-bold scale-105'
        : 'text-foreground font-bold scale-105';
  const mobileCardDefaultTab: 'supply' | 'borrow' =
    activeSortColumn === 'borrow' || (activeSortColumn === 'size' && (sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability'))
      ? 'borrow'
      : 'supply';

  const mobileExtraSortChipLabel =
    activeSortColumn === 'spread'
      ? 'Spread'
      : activeSortColumn === 'token'
        ? 'Token'
        : activeSortColumn === 'market'
          ? 'Market'
          : activeSortColumn === 'price'
            ? 'Price'
            : 'Spread';

  const mobileExtraSortActive =
    activeSortColumn === 'spread' ||
    activeSortColumn === 'token' ||
    activeSortColumn === 'market' ||
    activeSortColumn === 'price';

  const toggleSupplySortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('supply');
    setSupplySortOrder(supplySortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleBorrowSortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('borrow');
    setBorrowSortOrder(borrowSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleSpreadSortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('spread');
    setSpreadSortOrder(spreadSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const collapseExpandedOnSort = useCallback(() => {
    setExpandedReserveId(null);
  }, []);

  const handleSortToken = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('token');
    setTokenSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  };
  const handleSortMarket = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('market');
    setMarketSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  };
  const handleSortPrice = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('price');
    setPriceSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  };
  const handleSortSize = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('size');
    setSizeSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  };
  const handleSortUtil = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('util');
    setUtilSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    setShowUtilSortMenu(false);
  };

  const closeAllMobileSortMenus = useCallback((except: MobileSortMenuKey | null = null) => {
    if (except !== 'size') setShowSizeSortMenu(false);
    if (except !== 'supply') setShowSupplySortMenu(false);
    if (except !== 'borrow') setShowBorrowSortMenu(false);
    if (except !== 'extra') setShowExtraSortMenu(false);
    setShowUtilSortMenu(false);
  }, []);

  const toggleMobileSortMenu = useCallback((menu: MobileSortMenuKey) => {
    closeAllMobileSortMenus(menu);
    switch (menu) {
      case 'size':
        setShowSizeSortMenu((prev) => !prev);
        break;
      case 'util':
        setShowUtilSortMenu((prev) => !prev);
        break;
      case 'supply':
        setShowSupplySortMenu((prev) => !prev);
        break;
      case 'borrow':
        setShowBorrowSortMenu((prev) => !prev);
        break;
      case 'extra':
        setShowExtraSortMenu((prev) => !prev);
        break;
    }
  }, [closeAllMobileSortMenus]);

  const sizeSortOptions: MobileSortOption[] = [
    {
      key: 'supply',
      label: 'Supply',
      isSelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      onSelect: () => {
        const isAlreadySelected = sizeSortMode === 'supply' && activeSortColumn === 'size';
        if (isAlreadySelected && sizeSortOrder === 'desc') {
          setSizeSortOrder('asc');
        } else {
          setSizeSortMode('supply');
          setActiveSortColumn('size');
          setSizeSortOrder('desc');
        }
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrow',
      label: 'Borrow Size',
      isSelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        const isAlreadySelected = sizeSortMode === 'borrow' && activeSortColumn === 'size';
        if (isAlreadySelected && sizeSortOrder === 'desc') {
          setSizeSortOrder('asc');
        } else {
          setSizeSortMode('borrow');
          setActiveSortColumn('size');
          setSizeSortOrder('desc');
        }
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrowAvailability',
      label: 'Borrow Avail',
      isSelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        const isAlreadySelected = sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size';
        if (isAlreadySelected && sizeSortOrder === 'desc') {
          setSizeSortOrder('asc');
        } else {
          setSizeSortMode('borrowAvailability');
          setActiveSortColumn('size');
          setSizeSortOrder('desc');
        }
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
        const isAlreadySelected = sizeSortMode === 'deficitAmount' && activeSortColumn === 'size';
        if (isAlreadySelected && sizeSortOrder === 'desc') {
          setSizeSortOrder('asc');
        } else {
          setSizeSortMode('deficitAmount');
          setActiveSortColumn('size');
          setSizeSortOrder('desc');
        }
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
        const isAlreadySelected = sizeSortMode === 'deficitRatio' && activeSortColumn === 'size';
        if (isAlreadySelected && sizeSortOrder === 'desc') {
          setSizeSortOrder('asc');
        } else {
          setSizeSortMode('deficitRatio');
          setActiveSortColumn('size');
          setSizeSortOrder('desc');
        }
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
      const isAlreadySelected = supplySortMode === mode && activeSortColumn === 'supply';
      if (isAlreadySelected && supplySortOrder === 'desc') {
        setSupplySortOrder('asc');
      } else {
        setSupplySortMode(mode);
        setActiveSortColumn('supply');
        setSupplySortOrder('desc');
      }
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
      const isAlreadySelected = borrowSortMode === mode && activeSortColumn === 'borrow';
      if (isAlreadySelected && borrowSortOrder === 'desc') {
        setBorrowSortOrder('asc');
      } else {
        setBorrowSortMode(mode);
        setActiveSortColumn('borrow');
        setBorrowSortOrder('desc');
      }
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
        if (activeSortColumn === 'util' && utilSortMode === 'util' && utilSortOrder === 'desc') {
          setUtilSortOrder('asc');
        } else {
          setUtilSortMode('util');
          setActiveSortColumn('util');
          setUtilSortOrder('desc');
        }
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
        if (activeSortColumn === 'util' && utilSortMode === 'liquidity' && utilSortOrder === 'desc') {
          setUtilSortOrder('asc');
        } else {
          setUtilSortMode('liquidity');
          setActiveSortColumn('util');
          setUtilSortOrder('desc');
        }
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
        if (activeSortColumn === 'spread' && spreadSortOrder === 'desc') {
          setSpreadSortOrder('asc');
        } else {
          setActiveSortColumn('spread');
          setSpreadSortOrder('desc');
        }
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
        if (activeSortColumn === 'token' && tokenSortOrder === 'asc') {
          setTokenSortOrder('desc');
        } else {
          setActiveSortColumn('token');
          setTokenSortOrder('asc');
        }
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
        if (activeSortColumn === 'market' && marketSortOrder === 'asc') {
          setMarketSortOrder('desc');
        } else {
          setActiveSortColumn('market');
          setMarketSortOrder('asc');
        }
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
        if (activeSortColumn === 'price' && priceSortOrder === 'desc') {
          setPriceSortOrder('asc');
        } else {
          setActiveSortColumn('price');
          setPriceSortOrder('desc');
        }
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

  // Auto-expand to target reserve + 5 rows buffer when scrolling to a specific reserve
  useEffect(() => {
    if (scrollToReserveId) {
      const targetIndex = sortedData.findIndex(
        (r) => getReserveKey(r) === scrollToReserveId
      );
      if (targetIndex >= 0) {
        const neededCount = targetIndex + 6; // target row + 5 buffer rows
        if (neededCount > DEFAULT_VISIBLE_COUNT) {
          setMinVisibleCount(neededCount);
        }
      }
    }
  }, [scrollToReserveId, sortedData]);

  // Auto-expand visible count when a row is expanded (persist even after collapse)
  useEffect(() => {
    if (!expandedReserveId) return;
    const expandedIndex = sortedData.findIndex(
      (r) => getReserveSimulationId(r) === expandedReserveId
    );
    if (expandedIndex < 0) return;
    const neededCount = expandedIndex + 6; // expanded row + 5 buffer rows
    const currentCount = minVisibleCount ?? DEFAULT_VISIBLE_COUNT;
    if (neededCount > currentCount) {
      setMinVisibleCount(Math.min(neededCount, sortedData.length));
    }
  }, [expandedReserveId, sortedData, minVisibleCount]);

  // Display data with pagination - must be before conditional returns
  const displayData = useMemo(() => {
    const baseCount = minVisibleCount ?? DEFAULT_VISIBLE_COUNT;
    if (baseCount >= sortedData.length) return sortedData;
    return sortedData.slice(0, baseCount);
  }, [sortedData, minVisibleCount]);
  
  const showAll = minVisibleCount !== null && minVisibleCount >= sortedData.length;

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
      {isPortfolioMode && portfolioPositions && portfolioActions && (
        <PortfolioPanel
          positions={portfolioPositions}
          actions={portfolioActions}
          reserves={reserves}
          positionResults={portfolioResults}
          summary={portfolioSummary}
          snapshots={portfolioSnapshots}
        />
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

  // Mobile card view — extra bottom padding so content isn't hidden by browser/safe area
  if (isMobile) {
    return (
      <div ref={mobileTableRef} className="space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]">
        <div
          data-reserves-sticky-scenario
          className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-[var(--ds-space-3)] px-[var(--ds-space-3)] pt-1 pb-0"
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
          />
        </div>
        
        <ReservesTableShowMore
          totalCount={sortedData.length}
          displayCount={displayData.length}
          showAll={showAll}
          defaultVisibleCount={DEFAULT_VISIBLE_COUNT}
          variant="mobile"
          onShowAll={() => setMinVisibleCount(sortedData.length)}
          onShowLess={() => setMinVisibleCount(null)}
        />
        
        <ReservesTableTooltipOverlay tooltipState={tooltipState} onClose={() => setTooltipState(null)} isApy={isApy} tydroPointToUsdRate={tydroPointToUsdRate} whitelistMerklCampaignIds={whitelistMerklCampaignIds} onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign} forecastStates={forecastStates} />

        <ReservesTableFloatingScroll
          tableInView={tableInView}
          variant="mobile"
          onScrollToTop={() => mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
            <col style={{ width: '14%' }} /> {/* Token   — +1% from Price，给 ↗ + symbol 多一点呼吸 */}
            <col style={{ width: '14.5%' }} /> {/* Market — +1% from Price，让 chip 离 Price 数字不至于太空 */}
            <col style={{ width: '8%' }} />  {/* Price   — Price 内容固定为 $X.XX 短数字，10% 留给数字左侧的余量过大 */}
            <col style={{ width: '12%' }} /> {/* Size */}
            <col style={{ width: '13%' }} /> {/* Utilization */}
            <col style={{ width: '12.5%' }} /> {/* Supply */}
            <col style={{ width: '12%' }} /> {/* Spread */}
            <col style={{ width: '14%' }} /> {/* Borrow */}
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
              const isAlreadySelected = utilSortMode === 'util' && activeSortColumn === 'util';
              if (isAlreadySelected && utilSortOrder === 'desc') {
                setUtilSortOrder('asc');
              } else {
                setUtilSortMode('util');
                setActiveSortColumn('util');
                setUtilSortOrder('desc');
              }
              setShowUtilSortMenu(false);
            }}
            onSelectUtilSortLiquidity={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = utilSortMode === 'liquidity' && activeSortColumn === 'util';
              if (isAlreadySelected && utilSortOrder === 'desc') {
                setUtilSortOrder('asc');
              } else {
                setUtilSortMode('liquidity');
                setActiveSortColumn('util');
                setUtilSortOrder('desc');
              }
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
              const isAlreadySelected = sizeSortMode === 'supply' && activeSortColumn === 'size';
              if (isAlreadySelected && sizeSortOrder === 'desc') {
                setSizeSortOrder('asc');
              } else {
                setSizeSortMode('supply');
                setActiveSortColumn('size');
                setSizeSortOrder('desc');
              }
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortBorrow={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = sizeSortMode === 'borrow' && activeSortColumn === 'size';
              if (isAlreadySelected && sizeSortOrder === 'desc') {
                setSizeSortOrder('asc');
              } else {
                setSizeSortMode('borrow');
                setActiveSortColumn('size');
                setSizeSortOrder('desc');
              }
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortBorrowAvailability={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size';
              if (isAlreadySelected && sizeSortOrder === 'desc') {
                setSizeSortOrder('asc');
              } else {
                setSizeSortMode('borrowAvailability');
                setActiveSortColumn('size');
                setSizeSortOrder('desc');
              }
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortDeficitAmount={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = sizeSortMode === 'deficitAmount' && activeSortColumn === 'size';
              if (isAlreadySelected && sizeSortOrder === 'desc') {
                setSizeSortOrder('asc');
              } else {
                setSizeSortMode('deficitAmount');
                setActiveSortColumn('size');
                setSizeSortOrder('desc');
              }
              setShowSizeSortMenu(false);
            }}
            onSelectSizeSortDeficitRatio={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = sizeSortMode === 'deficitRatio' && activeSortColumn === 'size';
              if (isAlreadySelected && sizeSortOrder === 'desc') {
                setSizeSortOrder('asc');
              } else {
                setSizeSortMode('deficitRatio');
                setActiveSortColumn('size');
                setSizeSortOrder('desc');
              }
              setShowSizeSortMenu(false);
            }}
            onToggleSupplyMenu={() => setShowSupplySortMenu(!showSupplySortMenu)}
            onCloseSupplyMenu={() => setShowSupplySortMenu(false)}
            onSelectSupplySortTotal={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = supplySortMode === 'total' && activeSortColumn === 'supply';
              if (isAlreadySelected && supplySortOrder === 'desc') {
                setSupplySortOrder('asc');
              } else {
                setSupplySortMode('total');
                setActiveSortColumn('supply');
                setSupplySortOrder('desc');
              }
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortNative={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = supplySortMode === 'native' && activeSortColumn === 'supply';
              if (isAlreadySelected && supplySortOrder === 'desc') {
                setSupplySortOrder('asc');
              } else {
                setSupplySortMode('native');
                setActiveSortColumn('supply');
                setSupplySortOrder('desc');
              }
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortIncentive={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = supplySortMode === 'incentive' && activeSortColumn === 'supply';
              if (isAlreadySelected && supplySortOrder === 'desc') {
                setSupplySortOrder('asc');
              } else {
                setSupplySortMode('incentive');
                setActiveSortColumn('supply');
                setSupplySortOrder('desc');
              }
              setShowSupplySortMenu(false);
            }}
            onToggleBorrowMenu={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
            onCloseBorrowMenu={() => setShowBorrowSortMenu(false)}
            onSelectBorrowSortTotal={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = borrowSortMode === 'total' && activeSortColumn === 'borrow';
              if (isAlreadySelected && borrowSortOrder === 'desc') {
                setBorrowSortOrder('asc');
              } else {
                setBorrowSortMode('total');
                setActiveSortColumn('borrow');
                setBorrowSortOrder('desc');
              }
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortNative={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = borrowSortMode === 'native' && activeSortColumn === 'borrow';
              if (isAlreadySelected && borrowSortOrder === 'desc') {
                setBorrowSortOrder('asc');
              } else {
                setBorrowSortMode('native');
                setActiveSortColumn('borrow');
                setBorrowSortOrder('desc');
              }
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortIncentive={() => {
              collapseExpandedOnSort();
              const isAlreadySelected = borrowSortMode === 'incentive' && activeSortColumn === 'borrow';
              if (isAlreadySelected && borrowSortOrder === 'desc') {
                setBorrowSortOrder('asc');
              } else {
                setBorrowSortMode('incentive');
                setActiveSortColumn('borrow');
                setBorrowSortOrder('desc');
              }
              setShowBorrowSortMenu(false);
            }}
          />
          <TableBody>
            {isLoading && reserves.length === 0 ? (
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
        onShowAll={() => setMinVisibleCount(sortedData.length)}
        onShowLess={() => setMinVisibleCount(null)}
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
        onScrollToTop={() => desktopTableCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
