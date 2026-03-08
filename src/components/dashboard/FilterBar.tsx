import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getChainIconSrc } from '@/lib/chainIcons';
import { useIsMobile } from '@/hooks/use-mobile';
import AprApyToggle from '@/components/dashboard/AprApyToggle';

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
  showMarketsExpanded?: boolean;
  setShowMarketsExpanded?: (expanded: boolean) => void;
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
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center ds-text-8 font-bold`}>
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
  showMarketsExpanded: showMarketsExpandedProp,
  setShowMarketsExpanded: setShowMarketsExpandedProp,
}: FilterBarProps) => {
  const isMobile = useIsMobile();
  const [internalShowMarketsExpanded, setInternalShowMarketsExpanded] = useState(false);
  const showMarketsExpanded = showMarketsExpandedProp ?? internalShowMarketsExpanded;
  const setShowMarketsExpanded = setShowMarketsExpandedProp ?? setInternalShowMarketsExpanded;
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search token');
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
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

  // Dynamic overflow: measure how many pills fit in one row
  const marketsRowRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null); // null = measuring phase
  const measureRafRef = useRef<number | null>(null);

  const measureVisiblePills = useCallback(() => {
    const container = marketsRowRef.current;
    if (!container) return;

    const pills = container.querySelectorAll<HTMLElement>('[data-market-index]');
    if (pills.length === 0) return;

    // Get the top of the first row (use the "All" button or first pill)
    const firstRowTop = pills[0].getBoundingClientRect().top;

    let fitCount = 0;
    for (let i = 0; i < pills.length; i++) {
      const rect = pills[i].getBoundingClientRect();
      if (rect.top > firstRowTop + 4) break; // wrapped to next line
      fitCount = i + 1;
    }

    if (fitCount < allMarkets.length) {
      // Reserve space for the "More" button by removing 1
      setVisibleCount(Math.max(1, fitCount - 1));
    } else {
      setVisibleCount(allMarkets.length);
    }
  }, [allMarkets.length]);

  // Measure on mount & resize
  useLayoutEffect(() => {
    if (showMarketsExpanded || allMarkets.length === 0) return;

    // Reset to measure all pills
    setVisibleCount(null);
  }, [allMarkets.length, showMarketsExpanded]);

  // When visibleCount is null (measuring), render all pills and measure
  useEffect(() => {
    if (visibleCount !== null || showMarketsExpanded) return;

    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = requestAnimationFrame(measureVisiblePills);
    });

    return () => {
      if (measureRafRef.current) cancelAnimationFrame(measureRafRef.current);
    };
  }, [visibleCount, showMarketsExpanded, measureVisiblePills]);

  // Re-measure on container resize
  useEffect(() => {
    const container = marketsRowRef.current;
    if (!container || showMarketsExpanded) return;

    let resizeTimeout: NodeJS.Timeout | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => setVisibleCount(null), 100);
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [showMarketsExpanded]);

  const isMeasuring = visibleCount === null && !showMarketsExpanded;
  const effectiveVisibleCount = visibleCount ?? allMarkets.length;
  const visibleMarkets = showMarketsExpanded ? allMarkets : allMarkets.slice(0, effectiveVisibleCount);
  const hiddenMarkets = showMarketsExpanded ? [] : allMarkets.slice(effectiveVisibleCount);
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
      // Get the currently visible input based on viewport size
      const activeInput = isMobile ? mobileSearchInputRef.current : desktopSearchInputRef.current;
      if (!activeInput) return;
      
      const inputWidth = activeInput.offsetWidth;
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
    
    // Observe both inputs, but only the visible one will affect placeholder calculation
    // This ensures we catch resize events regardless of which input is currently visible
    if (desktopSearchInputRef.current) {
      resizeObserver.observe(desktopSearchInputRef.current);
    }
    if (mobileSearchInputRef.current) {
      resizeObserver.observe(mobileSearchInputRef.current);
    }
    
    window.addEventListener('resize', stableResizeHandler);
    
    return () => {
      if (initialRafId) cancelAnimationFrame(initialRafId);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', stableResizeHandler);
    };
  }, [searchQuery, isMobile, stableResizeHandler]);


  const tokenCategoryButtons = categories.map((category) => (
    <button
      key={category.value}
      onClick={() => {
        // Toggle behavior: if clicking the selected category, switch to 'all'
        if (selectedCategory === category.value) {
          setSelectedCategory('all');
        } else {
          setSelectedCategory(category.value);
        }
      }}
      className={`ds-chip px-[var(--ds-space-2)] md:px-[var(--ds-space-2-5)] py-[var(--ds-space-1)] rounded-md font-medium transition-all ${
        selectedCategory === category.value
          ? 'bg-[rgb(var(--ds-brand-magenta-rgb))] ds-text-on-brand'
          : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
      }`}
    >
      {category.label}
    </button>
  ));

  return (
    <div className="space-y-1.5 md:space-y-2">
      {/* Row 1: Token Categories + Search + APY Toggle (desktop) / Token Categories (mobile) */}
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Tokens</span>
        {tokenCategoryButtons}

        {/* Search – desktop only */}
        <div className="relative w-20 sm:w-24 md:w-36 lg:w-44 hidden md:block ml-1">
          <Search className="absolute left-2 md:left-2.5 top-1/2 -translate-y-1/2 w-3 md:w-3.5 h-3 md:h-3.5 text-muted-foreground/60" />
          <Input
            ref={desktopSearchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-[var(--ds-space-7)] md:pl-[var(--ds-space-8)] pr-[var(--ds-space-6)] md:pr-[var(--ds-space-7)] bg-card/50 border-border/50 focus:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-0 focus-visible:ring-offset-0 h-7 ds-text-11 md:ds-text-11 text-muted-foreground/60 placeholder:text-muted-foreground/60 focus:text-foreground"
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

        <div className="flex-1 min-w-2 md:min-w-4 hidden md:block" />

        {/* APR/APY toggle – desktop only */}
        <div className="hidden md:block">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 2: Search + APR/APY toggle – mobile only */}
      <div className="flex items-center gap-1.5 md:hidden">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            ref={mobileSearchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-[var(--ds-space-8)] pr-[var(--ds-space-6)] bg-card/50 border-border/50 focus:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-0 focus-visible:ring-offset-0 h-7 ds-text-11 text-muted-foreground/50 placeholder:text-muted-foreground/50 focus:text-foreground"
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
        <div className="shrink-0">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 3: Markets */}
      <div
        ref={marketsRowRef}
        className={`flex flex-wrap items-center gap-1 md:gap-1.5 ${isMeasuring ? 'overflow-hidden max-h-[2rem]' : ''}`}
      >
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Markets</span>

        {/* "All" pill */}
        <button
          onClick={() => setSelectedMarkets([])}
          className={`ds-chip px-2 md:px-2.5 py-1 rounded-md font-medium transition-all ${
            noMarketsSelected
              ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
              : 'text-foreground/80 border border-border hover:text-foreground'
          }`}
        >
          All
        </button>

        {/* Measuring pass: render all pills (overflow hidden) */}
        {isMeasuring && allMarkets.map((market, i) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          const isEthereum = market.chainName === 'Ethereum';
          return (
            <button
              key={market.marketName}
              data-market-index={i}
              onClick={() => toggleMarket(market.marketName)}
              className={`ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium transition-all ${
                isSelected
                  ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                  : 'text-foreground/80 border border-border hover:text-foreground'
              }`}
              title={isEthereum ? `Ethereum ${info.label}` : market.chainName}
            >
              <ChainIcon chain={market.chainName} />
              <span>{isEthereum ? info.label : market.chainName}</span>
            </button>
          );
        })}

        {/* Final render: only visible pills */}
        {!isMeasuring && visibleMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          const isEthereum = market.chainName === 'Ethereum';
          return (
            <button
              key={market.marketName}
              data-market-pill
              onClick={() => toggleMarket(market.marketName)}
              className={`ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium transition-all ${
                isSelected
                  ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                  : 'text-foreground/80 border border-border hover:text-foreground'
              }`}
              title={isEthereum ? `Ethereum ${info.label}` : market.chainName}
            >
              <ChainIcon chain={market.chainName} loading={showMarketsExpanded ? "eager" : "lazy"} />
              <span>{isEthereum ? info.label : market.chainName}</span>
            </button>
          );
        })}

        {/* Expand */}
        {!isMeasuring && hasHiddenMarkets && !showMarketsExpanded && (
          <button
            onClick={() => setShowMarketsExpanded(true)}
            className="ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium transition-all ds-text-brand-magenta border ds-border-brand-magenta-40 border-dashed"
          >
            <span>+{hiddenMarkets.length}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {/* Collapse */}
        {showMarketsExpanded && (
          <button
            onClick={() => setShowMarketsExpanded(false)}
            className="ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium transition-all ds-text-brand-magenta border ds-border-brand-magenta-40 border-dashed"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
