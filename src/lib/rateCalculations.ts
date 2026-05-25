export const convertAprToApy = (apr: number): number => {
  const aprDecimal = apr / 100;
  const monthlyRate = aprDecimal / 12;
  const apyDecimal = Math.pow(1 + monthlyRate, 12) - 1;
  return apyDecimal * 100;
};

export const apyToApr = (apy: number): number => {
  const apyDecimal = apy / 100;
  const aprDecimal = 12 * (Math.pow(1 + apyDecimal, 1 / 12) - 1);
  return aprDecimal * 100;
};

export function annualPercentToDailyFraction(ratePercent: number, isApy: boolean): number {
  if (!Number.isFinite(ratePercent)) return Number.NaN;
  if (isApy) {
    const r = ratePercent / 100;
    return Math.pow(1 + r, 1 / 365) - 1;
  }
  return (ratePercent / 100) / 365;
}

export const calculateTotalSupplyApr = (nativeSupplyApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeSupplyApr === null || nativeSupplyApr === undefined) return null;
  if (isNaN(nativeSupplyApr) || isNaN(incentiveApr)) return null;
  return nativeSupplyApr + incentiveApr;
};

export const calculateTotalSupplyApy = (nativeSupplyApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeSupplyApy === null || nativeSupplyApy === undefined) return null;
  if (isNaN(nativeSupplyApy) || isNaN(incentiveApy)) return null;
  return nativeSupplyApy + incentiveApy;
};

export const calculateTotalBorrowApr = (nativeBorrowApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeBorrowApr === null || nativeBorrowApr === undefined) return null;
  if (isNaN(nativeBorrowApr) || isNaN(incentiveApr)) return null;
  return nativeBorrowApr - incentiveApr;
};

export const calculateTotalBorrowApy = (nativeBorrowApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeBorrowApy === null || nativeBorrowApy === undefined) return null;
  if (isNaN(nativeBorrowApy) || isNaN(incentiveApy)) return null;
  return nativeBorrowApy - incentiveApy;
};

export const calculateSpreadApr = (totalSupplyApr: number | null, totalBorrowApr: number | null): number | null => {
  if (totalSupplyApr === null || totalBorrowApr === null) return null;
  return totalSupplyApr - totalBorrowApr;
};

export const calculateSpreadApy = (totalSupplyApy: number | null, totalBorrowApy: number | null): number | null => {
  if (totalSupplyApy === null || totalBorrowApy === null) return null;
  return totalSupplyApy - totalBorrowApy;
};
