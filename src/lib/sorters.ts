type SortOrder = 'asc' | 'desc';

const isValidNumber = (value: number): boolean => Number.isFinite(value);

const hasIncentive = (value: number): boolean => isValidNumber(value) && value > 0;

const compareNumbers = (a: number, b: number, order: SortOrder): number => {
  const diff = b - a;
  return order === 'desc' ? diff : -diff;
};

const compareNullableNumbers = (a: number | null, b: number | null, order: SortOrder): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareNumbers(a, b, order);
};

export const compareIncentiveWithNative = (
  aIncentive: number,
  bIncentive: number,
  aNative: number | null,
  bNative: number | null,
  order: SortOrder
): number => {
  const aHasIncentive = hasIncentive(aIncentive);
  const bHasIncentive = hasIncentive(bIncentive);

  if (aHasIncentive !== bHasIncentive) {
    return aHasIncentive ? -1 : 1;
  }

  if (aHasIncentive && bHasIncentive) {
    const incentiveComparison = compareNumbers(aIncentive, bIncentive, order);
    if (incentiveComparison !== 0) return incentiveComparison;
  }

  return compareNullableNumbers(aNative, bNative, order);
};
