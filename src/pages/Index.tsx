import { useState, useMemo, useCallback } from 'react';
import { useAaveMarkets, useAaveMarketStats, useAaveMarketsList } from '@/hooks/useAaveMarkets';
import { useQueryClient } from '@tanstack/react-query';
import { SortField, SortOrder, TokenCategory, STABLECOINS, ETH_RELATED, BTC_RELATED, PENDLE_TOKENS } from '@/types/aave';
import Header from '@/components/dashboard/Header';
import FilterBar from '@/components/dashboard/FilterBar';
import TopOpportunities from '@/components/dashboard/TopOpportunities';
import PoolsTable from '@/components/dashboard/PoolsTable';
import LoadingState from '@/components/dashboard/LoadingState';
import ErrorState from '@/components/dashboard/ErrorState';
import PullToRefresh from '@/components/dashboard/PullToRefresh';

const Index = () => {
  // State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>('all');
  const [isApy, setIsApy] = useState(true);

  const queryClient = useQueryClient();

  // Fetch data - 不传 sort 参数，所有排序都在前端完成
  // 这样表格的 total/native/incentive 模式才能正确工作
  const { data: poolsData, isLoading, error, refetch } = useAaveMarkets();
  const { data: stats, refetch: refetchStats } = useAaveMarketStats();
  const { data: marketsList, refetch: refetchMarketsList } = useAaveMarketsList();

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
    if (!poolsData?.data) return [];

    return poolsData.data.filter(pool => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!pool.tokenSymbol.toLowerCase().includes(query) &&
            !pool.tokenName.toLowerCase().includes(query)) {
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
            if (!STABLECOINS.some(s => symbol.includes(s.toUpperCase()))) return false;
            break;
          case 'eth-related':
            if (!ETH_RELATED.some(s => symbol.includes(s.toUpperCase()))) return false;
            break;
          case 'btc-related':
            if (!BTC_RELATED.some(s => symbol.includes(s.toUpperCase()))) return false;
            break;
          case 'pendle':
            if (!PENDLE_TOKENS.some(s => symbol.startsWith(s.toUpperCase()))) return false;
            break;
        }
      }

      return true;
    });
  }, [poolsData?.data, searchQuery, selectedMarkets, selectedCategory]);

  // Loading state
  if (isLoading && !poolsData) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error as Error} />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-8">
          {/* Header */}
          <Header
            isLoading={isLoading}
            lastUpdated={poolsData?.lastUpdated}
          />

          {/* Top Opportunities */}
          {poolsData?.data && (
            <TopOpportunities pools={poolsData.data} isApy={isApy} />
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
            marketsList={marketsList}
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
          {filteredPools.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No pools found matching your filters</p>
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
