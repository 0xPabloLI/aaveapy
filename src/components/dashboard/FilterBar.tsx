import { Search, X, Check, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedMarkets: string[];
  setSelectedMarkets: (markets: string[]) => void;
  selectedCategory: TokenCategory;
  setSelectedCategory: (category: TokenCategory) => void;
  isApy: boolean;
  setIsApy: (isApy: boolean) => void;
  marketsList?: MarketListItem[];
}

const categories: { value: TokenCategory; label: string }[] = [
  { value: 'all', label: 'All Tokens' },
  { value: 'stablecoin', label: 'Stablecoins' },
  { value: 'eth-related', label: 'ETH Related' },
  { value: 'btc-related', label: 'BTC Related' },
  { value: 'pendle', label: 'Pendle' },
];

const FilterBar = ({
  searchQuery,
  setSearchQuery,
  selectedMarkets,
  setSelectedMarkets,
  selectedCategory,
  setSelectedCategory,
  isApy,
  setIsApy,
  marketsList,
}: FilterBarProps) => {
  const getMarketDisplayName = (market: MarketListItem) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return `Ethereum ${ETHEREUM_MARKET_NAMES[market.marketName]}`;
    }
    return market.chainName;
  };

  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
    }
  };

  const selectAllMarkets = () => {
    if (marketsList) {
      setSelectedMarkets(marketsList.map(m => m.marketName));
    }
  };

  const deselectAllMarkets = () => {
    setSelectedMarkets([]);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMarkets([]);
    setSelectedCategory('all');
  };

  const allMarketsSelected = marketsList && selectedMarkets.length === marketsList.length;
  const hasActiveFilters = searchQuery || selectedMarkets.length > 0 || selectedCategory !== 'all';

  return (
    <div className="space-y-5">
      {/* Main filter row */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50 focus:border-primary h-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* APY/APR Toggle */}
        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg px-4 h-10">
          <Label htmlFor="apy-toggle" className={`text-sm cursor-pointer ${!isApy ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            APR
          </Label>
          <Switch
            id="apy-toggle"
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="apy-toggle" className={`text-sm cursor-pointer ${isApy ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            APY
          </Label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground h-10"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Token Category Section */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Token Category</div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedCategory === category.value
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                  : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market Selection Section */}
      {marketsList && marketsList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Markets
              {selectedMarkets.length > 0 && (
                <span className="ml-2 text-primary">
                  ({selectedMarkets.length}/{marketsList.length})
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={allMarketsSelected ? deselectAllMarkets : selectAllMarkets}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {allMarketsSelected ? (
                  <>
                    <X className="w-3 h-3 mr-1" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Select All
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {marketsList.map((market) => {
              const isSelected = selectedMarkets.includes(market.marketName);
              return (
                <button
                  key={market.marketName}
                  onClick={() => toggleMarket(market.marketName)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-secondary/20 text-secondary border border-secondary/40 shadow-sm'
                      : 'bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/60 border border-border/40'
                  }`}
                >
                  {getMarketDisplayName(market)}
                  {isSelected && <X className="w-3 h-3 ml-1.5 opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
