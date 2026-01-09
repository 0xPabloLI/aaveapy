import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  { value: 'all', label: 'All' },
  { value: 'stablecoin', label: 'Stables' },
  { value: 'eth-related', label: 'ETH' },
  { value: 'btc-related', label: 'BTC' },
  { value: 'pendle', label: 'Pendle' },
];

// Simplified market display names
const getShortMarketName = (market: MarketListItem) => {
  if (market.chainName === 'Ethereum') {
    const suffix = ETHEREUM_MARKET_NAMES[market.marketName];
    return suffix ? `ETH ${suffix}` : 'Ethereum';
  }
  // Shorten long chain names
  const shortNames: Record<string, string> = {
    'Arbitrum': 'ARB',
    'Optimism': 'OP',
    'Polygon': 'MATIC',
    'Avalanche': 'AVAX',
    'Base': 'BASE',
    'Metis': 'METIS',
    'Gnosis': 'GNO',
    'BNB Chain': 'BNB',
    'Scroll': 'SCROLL',
    'ZKSync': 'ZK',
  };
  return shortNames[market.chainName] || market.chainName;
};

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
  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
    }
  };

  // Check if no markets selected (show all) or some selected
  const noMarketsSelected = selectedMarkets.length === 0;

  return (
    <div className="space-y-4">
      {/* Top row: Search + APY toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50 focus:border-primary h-9"
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

        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-md px-3 h-9">
          <Label htmlFor="apy-toggle" className={`text-xs cursor-pointer ${!isApy ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            APR
          </Label>
          <Switch
            id="apy-toggle"
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary scale-90"
          />
          <Label htmlFor="apy-toggle" className={`text-xs cursor-pointer ${isApy ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            APY
          </Label>
        </div>
      </div>

      {/* Unified filter pills row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Token categories */}
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              selectedCategory === category.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50'
            }`}
          >
            {category.label}
          </button>
        ))}

        {/* Separator */}
        <div className="w-px h-5 bg-border/50 mx-1" />

        {/* Markets: "All" option + individual markets */}
        <button
          onClick={() => setSelectedMarkets([])}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            noMarketsSelected
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50'
          }`}
        >
          All Markets
        </button>

        {marketsList?.map((market) => {
          const isSelected = selectedMarkets.includes(market.marketName);
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50'
              }`}
            >
              {getShortMarketName(market)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;