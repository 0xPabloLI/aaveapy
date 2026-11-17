import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core';
import { z } from 'zod';

const MarketsResponse: z.ZodTypeAny = z.lazy(() => MarketsResponse);
const MerklBorrowHookProtocol = z.object({ protocol: z.number(), borrowBytesLike: z.array(z.string()) });
const SideDataSubSourceErrors = z
  .object({ categories: z.string(), fdv: z.string(), forecast: z.string(), campaignAccess: z.string() })
  .partial();
const SideDataPayload = z.object({
  generatedAt: z.string(),
  categories: z
    .object({
      uniqueSymbolsStablecoins: z.array(z.string()),
      uniqueSymbolsEth: z.array(z.string()),
      fetchedAt: z.string(),
      staleTimeMs: z.number(),
    })
    .optional(),
  fdv: z
    .object({
      items: z.array(z.object({ symbol: z.union([z.string(), z.null()]), fdvUsd: z.union([z.number(), z.null()]) })),
      fetchedAt: z.string(),
      staleTimeMs: z.number(),
    })
    .optional(),
  forecast: z
    .object({
      items: z.array(
        z.object({
          campaignId: z.string(),
          requiredDaily: z.number().optional(),
          distributedSoFar: z.number(),
          endTimestamp: z.number(),
        }),
      ),
      errors: z.array(z.object({ campaignId: z.string(), message: z.string() })),
      staleTimeMs: z.number(),
    })
    .optional(),
  campaignAccess: z
    .object({
      campaigns: z.record(z.string(), 
        z.object({
          chainId: z.number(),
          whitelist: z.array(z.string()),
          blacklist: z.array(z.string()),
          borrowHookProtocols: z.array(MerklBorrowHookProtocol).optional(),
        }),
      ),
      updatedAt: z.string(),
    })
    .optional(),
  errors: SideDataSubSourceErrors.optional(),
});
const EModeMarketSummary = z.object({
  marketKey: z.string(),
  chainId: z.number(),
  chainName: z.string(),
  marketName: z.string(),
  categoryCount: z.number(),
});
const EModeIndexPayload = z.object({ generatedAt: z.string(), markets: z.array(EModeMarketSummary) });
const EModeCategoryData = z.object({
  id: z.number(),
  label: z.string(),
  maxLtv: z.number(),
  liquidationThreshold: z.number(),
  liquidationPenalty: z.number(),
  collateralReserves: z.array(z.string()),
  borrowableReserves: z.array(z.string()),
});
const EModeMarketPayload = z.object({
  marketKey: z.string(),
  chainId: z.number(),
  chainName: z.string(),
  marketName: z.string(),
  categories: z.array(EModeCategoryData),
  generatedAt: z.string(),
});
const MarketsErrorResponse = z
  .object({
    errorCode: z.enum(['MARKETS_SNAPSHOT_NOT_READY', 'MARKETS_SNAPSHOT_STALE']),
    error: z.string(),
    message: z.string(),
  })
  .passthrough();
const ForecastCampaignTypeLite = z.enum([
  'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  'DUTCH_AUCTION',
  'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  'TARGET_TOTAL_APR',
  'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE',
  'FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT',
  'MAX_REWARD_VALUE_PER_LIQUIDITY_AMOUNT',
]);
const MerklCampaignBreakdown = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  positionCapNative: z.string().optional(),
  positionCapUsd: z.number().optional(),
  isCombineCap: z.boolean().optional(),
  databaseId: z.string().optional(),
  whitelistOnly: z.boolean().optional(),
  pointsPerThousandUsd: z.number().optional(),
  rewardTokenSymbol: z.string().optional(),
  rewardTokenIconUrl: z.string().optional(),
  rewardTokenId: z.string().optional(),
  campaignType: ForecastCampaignTypeLite.optional(),
  totalBudget: z.number().optional(),
  aprCap: z.union([z.number(), z.null()]).optional(),
  latestTvl: z.number().optional(),
  plannedDaily: z.number().optional(),
  budgetBoundMode: z.string().optional(),
  parentCampaignId: z.string().optional(),
  lastEndedCampaign: z.object({ startedAt: z.string(), endedAt: z.string(), campaignId: z.string() }).optional(),
});
const ApiMerklOpportunityGroup = z.object({
  opportunityId: z.string().optional(),
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(MerklCampaignBreakdown),
  netPositionConstraint: z
    .union([z.object({ sourceSide: z.enum(['supply', 'borrow']), offsetReserveIds: z.array(z.string()) }), z.null()])
    .optional(),
  crossAssetPairing: z
    .union([
      z.object({
        sourceSide: z.enum(['supply', 'borrow']),
        pairedReserveId: z.string(),
        pairedSide: z.enum(['supply', 'borrow']),
        discountFactor: z.number(),
      }),
      z.null(),
    ])
    .optional(),
  borrowBlacklist: z.boolean().optional(),
});
const ApiBrevisBreakdown = z.object({
  campaignApr: z.number(),
  campaignStartedAt: z.string(),
  campaignEndedAt: z.string(),
  campaignId: z.string(),
  campaignType: ForecastCampaignTypeLite.optional(),
  aprCap: z.number().optional(),
  totalBudget: z.number().optional(),
  latestTvl: z.number().optional(),
  positionCapNative: z.string().optional(),
  positionCapUsd: z.number().optional(),
  isCombineCap: z.boolean().optional(),
  rewardTokenSymbol: z.string().optional(),
});
const CampaignGroupApiBrevisBreakdown = z.object({
  link: z.string(),
  name: z.string().optional(),
  message: z.string().optional(),
  breakdowns: z.array(ApiBrevisBreakdown),
  netPositionConstraint: z
    .union([z.object({ sourceSide: z.enum(['supply', 'borrow']), offsetReserveIds: z.array(z.string()) }), z.null()])
    .optional(),
  crossAssetPairing: z
    .union([
      z.object({
        sourceSide: z.enum(['supply', 'borrow']),
        pairedReserveId: z.string(),
        pairedSide: z.enum(['supply', 'borrow']),
        discountFactor: z.number(),
      }),
      z.null(),
    ])
    .optional(),
  borrowBlacklist: z.boolean().optional(),
});
const MarketWithSpread = z.object({
  supplyApy: z.union([z.number(), z.null()]).optional(),
  borrowApy: z.union([z.number(), z.null()]).optional(),
  merklSupplys: z.array(ApiMerklOpportunityGroup).optional(),
  merklBorrows: z.array(ApiMerklOpportunityGroup).optional(),
  merklHolds: z.array(ApiMerklOpportunityGroup).optional(),
  brevisSupplys: z.array(CampaignGroupApiBrevisBreakdown).optional(),
  brevisBorrows: z.array(CampaignGroupApiBrevisBreakdown).optional(),
  reserveId: z.string(),
  marketName: z.string(),
  chainName: z.string(),
  chainId: z.number(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenAddress: z.string(),
  tokenPrice: z.number().optional(),
  utilizationPct: z.number().optional(),
  aTokenAddress: z.union([z.string(), z.null()]).optional(),
  vTokenAddress: z.union([z.string(), z.null()]).optional(),
  supplyDisabled: z.boolean().optional(),
  isFrozen: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  isActive: z.boolean().optional(),
  borrowDisabled: z.boolean().optional(),
  decimals: z.number().optional(),
  supplyCap: z.string().optional(),
  borrowCap: z.string().optional(),
  deficit: z.string().optional(),
  supplied: z.string().optional(),
  borrowed: z.string().optional(),
  hubBorrowed: z.string().optional(),
  hubSupplied: z.string().optional(),
  liquidity: z.string().optional(),
  protocolFee: z.number().optional(),
  slopeBelowOptimal: z.number().optional(),
  slopeAboveOptimal: z.number().optional(),
  optimalUtilization: z.number().optional(),
  baseBorrowRate: z.number().optional(),
  aaveProReserveId: z.string().optional(),
  hubId: z.string().optional(),
  hubName: z.string().optional(),
  hubAddress: z.string().optional(),
  spokeId: z.string().optional(),
  spokeName: z.string().optional(),
  spokeAddress: z.string().optional(),
  collateralRisk: z.number().optional(),
  ltv: z.number().optional(),
  liquidationThreshold: z.number().optional(),
});
const ApiMerklBreakdown = MerklCampaignBreakdown;
const ApiBrevisCampaignItem = CampaignGroupApiBrevisBreakdown;

export const schemas = {
  MarketsResponse,
  MerklBorrowHookProtocol,
  SideDataSubSourceErrors,
  SideDataPayload,
  EModeMarketSummary,
  EModeIndexPayload,
  EModeCategoryData,
  EModeMarketPayload,
  MarketsErrorResponse,
  ForecastCampaignTypeLite,
  MerklCampaignBreakdown,
  ApiMerklOpportunityGroup,
  ApiBrevisBreakdown,
  CampaignGroupApiBrevisBreakdown,
  MarketWithSpread,
  ApiMerklBreakdown,
  ApiBrevisCampaignItem,
};

const endpoints = makeApi([
  {
    method: 'get',
    path: '/markets',
    alias: 'getMarkets',
    requestFormat: 'json',
    response: MarketsResponse,
    errors: [
      {
        status: 429,
        description: `Rate limit exceeded (120 requests/min per IP)`,
        schema: z.void(),
      },
      {
        status: 503,
        description: `Service unavailable — data not ready or too stale`,
        schema: z
          .object({
            errorCode: z.enum(['MARKETS_SNAPSHOT_NOT_READY', 'MARKETS_SNAPSHOT_STALE']),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
    ],
  },
  {
    method: 'get',
    path: '/meta/e-mode',
    alias: 'getMetaEModeIndex',
    requestFormat: 'json',
    response: EModeIndexPayload,
    errors: [
      {
        status: 429,
        description: `Rate limit exceeded (120 requests/min per IP)`,
        schema: z.void(),
      },
      {
        status: 503,
        description: `Service unavailable — data not ready or too stale`,
        schema: z
          .object({
            errorCode: z.enum([
              'EMODE_SNAPSHOT_NOT_READY',
              'EMODE_DATA_UNAVAILABLE',
              'EMODE_INVALID_MARKET_KEY',
              'EMODE_MARKET_NOT_FOUND',
            ]),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
    ],
  },
  {
    method: 'get',
    path: '/meta/e-mode/:marketKey',
    alias: 'getMetaEModeMarket',
    requestFormat: 'json',
    parameters: [
      {
        name: 'marketKey',
        type: 'Path',
        schema: z.string().regex(/^[0-9]+:0x[0-9a-fA-F]{40}$/),
      },
    ],
    response: EModeMarketPayload,
    errors: [
      {
        status: 400,
        description: `Malformed marketKey`,
        schema: z
          .object({
            errorCode: z.enum([
              'EMODE_SNAPSHOT_NOT_READY',
              'EMODE_DATA_UNAVAILABLE',
              'EMODE_INVALID_MARKET_KEY',
              'EMODE_MARKET_NOT_FOUND',
            ]),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
      {
        status: 404,
        description: `Market not found (or V4 market, which has no eMode categories)`,
        schema: z
          .object({
            errorCode: z.enum([
              'EMODE_SNAPSHOT_NOT_READY',
              'EMODE_DATA_UNAVAILABLE',
              'EMODE_INVALID_MARKET_KEY',
              'EMODE_MARKET_NOT_FOUND',
            ]),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
      {
        status: 429,
        description: `Rate limit exceeded (120 requests/min per IP)`,
        schema: z.void(),
      },
      {
        status: 503,
        description: `Service unavailable — data not ready or too stale`,
        schema: z
          .object({
            errorCode: z.enum([
              'EMODE_SNAPSHOT_NOT_READY',
              'EMODE_DATA_UNAVAILABLE',
              'EMODE_INVALID_MARKET_KEY',
              'EMODE_MARKET_NOT_FOUND',
            ]),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
    ],
  },
  {
    method: 'get',
    path: '/meta/side-data',
    alias: 'getMetaSideData',
    requestFormat: 'json',
    response: SideDataPayload,
    errors: [
      {
        status: 429,
        description: `Rate limit exceeded (120 requests/min per IP)`,
        schema: z.void(),
      },
      {
        status: 503,
        description: `Service unavailable — data not ready or too stale`,
        schema: z
          .object({
            errorCode: z.enum(['MARKETS_SNAPSHOT_NOT_READY', 'MARKETS_SNAPSHOT_STALE']),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
    ],
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
