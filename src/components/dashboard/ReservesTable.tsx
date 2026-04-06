import { useState, useMemo, useEffect, useCallback, memo, useRef, lazy, Suspense } from 'react';

import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReserveWithSpread, TokenPricesIndex } from '@/types/aave';
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
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { openExternalUrl } from '@/lib/externalNavigation';
import { calculateDeficitShareRatio, getReserveDeficitUsdAmount } from '@/lib/deficit';
import IncentiveTooltip from './IncentiveTooltip';
import MobileReserveCard from './MobileReserveCard';
import MobileExpandedReserveShell from './MobileExpandedReserveShell';
import DesktopReserveRow from './DesktopReserveRow';
import ReservesTableMobileSortBar, {
  type MobileSortMenuKey,
  type MobileSortOption,
} from './ReservesTableMobileSortBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { getScenarioSupplySizeUsd, getTotalBorrowedUsd as getReserveTotalBorrowedUsd } from '@/lib/scenarioSize';
import {
  scrollExpandedSimulationIntoView,
  shouldScrollExpandedSimulationIntoView,
} from '@/lib/scrollExpandedSimulationIntoView';
import { createScenarioPinControllerState, transitionScenarioPinController } from '@/lib/scenarioPinController';

import PortfolioModeToggle, { type SimulationMode } from './PortfolioModeToggle';
import type { PortfolioPosition, PortfolioPositionResult, PortfolioSummary } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import { resolvePositionAmountUsd, buildPortfolioPositionResult } from '@/hooks/usePortfolioSimulation';
import { aggregatePortfolioSummary } from '@/lib/portfolioCalculator';
const PortfolioPanel = lazy(() => import('./PortfolioPanel'));

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
}: ReservesTableProps) => {
  const isMobile = useIsMobile();
  const [activeSortColumn, setActiveSortColumn] = useState<SortableColumn | null>('supply');
  const [tokenSortOrder, setTokenSortOrder] = useState<'asc' | 'desc'>('asc');
  const [marketSortOrder, setMarketSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sizeSortMode, setSizeSortMode] = useState<'supply' | 'borrow' | 'deficitRatio' | 'deficitAmount'>('supply');
  const [sizeSortOrder, setSizeSortOrder] = useState<'asc' | 'desc'>('desc');
  const [utilSortOrder, setUtilSortOrder] = useState<'asc' | 'desc'>('desc');
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

  const handleToggleExpand = useCallback((reserveId: string) => {
    if (suppressNextToggleReserveIdRef.current === reserveId) {
      suppressNextToggleReserveIdRef.current = null;
      return;
    }
    setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId));
  }, []);

  const handleMarketChipClick = useCallback((reserveId: string) => {
    // Keep the clicked row expanded across filter updates and ignore a bubbled row toggle once.
    suppressNextToggleReserveIdRef.current = reserveId;
    pendingMarketFilterPinReserveIdRef.current = reserveId;
    setExpandedReserveId(reserveId);
  }, []);

  const [tooltipState, setTooltipState] = useState<{
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
  } | null>(null);

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
        const aU = getDisplayUtilization(a) ?? -Infinity;
        const bU = getDisplayUtilization(b) ?? -Infinity;
        comparison = aU - bU;
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
  }, [reserves, activeSortColumn, tokenSortOrder, marketSortOrder, priceSortOrder, sizeSortMode, sizeSortOrder, utilSortOrder, supplySortMode, supplySortOrder, borrowSortMode, borrowSortOrder, spreadSortOrder, simulationsById, hasSharedScenario, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, debouncedSharedSupplyInput, debouncedSharedBorrowInput, sharedInputMode, meritMerklNetPosition]);

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

  useEffect(() => {
    const existsInReserves = expandedReserveId
      ? reserves.some((r) => getReserveSimulationId(r) === expandedReserveId)
      : true;
    if (!existsInReserves && pendingMarketFilterPinReserveIdRef.current === expandedReserveId) {
      pendingMarketFilterPinReserveIdRef.current = null;
    }
  }, [expandedReserveId, reserves]);

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

  const sizeSortLabel = {
    supply: 'Supply',
    borrow: 'Borrow',
    deficitRatio: 'Deficit (%)',
    deficitAmount: 'Deficit (Amount)',
  }[sizeSortMode];
  const sizeSortAccentClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-700'
      : sizeSortMode === 'borrow'
        ? 'ds-text-brand-cyan'
        : 'text-foreground';
  const sizeSortActiveHeadingClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-600 font-bold scale-105'
      : sizeSortMode === 'borrow'
        ? 'ds-text-brand-cyan font-bold scale-105'
        : 'text-foreground font-bold scale-105';
  const mobileCardDefaultTab: 'supply' | 'borrow' =
    activeSortColumn === 'borrow' || (activeSortColumn === 'size' && sizeSortMode === 'borrow')
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
            : activeSortColumn === 'util'
              ? 'Utilization'
              : 'Spread';

  const mobileExtraSortActive =
    activeSortColumn === 'spread' ||
    activeSortColumn === 'token' ||
    activeSortColumn === 'market' ||
    activeSortColumn === 'price' ||
    activeSortColumn === 'util';

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
  };

  const closeAllMobileSortMenus = useCallback((except: MobileSortMenuKey | null = null) => {
    if (except !== 'size') setShowSizeSortMenu(false);
    if (except !== 'supply') setShowSupplySortMenu(false);
    if (except !== 'borrow') setShowBorrowSortMenu(false);
    if (except !== 'extra') setShowExtraSortMenu(false);
  }, []);

  const toggleMobileSortMenu = useCallback((menu: MobileSortMenuKey) => {
    closeAllMobileSortMenus(menu);
    switch (menu) {
      case 'size':
        setShowSizeSortMenu((prev) => !prev);
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
      label: 'Borrow',
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
    {
      key: 'util',
      label: 'Utilization',
      isSelected: activeSortColumn === 'util',
      order: utilSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        if (activeSortColumn === 'util' && utilSortOrder === 'desc') {
          setUtilSortOrder('asc');
        } else {
          setActiveSortColumn('util');
          setUtilSortOrder('desc');
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
    const url = buildAaveReserveUrl({
      marketName: reserve.marketName,
      tokenAddress: reserve.tokenAddress,
    });
    if (url) {
      openExternalUrl(url, isMobile);
    }
  };

  // Auto-expand to target reserve + 5 rows buffer when scrolling to a specific reserve
  useEffect(() => {
    if (scrollToReserveId) {
      const targetIndex = sortedData.findIndex(
        (r) => `${r.marketName}-${r.tokenAddress}` === scrollToReserveId
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

  // Portfolio results computation (Phase 3)
  const { portfolioResults, portfolioSummary } = useMemo<{
    portfolioResults: PortfolioPositionResult[];
    portfolioSummary: PortfolioSummary;
  }>(() => {
    if (!isPortfolioMode || !portfolioPositions || portfolioPositions.length === 0) {
      return { portfolioResults: [], portfolioSummary: aggregatePortfolioSummary([]) };
    }
    const reserveMap = new Map(
      reserves.map((r) => [`${r.marketName}-${r.tokenAddress}`, r]),
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {onSimulationModeChange && (
          <PortfolioModeToggle
            mode={simulationMode}
            onModeChange={onSimulationModeChange}
            positionCount={portfolioPositions?.length}
          />
        )}
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
      </div>
      {isPortfolioMode && portfolioPositions && portfolioActions && (
        <Suspense fallback={<div className="h-20 rounded-xl bg-muted/50 animate-pulse" />}>
          <PortfolioPanel
            positions={portfolioPositions}
            actions={portfolioActions}
            reserves={reserves}
            positionResults={portfolioResults}
            summary={portfolioSummary}
          />
        </Suspense>
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
          className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-[var(--ds-space-3)] px-[var(--ds-space-3)] pt-1 pb-0 bg-background/80 backdrop-blur-sm"
        >
          {scenarioControls}
        </div>
        <ReservesTableMobileSortBar
          reservesCount={reserves.length}
          activeSortColumn={activeSortColumn}
          sizeSortAccentClass={sizeSortAccentClass}
          mobileExtraSortActive={mobileExtraSortActive}
          mobileExtraSortChipLabel={mobileExtraSortChipLabel}
          showSizeSortMenu={showSizeSortMenu}
          showSupplySortMenu={showSupplySortMenu}
          showBorrowSortMenu={showBorrowSortMenu}
          showExtraSortMenu={showExtraSortMenu}
          sizeSortOptions={sizeSortOptions}
          supplySortOptions={supplySortOptions}
          borrowSortOptions={borrowSortOptions}
          extraSortOptions={extraSortOptions}
          onToggleMenu={toggleMobileSortMenu}
          onCloseMenus={closeAllMobileSortMenus}
        />
        
        {/* 2x2 Grid layout for mobile */}
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          {isLoading && reserves.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/60 ds-card-pad-sm">
                <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
                  <Skeleton variant="gradient" className="w-8 h-8 rounded-full border-transparent shrink-0" />
                  <div className="space-y-1 flex-1 min-w-0">
                    <Skeleton variant="gradient" className="h-4 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-20 rounded-md" />
                  </div>
                  <Skeleton variant="subtle" className="w-7 h-7 rounded-full border-border/60 shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
                  <div className="space-y-1">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                  </div>
                  <div className="space-y-1 items-center flex flex-col">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="subtle" className="h-4 w-14 rounded-md" />
                  </div>
                  <div className="space-y-1 flex flex-col items-end">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            (() => {
              const nodes: React.ReactNode[] = [];
              // Process cards in pairs (rows of 2) for connected layout
              for (let i = 0; i < displayData.length; i += 2) {
                const leftReserve = displayData[i];
                const leftId = `${leftReserve.marketName}-${leftReserve.tokenAddress}`;
                const rightReserve = i + 1 < displayData.length ? displayData[i + 1] : null;
                const rightId = rightReserve ? `${rightReserve.marketName}-${rightReserve.tokenAddress}` : null;

                const leftExpanded = leftId === expandedReserveId;
                const rightExpanded = rightId !== null && rightId === expandedReserveId;
                const rowHasExpanded = leftExpanded || rightExpanded;

                const isLeftActive = leftExpanded;
                const isRightActive = rightExpanded;
                const activeReserve = isLeftActive ? leftReserve : rightReserve;
                const activeId = isLeftActive ? leftId : rightId;
                const leftCard = (
                  <MobileReserveCard
                    variant={isLeftActive ? 'upperOnly' : 'full'}
                    connectedBelow={leftExpanded}
                    reserve={leftReserve}
                    isApy={isApy}
                    tydroPointToUsdRate={tydroPointToUsdRate}
                    onIncentiveClick={handleIncentiveClick}
                    isSimulationExpanded={isLeftActive}
                    onToggleSimulation={() => handleToggleExpand(leftId)}
                    simulation={simulationsById[leftId]}
                    supplyInput={debouncedSharedSupplyInput}
                    borrowInput={debouncedSharedBorrowInput}
                    hasSharedScenario={hasSharedScenario}
                    inputMode={sharedInputMode}
                    onCorrectSupplyInput={handleCorrectSupplyInput}
                    onCorrectBorrowInput={handleCorrectBorrowInput}
                    defaultTab={mobileCardDefaultTab}
                  />
                );
                const rightCard = rightReserve ? (
                  <MobileReserveCard
                    variant={isRightActive ? 'upperOnly' : 'full'}
                    connectedBelow={rightExpanded}
                    reserve={rightReserve}
                    isApy={isApy}
                    tydroPointToUsdRate={tydroPointToUsdRate}
                    onIncentiveClick={handleIncentiveClick}
                    isSimulationExpanded={isRightActive}
                    onToggleSimulation={() => handleToggleExpand(rightId!)}
                    simulation={simulationsById[rightId!]}
                    supplyInput={debouncedSharedSupplyInput}
                    borrowInput={debouncedSharedBorrowInput}
                    hasSharedScenario={hasSharedScenario}
                    inputMode={sharedInputMode}
                    onCorrectSupplyInput={handleCorrectSupplyInput}
                    onCorrectBorrowInput={handleCorrectBorrowInput}
                    defaultTab={mobileCardDefaultTab}
                  />
                ) : null;

                nodes.push(
                  <div
                    key={`row-${i}`}
                    className="col-span-2"
                    data-reserve-expanded-anchor={activeId ?? undefined}
                  >
                    {rowHasExpanded && activeReserve && activeId ? (
                      <MobileExpandedReserveShell
                        side={leftExpanded ? 'left' : 'right'}
                        upper={leftExpanded ? leftCard : rightCard}
                        sibling={leftExpanded ? rightCard : leftCard}
                        panel={
                          <MobileReserveCard
                            variant="simulationOnly"
                            reserve={activeReserve}
                            isApy={isApy}
                            tydroPointToUsdRate={tydroPointToUsdRate}
                            onIncentiveClick={handleIncentiveClick}
                            isSimulationExpanded
                            onToggleSimulation={() => handleToggleExpand(activeId)}
                            simulation={simulationsById[activeId]}
                            supplyInput={debouncedSharedSupplyInput}
                            borrowInput={debouncedSharedBorrowInput}
                            hasSharedScenario={hasSharedScenario}
                            inputMode={sharedInputMode}
                            onCorrectSupplyInput={handleCorrectSupplyInput}
                            onCorrectBorrowInput={handleCorrectBorrowInput}
                            defaultTab={mobileCardDefaultTab}
                          />
                        }
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
                        <div className="min-w-0">{leftCard}</div>
                        {rightCard ? <div className="min-w-0">{rightCard}</div> : null}
                      </div>
                    )}
                  </div>
                );
              }
              return nodes;
            })()
          )}
        </div>
        
        {/* Show More/Less button for mobile */}
        {sortedData.length > displayData.length && (
          <button
            type="button"
            onClick={() => setMinVisibleCount(sortedData.length)}
            className="w-full mt-[var(--ds-space-4)] ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{`Show ${sortedData.length - displayData.length} More Reserves`}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        {showAll && sortedData.length > DEFAULT_VISIBLE_COUNT && (
          <button
            type="button"
            onClick={() => setMinVisibleCount(null)}
            className="w-full mt-[var(--ds-space-4)] ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>Show Less</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        
        {tooltipState && (
          <IncentiveTooltip
            reserve={tooltipState.reserve}
            type={tooltipState.type}
            position={tooltipState.position}
            triggerCenterX={tooltipState.triggerCenterX}
            triggerHeight={tooltipState.triggerHeight}
            triggerRect={tooltipState.triggerRect}
            accentTextClass={tooltipState.type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan'}
            accentBgClass={tooltipState.type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10'}
            onClose={() => setTooltipState(null)}
            isApy={isApy}
            tydroPointToUsdRate={tydroPointToUsdRate}
            whitelistMerklCampaignIds={whitelistMerklCampaignIds}
            onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign}
          />
        )}

        {/* Floating scroll-to-top / scroll-to-bottom buttons (mobile) */}
        {tableInView && (
        <div className="fixed right-3 bottom-6 z-30 flex flex-col gap-2">
          <button
            type="button"
            aria-label="Scroll to table top"
            onClick={() => mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-md backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll to table bottom"
            onClick={() => mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-md backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        )}
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
            {/* 左边三列再宽松，右边三列（Supply/Spread/Borrow）稍紧凑，合计 100% */}
            <col style={{ width: '13%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '11.5%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13.5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14.5%' }} />
          </colgroup>
          <TableHeader
            ref={desktopStickyTheadRef}
            data-reserves-sticky-thead
            className="overflow-visible [&_tr]:border-b-0 [&_th]:sticky [&_th]:z-30 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-card [&_th]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_th]:[top:var(--reserves-sticky-scenario-height,4.5rem)]"
          >
            <TableRow className="border-0 bg-card overflow-visible hover:bg-card">
              {/* Token — 大幅收窄 */}
              <TableHead className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-0-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={handleSortToken}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
                    activeSortColumn === 'token' 
                      ? 'text-foreground font-bold scale-105' 
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Token</span>
                  {activeSortColumn === 'token' ? (
                    tokenSortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Price — 大幅收窄 */}
              <TableHead className="px-[var(--ds-space-0-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortPrice}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
                    activeSortColumn === 'price' 
                      ? 'text-foreground font-bold scale-105' 
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Price</span>
                  {activeSortColumn === 'price' ? (
                    priceSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Market — 大幅收窄 */}
              <TableHead className="pl-[var(--ds-space-0-5)] pr-[var(--ds-space-1)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortMarket}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
                    activeSortColumn === 'market'
                      ? 'text-foreground font-bold scale-105'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Market</span>
                  {activeSortColumn === 'market' ? (
                    marketSortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Size */}
              <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)]">
                    <span
                      className={`transition-all duration-200 ${activeSortColumn === 'size' ? sizeSortActiveHeadingClass : 'text-muted-foreground'}`}
                    >
                      Size
                    </span>
                    <div className="relative">
                      <button
                        ref={sizeSortButtonRef}
                        type="button"
                        onClick={() => setShowSizeSortMenu(!showSizeSortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showSizeSortMenu || activeSortColumn === 'size'
                            ? `bg-card/60 border-border/70 ${sizeSortAccentClass}`
                            : 'bg-card/60 border-border/70 text-muted-foreground'
                        }`}
                        title="Select sort field"
                      >
                        <span className="font-semibold">{sizeSortLabel}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {showSizeSortMenu && sizeMenuPos && createPortal(
                        <>
                          <div
                            className="fixed inset-0 z-[9999]"
                            onClick={() => setShowSizeSortMenu(false)}
                          />
                          <div 
                            className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[140px]"
                            style={{ top: sizeMenuPos.top, left: sizeMenuPos.left }}
                          >
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                sizeSortMode === 'supply' && activeSortColumn === 'size'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Supply</span>
                              {sizeSortMode === 'supply' && activeSortColumn === 'size' ? (
                                sizeSortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                sizeSortMode === 'borrow' && activeSortColumn === 'size'
                                  ? 'ds-text-brand-cyan font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Borrow</span>
                              {sizeSortMode === 'borrow' && activeSortColumn === 'size' ? (
                                sizeSortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                                sizeSortMode === 'deficitAmount' && activeSortColumn === 'size'
                                  ? 'text-foreground font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Deficit</span>
                              {sizeSortMode === 'deficitAmount' && activeSortColumn === 'size' ? (
                                sizeSortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-foreground" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-foreground" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                                sizeSortMode === 'deficitRatio' && activeSortColumn === 'size'
                                  ? 'text-foreground font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Deficit (%)</span>
                              {sizeSortMode === 'deficitRatio' && activeSortColumn === 'size' ? (
                                sizeSortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-foreground" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-foreground" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                          </div>
                        </>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
              </TableHead>
              {/* Utilization */}
              <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortUtil}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
                    activeSortColumn === 'util' 
                      ? 'text-foreground font-bold scale-105' 
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Utilization</span>
                  {activeSortColumn === 'util' ? (
                    utilSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Supply */}
              <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
                <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)]">
                    <span
                      className={`transition-all duration-200 ${activeSortColumn === 'supply' ? 'ds-text-emerald-600 font-bold scale-105' : 'text-muted-foreground'}`}
                    >
                      Supply
                    </span>
                    <div className="relative">
                      <button
                        ref={supplySortButtonRef}
                        type="button"
                        onClick={() => setShowSupplySortMenu(!showSupplySortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showSupplySortMenu || activeSortColumn === 'supply'
                            ? 'bg-card/60 border-border/70 ds-text-emerald-700'
                            : 'bg-card/60 border-border/70 text-muted-foreground'
                        }`}
                        title="Select sort field"
                      >
                        <span className="font-semibold">{supplySortLabel}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {showSupplySortMenu && supplyMenuPos && createPortal(
                        <>
                          <div
                            className="fixed inset-0 z-[9999]"
                            onClick={() => setShowSupplySortMenu(false)}
                          />
                          <div 
                            className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[140px]"
                            style={{ top: supplyMenuPos.top, left: supplyMenuPos.left }}
                          >
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'total' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Total</span>
                              {supplySortMode === 'total' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'native' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Native</span>
                              {supplySortMode === 'native' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'incentive' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Incentive</span>
                              {supplySortMode === 'incentive' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                          </div>
                        </>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
              </TableHead>
              {/* Spread */}
              <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSortColumn === 'spread') {
                      toggleSpreadSortOrder();
                    } else {
                      collapseExpandedOnSort();
                      setActiveSortColumn('spread');
                      setSpreadSortOrder('desc');
                    }
                  }}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
                    activeSortColumn === 'spread' ? 'ds-text-purple-600 font-bold scale-105' : 'text-muted-foreground'
                  }`}
                >
                  <span>Spread</span>
                  {activeSortColumn === 'spread' ? (
                    spreadSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Borrow */}
              <TableHead className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-2)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
                <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)]">
                    <span
                      className={`transition-all duration-200 ${activeSortColumn === 'borrow' ? 'ds-text-brand-cyan font-bold scale-105' : 'text-muted-foreground'}`}
                    >
                      Borrow
                    </span>
                    <div className="relative">
                      <button
                        ref={borrowSortButtonRef}
                        type="button"
                        onClick={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showBorrowSortMenu || activeSortColumn === 'borrow'
                            ? 'bg-card/60 border-border/70 ds-text-brand-cyan'
                            : 'bg-card/60 border-border/70 text-muted-foreground'
                        }`}
                        title="Select sort field"
                      >
                        <span className="font-semibold">{borrowSortLabel}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                        {showBorrowSortMenu && borrowMenuPos && createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-[9999]"
                              onClick={() => setShowBorrowSortMenu(false)}
                            />
                            <div 
                              className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[140px]"
                              style={{ top: borrowMenuPos.top, left: borrowMenuPos.left }}
                            >
                              <button
                                type="button"
                                onClick={() => {
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'total' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Total</span>
                                {borrowSortMode === 'total' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'native' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Native</span>
                                {borrowSortMode === 'native' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'incentive' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Incentive</span>
                                {borrowSortMode === 'incentive' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && reserves.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/30">
                  <TableCell className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-0-5)] ds-row-pad text-center">
                    <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                      <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
                      <Skeleton variant="default" className="h-4 w-14 rounded-md" />
                    </div>
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-0-5)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
                  </TableCell>
                  <TableCell className="pl-[var(--ds-space-0-5)] pr-[var(--ds-space-1)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className={`h-5 rounded-md mx-auto ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 3 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                  <TableCell className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-2)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-12 rounded-md mx-auto" />
                  </TableCell>
                </TableRow>
              ))
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
                />
              );
            })
            }
          </TableBody>
        </Table>

      {/* Show More/Less button for desktop */}
      {sortedData.length > displayData.length && (
        <div className="p-[var(--ds-space-4)] border-t border-border">
          <button
            type="button"
            onClick={() => setMinVisibleCount(sortedData.length)}
            className="w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{`Show ${sortedData.length - displayData.length} More Reserves`}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      {showAll && sortedData.length > DEFAULT_VISIBLE_COUNT && (
        <div className="p-[var(--ds-space-4)] border-t border-border">
          <button
            type="button"
            onClick={() => setMinVisibleCount(null)}
            className="w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>Show Less</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div ref={desktopTableBottomAnchorRef} aria-hidden className="h-px w-full" />

      {/* Spacer: ensures enough scroll room to pin-scroll the last expanded row to the sticky band */}
      {expandedReserveId && (
        <div aria-hidden style={{ height: 'calc(100dvh - var(--reserves-expanded-main-row-top, 5.75rem))' }} />
      )}

      {tooltipState && (
        <IncentiveTooltip
          reserve={tooltipState.reserve}
          type={tooltipState.type}
          position={tooltipState.position}
          triggerCenterX={tooltipState.triggerCenterX}
          triggerHeight={tooltipState.triggerHeight}
          triggerRect={tooltipState.triggerRect}
          accentTextClass={tooltipState.type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan'}
          accentBgClass={tooltipState.type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10'}
          onClose={() => setTooltipState(null)}
          isApy={isApy}
          tydroPointToUsdRate={tydroPointToUsdRate}
          whitelistMerklCampaignIds={whitelistMerklCampaignIds}
          onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign}
        />
      )}

      {/* Floating scroll-to-top / scroll-to-bottom buttons */}
      {tableInView && (
      <div className="fixed right-3 bottom-6 z-30 flex flex-col gap-2 md:right-6">
        <button
          type="button"
          aria-label="Scroll to table top"
          onClick={() => {
            desktopTableCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-md backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Scroll to table bottom"
          onClick={() => {
            const target = desktopTableBottomAnchorRef.current ?? desktopTableCardRef.current;
            target?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-md backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      )}
      </div>
    </div>
  );
};

export default ReservesTable;
