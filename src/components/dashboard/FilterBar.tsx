import { Search, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { Button } from '@/components/ui/button';

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
  const size = "w-3 h-3";
  
  // Ethereum
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
  
  // Arbitrum
  if (chain === 'Arbitrum') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <circle cx="128" cy="128" r="120" opacity="0.2"/>
        <path d="M128 28L48 198h40l40-100 40 100h40L128 28z"/>
      </svg>
    );
  }
  
  // Optimism
  if (chain === 'Optimism') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <circle cx="128" cy="128" r="100" opacity="0.3"/>
        <circle cx="128" cy="128" r="60"/>
      </svg>
    );
  }
  
  // Polygon
  if (chain === 'Polygon') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M188 80l-60-35-60 35v70l60 35 60-35V80z" opacity="0.4"/>
        <path d="M128 95l-40 23v46l40 23 40-23v-46l-40-23z"/>
      </svg>
    );
  }
  
  // Avalanche
  if (chain === 'Avalanche') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M128 40l90 156H38L128 40z" opacity="0.3"/>
        <path d="M128 80l50 86H78l50-86z"/>
      </svg>
    );
  }
  
  // Base
  if (chain === 'Base') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <circle cx="128" cy="128" r="100" opacity="0.3"/>
        <path d="M128 68c-33 0-60 27-60 60s27 60 60 60c25 0 46-15 55-36h-55v-48h55c-9-21-30-36-55-36z"/>
      </svg>
    );
  }
  
  // BNB Chain
  if (chain === 'BNB Chain') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M128 48l-24 24 24 24 24-24-24-24zm-56 56l-24 24 24 24 24-24-24-24zm112 0l-24 24 24 24 24-24-24-24zm-56 56l-24 24 24 24 24-24-24-24z"/>
      </svg>
    );
  }
  
  // Gnosis
  if (chain === 'Gnosis') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <circle cx="128" cy="100" r="40"/>
        <circle cx="88" cy="170" r="30" opacity="0.6"/>
        <circle cx="168" cy="170" r="30" opacity="0.6"/>
      </svg>
    );
  }
  
  // Scroll
  if (chain === 'Scroll') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M60 60h136v30H90v106h106v30H60V60z" opacity="0.5"/>
        <path d="M90 90h106v106H90V90z"/>
      </svg>
    );
  }
  
  // Metis
  if (chain === 'Metis') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M128 48l70 40v80l-70 40-70-40V88l70-40z" opacity="0.4"/>
        <path d="M128 78l40 23v46l-40 23-40-23v-46l40-23z"/>
      </svg>
    );
  }
  
  // ZKSync
  if (chain === 'ZKSync Era') {
    return (
      <svg className={`${size} ${className}`} viewBox="0 0 256 256" fill="currentColor">
        <path d="M48 128l80-60v40h80l-80 60v-40H48z"/>
      </svg>
    );
  }
  
  // Default icon for unknown chains
  return (
    <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center text-[6px] font-bold`}>
      {chain.charAt(0)}
    </div>
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
  const [showAllMarkets, setShowAllMarkets] = useState(false);

  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
    }
  };

  const noMarketsSelected = selectedMarkets.length === 0;
  const hasActiveFilters = searchQuery || selectedMarkets.length > 0 || selectedCategory !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedMarkets([]);
    setSelectedCategory('all');
  };

  // Separate Ethereum markets and other chains
  const ethereumMarkets = marketsList?.filter(m => m.chainName === 'Ethereum') || [];
  const otherMarkets = marketsList?.filter(m => m.chainName !== 'Ethereum') || [];
  
  // Show limited markets on mobile when collapsed
  const visibleEthereumMarkets = showAllMarkets ? ethereumMarkets : ethereumMarkets.slice(0, 3);
  const visibleOtherMarkets = showAllMarkets ? otherMarkets : otherMarkets.slice(0, 4);
  const totalMarkets = ethereumMarkets.length + otherMarkets.length;
  const visibleCount = visibleEthereumMarkets.length + visibleOtherMarkets.length;
  const hiddenCount = totalMarkets - visibleCount;

  return (
    <div className="glass-card rounded-xl p-3 md:p-4 space-y-3">
      {/* Row 1: Primary Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-[200px] md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-7 bg-background/50 border-border/50 focus:border-primary h-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* APR/APY Toggle */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background/50 border border-border/30">
          <span className={`text-[10px] md:text-xs font-medium transition-colors ${!isApy ? 'text-primary' : 'text-muted-foreground'}`}>APR</span>
          <Switch
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary scale-[0.65] md:scale-75"
          />
          <span className={`text-[10px] md:text-xs font-medium transition-colors ${isApy ? 'text-primary' : 'text-muted-foreground'}`}>APY</span>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>

      {/* Row 2: Token Categories */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] md:text-xs text-muted-foreground font-medium mr-0.5">Type:</span>
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all duration-200 ${
              selectedCategory === category.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background border border-border/30'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Row 3: Markets */}
      <div className="flex items-start gap-1.5 flex-wrap">
        <span className="text-[10px] md:text-xs text-muted-foreground font-medium mr-0.5 mt-1">Chain:</span>
        
        {/* All Markets option */}
        <button
          onClick={() => setSelectedMarkets([])}
          className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all duration-200 ${
            noMarketsSelected
              ? 'bg-secondary text-secondary-foreground shadow-sm'
              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background border border-border/30'
          }`}
        >
          All
        </button>

        {/* Ethereum markets with chain icon */}
        {visibleEthereumMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-secondary/50'
                  : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background border border-border/30'
              }`}
              title={`Ethereum ${info.label}`}
            >
              <ChainIcon chain="Ethereum" />
              <span>{info.label}</span>
            </button>
          );
        })}

        {/* Other chain markets with icons */}
        {visibleOtherMarkets.map((market) => {
          const isSelected = selectedMarkets.includes(market.marketName);
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-secondary/50'
                  : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background border border-border/30'
              }`}
            >
              <ChainIcon chain={market.chainName} />
              <span>{market.chainName}</span>
            </button>
          );
        })}

        {/* Show more/less button */}
        {hiddenCount > 0 && !showAllMarkets && (
          <button
            onClick={() => setShowAllMarkets(true)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            +{hiddenCount} more
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
        {showAllMarkets && totalMarkets > 7 && (
          <button
            onClick={() => setShowAllMarkets(false)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
          >
            Show less
            <ChevronUp className="w-3 h-3" />
          </button>
        )}

        {/* Selected count indicator */}
        {selectedMarkets.length > 0 && (
          <span className="ml-auto text-[10px] md:text-xs text-muted-foreground">
            {selectedMarkets.length} selected
          </span>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
