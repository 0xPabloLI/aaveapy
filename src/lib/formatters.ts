// Format decimal to percentage string
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(2)}%`;
};

// Format spread with sign
export const formatSpread = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
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
