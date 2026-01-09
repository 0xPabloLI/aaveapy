import { useState, useMemo } from 'react';
import { useAaveMarkets, useAaveMarketStats, useAaveMarketsList } from '@/hooks/useAaveMarkets';
import { SortField, SortOrder, TokenCategory, STABLECOINS, ETH_RELATED, BTC_RELATED, PENDLE_TOKENS } from '@/types/aave';
import Header from '@/components/dashboard/Header';
import FilterBar from '@/components/dashboard/FilterBar';
import TopOpportunities from '@/components/dashboard/TopOpportunities';
import MarketCard from '@/components/dashboard/MarketCard';
import MarketsTable from '@/components/dashboard/MarketsTable';
import LoadingState from '@/components/dashboard/LoadingState';
import ErrorState from '@/components/dashboard/ErrorState';

const Index = () => {
  // State
  const [sortField, setSortField] = useState<SortField>('totalSupplyApy');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>('all');
  const [isApy, setIsApy] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Fetch data
  const { data: marketsData, isLoading, error } = useAaveMarkets({
    sort: sortField || undefined,
    order: sortOrder,
  });
  const { data: stats } = useAaveMarketStats();
  const { data: marketsList } = useAaveMarketsList();

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

  // Filter markets
  const filteredMarkets = useMemo(() => {
    if (!marketsData?.data) return [];

    return marketsData.data.filter(market => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!market.tokenSymbol.toLowerCase().includes(query) &&
            !market.tokenName.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Market filter
      if (selectedMarkets.length > 0) {
        if (!selectedMarkets.includes(market.marketName)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const symbol = market.tokenSymbol.toUpperCase();
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
  }, [marketsData?.data, searchQuery, selectedMarkets, selectedCategory]);

  // Loading state
  if (isLoading && !marketsData) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error as Error} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Header */}
        <Header
          isLoading={isLoading}
          viewMode={viewMode}
          setViewMode={setViewMode}
          lastUpdated={marketsData?.lastUpdated}
        />

        {/* Top Opportunities */}
        {marketsData?.data && (
          <TopOpportunities markets={marketsData.data} />
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

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="text-foreground font-medium">{filteredMarkets.length}</span> markets
          </p>
        </div>

        {/* Markets Display */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMarkets.map((market, index) => (
              <MarketCard
                key={`${market.marketName}-${market.tokenSymbol}-${index}`}
                market={market}
                isApy={isApy}
                index={index}
              />
            ))}
          </div>
        ) : (
          <MarketsTable
            markets={filteredMarkets}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isApy={isApy}
          />
        )}

        {/* Empty state */}
        {filteredMarkets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No markets found matching your filters</p>
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
            {' '}across 17 chains
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
