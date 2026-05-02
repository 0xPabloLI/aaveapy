import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment } from 'react';
import { Search, Eraser, ChevronRight, Snowflake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterChip } from '@/components/ui/filter-chip';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { TokenCategory, MarketListItem, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getChainIconSrc } from '@/lib/chainIcons';
import { useIsMobile } from '@/hooks/use-mobile';
import AprApyToggle from '@/components/dashboard/AprApyToggle';
import { getProtocolVersion } from '@/lib/protocolVersion';

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
  showFrozenOrPaused?: boolean;
  setShowFrozenOrPaused?: (value: boolean) => void;
  /** Available hub names derived from current reserves. */
  hubNames?: string[];
  /** Currently selected hub names (empty = "All"). */
  selectedHubs: string[];
  /** Set selected hub names. */
  setSelectedHubs: (hubs: string[]) => void;
  /** Current market view mode. */
  marketViewMode?: 'chain' | 'hub';
  /** Set market view mode. */
  setMarketViewMode?: (mode: 'chain' | 'hub') => void;
  /** Currently expanded chain name (for Ethereum sub-markets). */
  expandedChain?: string | null;
  /** Set expanded chain name. */
  setExpandedChain?: (chain: string | null) => void;
}

const categories: { value: TokenCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stablecoin', label: 'Stables' },
  { value: 'eth-related', label: 'ETH' },
  { value: 'btc-related', label: 'BTC' },
  { value: 'pendle', label: 'Pendle' },
];

const ChainIcon = memo(({ chain, className = '' }: { chain: string; className?: string }) => {
  const size = 'w-3.5 h-3.5';
  const src = getChainIconSrc(chain);
  if (!src) {
    return (
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center ds-text-8 font-semibold`}>
        {chain.charAt(0)}
      </div>
    );
  }
  return <img src={src} alt={`${chain} logo`} className={`${size} ${className}`} loading="lazy" />;
});
ChainIcon.displayName = 'ChainIcon';

/** Group markets by chainName, preserving Ethereum first, then alphabetical. */
interface ChainGroup {
  chainName: string;
  markets: MarketListItem[];
  /** Whether this chain has expandable sub-markets */
  expandable: boolean;
}

function groupMarketsByChain(marketsList: MarketListItem[] | undefined): ChainGroup[] {
  if (!marketsList?.length) return [];

  const chainMap = new Map<string, MarketListItem[]>();
  for (const m of marketsList) {
    const list = chainMap.get(m.chainName) || [];
    list.push(m);
    chainMap.set(m.chainName, list);
  }

  const groups: ChainGroup[] = [];
  // Ethereum first
  const ethMarkets = chainMap.get('Ethereum');
  if (ethMarkets) {
    groups.push({ chainName: 'Ethereum', markets: ethMarkets, expandable: ethMarkets.length > 1 });
    chainMap.delete('Ethereum');
  }
  // Remaining chains alphabetically
  const remaining = Array.from(chainMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [chainName, markets] of remaining) {
    groups.push({ chainName, markets, expandable: false });
  }

  return groups;
}

/** Get sub-market display label for Ethereum markets */
function getEthSubMarketLabel(market: MarketListItem): string {
  const version = getProtocolVersion(market.marketName);

  // V4: extract suffix from marketName (e.g. AaveV4EthereumLido → Ethereum Lido)
  if (version === 'v4') {
    const withoutPrefix = market.marketName.replace(/^AaveV4/i, '');
    return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  // V3: use canonical mapped names
  if (ETHEREUM_MARKET_NAMES[market.marketName]) {
    return ETHEREUM_MARKET_NAMES[market.marketName];
  }
  return market.marketName;
}

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
  showFrozenOrPaused,
  setShowFrozenOrPaused,
  hubNames,
  selectedHubs,
  setSelectedHubs,
  marketViewMode: controlledMarketViewMode,
  setMarketViewMode: setControlledMarketViewMode,
  expandedChain: controlledExpandedChain,
  setExpandedChain: setControlledExpandedChain,
}: FilterBarProps) => {
  const isMobile = useIsMobile();
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search token');
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const debouncedUpdateRef = useRef<(() => void) | null>(null);
  const [internalExpandedChain, setInternalExpandedChain] = useState<string | null>(null);
  const expandedChain = controlledExpandedChain ?? internalExpandedChain;
  const setExpandedChain = useCallback((chain: string | null) => {
    setInternalExpandedChain(chain);
    setControlledExpandedChain?.(chain);
  }, [setControlledExpandedChain]);

  /** View mode for the markets row: 'chain' = chain chips, 'hub' = hub chips */
  const [internalMarketViewMode, setInternalMarketViewMode] = useState<'chain' | 'hub'>('chain');
  const marketViewMode = controlledMarketViewMode ?? internalMarketViewMode;
  const setMarketViewMode = useCallback((mode: 'chain' | 'hub') => {
    setInternalMarketViewMode(mode);
    setControlledMarketViewMode?.(mode);
  }, [setControlledMarketViewMode]);

  const stableResizeHandler = useCallback(() => {
    debouncedUpdateRef.current?.();
  }, []);

  const chainGroups = useMemo(() => groupMarketsByChain(marketsList), [marketsList]);

  // Derive which chains are fully selected (all their markets are in selectedMarkets)
  const isChainSelected = useCallback(
    (group: ChainGroup) => {
      return group.markets.every((m) => selectedMarkets.includes(m.marketName));
    },
    [selectedMarkets],
  );

  // Check if any sub-market of a chain is selected (but not the whole chain)
  const hasSubMarketSelected = useCallback(
    (group: ChainGroup) => {
      return group.markets.some((m) => selectedMarkets.includes(m.marketName)) && !isChainSelected(group);
    },
    [selectedMarkets, isChainSelected],
  );

  const toggleChain = useCallback(
    (group: ChainGroup) => {
      const allNames = group.markets.map((m) => m.marketName);
      if (isChainSelected(group)) {
        // Deselect all markets of this chain
        setSelectedMarkets(selectedMarkets.filter((m) => !allNames.includes(m)));
      } else {
        // Select all markets of this chain
        const withoutChain = selectedMarkets.filter((m) => !allNames.includes(m));
        setSelectedMarkets([...withoutChain, ...allNames]);
      }
    },
    [selectedMarkets, setSelectedMarkets, isChainSelected],
  );

  const toggleSubMarket = useCallback(
    (marketName: string) => {
      if (selectedMarkets.includes(marketName)) {
        setSelectedMarkets(selectedMarkets.filter((m) => m !== marketName));
      } else {
        setSelectedMarkets([...selectedMarkets, marketName]);
      }
    },
    [selectedMarkets, setSelectedMarkets],
  );

  const handleAllClick = useCallback(() => {
    setSelectedMarkets([]);
    setExpandedChain(null);
    setSelectedHubs([]);
  }, [setSelectedMarkets, setSelectedHubs, setExpandedChain]);

  const handleChainLabelClick = useCallback(
    (group: ChainGroup) => {
      toggleChain(group);
    },
    [toggleChain],
  );

  const handleExpandToggle = useCallback(
    (chainName: string) => {
      setExpandedChain((prev) => (prev === chainName ? null : chainName));
    },
    [setExpandedChain],
  );

  const handleOtherChainClick = useCallback(
    (group: ChainGroup) => {
      toggleChain(group);
      // Note: Intentionally not collapsing expanded chain to allow viewing
      // Ethereum sub-markets while filtering other chains
    },
    [toggleChain],
  );

  const noMarketsSelected = selectedMarkets.length === 0;
  const noHubSelected = selectedHubs.length === 0;

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
      setSearchPlaceholder((prev) => (prev !== newPlaceholder ? newPlaceholder : prev));
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

  const hasHubs = hubNames && hubNames.length > 0;

  return (
    <div className="space-y-2 md:space-y-2.5">
      {/* Row 1: Token Categories + Search + Frozen Toggle + APY Toggle */}
      <div data-testid="tokens-row" className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Tokens</span>

        {categories.map((category) => (
          <FilterChip
            key={category.value}
            selected={selectedCategory === category.value}
            onClick={() => {
              if (selectedCategory === category.value) {
                setSelectedCategory('all');
              } else {
                setSelectedCategory(category.value);
              }
            }}
          >
            {category.label}
          </FilterChip>
        ))}

        {/* Search – desktop only */}
        <div className="relative w-20 sm:w-24 md:w-36 lg:w-44 hidden md:block ml-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/60" />
          <Input
            ref={desktopSearchInputRef}
            surfaceVariant="magenta"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-[var(--ds-space-7)] pr-[var(--ds-space-6)] md:h-7 ds-text-11 text-muted-foreground/60 placeholder:text-muted-foreground/60 focus:text-foreground md:ds-text-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Eraser className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Include frozen/paused assets toggle – desktop only */}
        {setShowFrozenOrPaused && (
          <button
            type="button"
            onClick={() => setShowFrozenOrPaused(!showFrozenOrPaused)}
            className={`hidden md:inline-flex items-center gap-1 h-7 px-2 rounded-md ds-text-11 font-medium transition-colors ${
              showFrozenOrPaused
                ? 'bg-sky-500/15 text-sky-600 shadow-sm border border-sky-400/50'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/40'
            }`}
            title={showFrozenOrPaused ? 'Hide frozen or paused assets' : 'Show frozen or paused assets'}
          >
            <Snowflake className="w-3 h-3" />
            <span className="hidden lg:inline">{showFrozenOrPaused ? 'Frozen or paused assets shown' : 'Show frozen or paused assets'}</span>
          </button>
        )}

        <div className="flex-1 min-w-2 md:min-w-4 hidden md:block" />

        {/* APR/APY toggle – desktop only */}
        <div className="hidden md:block">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 2: Search + APR/APY toggle + Frozen toggle – mobile only */}
      <div className="flex items-center gap-1.5 md:hidden">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            ref={mobileSearchInputRef}
            surfaceVariant="magenta"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-[var(--ds-space-8)] pr-[var(--ds-space-6)] ds-text-11 text-muted-foreground/50 placeholder:text-muted-foreground/50 focus:text-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Eraser className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Include frozen/paused assets toggle – mobile only */}
        {setShowFrozenOrPaused && (
          <button
            type="button"
            onClick={() => setShowFrozenOrPaused(!showFrozenOrPaused)}
            className={`shrink-0 inline-flex items-center justify-center gap-1 h-7 w-7 rounded-md transition-colors ${
              showFrozenOrPaused
                ? 'bg-sky-500/15 text-sky-600 shadow-sm border border-sky-400/50'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/40'
            }`}
            title={showFrozenOrPaused ? 'Hide frozen or paused assets' : 'Show frozen or paused assets'}
          >
            <Snowflake className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="shrink-0">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 3: Markets – chain-level chips + optional chain/hub segmented toggle */}
      <div data-testid="markets-row" className="flex flex-wrap items-center gap-1 md:gap-1.5">
        <span className="ds-text-11 text-muted-foreground/70 hidden sm:inline">Markets</span>

        {/* "All" button */}
        <FilterChip
          selected={noMarketsSelected && noHubSelected}
          onClick={handleAllClick}
        >
          All
        </FilterChip>

        {/* Chain/Hub segmented toggle – only when hubs exist */}
        {hasHubs && (
          <SegmentedToggle
            options={[
              { value: 'chain', label: 'Chain' },
              { value: 'hub', label: 'Hub' },
            ]}
            value={marketViewMode}
            onChange={(val) => {
              if (val === 'chain') {
                setMarketViewMode('chain');
                setSelectedHubs([]);
              } else {
                setMarketViewMode('hub');
                setSelectedMarkets([]);
                setExpandedChain(null);
              }
            }}
            activeTextClassName="text-foreground"
          />
        )}

        {marketViewMode === 'hub' && hasHubs
          ? (
            /* Hub mode: show hub name chips (multi-select) */
            hubNames!.map((hub) => {
              const isSelected = selectedHubs.includes(hub);
              return (
                <FilterChip
                  key={hub}
                  selected={isSelected}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedHubs(selectedHubs.filter((h) => h !== hub));
                    } else {
                      setSelectedHubs([...selectedHubs, hub]);
                    }
                  }}
                  title={hub}
                >
                  {hub}
                </FilterChip>
              );
            })
          )
          : (
            /* Chain mode: original chain chips */
            chainGroups.map((group) => {
              const selected = isChainSelected(group);
              const subSelected = hasSubMarketSelected(group);
              const expanded = expandedChain === group.chainName;

              if (group.expandable) {
                const chipStyle = selected
                  ? 'bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]'
                  : subSelected
                    ? 'bg-card/50 text-foreground/80 border border-dashed border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                    : expanded
                      ? 'bg-card/50 text-muted-foreground border border-border/40'
                      : 'bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80';

                return (
                  <Fragment key={group.chainName}>
                    <div
                      className={`ds-chip flex items-center rounded-md text-[10px] font-medium transition-colors overflow-hidden ${chipStyle}`}
                    >
                      <button
                        onClick={() => handleChainLabelClick(group)}
                        className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 hover:opacity-80 transition-opacity"
                        title={`${selected ? 'Deselect' : 'Select'} all ${group.chainName} markets`}
                      >
                        <ChainIcon chain={group.chainName} />
                        <span>{group.chainName}</span>
                      </button>
                      <div className="w-px h-3.5 bg-current opacity-20 shrink-0" />
                      <button
                        onClick={() => handleExpandToggle(group.chainName)}
                        className="flex items-center px-1 py-0.5 hover:opacity-80 transition-opacity"
                        title={expanded ? 'Collapse sub-markets' : 'Expand sub-markets'}
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ease-in-out ${expanded ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    <div
                      className="flex items-center overflow-hidden transition-all duration-200 ease-in-out"
                      style={{
                        maxWidth: expanded ? '500px' : '0px',
                        opacity: expanded ? 1 : 0,
                      }}
                    >
                      <div className="flex items-center gap-1 pl-1 pr-1">
                        {group.markets
                          .slice()
                          .sort((a, b) => {
                            const aVersion = getProtocolVersion(a.marketName);
                            const bVersion = getProtocolVersion(b.marketName);
                            if (aVersion === 'v4' && bVersion !== 'v4') return -1;
                            if (aVersion !== 'v4' && bVersion === 'v4') return 1;
                            return 0;
                          })
                          .map((market) => {
                            const isSubSelected = selectedMarkets.includes(market.marketName);
                            const version = getProtocolVersion(market.marketName);
                            const isV4 = version === 'v4';
                            return (
                              <button
                                key={market.marketName}
                                onClick={() => toggleSubMarket(market.marketName)}
                                className={`ds-chip gap-0.5 px-1 md:px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 ${
                                  isSubSelected
                                    ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                                    : 'text-foreground/80 border border-border hover:text-foreground'
                                }`}
                                title={market.marketName}
                              >
                                {isV4 && (
                                  <span className="inline-flex items-center px-1 py-0 rounded-full text-[9px] font-medium leading-none text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
                                    V4
                                  </span>
                                )}
                                <span>{getEthSubMarketLabel(market)}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </Fragment>
                );
              }

              // Non-expandable chain: simple chip selecting all markets of this chain
              return (
                <button
                  key={group.chainName}
                  onClick={() => handleOtherChainClick(group)}
                  className={`ds-chip gap-0.5 px-1 md:px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                    selected
                      ? 'ds-text-brand-magenta border border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                      : 'text-foreground/80 border border-border hover:text-foreground'
                  }`}
                  title={group.chainName}
                >
                  <ChainIcon chain={group.chainName} />
                  <span>{group.chainName}</span>
                </button>
              );
            })
          )}
      </div>
    </div>
  );
};

export default FilterBar;
