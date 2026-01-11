import { useState } from 'react';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getChainIconSrc } from '@/lib/chainIcons';

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

const ChainIcon = ({ chain, className = "" }: { chain: string; className?: string }) => {
  const size = "w-3.5 h-3.5";
  const src = getChainIconSrc(chain);

  if (!src) {
    return (
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center text-[8px] font-bold`}>
        {chain.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${chain} logo`}
      className={`${size} ${className}`}
      loading="lazy"
    />
  );
};

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
  const [showMarketsExpanded, setShowMarketsExpanded] = useState(false);

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
  const allMarkets = [...ethereumMarkets, ...otherMarkets];

  // Show first 6 markets, rest in "More"
  const visibleMarkets = allMarkets.slice(0, 6);
  const hiddenMarkets = allMarkets.slice(6);
  const hasHiddenMarkets = hiddenMarkets.length > 0;

  // Count selected hidden markets
  const selectedHiddenCount = hiddenMarkets.filter(m => selectedMarkets.includes(m.marketName)).length;

  return (
    <div className="space-y-3">
      {/* Row 1: Token Categories + Search + APY Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Token Categories */}
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

        {/* Spacer */}
        <div className="flex-1 min-w-4" />

        {/* Search */}
        <div className="relative w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-7 bg-card/50 border-border/50 focus:border-primary h-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* APY/APR Toggle */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
          <span className={!isApy ? 'text-foreground font-medium' : ''}>APR</span>
          <Switch
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary scale-75"
          />
          <span className={isApy ? 'text-foreground font-medium' : ''}>APY</span>
        </div>
      </div>

      {/* Row 2: Markets */}
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

        {/* Visible markets */}
        {visibleMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          const isEthereum = market.chainName === 'Ethereum';
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
              }`}
              title={isEthereum ? `Ethereum ${info.label}` : market.chainName}
            >
              <ChainIcon chain={market.chainName} />
              <span>{isEthereum ? info.label : market.chainName}</span>
            </button>
          );
        })}

        {/* More button */}
        {hasHiddenMarkets && (
          <div className="relative">
            <button
              onClick={() => setShowMarketsExpanded(!showMarketsExpanded)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                showMarketsExpanded || selectedHiddenCount > 0
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
              }`}
            >
              <span>More</span>
              {selectedHiddenCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  {selectedHiddenCount}
                </span>
              )}
              {showMarketsExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {/* Dropdown for hidden markets */}
            {showMarketsExpanded && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMarketsExpanded(false)}
                />
                <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-2 z-20 min-w-[180px] max-h-64 overflow-y-auto">
                  {hiddenMarkets.map((market) => {
                    const info = getMarketInfo(market);
                    const isSelected = selectedMarkets.includes(market.marketName);
                    const isEthereum = market.chainName === 'Ethereum';
                    return (
                      <button
                        key={market.marketName}
                        onClick={() => toggleMarket(market.marketName)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                          isSelected
                            ? 'bg-secondary/20 text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <ChainIcon chain={market.chainName} />
                        <span>{isEthereum ? `Ethereum ${info.label}` : market.chainName}</span>
                        {isSelected && (
                          <span className="ml-auto text-primary">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
