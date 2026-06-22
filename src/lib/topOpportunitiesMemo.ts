export interface TopOpportunitiesMemoReserve {
  tokenAddress?: string;
  marketName?: string;
}

const whitelistMerklSetsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
};

export interface TopOpportunitiesMemoProps {
  isApy: boolean;
  pointRateMap: Record<string, number>;
  isRateDragging?: boolean;
  onIncentiveClick?: unknown;
  onCardClick?: unknown;
  categoryGroups: unknown;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  reserves: TopOpportunitiesMemoReserve[];
}

export const shouldSkipTopOpportunitiesRender = (
  prevProps: TopOpportunitiesMemoProps,
  nextProps: TopOpportunitiesMemoProps
): boolean => {
  if (prevProps.isApy !== nextProps.isApy) return false;
  if (prevProps.pointRateMap !== nextProps.pointRateMap) return false;
  if (prevProps.isRateDragging !== nextProps.isRateDragging) return false;
  if (prevProps.onIncentiveClick !== nextProps.onIncentiveClick) return false;
  if (prevProps.onCardClick !== nextProps.onCardClick) return false;
  if (prevProps.categoryGroups !== nextProps.categoryGroups) return false;
  if (!whitelistMerklSetsEqual(prevProps.whitelistMerklCampaignIds, nextProps.whitelistMerklCampaignIds))
    return false;

  if (prevProps.reserves === nextProps.reserves) return true;
  if (prevProps.reserves.length !== nextProps.reserves.length) return false;
  if (prevProps.reserves.length === 0) return true;

  for (let i = 0; i < prevProps.reserves.length; i += 1) {
    const prevReserve = prevProps.reserves[i];
    const nextReserve = nextProps.reserves[i];
    if (
      prevReserve?.tokenAddress !== nextReserve?.tokenAddress ||
      prevReserve?.marketName !== nextReserve?.marketName
    ) {
      return false;
    }
  }

  return true;
};
