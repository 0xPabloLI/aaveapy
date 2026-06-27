import type { PointRateMap } from '@/lib/tydro';

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

const pointRateMapsEqual = (a: PointRateMap | undefined, b: PointRateMap | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export interface TopOpportunitiesMemoProps {
  isApy: boolean;
  pointRateMap?: PointRateMap;
  isRateDragging?: boolean;
  onToggleWhitelistMerklCampaign?: unknown;
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
  if (!pointRateMapsEqual(prevProps.pointRateMap, nextProps.pointRateMap)) return false;
  if (prevProps.isRateDragging !== nextProps.isRateDragging) return false;
  if (prevProps.onToggleWhitelistMerklCampaign !== nextProps.onToggleWhitelistMerklCampaign) return false;
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
