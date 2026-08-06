import { describe, it, expect } from 'vitest';
import type { ReserveWithSpread, CampaignGroup, CampaignAccessEntry } from './aave';
import type { SideDataMetaResponse, SideDataSubSourceErrors } from '@/hooks/useSideDataMeta';
import { nativeToUsd, getReserveTotalBorrowedUsd } from '@/lib/scenarioSize';

const mock: ReserveWithSpread = {
  reserveId: 'canary-1',
  marketName: 'Canary',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'Canary Token',
  tokenSymbol: 'CNY',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 2,
  decimals: 6,
  supplied: '2000000000000',
  borrowed: '500000000000',
  supplyCap: '3000000000000',
  borrowCap: '1000000000000',
  optimalUtilization: 90,
  isFrozen: false,
  isPaused: false,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyApy: 4.5,
  borrowApy: 6.0,
  utilizationPct: 45,
  hubId: 'hub-core',
  hubName: 'Core',
};

describe('ReserveWithSpread canonical field-name canary', () => {
  it('nativeToUsd(reserve.supplied) produces valid non-null USD', () => {
    const usd = nativeToUsd(mock.supplied, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(4_000_000);
  });

  it('getReserveTotalBorrowedUsd(reserve.borrowed) produces valid USD', () => {
    const usd = getReserveTotalBorrowedUsd(mock);
    expect(usd).toBe(1_000_000);
  });

  it('nativeToUsd(reserve.supplyCap) produces valid USD', () => {
    const usd = nativeToUsd(mock.supplyCap, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(6_000_000);
  });

  it('nativeToUsd(reserve.borrowCap) produces valid USD', () => {
    const usd = nativeToUsd(mock.borrowCap, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(2_000_000);
  });

  it('reserve.hubId is a string (used in filter callback)', () => {
    expect(typeof mock.hubId).toBe('string');
    expect(mock.hubId).toBe('hub-core');
  });

  it('reserve.hubBorrowed is an optional string (V4 Hub-level totalBorrowed)', () => {
    const withHub: ReserveWithSpread = { ...mock, hubBorrowed: '67389016236' };
    expect(typeof withHub.hubBorrowed).toBe('string');
    expect(withHub.hubBorrowed).toBe('67389016236');
    expect(mock.hubBorrowed).toBeUndefined();
  });

  it('reserve.hubSupplied is an optional string (V4 Hub-level totalSupplied)', () => {
    const withHub: ReserveWithSpread = { ...mock, hubSupplied: '99123456789' };
    expect(typeof withHub.hubSupplied).toBe('string');
    expect(withHub.hubSupplied).toBe('99123456789');
    expect(mock.hubSupplied).toBeUndefined();
  });

  it('reserve.optimalUtilization is a number (used in UtilizationIndicator)', () => {
    expect(typeof mock.optimalUtilization).toBe('number');
    expect(mock.optimalUtilization).toBe(90);
  });

  it('reserve.isFrozen and reserve.isPaused are booleans', () => {
    expect(typeof mock.isFrozen).toBe('boolean');
    expect(typeof mock.isPaused).toBe('boolean');
  });

  it('reserve.supplyDisabled and reserve.borrowDisabled are booleans', () => {
    expect(typeof mock.supplyDisabled).toBe('boolean');
    expect(typeof mock.borrowDisabled).toBe('boolean');
  });

  it('reserve.supplyApy and reserve.borrowApy are numbers', () => {
    expect(typeof mock.supplyApy).toBe('number');
    expect(typeof mock.borrowApy).toBe('number');
  });

  it('reserve.ltv is an optional number (collateral LTV percent, AAV-756 P2)', () => {
    const withLtv: ReserveWithSpread = { ...mock, ltv: 80 };
    expect(typeof withLtv.ltv).toBe('number');
    expect(withLtv.ltv).toBe(80);
    expect(mock.ltv).toBeUndefined();
  });

  it('reserve.liquidationThreshold is an optional number (liquidation threshold percent, AAV-756 P2)', () => {
    const withLt: ReserveWithSpread = { ...mock, liquidationThreshold: 82.5 };
    expect(typeof withLt.liquidationThreshold).toBe('number');
    expect(withLt.liquidationThreshold).toBe(82.5);
    expect(mock.liquidationThreshold).toBeUndefined();
  });

  it('V4 reserve has ltv === liquidationThreshold (collateralFactor), V3 may differ', () => {
    const v4Reserve: ReserveWithSpread = { ...mock, ltv: 75, liquidationThreshold: 75 };
    expect(v4Reserve.ltv).toBe(v4Reserve.liquidationThreshold);
    const v3Reserve: ReserveWithSpread = { ...mock, ltv: 80, liquidationThreshold: 82.5 };
    expect(v3Reserve.ltv).not.toBe(v3Reserve.liquidationThreshold);
  });
});

describe('CampaignGroup netPositionConstraint field-name canary', () => {
  const group: CampaignGroup = {
    link: 'https://merkl.xyz',
    breakdowns: [],
    opportunityId: '9830701213305656660',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: ['1:0xPool:0xUsde', '1:0xPool:0xGho'],
    },
  };

  it('group.opportunityId is an optional string', () => {
    expect(typeof group.opportunityId).toBe('string');
    expect(group.opportunityId).toBe('9830701213305656660');
  });

  it('group.netPositionConstraint.sourceSide is supply or borrow', () => {
    expect(['supply', 'borrow']).toContain(group.netPositionConstraint!.sourceSide);
  });

  it('group.netPositionConstraint.offsetReserveIds is string[]', () => {
    expect(Array.isArray(group.netPositionConstraint!.offsetReserveIds)).toBe(true);
    group.netPositionConstraint!.offsetReserveIds.forEach(id => {
      expect(typeof id).toBe('string');
    });
  });

  it('group without netPositionConstraint is valid (optional)', () => {
    const plain: CampaignGroup = { link: 'https://merkl.xyz', breakdowns: [] };
    expect(plain.netPositionConstraint).toBeUndefined();
  });
});

describe('CampaignGroup borrowBlacklist field-name canary (AAV-962)', () => {
  it('group.borrowBlacklist is true when set', () => {
    const group: CampaignGroup = {
      link: 'https://merkl.xyz',
      breakdowns: [],
      borrowBlacklist: true,
    };
    expect(group.borrowBlacklist).toBe(true);
  });

  it('group without borrowBlacklist is valid (optional)', () => {
    const plain: CampaignGroup = { link: 'https://merkl.xyz', breakdowns: [] };
    expect(plain.borrowBlacklist).toBeUndefined();
  });

  it('MerklOpportunityGroupSchema accepts borrowBlacklist: true', async () => {
    const { MerklOpportunityGroupSchema } = await import('@/shared/market-contract/schemas');
    const parsed = MerklOpportunityGroupSchema.parse({
      link: 'https://merkl.xyz',
      breakdowns: [],
      borrowBlacklist: true,
    });
    expect(parsed.borrowBlacklist).toBe(true);
  });

  it('MerklOpportunityGroupSchema strips unknown values but keeps borrowBlacklist', async () => {
    const { MerklOpportunityGroupSchema } = await import('@/shared/market-contract/schemas');
    const parsed = MerklOpportunityGroupSchema.parse({
      link: 'https://merkl.xyz',
      breakdowns: [],
      borrowBlacklist: true,
    });
    expect(parsed.borrowBlacklist).toBe(true);
    // Absent case
    const parsed2 = MerklOpportunityGroupSchema.parse({
      link: 'https://merkl.xyz',
      breakdowns: [],
    });
    expect(parsed2.borrowBlacklist).toBeUndefined();
  });
});

describe('CampaignAccessEntry borrowHookProtocols field-name canary (AAV-1013)', () => {
  it('entry.borrowHookProtocols is array of protocols when set', () => {
    const entry: CampaignAccessEntry = {
      chainId: 1,
      whitelist: [],
      blacklist: [],
      borrowHookProtocols: [
        { protocol: 2, borrowBytesLike: ['0xabc', '0xdef'] },
        { protocol: 1, borrowBytesLike: ['0x123'] },
      ],
    };
    expect(entry.borrowHookProtocols).toHaveLength(2);
    expect(entry.borrowHookProtocols![0].protocol).toBe(2);
    expect(entry.borrowHookProtocols![0].borrowBytesLike).toEqual(['0xabc', '0xdef']);
  });

  it('entry without borrowHookProtocols is valid (optional)', () => {
    const plain: CampaignAccessEntry = {
      chainId: 1,
      whitelist: [],
      blacklist: [],
    };
    expect(plain.borrowHookProtocols).toBeUndefined();
  });
});

describe('SideDataSubSourceErrors field-name canary', () => {
  const errors: SideDataSubSourceErrors = {
    categories: 'fetch timeout',
    fdv: 'rate limited',
    forecast: 'parse error',
    campaignAccess: 'unauthorized',
  };

  it('errors.categories is an optional string', () => {
    expect(typeof errors.categories).toBe('string');
  });

  it('errors.fdv is an optional string', () => {
    expect(typeof errors.fdv).toBe('string');
  });

  it('errors.forecast is an optional string', () => {
    expect(typeof errors.forecast).toBe('string');
  });

  it('errors.campaignAccess is an optional string', () => {
    expect(typeof errors.campaignAccess).toBe('string');
  });
});

describe('SideDataMetaResponse.errors field-name canary (partial removed)', () => {
  const meta: SideDataMetaResponse = {
    errors: { fdv: 'rate limited' },
  };

  it('meta.errors is an optional SideDataSubSourceErrors', () => {
    expect(typeof meta.errors?.fdv).toBe('string');
  });

  it('meta.partial is removed from type', () => {
    expect('partial' in meta).toBe(false);
  });
});