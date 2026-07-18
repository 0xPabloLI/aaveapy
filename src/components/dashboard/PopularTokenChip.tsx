/**
 * PopularTokenChip — unified chip for "popular token" suggestions in PortfolioPanel.
 *
 * Uses ReserveIdentity (compact variant) for consistent token + hub identification.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import ReserveIdentity from '@/components/primitives/ReserveIdentity';

interface PopularTokenChipProps {
  reserveId: string;
  tokenSymbol: string;
  chainId: number;
  chainName: string;
  marketName: string;
  hubName?: string;
  onAdd: (reserveId: string) => void;
}

const PopularTokenChip = memo(function PopularTokenChip({
  reserveId,
  tokenSymbol,
  chainId,
  chainName,
  marketName,
  hubName,
  onAdd,
}: PopularTokenChipProps) {
  return (
    <button
      type="button"
      onClick={() => onAdd(reserveId)}
      className={cn(
        'inline-flex h-[var(--ds-chip-h)] items-center gap-1.5 rounded-full border border-border/50 bg-card/70 px-2.5 leading-none',
        'ds-text-11 font-semibold text-foreground transition-colors duration-200 hover:bg-muted/60',
      )}
      aria-label={`Add ${tokenSymbol} on ${marketName} to portfolio`}
    >
      <ReserveIdentity
        tokenSymbol={tokenSymbol}
        chainId={chainId}
        chainName={chainName}
        marketName={marketName}
        hubName={hubName}
        variant="compact"
      />
    </button>
  );
});

export default PopularTokenChip;
