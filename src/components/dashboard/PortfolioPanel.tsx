/**
 * PortfolioPanel — portfolio management panel with token search,
 * position list, summary card, results table, and snapshot comparison.
 *
 * Selecting a token adds BOTH a supply and a borrow position in one go,
 * so users can fill in either / both amounts directly without picking a side.
 */
import { useState, useMemo, useEffect, useRef, memo, useCallback, lazy, Suspense } from 'react';
import { Search, X, Layers, Trash2, Save, ArrowRightLeft, Check, RefreshCw, Wallet, CloudDownload } from 'lucide-react';
import PortfolioModeToggle, { type SimulationMode } from './PortfolioModeToggle';
import { features } from '@/config/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { formatUsd } from '@/lib/formatters';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry, PortfolioPositionResult, PortfolioSummary, PortfolioSnapshot } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { WalletLoadState } from '@/hooks/useUserPositionsSdk';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { filterAndRankReservesForPortfolioSearch, getReserveTvlUsd, PORTFOLIO_SEARCH_HARD_LIMIT } from '@/lib/portfolioSearch';
import { isStablecoinSymbol, isEthRelatedSymbol, isBtcRelatedSymbol } from '@/lib/tokenCategories';
import { getReserveKey } from '@/lib/reserveKey';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';

import { TokenIcon } from '@/components/primitives/TokenIcon';
import PortfolioTokenRow from './PortfolioTokenRow';
import PopularTokenChip from './PopularTokenChip';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import PortfolioResultsTable from './PortfolioResultsTable';
import { PORTFOLIO_THEME } from './portfolioTheme';
import { sortEntriesByHidden } from '@/lib/portfolioSoftDelete';
import { isSupplyDisabled, isBorrowDisabled, isRestrictedReserve } from '@/lib/reserveStatus';
import { useWallet } from '@/hooks/useWallet';
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect';

import {
  HEADER_CONTROL_ICON_BUTTON_CLASS,
  HEADER_CONTROL_ICON_CLASS,
} from '@/lib/headerControlStyles';

const PortfolioCompareView = lazy(() => import('./PortfolioCompareView'));

interface PortfolioPanelProps {
  entries: PortfolioReserveEntry[];
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
  /** Wallet position loading state. */
  walletLoadState?: WalletLoadState;
  simulationMode?: SimulationMode;
  onSimulationModeChange?: (mode: SimulationMode) => void;
}

/**
 * Search result row.
 * - Click adds BOTH supply and borrow positions for this reserve.
 * - Disabled when the reserve is already in the portfolio.
 */
function SearchResultRow({
  reserve,
  onAdd,
  existingEntries,
}: {
  reserve: ReserveWithSpread;
  onAdd: (reserveId: string) => void;
  existingEntries: PortfolioReserveEntry[];
}) {
  const reserveId = getReserveKey(reserve);
  const alreadyAdded = existingEntries.some((e) => e.reserveId === reserveId);

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
        <span className="ds-text-10 text-muted-foreground">{timeStr} · {snapshot.entries.length} positions</span>
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
  entries,
  actions,
  reserves,
  positionResults,
  summary,
  snapshots = [],
  onWalletSync,
  walletLoadState,
  simulationMode,
  onSimulationModeChange,
}: PortfolioPanelProps) {
  const isMobile = useIsMobile();
  const { isConnected: walletConnected } = useWallet();
  const { connectWatchAddress } = useWatchModeConnect();
  const [searchQuery, setSearchQuery] = useState('');
  const SEARCH_PAGE_SIZE = 20;
  const [visibleSearchCount, setVisibleSearchCount] = useState(SEARCH_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Open search bar by default only when there are no entries.
  // Users can still toggle it manually via the search/X button.
  const [searchOpen, setSearchOpen] = useState(() => entries.length === 0);
  const [snapshotName, setSnapshotName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);



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

  // Add both supply and borrow for the selected token via addReserve.
  // Search auto-focus is preserved ONLY when the search panel is already open,
  // so clicking a quick-add chip while search is collapsed will NOT reopen it.
  const handleAddToken = useCallback(
    (reserveId: string) => {
      const reserve = reserves.find((r) => getReserveKey(r) === reserveId);
      if (!reserve) return;
      if (isRestrictedReserve(reserve)) {
        toast.info(`${reserve.tokenSymbol} is restricted and cannot be added manually`);
        return;
      }
      if (entries.some((e) => e.reserveId === reserveId)) {
        toast.info(`${reserve.tokenSymbol} is already in the portfolio`);
        return;
      }

      actions.addReserve({
        reserveId,
        marketName: reserve.marketName,
        chainName: reserve.chainName ?? reserve.marketName,
        tokenSymbol: reserve.tokenSymbol,
      });

      // Keep focus on the search input only if search is already open;
      // do not force-open it (quick-add chips should not toggle the panel).
      if (searchOpen) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    },
    [reserves, entries, actions, searchOpen],
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

  const sortedEntries = useMemo(() => sortEntriesByHidden(entries), [entries]);

  // Suggested popular tokens for quick-add: top 2 stablecoins, top 2 ETH-related,
  // and top 1 BTC-related by reserve size (TVL). Excludes already-added symbols.
  const suggestedReserves = useMemo(() => {
    const addedSymbols = new Set(entries.map((e) => e.tokenSymbol.toUpperCase()));
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
  }, [reserves, entries]);


  const handleRemoveToken = useCallback((reserveId: string) => {
    const affected = entries.find((e) => e.reserveId === reserveId);
    actions.removeReserve(reserveId);
    toast(affected?.tokenSymbol ? `${affected.tokenSymbol} removed` : 'Removed', {
      className: '[--width:fit-content]',
      action: {
        label: 'Undo',
        onClick: () => {
          const restored = actions.undoLastRemove();
          if (restored) toast.success('Restored previous edits');
        },
      },
    });
  }, [actions, entries]);

  const handleWalletSyncClick = useCallback(() => {
    onWalletSync?.();
  }, [onWalletSync]);

  // When entries transition from non-empty to empty (e.g. clear all),
  // reopen search so users can immediately add the next token.
  // Do NOT continuously force search open while empty — users must be able
  // to collapse the search bar via the X button even with zero entries.
  const prevEntryCountRef = useRef(entries.length);
  useEffect(() => {
    const prev = prevEntryCountRef.current;
    if (prev > 0 && entries.length === 0) {
      setSearchOpen(true);
    }
    prevEntryCountRef.current = entries.length;
  }, [entries.length]);

  const reserveIdToReserve = useMemo(() => {
    const map = new Map<string, ReserveWithSpread>();
    for (const r of reserves) map.set(getReserveKey(r), r);
    return map;
  }, [reserves]);

  return (
    <div className="space-y-3">
      {/*
        Header spacing — see docs/design/portfolio-panel-spacing.md.
        Padding/gap use --ds-space-* tokens so the toggle's right edge
        matches the Single-mode toggle (ml-auto against the scenario
        wrapper). Do NOT introduce arbitrary pr-[Npx] / mr-[Npx] values
        here; the check in scripts/check-portfolio-panel-spacing.sh
        enforces this.
      */}
      <div
        className={cn(
          'pr-[var(--ds-space-3)]',
          isMobile
            ? 'pl-[var(--ds-space-2-5)] py-[var(--ds-space-2-5)]'
            : 'pl-[var(--ds-space-4)] py-[var(--ds-space-3)]',
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
          <div className="flex items-center gap-[var(--ds-space-1)]">

            {walletConnected && (
              <button
                type="button"
                onClick={handleWalletSyncClick}
                disabled={walletLoadState === 'loading'}
                className={cn(HEADER_CONTROL_ICON_BUTTON_CLASS)}
                aria-label={walletLoadState === 'loading' ? 'Syncing wallet positions' : 'Force sync wallet positions'}
                title={walletLoadState === 'loading' ? 'Syncing…' : 'Force sync'}
                data-testid="wallet-sync-button"
              >
                {walletLoadState === 'loading' ? (
                  <RefreshCw className={cn(HEADER_CONTROL_ICON_CLASS, 'animate-spin')} aria-hidden />
                ) : (
                  <CloudDownload className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                )}
              </button>
            )}

            {/* Save snapshot */}
            {features.snapshot && entries.length > 0 && summary && (
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
            {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => actions.clearAll()}
                    title="Clear all"
                    className={cn(
                      HEADER_CONTROL_ICON_BUTTON_CLASS,
                      PORTFOLIO_THEME.trashHoverBg,
                      PORTFOLIO_THEME.trashHoverText,
                    )}
                    aria-label="Clear all positions"
                  >
                    <Trash2 className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                  </button>
            )}
            {onSimulationModeChange && simulationMode && (
              <PortfolioModeToggle
                mode={simulationMode}
                onModeChange={onSimulationModeChange}
                positionCount={entries.length}
              />
            )}
          </div>

        </div>
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
                'h-[var(--ds-chip-h)] flex-1 rounded-md border px-2.5 ds-text-11 text-foreground transition-colors',
                cnDsInputSurface(snapshotName.trim().length > 0, 'neutral'),
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
                'h-[var(--ds-control-h)] w-full rounded-md border px-3 ds-text-12 text-foreground transition-colors',
                cnDsInputSurface(searchQuery.trim().length > 0, 'magenta'),
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
                    existingEntries={entries}
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

        {/* Entry list */}
        {entries.length === 0 ? (
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
              {sortedEntries.map((entry) => {
                const reserve = reserveIdToReserve.get(entry.reserveId);
                return (
                  <PortfolioTokenRow
                    key={entry.reserveId}
                    entry={entry}
                    actions={actions}
                    reserveId={entry.reserveId}
                    onRemove={handleRemoveToken}
                    tokenPriceInUsd={reserve?.tokenPrice}
                    disabledNotice={reserve ? {
                      supply: reserve.isPaused ? 'Paused' : isSupplyDisabled(reserve) ? 'Supply unavailable' : null,
                      borrow: reserve.isPaused ? 'Paused' : isBorrowDisabled(reserve) ? 'Borrow unavailable' : null,
                    } : undefined}
                  />
                );
              })}
            </div>
            {entries.some(e => e.hidden) && (
              <div className="flex items-center gap-2 ds-text-10 text-muted-foreground/60 pt-1">
                <div className="flex-1 h-px bg-border/20" />
                <span>{entries.filter(e => e.hidden).length} hidden</span>
                <div className="flex-1 h-px bg-border/20" />
              </div>
            )}
          </div>
        )}

        {/* Summary card */}
        {summary && entries.length > 0 && (
          <div className="mt-3">
            <PortfolioSummaryCard summary={summary} />
          </div>
        )}

        {/* Per-token results table */}
        {positionResults && positionResults.length > 0 && (
          <div className="mt-2.5">
            <PortfolioResultsTable entries={entries} results={positionResults} />
          </div>
        )}
      </div>

      {/* Saved Snapshots */}
      {features.snapshot && snapshots.length > 0 && (
        <div className={cn(
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
