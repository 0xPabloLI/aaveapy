import { memo, useCallback } from 'react';
import { Eraser, Minus, Wallet, EyeOff, Zap, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { getWalletSyncState } from '@/lib/portfolioWalletSync';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getGroupSoftDeleteAction } from '@/lib/portfolioSoftDelete';
import { useNumberInput } from '@/hooks/useNumberInput';

import { PORTFOLIO_THEME } from './portfolioTheme';
import type { PortfolioPosition, PortfolioInputMode, DeltaSign } from '@/types/portfolio';

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
  onUpdateDeltaSign: (positionId: string, sign: DeltaSign) => void;
  onHideOrRemoveReserve: (reserveId: string) => void;
  onUnhideReserve?: (reserveId: string) => void;
  onRestorePosition?: (positionId: string) => void;
  tokenPriceInUsd?: number;
}

function WalletSyncIndicator({ positions, onRestoreReserve, reserveId }: {
  positions: Array<PortfolioPosition | null>;
  onRestoreReserve?: (reserveId: string) => void;
  reserveId: string;
}) {
  const present = positions.filter((p): p is PortfolioPosition => p !== null);
  if (present.length === 0) {
    return <div className="size-3.5 shrink-0" aria-hidden="true" />;
  }
  const states = present.map(getWalletSyncState);
  const aggregate: 'modified' | 'synced' | 'manual' = states.includes('modified')
    ? 'modified'
    : states.includes('synced')
      ? 'synced'
      : 'manual';

  if (aggregate === 'manual') {
    return <div className="size-3.5 shrink-0" aria-hidden="true" />;
  }

  if (aggregate === 'synced') {
    return (
      <div className="shrink-0">
        <Wallet className="size-3.5 text-emerald-500" aria-label="Synced from wallet" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRestoreReserve ? () => onRestoreReserve(reserveId) : undefined}
      className="group relative shrink-0"
      aria-label="Modified — click to restore amounts to wallet values"
      title="Restore to wallet value"
    >
      <Wallet className="size-3.5 text-amber-500" />
    </button>
  );
}

interface SideInputProps {
  position: PortfolioPosition;
  sideLabel: string;
  tokenSymbol: string;
  tokenPriceInUsd?: number;
  isMobile: boolean;
  onUpdateAmount: (positionId: string, amount: string) => void;
  onUpdateInputMode: (positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => void;
  onUpdateDeltaSign: (positionId: string, sign: DeltaSign) => void;
}

function SideInput({
  position,
  sideLabel,
  tokenSymbol,
  tokenPriceInUsd,
  isMobile,
  onUpdateAmount,
  onUpdateInputMode,
  onUpdateDeltaSign,
}: SideInputProps) {
  const isBorrow = position.side === 'borrow';
  const labelColor = isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600';
  const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;
  const hasWallet = position.walletValue !== null;

  const deltaDisplay = hasWallet
    ? (() => {
        const effectiveUsd = position.inputMode === 'usd'
          ? parseNumberInput(position.amount)
          : parseNumberInput(position.amount) * (tokenPriceInUsd ?? 0);
        const deltaUsd = effectiveUsd - position.walletValue!;
        if (Math.abs(deltaUsd) < 0.005) return '';
        return formatNumberInput(String(Math.abs(deltaUsd)));
      })()
    : position.amount;

  const hasValue = Boolean(deltaDisplay.trim());
  const isPositiveDelta = hasWallet ? (position.deltaSign ?? 1) === 1 : true;

  const handleDeltaCommit = useCallback((formattedValue: string) => {
    if (!hasWallet) {
      onUpdateAmount(position.positionId, formattedValue);
      return;
    }
    const absDeltaUsd = parseNumberInput(formattedValue);
    const sign = isPositiveDelta ? 1 : -1;
    const effectiveUsd = Math.max(position.walletValue! + sign * absDeltaUsd, 0);
    onUpdateAmount(position.positionId, formatNumberInput(String(effectiveUsd)));
  }, [hasWallet, isPositiveDelta, onUpdateAmount, position.positionId, position.walletValue]);

  const numberInput = useNumberInput({
    initialValue: deltaDisplay,
    onCommit: handleDeltaCommit,
  });

  const toggleDeltaSign = useCallback(() => {
    if (!hasWallet) return;
    const newSign: DeltaSign = isPositiveDelta ? -1 : 1;
    onUpdateDeltaSign(position.positionId, newSign);
    if (deltaDisplay.trim()) {
      const absDeltaUsd = parseNumberInput(deltaDisplay);
      const effectiveUsd = Math.max(position.walletValue! + newSign * absDeltaUsd, 0);
      onUpdateAmount(position.positionId, formatNumberInput(String(effectiveUsd)));
    }
  }, [hasWallet, isPositiveDelta, deltaDisplay, onUpdateDeltaSign, onUpdateAmount, position.positionId, position.walletValue]);

  const handleClearDelta = useCallback(() => {
    if (!hasWallet) {
      onUpdateAmount(position.positionId, '');
      return;
    }
    onUpdateAmount(position.positionId, formatNumberInput(String(position.walletValue!)));
  }, [hasWallet, onUpdateAmount, position.positionId, position.walletValue]);

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
      {hasWallet && (() => {
        const effectiveUsdForSign = position.inputMode === 'usd'
          ? parseNumberInput(position.amount)
          : parseNumberInput(position.amount) * (tokenPriceInUsd ?? 0);
        const effectiveDisplay = position.inputMode === 'usd'
          ? formatNumberInput(String(effectiveUsdForSign))
          : position.amount;
        const deltaUsdForSign = effectiveUsdForSign - position.walletValue!;
        const priceUnavailable = position.inputMode !== 'usd' && tokenPriceInUsd === undefined;
        const isModified = !priceUnavailable && Math.abs(deltaUsdForSign) >= 0.005;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'shrink-0 ds-text-10 tabular-nums',
                  isModified ? 'text-foreground' : 'text-muted-foreground/70',
                )}
                aria-label={`Effective amount, wallet: ${formatNumberInput(String(position.walletValue!))}`}
              >
                {effectiveDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="ds-text-11">
              Wallet: {formatNumberInput(String(position.walletValue!))}
            </TooltipContent>
          </Tooltip>
        );
      })()}
      <div className="relative flex-1 min-w-0">
        {hasWallet && (
          <button
            type="button"
            onClick={toggleDeltaSign}
            className={cn(
              'absolute left-1 top-1/2 -translate-y-1/2 z-10 rounded-sm px-0.5 ds-text-11 font-bold transition-colors',
              isPositiveDelta
                ? 'text-emerald-600 hover:bg-emerald-500/10'
                : 'text-red-500 hover:bg-red-500/10',
            )}
            aria-label={isPositiveDelta ? 'Adding to position' : 'Reducing position'}
          >
            {isPositiveDelta ? '+' : '−'}
          </button>
        )}
        <input
          value={numberInput.displayValue}
          onChange={numberInput.handleChange}
          onFocus={numberInput.handleFocus}
          onBlur={numberInput.handleBlur}
          inputMode="decimal"
          placeholder={hasWallet ? '' : (position.inputMode === 'usd' ? '10,000' : '100')}
          className={cn(
            'h-[var(--ds-chip-h)] w-full min-w-[4rem] rounded-md ds-text-12 tabular-nums placeholder:italic',
            hasWallet ? 'pl-5 pr-7' : hasValue ? 'pl-2 pr-7' : 'pl-2 pr-2',
            cnDsInputSurface(hasValue, inputVariant),
          )}
          aria-label={`${sideLabel} ${hasWallet ? 'delta' : 'amount'} for ${tokenSymbol}`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClearDelta}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label={`Clear ${tokenSymbol} ${sideLabel.toLowerCase()}`}
          >
            <Eraser className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
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
  onUpdateDeltaSign,
  onHideOrRemoveReserve,
  onUnhideReserve,
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

  const handleMinusClick = useCallback(() => {
    if (!anyPosition) return;
    if (isHidden) {
      onUnhideReserve?.(reserveId);
    } else {
      const action = getGroupSoftDeleteAction([supplyPosition, borrowPosition]);
      if (action === 'toggleHidden') {
        onHideOrRemoveReserve(reserveId);
      } else {
        onRemove(reserveId);
      }
    }
  }, [anyPosition, isHidden, supplyPosition, borrowPosition, onHideOrRemoveReserve, onUnhideReserve, onRemove, reserveId]);

  const minusBtn = (
    <button
      type="button"
      onClick={handleMinusClick}
      className={cn(
        'shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors',
        PORTFOLIO_THEME.trashHoverBg,
        PORTFOLIO_THEME.trashHoverText,
      )}
      aria-label={isHidden ? `Restore ${tokenSymbol}` : `Remove ${tokenSymbol} from portfolio`}
    >
      {isHidden ? <EyeOff className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />}
    </button>
  );

  // Single unified wallet indicator per row so that the icon sits at the same
  // x-position across rows (e.g. WETH and GHO line up vertically).
  const walletIndicator = (
    <div className="flex w-4 justify-center shrink-0">
      <WalletSyncIndicator
        positions={[supplyPosition, borrowPosition]}
        onRestoreReserve={onUnhideReserve}
        reserveId={reserveId}
      />
    </div>
  );

  const hiddenSuffix = isHidden ? (
    <div className="flex items-center gap-1 shrink-0 text-muted-foreground/60">
      {anyPosition && getWalletSyncState(anyPosition) !== 'manual' && (
        <Wallet className="size-3 text-emerald-500/60 shrink-0" aria-hidden />
      )}
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
        onClick={isHidden && onUnhideReserve ? () => onUnhideReserve(reserveId) : undefined}
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
          {supplyPosition && <SideInput position={supplyPosition} sideLabel="Supply" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} onUpdateAmount={onUpdateAmount} onUpdateInputMode={onUpdateInputMode} onUpdateDeltaSign={onUpdateDeltaSign} />}
          {borrowPosition && <SideInput position={borrowPosition} sideLabel="Borrow" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} onUpdateAmount={onUpdateAmount} onUpdateInputMode={onUpdateInputMode} onUpdateDeltaSign={onUpdateDeltaSign} />}
        </div>
        <div className="flex items-center gap-1 self-center justify-self-end">
          {!isHidden && walletIndicator}
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
      onClick={isHidden && onUnhideReserve ? () => onUnhideReserve(reserveId) : undefined}
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
        {supplyPosition && <SideInput position={supplyPosition} sideLabel="Supply" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} onUpdateAmount={onUpdateAmount} onUpdateInputMode={onUpdateInputMode} onUpdateDeltaSign={onUpdateDeltaSign} />}
        {borrowPosition && <SideInput position={borrowPosition} sideLabel="Borrow" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} onUpdateAmount={onUpdateAmount} onUpdateInputMode={onUpdateInputMode} onUpdateDeltaSign={onUpdateDeltaSign} />}
        {!isHidden && (
          <div className="flex items-center justify-end shrink-0 w-4">
            {walletIndicator}
          </div>
        )}
        {hiddenSuffix}
      </div>
    </div>
  );
});

export default PortfolioTokenRow;
