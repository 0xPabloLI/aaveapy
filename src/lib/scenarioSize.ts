import { parseNumberInput } from './numberFormat';
import type { ProtocolVersion } from './protocolVersion';

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

export const convertUsdToInputValue = (
  usd: number,
  inputMode: ScenarioDisplayMode,
  tokenPrice: number | null | undefined,
): string => {
  if (usd <= 0) return '';
  if (inputMode === 'token' && tokenPrice != null && Number.isFinite(tokenPrice) && tokenPrice > 0) {
    return String(usd / tokenPrice);
  }
  return String(usd);
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

/**
 * Compute total borrowed (USD) directly from the reserve's on-chain
 * `totalVariableDebt` field (raw token units). This is the source of truth
 * from the Aave Pool / Spoke contract and matches what users see on
 * app.aave.com / pro.aave.com.
 *
 * Prefer this over deriving borrowed from `reserveSizeUsd * (utilizationPct / 100)`,
 * because for V4 markets `reserveSizeUsd` can be 0 or reflect only a sub-component
 * of the Hub & Spoke aggregate, making the derived value wildly inaccurate
 * (e.g. AaveV4Bluechip USDT where reserveSizeUsd=0 but actual borrowed ≈ $1.037B).
 *
 * Returns `null` when any required input is missing/invalid so callers can fall
 * back to the derived calculation.
 */
export const getReserveTotalBorrowedUsd = (reserve: {
  totalVariableDebt?: string | null;
  decimals?: number | null;
  tokenPrice?: number | null;
}): number | null => {
  const { totalVariableDebt, decimals, tokenPrice } = reserve;
  if (!totalVariableDebt) return null;
  if (decimals == null || !Number.isFinite(decimals) || decimals < 0) return null;
  if (tokenPrice == null || !Number.isFinite(tokenPrice) || tokenPrice <= 0) return null;
  const raw = Number(totalVariableDebt);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const tokens = raw / Math.pow(10, decimals);
  return tokens * tokenPrice;
};

/**
 * Compute current pool liquidity (USD) directly from the reserve's on-chain
 * `availableLiquidity` field (raw token units). This is the source of truth
 * from the Aave Pool / Spoke contract and matches what users see on
 * app.aave.com / pro.aave.com.
 *
 * Prefer this over deriving liquidity from `reserveSizeUsd * (1 - utilization)`,
 * because for V4 markets `reserveSizeUsd` is the per-Spoke supply slice while
 * `availableLiquidity` is the Hub-level free liquidity (shared across Spokes).
 * Mixing them yields a Spoke-sized fraction of the Hub liquidity and can be off
 * by orders of magnitude (see e.g. AaveV4Forex USDT, where derived ≈ $5.7k but
 * on-chain ≈ $76.6k). Used unified for V3 and V4.
 *
 * See `docs/rate-calculation.md` → "Pool Liquidity Source of Truth (V3 + V4)".
 *
 * Returns `null` when any required input is missing/invalid so callers can fall
 * back to the derived calculation.
 */
export const getReserveAvailableLiquidityUsd = (reserve: {
  availableLiquidity?: string | null;
  decimals?: number | null;
  tokenPrice?: number | null;
}): number | null => {
  const { availableLiquidity, decimals, tokenPrice } = reserve;
  if (!availableLiquidity) return null;
  if (decimals == null || !Number.isFinite(decimals) || decimals < 0) return null;
  if (tokenPrice == null || !Number.isFinite(tokenPrice) || tokenPrice <= 0) return null;
  const raw = Number(availableLiquidity);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const tokens = raw / Math.pow(10, decimals);
  return tokens * tokenPrice;
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

/* ─── V4-aware unified display functions ───
 *
 * V3: on-chain field ?? derived fallback (reserveSizeUsd-based) — both are reliable.
 * V4: on-chain field only — derived fallback is UNSAFE because reserveSizeUsd
 *      can be 0 or a per-Spoke slice, making reserveSizeUsd * utilizationPct / 100
 *      and reserveSizeUsd - totalBorrowed wildly inaccurate.
 *
 * All three functions share the same pattern:
 *   1. Try on-chain source of truth (totalVariableDebt / availableLiquidity / reserveSizeUsd)
 *   2. If null AND V3: fall back to derived calculation
 *   3. If null AND V4: return null (display "—" in UI)
 */

/**
 * V4-aware total borrowed (USD).
 * V3: on-chain totalVariableDebt ?? reserveSizeUsd * utilizationPct / 100
 * V4: on-chain totalVariableDebt only (no derived fallback)
 */
export const getDisplayTotalBorrowedUsd = (
  reserve: {
    totalVariableDebt?: string | null;
    decimals?: number | null;
    tokenPrice?: number | null;
    reserveSizeUsd?: number | null;
    utilizationPct?: number | null;
  },
  protocolVersion: ProtocolVersion,
): number | null => {
  const onChain = getReserveTotalBorrowedUsd(reserve);
  if (onChain != null) return onChain;
  // V4: derived fallback is unsafe — reserveSizeUsd may be 0 or a Spoke slice
  if (protocolVersion === 'v4') return null;
  return getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
};

/**
 * V4-aware pool liquidity (USD).
 * V3: on-chain availableLiquidity ?? reserveSizeUsd - totalBorrowedUsd
 * V4: on-chain availableLiquidity only (no derived fallback)
 */
export const getDisplayPoolLiquidityUsd = (
  reserve: {
    availableLiquidity?: string | null;
    totalVariableDebt?: string | null;
    decimals?: number | null;
    tokenPrice?: number | null;
    reserveSizeUsd?: number | null;
    utilizationPct?: number | null;
  },
  protocolVersion: ProtocolVersion,
): number | null => {
  const onChain = getReserveAvailableLiquidityUsd(reserve);
  if (onChain != null) return onChain;
  // V4: derived fallback is unsafe — reserveSizeUsd is per-Spoke, not Hub aggregate
  if (protocolVersion === 'v4') return null;
  const totalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  return getPoolLiquidityUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    totalBorrowedUsd,
  });
};

/**
 * V4-aware reserve supply size (USD).
 * V3: reserveSizeUsd (reliable Pool-level aggregate) + scenario input
 * V4: reserveSizeUsd only if non-zero and plausible; otherwise null.
 *      For V4, reserveSizeUsd=0 means the Hub aggregate is not available,
 *      so showing 0 is misleading — return null instead.
 */
export const getDisplayReserveSizeUsd = (
  reserve: {
    reserveSizeUsd?: number | null;
    supplyCapUsd?: number | null;
  },
  protocolVersion: ProtocolVersion,
  scenarioInput?: {
    rawSupplyInput: string;
    inputMode: ScenarioDisplayMode;
    tokenPrice?: number | null;
  },
): number | null => {
  const { reserveSizeUsd } = reserve;
  // V4 with reserveSizeUsd=0: the Hub aggregate is unavailable, don't show 0
  if (protocolVersion === 'v4' && (reserveSizeUsd == null || reserveSizeUsd === 0)) {
    return null;
  }
  if (reserveSizeUsd == null || !Number.isFinite(reserveSizeUsd)) return reserveSizeUsd ?? null;

  if (!scenarioInput) return reserveSizeUsd;
  return getScenarioSupplySizeUsd({
    reserveSizeUsd,
    supplyCapUsd: reserve.supplyCapUsd,
    rawSupplyInput: scenarioInput.rawSupplyInput,
    inputMode: scenarioInput.inputMode,
    tokenPrice: scenarioInput.tokenPrice,
  });
};
