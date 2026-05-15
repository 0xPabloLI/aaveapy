import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Eraser, ChevronRight, ChevronLeft, Snowflake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterChip } from '@/components/ui/filter-chip';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { TokenCategory, MarketListItem } from '@/types/aave';
import { getChainIconSrc } from '@/lib/chainIcons';
import { useIsMobile } from '@/hooks/use-mobile';
import AprApyToggle from '@/components/dashboard/AprApyToggle';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { getEthSubMarketLabel } from '@/lib/marketLabels';

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
  /** Available hub entries derived from current reserves (id for filtering, name for display). */
  hubEntries?: { id: string; name: string }[];
  /** Currently selected hub IDs (empty = "All"). */
  selectedHubs: string[];
  /** Set selected hub IDs. */
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
  hubEntries,
  selectedHubs,
  setSelectedHubs,
  marketViewMode: controlledMarketViewMode,
  setMarketViewMode: setControlledMarketViewMode,
  expandedChain: controlledExpandedChain,
  setExpandedChain: setControlledExpandedChain,
}: FilterBarProps) => {
  const isMobile = useIsMobile();
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search token');
  const [marketFilterQuery, setMarketFilterQuery] = useState('');
  const [marketFilterOpen, setMarketFilterOpen] = useState(false);
  const marketFilterInputRef = useRef<HTMLInputElement>(null);
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

  const filteredChainGroups = useMemo(() => {
    if (!marketFilterQuery) return chainGroups;
    const q = marketFilterQuery.toLowerCase().trim();
    return chainGroups
      .map((group) => {
        const chainMatches = group.chainName.toLowerCase().includes(q);
        const matchedMarkets = group.markets.filter((m) => m.marketName.toLowerCase().includes(q));
        if (chainMatches) return group;
        if (matchedMarkets.length > 0) return { ...group, markets: matchedMarkets };
        return null;
      })
      .filter((g): g is ChainGroup => g !== null);
  }, [chainGroups, marketFilterQuery]);

  useEffect(() => {
    if (!marketFilterQuery) return;
    const q = marketFilterQuery.toLowerCase().trim();
    const hasSubMarketMatch = chainGroups.some(
      (g) => g.expandable && !g.chainName.toLowerCase().includes(q) && g.markets.some((m) => m.marketName.toLowerCase().includes(q)),
    );
    if (hasSubMarketMatch && expandedChain === null) {
      const expandableGroup = chainGroups.find(
        (g) => g.expandable && g.markets.some((m) => m.marketName.toLowerCase().includes(q)),
      );
      if (expandableGroup) setExpandedChain(expandableGroup.chainName);
    }
  }, [marketFilterQuery, chainGroups, expandedChain, setExpandedChain]);

  const filteredHubEntries = useMemo(() => {
    if (!marketFilterQuery || !hubEntries) return hubEntries;
    const q = marketFilterQuery.toLowerCase().trim();
    return hubEntries.filter((h) => h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q));
  }, [hubEntries, marketFilterQuery]);

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
      setExpandedChain(expandedChain === chainName ? null : chainName);
    },
    [setExpandedChain, expandedChain],
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

  const hasHubs = hubEntries && hubEntries.length > 0;

  return (
    <div className="space-y-2 md:space-y-2.5">
      {/* Row 1: Token Categories + Frozen Toggle + APY Toggle */}
      <div data-testid="tokens-row" className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <span className="ds-text-11 leading-none text-muted-foreground/70 hidden sm:inline">Tokens</span>

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

        {/* Search – inline with categories */}
        <div className="relative w-20 sm:w-24 md:w-36 lg:w-44 ml-1 hidden md:block">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/60" />
          <Input
            ref={desktopSearchInputRef}
            surfaceVariant="magenta"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[var(--ds-chip-h)] pl-[var(--ds-space-7)] pr-[var(--ds-space-6)] md:h-[var(--ds-chip-h)] ds-text-11 text-muted-foreground/60 placeholder:text-muted-foreground/60 focus:text-foreground md:ds-text-11"
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
            className={`hidden md:inline-flex items-center gap-1 h-[var(--ds-chip-h)] px-2 rounded-md ds-text-11 font-medium transition-colors ${
              showFrozenOrPaused
                ? 'bg-sky-500/15 text-sky-600 shadow-sm border border-sky-400/50'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/40'
            }`}
            title={showFrozenOrPaused ? 'Hide frozen or paused assets' : 'Show frozen or paused assets'}
          >
            <Snowflake className="w-3 h-3" />
            <span className="hidden lg:inline">{showFrozenOrPaused ? 'Restricted assets shown' : 'Show restricted assets'}</span>
          </button>
        )}

        <div className="flex-1 min-w-2 md:min-w-4 hidden md:block" />

        {/* APR/APY toggle – desktop only */}
        <div className="hidden md:block">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 2: Search + Frozen toggle + APR/APY toggle – mobile only */}
      <div className="flex items-center gap-1.5 md:hidden">
        {/* Mobile search – fills remaining row space */}
        <div className="relative flex-1 min-w-[7rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            ref={mobileSearchInputRef}
            surfaceVariant="magenta"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[var(--ds-chip-h)] pl-[var(--ds-space-8)] pr-[var(--ds-space-6)] ds-text-11 text-muted-foreground/50 placeholder:text-muted-foreground/50 focus:text-foreground"
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

        {/* Include frozen/paused assets toggle – mobile, with full label */}
        {setShowFrozenOrPaused && (
          <button
            type="button"
            onClick={() => setShowFrozenOrPaused(!showFrozenOrPaused)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-[var(--ds-chip-h)] px-2 rounded-md ds-text-11 font-medium transition-colors ${
              showFrozenOrPaused
                ? 'bg-sky-500/15 text-sky-600 shadow-sm border border-sky-400/50'
                : 'bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/40'
            }`}
            title={showFrozenOrPaused ? 'Hide frozen or paused assets' : 'Show frozen or paused assets'}
          >
            <Snowflake className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{showFrozenOrPaused ? 'Restricted assets shown' : 'Show restricted assets'}</span>
          </button>
        )}

        <div className="shrink-0">
          <AprApyToggle isApy={isApy} setIsApy={setIsApy} />
        </div>
      </div>

      {/* Row 3: Markets – chain-level chips + optional chain/hub segmented toggle */}
      <div data-testid="markets-row" className="flex flex-wrap items-center gap-1 md:gap-1.5">
        <span className="ds-text-11 leading-none text-muted-foreground/70 hidden sm:inline">Markets</span>

        {/* "All" button */}
        <FilterChip
          selected={noMarketsSelected && noHubSelected}
          onClick={handleAllClick}
        >
          All
        </FilterChip>

        {/* Market filter search */}
        <button
          type="button"
          onClick={() => {
            setMarketFilterOpen((prev) => !prev);
            if (marketFilterOpen) setMarketFilterQuery('');
            else setTimeout(() => marketFilterInputRef.current?.focus(), 50);
          }}
          className={`inline-flex items-center justify-center h-[var(--ds-chip-h)] w-[var(--ds-chip-h)] rounded-md transition-colors ${
            marketFilterOpen || marketFilterQuery
              ? 'bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb)))]'
              : 'bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80'
          }`}
          title="Filter markets"
          data-testid="market-filter-toggle"
        >
          <Search className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {marketFilterOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="relative w-28 md:w-36">
                <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/60" />
                <Input
                  ref={marketFilterInputRef}
                  surfaceVariant="magenta"
                  placeholder="Market"
                  value={marketFilterQuery}
                  onChange={(e) => setMarketFilterQuery(e.target.value)}
                  className="h-[var(--ds-chip-h)] pl-5 pr-5 ds-text-11 text-muted-foreground/60 placeholder:text-muted-foreground/60 focus:text-foreground"
                  data-testid="market-filter-input"
                />
                {marketFilterQuery && (
                  <button
                    onClick={() => setMarketFilterQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Eraser className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chain/Hub segmented toggle – only when hubs exist */}
        {hasHubs && (
          <SegmentedToggle
            options={[
              { value: 'chain', label: 'Chain' },
              { value: 'hub', label: 'Hub' },
            ]}
            value={marketViewMode}
            onChange={setMarketViewMode}
            activeTextClassName="text-foreground"
            size="chip"
          />
        )}

        {marketViewMode === 'hub' && hasHubs
          ? (
            /* Hub mode: show hub chips (multi-select, keyed by id, labeled by name) */
            (filteredHubEntries ?? []).map((hub) => {
              const isSelected = selectedHubs.includes(hub.id);
              return (
                <FilterChip
                  key={hub.id}
                  selected={isSelected}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedHubs(selectedHubs.filter((h) => h !== hub.id));
                    } else {
                      setSelectedHubs([...selectedHubs, hub.id]);
                    }
                  }}
                  title={hub.name}
                >
                  {hub.name}
                </FilterChip>
              );
            })
          )
          : (
            /* Chain mode: original chain chips */
            filteredChainGroups.map((group) => {
              const selected = isChainSelected(group);
              const subSelected = hasSubMarketSelected(group);
              const expanded = expandedChain === group.chainName;

              if (group.expandable) {
                const chipStyle = selected
                  ? 'bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]'
                  : subSelected
                    ? 'bg-card/50 text-foreground/80 border border-dashed border-[rgb(var(--ds-brand-magenta-rgb))] shadow-sm'
                    : 'bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80';

                return (
                  <Fragment key={group.chainName}>
                    <div
                      className={`ds-chip flex items-center rounded-md font-medium transition-colors overflow-hidden ${chipStyle}`}
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
                        title={expanded ? 'Collapse Ethereum markets' : 'Expand Ethereum markets'}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {expanded
                            ? <motion.span key="left" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} className="flex items-center"><ChevronLeft className="w-3 h-3" /></motion.span>
                            : <motion.span key="right" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} className="flex items-center"><ChevronRight className="w-3 h-3" /></motion.span>
                          }
                        </AnimatePresence>
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {expanded && group.markets
                        .slice()
                        .sort((a, b) => {
                          const aVersion = getProtocolVersion(a.marketName);
                          const bVersion = getProtocolVersion(b.marketName);
                          if (aVersion === 'v4' && bVersion !== 'v4') return -1;
                          if (aVersion !== 'v4' && bVersion === 'v4') return 1;
                          return 0;
                        })
                        .map((market, index) => {
                          const isSubSelected = selectedMarkets.includes(market.marketName);
                          const version = getProtocolVersion(market.marketName);
                          const isV4 = version === 'v4';
                          return (
                            <motion.button
                              key={market.marketName}
                              layout
                              variants={{
                                hidden: { width: 0, opacity: 0, scale: 0.98 },
                                visible: (i: number) => ({
                                  width: 'auto',
                                  opacity: 1,
                                  scale: 1,
                                  transition: {
                                    width: { duration: 0.3, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] },
                                    opacity: { duration: 0.22, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] },
                                    scale: { duration: 0.3, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] },
                                  },
                                }),
                                exit: (i: number) => ({
                                  width: 0,
                                  opacity: 0,
                                  scale: 0.98,
                                  transition: {
                                    width: { duration: 0.18, delay: i * 0.02, ease: [0.55, 0, 1, 0.45] },
                                    opacity: { duration: 0.14, delay: i * 0.02, ease: [0.55, 0, 1, 0.45] },
                                    scale: { duration: 0.18, delay: i * 0.02, ease: [0.55, 0, 1, 0.45] },
                                  },
                                }),
                              }}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              custom={index}
                              transition={{ layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
                              onClick={() => toggleSubMarket(market.marketName)}
                              className={`ds-chip gap-0.5 px-1 md:px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap overflow-hidden transition-colors hover:scale-105 active:scale-95 ${
                                isSubSelected
                                  ? 'bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]'
                                  : 'bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80'
                              }`}
                              title={market.marketName}
                            >
                              {isV4 && (
                                <span className="inline-flex items-center px-1 py-0 rounded-full ds-text-9 !leading-none font-medium text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
                                  V4
                                </span>
                              )}
                              <span>{getEthSubMarketLabel(market.marketName)}</span>
                            </motion.button>
                          );
                        })}
                    </AnimatePresence>
                    {expanded && <div className="w-px h-3.5 bg-current opacity-20 shrink-0" />}
                  </Fragment>
                );
              }

              // Non-expandable chain: simple chip selecting all markets of this chain
              return (
                <button
                  key={group.chainName}
                  onClick={() => handleOtherChainClick(group)}
                  className={`ds-chip gap-0.5 px-1 md:px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                    selected
                      ? 'bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]'
                      : 'bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80'
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
