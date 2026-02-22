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
  reserves: TopOpportunitiesMemoPool[];
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

  if (prevProps.reserves === nextProps.reserves) return true;
  if (prevProps.reserves.length !== nextProps.reserves.length) return false;
  if (prevProps.reserves.length === 0) return true;

  for (let i = 0; i < prevProps.reserves.length; i += 1) {
    const prevPool = prevProps.reserves[i];
    const nextPool = nextProps.reserves[i];
    if (
      prevPool?.tokenAddress !== nextPool?.tokenAddress ||
      prevPool?.marketName !== nextPool?.marketName
    ) {
      return false;
    }
  }

  return true;
};
