import type { BaseCampaignBreakdown, CampaignGroup } from '@/types/aave';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseCampaignBoundaryMs = (
  value: string | undefined,
  boundary: 'start' | 'end'
): number | null => {
  if (!value) return null;

  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const isCampaignActive = (
  startDate: string | undefined,
  endDate: string | undefined,
  nowMs = Date.now(),
  allowOpenEnd = false,
): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  if (startMs === null || nowMs < startMs) return false;
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (endMs === null) return allowOpenEnd;
  return nowMs <= endMs;
};

export type FlattenedCampaignBreakdown<TGroup, TBreakdown> = {
  group: TGroup;
  breakdown: TBreakdown;
};

export const flattenCampaignBreakdowns = <
  TGroup extends Pick<CampaignGroup<TBreakdown>, 'breakdowns'>,
  TBreakdown extends BaseCampaignBreakdown,
>(groups?: TGroup[]): Array<FlattenedCampaignBreakdown<TGroup, TBreakdown>> => {
  if (!groups?.length) return [];
  return groups.flatMap((group) =>
    (group.breakdowns ?? []).map((breakdown) => ({ group, breakdown }))
  );
};

export interface SumActiveCampaignBreakdownValuesOptions<TGroup, TBreakdown> {
  allowOpenEnd?: boolean;
  nowMs?: number;
  getBreakdowns: (group: TGroup) => TBreakdown[] | undefined;
  getStartDate: (group: TGroup, breakdown: TBreakdown) => string | undefined;
  getEndDate: (group: TGroup, breakdown: TBreakdown) => string | undefined;
  include?: (group: TGroup, breakdown: TBreakdown) => boolean;
  mapValue: (group: TGroup, breakdown: TBreakdown) => number;
  groupMultiplier?: (group: TGroup) => number;
}

export const sumActiveCampaignBreakdownValues = <
  TGroup,
  TBreakdown,
>(
  groups: TGroup[] | undefined,
  {
    allowOpenEnd = false,
    nowMs = Date.now(),
    getBreakdowns,
    getStartDate,
    getEndDate,
    include,
    mapValue,
    groupMultiplier,
  }: SumActiveCampaignBreakdownValuesOptions<TGroup, TBreakdown>
): number => {
  if (!groups?.length) return 0;

  return groups.reduce((sum, group) => {
    const breakdowns = getBreakdowns(group);
    if (!breakdowns?.length) return sum;
    const multiplier = groupMultiplier ? groupMultiplier(group) : 1;

    return (
      sum +
      multiplier *
      breakdowns.reduce((breakdownSum, breakdown) => {
        const startDate = getStartDate(group, breakdown);
        const endDate = getEndDate(group, breakdown);
        if (!isCampaignActive(startDate, endDate, nowMs, allowOpenEnd)) return breakdownSum;
        if (include && !include(group, breakdown)) return breakdownSum;
        return breakdownSum + mapValue(group, breakdown);
      }, 0)
    );
  }, 0);
};

export const applyStableCampaignLabels = <
  TRow extends { label: string },
>(rows: TRow[]): TRow[] => {
  const totalsByLabel = new Map<string, number>();
  rows.forEach((row) => {
    totalsByLabel.set(row.label, (totalsByLabel.get(row.label) ?? 0) + 1);
  });

  const indexByLabel = new Map<string, number>();
  return rows.map((row) => {
    const total = totalsByLabel.get(row.label) ?? 0;
    if (total <= 1) return row;
    const nextIdx = (indexByLabel.get(row.label) ?? 0) + 1;
    indexByLabel.set(row.label, nextIdx);
    return {
      ...row,
      label: `${row.label} #${nextIdx}`,
    };
  });
};
