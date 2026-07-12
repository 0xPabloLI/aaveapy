/**
 * Smart-format a percentage value with controlled display length.
 * - < 100:      2 decimals (e.g. 5.67%)
 * - 100-999:    1 decimal  (e.g. 123.4%)
 * - 1K-9.99K:  0 decimals + K (e.g. 12K%)
 * - >= 10K:     capped display (e.g. >10K% / <-10K%)
 */
const PERCENT_K_CAP = 10;

function smartPercent(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const absValue = Math.abs(value);
  if (absValue >= 10_000) return `${value < 0 ? '<-' : '>'}${PERCENT_K_CAP}K%`;
  if (absValue >= 1_000) {
    return `${Math.round(value / 1_000)}K%`;
  }
  if (absValue >= 100) {
    return `${value.toFixed(1)}%`;
  }
  return `${value.toFixed(2)}%`;
}

export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return smartPercent(value);
};

export const formatSpread = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value > 0 ? '+' : ''}${smartPercent(value)}`;
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export const formatUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value >= 1000) {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + value.toFixed(2);
};

/** USD with leading + / − (Unicode minus) for signed cashflows; null/NaN → em dash. */
export function formatSignedUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatUsd(Math.abs(value))}`;
}

/** Signed reserve-size USD with +/− prefix and K/M/B abbreviation; null/NaN → em dash. */
export function formatSignedReserveSizeUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatReserveSizeUsd(Math.abs(value))}`;
}

export const formatReserveSizeUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1_000_000_000) {
    return sign + '$' + (absValue / 1_000_000_000).toFixed(2) + 'B';
  }
  if (absValue >= 1_000_000) {
    return sign + '$' + (absValue / 1_000_000).toFixed(2) + 'M';
  }
  if (absValue >= 1_000) {
    return sign + '$' + (absValue / 1_000).toFixed(2) + 'K';
  }
  return sign + '$' + absValue.toFixed(2);
};

export const formatReserveSizeToken = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1_000_000_000) {
    return sign + (absValue / 1_000_000_000).toFixed(2) + 'B';
  }
  if (absValue >= 1_000_000) {
    return sign + (absValue / 1_000_000).toFixed(2) + 'M';
  }
  if (absValue >= 1_000) {
    return sign + (absValue / 1_000).toFixed(2) + 'K';
  }
  return sign + absValue.toFixed(2);
};

export function formatSignedScenarioDailyCashflow(
  valueUsd: number | null | undefined,
  options: { inputMode?: 'usd' | 'token'; tokenPrice?: number | null } = {},
): string {
  const { inputMode = 'usd', tokenPrice } = options;
  if (valueUsd === null || valueUsd === undefined || Number.isNaN(valueUsd)) return '—';
  if (inputMode === 'usd') {
    return formatSignedReserveSizeUsd(valueUsd);
  }
  if (
    tokenPrice === null ||
    tokenPrice === undefined ||
    !Number.isFinite(tokenPrice) ||
    tokenPrice <= 0
  ) {
    return '—';
  }
  const tokenAmount = valueUsd / tokenPrice;
  const sign = tokenAmount > 0 ? '+' : tokenAmount < 0 ? '−' : '';
  return `${sign}${formatReserveSizeToken(Math.abs(tokenAmount))}`;
}

interface FormatScenarioSizeOptions {
  inputMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}

export const formatScenarioSize = (
  value: number | null | undefined,
  {
    inputMode = 'usd',
    tokenPrice,
  }: FormatScenarioSizeOptions = {}
): string => {
  if (inputMode === 'usd') {
    return formatReserveSizeUsd(value);
  }
  if (
    value === null ||
    value === undefined ||
    isNaN(value) ||
    tokenPrice === null ||
    tokenPrice === undefined ||
    !Number.isFinite(tokenPrice) ||
    tokenPrice <= 0
  ) {
    return '-';
  }

  return formatReserveSizeToken(value / tokenPrice);
};

export const formatScenarioSizeDelta = (
  value: number | null | undefined,
  options: FormatScenarioSizeOptions = {}
): string => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatScenarioSize(value, options)}`;
};

export const formatTvl = formatReserveSizeUsd;
export const formatSupplyUsd = formatReserveSizeUsd;
