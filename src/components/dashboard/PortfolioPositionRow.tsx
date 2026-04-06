/**
 * PortfolioPositionRow — a single position card inside the portfolio panel.
 */
import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import TokenIcon from '@/components/primitives/TokenIcon';
import type { PortfolioPosition, PortfolioInputMode } from '@/types/portfolio';

interface PortfolioPositionRowProps {
  position: PortfolioPosition;
  onRemove: (positionId: string) => void;
  onUpdateAmount: (positionId: string, amount: string) => void;
  onUpdateInputMode: (positionId: string, mode: PortfolioInputMode) => void;
}

const PortfolioPositionRow = memo(function PortfolioPositionRow({
  position,
  onRemove,
  onUpdateAmount,
  onUpdateInputMode,
}: PortfolioPositionRowProps) {
  const isBorrow = position.side === 'borrow';
  const sideLabel = isBorrow ? 'Borrow' : 'Supply';
  const sideColor = isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600';
  const sideBg = isBorrow ? 'ds-bg-brand-cyan-10' : 'ds-bg-emerald-500-10';
  const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-2.5 py-2 transition-colors hover:border-border">
      {/* Token info */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <TokenIcon symbol={position.tokenSymbol} size={20} />
        <div className="flex flex-col min-w-0">
          <span className="ds-text-12 font-semibold text-foreground truncate">
            {position.tokenSymbol}
          </span>
          <span className="ds-text-10 text-muted-foreground truncate">
            {position.chainName}
          </span>
        </div>
      </div>

      {/* Side badge */}
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 ds-text-10 font-semibold uppercase',
          sideBg,
          sideColor,
        )}
      >
        {sideLabel}
      </span>

      {/* Amount input */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          onClick={() =>
            onUpdateInputMode(
              position.positionId,
              position.inputMode === 'usd' ? 'token' : 'usd',
            )
          }
          className="shrink-0 rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 ds-text-10 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Switch to ${position.inputMode === 'usd' ? 'token' : 'USD'} input`}
        >
          {position.inputMode === 'usd' ? '$' : 'T'}
        </button>
        <input
          value={position.amount}
          onChange={(e) =>
            onUpdateAmount(position.positionId, formatNumberInput(e.target.value))
          }
          inputMode="decimal"
          placeholder={position.inputMode === 'usd' ? '10,000' : '100'}
          className={cn(
            'h-7 w-full min-w-[3.5rem] rounded-md px-2 ds-text-12 tabular-nums placeholder:italic',
            cnDsInputSurface(Boolean(position.amount.trim()), inputVariant),
          )}
          aria-label={`${sideLabel} amount for ${position.tokenSymbol}`}
        />
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(position.positionId)}
        className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${position.tokenSymbol} ${sideLabel}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
});

export default PortfolioPositionRow;
