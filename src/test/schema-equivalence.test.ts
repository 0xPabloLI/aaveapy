/**
 * Schema equivalence test (AAV-1214 Phase 2).
 *
 * Verifies that wrapper schemas (generated base + frontend extensions) accept
 * the same valid inputs as the old hand-written schemas would have. This is a
 * transition-period safety net — it will be removed in Phase 3 (AAV-1216) when
 * hand-written schemas are fully deleted.
 *
 * Key invariant: the generated schema defines the API contract (minimum fields).
 * The wrapper adds `.passthrough()` for tolerance and `.extend()` for frontend-specific
 * fields. This test ensures no field was accidentally dropped in the wrapper.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { schemas as generated } from '@/generated/api/schemas';
import {
  MarketsResponseSchema,
  ReserveWithSpreadSchema,
  MeritCampaignGroupSchema,
  MeritCampaignBreakdownSchema,
  MerklCampaignBreakdownSchema,
  MerklOpportunityGroupSchema,
  BrevisCampaignBreakdownSchema,
  BrevisIncentiveSchema,
} from '@/shared/market-contract/schemas';
import {
  MarketsErrorResponseSchema,
  SideDataMetaResponseSchema,
} from '@/lib/apiSchemas';

/** Extract top-level field keys from a ZodObject schema. */
function getFieldKeys(schema: z.ZodTypeAny): Set<string> {
  // For ZodObject, access _def.shape()
  if (schema instanceof z.ZodObject) {
    return new Set(Object.keys(schema.shape));
  }
  // For extended/passthrough schemas, try to unwrap
  // ZodObject.extend returns a new ZodObject, so instanceof should work
  return new Set();
}

/** A valid mock reserve matching the API contract. */
const validReserve = {
  reserveId: '1:0xpool:0xtoken',
  marketName: 'Core',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0xa0b8',
  tokenPrice: 1.0,
  utilizationPct: 80,
  supplyApy: 2.5,
  borrowApy: 4.0,
  decimals: 6,
  supplied: '1000000000000',
  borrowed: '500000000000',
  liquidity: '500000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  deficit: '0',
  protocolFee: 10,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 75,
  optimalUtilization: 80,
  baseBorrowRate: 2,
  aTokenAddress: '0xatoken',
  vTokenAddress: '0xvtoken',
  isFrozen: false,
  isPaused: false,
  isActive: false,
  supplyDisabled: false,
  borrowDisabled: false,
  collateralRisk: 1,
};

describe('Schema equivalence: generated vs wrapper schemas', () => {
  describe('ReserveWithSpreadSchema', () => {
    it('accepts a valid API reserve', () => {
      const result = ReserveWithSpreadSchema.safeParse(validReserve);
      expect(result.success).toBe(true);
    });

    it('passthrough allows frontend-specific fields', () => {
      const withExtra = {
        ...validReserve,
        supplyIncentives: [1.0, 2.0],
        borrowIncentives: [0.5],
        suppliable: '1000000000000',
        borrowable: '500000000000',
      };
      const result = ReserveWithSpreadSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.supplyIncentives).toEqual([1.0, 2.0]);
        expect(result.data.borrowIncentives).toEqual([0.5]);
      }
    });

    it('generated MarketWithSpread is the base (subset of wrapper fields)', () => {
      const wrapperKeys = getFieldKeys(ReserveWithSpreadSchema);
      const generatedKeys = getFieldKeys(generated.MarketWithSpread);
      // All generated fields should be accessible in the wrapper
      for (const key of generatedKeys) {
        expect(wrapperKeys.has(key), `Wrapper missing generated field: ${key}`).toBe(true);
      }
    });

    it('wrapper includes frontend-specific extensions', () => {
      const wrapperKeys = getFieldKeys(ReserveWithSpreadSchema);
      expect(wrapperKeys.has('supplyIncentives')).toBe(true);
      expect(wrapperKeys.has('borrowIncentives')).toBe(true);
      expect(wrapperKeys.has('suppliable')).toBe(true);
      expect(wrapperKeys.has('borrowable')).toBe(true);
    });
  });

  describe('MeritCampaignGroupSchema', () => {
    it('accepts a valid merit campaign group', () => {
      const valid = {
        link: 'https://example.com',
        name: 'Merit Campaign',
        breakdowns: [{
          campaignApr: 5.0,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2024-12-31',
          campaignId: 'merit-1',
        }],
        borrowBlacklist: false,
      };
      const result = MeritCampaignGroupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts optional link (frontend override)', () => {
      const valid = {
        breakdowns: [],
      };
      const result = MeritCampaignGroupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('MerklOpportunityGroupSchema', () => {
    it('accepts a valid merkl opportunity group', () => {
      const valid = {
        opportunityId: '123',
        link: 'https://merkl.xyz',
        name: 'Merkl Opp',
        breakdowns: [{
          campaignApr: 3.0,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2024-12-31',
          campaignId: 'merkl-1',
        }],
        netPositionConstraint: {
          sourceSide: 'supply',
          offsetReserveIds: ['1:0xpool:0xusde'],
        },
        borrowBlacklist: true,
      };
      const result = MerklOpportunityGroupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('BrevisIncentiveSchema', () => {
    it('accepts flat format', () => {
      const flat = {
        link: 'https://brevis.xyz',
        campaignApr: 2.0,
        campaignStartedAt: '2024-01-01',
        campaignEndedAt: '2024-12-31',
        campaignId: 'brevis-1',
      };
      const result = BrevisIncentiveSchema.safeParse(flat);
      expect(result.success).toBe(true);
    });

    it('accepts grouped format', () => {
      const grouped = {
        link: 'https://brevis.xyz',
        name: 'Brevis Group',
        breakdowns: [{
          campaignApr: 2.0,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2024-12-31',
          campaignId: 'brevis-1',
        }],
      };
      const result = BrevisIncentiveSchema.safeParse(grouped);
      expect(result.success).toBe(true);
    });
  });

  describe('MarketsResponseSchema', () => {
    it('accepts a valid markets response', () => {
      const valid = {
        snapshot: {
          lastUpdated: '2024-07-21T00:00:00Z',
          version: '1.0.0',
        },
        reserves: [validReserve],
      };
      const result = MarketsResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('MarketsErrorResponseSchema', () => {
    it('accepts a valid error response', () => {
      const valid = {
        errorCode: 'MARKETS_SNAPSHOT_NOT_READY',
        error: 'Not ready',
        message: 'Snapshot is being generated',
      };
      const result = MarketsErrorResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('SideDataMetaResponseSchema', () => {
    it('accepts a valid side-data response', () => {
      const valid = {
        generatedAt: '2024-07-21T00:00:00Z',
        categories: {
          uniqueSymbolsStablecoins: ['USDC', 'USDT'],
          uniqueSymbolsEth: ['WETH'],
          fetchedAt: '2024-07-21T00:00:00Z',
          staleTimeMs: 300000,
        },
      };
      const result = SideDataMetaResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts response with errors', () => {
      const valid = {
        generatedAt: '2024-07-21T00:00:00Z',
        errors: {
          fdv: 'rate limited',
        },
      };
      const result = SideDataMetaResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('Brevis normalization transform still works', () => {
    it('flattens grouped Brevis incentives via ReserveWithSpreadSchema', () => {
      const reserveWithGroupedBrevis = {
        ...validReserve,
        brevisSupplys: [
          {
            link: 'https://brevis.xyz',
            name: 'Group A',
            breakdowns: [
              { campaignApr: 1.0, campaignStartedAt: '2024-01-01', campaignEndedAt: '2024-12-31', campaignId: 'b-1' },
              { campaignApr: 2.0, campaignStartedAt: '2024-01-01', campaignEndedAt: '2024-12-31', campaignId: 'b-2' },
            ],
          },
        ],
      };
      const result = ReserveWithSpreadSchema.safeParse(reserveWithGroupedBrevis);
      expect(result.success).toBe(true);
      if (result.success) {
        // Transform should flatten 1 group with 2 breakdowns into 2 flat items
        expect(result.data.brevisSupplys).toHaveLength(2);
        expect(result.data.brevisSupplys?.[0].campaignId).toBe('b-1');
        expect(result.data.brevisSupplys?.[1].campaignId).toBe('b-2');
      }
    });
  });
});
