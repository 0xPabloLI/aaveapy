import { lazy, Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useAaveMarkets } from '@/hooks/useAaveMarkets';
import { useTokenCategories } from '@/hooks/useTokenCategories';
import { SortField, SortOrder, TokenCategory, ReserveWithSpread, TokenPricesIndex } from '@/types/aave';
import {
  buildTokenCategoryGroups,
  isStablecoinSymbol,
  isEthRelatedSymbol,
  isBtcRelatedSymbol,
  isPendleSymbol,
} from '@/lib/tokenCategories';
import Header from '@/components/dashboard/Header';
import FilterBar from '@/components/dashboard/FilterBar';
import TopOpportunities from '@/components/dashboard/TopOpportunities';
import ReservesTable from '@/components/dashboard/ReservesTable';
import LoadingState from '@/components/dashboard/LoadingState';
import PullToRefresh from '@/components/dashboard/PullToRefresh';
import { getCachedMarkets, setCachedTydroRate } from '@/lib/cache';
import { TYDRO_POINT_TO_USD_RATE } from '@/lib/tydro';
import { buildPointRateMap, type PointRateMap } from '@/lib/formatters';
import { AlertTriangle, Send, Github } from 'lucide-react';
import {
  preloadIncentiveIcons,
  setPreloadPaused,
  shouldUseFullPreloadMode,
} from '@/lib/preloadUtils';
import { usePreloadReserveAssets } from '@/hooks/usePreloadReserveAssets';
import { buildMarketsList } from '@/lib/marketsList';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { useIsMobile } from '@/hooks/use-mobile';
import { externalLinkTabProps } from '@/lib/externalNavigation';

import IncentiveTooltip from '@/components/dashboard/IncentiveTooltip';
import InkAprCalculator from '@/components/dashboard/InkAprCalculator';
import { RateInputsVsMarketCheck } from '@/components/dev/RateInputsVsMarketCheck';
const MerklForecastPanel = lazy(() => import('@/components/dashboard/MerklForecastPanel'));

const Index = () => {
  const activeQueryCount = useIsFetching();
  const isMobile = useIsMobile();
  const footerLinkTab = externalLinkTabProps(isMobile);

  // State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>('all');
  const [isApy, setIsApy] = useState(true);
  const [showCacheWarning, setShowCacheWarning] = useState(false);
  
  const [isRateDragging, setIsRateDragging] = useState(false);
  const [whitelistMerklCampaignIds, setWhitelistMerklCampaignIds] = useState<Set<string>>(() => new Set());
  const toggleWhitelistMerklCampaign = useCallback((campaignId: string, enabled: boolean) => {
    const id = String(campaignId || '').trim();
    if (!id) return;
    setWhitelistMerklCampaignIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [pendingScrollReserveId, setPendingScrollReserveId] = useState<string | null>(null);
  const [topTooltipState, setTopTooltipState] = useState<{
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  } | null>(null);
  // Always start at FDV default 1 on load/refresh (do not restore from cache)
  const [tydroPointToUsdRateInput, setTydroPointToUsdRateInput] = useState('1.0000');
  const tydroPointToUsdRate = useMemo(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (Number.isNaN(parsed)) return TYDRO_POINT_TO_USD_RATE;
    return Math.max(parsed, 0);
  }, [tydroPointToUsdRateInput]);

  // Persist Tydro rate to localStorage when it changes
  useEffect(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setCachedTydroRate(parsed);
    }
  }, [tydroPointToUsdRateInput]);

  const pointRateMap = useMemo(
    () => buildPointRateMap(tydroPointToUsdRate),
    [tydroPointToUsdRate]
  );

  // Fetch data - API returns { snapshot, reserves } (breaking change)
  const { data, isLoading, error, isError, refetch } = useAaveMarkets();
  const { data: tokenCategoryOverrides } = useTokenCategories();

  const cachedMarkets = useMemo(() => getCachedMarkets(), []);
  const effectiveReservesData = data ?? cachedMarkets;
  const effectiveMarketsList = useMemo(
    () => buildMarketsList(effectiveReservesData),
    [effectiveReservesData]
  );

  const isUsingCache = !isLoading && isError && !!effectiveReservesData;

  useEffect(() => {
    setPreloadPaused(activeQueryCount > 0);
    return () => setPreloadPaused(false);
  }, [activeQueryCount]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isUsingCache) {
      setShowCacheWarning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCacheWarning(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isUsingCache]);



  const stableReserves = useMemo(
    () => effectiveReservesData?.reserves ?? [],
    [effectiveReservesData?.reserves]
  );
  const hasReserves = stableReserves.length > 0;
  const preloadMode = useMemo(
    () => (shouldUseFullPreloadMode() ? 'full' : 'adaptive'),
    []
  );

  // Preload reserve token/chain icons (uses iconSymbol from reservePatches, same as UI).
  usePreloadReserveAssets(stableReserves, {
    isSuccess: !!data,
    preloadMode,
  });

  // Preload incentive icons after reserve icons (lowest priority).
  useEffect(() => {
    if (!hasReserves) return;
    const timeoutId = setTimeout(() => {
      preloadIncentiveIcons();
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [hasReserves]);

  const tokenCategoryGroups = useMemo(
    () => buildTokenCategoryGroups(tokenCategoryOverrides),
    [tokenCategoryOverrides]
  );

  // Build token price index from market snapshot so simulation/tooltips use backend prices (no CoinGecko backup storm).
  const tokenPrices = useMemo((): TokenPricesIndex => {
    const reserves = effectiveReservesData?.reserves ?? [];
    const index: TokenPricesIndex = {};
    const toKey = (chainId: number, address: string) => `${chainId}:${address.trim().toLowerCase()}`;
    for (const r of reserves) {
      if (r.tokenPrice == null || !Number.isFinite(r.tokenPrice)) continue;
      const price = { price: r.tokenPrice };
      index[toKey(r.chainId, r.tokenAddress)] = price;
      if (r.aTokenAddress) index[toKey(r.chainId, r.aTokenAddress)] = price;
      if (r.vTokenAddress) index[toKey(r.chainId, r.vTokenAddress)] = price;
    }
    return index;
  }, [effectiveReservesData?.reserves]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const scrollToReserveElement = useCallback((id: string) => {
    const el = document.querySelector(`[data-reserve-id="${id}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('reserve-highlight');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('reserve-highlight');
    return true;
  }, []);

  const handleTopCardClick = useCallback((reserve: Pick<ReserveWithSpread, 'marketName' | 'tokenAddress'>) => {
    const id = `${reserve.marketName}-${reserve.tokenAddress}`;
    setSearchQuery('');
    setSelectedMarkets([]);
    setSelectedCategory('all');
    setPendingScrollReserveId(id);
    scrollToReserveElement(id);
  }, [scrollToReserveElement]);

  useEffect(() => {
    if (!pendingScrollReserveId) return;
    const timer = setTimeout(() => {
      scrollToReserveElement(pendingScrollReserveId);
      setPendingScrollReserveId(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [pendingScrollReserveId, scrollToReserveElement]);

  const handleTopIncentiveClick = useCallback((payload: {
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  }) => {
    setTopTooltipState({
      reserve: payload.reserve,
      type: payload.type,
      position: payload.position,
      triggerCenterX: payload.triggerCenterX,
      triggerHeight: payload.triggerHeight,
      triggerRect: payload.triggerRect,
      accentBorderClass: payload.accentBorderClass,
      accentTextClass: payload.accentTextClass,
      accentBgClass: payload.accentBgClass,
    });
  }, []);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortField(null);
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredReserves = useMemo(() => {
    if (!effectiveReservesData?.reserves) return [];
    return effectiveReservesData.reserves.filter((reserve) => {
      // Search filter - only match tokenSymbol
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const symbol = reserve.tokenSymbol.toLowerCase();
        const normalizedQuery = normalizeTokenSymbolForSearch(searchQuery);
        const normalizedSymbol = normalizeTokenSymbolForSearch(reserve.tokenSymbol);

        const matchesRaw = symbol.includes(query);
        const matchesNormalized = normalizedQuery.length > 0 && normalizedSymbol.includes(normalizedQuery);
        if (!matchesRaw && !matchesNormalized) {
          return false;
        }
      }

      // Market filter
      if (selectedMarkets.length > 0) {
        if (!selectedMarkets.includes(reserve.marketName)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const symbol = reserve.tokenSymbol.toUpperCase();
        switch (selectedCategory) {
          case 'stablecoin':
            if (!isStablecoinSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'eth-related':
            if (!isEthRelatedSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'btc-related':
            if (!isBtcRelatedSymbol(symbol, tokenCategoryGroups)) return false;
            break;
          case 'pendle':
            if (!isPendleSymbol(symbol)) return false;
            break;
        }
      }

      return true;
    });
  }, [effectiveReservesData?.reserves, searchQuery, selectedMarkets, selectedCategory, tokenCategoryGroups]);

  if (isLoading && !effectiveReservesData) {
    return <LoadingState />;
  }

  // Always show the page framework, even if there's an error
  // If we have cached data, use it; otherwise show empty state
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen min-w-0 w-full bg-background">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 container mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-4)] py-[var(--ds-space-3)] md:py-[var(--ds-space-5)] space-y-3 md:space-y-5">
          {/* Cache warning banner */}
          {showCacheWarning && (
            <div className="rounded-lg border ds-border-amber-500-50 ds-bg-amber-500-10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 ds-text-amber-600 shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium ds-text-amber-900">
                  Using cached data
                </p>
                <p className="ds-text-11 ds-text-amber-700 mt-[var(--ds-space-1)]">
                  Unable to fetch latest data. Displaying cached information. Please check your connection and try refreshing.
                </p>
              </div>
            </div>
          )}

          {/* Error banner (only show if no cache available) */}
          {error && !effectiveReservesData && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium text-destructive">
                  Failed to load data
                </p>
                <p className="ds-text-11 text-destructive/80 mt-[var(--ds-space-1)]">
                  {(error as Error).message || 'An unexpected error occurred. Please check your connection and try again later.'}
                </p>
              </div>
            </div>
          )}

          {/* No data warning banner (when there's no data, no error, and no cache) */}
          {!effectiveReservesData && !isLoading && !error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)]">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-[var(--ds-space-0-5)]" />
              <div className="flex-1 min-w-0">
                <p className="ds-text-14 font-medium text-destructive">
                  No data available
                </p>
                <p className="ds-text-11 text-destructive/80 mt-[var(--ds-space-1)]">
                  Unable to load data. Please check your connection and try refreshing the page.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <Header
            lastUpdated={effectiveReservesData?.snapshot?.lastUpdated}
          />

          {/* INK Incentive APR Calculator */}
          <>
            <InkAprCalculator
              rateInput={tydroPointToUsdRateInput}
              setRateInput={setTydroPointToUsdRateInput}
              onDragStateChange={setIsRateDragging}
            />
          </>

          {/* Top Opportunities */}
          {stableReserves && stableReserves.length > 0 && (
            <TopOpportunities
              reserves={stableReserves}
              isApy={isApy}
              isRateDragging={isRateDragging}
              whitelistMerklCampaignIds={whitelistMerklCampaignIds}
              categoryGroups={tokenCategoryGroups}
              onIncentiveClick={handleTopIncentiveClick}
              onCardClick={handleTopCardClick}
              pointRateMap={pointRateMap}
            />
          )}

          {/* Filters + Reserves Table (tighter gap) */}
          <div className="space-y-2 md:space-y-3">
            <FilterBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedMarkets={selectedMarkets}
              setSelectedMarkets={setSelectedMarkets}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              isApy={isApy}
              setIsApy={setIsApy}
              marketsList={effectiveMarketsList}
            />

            <ReservesTable
              reserves={filteredReserves}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              isApy={isApy}
              isLoading={isLoading}
              onSelectMarket={(marketName) => {
                setSelectedMarkets((prev) =>
                  prev.length === 1 && prev[0] === marketName ? [] : [marketName]
                );
              }}
              pointRateMap={pointRateMap}
              whitelistMerklCampaignIds={whitelistMerklCampaignIds}
              onToggleWhitelistMerklCampaign={toggleWhitelistMerklCampaign}
              tokenPrices={tokenPrices}
              scrollToReserveId={pendingScrollReserveId}
            />
          </div>

          {topTooltipState && (
              <IncentiveTooltip
                reserve={topTooltipState.reserve}
                type={topTooltipState.type}
                position={topTooltipState.position}
                triggerCenterX={topTooltipState.triggerCenterX}
                triggerHeight={topTooltipState.triggerHeight}
                triggerRect={topTooltipState.triggerRect}
                accentBorderClass={topTooltipState.accentBorderClass}
                accentTextClass={topTooltipState.accentTextClass}
                accentBgClass={topTooltipState.accentBgClass}
                onClose={() => setTopTooltipState(null)}
                isApy={isApy}
                pointRateMap={pointRateMap}
                whitelistMerklCampaignIds={whitelistMerklCampaignIds}
                onToggleWhitelistMerklCampaign={toggleWhitelistMerklCampaign}
                usePortal
              />
          )}

          {/* Empty state */}
          {filteredReserves.length === 0 && effectiveReservesData && !isLoading && (
            <div className="text-center py-[var(--ds-space-12)]">
              <p className="text-muted-foreground">No reserves found matching your filters</p>
            </div>
          )}

          {/* No data state (when there's no data at all, not even cache) - only show if no banner is shown */}
          {!effectiveReservesData && !isLoading && !!error && (
            <div className="text-center py-[var(--ds-space-12)]">
              <p className="text-muted-foreground">No data to display</p>
            </div>
          )}

          {/* Dev-only debug panels: Merkl Forecast + Rate vs Market check */}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_RATE_CHECK === 'true') && (
            <div className="space-y-4">
              <Suspense fallback={<div className="h-[120px] rounded-xl bg-muted/50 animate-pulse" />}>
                <MerklForecastPanel
                  reserves={filteredReserves}
                  pointRateMap={pointRateMap}
                  whitelistMerklCampaignIds={whitelistMerklCampaignIds}
                  onToggleWhitelistMerklCampaign={toggleWhitelistMerklCampaign}
                  tokenPrices={tokenPrices}
                />
              </Suspense>
              <div className="max-w-4xl mx-auto">
                <RateInputsVsMarketCheck />
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="border-t border-border/50 py-[var(--ds-space-8)]">
            <div className="flex flex-col items-center gap-1.5 px-4 sm:gap-2">
              <p className="text-center ds-text-14 text-muted-foreground leading-relaxed">
                Data sourced from{' '}
                <a
                  href="https://app.aave.com"
                  {...footerLinkTab}
                  className="text-secondary hover:underline"
                >
                  Aave Protocol
                </a>
                {', '}
                <a
                  href="https://app.merkl.xyz"
                  {...footerLinkTab}
                  className="text-secondary hover:underline"
                >
                  Merkl
                </a>
                {', '}
                <a
                  href="https://apps.aavechan.com/"
                  {...footerLinkTab}
                  className="text-secondary hover:underline"
                >
                  ACI
                </a>
                {', '}
                <a
                  href="https://incentra.brevis.network/"
                  {...footerLinkTab}
                  className="text-secondary hover:underline"
                >
                  Brevis
                </a>
              </p>

              <p className="text-xs sm:text-sm text-signature opacity-85">
                Built with ❤️ by{' '}
                <a
                  href="https://twitter.com/silenlee"
                  {...footerLinkTab}
                  aria-label="Pablo on X"
                  className="inline-flex items-center gap-2 align-baseline text-signature-strong transition-opacity duration-200 hover:opacity-100"
                >
                  <span>Pablo</span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                  >
                    <path d="M18.244 2H21.5l-7.11 8.126L22.75 22h-6.545l-5.124-6.694L5.22 22H1.96l7.603-8.694L1.5 2h6.711l4.632 6.112L18.244 2Zm-1.143 18.02h1.804L7.23 3.875H5.295L17.101 20.02Z" />
                  </svg>
                </a>
              </p>

              {/* Social links */}
              <div className="flex items-center gap-[var(--ds-space-3)] mt-[var(--ds-space-2)]">
                <a
                  href="https://t.me/aaveapy"
                  {...footerLinkTab}
                  aria-label="Join @aaveapy on Telegram"
                  title="Join @aaveapy on Telegram"
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-border/40 bg-card/60 text-muted-foreground transition-colors hover:bg-[hsl(200_100%_45%/0.12)] hover:text-[hsl(200_100%_45%)] hover:border-[hsl(200_100%_45%/0.4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Send className="w-4 h-4" />
                </a>
                <a
                  href="https://github.com/0xPabloLI/aaveapy"
                  {...footerLinkTab}
                  aria-label="View source on GitHub"
                  title="View source on GitHub"
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-border/40 bg-card/60 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Index;
