import { memo } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';

import { BATCH_THEME } from './batchTheme';
import type { PortfolioPosition, PortfolioInputMode } from '@/types/portfolio';

interface PortfolioTokenRowProps {
  supplyPosition: PortfolioPosition | null;
  borrowPosition: PortfolioPosition | null;
  tokenSymbol: string;
  chainName: string;
  onRemove: (reserveId: string) => void;
  reserveId: string;
  onUpdateAmount: (positionId: string, amount: string) => void;
  onUpdateInputMode: (positionId: string, mode: PortfolioInputMode) => void;
}

const PortfolioTokenRow = memo(function PortfolioTokenRow({
  supplyPosition,
  borrowPosition,
  tokenSymbol,
  chainName,
  onRemove,
  reserveId,
  onUpdateAmount,
  onUpdateInputMode,
}: PortfolioTokenRowProps) {
  

  const renderSideInput = (position: PortfolioPosition | null, sideLabel: string) => {
    if (!position) return null;
    const isBorrow = position.side === 'borrow';
    const labelColor = isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600';
    const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;

    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={cn('shrink-0 ds-text-12 font-semibold', labelColor)}>
          {sideLabel}
        </span>
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
            'h-7 w-full min-w-[4rem] rounded-md px-2 ds-text-12 tabular-nums placeholder:italic',
            cnDsInputSurface(Boolean(position.amount.trim()), inputVariant),
          )}
          aria-label={`${sideLabel} amount for ${tokenSymbol}`}
        />
        {/* Clear amount — matches the search panel close button style */}
        <button
          type="button"
          onClick={() => onUpdateAmount(position.positionId, '')}
          disabled={!position.amount.trim()}
          className={cn(
            'shrink-0 rounded-md p-1.5 transition-colors',
            position.amount.trim()
              ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              : 'text-muted-foreground/35 cursor-not-allowed',
          )}
          aria-label={`Clear ${tokenSymbol} ${sideLabel.toLowerCase()}`}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/80 px-2.5 py-2 transition-colors hover:border-border">
      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(reserveId)}
        className={`shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors ${BATCH_THEME.trashHoverBg} ${BATCH_THEME.trashHoverText}`}
        aria-label={`Remove ${tokenSymbol} from portfolio`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      {/* Token info */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <TokenIcon symbol={tokenSymbol} size={20} />
        <div className="flex flex-col min-w-0">
          <span className="ds-text-12 font-semibold text-foreground truncate">
            {tokenSymbol}
          </span>
          <span className="ds-text-10 text-muted-foreground truncate">
            {chainName}
          </span>
        </div>
      </div>

      {/* Supply + Borrow inputs */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {renderSideInput(supplyPosition, 'Supply')}
        {borrowPosition && renderSideInput(borrowPosition, 'Borrow')}
      </div>
    </div>
  );
});

export default PortfolioTokenRow;
