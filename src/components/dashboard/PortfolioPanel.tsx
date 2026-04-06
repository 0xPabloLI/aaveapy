/**
 * PortfolioPanel — portfolio management panel with token search,
 * position list, summary card, and results table.
 */
import { useState, useMemo, memo, useCallback } from 'react';
import { Search, Plus, X, Layers, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioPosition, PortfolioInputMode, PortfolioSide, PortfolioPositionResult, PortfolioSummary } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import { normalizeTokenSymbolForSearch } from '@/lib/tokenSymbolNormalization';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import PortfolioPositionRow from './PortfolioPositionRow';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import PortfolioResultsTable from './PortfolioResultsTable';

interface PortfolioPanelProps {
  positions: PortfolioPosition[];
  actions: PortfolioSimulationActions;
  reserves: ReserveWithSpread[];
  /** Per-position simulation results (computed externally). */
  positionResults?: PortfolioPositionResult[];
  /** Aggregated portfolio summary (computed externally). */
  summary?: PortfolioSummary;
}

/** Search result row with quick add buttons. */
function SearchResultRow({
  reserve,
  onAdd,
  existingPositions,
}: {
  reserve: ReserveWithSpread;
  onAdd: (reserveId: string, side: PortfolioSide) => void;
  existingPositions: PortfolioPosition[];
}) {
  const reserveId = `${reserve.marketName}-${reserve.tokenAddress}`;
  const hasSupply = existingPositions.some(
    (p) => p.reserveId === reserveId && p.side === 'supply',
  );
  const hasBorrow = existingPositions.some(
    (p) => p.reserveId === reserveId && p.side === 'borrow',
  );

  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/60">
      <TokenIcon symbol={reserve.tokenSymbol} size={18} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="ds-text-12 font-semibold text-foreground truncate">
          {reserve.tokenSymbol}
        </span>
        <span className="ds-text-10 text-muted-foreground truncate">
          {reserve.marketName}
        </span>
      </div>
      <button
        type="button"
        disabled={hasSupply}
        onClick={() => onAdd(reserveId, 'supply')}
        className={cn(
          'rounded px-2 py-0.5 ds-text-10 font-semibold transition-colors',
          hasSupply
            ? 'opacity-40 cursor-not-allowed bg-muted text-muted-foreground'
            : 'ds-bg-emerald-500-10 ds-text-emerald-600 hover:ds-bg-emerald-500-20',
        )}
        aria-label={`Add ${reserve.tokenSymbol} supply`}
      >
        <Plus className="inline size-3 mr-0.5" aria-hidden />
        Supply
      </button>
      <button
        type="button"
        disabled={hasBorrow}
        onClick={() => onAdd(reserveId, 'borrow')}
        className={cn(
          'rounded px-2 py-0.5 ds-text-10 font-semibold transition-colors',
          hasBorrow
            ? 'opacity-40 cursor-not-allowed bg-muted text-muted-foreground'
            : 'ds-bg-brand-cyan-10 ds-text-brand-cyan hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.15)]',
        )}
        aria-label={`Add ${reserve.tokenSymbol} borrow`}
      >
        <Plus className="inline size-3 mr-0.5" aria-hidden />
        Borrow
      </button>
    </div>
  );
}

const PortfolioPanel = memo(function PortfolioPanel({
  positions,
  actions,
  reserves,
}: PortfolioPanelProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

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
      .slice(0, 8);
  }, [reserves, searchQuery]);

  const handleAddFromSearch = useCallback(
    (reserveId: string, side: PortfolioSide) => {
      const reserve = reserves.find(
        (r) => `${r.marketName}-${r.tokenAddress}` === reserveId,
      );
      if (!reserve) return;
      actions.addPosition({
        reserveId,
        marketName: reserve.marketName,
        chainName: reserve.chainName ?? reserve.marketName,
        tokenSymbol: reserve.tokenSymbol,
        side,
      });
    },
    [reserves, actions],
  );

  const supplyPositions = positions.filter((p) => p.side === 'supply');
  const borrowPositions = positions.filter((p) => p.side === 'borrow');

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm',
        isMobile ? 'px-2.5 py-2.5' : 'px-4 py-3',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" aria-hidden />
          <span className="ds-text-14 font-semibold text-foreground">
            Portfolio
          </span>
          {positions.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 ds-text-10 font-bold tabular-nums text-primary">
              {positions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Clear all positions"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="mb-2.5">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search token…"
            autoFocus
            className={cn(
              'h-8 w-full rounded-lg border border-border/50 bg-muted/40 px-3 ds-text-12 text-foreground placeholder:text-muted-foreground/50 placeholder:italic',
              'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20',
            )}
            aria-label="Search tokens to add"
          />
          {filteredReserves.length > 0 && (
            <div className="mt-1.5 max-h-[200px] overflow-y-auto rounded-lg border border-border/40 bg-card py-1">
              {filteredReserves.map((r) => (
                <SearchResultRow
                  key={`${r.marketName}-${r.tokenAddress}`}
                  reserve={r}
                  onAdd={handleAddFromSearch}
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
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="ds-text-12 text-muted-foreground">
            No positions yet
          </p>
          <p className="ds-text-11 text-muted-foreground/60 mt-1">
            Use the search above to add tokens
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Supply section */}
          {supplyPositions.length > 0 && (
            <div className="space-y-1.5">
              <span className="ds-text-10 font-semibold uppercase tracking-wide ds-text-emerald-600">
                Supply ({supplyPositions.length})
              </span>
              <div className="space-y-1">
                {supplyPositions.map((p) => (
                  <PortfolioPositionRow
                    key={p.positionId}
                    position={p}
                    onRemove={actions.removePosition}
                    onUpdateAmount={actions.updateAmount}
                    onUpdateInputMode={actions.updateInputMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Borrow section */}
          {borrowPositions.length > 0 && (
            <div className="space-y-1.5">
              <span className="ds-text-10 font-semibold uppercase tracking-wide ds-text-brand-cyan">
                Borrow ({borrowPositions.length})
              </span>
              <div className="space-y-1">
                {borrowPositions.map((p) => (
                  <PortfolioPositionRow
                    key={p.positionId}
                    position={p}
                    onRemove={actions.removePosition}
                    onUpdateAmount={actions.updateAmount}
                    onUpdateInputMode={actions.updateInputMode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default PortfolioPanel;
