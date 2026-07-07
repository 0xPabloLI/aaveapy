import type { ReserveWithSpread } from '@/types/aave';
import { formatReserveSizeToken, formatReserveSizeUsd, formatScenarioSize } from '@/lib/formatters';
import { DEFAULT_TOKEN_DECIMALS } from '@/lib/tokenDefaults';

type ScenarioMode = 'usd' | 'token';
export type DeficitSeverity = 'neutral' | 'warning' | 'critical';

export interface DeficitDisplay {
  hasDeficit: boolean;
  deficitUsd: number | null;
  deficitTokenLabel: string | undefined;
  deficitInlineValue: string;
  deficitShareRatio: number | null;
  deficitSeverity: DeficitSeverity;
  isNeutralDeficit: boolean;
  deficitTextClass: string;
}

const TOKEN_DECIMAL_PREVIEW = 6;
const TOKEN_DECIMAL_FOR_NUMBER = 8;
const DEFICIT_WARNING_RATIO = 0.08;
const DEFICIT_CRITICAL_RATIO = 0.2;

const isPositiveFinite = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0;
const isNonNegativeFinite = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value >= 0;

const parseNonNegativeBigInt = (value: string | null | undefined): bigint | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  try {
    const parsed = BigInt(normalized);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeDecimals = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_TOKEN_DECIMALS;
  const normalized = Math.floor(Number(value));
  return Math.min(Math.max(normalized, 0), 36);
};

const unitsToDecimalString = (
  rawAmount: bigint,
  decimals: number,
  maxFractionDigits?: number
): string => {
  if (decimals <= 0) return rawAmount.toString();

  const base = 10n ** BigInt(decimals);
  const intPart = (rawAmount / base).toString();
  let fraction = (rawAmount % base).toString().padStart(decimals, '0');
  if (maxFractionDigits != null && maxFractionDigits >= 0) {
    fraction = fraction.slice(0, Math.min(maxFractionDigits, decimals));
  }
  fraction = fraction.replace(/0+$/, '');
  return fraction.length > 0 ? `${intPart}.${fraction}` : intPart;
};

const toTokenAmountNumber = (rawAmount: bigint, decimals: number): number | null => {
  const preview = unitsToDecimalString(rawAmount, decimals, TOKEN_DECIMAL_FOR_NUMBER);
  const parsed = Number(preview);
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasReserveDeficit = (reserve: Pick<ReserveWithSpread, 'deficit'>): boolean => {
  const raw = parseNonNegativeBigInt(reserve.deficit);
  return raw != null && raw > 0n;
};

export const formatReserveDeficitTokenExact = (
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals'>,
  maxFractionDigits: number = TOKEN_DECIMAL_PREVIEW
): string => {
  const raw = parseNonNegativeBigInt(reserve.deficit);
  if (raw == null || raw <= 0n) return '-';
  const decimals = normalizeDecimals(reserve.decimals);
  return unitsToDecimalString(raw, decimals, maxFractionDigits);
};

export const formatReserveDeficitTokenCompact = (
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals'>
): string => {
  const tokenAmount = getReserveDeficitTokenAmount(reserve);
  if (!isPositiveFinite(tokenAmount)) return '-';
  return formatReserveSizeToken(tokenAmount);
};

export const getReserveDeficitTokenAmount = (
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals'>
): number | null => {
  const raw = parseNonNegativeBigInt(reserve.deficit);
  if (raw == null || raw <= 0n) return null;
  const decimals = normalizeDecimals(reserve.decimals);
  return toTokenAmountNumber(raw, decimals);
};

export const getReserveDeficitUsdAmount = (
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals'>,
  tokenPrice: number | null | undefined
): number | null => {
  const tokenAmount = getReserveDeficitTokenAmount(reserve);
  if (!isPositiveFinite(tokenAmount) || !isPositiveFinite(tokenPrice)) return null;
  return tokenAmount * tokenPrice;
};

export const calculateDeficitShareRatio = ({
  deficitUsd,
  totalSuppliedUsd,
}: {
  deficitUsd: number | null | undefined;
  totalSuppliedUsd: number | null | undefined;
}): number | null => {
  if (!isPositiveFinite(deficitUsd) || !isNonNegativeFinite(totalSuppliedUsd)) return null;
  const denominator = deficitUsd + totalSuppliedUsd;
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return deficitUsd / denominator;
};

export const getDeficitSeverity = (
  ratio: number | null | undefined
): DeficitSeverity => {
  if (ratio == null || !Number.isFinite(ratio)) return 'neutral';
  if (ratio >= DEFICIT_CRITICAL_RATIO) return 'critical';
  if (ratio >= DEFICIT_WARNING_RATIO) return 'warning';
  return 'neutral';
};

const DEFICIT_TEXT_CLASSES: Record<DeficitSeverity, string> = {
  critical: 'ds-text-amber-500',
  warning: 'ds-text-amber-600',
  neutral: 'text-muted-foreground/60',
};

export function computeDeficitDisplay(
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals'>,
  tokenPrice: number | null | undefined,
  totalSuppliedUsd: number | null | undefined,
  inputMode: ScenarioMode,
): DeficitDisplay {
  const hasDeficit = hasReserveDeficit(reserve);
  const deficitUsd = getReserveDeficitUsdAmount(reserve, tokenPrice);
  const deficitTokenCompact = formatReserveDeficitTokenCompact(reserve);
  const deficitTokenLabel = deficitTokenCompact !== '-' ? deficitTokenCompact : undefined;
  const deficitInlineValue = inputMode === 'usd'
    ? (hasDeficit ? formatScenarioSize(deficitUsd!, { inputMode: 'usd' }) : '-')
    : deficitTokenCompact;
  const deficitShareRatio = calculateDeficitShareRatio({ deficitUsd, totalSuppliedUsd });
  const deficitSeverity = getDeficitSeverity(deficitShareRatio);
  const isNeutralDeficit = deficitSeverity === 'neutral';
  const deficitTextClass = DEFICIT_TEXT_CLASSES[deficitSeverity];
  return {
    hasDeficit,
    deficitUsd,
    deficitTokenLabel,
    deficitInlineValue,
    deficitShareRatio,
    deficitSeverity,
    isNeutralDeficit,
    deficitTextClass,
  };
}

export const formatReserveDeficitModeValue = (
  reserve: Pick<ReserveWithSpread, 'deficit' | 'decimals' | 'tokenSymbol'>,
  mode: ScenarioMode,
  tokenPrice: number | null | undefined
): string => {
  const tokenAmount = getReserveDeficitTokenAmount(reserve);
  if (!isPositiveFinite(tokenAmount)) return '-';

  if (mode === 'token') {
    return `${formatReserveSizeToken(tokenAmount)} ${reserve.tokenSymbol}`;
  }

  const usd = getReserveDeficitUsdAmount(reserve, tokenPrice);
  if (isPositiveFinite(usd)) {
    return formatReserveSizeUsd(usd);
  }
  return `${formatReserveSizeToken(tokenAmount)} ${reserve.tokenSymbol}`;
};
