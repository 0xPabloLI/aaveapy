export type SortOrder = 'asc' | 'desc';

export const isValidNumber = (value: number): boolean => Number.isFinite(value);

export const compareNumbers = (a: number, b: number, order: SortOrder): number => {
  if (a === b) return 0;
  const diff = b - a;
  return order === 'desc' ? diff : -diff;
};

export const compareNullableNumbers = (a: number | null, b: number | null, order: SortOrder): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareNumbers(a, b, order);
};

export const compareSizeToCapPct = (
  aSize: number | null,
  bSize: number | null,
  aCap: number | null,
  bCap: number | null,
  order: SortOrder,
): number => {
  const aPct = aSize != null && aCap != null && aCap > 0 ? (aSize / aCap) * 100 : null;
  const bPct = bSize != null && bCap != null && bCap > 0 ? (bSize / bCap) * 100 : null;

  if (aPct === null && bPct === null) return 0;
  if (aPct === null) return 1;
  if (bPct === null) return -1;

  const diff = bPct - aPct;
  if (diff === 0) {
    const aAbs = aSize ?? 0;
    const bAbs = bSize ?? 0;
    const sizeDiff = bAbs - aAbs;
    return order === 'desc' ? sizeDiff : -sizeDiff;
  }
  return order === 'desc' ? diff : -diff;
};

export const compareIncentiveWithNative = (
  aIncentive: number | null | undefined,
  bIncentive: number | null | undefined,
  aNative: number | null,
  bNative: number | null,
  order: SortOrder,
  aHasIncentiveSource?: boolean,
  bHasIncentiveSource?: boolean,
): number => {
  if (
    typeof aHasIncentiveSource === 'boolean' &&
    typeof bHasIncentiveSource === 'boolean' &&
    aHasIncentiveSource !== bHasIncentiveSource
  ) {
    // Business rule: any reserve with incentive source stays ahead of those without,
    // even when simulated incentive value drops to zero.
    return aHasIncentiveSource ? -1 : 1;
  }

  // undefined normalizes exactly like null (sorted last) — pinned by the
  // "sorts undefined incentive as null" test.
  const normalizeIncentive = (v: number | null | undefined): number | null =>
    v != null && isValidNumber(v) ? v : null;
  const normalizedAIncentive = normalizeIncentive(aIncentive);
  const normalizedBIncentive = normalizeIncentive(bIncentive);

  if (normalizedAIncentive !== null && normalizedBIncentive !== null) {
    const incentiveComparison = compareNumbers(normalizedAIncentive, normalizedBIncentive, order);
    if (incentiveComparison !== 0) return incentiveComparison;
  }
  if (normalizedAIncentive === null && normalizedBIncentive !== null) return 1;
  if (normalizedAIncentive !== null && normalizedBIncentive === null) return -1;

  return compareNullableNumbers(aNative, bNative, order);
};
