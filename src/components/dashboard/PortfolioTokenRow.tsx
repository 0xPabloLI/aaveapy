import { memo, useCallback } from 'react';
import { Eraser, Minus, Wallet, EyeOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { getWalletSyncState } from '@/lib/portfolioWalletSync';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getSoftDeleteAction } from '@/lib/portfolioSoftDelete';

import { BATCH_THEME } from './batchTheme';
import type { PortfolioPosition, PortfolioInputMode } from '@/types/portfolio';

interface PortfolioTokenRowProps {
  supplyPosition: PortfolioPosition | null;
  borrowPosition: PortfolioPosition | null;
  tokenSymbol: string;
  chainName: string;
  marketName: string;
  hubName?: string;
  isOrphan?: boolean;
  onRemove: (reserveId: string) => void;
  reserveId: string;
  onUpdateAmount: (positionId: string, amount: string) => void;
  onUpdateInputMode: (positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => void;
  onToggleHidden?: (positionId: string) => void;
  onRestorePosition?: (positionId: string) => void;
  tokenPriceInUsd?: number;
}

function WalletSyncIndicator({ position, onRestore }: {
  position: PortfolioPosition;
  onRestore?: (positionId: string) => void;
}) {
  const state = getWalletSyncState(position);

  if (state === 'synced') {
    const isSdk = position.source === 'sdk';
    return (
      <div className="relative shrink-0">
        <Wallet className="size-3.5 text-emerald-500" aria-label={isSdk ? 'Synced from SDK' : 'Synced from wallet'} />
        {isSdk && (
          <Zap className="absolute -bottom-0.5 -right-1 size-2 text-indigo-400 fill-indigo-400" aria-hidden />
        )}
      </div>
    );
  }

  if (state === 'modified') {
    return (
      <button
        type="button"
        onClick={onRestore ? () => onRestore(position.positionId) : undefined}
        className="group relative shrink-0"
        aria-label={`Modified — click to restore amount to wallet value`}
        title="Restore to wallet value"
      >
        <div className="relative">
          <Wallet className="size-3.5 text-amber-500" />
          <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 border border-card" />
        </div>
      </button>
    );
  }

  return <div className="size-3.5 shrink-0" aria-hidden="true" />;
}

const PortfolioTokenRow = memo(function PortfolioTokenRow({
  supplyPosition,
  borrowPosition,
  tokenSymbol,
  chainName,
  marketName,
  hubName,
  isOrphan,
  onRemove,
  reserveId,
  onUpdateAmount,
  onUpdateInputMode,
  onToggleHidden,
  onRestorePosition,
  tokenPriceInUsd,
}: PortfolioTokenRowProps) {
  const isMobile = useIsMobile();
  const chainSrc = getChainIconSrc(chainName);
  const marketLabel = getMarketChipLabel(marketName, chainName);
  const showV4 = isV4Market(marketName);
  const hubChipClass = getHubChipClass(showV4);

  const anyPosition = supplyPosition ?? borrowPosition;
  const isHidden = anyPosition?.hidden ?? false;

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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={tokenPriceInUsd === undefined}
              onClick={() =>
                onUpdateInputMode(
                  position.positionId,
                  position.inputMode === 'usd' ? 'token' : 'usd',
                  tokenPriceInUsd,
                )
              }
              className={cn(
                'shrink-0 rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 ds-text-10 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                tokenPriceInUsd === undefined && 'opacity-40 cursor-not-allowed hover:bg-muted/60 hover:text-muted-foreground',
              )}
              aria-label={`Switch to ${position.inputMode === 'usd' ? 'token' : 'USD'} input`}
            >
              {position.inputMode === 'usd' ? '$' : 'T'}
            </button>
          </TooltipTrigger>
          {tokenPriceInUsd === undefined && (
            <TooltipContent side="top" className="ds-text-11">
              Price unavailable for this position
            </TooltipContent>
          )}
        </Tooltip>
        <div className="relative flex-1 min-w-0">
          <input
            value={position.amount}
            onChange={(e) =>
              onUpdateAmount(position.positionId, formatNumberInput(e.target.value))
            }
            inputMode="decimal"
            placeholder={position.inputMode === 'usd' ? '10,000' : '100'}
            className={cn(
              'h-[var(--ds-chip-h)] w-full min-w-[4rem] rounded-md pl-2 ds-text-12 tabular-nums placeholder:italic',
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

  const handleMinusClick = useCallback(() => {
    if (!anyPosition) return;
    const action = getSoftDeleteAction(anyPosition);
    if (action === 'toggleHidden' && onToggleHidden) {
      onToggleHidden(anyPosition.positionId);
    } else {
      onRemove(reserveId);
    }
  }, [anyPosition, onToggleHidden, onRemove, reserveId]);

  const minusBtn = (
    <button
      type="button"
      onClick={handleMinusClick}
      className={cn(
        'shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors',
        BATCH_THEME.trashHoverBg,
        BATCH_THEME.trashHoverText,
      )}
      aria-label={isHidden ? `Restore ${tokenSymbol}` : `Remove ${tokenSymbol} from portfolio`}
    >
      <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />
    </button>
  );

  const walletIndicatorSupply = supplyPosition && (
    <WalletSyncIndicator position={supplyPosition} onRestore={onRestorePosition} />
  );
  const walletIndicatorBorrow = borrowPosition && (
    <WalletSyncIndicator position={borrowPosition} onRestore={onRestorePosition} />
  );

  const hiddenSuffix = isHidden ? (
    <div className="flex items-center gap-1 shrink-0 text-muted-foreground/60">
      {anyPosition && getWalletSyncState(anyPosition) !== 'manual' && (
        <Wallet className="size-3 text-emerald-500/60 shrink-0" aria-hidden />
      )}
      <EyeOff className="size-3 shrink-0" aria-hidden />
    </div>
  ) : null;

  const rowBaseClass = cn(
    'grid grid-cols-subgrid col-span-2 items-center transition-colors',
    isHidden
      ? 'border-border/20 bg-muted/5 opacity-40 hover:opacity-60'
      : 'border-border/50 bg-card/80 hover:border-border',
    isHidden ? 'rounded-lg border px-2.5 py-2' : 'rounded-lg border px-2.5 py-2',
  );

  if (isMobile) {
    return (
      <div
        className={cn(
          'grid grid-cols-subgrid col-span-2 items-center gap-x-1 rounded-lg border transition-colors',
          isHidden
            ? 'border-border/20 bg-muted/5 opacity-40 hover:opacity-60'
            : 'border-border/50 bg-card/80 hover:border-border',
          isHidden && 'cursor-pointer',
        )}
        onClick={isHidden && onToggleHidden && anyPosition ? () => onToggleHidden(anyPosition.positionId) : undefined}
      >
        <div className="flex min-w-0 items-center gap-1">
          {minusBtn}
          <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 leading-[1.15]">
            <span className="flex justify-center"><TokenIcon symbol={tokenSymbol} size={14} /></span>
            <span className={cn('ds-text-12 font-semibold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>{tokenSymbol}</span>
            <span className="flex justify-center">
              {chainSrc && <img src={chainSrc} alt={chainName} className="size-3" />}
            </span>
            <span className="ds-text-10 text-muted-foreground truncate">{marketLabel}</span>
            {hubName && (
              <>
                <span aria-hidden />
                <span className={cn('justify-self-start max-w-full -ml-1.5 truncate', hubChipClass)} title={`Hub: ${hubName}`}>
                  <span className="truncate">{hubName}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1">
          {renderSideInput(supplyPosition, 'Supply')}
          {borrowPosition && renderSideInput(borrowPosition, 'Borrow')}
        </div>
        <div className="flex items-center gap-1 self-center justify-self-end">
          {!isHidden && walletIndicatorSupply}
          {!isHidden && walletIndicatorBorrow}
          {hiddenSuffix}
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div
      className={cn(
        'grid grid-cols-subgrid col-span-2 items-center gap-x-1 rounded-lg border transition-colors',
        isHidden
          ? 'border-border/20 bg-muted/5 opacity-40 hover:opacity-60'
          : isOrphan
            ? 'border-border/20 bg-muted/5 opacity-60'
            : 'border-border/50 bg-card/80 hover:border-border',
        isHidden && 'cursor-pointer',
      )}
      onClick={isHidden && onToggleHidden && anyPosition ? () => onToggleHidden(anyPosition.positionId) : undefined}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {minusBtn}
        <TokenIcon symbol={tokenSymbol} size={20} />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className={cn('ds-text-12 font-semibold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {tokenSymbol}
          </span>
          <span className="ds-text-10 text-muted-foreground inline-flex items-center gap-1 min-w-0 flex-wrap">
            {chainSrc && (
              <img src={chainSrc} alt={chainName} className="size-2.5 shrink-0 opacity-70" />
            )}
            <span className="truncate">{marketLabel}</span>
            {hubName && (
              <span className={cn('shrink-0 max-w-full', hubChipClass)} title={`Hub: ${hubName}`}>
                <span className="truncate">{hubName}</span>
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {renderSideInput(supplyPosition, 'Supply')}
        {borrowPosition && renderSideInput(borrowPosition, 'Borrow')}
        {!isHidden && walletIndicatorSupply}
        {!isHidden && walletIndicatorBorrow}
        {hiddenSuffix}
      </div>
    </div>
  );
});

export default PortfolioTokenRow;
