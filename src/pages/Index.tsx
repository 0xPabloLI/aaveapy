import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { usePreloadPoolAssets } from '@/hooks/usePreloadPoolAssets';
import { useAaveMarkets, useAaveMarketStats, useAaveMarketsList } from '@/hooks/useAaveMarkets';
import { useQueryClient } from '@tanstack/react-query';
import { SortField, SortOrder, TokenCategory, PoolWithSpread } from '@/types/aave';
import {
  buildTokenCategoryGroups,
  isStablecoinSymbol,
  isEthRelatedSymbol,
  isBtcRelatedSymbol,
  isPendleSymbol,
} from '@/lib/tokenCategories';
import { useTokenCategories } from '@/hooks/useTokenCategories';
import Header from '@/components/dashboard/Header';
import FilterBar from '@/components/dashboard/FilterBar';
import TopOpportunities from '@/components/dashboard/TopOpportunities';
import PoolsTable from '@/components/dashboard/PoolsTable';
import LoadingState from '@/components/dashboard/LoadingState';
import PullToRefresh from '@/components/dashboard/PullToRefresh';
import { getCachedMarkets, getCachedMarketStats, getCachedMarketsList, setCachedTydroRate } from '@/lib/cache';
import { TYDRO_POINT_TO_USD_RATE } from '@/lib/tydro';
import { AlertTriangle } from 'lucide-react';
import { preloadChainIcons, preloadIncentiveIcons } from '@/lib/preloadUtils';

// Lazy load non-critical components (only for components not visible on initial render)
const IncentiveTooltip = lazy(() => import('@/components/dashboard/IncentiveTooltip'));
// InkAprCalculator is always visible, so load it eagerly
import InkAprCalculator from '@/components/dashboard/InkAprCalculator';

const Index = () => {
  // State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>('all');
  const [isApy, setIsApy] = useState(true);
  const [showCacheWarning, setShowCacheWarning] = useState(false);
  const [showMarketsExpanded, setShowMarketsExpanded] = useState(false);
  const [isRateDragging, setIsRateDragging] = useState(false);
  const [topTooltipState, setTopTooltipState] = useState<{
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  } | null>(null);
  // Always start at FDV default 1 on load/refresh (do not restore from cache)
  const [tydroPointToUsdRateInput, setTydroPointToUsdRateInput] = useState('1.0000');
  const tydroPointToUsdRate = useMemo(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (Number.isNaN(parsed)) return TYDRO_POINT_TO_USD_RATE;
    return Math.max(parsed, 0);
  }, [tydroPointToUsdRateInput]);

  // Persist Tydro rate to localStorage when it changes
  useEffect(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setCachedTydroRate(parsed);
    }
  }, [tydroPointToUsdRateInput]);

  const queryClient = useQueryClient();

  // Fetch data - no sort params, all sorting done on frontend
  // This allows the table's total/native/incentive mode to work correctly
  const { data: poolsData, isLoading, error, isError, refetch } = useAaveMarkets();
  const { data: stats, refetch: refetchStats } = useAaveMarketStats();
  const { data: marketsList, refetch: refetchMarketsList } = useAaveMarketsList();
  const { data: tokenCategoryOverrides } = useTokenCategories();

  // Get cached data as fallback
  const cachedPoolsData = useMemo(() => getCachedMarkets(), []);
  const cachedStats = useMemo(() => getCachedMarketStats(), []);
  const cachedMarketsList = useMemo(() => getCachedMarketsList(), []);

  // Use actual data if available, otherwise fall back to cache
  const effectivePoolsData = poolsData || cachedPoolsData;
  const effectiveStats = stats || cachedStats;
  const effectiveMarketsList = marketsList || cachedMarketsList;

  const orderedMarkets = useMemo(() => {
    const list = effectiveMarketsList || [];
    const ethereum = list.filter((market) => market.chainName === 'Ethereum');
    const others = list.filter((market) => market.chainName !== 'Ethereum');
    return [...ethereum, ...others];
  }, [effectiveMarketsList]);

  const hiddenMarketNames = useMemo(
    () => orderedMarkets.slice(6).map((market) => market.marketName),
    [orderedMarkets]
  );

  // Check if we're using cached data
  // Only show once loading is done to avoid flashing the banner on initial load.
  const isUsingCache =
    !isLoading && ((isError && !!cachedPoolsData) || (!poolsData && !!cachedPoolsData));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isUsingCache) {
      setShowCacheWarning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCacheWarning(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isUsingCache]);

  useEffect(() => {
    if (selectedMarkets.length !== 1) return;
    if (hiddenMarketNames.includes(selectedMarkets[0])) {
      setShowMarketsExpanded(true);
    }
  }, [hiddenMarketNames, selectedMarkets]);

  // Stable reference for pools data to prevent TopOpportunities from re-rendering
  // when filters change (only update when actual data changes)
  const stablePools = useMemo(() => {
    return effectivePoolsData?.data || [];
  }, [effectivePoolsData?.data]);

  // Phase 3 Optimization: Preload token and chain icons during idle time
  usePreloadPoolAssets(stablePools, {
    limit: 40, // Preload icons for first 40 pools
    delay: 300, // Start after initial render settles
    enabled: stablePools.length > 0,
  });

  // Preload chain icons for hidden markets when user hovers "More" button
  useEffect(() => {
    if (showMarketsExpanded && orderedMarkets.length > 6) {
      const hiddenChains = orderedMarkets.slice(6).map(m => m.chainName);
      preloadChainIcons(hiddenChains);
    }
  }, [showMarketsExpanded, orderedMarkets]);

  // Preload incentive icons after initial data load (for tooltip)
  useEffect(() => {
    if (!stablePools || stablePools.length === 0) return;
    // Delay to not interfere with initial render
    const timeoutId = setTimeout(() => {
      preloadIncentiveIcons();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stablePools.length > 0]);

  const tokenCategoryGroups = useMemo(
    () => buildTokenCategoryGroups(tokenCategoryOverrides),
    [tokenCategoryOverrides]
  );

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchStats(),
      refetchMarketsList(),
    ]);
  }, [refetch, refetchStats, refetchMarketsList]);

  const handleTopIncentiveClick = useCallback((payload: {
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  }) => {
    setTopTooltipState(payload);
  }, []);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortField(null);
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter pools
  const filteredPools = useMemo(() => {
    if (!effectivePoolsData?.data) return [];

    return effectivePoolsData.data.filter(pool => {
      // Search filter - only match tokenSymbol
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const symbol = pool.tokenSymbol.toLowerCase();
        
        if (!symbol.includes(query)) {
          return false;
        }
      }

      // Market filter
      if (selectedMarkets.length > 0) {
        if (!selectedMarkets.includes(pool.marketName)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const symbol = pool.tokenSymbol.toUpperCase();
        switch (selectedCategory) {
          case 'stablecoin':
            if (!isStablecoinSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'eth-related':
            if (!isEthRelatedSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'btc-related':
            if (!isBtcRelatedSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'pendle':
            if (!isPendleSymbol(symbol)) return false;
            break;
        }
      }

      return true;
    });
  }, [effectivePoolsData?.data, searchQuery, selectedMarkets, selectedCategory, tokenCategoryGroups]);

  // Loading state - only show if we have no data at all (neither fresh nor cached)
  if (isLoading && !effectivePoolsData) {
    return <LoadingState />;
  }

  // Always show the page framework, even if there's an error
  // If we have cached data, use it; otherwise show empty state
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen min-w-0 w-full overflow-x-hidden bg-background">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 container mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-4)] py-[var(--ds-space-4)] md:py-[var(--ds-space-8)] space-y-4 md:space-y-8">
          {/* Cache warning banner */}
          {showCacheWarning && (
            <div className="rounded-lg border ds-border-amber-500-50 ds-bg-amber-500-10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 ds-text-amber-600 shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium ds-text-amber-900">
                  Using cached data
                </p>
                <p className="ds-text-11 ds-text-amber-700 mt-[var(--ds-space-1)]">
                  Unable to fetch latest data. Displaying cached information. Please check your connection and try refreshing.
                </p>
              </div>
            </div>
          )}

          {/* Error banner (only show if no cache available) */}
          {error && !cachedPoolsData && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium text-destructive">
                  Failed to load data
                </p>
                <p className="ds-text-11 text-destructive/80 mt-[var(--ds-space-1)]">
                  {(error as Error).message || 'An unexpected error occurred. Please check your connection and try again later.'}
                </p>
              </div>
            </div>
          )}

          {/* No data warning banner (when there's no data, no error, and no cache) */}
          {!effectivePoolsData && !isLoading && !error && !cachedPoolsData && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium text-destructive">
                  No data available
                </p>
                <p className="ds-text-11 text-destructive/80 mt-[var(--ds-space-1)]">
                  Unable to load data. Please check your connection and try refreshing the page.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <Header
            lastUpdated={effectivePoolsData?.lastUpdated}
          />

          {/* INK Incentive APR Calculator */}
          <>
            <InkAprCalculator
              rateInput={tydroPointToUsdRateInput}
              setRateInput={setTydroPointToUsdRateInput}
              onDragStateChange={setIsRateDragging}
            />
          </>

          {/* Top Opportunities */}
          {stablePools && stablePools.length > 0 && (
            <TopOpportunities
              pools={stablePools}
              isApy={isApy}
              isRateDragging={isRateDragging}
              categoryGroups={tokenCategoryGroups}
              onIncentiveClick={handleTopIncentiveClick}
              tydroPointToUsdRate={tydroPointToUsdRate}
            />
          )}

          {/* Filters */}
          <FilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedMarkets={selectedMarkets}
            setSelectedMarkets={setSelectedMarkets}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            isApy={isApy}
            setIsApy={setIsApy}
            marketsList={effectiveMarketsList}
            showMarketsExpanded={showMarketsExpanded}
            setShowMarketsExpanded={setShowMarketsExpanded}
          />

          {/* Pools Table */}
          <PoolsTable
            pools={filteredPools}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isApy={isApy}
            isLoading={isLoading}
            onSelectMarket={(marketName) => {
              setSelectedMarkets((prev) =>
                prev.length === 1 && prev[0] === marketName ? [] : [marketName]
              );
            }}
            tydroPointToUsdRate={tydroPointToUsdRate}
          />

          {topTooltipState && (
            <Suspense fallback={null}>
              <IncentiveTooltip
                pool={topTooltipState.pool}
                type={topTooltipState.type}
                position={topTooltipState.position}
                triggerCenterX={topTooltipState.triggerCenterX}
                accentBorderClass={topTooltipState.accentBorderClass}
                accentTextClass={topTooltipState.accentTextClass}
                accentBgClass={topTooltipState.accentBgClass}
                onClose={() => setTopTooltipState(null)}
                isApy={isApy}
                tydroPointToUsdRate={tydroPointToUsdRate}
                usePortal
              />
            </Suspense>
          )}

          {/* Empty state */}
          {filteredPools.length === 0 && effectivePoolsData && !isLoading && (
            <div className="text-center py-[var(--ds-space-12)]">
              <p className="text-muted-foreground">No pools found matching your filters</p>
            </div>
          )}

          {/* No data state (when there's no data at all, not even cache) - only show if no banner is shown */}
          {!effectivePoolsData && !isLoading && (error || !cachedPoolsData) && (
            <div className="text-center py-[var(--ds-space-12)]">
              <p className="text-muted-foreground">No data to display</p>
            </div>
          )}

          {/* Footer */}
          <footer className="border-t border-border/50 py-[var(--ds-space-8)]">
            <div className="flex flex-col items-center gap-1.5 px-4 sm:gap-2">
              <p className="text-center ds-text-14 text-muted-foreground leading-relaxed">
                Data sourced from{' '}
                <a
                  href="https://app.aave.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  Aave Protocol
                </a>
                {', '}
                <a
                  href="https://app.merkl.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  Merkl
                </a>
                {', '}
                <a
                  href="https://apps.aavechan.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  ACI
                </a>
                {', '}
                <a
                  href="https://incentra.brevis.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  Brevis
                </a>
              </p>

              <p className="text-xs sm:text-sm text-signature opacity-85">
                Built with ❤️ by{' '}
                <a
                  href="https://twitter.com/silenlee"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Pablo on X"
                  className="inline-flex items-center gap-2 align-baseline text-signature-strong transition-opacity duration-200 hover:opacity-100"
                >
                  <span>Pablo</span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                  >
                    <path d="M18.244 2H21.5l-7.11 8.126L22.75 22h-6.545l-5.124-6.694L5.22 22H1.96l7.603-8.694L1.5 2h6.711l4.632 6.112L18.244 2Zm-1.143 18.02h1.804L7.23 3.875H5.295L17.101 20.02Z" />
                  </svg>
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Index;
