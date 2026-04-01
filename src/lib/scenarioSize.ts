import { parseNumberInput } from './numberFormat';

export type ScenarioDisplayMode = 'usd' | 'token';

export const getValidTokenPrice = (...candidates: Array<number | null | undefined>): number | null => {
  for (const candidate of candidates) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return null;
};

export const getScenarioInputUsd = ({
  rawInput,
  inputMode,
  tokenPrice,
}: {
  rawInput: string;
  inputMode: ScenarioDisplayMode;
  tokenPrice?: number | null;
}): number => {
  const parsed = parseNumberInput(rawInput);
  if (parsed <= 0) return 0;
  if (inputMode === 'usd') return parsed;
  return tokenPrice != null && Number.isFinite(tokenPrice) && tokenPrice > 0 ? parsed * tokenPrice : 0;
};

export const getScenarioSupplySizeUsd = ({
  reserveSizeUsd,
  supplyCapUsd,
  rawSupplyInput,
  inputMode,
  tokenPrice,
}: {
  reserveSizeUsd: number | null | undefined;
  supplyCapUsd: number | null | undefined;
  rawSupplyInput: string;
  inputMode: ScenarioDisplayMode;
  tokenPrice?: number | null;
}): number | null => {
  if (reserveSizeUsd == null || !Number.isFinite(reserveSizeUsd)) return reserveSizeUsd ?? null;

  const supplyInputUsd = getScenarioInputUsd({
    rawInput: rawSupplyInput,
    inputMode,
    tokenPrice,
  });
  if (supplyInputUsd <= 0) return reserveSizeUsd;

  const rawAfterSize = reserveSizeUsd + supplyInputUsd;
  if (supplyCapUsd != null && Number.isFinite(supplyCapUsd) && supplyCapUsd > 0 && rawAfterSize > supplyCapUsd) {
    // Never shrink the displayed pool size when the current reserve is already above cap.
    // In that case, additional scenario input should keep the displayed size at least at current.
    return Math.max(reserveSizeUsd, supplyCapUsd);
  }

  return rawAfterSize;
};

export const getTotalBorrowedUsd = ({
  reserveSizeUsd,
  utilizationPct,
}: {
  reserveSizeUsd: number | null | undefined;
  utilizationPct: number | null | undefined;
}): number | null => {
  if (
    reserveSizeUsd == null ||
    utilizationPct == null ||
    !Number.isFinite(reserveSizeUsd) ||
    !Number.isFinite(utilizationPct)
  ) {
    return null;
  }

  return reserveSizeUsd * (utilizationPct / 100);
};

export const getPoolLiquidityUsd = ({
  reserveSizeUsd,
  totalBorrowedUsd,
}: {
  reserveSizeUsd: number | null | undefined;
  totalBorrowedUsd: number | null | undefined;
}): number | null => {
  if (
    reserveSizeUsd == null ||
    totalBorrowedUsd == null ||
    !Number.isFinite(reserveSizeUsd) ||
    !Number.isFinite(totalBorrowedUsd)
  ) {
    return null;
  }

  return reserveSizeUsd - totalBorrowedUsd;
};

export const getAvailableToBorrowUsd = ({
  borrowedUsd,
  borrowCapUsd,
  poolLiquidityUsd,
}: {
  borrowedUsd: number | null | undefined;
  borrowCapUsd: number | null | undefined;
  poolLiquidityUsd: number | null | undefined;
}): number | null => {
  const capRemaining =
    borrowCapUsd != null && Number.isFinite(borrowCapUsd) && borrowCapUsd > 0
      ? Math.max(0, borrowCapUsd - (borrowedUsd ?? 0))
      : null;
  const liquidityRemaining =
    poolLiquidityUsd != null && Number.isFinite(poolLiquidityUsd) ? poolLiquidityUsd : null;

  if (capRemaining === null && liquidityRemaining === null) return null;
  if (capRemaining === null) return liquidityRemaining;
  if (liquidityRemaining === null) return capRemaining;
  return Math.min(capRemaining, liquidityRemaining);
};
