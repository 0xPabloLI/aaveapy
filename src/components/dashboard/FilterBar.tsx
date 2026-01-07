import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
  // Group markets by chain
  const groupedMarkets = marketsList?.reduce((acc, market) => {
    const chain = market.chainName;
    if (!acc[chain]) acc[chain] = [];
    acc[chain].push(market);
    return acc;
  }, {} as Record<string, MarketListItem[]>) || {};

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

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMarkets([]);
    setSelectedCategory('all');
  };

  const hasActiveFilters = searchQuery || selectedMarkets.length > 0 || selectedCategory !== 'all';

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50 focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Market Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-card/50 border-border/50">
              <Filter className="w-4 h-4" />
              Markets
              {selectedMarkets.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-primary/20 text-primary">
                  {selectedMarkets.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto bg-card border-border">
            {Object.entries(groupedMarkets).map(([chain, markets]) => (
              <div key={chain}>
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  {chain}
                </DropdownMenuLabel>
                {markets.map((market) => (
                  <DropdownMenuCheckboxItem
                    key={market.marketName}
                    checked={selectedMarkets.includes(market.marketName)}
                    onCheckedChange={() => toggleMarket(market.marketName)}
                    className="cursor-pointer"
                  >
                    {getMarketDisplayName(market)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* APY/APR Toggle */}
        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg px-4 py-2">
          <Label htmlFor="apy-toggle" className={`text-sm ${!isApy ? 'text-foreground' : 'text-muted-foreground'}`}>
            APR
          </Label>
          <Switch
            id="apy-toggle"
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="apy-toggle" className={`text-sm ${isApy ? 'text-foreground' : 'text-muted-foreground'}`}>
            APY
          </Label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedCategory === category.value
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg glow-primary'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Active market filters */}
      {selectedMarkets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMarkets.map((marketName) => {
            const market = marketsList?.find(m => m.marketName === marketName);
            return (
              <Badge
                key={marketName}
                variant="secondary"
                className="bg-secondary/20 text-secondary border border-secondary/30 cursor-pointer hover:bg-secondary/30"
                onClick={() => toggleMarket(marketName)}
              >
                {market ? getMarketDisplayName(market) : marketName}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
