/**
 * PortfolioPanel — portfolio management panel with token search,
 * position list, summary card, results table, and snapshot comparison.
 *
 * Selecting a token adds BOTH a supply and a borrow position in one go,
 * so users can fill in either / both amounts directly without picking a side.
 */
import { useState, useMemo, useEffect, useRef, memo, useCallback, lazy, Suspense } from 'react';
import { Search, X, Layers, Trash2, Save, ArrowRightLeft, Check, RefreshCw, Wallet } from 'lucide-react';
import { features } from '@/config/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatUsd } from '@/lib/formatters';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioPosition, PortfolioPositionResult, PortfolioSummary, PortfolioSnapshot } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { WalletLoadState } from '@/hooks/useUserPositions';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { filterAndRankReservesForPortfolioSearch, getReserveTvlUsd, PORTFOLIO_SEARCH_HARD_LIMIT } from '@/lib/portfolioSearch';
import { isStablecoinSymbol, isEthRelatedSymbol, isBtcRelatedSymbol } from '@/lib/tokenCategories';
import { getReserveKey } from '@/lib/reserveKey';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { freshnessColor } from '@/lib/freshnessColor';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import PortfolioTokenRow from './PortfolioTokenRow';
import PopularTokenChip from './PopularTokenChip';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import PortfolioResultsTable from './PortfolioResultsTable';
import { PORTFOLIO_THEME } from './portfolioTheme';
import { ConfirmPopover } from '@/components/ui/confirm-popover';
import { sortPositionsByHidden } from '@/lib/portfolioSoftDelete';
import { useWallet } from '@/hooks/useWallet';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';
import { WalletButton } from './WalletButton';
import {
  HEADER_CONTROL_ICON_BUTTON_CLASS,
  HEADER_CONTROL_ICON_CLASS,
} from '@/lib/headerControlStyles';

const PortfolioCompareView = lazy(() => import('./PortfolioCompareView'));

interface PortfolioPanelProps {
  positions: PortfolioPosition[];
  actions: PortfolioSimulationActions;
  reserves: ReserveWithSpread[];
  /** Per-position simulation results (computed externally). */
  positionResults?: PortfolioPositionResult[];
  /** Aggregated portfolio summary (computed externally). */
  summary?: PortfolioSummary;
  /** Saved snapshots. */
  snapshots?: PortfolioSnapshot[];
  /** Trigger wallet onchain position sync. */
  onWalletSync?: () => void;
  /** Trigger a market data refresh (cross-trigger from Wallet Sync). */
  onRefresh?: () => Promise<void> | void;
  /** Wallet position loading state. */
  walletLoadState?: WalletLoadState;
}

/**
 * Search result row.
 * - Click adds BOTH supply and borrow positions for this reserve.
 * - Disabled when the reserve is already in the portfolio.
 */
function SearchResultRow({
  reserve,
  onAdd,
  existingPositions,
}: {
  reserve: ReserveWithSpread;
  onAdd: (reserveId: string) => void;
  existingPositions: PortfolioPosition[];
}) {
  const reserveId = getReserveKey(reserve);
  const alreadyAdded = existingPositions.some((p) => p.reserveId === reserveId);

  const chainSrc = getChainIconSrc(reserve.chainName);
  const marketLabel = getMarketChipLabel(reserve.marketName, reserve.chainName);

  return (
    <button
      type="button"
      disabled={alreadyAdded}
      onClick={() => onAdd(reserveId)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
        alreadyAdded ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/60',
      )}
      aria-label={alreadyAdded
        ? `${reserve.tokenSymbol} already added`
        : `Add ${reserve.tokenSymbol} (supply and borrow)`}
    >
      {/* Horizontal compact row: token | divider | chain+market | divider | hub */}
      <span className="inline-flex items-center gap-1 shrink-0">
        <TokenIcon symbol={reserve.tokenSymbol} size={14} />
        <span className="ds-text-12 font-semibold text-foreground leading-none">{reserve.tokenSymbol}</span>
      </span>
      <span aria-hidden className="h-3 w-px bg-border/60 shrink-0" />
      <span className="inline-flex min-w-0 items-center gap-1 ds-text-10 leading-none text-muted-foreground">
        {chainSrc && (
          <img src={chainSrc} alt={reserve.chainName} className="size-2.5 shrink-0 opacity-70" />
        )}
        <span className="truncate">{marketLabel}</span>
      </span>
      {reserve.hubName && reserve.hubId && (
        <>
          <span aria-hidden className="h-3 w-px bg-border/60 shrink-0" />
          <span
            className={cn('min-w-0 max-w-[40%] shrink', getHubChipClass(isV4Market(reserve.marketName)))}
            title={`Hub: ${reserve.hubName}`}
          >
            <span className="truncate">{reserve.hubName}</span>
          </span>
        </>
      )}
      <span className="ml-auto flex items-center gap-1 shrink-0">
        {alreadyAdded && (
          <span className={cn('ds-text-10 font-semibold inline-flex items-center gap-0.5', PORTFOLIO_THEME.text)}>
            <Check className="size-3" aria-hidden />
            Added
          </span>
        )}
      </span>
    </button>
  );
}


/** Snapshot list item with compare / delete actions. */
const SnapshotItem = memo(function SnapshotItem({
  snapshot,
  isSelectedForCompare,
  onToggleCompare,
  onDelete,
}: {
  snapshot: PortfolioSnapshot;
  isSelectedForCompare: boolean;
  onToggleCompare: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const date = new Date(snapshot.createdAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-colors',
      isSelectedForCompare ? `${PORTFOLIO_THEME.border} ${PORTFOLIO_THEME.bgSubtle}` : 'border-border/30 hover:bg-muted/40',
    )}>
      <button
        type="button"
        onClick={() => onToggleCompare(snapshot.id)}
        className={cn(
          'size-4 rounded border flex items-center justify-center transition-colors shrink-0',
          isSelectedForCompare
            ? `${PORTFOLIO_THEME.border} ${PORTFOLIO_THEME.text} ${PORTFOLIO_THEME.bgSoft}`
            : `border-border/60 hover:${PORTFOLIO_THEME.border}`,
        )}
        aria-label={`${isSelectedForCompare ? 'Deselect' : 'Select'} ${snapshot.label} for comparison`}
      >
        {isSelectedForCompare && <span className="ds-text-10 font-bold">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className="ds-text-11 font-semibold text-foreground truncate block">{snapshot.label}</span>
        <span className="ds-text-10 text-muted-foreground">{timeStr} · {snapshot.positions.length} positions</span>
      </div>
      <button
        type="button"
        onClick={() => onDelete(snapshot.id)}
        className="rounded p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label={`Delete snapshot ${snapshot.label}`}
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
});

const PortfolioPanel = memo(function PortfolioPanel({
  positions,
  actions,
  reserves,
  positionResults,
  summary,
  snapshots = [],
  onWalletSync,
  onRefresh,
  walletLoadState,
}: PortfolioPanelProps) {
  const isMobile = useIsMobile();
  const { isConnected: walletConnected } = useWallet();
  const { connectWatchAddress } = useWatchModeConnect();
  const [searchQuery, setSearchQuery] = useState('');
  const SEARCH_PAGE_SIZE = 20;
  const [visibleSearchCount, setVisibleSearchCount] = useState(SEARCH_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Open search bar by default only when there are no positions.
  // Users can still toggle it manually via the search/X button.
  const [searchOpen, setSearchOpen] = useState(() => positions.length === 0);
  const [snapshotName, setSnapshotName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Wallet sync freshness: record timestamp when a sync settles, then expose age.
  const [walletSyncedAt, setWalletSyncedAt] = useState<number | null>(null);
  const [walletSyncAgeS, setWalletSyncAgeS] = useState(0);
  const prevWalletLoadStateRef = useRef<WalletLoadState | undefined>(walletLoadState);
  useEffect(() => {
    const prev = prevWalletLoadStateRef.current;
    if (prev === 'loading' && walletLoadState && walletLoadState !== 'loading') {
      setWalletSyncedAt(Date.now());
    }
    prevWalletLoadStateRef.current = walletLoadState;
  }, [walletLoadState]);
  useEffect(() => {
    if (!walletSyncedAt) return;
    // Update immediately so the title reflects the new timestamp without
    // waiting up to one full second for the interval to tick.
    setWalletSyncAgeS(Math.floor((Date.now() - walletSyncedAt) / 1000));
    const id = window.setInterval(
      () => setWalletSyncAgeS(Math.floor((Date.now() - walletSyncedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [walletSyncedAt]);
  const walletInError = walletLoadState === 'error';
  const walletFreshnessColor = walletInError
    ? 'bg-red-400'
    : freshnessColor(walletSyncAgeS);
  const walletAgeLabel = walletSyncedAt
    ? walletSyncAgeS < 60
      ? `${walletSyncAgeS}s ago`
      : walletSyncAgeS < 3600
        ? `${Math.floor(walletSyncAgeS / 60)}m ago`
        : `${Math.floor(walletSyncAgeS / 3600)}h ago`
    : null;
  const walletSyncTitle = walletLoadState === 'loading'
    ? 'Syncing…'
    : walletInError
      ? 'Sync failed — click to retry'
      : walletAgeLabel
        ? `Updated ${walletAgeLabel}`
        : 'Sync wallet positions';
  const walletSyncAriaLabel = walletLoadState === 'loading'
    ? 'Syncing wallet positions'
    : walletInError
      ? 'Retry wallet sync (last attempt failed)'
      : walletAgeLabel
        ? `Sync wallet positions (updated ${walletAgeLabel})`
        : 'Sync wallet positions';



  const focusSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const filteredReserves = useMemo(
    () => filterAndRankReservesForPortfolioSearch(reserves, searchQuery),
    [reserves, searchQuery],
  );

  const visibleReserves = filteredReserves.slice(0, visibleSearchCount);
  const hasMoreResults = filteredReserves.length > visibleSearchCount;

  useEffect(() => {
    setVisibleSearchCount(SEARCH_PAGE_SIZE);
  }, [searchQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreResults) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleSearchCount((prev) => prev + SEARCH_PAGE_SIZE);
        }
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreResults]);

  // Add both supply and borrow positions for the selected token.
  // If the reserve is already in the portfolio (any side exists), do nothing.
  // Otherwise add both — mergePositions deduplicates any that already exist.
  // Search auto-focus is preserved ONLY when the search panel is already open,
  // so clicking a quick-add chip while search is collapsed will NOT reopen it.
  const handleAddToken = useCallback(
    (reserveId: string) => {
      const reserve = reserves.find((r) => getReserveKey(r) === reserveId);
      if (!reserve) return;
      if (positions.some((p) => p.reserveId === reserveId)) {
        toast.info(`${reserve.tokenSymbol} is already in the portfolio`);
        return;
      }

      const common = {
        reserveId,
        marketName: reserve.marketName,
        chainName: reserve.chainName ?? reserve.marketName,
        tokenSymbol: reserve.tokenSymbol,
      };
      actions.addPosition({ ...common, side: 'supply' });
      actions.addPosition({ ...common, side: 'borrow' });

      // Keep focus on the search input only if search is already open;
      // do not force-open it (quick-add chips should not toggle the panel).
      if (searchOpen) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    },
    [reserves, positions, actions, searchOpen],
  );

  const handleSaveSnapshot = useCallback(() => {
    const label = snapshotName.trim() || `Snapshot ${snapshots.length + 1}`;
    actions.saveSnapshot(label, positionResults, summary);
    setSnapshotName('');
    setShowSaveInput(false);
  }, [snapshotName, snapshots.length, actions, positionResults, summary]);

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const canCompare = compareIds.length === 2;
  const compareSnapshots = useMemo(() => {
    if (!canCompare) return null;
    const a = snapshots.find((s) => s.id === compareIds[0]);
    const b = snapshots.find((s) => s.id === compareIds[1]);
    if (!a || !b) return null;
    return { a, b };
  }, [canCompare, compareIds, snapshots]);

  const sortedPositions = useMemo(() => sortPositionsByHidden(positions), [positions]);

  const groupedByReserve = useMemo(() => {
    const map = new Map<string, { tokenSymbol: string; chainName: string; marketName: string; hubName?: string; isOrphan: boolean; supply: PortfolioPosition | null; borrow: PortfolioPosition | null }>();
    for (const p of sortedPositions) {
      if (!map.has(p.reserveId)) {
        const reserve = reserves.find((r) => getReserveKey(r) === p.reserveId);
        map.set(p.reserveId, {
          tokenSymbol: p.tokenSymbol,
          chainName: p.chainName,
          marketName: p.marketName,
          hubName: reserve?.hubName,
          isOrphan: p.isOrphan,
          supply: null,
          borrow: null,
        });
      }
      const entry = map.get(p.reserveId)!;
      if (p.side === 'supply') entry.supply = p;
      else entry.borrow = p;
    }
    return map;
  }, [sortedPositions, reserves]);

  // Suggested popular tokens for quick-add: top 2 stablecoins, top 2 ETH-related,
  // and top 1 BTC-related by reserve size (TVL). Excludes already-added symbols.
  const suggestedReserves = useMemo(() => {
    const addedSymbols = new Set(positions.map((p) => p.tokenSymbol.toUpperCase()));
    const sortedBySize = [...reserves].sort(
      (a, b) => (b.supplyApy ?? 0) - (a.supplyApy ?? 0),
    );
    const pickTop = (predicate: (sym: string) => boolean, n: number) => {
      const seen = new Set<string>();
      const out: ReserveWithSpread[] = [];
      for (const r of sortedBySize) {
        const sym = r.tokenSymbol.toUpperCase();
        if (seen.has(sym) || addedSymbols.has(sym)) continue;
        if (!predicate(r.tokenSymbol)) continue;
        seen.add(sym);
        out.push(r);
        if (out.length >= n) break;
      }
      return out;
    };
    return [
      ...pickTop(isStablecoinSymbol, 2),
      ...pickTop(isEthRelatedSymbol, 2),
      ...pickTop(isBtcRelatedSymbol, 1),
    ];
  }, [reserves, positions]);


  const handleRemoveToken = useCallback((reserveId: string) => {
    // Capture the affected token symbol for the toast label before mutating.
    const affected = positions.find((p) => p.reserveId === reserveId);
    actions.removeReserve(reserveId);
    toast('Reset to wallet', {
      description: affected?.tokenSymbol
        ? `${affected.tokenSymbol} reset to wallet amounts. Manual edits dropped.`
        : 'Row reset to wallet amounts. Manual edits dropped.',
      action: {
        label: 'Undo',
        onClick: () => {
          const restored = actions.undoLastRemove();
          if (restored) toast.success('Restored previous edits');
        },
      },
    });
  }, [actions, positions]);

  const handleToggleHidden = useCallback((positionId: string) => {
    actions.toggleHidden(positionId);
  }, [actions]);

  const handleRestorePosition = useCallback((positionId: string) => {
    actions.restoreToWallet(positionId);
  }, [actions]);

  const handleWalletSyncClick = useCallback(() => {
    onWalletSync?.();
    // Reverse cross-trigger: pull fresh market data alongside the wallet
    // re-sync so portfolio aggregates reflect the latest reserves immediately.
    if (onRefresh) void onRefresh();
  }, [onWalletSync, onRefresh]);

  // When positions transition from non-empty to empty (e.g. clear all),
  // reopen search so users can immediately add the next token.
  // Do NOT continuously force search open while empty — users must be able
  // to collapse the search bar via the X button even with zero positions.
  const prevPositionsCountRef = useRef(positions.length);
  useEffect(() => {
    const prev = prevPositionsCountRef.current;
    if (prev > 0 && positions.length === 0) {
      setSearchOpen(true);
    }
    prevPositionsCountRef.current = positions.length;
  }, [positions.length]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm',
          isMobile ? 'px-2.5 py-2.5' : 'px-4 py-3',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className={`size-4 ${PORTFOLIO_THEME.text}`} aria-hidden />
            <span className="ds-text-14 font-semibold text-foreground">
              Portfolio
            </span>
            <span className="ds-text-10 text-muted-foreground/50 italic">
              {isMobile
                ? 'Simulation only; final result is on-chain.'
                : 'Simulation is for reference only. Final result depends on on-chain execution.'}
            </span>
          </div>
          <div className="flex items-center gap-[var(--ds-space-1)] pr-[11px]">
            {walletConnected && (
              <div className="relative">
                <button
                  type="button"
                  onClick={handleWalletSyncClick}
                  disabled={walletLoadState === 'loading'}
                  className={cn(HEADER_CONTROL_ICON_BUTTON_CLASS)}
                  aria-label={walletSyncAriaLabel}
                  title={walletSyncTitle}
                  data-testid="wallet-sync-button"
                  data-wallet-sync-state={
                    walletLoadState === 'loading'
                      ? 'loading'
                      : walletInError
                        ? 'error'
                        : walletSyncedAt
                          ? 'idle-synced'
                          : 'idle'
                  }
                >
                  <RefreshCw
                    className={cn(HEADER_CONTROL_ICON_CLASS, walletLoadState === 'loading' && 'animate-spin')}
                    aria-hidden
                  />
                </button>
                {(walletSyncedAt != null || walletInError) && walletLoadState !== 'loading' && (
                  <span
                    data-testid="wallet-sync-freshness-dot"
                    className={cn(
                      'pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-card/80 transition-colors duration-700',
                      walletFreshnessColor,
                    )}
                    aria-hidden
                  />
                )}
              </div>
            )}

            <WalletButton mobile onWatchSubmit={connectWatchAddress} />
            {/* Save snapshot */}
            {features.snapshot && positions.length > 0 && summary && (
              <button
                type="button"
                onClick={() => setShowSaveInput((p) => !p)}
                className={cn(
                  HEADER_CONTROL_ICON_BUTTON_CLASS,
                  showSaveInput && 'bg-muted text-foreground',
                )}
                aria-label={showSaveInput ? 'Cancel save' : 'Save snapshot'}
                title={showSaveInput ? 'Cancel save' : 'Save snapshot'}
              >
                {showSaveInput ? (
                  <X className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                ) : (
                  <Save className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((p) => !p)}
              className={cn(
                HEADER_CONTROL_ICON_BUTTON_CLASS,
                searchOpen && 'bg-muted text-foreground',
              )}
              aria-label={searchOpen ? 'Close search' : 'Search tokens'}
              title={searchOpen ? 'Close search' : 'Search tokens'}
            >
              {searchOpen ? (
                <X className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
              ) : (
                <Search className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
              )}
            </button>
            {positions.length > 0 && (
              <ConfirmPopover
                onConfirm={() => actions.clearAll()}
                title="Clear all positions?"
                description={`This will remove all ${positions.length} positions from the portfolio.`}
                confirmLabel="Clear all"
              >
                <button
                  type="button"
                  className={cn(
                    HEADER_CONTROL_ICON_BUTTON_CLASS,
                    PORTFOLIO_THEME.trashHoverBg,
                    PORTFOLIO_THEME.trashHoverText,
                  )}
                  aria-label="Clear all positions"
                  title="Clear all positions"
                >
                  <Trash2 className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                </button>
              </ConfirmPopover>
            )}
          </div>

        </div>

        {/* Wallet status bar */}
        {walletLoadState && walletLoadState !== 'idle' && (
          <div className="flex items-center gap-1.5 mb-2.5 ds-text-11 text-muted-foreground">
            {walletLoadState === 'loading' && (
              <><RefreshCw className="size-3 animate-spin" aria-hidden /> Syncing…</>
            )}
            {walletLoadState === 'success-empty' && (
              <><Wallet className="size-3" aria-hidden /> Wallet has no positions</>
            )}
            {walletLoadState === 'error' && (
              <span className="text-destructive/80">Wallet sync failed</span>
            )}
          </div>
        )}


        {/* Save snapshot input */}
        {features.snapshot && showSaveInput && (
          <div className="flex items-center gap-2 mb-2.5">
            <input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder={`Snapshot ${snapshots.length + 1}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSnapshot()}
              className={cn(
                'h-[var(--ds-chip-h)] flex-1 rounded-lg border border-border/50 bg-muted/40 px-2.5 ds-text-11 text-foreground placeholder:text-muted-foreground/50',
                `focus:${PORTFOLIO_THEME.border} focus:outline-none focus:ring-1 focus:${PORTFOLIO_THEME.ringSoft}`,
              )}
              aria-label="Snapshot name"
            />
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className={`rounded-lg ${PORTFOLIO_THEME.bgSoft} px-3 py-1 ds-text-11 font-semibold ${PORTFOLIO_THEME.text} hover:${PORTFOLIO_THEME.bgSubtle} transition-colors`}
            >
              Save
            </button>
          </div>
        )}

        {/* Search */}
        {searchOpen && (
          <div className="mb-2.5">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token…"
              autoFocus
              className={cn(
                'h-[var(--ds-control-h)] w-full rounded-lg border border-border/50 bg-muted/40 px-3 ds-text-12 text-foreground placeholder:text-muted-foreground/50 placeholder:italic',
                `focus:${PORTFOLIO_THEME.border} focus:outline-none focus:ring-1 focus:${PORTFOLIO_THEME.ringSoft}`,
              )}
              aria-label="Search tokens to add"
            />
            {filteredReserves.length > 0 && (
              <div className="mt-1.5 max-h-[320px] overflow-y-auto rounded-lg border border-border/40 bg-card py-1">
                {visibleReserves.map((r) => (
                  <SearchResultRow
                    key={getReserveKey(r)}
                    reserve={r}
                    onAdd={handleAddToken}
                    existingPositions={positions}
                  />
                ))}
                {hasMoreResults && (
                  <div ref={sentinelRef} className="h-1" aria-hidden="true" />
                )}
              </div>
            )}
            {searchQuery.trim() && filteredReserves.length === 0 && (
              <p className="mt-1.5 px-2 ds-text-11 text-muted-foreground italic">
                No tokens found
              </p>
            )}
          </div>
        )}

        {/* Popular tokens (unified across mobile + desktop, always top) */}
        {(() => {
          const visible = suggestedReserves.filter((r) => !dismissedSuggestions.has(getReserveKey(r)));
          if (visible.length === 0) return null;
          return (
            <div
              className="mb-2.5 flex flex-wrap items-start content-start gap-x-1.5 gap-y-1.5 leading-7 [&>*]:h-[var(--ds-chip-h)]"
              style={{ minHeight: '28px' }}
            >
              {visible.map((r) => {
                const reserveId = getReserveKey(r);
                return (
                  <PopularTokenChip
                    key={reserveId}
                    reserveId={reserveId}
                    tokenSymbol={r.tokenSymbol}
                    chainName={r.chainName}
                    marketName={r.marketName}
                    onAdd={handleAddToken}
                  />
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setDismissedSuggestions(
                    new Set(suggestedReserves.map((r) => getReserveKey(r))),
                  )
                }
                className="inline-flex h-[var(--ds-chip-h)] items-center gap-1 rounded-full border border-border/50 bg-card/70 px-2 ds-text-11 font-medium leading-none text-muted-foreground transition-colors duration-200 hover:bg-muted/60 hover:text-foreground"
                aria-label="Dismiss all popular token suggestions"
                title="Clear all suggestions"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          );
        })()}

        {/* Position list */}
        {positions.length === 0 ? (
          <div
            className={cn(
              'rounded-xl border border-dashed px-3 py-4 text-center',
              PORTFOLIO_THEME.border,
              PORTFOLIO_THEME.bgSubtle,
            )}
          >
            <p className="ds-text-13 font-semibold text-foreground">
              Build your portfolio
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={focusSearch}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ds-text-11 font-semibold transition-colors',
                  PORTFOLIO_THEME.bgSoft,
                  PORTFOLIO_THEME.text,
                  `hover:${PORTFOLIO_THEME.bgSubtle}`,
                )}
              >
                <Search className="size-3" aria-hidden />
                Search tokens
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid gap-x-1 gap-y-1.5 [grid-template-columns:auto_minmax(11rem,1fr)]">
              {Array.from(groupedByReserve.entries()).map(([reserveId, entry]) => (
                <PortfolioTokenRow
                  key={reserveId}
                  reserveId={reserveId}
                  tokenSymbol={entry.tokenSymbol}
                  chainName={entry.chainName}
                  marketName={entry.marketName}
                  hubName={entry.hubName}
                  isOrphan={entry.isOrphan}
                  supplyPosition={entry.supply}
                  borrowPosition={entry.borrow}
                  onRemove={handleRemoveToken}
                  onUpdateAmount={actions.updateAmount}
                  onUpdateInputMode={actions.updateInputMode}
                  onHideOrRemoveReserve={actions.hideOrRemoveReserveAction}
                  onUnhideReserve={actions.unhideReserveAction}
                  onRestorePosition={handleRestorePosition}
                  tokenPriceInUsd={reserves.find((r) => getReserveKey(r) === reserveId)?.tokenPrice}
                />
              ))}
            </div>
            {positions.some(p => p.hidden) && (
              <div className="flex items-center gap-2 ds-text-10 text-muted-foreground/60 pt-1">
                <div className="flex-1 h-px bg-border/20" />
                <span>{positions.filter(p => p.hidden).length} hidden</span>
                <div className="flex-1 h-px bg-border/20" />
              </div>
            )}
          </div>
        )}

        {/* Summary card */}
        {summary && positions.length > 0 && (
          <div className="mt-3">
            <PortfolioSummaryCard summary={summary} />
          </div>
        )}

        {/* Per-token results table */}
        {positionResults && positionResults.length > 0 && (
          <div className="mt-2.5">
            <PortfolioResultsTable positions={positions} results={positionResults} />
          </div>
        )}
      </div>

      {/* Saved Snapshots */}
      {features.snapshot && snapshots.length > 0 && (
        <div className={cn(
          'rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm',
          isMobile ? 'px-2.5 py-2.5' : 'px-4 py-3',
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="ds-text-12 font-semibold text-foreground">
              Saved Snapshots ({snapshots.length})
            </span>
            {canCompare && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className={`flex items-center gap-1 rounded-lg ${PORTFOLIO_THEME.bgSoft} px-2.5 py-1 ds-text-11 font-semibold ${PORTFOLIO_THEME.text} hover:${PORTFOLIO_THEME.bgSubtle} transition-colors`}
              >
                <ArrowRightLeft className="size-3" aria-hidden />
                Compare
              </button>
            )}
          </div>
          <p className="ds-text-10 text-muted-foreground mb-2">
            Select 2 snapshots to compare
          </p>
          <div className="space-y-1.5">
            {snapshots.map((s) => (
              <SnapshotItem
                key={s.id}
                snapshot={s}
                isSelectedForCompare={compareIds.includes(s.id)}
                onToggleCompare={handleToggleCompare}
                onDelete={actions.deleteSnapshot}
              />
            ))}
          </div>
        </div>
      )}

      {/* Compare view */}
      {features.snapshot && showCompare && compareSnapshots && (
        <Suspense fallback={<div className="h-20 rounded-xl bg-muted/50 animate-pulse" />}>
          <PortfolioCompareView
            snapshotA={compareSnapshots.a}
            snapshotB={compareSnapshots.b}
            onClose={() => setShowCompare(false)}
          />
        </Suspense>
      )}
    </div>
  );
});

export default PortfolioPanel;
