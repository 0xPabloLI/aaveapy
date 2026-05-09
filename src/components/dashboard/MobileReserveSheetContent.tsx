import { CapProgressContent } from './CapProgressRing';
import { BorrowCapProgressContent } from './BorrowCapProgressRing';
import { UtilizationContent } from './UtilizationIndicator';
import { DeficitProgressContent } from './DeficitLiquidityRing';
import { FrozenStatusContent } from './FrozenStatusBadge';

export function SupplyCapSheetContent({
  currentSize,
  cap,
  inputMode,
  tokenPrice,
  tokenSymbol,
}: {
  currentSize: number;
  cap: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}) {
  return (
    <CapProgressContent
      currentSize={currentSize}
      cap={cap}
      displayMode={inputMode}
      tokenPrice={tokenPrice}
      tokenSymbol={tokenSymbol}
    />
  );
}

export function BorrowCapSheetContent({
  borrowed,
  cap,
  availableLiquidityUsd,
  inputMode,
  tokenPrice,
  tokenSymbol,
  borrowDisabled,
}: {
  borrowed: number;
  cap: number;
  availableLiquidityUsd: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  borrowDisabled?: boolean;
}) {
  return (
    <BorrowCapProgressContent
      borrowed={borrowed}
      cap={cap}
      availableLiquidityUsd={availableLiquidityUsd}
      disabled={borrowDisabled}
      displayMode={inputMode}
      tokenPrice={tokenPrice}
      tokenSymbol={tokenSymbol}
    />
  );
}

export function UtilizationSheetContent({ current, optimal }: { current: number; optimal: number }) {
  return <UtilizationContent current={current} optimal={optimal} />;
}

export function DeficitSheetContent({
  deficitUsd,
  totalSuppliedUsd,
  deficitTokenLabel,
  inputMode,
  tokenPrice,
  tokenSymbol,
  poolExplorerUrl,
}: {
  deficitUsd: number;
  totalSuppliedUsd: number | null | undefined;
  deficitTokenLabel?: string;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  poolExplorerUrl?: string | null;
}) {
  return (
    <DeficitProgressContent
      deficitUsd={deficitUsd}
      totalSuppliedUsd={totalSuppliedUsd}
      tokenDeficitLabel={deficitTokenLabel}
      displayMode={inputMode}
      tokenPrice={tokenPrice}
      tokenSymbol={tokenSymbol}
      poolExplorerUrl={poolExplorerUrl}
    />
  );
}

export function FrozenSheetContent({ isFrozen, isPaused }: { isFrozen?: boolean; isPaused?: boolean }) {
  return <FrozenStatusContent isFrozen={isFrozen} isPaused={isPaused} />;
}