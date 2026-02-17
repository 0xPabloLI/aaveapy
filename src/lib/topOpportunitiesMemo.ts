export interface TopOpportunitiesMemoPool {
  tokenAddress?: string;
  marketName?: string;
}

export interface TopOpportunitiesMemoProps {
  isApy: boolean;
  tydroPointToUsdRate: number;
  isRateDragging?: boolean;
  onIncentiveClick?: unknown;
  categoryGroups: unknown;
  includeWhitelistOnlyMerkl: boolean;
  pools: TopOpportunitiesMemoPool[];
}

export const shouldSkipTopOpportunitiesRender = (
  prevProps: TopOpportunitiesMemoProps,
  nextProps: TopOpportunitiesMemoProps
): boolean => {
  if (prevProps.isApy !== nextProps.isApy) return false;
  if (prevProps.tydroPointToUsdRate !== nextProps.tydroPointToUsdRate) return false;
  if (prevProps.isRateDragging !== nextProps.isRateDragging) return false;
  if (prevProps.onIncentiveClick !== nextProps.onIncentiveClick) return false;
  if (prevProps.categoryGroups !== nextProps.categoryGroups) return false;
  if (prevProps.includeWhitelistOnlyMerkl !== nextProps.includeWhitelistOnlyMerkl) return false;

  if (prevProps.pools === nextProps.pools) return true;
  if (prevProps.pools.length !== nextProps.pools.length) return false;
  if (prevProps.pools.length === 0) return true;

  for (let i = 0; i < prevProps.pools.length; i += 1) {
    const prevPool = prevProps.pools[i];
    const nextPool = nextProps.pools[i];
    if (
      prevPool?.tokenAddress !== nextPool?.tokenAddress ||
      prevPool?.marketName !== nextPool?.marketName
    ) {
      return false;
    }
  }

  return true;
};
