import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getChainIconSrc } from '@/lib/chainIcons';
import { useIsMobile } from '@/hooks/use-mobile';
import AprApyToggle from '@/components/dashboard/AprApyToggle';
import { memo } from 'react';

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

const ChainIcon = memo(({ chain, className = "" }: { chain: string; className?: string }) => {
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
      loading="lazy"
    />
  );
});

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
  const isMobile = useIsMobile();
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search token');
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const debouncedUpdateRef = useRef<(() => void) | null>(null);

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

  const ethereumMarkets = marketsList?.filter(m => m.chainName === 'Ethereum') || [];
  const otherMarkets = marketsList?.filter(m => m.chainName !== 'Ethereum') || [];
  const allMarkets = [...ethereumMarkets, ...otherMarkets];

  // Auto-adapt search placeholder based on input width
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '12px system-ui, -apple-system, sans-serif';
    const fullTextWidth = context.measureText('Search token').width;
    const shortTextWidth = context.measureText('Token').width;
    let rafId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const updatePlaceholder = () => {
      const activeInput = isMobile ? mobileSearchInputRef.current : desktopSearchInputRef.current;
      if (!activeInput) return;
      const inputWidth = activeInput.offsetWidth;
      if (inputWidth === 0) return;
      const iconWidth = 24;
      const clearButtonWidth = 20;
      const padding = 16;
      const availableWidth = inputWidth - iconWidth - padding - (searchQuery ? clearButtonWidth : 0);
      let newPlaceholder: string;
      if (availableWidth >= fullTextWidth) {
        newPlaceholder = 'Search token';
      } else if (availableWidth >= shortTextWidth) {
        newPlaceholder = 'Token';
      } else {
        newPlaceholder = 'Search';
      }
      setSearchPlaceholder(prev => prev !== newPlaceholder ? newPlaceholder : prev);
    };

    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updatePlaceholder);
      }, 100);
    };

    debouncedUpdateRef.current = debouncedUpdate;

    const initialRafId = requestAnimationFrame(() => {
      requestAnimationFrame(updatePlaceholder);
    });

    const resizeObserver = new ResizeObserver(stableResizeHandler);
    if (desktopSearchInputRef.current) resizeObserver.observe(desktopSearchInputRef.current);
    if (mobileSearchInputRef.current) resizeObserver.observe(mobileSearchInputRef.current);
    window.addEventListener('resize', stableResizeHandler);

    return () => {
      if (initialRafId) cancelAnimationFrame(initialRafId);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', stableResizeHandler);
    };
  }, [searchQuery, isMobile, stableResizeHandler]);

  return (
    <div className="space-y-1 md:space-y-1.5">
      {/* Row 1: Token Categories + Search + APY Toggle */}
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Tokens</span>

        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => {
              if (selectedCategory === category.value) {
                setSelectedCategory('all');
              } else {
                setSelectedCategory(category.value);
              }
            }}
            className={`ds-chip px-2 md:px-2.5 py-1 rounded-md font-medium transition-colors ${
              selectedCategory === category.value
                ? 'bg-[rgb(var(--ds-brand-magenta-rgb))] ds-text-on-brand'
                : 'bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/40'
            }`}
          >
            {category.label}
          </button>
        ))}

        {/* Search – desktop only */}
        <div className="relative w-20 sm:w-24 md:w-36 lg:w-44 hidden md:block ml-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input
            ref={desktopSearchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 rounded-md border border-border/50 bg-card/50 pl-[var(--ds-space-8)] pr-[var(--ds-space-7)] ds-text-12 text-muted-foreground/60 placeholder:text-muted-foreground/60 outline-none transition-all focus:text-foreground focus:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-0"
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
          <input
            ref={mobileSearchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 rounded-md border border-border/50 bg-card/50 pl-[var(--ds-space-8)] pr-[var(--ds-space-6)] ds-text-11 text-muted-foreground/50 placeholder:text-muted-foreground/50 outline-none transition-all focus:text-foreground focus:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-0"
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

      {/* Row 3: Markets – all visible */}
      <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Markets</span>

        <button
          onClick={() => setSelectedMarkets([])}
          className={`ds-chip px-2 md:px-2.5 py-1 rounded-md font-medium transition-colors ${
            noMarketsSelected
              ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
              : 'text-foreground/80 border border-border hover:text-foreground'
          }`}
        >
          All
        </button>

        {allMarkets.map((market) => {
          const info = getMarketInfo(market);
          const isSelected = selectedMarkets.includes(market.marketName);
          const isEthereum = market.chainName === 'Ethereum';
          return (
            <button
              key={market.marketName}
              onClick={() => toggleMarket(market.marketName)}
              className={`ds-chip gap-1 px-1.5 md:px-2 py-1 rounded-md font-medium transition-colors ${
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
      </div>
    </div>
  );
};

export default FilterBar;
