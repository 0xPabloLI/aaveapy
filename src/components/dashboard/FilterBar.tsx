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

// Chain icons as simple SVG components
const ChainIcon = ({ chain, className = "" }: { chain: string; className?: string }) => {
  const size = "w-3.5 h-3.5";
  
  if (chain === 'Ethereum') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 417" fill="currentColor">
        <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity="0.6"/>
        <path d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
        <path d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" opacity="0.6"/>
        <path d="M127.962 416.905v-104.72L0 236.585z"/>
      </svg>
    );
  }
  
  // Default circle for other chains
  return (
    <div className={`${size} rounded-full bg-current opacity-60 ${className}`} />
  );
};

// Get market display info
const getMarketInfo = (market: MarketListItem) => {
  if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
    return {
      label: ETHEREUM_MARKET_NAMES[market.marketName],
      chain: 'Ethereum',
      isEthereum: true,
    };
  }
  return {
    label: market.chainName,
    chain: market.chainName,
    isEthereum: false,
  };
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

  const noMarketsSelected = selectedMarkets.length === 0;

  // Separate Ethereum markets and other chains
  const ethereumMarkets = marketsList?.filter(m => m.chainName === 'Ethereum') || [];
  const otherMarkets = marketsList?.filter(m => m.chainName !== 'Ethereum') || [];

  return (
    <div className="space-y-4">
      {/* Row 1: Search + APY Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 bg-card/50 border-border/50 focus:border-primary h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={!isApy ? 'text-foreground font-medium' : ''}>APR</span>
          <Switch
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary scale-75"
          />
          <span className={isApy ? 'text-foreground font-medium' : ''}>APY</span>
        </div>
      </div>

      {/* Row 2: Token Categories */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Tokens:</span>
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              selectedCategory === category.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Row 3: Markets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Markets:</span>
        
        {/* All Markets option */}
        <button
          onClick={() => setSelectedMarkets([])}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            noMarketsSelected
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
          }`}
        >
          All
        </button>

        {/* Ethereum markets with chain icon */}
        {ethereumMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
              }`}
              title={`Ethereum ${info.label}`}
            >
              <ChainIcon chain="Ethereum" />
              <span>{info.label}</span>
            </button>
          );
        })}

        {/* Separator if both groups exist */}
        {ethereumMarkets.length > 0 && otherMarkets.length > 0 && (
          <div className="w-px h-4 bg-border/50 mx-0.5" />
        )}

        {/* Other chain markets */}
        {otherMarkets.map((market) => {
          const isSelected = selectedMarkets.includes(market.marketName);
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
              }`}
            >
              {market.chainName}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;