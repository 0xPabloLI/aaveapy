import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const MeritCampaignGroup = z
  .object({
    link: z.string().optional(),
    name: z.string().optional(),
    message: z.string().optional(),
    breakdowns: z.array(
      z
        .object({
          campaignApr: z.number(),
          campaignStartedAt: z.string(),
          campaignEndedAt: z.string(),
          campaignId: z.string(),
          campaignType: z.string().optional(),
          positionCapNative: z.string().optional(),
          positionCapUsd: z.number().optional(),
          isCombineCap: z.boolean().optional(),
          message: z.string().optional(),
          aprCap: z.number().optional(),
          rewardTokenSymbol: z.string().optional(),
          totalBudget: z.number().optional(),
          latestTvl: z.number().optional(),
        })
        .passthrough()
    ),
  })
  .passthrough();
const MerklOpportunityGroup = z
  .object({
    link: z.string().optional(),
    name: z.string().optional(),
    message: z.string().optional(),
    breakdowns: z.array(
      z
        .object({
          campaignApr: z.number(),
          campaignStartedAt: z.string(),
          campaignEndedAt: z.string(),
          campaignId: z.string(),
          databaseId: z.string().optional(),
          whitelistOnly: z.boolean().optional(),
          pointsPerThousandUsd: z.number().optional(),
          rewardTokenSymbol: z.string().optional(),
          rewardTokenIconUrl: z.string().optional(),
          rewardTokenId: z.string().optional(),
          campaignType: z.string().optional(),
          totalBudget: z.number().optional(),
          budgetBoundMode: z.string().optional(),
          aprCap: z.number().nullish(),
          latestTvl: z.number().optional(),
          plannedDaily: z.number().optional(),
          positionCapNative: z.string().optional(),
          positionCapUsd: z.number().optional(),
          isCombineCap: z.boolean().optional(),
          lastEndedCampaign: z
            .object({
              startedAt: z.string(),
              endedAt: z.string(),
              campaignId: z.string(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
    ),
    opportunityType: z.string().optional(),
    netPositionConstraint: z
      .object({
        sourceSide: z.enum(["supply", "borrow"]),
        offsetReserveIds: z.array(z.string()),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();
const BrevisCampaignItem = z
  .object({
    link: z.string(),
    name: z.string().optional(),
    message: z.string().optional(),
    breakdowns: z
      .array(
        z
          .object({
            campaignApr: z.number(),
            campaignStartedAt: z.string(),
            campaignEndedAt: z.string(),
            campaignId: z.string().optional(),
            totalBudget: z.number().optional(),
            latestTvl: z.number().optional(),
            positionCapUsd: z.number().optional(),
            isCombineCap: z.boolean().optional(),
          })
          .passthrough()
      )
      .optional(),
    campaignApr: z.number().optional(),
    campaignStartedAt: z.string().optional(),
    campaignEndedAt: z.string().optional(),
    campaignId: z.string().optional(),
    totalBudget: z.number().optional(),
    latestTvl: z.number().optional(),
    positionCapUsd: z.number().optional(),
  })
  .passthrough();
const MarketsResponse = z
  .object({
    snapshot: z
      .object({
        lastUpdated: z.string(),
        version: z.string().optional(),
        staleTimeMs: z.number().optional(),
        schemaFingerprint: z.string().optional(),
        deficitFallbackReserveIds: z.array(z.string()).optional(),
        v4FallbackReserveIds: z.array(z.string()).optional(),
        stale: z.boolean().optional(),
        staleAgeMs: z.number().nullish(),
      })
      .passthrough(),
    reserves: z.array(
      z
        .object({
          reserveId: z.string(),
          marketName: z.string(),
          chainName: z.string(),
          chainId: z.number(),
          tokenName: z.string(),
          tokenSymbol: z.string(),
          tokenAddress: z.string(),
          tokenPrice: z.number().optional(),
          utilizationPct: z.number().optional(),
          aTokenAddress: z.string().nullish(),
          vTokenAddress: z.string().nullish(),
          supplied: z.string().optional(),
          borrowed: z.string().optional(),
          liquidity: z.string().optional(),
          supplyCap: z.string().optional(),
          borrowCap: z.string().optional(),
          deficit: z.string().optional(),
          hubId: z.string().optional(),
          hubName: z.string().optional(),
          spokeId: z.string().optional(),
          spokeName: z.string().optional(),
          supplyDisabled: z.boolean().optional(),
          borrowDisabled: z.boolean().optional(),
          isFrozen: z.boolean().optional(),
          isPaused: z.boolean().optional(),
          isActive: z.boolean().optional(),
          aaveProReserveId: z.string().optional(),
          decimals: z.number().optional(),
          supplyApy: z.number().nullish(),
          borrowApy: z.number().nullish(),
          protocolFee: z.number().optional(),
          slopeBelowOptimal: z.number().optional(),
          slopeAboveOptimal: z.number().optional(),
          optimalUtilization: z.number().optional(),
          baseBorrowRate: z.number().optional(),
          collateralRisk: z.number().optional(),
          meritSupplys: z.array(MeritCampaignGroup).optional(),
          meritBorrows: z.array(MeritCampaignGroup).optional(),
          merklSupplys: z.array(MerklOpportunityGroup).optional(),
          merklBorrows: z.array(MerklOpportunityGroup).optional(),
          merklHolds: z.array(MerklOpportunityGroup).optional(),
          brevisSupplys: z.array(BrevisCampaignItem).optional(),
          brevisBorrows: z.array(BrevisCampaignItem).optional(),
        })
        .passthrough()
    ),
  })
  .passthrough();
const MarketsErrorResponse = z
  .object({
    errorCode: z.enum(["MARKETS_SNAPSHOT_NOT_READY", "MARKETS_SNAPSHOT_STALE"]),
    error: z.string(),
    message: z.string(),
  })
  .passthrough();
const SideDataMetaResponse = z
  .object({
    generatedAt: z.string(),
    partial: z.boolean(),
    categories: z
      .object({
        uniqueSymbolsStablecoins: z.array(z.string()),
        uniqueSymbolsEth: z.array(z.string()),
        fetchedAt: z.string(),
        staleTimeMs: z.number(),
      })
      .passthrough(),
    fdv: z
      .object({
        items: z.array(
          z
            .object({
              symbol: z.string().nullable(),
              fdvUsd: z.number().nullable(),
            })
            .passthrough()
        ),
        fetchedAt: z.string(),
        staleTimeMs: z.number(),
      })
      .passthrough(),
    forecast: z
      .object({
        items: z.array(
          z
            .object({
              campaignId: z.string(),
              requiredDaily: z.number().optional(),
              distributedSoFar: z.number(),
              endTimestamp: z.number(),
            })
            .passthrough()
        ),
        errors: z.array(
          z
            .object({
              campaignId: z.string(),
              status: z.number().optional(),
              message: z.string(),
            })
            .passthrough()
        ),
        staleTimeMs: z.number(),
      })
      .passthrough(),
    campaignAccess: z
      .object({
        campaigns: z.record(
          z
            .object({
              chainId: z.number(),
              whitelist: z.array(z.string()),
              blacklist: z.array(z.string()),
              borrowHookProtocols: z
                .array(
                  z
                    .object({
                      protocol: z.number(),
                      borrowBytesLike: z.array(z.string()),
                    })
                    .passthrough()
                )
                .optional(),
            })
            .passthrough()
        ),
        updatedAt: z.string(),
      })
      .passthrough(),
  })
  .partial()
  .passthrough();
const Reserve = z
  .object({
    reserveId: z.string(),
    marketName: z.string(),
    chainName: z.string(),
    chainId: z.number(),
    tokenName: z.string(),
    tokenSymbol: z.string(),
    tokenAddress: z.string(),
    tokenPrice: z.number().optional(),
    utilizationPct: z.number().optional(),
    aTokenAddress: z.string().nullish(),
    vTokenAddress: z.string().nullish(),
    supplied: z.string().optional(),
    borrowed: z.string().optional(),
    liquidity: z.string().optional(),
    supplyCap: z.string().optional(),
    borrowCap: z.string().optional(),
    deficit: z.string().optional(),
    hubId: z.string().optional(),
    hubName: z.string().optional(),
    spokeId: z.string().optional(),
    spokeName: z.string().optional(),
    supplyDisabled: z.boolean().optional(),
    borrowDisabled: z.boolean().optional(),
    isFrozen: z.boolean().optional(),
    isPaused: z.boolean().optional(),
    isActive: z.boolean().optional(),
    aaveProReserveId: z.string().optional(),
    decimals: z.number().optional(),
    supplyApy: z.number().nullish(),
    borrowApy: z.number().nullish(),
    protocolFee: z.number().optional(),
    slopeBelowOptimal: z.number().optional(),
    slopeAboveOptimal: z.number().optional(),
    optimalUtilization: z.number().optional(),
    baseBorrowRate: z.number().optional(),
    collateralRisk: z.number().optional(),
    meritSupplys: z.array(MeritCampaignGroup).optional(),
    meritBorrows: z.array(MeritCampaignGroup).optional(),
    merklSupplys: z.array(MerklOpportunityGroup).optional(),
    merklBorrows: z.array(MerklOpportunityGroup).optional(),
    merklHolds: z.array(MerklOpportunityGroup).optional(),
    brevisSupplys: z.array(BrevisCampaignItem).optional(),
    brevisBorrows: z.array(BrevisCampaignItem).optional(),
  })
  .passthrough();
const MeritCampaignBreakdown = z
  .object({
    campaignApr: z.number(),
    campaignStartedAt: z.string(),
    campaignEndedAt: z.string(),
    campaignId: z.string(),
    campaignType: z.string().optional(),
    positionCapNative: z.string().optional(),
    positionCapUsd: z.number().optional(),
    isCombineCap: z.boolean().optional(),
    message: z.string().optional(),
    aprCap: z.number().optional(),
    rewardTokenSymbol: z.string().optional(),
    totalBudget: z.number().optional(),
    latestTvl: z.number().optional(),
  })
  .passthrough();
const MerklCampaignBreakdown = z
  .object({
    campaignApr: z.number(),
    campaignStartedAt: z.string(),
    campaignEndedAt: z.string(),
    campaignId: z.string(),
    databaseId: z.string().optional(),
    whitelistOnly: z.boolean().optional(),
    pointsPerThousandUsd: z.number().optional(),
    rewardTokenSymbol: z.string().optional(),
    rewardTokenIconUrl: z.string().optional(),
    rewardTokenId: z.string().optional(),
    campaignType: z.string().optional(),
    totalBudget: z.number().optional(),
    budgetBoundMode: z.string().optional(),
    aprCap: z.number().nullish(),
    latestTvl: z.number().optional(),
    plannedDaily: z.number().optional(),
    positionCapNative: z.string().optional(),
    positionCapUsd: z.number().optional(),
    isCombineCap: z.boolean().optional(),
    lastEndedCampaign: z
      .object({
        startedAt: z.string(),
        endedAt: z.string(),
        campaignId: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
const BrevisCampaignBreakdown = z
  .object({
    campaignApr: z.number(),
    campaignStartedAt: z.string(),
    campaignEndedAt: z.string(),
    campaignId: z.string().optional(),
    totalBudget: z.number().optional(),
    latestTvl: z.number().optional(),
    positionCapUsd: z.number().optional(),
    isCombineCap: z.boolean().optional(),
  })
  .passthrough();

export const schemas = {
  MeritCampaignGroup,
  MerklOpportunityGroup,
  BrevisCampaignItem,
  MarketsResponse,
  MarketsErrorResponse,
  SideDataMetaResponse,
  Reserve,
  MeritCampaignBreakdown,
  MerklCampaignBreakdown,
  BrevisCampaignBreakdown,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/markets",
    alias: "getMarkets",
    requestFormat: "json",
    response: z
      .object({
        snapshot: z
          .object({
            lastUpdated: z.string(),
            version: z.string().optional(),
            staleTimeMs: z.number().optional(),
            schemaFingerprint: z.string().optional(),
            deficitFallbackReserveIds: z.array(z.string()).optional(),
            v4FallbackReserveIds: z.array(z.string()).optional(),
            stale: z.boolean().optional(),
            staleAgeMs: z.number().nullish(),
          })
          .passthrough(),
        reserves: z.array(
          z
            .object({
              reserveId: z.string(),
              marketName: z.string(),
              chainName: z.string(),
              chainId: z.number(),
              tokenName: z.string(),
              tokenSymbol: z.string(),
              tokenAddress: z.string(),
              tokenPrice: z.number().optional(),
              utilizationPct: z.number().optional(),
              aTokenAddress: z.string().nullish(),
              vTokenAddress: z.string().nullish(),
              supplied: z.string().optional(),
              borrowed: z.string().optional(),
              liquidity: z.string().optional(),
              supplyCap: z.string().optional(),
              borrowCap: z.string().optional(),
              deficit: z.string().optional(),
              hubId: z.string().optional(),
              hubName: z.string().optional(),
              spokeId: z.string().optional(),
              spokeName: z.string().optional(),
              supplyDisabled: z.boolean().optional(),
              borrowDisabled: z.boolean().optional(),
              isFrozen: z.boolean().optional(),
              isPaused: z.boolean().optional(),
              isActive: z.boolean().optional(),
              aaveProReserveId: z.string().optional(),
              decimals: z.number().optional(),
              supplyApy: z.number().nullish(),
              borrowApy: z.number().nullish(),
              protocolFee: z.number().optional(),
              slopeBelowOptimal: z.number().optional(),
              slopeAboveOptimal: z.number().optional(),
              optimalUtilization: z.number().optional(),
              baseBorrowRate: z.number().optional(),
              collateralRisk: z.number().optional(),
              meritSupplys: z.array(MeritCampaignGroup).optional(),
              meritBorrows: z.array(MeritCampaignGroup).optional(),
              merklSupplys: z.array(MerklOpportunityGroup).optional(),
              merklBorrows: z.array(MerklOpportunityGroup).optional(),
              merklHolds: z.array(MerklOpportunityGroup).optional(),
              brevisSupplys: z.array(BrevisCampaignItem).optional(),
              brevisBorrows: z.array(BrevisCampaignItem).optional(),
            })
            .passthrough()
        ),
      })
      .passthrough(),
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
              "MARKETS_SNAPSHOT_NOT_READY",
              "MARKETS_SNAPSHOT_STALE",
            ]),
            error: z.string(),
            message: z.string(),
          })
          .passthrough(),
      },
    ],
  },
  {
    method: "get",
    path: "/meta/side-data",
    alias: "getMetaSideData",
    requestFormat: "json",
    response: z
      .object({
        generatedAt: z.string(),
        partial: z.boolean(),
        categories: z
          .object({
            uniqueSymbolsStablecoins: z.array(z.string()),
            uniqueSymbolsEth: z.array(z.string()),
            fetchedAt: z.string(),
            staleTimeMs: z.number(),
          })
          .passthrough(),
        fdv: z
          .object({
            items: z.array(
              z
                .object({
                  symbol: z.string().nullable(),
                  fdvUsd: z.number().nullable(),
                })
                .passthrough()
            ),
            fetchedAt: z.string(),
            staleTimeMs: z.number(),
          })
          .passthrough(),
        forecast: z
          .object({
            items: z.array(
              z
                .object({
                  campaignId: z.string(),
                  requiredDaily: z.number().optional(),
                  distributedSoFar: z.number(),
                  endTimestamp: z.number(),
                })
                .passthrough()
            ),
            errors: z.array(
              z
                .object({
                  campaignId: z.string(),
                  status: z.number().optional(),
                  message: z.string(),
                })
                .passthrough()
            ),
            staleTimeMs: z.number(),
          })
          .passthrough(),
        campaignAccess: z
          .object({
            campaigns: z.record(
              z
                .object({
                  chainId: z.number(),
                  whitelist: z.array(z.string()),
                  blacklist: z.array(z.string()),
                  borrowHookProtocols: z
                    .array(
                      z
                        .object({
                          protocol: z.number(),
                          borrowBytesLike: z.array(z.string()),
                        })
                        .passthrough()
                    )
                    .optional(),
                })
                .passthrough()
            ),
            updatedAt: z.string(),
          })
          .passthrough(),
      })
      .partial()
      .passthrough(),
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
              "MARKETS_SNAPSHOT_NOT_READY",
              "MARKETS_SNAPSHOT_STALE",
            ]),
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
