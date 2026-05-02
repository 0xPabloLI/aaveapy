/**
 * PortfolioPanel — portfolio management panel with token search,
 * position list, summary card, results table, and snapshot comparison.
 *
 * Selecting a token adds BOTH a supply and a borrow position in one go,
 * so users can fill in either / both amounts directly without picking a side.
 */
import { useState, useMemo, useEffect, useRef, memo, useCallback, lazy, Suspense } from 'react';
import { Search, X, Layers, Trash2, Save, ArrowRightLeft, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioPosition, PortfolioPositionResult, PortfolioSummary, PortfolioSnapshot } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { isStablecoinSymbol, isEthRelatedSymbol, isBtcRelatedSymbol } from '@/lib/tokenCategories';
import { getReserveKey } from '@/lib/reserveKey';
import { getChainIconSrc } from '@/lib/chainIcons';
import { ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { getProtocolVersion } from '@/lib/protocolVersion';

/** Mirrors FilterBar's market chip label: V4 badge + sub-market name for Ethereum, chain name otherwise. */
function getMarketChipLabel(marketName: string, chainName: string): string {
  if (chainName !== 'Ethereum') return chainName;
  const version = getProtocolVersion(marketName);
  if (version === 'v4') {
    const withoutPrefix = marketName.replace(/^AaveV4/i, '');
    return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return ETHEREUM_MARKET_NAMES[marketName] ?? marketName;
}
import { TokenIcon } from '@/components/primitives/TokenIcon';
import PortfolioTokenRow from './PortfolioTokenRow';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import PortfolioResultsTable from './PortfolioResultsTable';
import { BATCH_THEME } from './batchTheme';

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
}

/**
 * Search result row.
 * - Click adds whichever sides (supply/borrow) are missing for this reserve.
 * - Disabled only when BOTH sides are already added.
 * - Always shows per-side status badges so users can see at a glance which
 *   inputs already exist and which will be created on click.
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
  const sidesForReserve = existingPositions.filter((p) => p.reserveId === reserveId);
  const hasSupply = sidesForReserve.some((p) => p.side === 'supply');
  const hasBorrow = sidesForReserve.some((p) => p.side === 'borrow');
  const fullyAdded = hasSupply && hasBorrow;
  const partiallyAdded = (hasSupply || hasBorrow) && !fullyAdded;

  const ariaLabel = fullyAdded
    ? `${reserve.tokenSymbol} already added (supply and borrow)`
    : partiallyAdded
      ? `Add missing ${hasSupply ? 'borrow' : 'supply'} side for ${reserve.tokenSymbol}`
      : `Add ${reserve.tokenSymbol} (supply and borrow)`;

  return (
    <button
      type="button"
      disabled={fullyAdded}
      onClick={() => onAdd(reserveId)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
        fullyAdded ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/60',
      )}
      aria-label={ariaLabel}
    >
      <TokenIcon symbol={reserve.tokenSymbol} size={18} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="ds-text-12 font-semibold text-foreground truncate">
          {reserve.tokenSymbol}
        </span>
        <span className="ds-text-10 text-muted-foreground truncate inline-flex items-center gap-1">
          {getChainIconSrc(reserve.chainName) && (
            <img
              src={getChainIconSrc(reserve.chainName)!}
              alt={reserve.chainName}
              className="size-3 shrink-0"
            />
          )}
          <span className="truncate">{reserve.marketName}</span>
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {fullyAdded ? (
          <span className={cn('ds-text-10 font-semibold inline-flex items-center gap-0.5', BATCH_THEME.text)}>
            <Check className="size-3" aria-hidden />
            Added
          </span>
        ) : partiallyAdded ? (
          <span className={cn('ds-text-10 font-semibold', BATCH_THEME.text)}>
            Add {hasSupply ? 'Borrow' : 'Supply'}
          </span>
        ) : null}
      </div>
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
      isSelectedForCompare ? `${BATCH_THEME.border} ${BATCH_THEME.bgSubtle}` : 'border-border/30 hover:bg-muted/40',
    )}>
      <button
        type="button"
        onClick={() => onToggleCompare(snapshot.id)}
        className={cn(
          'size-4 rounded border flex items-center justify-center transition-colors shrink-0',
          isSelectedForCompare
            ? `${BATCH_THEME.border} ${BATCH_THEME.text} ${BATCH_THEME.bgSoft}`
            : `border-border/60 hover:${BATCH_THEME.border}`,
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
}: PortfolioPanelProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  // Always default the search bar open whenever the batch panel mounts/opens.
  // Users can still collapse it manually via the X button.
  const [searchOpen, setSearchOpen] = useState(true);
  const [snapshotName, setSnapshotName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const filteredReserves = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const qNorm = normalizeTokenSymbolForSearch(searchQuery);
    return reserves
      .filter((r) => {
        const sym = r.tokenSymbol.toLowerCase();
        const symNorm = normalizeTokenSymbolForSearch(r.tokenSymbol);
        return sym.includes(q) || (qNorm.length > 0 && symNorm.includes(qNorm));
      })
      .slice(0, 50);
  }, [reserves, searchQuery]);

  // Add both supply and borrow positions for the selected token.
  // - If both already exist: do nothing (button is disabled in search results).
  // - If only one side exists: add the missing side and inform the user.
  // - If none exist: add both.
  // Search auto-focus is preserved ONLY when the search panel is already open,
  // so clicking a quick-add chip while search is collapsed will NOT reopen it.
  const handleAddToken = useCallback(
    (reserveId: string) => {
      const reserve = reserves.find((r) => getReserveKey(r) === reserveId);
      if (!reserve) return;
      const existingSides = new Set(
        positions.filter((p) => p.reserveId === reserveId).map((p) => p.side),
      );
      const hadSupply = existingSides.has('supply');
      const hadBorrow = existingSides.has('borrow');

      if (hadSupply && hadBorrow) {
        toast.info(`${reserve.tokenSymbol} is already in the batch`);
        return;
      }

      const common = {
        reserveId,
        marketName: reserve.marketName,
        chainName: reserve.chainName ?? reserve.marketName,
        tokenSymbol: reserve.tokenSymbol,
      };
      if (!hadSupply) actions.addPosition({ ...common, side: 'supply' });
      if (!hadBorrow) actions.addPosition({ ...common, side: 'borrow' });

      if (hadSupply || hadBorrow) {
        const missing = hadSupply ? 'borrow' : 'supply';
        toast.success(`Added missing ${missing} side for ${reserve.tokenSymbol}`);
      }

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

  const groupedByReserve = useMemo(() => {
    const map = new Map<string, { tokenSymbol: string; chainName: string; supply: PortfolioPosition | null; borrow: PortfolioPosition | null }>();
    for (const p of positions) {
      if (!map.has(p.reserveId)) {
        map.set(p.reserveId, { tokenSymbol: p.tokenSymbol, chainName: p.chainName, supply: null, borrow: null });
      }
      const entry = map.get(p.reserveId)!;
      if (p.side === 'supply') entry.supply = p;
      else entry.borrow = p;
    }
    return map;
  }, [positions]);

  // Suggested popular tokens for quick-add: top 2 stablecoins, top 2 ETH-related,
  // and top 1 BTC-related by reserve size (TVL). Excludes already-added symbols.
  const suggestedReserves = useMemo(() => {
    const addedSymbols = new Set(positions.map((p) => p.tokenSymbol.toUpperCase()));
    const sortedBySize = [...reserves].sort(
      (a, b) => (b.reserveSizeUsd ?? 0) - (a.reserveSizeUsd ?? 0),
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
    for (const p of positions) {
      if (p.reserveId === reserveId) actions.removePosition(p.positionId);
    }
  }, [actions, positions]);

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
            <Layers className={`size-4 ${BATCH_THEME.text}`} aria-hidden />
            <span className="ds-text-14 font-semibold text-foreground">
              Batch
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Save snapshot */}
            {positions.length > 0 && summary && (
              <button
                type="button"
                onClick={() => setShowSaveInput((p) => !p)}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  showSaveInput
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                aria-label={showSaveInput ? 'Cancel save' : 'Save snapshot'}
              >
                {showSaveInput ? (
                  <X className="size-3.5" aria-hidden />
                ) : (
                  <Save className="size-3.5" aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((p) => !p)}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                searchOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              aria-label={searchOpen ? 'Close search' : 'Search tokens'}
            >
              {searchOpen ? (
                <X className="size-3.5" aria-hidden />
              ) : (
                <Search className="size-3.5" aria-hidden />
              )}
            </button>
            {positions.length > 0 && (
              <button
                type="button"
                onClick={() => actions.clearAll()}
                className={`rounded-md p-1.5 text-muted-foreground/60 transition-colors ${BATCH_THEME.trashHoverBg} ${BATCH_THEME.trashHoverText}`}
                aria-label="Clear all positions"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* Save snapshot input */}
        {showSaveInput && (
          <div className="flex items-center gap-2 mb-2.5">
            <input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder={`Snapshot ${snapshots.length + 1}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSnapshot()}
              className={cn(
                'h-7 flex-1 rounded-lg border border-border/50 bg-muted/40 px-2.5 ds-text-11 text-foreground placeholder:text-muted-foreground/50',
                `focus:${BATCH_THEME.border} focus:outline-none focus:ring-1 focus:${BATCH_THEME.ringSoft}`,
              )}
              aria-label="Snapshot name"
            />
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className={`rounded-lg ${BATCH_THEME.bgSoft} px-3 py-1 ds-text-11 font-semibold ${BATCH_THEME.text} hover:${BATCH_THEME.bgSubtle} transition-colors`}
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
                'h-8 w-full rounded-lg border border-border/50 bg-muted/40 px-3 ds-text-12 text-foreground placeholder:text-muted-foreground/50 placeholder:italic',
                `focus:${BATCH_THEME.border} focus:outline-none focus:ring-1 focus:${BATCH_THEME.ringSoft}`,
              )}
              aria-label="Search tokens to add"
            />
            {filteredReserves.length > 0 && (
              <div className="mt-1.5 max-h-[200px] overflow-y-auto rounded-lg border border-border/40 bg-card py-1">
                {filteredReserves.map((r) => (
                  <SearchResultRow
                    key={getReserveKey(r)}
                    reserve={r}
                    onAdd={handleAddToken}
                    existingPositions={positions}
                  />
                ))}
              </div>
            )}
            {searchQuery.trim() && filteredReserves.length === 0 && (
              <p className="mt-1.5 px-2 ds-text-11 text-muted-foreground italic">
                No tokens found
              </p>
            )}
          </div>
        )}

        {/* Position list */}
        {positions.length === 0 ? (
          <div
            className={cn(
              'rounded-xl border border-dashed px-3 py-4 text-center',
              BATCH_THEME.border,
              BATCH_THEME.bgSubtle,
            )}
          >
            <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full border border-border/50 bg-card/80">
              <Sparkles className={cn('size-4', BATCH_THEME.text)} aria-hidden />
            </div>
            <p className="ds-text-13 font-semibold text-foreground">
              Build your batch portfolio
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={focusSearch}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ds-text-11 font-semibold transition-colors',
                  BATCH_THEME.bgSoft,
                  BATCH_THEME.text,
                  `hover:${BATCH_THEME.bgSubtle}`,
                )}
              >
                <Search className="size-3" aria-hidden />
                Search tokens
              </button>
            </div>

            {suggestedReserves.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {suggestedReserves.map((r) => {
                  const reserveId = getReserveKey(r);
                  const chainSrc = getChainIconSrc(r.chainName);
                  const marketLabel = getMarketChipLabel(r.marketName, r.chainName);
                  const isV4 = getProtocolVersion(r.marketName) === 'v4';
                  return (
                    <button
                      key={reserveId}
                      type="button"
                      onClick={() => handleAddToken(reserveId)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/70 px-2 py-1 ds-text-10 font-semibold text-foreground transition-colors hover:bg-muted/60"
                      aria-label={`Add ${r.tokenSymbol} on ${r.marketName} to batch`}
                    >
                      <TokenIcon symbol={r.tokenSymbol} size={14} />
                      <span>{r.tokenSymbol}</span>
                      <span className="inline-flex items-center gap-0.5 ds-text-10 font-normal text-muted-foreground">
                        {chainSrc && (
                          <img src={chainSrc} alt={r.chainName} className="size-3 shrink-0" />
                        )}
                        {isV4 && (
                          <span className="inline-flex items-center px-1 py-0 rounded-full text-[9px] font-medium leading-none text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
                            V4
                          </span>
                        )}
                        <span>{marketLabel}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {suggestedReserves.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                {suggestedReserves.map((r) => {
                  const reserveId = getReserveKey(r);
                  const chainSrc = getChainIconSrc(r.chainName);
                  const marketLabel = getMarketChipLabel(r.marketName, r.chainName);
                  const isV4 = getProtocolVersion(r.marketName) === 'v4';
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {suggestedReserves.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                {suggestedReserves.map((r) => {
                  const reserveId = getReserveKey(r);
                  const chainSrc = getChainIconSrc(r.chainName);
                  return (
                    <button
                      key={reserveId}
                      type="button"
                      onClick={() => handleAddToken(reserveId)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/70 px-2 py-0.5 ds-text-10 font-semibold text-foreground transition-colors hover:bg-muted/60"
                      aria-label={`Add ${r.tokenSymbol} on ${r.marketName} to batch`}
                    >
                      <TokenIcon symbol={r.tokenSymbol} size={12} />
                      <span>{r.tokenSymbol}</span>
                      {chainSrc && (
                        <img src={chainSrc} alt={r.chainName} title={r.marketName} className="size-3 shrink-0" />
                      )}
                      {!isMobile && (
                        <span className="ds-text-10 font-normal text-muted-foreground truncate max-w-[80px]">
                          {r.marketName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {Array.from(groupedByReserve.entries()).map(([reserveId, entry]) => (
              <PortfolioTokenRow
                key={reserveId}
                reserveId={reserveId}
                tokenSymbol={entry.tokenSymbol}
                chainName={entry.chainName}
                supplyPosition={entry.supply}
                borrowPosition={entry.borrow}
                onRemove={handleRemoveToken}
                onUpdateAmount={actions.updateAmount}
                onUpdateInputMode={actions.updateInputMode}
              />
            ))}
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
      {snapshots.length > 0 && (
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
                className={`flex items-center gap-1 rounded-lg ${BATCH_THEME.bgSoft} px-2.5 py-1 ds-text-11 font-semibold ${BATCH_THEME.text} hover:${BATCH_THEME.bgSubtle} transition-colors`}
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
      {showCompare && compareSnapshots && (
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
