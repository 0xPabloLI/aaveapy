import { memo } from 'react';
import { Trash2, Eraser, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market } from '@/lib/marketLabels';

import { BATCH_THEME } from './batchTheme';
import type { PortfolioPosition, PortfolioInputMode } from '@/types/portfolio';

interface PortfolioTokenRowProps {
  supplyPosition: PortfolioPosition | null;
  borrowPosition: PortfolioPosition | null;
  tokenSymbol: string;
  chainName: string;
  marketName: string;
  hubName?: string;
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
  marketName,
  hubName,
  onRemove,
  reserveId,
  onUpdateAmount,
  onUpdateInputMode,
}: PortfolioTokenRowProps) {
  const isMobile = useIsMobile();
  const chainSrc = getChainIconSrc(chainName);
  const marketLabel = getMarketChipLabel(marketName, chainName);
  const showV4 = isV4Market(marketName);

  const renderSideInput = (position: PortfolioPosition | null, sideLabel: string) => {
    if (!position) return null;
    const isBorrow = position.side === 'borrow';
    const labelColor = isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600';
    const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;
    const hasValue = Boolean(position.amount.trim());

    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={cn('shrink-0 ds-text-12 font-semibold', isMobile ? 'w-10' : 'w-11', labelColor)}>
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
        {/* Input with embedded clear button (matches search-token / filter input pattern) */}
        <div className="relative flex-1 min-w-0">
          <input
            value={position.amount}
            onChange={(e) =>
              onUpdateAmount(position.positionId, formatNumberInput(e.target.value))
            }
            inputMode="decimal"
            placeholder={position.inputMode === 'usd' ? '10,000' : '100'}
            className={cn(
              'h-7 w-full min-w-[4rem] rounded-md pl-2 ds-text-12 tabular-nums placeholder:italic',
              hasValue ? 'pr-7' : 'pr-2',
              cnDsInputSurface(hasValue, inputVariant),
            )}
            aria-label={`${sideLabel} amount for ${tokenSymbol}`}
          />
          {hasValue && (
            <button
              type="button"
              onClick={() => onUpdateAmount(position.positionId, '')}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              aria-label={`Clear ${tokenSymbol} ${sideLabel.toLowerCase()}`}
            >
              <Eraser className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex items-center rounded-lg border border-border/50 bg-card/80 transition-colors hover:border-border',
        isMobile ? 'gap-1.5 px-2 py-1.5' : 'gap-2.5 px-2.5 py-2',
      )}
    >
      {/* Remove — desktop only as a separate column. On mobile it overlays the token icon (hover/tap reveals trash). */}
      {!isMobile && (
        <button
          type="button"
          onClick={() => onRemove(reserveId)}
          className={`shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors ${BATCH_THEME.trashHoverBg} ${BATCH_THEME.trashHoverText}`}
          aria-label={`Remove ${tokenSymbol} from portfolio`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}

      {/* Token info — mobile: vertical stack (symbol / chain·V4·market / hub) for narrower footprint */}
      {isMobile ? (
        <div className="flex min-w-0 shrink-0 items-center gap-1 max-w-[40%]">
          {/* Token icon doubles as remove button on mobile (saves a column) */}
          <button
            type="button"
            onClick={() => onRemove(reserveId)}
            className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove ${tokenSymbol} from portfolio`}
          >
            <TokenIcon symbol={tokenSymbol} size={20} />
            {/* Always-visible small remove badge — discoverable on mobile without occupying a column */}
            <span
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-1 ring-background transition-transform group-active:scale-90"
              aria-hidden
            >
              <X className="size-2.5" strokeWidth={3} />
            </span>
          </button>
          <div className="flex flex-col min-w-0 leading-[1.15] gap-0.5">
            <span className="ds-text-12 font-semibold text-foreground truncate">
              {tokenSymbol}
            </span>
            <span className="ds-text-10 text-muted-foreground inline-flex items-center gap-0.5 min-w-0">
              {chainSrc && (
                <img src={chainSrc} alt={chainName} className="size-2.5 shrink-0 opacity-70" />
              )}
              {showV4 && (
                <span className="shrink-0 inline-flex items-center px-1 py-0 rounded-full text-[8px] font-medium leading-none text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
                  V4
                </span>
              )}
              <span className="truncate">{marketLabel}</span>
            </span>
            {hubName && (
              <span
                className="shrink-0 self-start inline-flex items-center px-1 py-0 rounded-full text-[8px] font-medium leading-none text-muted-foreground bg-muted/70 ring-1 ring-border/40 max-w-full truncate"
                title={`Hub: ${hubName}`}
              >
                {hubName}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <TokenIcon symbol={tokenSymbol} size={20} />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="ds-text-12 font-semibold text-foreground truncate">
              {tokenSymbol}
            </span>
            <span className="ds-text-10 text-muted-foreground inline-flex items-center gap-0.5 min-w-0 flex-wrap">
              {chainSrc && (
                <img src={chainSrc} alt={chainName} className="size-2.5 shrink-0 opacity-70" />
              )}
              {showV4 && (
                <span className="shrink-0 inline-flex items-center px-1 py-0 rounded-full text-[8px] font-medium leading-none text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
                  V4
                </span>
              )}
              <span className="truncate">{marketLabel}</span>
              {hubName && (
                <span
                  className="shrink-0 inline-flex items-center px-1 py-0 rounded-full text-[8px] font-medium leading-none text-muted-foreground bg-muted/70 ring-1 ring-border/40"
                  title={`Hub: ${hubName}`}
                >
                  {hubName}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Supply + Borrow inputs — stacked on mobile, inline on desktop */}
      <div
        className={cn(
          'flex min-w-0 flex-1',
          isMobile ? 'flex-col items-stretch gap-1' : 'items-center gap-3',
        )}
      >
        {renderSideInput(supplyPosition, 'Supply')}
        {borrowPosition && renderSideInput(borrowPosition, 'Borrow')}
      </div>
    </div>
  );
});

export default PortfolioTokenRow;
