import { memo } from 'react';
import { Trash2, Eraser, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market } from '@/lib/marketLabels';

import { BATCH_THEME } from './batchTheme';
import { ConfirmPopover } from '@/components/ui/confirm-popover';
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
        'relative flex items-center rounded-lg border border-border/50 bg-card/80 transition-colors hover:border-border',
        isMobile ? 'gap-1.5 px-2 py-1.5' : 'gap-2.5 px-2.5 py-2',
      )}
    >
      {/* Mobile corner remove badge — anchored to the whole row's top-right corner */}
      {isMobile && (
        <ConfirmPopover
          onConfirm={() => onRemove(reserveId)}
          title={`Remove ${tokenSymbol}?`}
          description="This position will be removed from the portfolio."
          align="end"
          side="bottom"
        >
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 z-10 flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60 transition-colors hover:bg-destructive hover:text-destructive-foreground active:scale-90"
            aria-label={`Remove ${tokenSymbol} from portfolio`}
          >
            <Minus className="size-2.5" strokeWidth={3} aria-hidden />
          </button>
        </ConfirmPopover>
      )}

      {/* Remove — desktop only as a separate column */}
      {!isMobile && (
        <ConfirmPopover
          onConfirm={() => onRemove(reserveId)}
          title={`Remove ${tokenSymbol}?`}
          description="This position will be removed from the portfolio."
          align="start"
          side="bottom"
        >
          <button
            type="button"
            className={`shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors ${BATCH_THEME.trashHoverBg} ${BATCH_THEME.trashHoverText}`}
            aria-label={`Remove ${tokenSymbol} from portfolio`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </ConfirmPopover>
      )}

      {/* Token info — mobile: 2-col grid (icons centered, text left-aligned), 3 rows */}
      {isMobile ? (
        <div className="grid min-w-0 shrink-0 max-w-[44%] grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 leading-[1.15]">
          {/* Row 1 */}
          <span className="flex justify-center"><TokenIcon symbol={tokenSymbol} size={14} /></span>
          <span className="ds-text-12 font-semibold text-foreground truncate">{tokenSymbol}</span>
          {/* Row 2 */}
          <span className="flex justify-center">
            {chainSrc && <img src={chainSrc} alt={chainName} className="size-3 opacity-70" />}
          </span>
          <span className="ds-text-10 text-muted-foreground truncate">{marketLabel}</span>
          {/* Row 3 — Hub aligned with text column, using shared mobile hub chip style */}
          {hubName && (
            <>
              <span aria-hidden />
              <span
                className="justify-self-start inline-flex max-w-full items-center rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] font-normal leading-none text-muted-foreground/70"
                title={`Hub: ${hubName}`}
              >
                <span className="truncate">{hubName}</span>
              </span>
            </>
          )}
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
                  className="shrink-0 inline-flex max-w-full items-center rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] font-normal leading-none text-muted-foreground/70"
                  title={`Hub: ${hubName}`}
                >
                  <span className="truncate">{hubName}</span>
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
