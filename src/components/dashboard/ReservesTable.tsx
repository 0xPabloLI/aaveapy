import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';

import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES, TokenPricesIndex } from '@/types/aave';
import {
  formatPercent,
  formatSpread,
  formatUsd,
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  resolveVisibleIncentiveBadgeValue,
} from '@/lib/formatters';
import ScenarioControls, { type ScenarioControlsHandle } from './ScenarioControls';
import { compareIncentiveWithNative } from '@/lib/sorters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { openExternalUrl } from '@/lib/externalNavigation';
import IncentiveTooltip from './IncentiveTooltip';
import MobileReserveCard from './MobileReserveCard';
import DesktopReserveRow from './DesktopReserveRow';
import { useIsMobile } from '@/hooks/use-mobile';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { getScenarioSupplySizeUsd, getTotalBorrowedUsd as getReserveTotalBorrowedUsd } from '@/lib/scenarioSize';
import { scrollExpandedSimulationIntoView } from '@/lib/scrollExpandedSimulationIntoView';

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
}: ReservesTableProps) => {
  const isMobile = useIsMobile();
  const [activeSortColumn, setActiveSortColumn] = useState<SortableColumn | null>('supply');
  const [tokenSortOrder, setTokenSortOrder] = useState<'asc' | 'desc'>('asc');
  const [marketSortOrder, setMarketSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sizeSortMode, setSizeSortMode] = useState<'supply' | 'borrow'>('supply');
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
  const borrowSortButtonRef = useRef<HTMLButtonElement>(null);
  const supplySortButtonRef = useRef<HTMLButtonElement>(null);
  const scenarioControlsRef = useRef<ScenarioControlsHandle>(null);
  const lastScenarioKeyForPinScrollRef = useRef<string | null>(null);
  const lastSortedIdsForPinScrollRef = useRef<string[]>([]);
  const scenarioPinScrollBaselineReadyRef = useRef(false);
  const scenarioNeedsPinScrollRef = useRef(false);
  const lastReservesKeyForFilterPinRef = useRef<string | null>(null);
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
    if (col === 'size' && sizeSortMode === 'borrow') return false;
    return true;
  }, [hasSharedScenario, activeSortColumn, sizeSortMode]);

  const schedulePinScrollToReserve = useCallback((reserveId: string, delayMs: number) => {
    const mode = isMobile ? 'minimal-if-clipped' : 'pin-main-row-top';
    const escapeId = (raw: string) => (
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(raw) : raw
    );
    const escapedId = escapeId(reserveId);

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 12;
    const retryMs = 70;

    const runAttempt = () => {
      if (cancelled) return;
      const anchor = document.querySelector(`[data-reserve-expanded-anchor="${escapedId}"]`);
      const row = document.querySelector(`tr[data-reserve-id="${escapedId}"]`);
      if (anchor instanceof HTMLElement || row instanceof HTMLElement) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollExpandedSimulationIntoView(reserveId, { mode }));
        });
        return;
      }
      attempt += 1;
      if (attempt >= maxAttempts) return;
      window.setTimeout(runAttempt, retryMs);
    };

    const starter = window.setTimeout(runAttempt, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(starter);
    };
  }, [isMobile]);

  const getMarketDisplayName = (reserve: ReserveWithSpread) => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  // Helper: Get incentive values for a reserve (supply or borrow)
  const getIncentiveValues = (reserve: ReserveWithSpread, type: 'supply' | 'borrow') => {
    const protocolIncentives = type === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
    const meritIncentives = type === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
    const merklOpportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    const brevisIncentives = type === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
    return {
      apr: calculateTotalIncentiveApr(
        meritIncentives,
        merklOpportunities,
        brevisIncentives,
        protocolIncentives,
        tydroPointToUsdRate,
        { whitelistMerklCampaignIds }
      ),
      apy: calculateTotalIncentiveApy(
        meritIncentives,
        merklOpportunities,
        brevisIncentives,
        protocolIncentives,
        tydroPointToUsdRate,
        { whitelistMerklCampaignIds }
      ),
    };
  };

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
    const prevIds = lastSortedIdsForPinScrollRef.current;
    const orderChanged =
      prevIds.length !== ids.length || prevIds.some((id, i) => id !== ids[i]);

    if (!scenarioPinScrollBaselineReadyRef.current) {
      lastScenarioKeyForPinScrollRef.current = scenarioKey;
      lastSortedIdsForPinScrollRef.current = ids;
      scenarioPinScrollBaselineReadyRef.current = true;
      return;
    }

    const scenarioChanged = scenarioKey !== lastScenarioKeyForPinScrollRef.current;
    if (scenarioChanged) {
      lastScenarioKeyForPinScrollRef.current = scenarioKey;
      scenarioNeedsPinScrollRef.current = true;
    }

    if (scenarioNeedsPinScrollRef.current && !orderChanged) {
      lastSortedIdsForPinScrollRef.current = ids;
      return;
    }

    if (scenarioChanged || scenarioNeedsPinScrollRef.current) {
      lastSortedIdsForPinScrollRef.current = ids;
      if (
        orderChanged &&
        scenarioNeedsPinScrollRef.current &&
        expandScrollFollowsScenarioSort &&
        expandedReserveId
      ) {
        scenarioNeedsPinScrollRef.current = false;
        return schedulePinScrollToReserve(expandedReserveId, 320);
      }
      scenarioNeedsPinScrollRef.current = false;
      return;
    }

    lastSortedIdsForPinScrollRef.current = ids;
  }, [
    debouncedSharedSupplyInput,
    debouncedSharedBorrowInput,
    sharedInputMode,
    meritMerklNetPosition,
    sortedData,
    expandedReserveId,
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
    return schedulePinScrollToReserve(targetReserveId, 280);
  }, [reserves, sortedData, expandedReserveId, schedulePinScrollToReserve]);

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
  }[sizeSortMode];
  const mobileCardDefaultTab: 'supply' | 'borrow' =
    activeSortColumn === 'borrow' || (activeSortColumn === 'size' && sizeSortMode === 'borrow')
      ? 'borrow'
      : 'supply';

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

  // Mobile card view with tooltip support
  const handleMobileIncentiveClick = (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => {
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

  const scenarioControls = (
    <ScenarioControls
      ref={scenarioControlsRef}
      onDebouncedChange={handleScenarioChange}
      meritMerklNetPosition={meritMerklNetPosition}
      onMeritMerklNetPositionChange={setMeritMerklNetPosition}
    />
  );

  const desktopTableCardRef = useRef<HTMLDivElement>(null);
  const desktopStickyScenarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobile) return;
    const stickyEl = desktopStickyScenarioRef.current;
    const card = desktopTableCardRef.current;
    if (!stickyEl || !card) return undefined;
    const apply = () => {
      card.style.setProperty(
        '--reserves-sticky-scenario-height',
        `${stickyEl.getBoundingClientRect().height}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stickyEl);
    return () => {
      ro.disconnect();
      card.style.removeProperty('--reserves-sticky-scenario-height');
    };
  }, [isMobile]);

  // Mobile card view — extra bottom padding so content isn't hidden by browser/safe area
  if (isMobile) {
    return (
      <div className="space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]">
        <div
          data-reserves-sticky-scenario
          className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-[var(--ds-space-3)] px-[var(--ds-space-3)] pt-1 pb-0 bg-background/80 backdrop-blur-sm"
        >
          {scenarioControls}
        </div>
        {/* Header with sorting controls */}
        <div className="flex justify-between items-center px-[var(--ds-space-1)]">
          <h3 className="ds-text-14 font-bold text-foreground">{reserves.length} Reserves</h3>
          <div className="flex items-center gap-[var(--ds-space-1-5)]">
            {/* Size sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSizeSortMenu(!showSizeSortMenu);
                  setShowSupplySortMenu(false);
                  setShowBorrowSortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'size'
                    ? sizeSortMode === 'supply'
                      ? 'bg-card/60 border-border/70 ds-text-emerald-700 font-semibold'
                      : 'bg-card/60 border-border/70 ds-text-brand-cyan font-semibold'
                    : 'bg-card border-border text-muted-foreground font-medium'
                }`}
              >
                <span>Size</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSizeSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSizeSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    <button
                      type="button"
                      onClick={() => {
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
                      className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                        sizeSortMode === 'supply' && activeSortColumn === 'size'
                          ? 'ds-text-emerald-600 font-bold bg-card/60'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <span>Supply</span>
                      {sizeSortMode === 'supply' && activeSortColumn === 'size' ? (
                        sizeSortOrder === 'desc' ? (
                          <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                        ) : (
                          <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                        )
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
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
                      className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                        sizeSortMode === 'borrow' && activeSortColumn === 'size'
                          ? 'ds-text-brand-cyan font-bold bg-card/60'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <span>Borrow</span>
                      {sizeSortMode === 'borrow' && activeSortColumn === 'size' ? (
                        sizeSortOrder === 'desc' ? (
                          <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                        ) : (
                          <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                        )
                      ) : null}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Supply sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSupplySortMenu(!showSupplySortMenu);
                  setShowBorrowSortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'supply'
                    ? 'bg-card/60 border-border/70 ds-text-emerald-700 font-semibold'
                    : 'bg-card border-border text-muted-foreground font-medium'
                }`}
              >
                <span>Supply</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSupplySortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSupplySortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = supplySortMode === mode && activeSortColumn === 'supply';
                      const getColorClass = () => 'ds-text-emerald-600';
                      return (
                      <button
                          type="button"
                          key={mode}
                          onClick={() => {
                            if (isAlreadySelected && supplySortOrder === 'desc') {
                              setSupplySortOrder('asc');
                            } else {
                              setSupplySortMode(mode);
                              setActiveSortColumn('supply');
                              setSupplySortOrder('desc');
                            }
                            setShowSupplySortMenu(false);
                          }}
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-card/60`
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                          {isAlreadySelected && (
                            supplySortOrder === 'desc' ? (
                              <ArrowDown className={`w-3 h-3 ${getColorClass()}`} />
                            ) : (
                              <ArrowUp className={`w-3 h-3 ${getColorClass()}`} />
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            {/* Borrow sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowBorrowSortMenu(!showBorrowSortMenu);
                  setShowSupplySortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'borrow'
                    ? 'bg-card/60 border-border/70 ds-text-brand-cyan font-semibold'
                    : 'bg-card border-border text-muted-foreground font-medium'
                }`}
              >
                <span>Borrow</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBorrowSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowBorrowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = borrowSortMode === mode && activeSortColumn === 'borrow';
                      const getColorClass = () => 'ds-text-brand-cyan';
                      return (
                      <button
                          type="button"
                          key={mode}
                          onClick={() => {
                            if (isAlreadySelected && borrowSortOrder === 'desc') {
                              setBorrowSortOrder('asc');
                            } else {
                              setBorrowSortMode(mode);
                              setActiveSortColumn('borrow');
                              setBorrowSortOrder('desc');
                            }
                            setShowBorrowSortMenu(false);
                          }}
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-card/60`
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                          {isAlreadySelected && (
                            borrowSortOrder === 'desc' ? (
                              <ArrowDown className={`w-3 h-3 ${getColorClass()}`} />
                            ) : (
                              <ArrowUp className={`w-3 h-3 ${getColorClass()}`} />
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Spread sort button */}
            <button
              type="button"
              onClick={() => {
                if (activeSortColumn === 'spread') {
                  toggleSpreadSortOrder();
                } else {
                  setActiveSortColumn('spread');
                  setSpreadSortOrder('desc');
                }
              }}
              className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                activeSortColumn === 'spread'
                  ? 'bg-card/60 border-border/70 ds-text-purple-700 font-semibold'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/60 font-medium'
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
          </div>
        </div>
        
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

                if (rowHasExpanded) {
                  const isLeftActive = leftExpanded;
                  const activeReserve = isLeftActive ? leftReserve : rightReserve!;
                  const activeId = isLeftActive ? leftId : rightId!;
                  /** Matches `grid-cols-2 gap-[--ds-space-2]`: one column width (connector under expanded card only). */
                  const pairColWidth = 'calc((100% - var(--ds-space-2)) / 2)';
                  const bridgeOnExpandedColumn = leftExpanded || !rightReserve;

                  nodes.push(
                    <div
                      key={`row-${i}`}
                      className="col-span-2"
                      data-reserve-expanded-anchor={activeId}
                    >
                      <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
                        <div className="min-w-0">
                          <MobileReserveCard
                            variant={isLeftActive ? 'upperOnly' : 'full'}
                            connectedBelow={leftExpanded}
                            reserve={leftReserve}
                            isApy={isApy}
                            tydroPointToUsdRate={tydroPointToUsdRate}
                            onIncentiveClick={handleMobileIncentiveClick}
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
                        </div>
                        {rightReserve ? (
                          <div className="min-w-0">
                            <MobileReserveCard
                              variant={!isLeftActive ? 'upperOnly' : 'full'}
                              connectedBelow={rightExpanded}
                              reserve={rightReserve}
                              isApy={isApy}
                              tydroPointToUsdRate={tydroPointToUsdRate}
                              onIncentiveClick={handleMobileIncentiveClick}
                              isSimulationExpanded={!isLeftActive}
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
                          </div>
                        ) : null}
                      </div>
                      {/* Full-width simulation (table needs width). mt clears peer card; bridge fills gap on expanded column only. */}
                      <div className="relative isolate mt-[var(--ds-space-2)]">
                        {/* Bridge background and outer border */}
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute z-10 border-border/60 bg-card ${bridgeOnExpandedColumn ? 'left-0 border-l' : 'right-0 border-r'}`}
                          style={{
                            top: 'calc(-1 * var(--ds-space-2))',
                            height: 'calc(var(--ds-space-2) + 1px)',
                            width: pairColWidth,
                            borderBottom: 'none',
                            borderTop: 'none',
                          }}
                        />
                        
                        {/* Single continuous SVG for Inner Fillet + Horizontal connection */}
                        <svg
                          className="absolute pointer-events-none z-10 overflow-visible"
                          width="17"
                          height="9"
                          viewBox="0 0 17 9"
                          style={{
                            top: 'calc(-1 * var(--ds-space-2))',
                            ...(bridgeOnExpandedColumn 
                              ? { left: `calc(${pairColWidth} - 1px)` } 
                              : { right: `calc(${pairColWidth} - 1px)` })
                          }}
                          aria-hidden="true"
                        >
                          {bridgeOnExpandedColumn ? (
                            <>
                              <path d="M 0 0.5 L 0 9 L 17 9 L 17 8 L 8.5 8 A 7.5 7.5 0 0 1 1 0.5 L 0 0.5 Z" style={{ fill: 'hsl(var(--card))' }} />
                              <path d="M 0.5 0 L 0.5 0.5 A 8 8 0 0 0 8.5 8.5 L 17 8.5" fill="none" style={{ stroke: 'hsl(var(--border) / 0.6)', strokeWidth: 1 }} />
                            </>
                          ) : (
                            <>
                              <path d="M 17 0.5 L 17 9 L 0 9 L 0 8 L 8.5 8 A 7.5 7.5 0 0 0 16 0.5 L 17 0.5 Z" style={{ fill: 'hsl(var(--card))' }} />
                              <path d="M 16.5 0 L 16.5 0.5 A 8 8 0 0 1 8.5 8.5 L 0 8.5" fill="none" style={{ stroke: 'hsl(var(--border) / 0.6)', strokeWidth: 1 }} />
                            </>
                          )}
                        </svg>

                        <div
                          className={`relative z-0 overflow-hidden rounded-b-xl border border-border/60 bg-card ds-card-pad-sm ${
                            bridgeOnExpandedColumn ? 'rounded-tr-xl rounded-tl-none' : 'rounded-tl-xl rounded-tr-none'
                          }`}
                          style={{
                            paddingTop: 'var(--ds-space-2)',
                            clipPath: bridgeOnExpandedColumn 
                              ? `polygon(0 1px, calc(${pairColWidth} + 16px) 1px, calc(${pairColWidth} + 16px) 0, 100% 0, 100% 100%, 0 100%)`
                              : `polygon(0 0, calc(100% - ${pairColWidth} - 16px) 0, calc(100% - ${pairColWidth} - 16px) 1px, 100% 1px, 100% 100%, 0 100%)`
                          }}
                        >
                          <MobileReserveCard
                            variant="simulationOnly"
                            reserve={activeReserve}
                            isApy={isApy}
                            tydroPointToUsdRate={tydroPointToUsdRate}
                            onIncentiveClick={handleMobileIncentiveClick}
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
                        </div>
                        {rightReserve ? (
                          <div
                            aria-hidden
                            className={`pointer-events-none absolute top-0 z-[1] h-px bg-border/60 ${leftExpanded ? 'right-0 rounded-tl-xl' : 'left-0 rounded-tr-xl'}`}
                            style={{ width: pairColWidth }}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                } else {
                  // Normal pair — no expansion
                  nodes.push(
                    <div key={leftId}>
                      <MobileReserveCard
                        variant="full"
                        reserve={leftReserve}
                        isApy={isApy}
                        tydroPointToUsdRate={tydroPointToUsdRate}
                        onIncentiveClick={handleMobileIncentiveClick}
                        isSimulationExpanded={false}
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
                    </div>
                  );
                  if (rightReserve) {
                    nodes.push(
                      <div key={rightId}>
                        <MobileReserveCard
                          variant="full"
                          reserve={rightReserve}
                          isApy={isApy}
                          tydroPointToUsdRate={tydroPointToUsdRate}
                          onIncentiveClick={handleMobileIncentiveClick}
                          isSimulationExpanded={false}
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
                      </div>
                    );
                  }
                }
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
      </div>
    );
  }


  return (
    <div
      ref={desktopTableCardRef}
      className="bg-card rounded-2xl shadow-sm border border-border/60 relative"
    >
      <div
        ref={desktopStickyScenarioRef}
        data-reserves-sticky-scenario
        className="sticky top-0 z-20 border-b border-border/60 p-[var(--ds-space-3)] bg-muted/40 backdrop-blur-sm shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]"
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
            data-reserves-sticky-thead
            className="overflow-visible [&_tr]:border-b-0 [&_th]:sticky [&_th]:z-10 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-card [&_th]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_th]:[top:var(--reserves-sticky-scenario-height,4.5rem)]"
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
                      className={`transition-all duration-200 ${activeSortColumn === 'size' ? (sizeSortMode === 'supply' ? 'ds-text-emerald-600 font-bold scale-105' : 'ds-text-brand-cyan font-bold scale-105') : 'text-muted-foreground'}`}
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
                            ? sizeSortMode === 'supply'
                              ? 'bg-card/60 border-border/70 ds-text-emerald-700'
                              : 'bg-card/60 border-border/70 ds-text-brand-cyan'
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
                  <span>Util.</span>
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
    </div>
  );
};

export default ReservesTable;
