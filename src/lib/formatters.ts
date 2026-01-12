// Format decimal to percentage string
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${(value * 100).toFixed(2)}%`;
};

// Format spread with sign
export const formatSpread = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

// Format relative time
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

// Convert APY to APR
export const apyToApr = (apy: number): number => {
  // APY = (1 + APR/n)^n - 1, where n = 365 (daily compounding)
  // APR = n * ((1 + APY)^(1/n) - 1)
  const n = 365;
  return n * (Math.pow(1 + apy, 1 / n) - 1);
};

// Truncate address
export const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Calculate total Supply APR
export const calculateTotalSupplyApr = (supplyApy: string, totalIncentiveSupplyApr: number): number => {
  const nativeSupplyApr = parseFloat(supplyApy) / 100;
  if (isNaN(nativeSupplyApr)) return NaN;
  if (isNaN(totalIncentiveSupplyApr)) return NaN;
  return nativeSupplyApr + totalIncentiveSupplyApr;
};

// Calculate total Supply APY
export const calculateTotalSupplyApy = (supplyApy: string, totalIncentiveSupplyApy: number): number => {
  const nativeSupplyApy = parseFloat(supplyApy) / 100;
  if (isNaN(nativeSupplyApy)) return NaN;
  if (isNaN(totalIncentiveSupplyApy)) return NaN;
  return nativeSupplyApy + totalIncentiveSupplyApy;
};

// Calculate total Borrow APR
export const calculateTotalBorrowApr = (borrowApy: string | null, totalIncentiveBorrowApr: number): number | null => {
  if (borrowApy === null) return null;
  const nativeBorrowApr = parseFloat(borrowApy) / 100;
  if (isNaN(nativeBorrowApr)) return null;
  if (isNaN(totalIncentiveBorrowApr)) return null;
  return nativeBorrowApr - totalIncentiveBorrowApr;
};

// Calculate total Borrow APY
export const calculateTotalBorrowApy = (borrowApy: string | null, totalIncentiveBorrowApy: number): number | null => {
  if (borrowApy === null) return null;
  const nativeBorrowApy = parseFloat(borrowApy) / 100;
  if (isNaN(nativeBorrowApy)) return null;
  if (isNaN(totalIncentiveBorrowApy)) return null;
  return nativeBorrowApy - totalIncentiveBorrowApy;
};

// Calculate spread (APY version)
export const calculateSpreadApy = (totalSupplyApy: number, totalBorrowApy: number | null): number | null => {
  if (totalBorrowApy === null) return null;
  return totalSupplyApy - totalBorrowApy;
};

// Calculate spread (APR version)
export const calculateSpreadApr = (totalSupplyApr: number, totalBorrowApr: number | null): number | null => {
  if (totalBorrowApr === null) return null;
  return totalSupplyApr - totalBorrowApr;
};
