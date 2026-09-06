import { useState, useMemo, useCallback, useEffect, useRef, startTransition } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SimulationMode } from '@/components/dashboard/PortfolioModeToggle';
import { usePortfolioSimulation } from '@/hooks/usePortfolioSimulation';
import { useUserPositionsSdk, type WalletLoadState } from '@/hooks/useUserPositionsSdk';
import { useWalletAutoImport } from '@/hooks/useWalletAutoImport';
import { useWallet } from '@/hooks/useWallet';
import { useOnchainHealthFactor } from '@/hooks/useOnchainHealthFactor';
import { useCampaignAccess } from '@/hooks/useCampaignAccess';
import { useIsFetching } from '@tanstack/react-query';
import { useChainDiscovery } from '@/hooks/useChainDiscovery';
import { useAaveMarkets } from '@/hooks/useAaveMarkets';
import { deriveV3AssetsByMarket, deriveV4ReservesBySpoke } from '@/lib/deriveOnchainConfig';
import { convertWalletPositionsToEntries } from '@/lib/walletPositionToPortfolio';
import { useTokenCategories } from '@/hooks/useTokenCategories';
import { SortField, TokenCategory, ReserveWithSpread, TokenPricesIndex } from '@/types/aave';
import type { SortOrder } from '@/lib/sorters';
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
import { TYDRO_POINT_TO_USD_RATE, buildPointRateMap } from '@/lib/tydro';
import { AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  preloadIncentiveIcons,
  setPreloadPaused,
  shouldUseFullPreloadMode,
} from '@/lib/preloadUtils';
import { usePreloadReserveAssets } from '@/hooks/usePreloadReserveAssets';
import { buildMarketsList, getChainCount } from '@/lib/marketsList';
import { marketKey } from '@/lib/marketKey';
import { slugifyMarketLabel, resolveMarketSlugs } from '@/lib/marketSlug';
import { getReserveKey } from '@/lib/reserveKey';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { useIsMobile } from '@/hooks/use-mobile';
import { externalLinkTabProps } from '@/lib/externalNavigation';

import InkAprCalculator from '@/components/dashboard/InkAprCalculator';
import FaqSection from '@/components/dashboard/FaqSection';
import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN } from '@/i18n';

const Index = () => {
  const activeQueryCount = useIsFetching();
  const isMobile = useIsMobile();
  const footerLinkTab = externalLinkTabProps(isMobile);

  // State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory>("all");
  const [isApy, setIsApy] = useState(true);
  const [showFrozenOrPaused, setShowFrozenOrPaused] = useState(false);
  const [showCacheWarning, setShowCacheWarning] = useState(false);
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
  const [marketViewMode, setMarketViewMode] = useState<'chain' | 'hub'>('chain');
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const topOppsRef = useRef<HTMLDivElement>(null);

  const [isRateDragging, setIsRateDragging] = useState(false);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('single');
  const portfolio = usePortfolioSimulation();
  const [whitelistMerklCampaignIds, setWhitelistMerklCampaignIds] = useState<Set<string>>(() => new Set());
  const { address: walletAddress, isConnected: walletConnected } = useWallet();
  const { campaignAccessStatuses } = useCampaignAccess(walletAddress);
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



  // Always start at FDV default 1 on load/refresh (do not restore from cache)
  const [tydroPointToUsdRateInput, setTydroPointToUsdRateInput] = useState('1.0000');
  const tydroPointToUsdRate = useMemo(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (Number.isNaN(parsed)) return TYDRO_POINT_TO_USD_RATE;
    return Math.max(parsed, 0);
  }, [tydroPointToUsdRateInput]);

  const pointRateMap = useMemo(() => buildPointRateMap(tydroPointToUsdRate), [tydroPointToUsdRate]);

  // Persist Tydro rate to localStorage when it changes
  useEffect(() => {
    const parsed = parseFloat(tydroPointToUsdRateInput);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setCachedTydroRate(parsed);
    }
  }, [tydroPointToUsdRateInput]);

  // Fetch data - API returns { snapshot, reserves } (breaking change)
  const { data, isLoading, error, isError, refetch, dataUpdatedAt } = useAaveMarkets();
  const { data: tokenCategoryOverrides } = useTokenCategories();

  // Trigger runtime chain discovery for any unregistered chains in reserves
  useChainDiscovery();

  const cachedMarkets = useMemo(() => getCachedMarkets(), []);
  const effectiveReservesData = data ?? cachedMarkets;
  const effectiveMarketsList = useMemo(
    () => buildMarketsList(effectiveReservesData),
    [effectiveReservesData]
  );
  const chainCount = useMemo(
    () => getChainCount(effectiveReservesData),
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

  const [searchParams, setSearchParams] = useSearchParams();
  const initialParamsAppliedRef = useRef(false);

  // One-time hydration: read initial URL params (chain/category/search) into state.
  // Fall back to localStorage when URL params are missing, so refresh/reopen restores filters.
  useEffect(() => {
    if (initialParamsAppliedRef.current) return;

    let chainParam = searchParams.get('chain');
    let categoryParam = searchParams.get('category');
    let searchParam = searchParams.get('search');
    let marketParam = searchParams.get('market');

    // Fallback to persisted filters when URL params are absent.
    let persisted: { chain?: string | null; category?: string | null; search?: string | null; market?: string | null } | null = null;
    if (chainParam === null && categoryParam === null && searchParam === null && marketParam === null) {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('aaveapy:filters') : null;
        if (raw) persisted = JSON.parse(raw);
      } catch {
        persisted = null;
      }
      if (persisted) {
        chainParam = persisted.chain ?? null;
        categoryParam = persisted.category ?? null;
        searchParam = persisted.search ?? null;
        marketParam = persisted.market ?? null;
      }
    }

    // Wait for markets list before resolving chain param (so chain → markets mapping works).
    if (chainParam && effectiveMarketsList.length === 0) return;

    let hasInvalidParam = false;
    let marketHadInvalid = false;

    if (chainParam) {
      const chainFilter = chainParam.trim().toLowerCase();
      if (chainFilter) {
        const matchedKeys = effectiveMarketsList
          .filter((m) => m.chainName.toLowerCase().includes(chainFilter))
          .map((m) => marketKey(m.chainId, m.marketName));
        if (matchedKeys.length > 0) {
          // If market param present, narrow down to specific markets
          let finalKeys = matchedKeys;
          if (marketParam) {
            const chainId = effectiveMarketsList.find(
              (m) => m.chainName.toLowerCase().includes(chainFilter),
            )?.chainId;
            if (chainId !== undefined) {
              const slugs = marketParam.split(',').map((s) => s.trim()).filter(Boolean);
              const { resolved, invalid } = resolveMarketSlugs(slugs, chainId, effectiveMarketsList);
              if (resolved.length > 0 && resolved.length < matchedKeys.length) {
                finalKeys = resolved;
              }
              if (invalid.length > 0) {
                hasInvalidParam = true;
                marketHadInvalid = true;
                toast.info(`Market "${invalid.join(', ')}" not found — showing all ${chainParam} markets`);
              }
            }
          }
          setSelectedMarkets(finalKeys);
          setMarketViewMode('chain');
        } else {
          hasInvalidParam = true;
          toast.info(`Chain "${chainParam}" not supported — showing all chains`);
        }
      }
    }

    if (categoryParam) {
      const cat = categoryParam.trim().toLowerCase() as TokenCategory;
      if (['stablecoin', 'eth-related', 'btc-related', 'pendle', 'all'].includes(cat)) {
        setSelectedCategory(cat);
      } else {
        hasInvalidParam = true;
        toast.info(`Category "${categoryParam}" not recognized — showing all categories`);
      }
    }

    if (searchParam) {
      setSearchQuery(searchParam.trim());
    }

    // Clean invalid params from URL so the user gets a valid shareable link.
    if (hasInvalidParam) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const chainFilter = chainParam?.trim().toLowerCase() ?? '';
        const chainMatched =
          chainFilter &&
          effectiveMarketsList.some((m) => m.chainName.toLowerCase().includes(chainFilter));
        if (!chainMatched) {
          next.delete('chain');
          next.delete('market'); // market without valid chain is meaningless
        }
        if (marketHadInvalid) next.delete('market');

        const cat = categoryParam?.trim().toLowerCase() ?? '';
        const catValid = ['stablecoin', 'eth-related', 'btc-related', 'pendle', 'all'].includes(cat);
        if (!catValid) next.delete('category');

        return next.toString() === prev.toString() ? prev : next;
      }, { replace: true });
    }

    initialParamsAppliedRef.current = true;
  }, [effectiveMarketsList, searchParams, setSearchParams]);

  // Derive chain slug from selected markets — only when all share a single chain.
  const derivedChainSlug = useMemo(() => {
    if (selectedMarkets.length === 0 || effectiveMarketsList.length === 0) return null;
    const chains = new Set<string>();
    for (const key of selectedMarkets) {
      const m = effectiveMarketsList.find((x) => marketKey(x.chainId, x.marketName) === key);
      if (m?.chainName) chains.add(m.chainName);
    }
    if (chains.size !== 1) return null;
    return [...chains][0].toLowerCase().replace(/\s+/g, '-');
  }, [selectedMarkets, effectiveMarketsList]);

  // Derive market slugs from selected markets — only when all share a single chain
  // and NOT all markets of that chain are selected (full-select omits market param).
  const derivedMarketSlugs = useMemo(() => {
    if (selectedMarkets.length === 0 || effectiveMarketsList.length === 0) return null;
    const chains = new Set<string>();
    for (const key of selectedMarkets) {
      const m = effectiveMarketsList.find((x) => marketKey(x.chainId, x.marketName) === key);
      if (m?.chainName) chains.add(m.chainName);
    }
    if (chains.size !== 1) return null;
    const chainName = [...chains][0];
    const chainMarketCount = effectiveMarketsList.filter((m) => m.chainName === chainName).length;
    if (selectedMarkets.length >= chainMarketCount) return null; // full-select
    return selectedMarkets
      .map((key) => {
        const m = effectiveMarketsList.find((x) => marketKey(x.chainId, x.marketName) === key);
        return m ? slugifyMarketLabel(m.marketName) : null;
      })
      .filter((slug): slug is string => slug !== null);
  }, [selectedMarkets, effectiveMarketsList]);


  // Two-way sync: push current filter state into URL whenever it changes,
  // and mirror to localStorage so refresh/reopen restores the same view.
  useEffect(() => {
    if (!initialParamsAppliedRef.current) return;
    const trimmed = searchQuery.trim();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (derivedChainSlug) next.set('chain', derivedChainSlug);
      else next.delete('chain');
      if (derivedMarketSlugs) next.set('market', derivedMarketSlugs.join(','));
      else next.delete('market');
      if (selectedCategory && selectedCategory !== 'all') next.set('category', selectedCategory);
      else next.delete('category');
      if (trimmed) next.set('search', trimmed);
      else next.delete('search');
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });

    try {
      if (typeof window !== 'undefined') {
        const payload = {
          chain: derivedChainSlug ?? null,
          market: derivedMarketSlugs ? derivedMarketSlugs.join(',') : null,
          category: selectedCategory && selectedCategory !== 'all' ? selectedCategory : null,
          search: trimmed || null,
        };
        if (!payload.chain && !payload.market && !payload.category && !payload.search) {
          window.localStorage.removeItem('aaveapy:filters');
        } else {
          window.localStorage.setItem('aaveapy:filters', JSON.stringify(payload));
        }
      }
    } catch {
      // ignore storage errors (quota / private mode)
    }
  }, [derivedChainSlug, derivedMarketSlugs, selectedCategory, searchQuery, setSearchParams]);


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

  // Wallet position sync (SDK-first + on-chain fallback)
  const v3AssetsByMarket = useMemo(() => deriveV3AssetsByMarket(stableReserves), [stableReserves]);
  const v4ReservesBySpoke = useMemo(() => deriveV4ReservesBySpoke(stableReserves), [stableReserves]);
  const {
    walletLoadState,
    result: walletResult,
    v3SdkFailed,
    v4SdkFailed,
  } = useUserPositionsSdk(stableReserves, v3AssetsByMarket, v4ReservesBySpoke);


  // Auto-import: wallet connect → SDK query → merge → toast
  useWalletAutoImport({
    address: walletAddress,
    isConnected: walletConnected,
    walletLoadState,
    walletResult,
    v3SdkFailed,
    v4SdkFailed,
    reserves: stableReserves,
    portfolioActions: portfolio.actions,
    onImport: () => setSimulationMode('portfolio'),
    onDisconnect: () => setSimulationMode('single'),
  });

// On-chain HF baseline (AAV-1253 P7) — fetch real HF per pool/spoke when wallet is connected
const onchainHfResult = useOnchainHealthFactor({
  address: walletAddress,
  entries: portfolio.entries,
  reserves: stableReserves,
});

  const handleWalletSync = useCallback(() => {
    if (walletResult.status === 'success' || walletResult.status === 'partial') {
      const incoming = convertWalletPositionsToEntries(walletResult.data.positions, stableReserves);
      if (incoming.length === 0) {
        toast.info('Wallet has no positions');
        return;
      }
      portfolio.actions.forceSyncReserves(incoming);
      setSimulationMode('portfolio');
      toast.success(`Synced ${incoming.length} position${incoming.length > 1 ? 's' : ''} from wallet`);
    } else if (walletResult.status === 'error') {
      toast.error('Failed to load wallet positions');
    }
  }, [walletResult, stableReserves, portfolio.actions]);
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

  const handleTopCardClick = useCallback((reserve: ReserveWithSpread) => {
    const id = getReserveKey(reserve);
    setSearchQuery('');
    setSelectedMarkets([]);
    setSelectedCategory('all');
    setSelectedHubs([]);
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


  // Derive unique hub entries (id + display name + chain) from current reserves (stable, alphabetical by name)
  const hubEntries = useMemo(() => {
    const reserves = effectiveReservesData?.reserves ?? [];
    const map = new Map<string, { name: string; chainId: number; chainName: string }>();
    for (const r of reserves) {
      if (r.hubId?.trim()) {
        const id = r.hubId.trim();
        if (!map.has(id)) {
          map.set(id, {
            name: r.hubName?.trim() || id,
            chainId: r.chainId,
            chainName: r.chainName,
          });
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [effectiveReservesData?.reserves]);

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
        if (!selectedMarkets.includes(marketKey(reserve.chainId, reserve.marketName))) {
          return false;
        }
      }

      // Hub filter (by hubId, not hubName)
      if (selectedHubs.length > 0) {
        if (!reserve.hubId || !selectedHubs.includes(reserve.hubId)) {
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

      // Frozen/Paused filter
      if (!showFrozenOrPaused && (reserve.isFrozen || reserve.isPaused || reserve.isActive === false)) {
        return false;
      }

      return true;
    });
  }, [effectiveReservesData?.reserves, searchQuery, selectedMarkets, selectedHubs, selectedCategory, tokenCategoryGroups, showFrozenOrPaused]);

  if (isLoading && !effectiveReservesData) {
    return <LoadingState />;
  }

  // Always show the page framework, even if there's an error
  // If we have cached data, use it; otherwise show empty state
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Helmet>
        <title>Aave APY — Live Aave V3 &amp; V4 Rates by Chain</title>
        <meta
          name="description"
          content="Live Aave APY data: compare Aave V3 and V4 supply and borrow rates across every chain, track Merit, Merkl and Brevis incentives, and simulate your portfolio yield."
        />
        <link rel="canonical" href={`${SITE_ORIGIN}/`} />
        <meta property="og:title" content="Aave APY — Live Aave V3 & V4 Rates by Chain" />
        <meta
          property="og:description"
          content="Live Aave APY data: compare Aave V3 and V4 supply and borrow rates across every chain, track incentives, and simulate your portfolio yield."
        />
        <meta property="og:url" content={`${SITE_ORIGIN}/`} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'AaveAPY',
            url: `${SITE_ORIGIN}/`,
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            description:
              'Live Aave APY tracker for Aave V3 and V4 supply and borrow rates across all supported chains, including Merit, Merkl and Brevis incentives.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen min-w-0 w-full bg-background">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 w-full px-[var(--ds-space-3)] md:px-[var(--ds-space-5)] xl:px-[var(--ds-space-8)] 2xl:px-[4.5rem] py-[var(--ds-space-3)] md:py-[var(--ds-space-5)]">
          {/* Cache warning banner */}
          {showCacheWarning && (
            <div className="rounded-lg border ds-border-amber-500-50 ds-bg-amber-500-10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)] mb-3 md:mb-5">
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
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)] mb-3 md:mb-5">
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
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)] flex items-start gap-[var(--ds-space-3)] mb-3 md:mb-5">
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
          <div className="mb-3 md:mb-5">
            <Header
              lastUpdated={effectiveReservesData?.snapshot?.lastUpdated}
              chainCount={chainCount}
            />
          </div>

          <main className="space-y-3 md:space-y-5">
          {/* INK Incentive APR Calculator */}
          <>
            <InkAprCalculator
              rateInput={tydroPointToUsdRateInput}
              setRateInput={setTydroPointToUsdRateInput}
              onDragStateChange={setIsRateDragging}
            />
          </>

          {/* Top Opportunities */}
          <div ref={topOppsRef}>
            {stableReserves && stableReserves.length > 0 && (
              <TopOpportunities
                reserves={stableReserves}
                isApy={isApy}
                isRateDragging={isRateDragging}
                whitelistMerklCampaignIds={whitelistMerklCampaignIds}
                onToggleWhitelistMerklCampaign={toggleWhitelistMerklCampaign}
                categoryGroups={tokenCategoryGroups}
                onCardClick={handleTopCardClick}
                tydroPointToUsdRate={tydroPointToUsdRate}
                pointRateMap={pointRateMap}
                campaignAccessStatuses={campaignAccessStatuses}
              />
            )}
          </div>

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
              showFrozenOrPaused={showFrozenOrPaused}
              setShowFrozenOrPaused={setShowFrozenOrPaused}
              hubEntries={hubEntries}
              selectedHubs={selectedHubs}
              setSelectedHubs={setSelectedHubs}
              marketViewMode={marketViewMode}
              setMarketViewMode={(mode) => {
                setMarketViewMode(mode);
                if (mode === 'chain') {
                  startTransition(() => {
                    setSelectedHubs([]);
                  });
                } else {
                  startTransition(() => {
                    setSelectedMarkets([]);
                    setExpandedChain(null);
                  });
                }
              }}
              expandedChain={expandedChain}
              setExpandedChain={setExpandedChain}

            />

            <ReservesTable
              reserves={filteredReserves}
              allReserves={stableReserves}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              isApy={isApy}
              isLoading={isLoading}
              onSelectMarket={(key) => {
                setSelectedMarkets((prev) =>
                  prev.length === 1 && prev[0] === key ? [] : [key]
                );
                setSelectedHubs([]);
                setMarketViewMode('chain');
                const chain = effectiveMarketsList.find((m) => marketKey(m.chainId, m.marketName) === key)?.chainName ?? null;
                setExpandedChain(chain);
                const el = topOppsRef.current;
                if (el) {
                  const y = el.getBoundingClientRect().bottom + window.scrollY;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
              onSelectHub={(hubId) => {
                setSelectedHubs((prev) =>
                  prev.length === 1 && prev[0] === hubId ? [] : [hubId]
                );
                setSelectedMarkets([]);
                setMarketViewMode('hub');
                const el = topOppsRef.current;
                if (el) {
                  const y = el.getBoundingClientRect().bottom + window.scrollY;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
              tydroPointToUsdRate={tydroPointToUsdRate}
              pointRateMap={pointRateMap}
              whitelistMerklCampaignIds={whitelistMerklCampaignIds}
              onToggleWhitelistMerklCampaign={toggleWhitelistMerklCampaign}
              tokenPrices={tokenPrices}
              scrollToReserveId={pendingScrollReserveId}
              simulationMode={simulationMode}
              onSimulationModeChange={setSimulationMode}
portfolioEntries={portfolio.entries}
portfolioActions={portfolio.actions}
portfolioSnapshots={portfolio.snapshots}
lastModifiedReserveId={portfolio.lastModifiedReserveId}
onWalletSync={handleWalletSync}
walletLoadState={walletLoadState}
onRefresh={handleRefresh}
dataUpdatedAt={dataUpdatedAt}
topOppsRef={topOppsRef}
campaignAccessStatuses={campaignAccessStatuses}
onchainHfMap={onchainHfResult.onchainHfMap}
/>
          </div>

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

          {/* FAQ */}
          <FaqSection />
          </main>

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

              <nav aria-label="More from AaveAPY">
                <p className="text-center ds-text-14 text-muted-foreground leading-relaxed">
                  <Link to="/defi-yield-tracker" className="text-secondary hover:underline">
                    DeFi Yield Tracker
                  </Link>
                  {' · '}
                  <Link to="/usa-stablecoin-apy" className="text-secondary hover:underline">
                    USA Stablecoin APY
                  </Link>
                  {' · '}
                  <Link to="/pt-br/taxas-aave-apy" className="text-secondary hover:underline">
                    Taxas e APY da Aave (PT-BR)
                  </Link>
                </p>
              </nav>

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
                  className="flex items-center justify-center w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full border border-border/40 bg-card/60 text-muted-foreground transition-colors hover:bg-[hsl(200_100%_45%/0.12)] hover:text-[hsl(200_100%_45%)] hover:border-[hsl(200_100%_45%/0.4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Send className="w-4 h-4" />
                </a>
                <a
                  href="https://github.com/0xPabloLI/aaveapy"
                  {...footerLinkTab}
                  aria-label="View source on GitHub"
                  title="View source on GitHub"
                  className="flex items-center justify-center w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full border border-border/40 bg-card/60 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
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
