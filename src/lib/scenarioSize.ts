import { parseNumberInput } from './numberFormat';
import type { ProtocolVersion } from './protocolVersion';

export type ScenarioDisplayMode = 'usd' | 'token';

export const nativeToUsd = (
  raw: string | null | undefined,
  decimals: number | null | undefined,
  tokenPrice: number | null | undefined,
): number | null => {
  if (!raw) return null;
  if (decimals == null || !Number.isFinite(decimals) || decimals < 0) return null;
  if (tokenPrice == null || !Number.isFinite(tokenPrice) || tokenPrice <= 0) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  const tokens = value / Math.pow(10, decimals);
  return tokens * tokenPrice;
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
 * For V4, this is a Reserve-level value (per-Spoke). Do NOT derive from
 * `reserveSizeUsd * utilizationPct / 100` because reserveSize is
 * Reserve-level while utilizationPct is Hub-level — cross-layer
 * (see Hub vs Reserve boundary comment above).
 *
 * Returns `null` when any required input is missing/invalid so callers can fall
 * back to the derived calculation (V3 only).
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
 * Compute current available liquidity (USD) directly from the reserve's on-chain
 * `availableLiquidity` field (raw token units). This is the source of truth
 * from the Aave Pool / Spoke contract and matches what users see on
 * app.aave.com / pro.aave.com.
 *
 * For V4, availableLiquidity is Hub-level (free liquidity shared across Spokes).
 * Do NOT derive from `reserveSizeUsd - totalBorrowedUsd` — even though both
 * reserveSize and totalVariableDebt are Reserve-level (same-layer), the result
 * of that subtraction is a per-Spoke remainder, NOT the Hub-level
 * availableLiquidity. They are fundamentally different quantities in V4's
 * architecture (see Hub vs Reserve boundary comment above).
 *
 * Returns `null` when any required input is missing/invalid so callers can fall
 * back to the derived calculation (V3 only).
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

export const getDerivedAvailableLiquidityUsd = ({
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
  availableLiquidityUsd,
}: {
  borrowedUsd: number | null | undefined;
  borrowCapUsd: number | null | undefined;
  availableLiquidityUsd: number | null | undefined;
}): number | null => {
  const capRemaining =
    borrowCapUsd != null && Number.isFinite(borrowCapUsd) && borrowCapUsd > 0
      ? Math.max(0, borrowCapUsd - (borrowedUsd ?? 0))
      : null;
  const liquidityRemaining =
    availableLiquidityUsd != null && Number.isFinite(availableLiquidityUsd) ? availableLiquidityUsd : null;

  if (capRemaining === null && liquidityRemaining === null) return null;
  if (capRemaining === null) return liquidityRemaining;
  if (liquidityRemaining === null) return capRemaining;
  return Math.min(capRemaining, liquidityRemaining);
};

/* ─── V4-aware unified display functions ───
 *
 * ## Hub-level vs Reserve-level data boundary
 *
 * Aave V4 introduces a Hub & Spoke architecture where fields belong to two
 * distinct semantic layers. Per docs/v3-v4-sdk-field-mapping.md:
 *
 *   Hub-level (from r.asset.summary / r.asset.settings, shared across Spokes):
 *     utilizationPct, availableLiquidity, supplyApy, borrowApy,
 *     reserveFactor, variableRateSlope1/2, optimalUsageRate, baseVariableBorrowRate
 *
 *   Reserve-level (from r.summary / r.settings, per-Spoke):
 *     reserveSize (supplied), supplyCap, borrowCap, totalVariableDebt,
 *     suppliable (派生: supplyCap - reserveSize, same-layer),
 *     borrowable (派生: min(borrowCap-debt, availableLiquidity), cross-layer)
 *
 * Cross-layer mixing rule:
 *   - supplyCap(reserve) - reserveSize(reserve) → same-layer, safe for V4
 *   - borrowCap(reserve) - totalVariableDebt(reserve) → same-layer, safe for V4
 *   - min(borrowCapRemaining(reserve), availableLiquidity(hub)) → valid for V4
 *     (verified against on-chain data, except when borrowDisabled=true)
 *   - reserveSize(reserve) * utilizationPct(hub) → cross-layer for V4,
 *     unreliable when reserveSize is a per-Spoke slice
 *
 * ## Fallback policy
 *
 * V3: All fields are Pool-level (single layer), so on-chain ?? derived is safe.
 * V4: On-chain field only — derived fallbacks that involve cross-layer
 *     reserveSize × utilizationPct are invalid. Return null (display "—" in UI).
 *
 * All three display functions share the same pattern:
 *   1. Try on-chain source of truth
 *   2. If null AND V3: fall back to derived calculation (same-layer, safe)
 *   3. If null AND V4: return null (unreliable or cross-layer derivation)
 */

/**
 * V4-aware total borrowed (USD).
 * V3: on-chain totalVariableDebt ?? reserveSizeUsd * utilizationPct / 100
 *     (V3: both Pool-level, safe)
 * V4: on-chain totalVariableDebt only (no derived fallback —
 *     reserveSize(Reserve) * utilizationPct(Hub) is cross-layer)
 */
export const getDisplayTotalBorrowedUsd = (
  reserve: {
    totalVariableDebt?: string | null;
    decimals?: number | null;
    tokenPrice?: number | null;
    reserveSize?: string | null;
    utilizationPct?: number | null;
  },
  protocolVersion: ProtocolVersion,
): number | null => {
  const onChain = getReserveTotalBorrowedUsd(reserve);
  if (onChain != null) return onChain;
  // V4: cross-layer — reserveSize(Reserve) × utilizationPct(Hub)
  if (protocolVersion === 'v4') return null;
  const reserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
  return getTotalBorrowedUsd({
    reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
};

/**
 * V4-aware available liquidity (USD).
 * V3: on-chain availableLiquidity ?? reserveSizeUsd - totalBorrowedUsd
 *     (V3: both Pool-level, safe)
 * V4: on-chain availableLiquidity only (no derived fallback —
 *     availableLiquidity is Hub-level while reserveSize - totalBorrowed
 *     is per-Spoke, fundamentally different quantities in V4)
 */
export const getDisplayAvailableLiquidityUsd = (
  reserve: {
    availableLiquidity?: string | null;
    totalVariableDebt?: string | null;
    decimals?: number | null;
    tokenPrice?: number | null;
    reserveSize?: string | null;
    utilizationPct?: number | null;
  },
  protocolVersion: ProtocolVersion,
): number | null => {
  const onChain = getReserveAvailableLiquidityUsd(reserve);
  if (onChain != null) return onChain;
  // V4: availableLiquidity is Hub-level; reserveSize - totalBorrowed is per-Spoke
  if (protocolVersion === 'v4') return null;
  const reserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
  const totalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  return getDerivedAvailableLiquidityUsd({
    reserveSizeUsd,
    totalBorrowedUsd,
  });
};

/**
 * V4-aware reserve supply size (USD).
 * V3/V4: reserveSizeUsd (Reserve-level, per-Spoke) + scenario input
 */
export const getDisplayReserveSizeUsd = (
  reserve: {
    reserveSize?: string | null;
    decimals?: number | null;
    tokenPrice?: number | null;
    supplyCap?: string | null;
  },
  protocolVersion: ProtocolVersion,
  scenarioInput?: {
    rawSupplyInput: string;
    inputMode: ScenarioDisplayMode;
    tokenPrice?: number | null;
  },
): number | null => {
  const reserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
  if (reserveSizeUsd == null || !Number.isFinite(reserveSizeUsd)) return reserveSizeUsd ?? null;

  if (!scenarioInput) return reserveSizeUsd;
  return getScenarioSupplySizeUsd({
    reserveSizeUsd,
    supplyCapUsd: nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice),
    rawSupplyInput: scenarioInput.rawSupplyInput,
    inputMode: scenarioInput.inputMode,
    tokenPrice: scenarioInput.tokenPrice,
  });
};

/**
 * Suppliable USD — how much more can be supplied.
 * Both Reserve-level: supplyCap and reserveSize are per-Spoke.
 *
 * API priority: reserve.suppliable (native token units).
 * Fallback: supplyCap - reserveSize (same-layer, safe for V4).
 *
 * Result is clamped to ≥ 0 (Math.max).
 */
export const getSuppliableUsd = (reserve: {
  suppliable?: string | null;
  supplyCap?: string | null;
  reserveSize?: string | null;
  decimals?: number | null;
  tokenPrice?: number | null;
  supplyDisabled?: boolean;
}): number | null => {
  if (reserve.supplyDisabled) return 0;
  const fromApi = nativeToUsd(reserve.suppliable, reserve.decimals, reserve.tokenPrice);
  if (fromApi != null) return Math.max(0, fromApi);
  const supplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice);
  const reserveSizeUsd = nativeToUsd(reserve.reserveSize, reserve.decimals, reserve.tokenPrice);
  if (supplyCapUsd == null || !Number.isFinite(supplyCapUsd) || supplyCapUsd <= 0) return null;
  if (reserveSizeUsd == null || !Number.isFinite(reserveSizeUsd)) return null;
  return Math.max(0, supplyCapUsd - reserveSizeUsd);
};

/**
 * Borrowable USD — how much more can be borrowed.
 *
 * API priority: reserve.borrowable (native token units).
 * Fallback: min(borrowCap - totalVariableDebt, availableLiquidity).
 *   Valid for both V3 and V4 (verified against on-chain data).
 *
 * Result is clamped to ≥ 0 via getAvailableToBorrowUsd (Math.max).
 */
export const getBorrowableUsd = (reserve: {
  borrowable?: string | null;
  borrowCap?: string | null;
  totalVariableDebt?: string | null;
  availableLiquidity?: string | null;
  decimals?: number | null;
  tokenPrice?: number | null;
  borrowDisabled?: boolean;
}): number | null => {
  if (reserve.borrowDisabled) return 0;
  const fromApi = nativeToUsd(reserve.borrowable, reserve.decimals, reserve.tokenPrice);
  if (fromApi != null) return Math.max(0, fromApi);
  const borrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice);
  const borrowedUsd = nativeToUsd(reserve.totalVariableDebt, reserve.decimals, reserve.tokenPrice);
  const availableLiquidityUsd = nativeToUsd(reserve.availableLiquidity, reserve.decimals, reserve.tokenPrice);
  return getAvailableToBorrowUsd({ borrowedUsd, borrowCapUsd, availableLiquidityUsd });
};
