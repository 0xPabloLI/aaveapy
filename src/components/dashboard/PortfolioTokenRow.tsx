import { memo, useCallback, useRef } from 'react';
import { Eraser, Minus, EyeOff, Snowflake, PauseCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { formatConvertedAmount } from '@/lib/portfolioCalculator';
import { cnDsInputSurface } from '@/lib/dsInputSurface';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebouncedInput } from '@/hooks/useDebouncedInput';

import { PORTFOLIO_THEME } from './portfolioTheme';
import type { PortfolioReserveEntry, PortfolioSideData, PortfolioInputMode, DeltaSign } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';

const DELTA_EPSILON = 0.005;

interface PortfolioTokenRowProps {
  entry: PortfolioReserveEntry;
  actions: PortfolioSimulationActions;
  reserveId: string;
  tokenPriceInUsd?: number;
  disabledNotice?: { supply?: string | null; borrow?: string | null };
}

interface SideInputProps {
  sideData: PortfolioSideData;
  side: 'supply' | 'borrow';
  sideLabel: string;
  tokenSymbol: string;
  tokenPriceInUsd?: number;
  isMobile: boolean;
  reserveId: string;
  actions: PortfolioSimulationActions;
  disabled?: boolean;
  disabledNotice?: string | null;
}

function SideInput({
  sideData,
  side,
  sideLabel,
  tokenSymbol,
  tokenPriceInUsd,
  isMobile,
  reserveId,
  actions,
  disabled,
  disabledNotice,
}: SideInputProps) {
  const isBorrow = side === 'borrow';
  const labelColor = isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600';
  const inputVariant = isBorrow ? 'borrow' as const : 'supply' as const;
  const hasWallet = sideData.walletValue !== null;

  const deltaDisplay = hasWallet
    ? (sideData.deltaRawUsd !== undefined
      ? formatNumberInput(formatConvertedAmount(Math.abs(sideData.deltaRawUsd)))
      : (() => {
          const effectiveUsd = sideData.inputMode === 'usd'
            ? parseNumberInput(sideData.amount)
            : parseNumberInput(sideData.amount) * (tokenPriceInUsd ?? 0);
          const deltaUsd = effectiveUsd - sideData.walletValue!;
          if (Math.abs(deltaUsd) < DELTA_EPSILON) return '';
          return formatNumberInput(formatConvertedAmount(Math.abs(deltaUsd)));
        })())
    : sideData.amount;

  const hasValue = Boolean(deltaDisplay.trim());
  const isPositiveDelta = hasWallet ? (sideData.deltaSign ?? 1) === 1 : true;

  const deltaCommitRef = useRef({ initialHasValue: hasValue });
  if (deltaCommitRef.current.initialHasValue !== hasValue) {
    deltaCommitRef.current = { initialHasValue: hasValue };
  }

  const handleDeltaCommit = useCallback((formattedValue: string) => {
    if (!formattedValue.trim()) {
      if (!deltaCommitRef.current.initialHasValue) return;
      if (!hasWallet) {
        actions.updateReserve(reserveId, side === 'supply' ? { supplyAmount: '' } : { borrowAmount: '' });
        return;
      }
      const resetAmount = formatConvertedAmount(sideData.walletValue!);
      const clearPatch = side === 'supply'
        ? { supplyAmount: resetAmount, supplyDeltaSign: 1 as DeltaSign, supplyDeltaRawUsd: null as number | null }
        : { borrowAmount: resetAmount, borrowDeltaSign: 1 as DeltaSign, borrowDeltaRawUsd: null as number | null };
      actions.updateReserve(reserveId, clearPatch);
      return;
    }
    const patch = side === 'supply'
      ? { supplyAmount: formattedValue }
      : { borrowAmount: formattedValue };
    if (!hasWallet) {
      actions.updateReserve(reserveId, patch);
      return;
    }
    const absDeltaUsd = parseNumberInput(formattedValue);
    const sign = isPositiveDelta ? 1 : -1;
    const effectiveUsd = Math.max(sideData.walletValue! + sign * absDeltaUsd, 0);
    const signPatch = side === 'supply'
      ? { supplyDeltaSign: sign as DeltaSign }
      : { borrowDeltaSign: sign as DeltaSign };
    const amountValue = sideData.inputMode === 'usd'
      ? formatConvertedAmount(effectiveUsd)
      : (tokenPriceInUsd != null ? formatConvertedAmount(effectiveUsd / tokenPriceInUsd) : formatConvertedAmount(effectiveUsd));
    const amountPatch = side === 'supply'
      ? { supplyAmount: amountValue }
      : { borrowAmount: amountValue };
    const deltaRawUsdPatch = side === 'supply'
      ? { supplyDeltaRawUsd: sign * absDeltaUsd as number | null }
      : { borrowDeltaRawUsd: sign * absDeltaUsd as number | null };
    actions.updateReserve(reserveId, { ...signPatch, ...amountPatch, ...deltaRawUsdPatch });
  }, [hasWallet, isPositiveDelta, actions, reserveId, side, sideData.walletValue, sideData.inputMode, tokenPriceInUsd]);

  const numberInput = useDebouncedInput({
    value: deltaDisplay,
    onCommit: handleDeltaCommit,
    debounceMs: 0,
  });

  const toggleDeltaSign = useCallback(() => {
    if (!hasWallet) return;
    if (sideData.inputMode === 'token' && tokenPriceInUsd == null) return;
    const newSign: DeltaSign = isPositiveDelta ? -1 : 1;
    const signPatch = side === 'supply'
      ? { supplyDeltaSign: newSign }
      : { borrowDeltaSign: newSign };
    const currentEffectiveUsd = sideData.inputMode === 'usd'
      ? parseNumberInput(sideData.amount)
      : parseNumberInput(sideData.amount) * tokenPriceInUsd!;
    const walletValue = sideData.walletValue ?? 0;
    const absDeltaUsd = Math.abs(currentEffectiveUsd - walletValue);
    if (absDeltaUsd < DELTA_EPSILON) {
      actions.updateReserve(reserveId, signPatch);
      return;
    }
    const newEffectiveUsd = Math.max(walletValue + newSign * absDeltaUsd, 0);
    const amountValue = sideData.inputMode === 'usd'
      ? formatConvertedAmount(newEffectiveUsd)
      : formatConvertedAmount(newEffectiveUsd / tokenPriceInUsd!);
    const amountPatch = side === 'supply'
      ? { supplyAmount: amountValue }
      : { borrowAmount: amountValue };
    const newDeltaRawUsd = sideData.deltaRawUsd !== undefined ? -sideData.deltaRawUsd : newSign * absDeltaUsd;
    const deltaRawUsdPatch = side === 'supply'
      ? { supplyDeltaRawUsd: newDeltaRawUsd as number | null }
      : { borrowDeltaRawUsd: newDeltaRawUsd as number | null };
    actions.updateReserve(reserveId, { ...signPatch, ...amountPatch, ...deltaRawUsdPatch });
  }, [hasWallet, isPositiveDelta, actions, reserveId, side, sideData.walletValue, sideData.amount, sideData.inputMode, tokenPriceInUsd, sideData.deltaRawUsd]);

  const handleToggleInputMode = useCallback(() => {
    const newMode: PortfolioInputMode = sideData.inputMode === 'usd' ? 'token' : 'usd';
    const patch = side === 'supply'
      ? { supplyInputMode: newMode }
      : { borrowInputMode: newMode };
    actions.updateReserve(reserveId, patch, tokenPriceInUsd);
  }, [sideData.inputMode, actions, reserveId, side, tokenPriceInUsd]);

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 opacity-40 cursor-not-allowed">
            <span className={cn('shrink-0 ds-text-12 font-semibold', isMobile ? 'w-10' : 'w-11', labelColor)}>
              {sideLabel}
            </span>
            <span className="shrink-0 rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 ds-text-10 font-semibold text-muted-foreground">
              {sideData.inputMode === 'usd' ? '$' : 'T'}
            </span>
            <input
              value={sideData.amount}
              readOnly
              placeholder="—"
              className={cn(
                'h-[var(--ds-chip-h)] w-full min-w-[4rem] rounded-md ds-text-12 tabular-nums placeholder:italic cursor-not-allowed',
                'border border-border/30 bg-muted/30 text-muted-foreground',
              )}
              aria-label={`${sideLabel} (disabled) for ${tokenSymbol}`}
            />
          </div>
        </TooltipTrigger>
        {disabledNotice && (
          <TooltipContent side="top" className="ds-text-11">
            {disabledNotice}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

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
            onClick={handleToggleInputMode}
            className={cn(
              'shrink-0 rounded border border-border/40 bg-muted/60 px-1.5 py-0.5 ds-text-10 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              tokenPriceInUsd === undefined && 'opacity-40 cursor-not-allowed hover:bg-muted/60 hover:text-muted-foreground',
            )}
            aria-label={`Switch to ${sideData.inputMode === 'usd' ? 'token' : 'USD'} input`}
          >
            {sideData.inputMode === 'usd' ? '$' : 'T'}
          </button>
        </TooltipTrigger>
        {tokenPriceInUsd === undefined && (
          <TooltipContent side="top" className="ds-text-11">
            Price unavailable for this position
          </TooltipContent>
        )}
      </Tooltip>
      {hasWallet && (() => {
        const effectiveUsdForSign = sideData.deltaRawUsd !== undefined
          ? sideData.walletValue! + sideData.deltaRawUsd
          : (sideData.inputMode === 'usd'
              ? parseNumberInput(sideData.amount)
              : parseNumberInput(sideData.amount) * (tokenPriceInUsd ?? 0));
        const effectiveDisplay = sideData.inputMode === 'usd'
          ? formatNumberInput(formatConvertedAmount(effectiveUsdForSign))
          : sideData.amount;
        const deltaUsdForSign = effectiveUsdForSign - sideData.walletValue!;
        const priceUnavailable = sideData.inputMode !== 'usd' && tokenPriceInUsd === undefined;
        const isModified = !priceUnavailable && Math.abs(deltaUsdForSign) >= 0.005;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'shrink-0 ds-text-10 tabular-nums',
                  isModified ? 'text-foreground' : 'text-muted-foreground/70',
                )}
                aria-label={`Effective amount, wallet: ${formatNumberInput(formatConvertedAmount(sideData.walletValue!))}`}
              >
                {effectiveDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="ds-text-11">
              Wallet: {formatNumberInput(formatConvertedAmount(sideData.walletValue!))}
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
          ref={numberInput.inputRef}
          value={numberInput.displayValue}
          onChange={numberInput.handleChange}
          onFocus={numberInput.handleFocus}
          onBlur={numberInput.handleBlur}
          inputMode="decimal"
          placeholder={hasWallet ? '' : (sideData.inputMode === 'usd' ? '10,000' : '100')}
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
            onClick={() => handleDeltaCommit('')}
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
  entry,
  actions,
  reserveId,
  tokenPriceInUsd,
  disabledNotice,
}: PortfolioTokenRowProps) {
  const isMobile = useIsMobile();
  const chainSrc = getChainIconSrc(entry.chainName);
  const marketLabel = getMarketChipLabel(entry.marketName, entry.chainName);
  const showV4 = isV4Market(entry.marketName);
  const hubChipClass = getHubChipClass(showV4);
  const isHidden = entry.hidden;

  const hasWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;

  const handleMinusClick = useCallback(() => {
    if (isHidden) {
      actions.unhideReserve(reserveId);
    } else if (hasWallet) {
      actions.hideReserve(reserveId);
    } else {
      actions.removeReserve(reserveId);
    }
  }, [isHidden, hasWallet, actions, reserveId]);

  const isRestricted = entry.restrictedStatus != null;

  const restrictedIcon = (() => {
    switch (entry.restrictedStatus) {
      case 'frozen': return <Snowflake className="size-3.5 text-sky-500" aria-hidden />;
      case 'paused': return <PauseCircle className="size-3.5 ds-text-paused" aria-hidden />;
      case 'inactive': return <Ban className="size-3.5 ds-text-paused" aria-hidden />;
      default: return null;
    }
  })();

  const minusBtn = (
    <button
      type="button"
      onClick={isRestricted ? undefined : handleMinusClick}
      className={cn(
        'shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors',
        !isRestricted && PORTFOLIO_THEME.trashHoverBg,
        !isRestricted && PORTFOLIO_THEME.trashHoverText,
      )}
      aria-label={isRestricted ? `${entry.tokenSymbol} is restricted` : isHidden ? `Restore ${entry.tokenSymbol}` : `Remove ${entry.tokenSymbol} from portfolio`}
    >
      {isRestricted ? restrictedIcon : isHidden ? <EyeOff className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />}
    </button>
  );

  const tokenSymbol = entry.tokenSymbol;

  if (isMobile) {
    return (
      <div
        data-reserve-id={reserveId}
        className={cn(
          'grid grid-cols-subgrid col-span-2 items-center gap-x-1 rounded-lg border transition-colors',
          isHidden
            ? 'border-border/20 bg-muted/5 opacity-40 hover:opacity-60'
            : 'border-border/50 bg-card/80 hover:border-border',
          isHidden && !isRestricted && 'cursor-pointer',
        )}
        onClick={isHidden && !isRestricted ? () => actions.unhideReserve(reserveId) : undefined}
      >
        <div className="flex min-w-0 items-center gap-1">
          {minusBtn}
          <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 leading-[1.15]">
            <span className="flex justify-center"><TokenIcon symbol={tokenSymbol} size={14} /></span>
            <span className={cn('ds-text-12 font-semibold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>{tokenSymbol}</span>
            <span className="flex justify-center">
              {chainSrc && <img src={chainSrc} alt={entry.chainName} className="size-3" />}
            </span>
            <span className="ds-text-10 text-muted-foreground truncate">{marketLabel}</span>
            {entry.hubName && (
              <>
                <span aria-hidden />
                <span className={cn('justify-self-start max-w-full -ml-1.5 truncate', hubChipClass)} title={`Hub: ${entry.hubName}`}>
                  <span className="truncate">{entry.hubName}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1">
          <SideInput sideData={entry.supply} side="supply" sideLabel="Supply" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} reserveId={reserveId} actions={actions} disabled={!!disabledNotice?.supply} disabledNotice={disabledNotice?.supply} />
          <SideInput sideData={entry.borrow} side="borrow" sideLabel="Borrow" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} reserveId={reserveId} actions={actions} disabled={!!disabledNotice?.borrow} disabledNotice={disabledNotice?.borrow} />
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div
      data-reserve-id={reserveId}
      className={cn(
        'grid grid-cols-subgrid col-span-2 items-center gap-x-1 rounded-lg border transition-colors',
        isHidden
          ? 'border-border/20 bg-muted/5 opacity-40 hover:opacity-60'
          : entry.isOrphan
            ? 'border-border/20 bg-muted/5 opacity-60'
            : 'border-border/50 bg-card/80 hover:border-border',
        isHidden && !isRestricted && 'cursor-pointer',
      )}
      onClick={isHidden && !isRestricted ? () => actions.unhideReserve(reserveId) : undefined}
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
              <img src={chainSrc} alt={entry.chainName} className="size-2.5 shrink-0 opacity-70" />
            )}
            <span className="truncate">{marketLabel}</span>
            {entry.hubName && (
              <span className={cn('shrink-0 max-w-full', hubChipClass)} title={`Hub: ${entry.hubName}`}>
                <span className="truncate">{entry.hubName}</span>
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SideInput sideData={entry.supply} side="supply" sideLabel="Supply" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} reserveId={reserveId} actions={actions} disabled={!!disabledNotice?.supply} disabledNotice={disabledNotice?.supply} />
        <SideInput sideData={entry.borrow} side="borrow" sideLabel="Borrow" tokenSymbol={tokenSymbol} tokenPriceInUsd={tokenPriceInUsd} isMobile={isMobile} reserveId={reserveId} actions={actions} disabled={!!disabledNotice?.borrow} disabledNotice={disabledNotice?.borrow} />
      </div>
    </div>
  );
});

export default PortfolioTokenRow;
