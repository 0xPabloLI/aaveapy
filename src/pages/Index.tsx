import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAaveMarkets, useAaveMarketStats, useAaveMarketsList } from '@/hooks/useAaveMarkets';
import { useQueryClient } from '@tanstack/react-query';
import { SortField, SortOrder, TokenCategory } from '@/types/aave';
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
import { getCachedMarkets, getCachedMarketStats, getCachedMarketsList } from '@/lib/cache';
import { AlertTriangle } from 'lucide-react';

const Index = () => {
  // State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>('all');
  const [isApy, setIsApy] = useState(true);
  const [showCacheWarning, setShowCacheWarning] = useState(false);

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

  // Stable reference for pools data to prevent TopOpportunities from re-rendering
  // when filters change (only update when actual data changes)
  const stablePools = useMemo(() => {
    return effectivePoolsData?.data || [];
  }, [effectivePoolsData?.data]);

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
      <div className="min-h-screen bg-background">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-8">
          {/* Cache warning banner */}
          {showCacheWarning && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 md:p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Using cached data
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Unable to fetch latest data. Displaying cached information. Please check your connection and try refreshing.
                </p>
              </div>
            </div>
          )}

          {/* Error banner (only show if no cache available) */}
          {error && !cachedPoolsData && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 md:p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Failed to load data
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  {(error as Error).message || 'An unexpected error occurred. Please check your connection and try again later.'}
                </p>
              </div>
            </div>
          )}

          {/* No data warning banner (when there's no data, no error, and no cache) */}
          {!effectivePoolsData && !isLoading && !error && !cachedPoolsData && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 md:p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  No data available
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Unable to load data. Please check your connection and try refreshing the page.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <Header
            lastUpdated={effectivePoolsData?.lastUpdated}
          />

          {/* Top Opportunities */}
          {stablePools && stablePools.length > 0 && (
            <TopOpportunities pools={stablePools} isApy={isApy} categoryGroups={tokenCategoryGroups} />
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
          />

          {/* Pools Table */}
          <PoolsTable
            pools={filteredPools}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isApy={isApy}
          />

          {/* Empty state */}
          {filteredPools.length === 0 && effectivePoolsData && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No pools found matching your filters</p>
            </div>
          )}

          {/* No data state (when there's no data at all, not even cache) - only show if no banner is shown */}
          {!effectivePoolsData && !isLoading && (error || !cachedPoolsData) && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No data to display</p>
            </div>
          )}

          {/* Footer */}
          <footer className="text-center py-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Data sourced from{' '}
              <a 
                href="https://app.aave.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-secondary hover:underline"
              >
                Aave Protocol
              </a>
            </p>
          </footer>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Index;
