import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
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

const ChainIcon = ({ chain, className = "", loading = "lazy" }: { chain: string; className?: string; loading?: "lazy" | "eager" }) => {
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
      loading={loading}
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
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search token');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedUpdateRef = useRef<(() => void) | null>(null);

  // Stable handler function that reads from ref - never changes, so can be used for addEventListener/removeEventListener
  const stableResizeHandler = useCallback(() => {
    debouncedUpdateRef.current?.();
  }, []);

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

  // Preload hidden market icons after page load
  useEffect(() => {
    if (hiddenMarkets.length > 0) {
      // Use requestIdleCallback for low-priority preloading, fallback to setTimeout
      const preloadIcons = () => {
        hiddenMarkets.forEach(market => {
          const src = getChainIconSrc(market.chainName);
          if (src) {
            const img = new Image();
            img.src = src;
          }
        });
      };

      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(preloadIcons);
      } else {
        setTimeout(preloadIcons, 1000);
      }
    }
  }, [hiddenMarkets]);

  // Auto-adapt search placeholder based on input width (optimized with debounce)
  useEffect(() => {
    // Cache canvas for text measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '12px system-ui, -apple-system, sans-serif';
    
    // Pre-calculate text widths
    const fullTextWidth = context.measureText('Search token').width;
    const shortTextWidth = context.measureText('Token').width;
    
    let rafId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const updatePlaceholder = () => {
      if (!searchInputRef.current) return;
      
      const input = searchInputRef.current;
      const inputWidth = input.offsetWidth;
      if (inputWidth === 0) return; // Not yet rendered
      
      const iconWidth = 24; // Search icon width + padding
      const clearButtonWidth = 20; // Clear button width when visible
      const padding = 16; // Left and right padding
      const availableWidth = inputWidth - iconWidth - padding - (searchQuery ? clearButtonWidth : 0);
      
      // Determine new placeholder
      let newPlaceholder: string;
      if (availableWidth >= fullTextWidth) {
        newPlaceholder = 'Search token';
      } else if (availableWidth >= shortTextWidth) {
        newPlaceholder = 'Token';
      } else {
        newPlaceholder = 'Search';
      }
      
      // Only update if changed to avoid unnecessary re-renders
      setSearchPlaceholder(prev => prev !== newPlaceholder ? newPlaceholder : prev);
    };

    // Debounced update function - stored in ref so stable handler can call it
    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updatePlaceholder);
      }, 100); // 100ms debounce
    };
    
    // Store handler in ref so stableResizeHandler can call the latest version
    debouncedUpdateRef.current = debouncedUpdate;

    // Initial update after DOM is ready
    const initialRafId = requestAnimationFrame(() => {
      requestAnimationFrame(updatePlaceholder);
    });
    
    const resizeObserver = new ResizeObserver(stableResizeHandler);
    
    if (searchInputRef.current) {
      resizeObserver.observe(searchInputRef.current);
    }
    
    window.addEventListener('resize', stableResizeHandler);
    
    return () => {
      if (initialRafId) cancelAnimationFrame(initialRafId);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', stableResizeHandler);
    };
  }, [searchQuery]);

  // Count selected hidden markets
  const selectedHiddenCount = hiddenMarkets.filter(m => selectedMarkets.includes(m.marketName)).length;

  return (
    <div className="space-y-2 md:space-y-3">
      {/* Row 1: Token Categories + APY Toggle */}
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        {/* Token Categories */}
        <span className="text-xs text-muted-foreground mr-0.5 md:mr-1 hidden sm:inline">Tokens:</span>
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-2 md:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              selectedCategory === category.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
            }`}
          >
            {category.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1 min-w-2 md:min-w-4" />

        {/* APY/APR Toggle - Right aligned */}
        <div className="flex items-center gap-1 md:gap-1.5 text-xs text-muted-foreground">
          <span className={!isApy ? 'text-foreground font-medium' : ''}>APR</span>
          <Switch
            checked={isApy}
            onCheckedChange={setIsApy}
            className="data-[state=checked]:bg-primary scale-[0.65] md:scale-75"
          />
          <span className={isApy ? 'text-foreground font-medium' : ''}>APY</span>
        </div>
      </div>

      {/* Row 2: Search */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <div className="relative w-full sm:w-64 md:w-80 lg:w-96">
          <Search className="absolute left-2 md:left-2.5 top-1/2 -translate-y-1/2 w-3 md:w-3.5 h-3 md:h-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 md:pl-8 pr-6 md:pr-7 bg-card/50 border-border/50 focus:border-primary h-7 text-xs"
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
      </div>

      {/* Row 2: Markets */}
      <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
        <span className="text-xs text-muted-foreground mr-0.5 md:mr-1 hidden sm:inline">Markets:</span>
        
        {/* All Markets option */}
        <button
          onClick={() => setSelectedMarkets([])}
          className={`px-2 md:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            noMarketsSelected
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
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
              className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
              title={isEthereum ? `Ethereum ${info.label}` : market.chainName}
            >
              <ChainIcon chain={market.chainName} />
              <span>{isEthereum ? info.label : market.chainName}</span>
            </button>
          );
        })}

        {/* More button - expands inline */}
        {hasHiddenMarkets && !showMarketsExpanded && (
          <button
            onClick={() => setShowMarketsExpanded(true)}
            className="inline-flex items-center gap-1 px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all bg-indigo-50 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100 border border-indigo-200 border-dashed"
          >
            <span>{hiddenMarkets.length}+ more</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {/* Expanded hidden markets */}
        {showMarketsExpanded && hiddenMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          const isEthereum = market.chainName === 'Ethereum';
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
              title={isEthereum ? `Ethereum ${info.label}` : market.chainName}
            >
              <ChainIcon chain={market.chainName} loading="eager" />
              <span>{isEthereum ? info.label : market.chainName}</span>
            </button>
          );
        })}

        {/* Collapse button */}
        {showMarketsExpanded && (
          <button
            onClick={() => setShowMarketsExpanded(false)}
            className="inline-flex items-center gap-1 px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all bg-indigo-50 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100 border border-indigo-200 border-dashed"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Less</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
