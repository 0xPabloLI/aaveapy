import { z } from 'zod';

type IncentiveMessageScalar = string | number | boolean | null;
type IncentiveMessage = string | IncentiveMessage[] | {
  [key: string]: IncentiveMessageScalar | IncentiveMessage;
};

const IncentiveMessageScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const IncentiveMessageSchema: z.ZodType<IncentiveMessage> = z.lazy(() =>
  z.union([
    z.string(),
    z.record(z.string(), z.union([IncentiveMessageScalarSchema, IncentiveMessageSchema])),
    z.array(IncentiveMessageSchema),
  ])
);

export const MeritIncentiveSchema = z.object({
  apr: z.number(),
  selfApr: z.number().optional(),
  link: z.string(),
  name: z.string().optional(),
  message: IncentiveMessageSchema.optional(),
  startDate: z.string(),
  endDate: z.string(),
  lastRoundRewardUsd: z.number().optional(),
});

export const MerklCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  whitelistOnly: z.boolean().optional(),
  pointsPerThousandUsd: z.number().optional(),
  campaignType: z.string().optional(),
  totalBudget: z.number().optional(),
  aprCap: z.number().nullable().optional(),
  latestTvl: z.number().optional(),
  plannedDaily: z.number().optional(),
});

export const MerklOpportunityGroupSchema = z.object({
  link: z.string().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(MerklCampaignBreakdownSchema),
  opportunityType: z.string().optional(),
  netPositionConstraint: z.object({
    sourceSide: z.enum(['supply', 'borrow']),
    offsetReserveIds: z.array(z.string()),
  }).nullable().optional(),
});

export const BrevisCampaignBreakdownSchema = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  perUserRewardCapUsd: z.number().optional(),
  campaignId: z.string().optional(),
}).passthrough();

export const BrevisIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema).optional(),
  campaignApr: z.number().optional(),
  campaignStartedAt: z.string().optional(),
  campaignEndedAt: z.string().optional(),
  latestTvl: z.number().optional(),
  totalBudget: z.number().optional(),
  perUserRewardCapUsd: z.number().optional(),
  campaignId: z.string().optional(),
}).passthrough();

const BrevisGroupedIncentiveSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(BrevisCampaignBreakdownSchema),
}).passthrough();

const BrevisRawIncentiveSchema = z.union([
  BrevisGroupedIncentiveSchema,
  BrevisIncentiveSchema,
]);

type BrevisRawIncentive = z.infer<typeof BrevisRawIncentiveSchema>;
type BrevisIncentive = z.infer<typeof BrevisIncentiveSchema>;

const isBrevisGroupedIncentive = (
  entry: BrevisRawIncentive
): entry is z.infer<typeof BrevisGroupedIncentiveSchema> =>
  Object.prototype.hasOwnProperty.call(entry, 'breakdowns');

const normalizeBrevisIncentives = (
  entries: BrevisRawIncentive[] | undefined,
): BrevisIncentive[] | undefined => {
  if (!entries?.length) return undefined;
  const normalized: BrevisIncentive[] = [];
  for (const entry of entries) {
    if (isBrevisGroupedIncentive(entry)) {
      const { breakdowns, ...groupFields } = entry;
      for (const breakdown of breakdowns) {
        normalized.push({
          ...groupFields,
          ...breakdown,
        });
      }
      continue;
    }
    normalized.push(entry);
  }
  return normalized.length > 0 ? normalized : undefined;
};

export const ReserveWithSpreadSchema = z.object({
  reserveId: z.string(),
  marketName: z.string(),
  chainName: z.string(),
  chainId: z.number(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenAddress: z.string(),
  tokenPrice: z.number().optional(),
  utilizationPct: z.number().optional(),
  supplyDisabled: z.boolean().optional(),
  borrowDisabled: z.boolean().optional(),
  isFrozen: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  isActive: z.literal(false).optional(),
  aTokenAddress: z.string().nullish(),
  vTokenAddress: z.string().nullish(),
  supplyApy: z.number().optional(),
  borrowApy: z.number().optional(),
  supplyIncentives: z.array(z.number()).optional(),
  borrowIncentives: z.array(z.number()).optional(),
  meritSupplys: z.array(MeritIncentiveSchema).optional(),
  meritBorrows: z.array(MeritIncentiveSchema).optional(),
  merklSupplys: z.array(MerklOpportunityGroupSchema).optional(),
  merklBorrows: z.array(MerklOpportunityGroupSchema).optional(),
  merklHolds: z.array(MerklOpportunityGroupSchema).optional(),
  brevisSupplys: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
  brevisBorrows: z.array(BrevisRawIncentiveSchema).optional().transform(normalizeBrevisIncentives),
  decimals: z.number().optional(),
  supplied: z.string().optional(),
  borrowed: z.string().optional(),
  liquidity: z.string().optional(),
  supplyCap: z.string().optional(),
  borrowCap: z.string().optional(),
  suppliable: z.string().optional(),
  borrowable: z.string().optional(),
  deficit: z.string().optional(),
  protocolFee: z.number().optional(),
  slopeBelowOptimal: z.number().optional(),
  slopeAboveOptimal: z.number().optional(),
  optimalUtilization: z.number().optional(),
  baseBorrowRate: z.number().optional(),
  aaveProReserveId: z.string().optional(),
  hubId: z.string().optional(),
  hubName: z.string().optional(),
  spokeId: z.string().optional(),
  spokeName: z.string().optional(),
}).passthrough();

export const MarketsResponseSchema = z.object({
  snapshot: z.object({
    lastUpdated: z.string(),
    version: z.string().optional(),
    staleTimeMs: z.number().optional(),
    schemaFingerprint: z.string().optional(),
  }),
  reserves: z.array(ReserveWithSpreadSchema),
});