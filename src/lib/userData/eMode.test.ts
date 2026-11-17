/**
 * AAV-1399 — eMode 目标提取与参数解析的纯函数测试。
 *
 * 这些用例只断言外部可观察的映射结果（poolKey / marketKey / effective 值），
 * 不触碰内部 Map 结构。
 */
import { describe, it, expect } from 'vitest';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import { buildEModeOverrides, effectiveLiquidationThreshold, effectiveLtv, extractV3EModeTargets } from './eMode';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

function makeReserve(overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread {
  return {
    reserveId: `1:${POOL.toLowerCase()}:${WETH.toLowerCase()}`,
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'Wrapped Ether',
    tokenSymbol: 'WETH',
    tokenAddress: WETH,
    ltv: 81,
    liquidationThreshold: 84,
    ...overrides,
  } as ReserveWithSpread;
}

function makeEntry(overrides: Partial<PortfolioReserveEntry> = {}): PortfolioReserveEntry {
  return {
    reserveId: `1:${POOL.toLowerCase()}:${WETH.toLowerCase()}`,
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenSymbol: 'WETH',
    supply: { amount: '100000', inputMode: 'usd', walletValue: null },
    borrow: { amount: '', inputMode: 'usd', walletValue: null },
    hidden: false,
    isOrphan: false,
    restrictedStatus: null,
    ...overrides,
  } as PortfolioReserveEntry;
}

describe('extractV3EModeTargets (AAV-1399)', () => {
  it('P3: skips hidden / orphan entries and entries without a matching reserve', () => {
    const reserve = makeReserve();
    const targets = extractV3EModeTargets(
      [makeEntry({ hidden: true }), makeEntry({ isOrphan: true }), makeEntry({ reserveId: 'missing' })],
      [reserve],
    );
    expect(targets).toHaveLength(0);
  });

  it('P4: V4 reserve (four-segment reserveId) is skipped', () => {
    const reserve = makeReserve({
      reserveId: '1:0x1111111111111111111111111111111111111111:0x2222222222222222222222222222222222222222:0x3333',
      marketName: 'AaveV4Main',
    });
    const targets = extractV3EModeTargets(
      [makeEntry({ reserveId: reserve.reserveId, marketName: 'AaveV4Main' })],
      [reserve],
    );
    expect(targets).toHaveLength(0);
  });

  it('P5: malformed reserveId / invalid pool address is skipped', () => {
    const badId = 'not-a-reserve-id';
    const badPool = '1:not-an-address:0x2222222222222222222222222222222222222222';
    const targets = extractV3EModeTargets(
      [makeEntry({ reserveId: badId }), makeEntry({ reserveId: badPool })],
      [makeReserve({ reserveId: badId }), makeReserve({ reserveId: badPool })],
    );
    expect(targets).toHaveLength(0);
  });

  it('P6: deduplicates multiple reserves on the same pool', () => {
    const usdc = makeReserve({
      reserveId: `1:${POOL.toLowerCase()}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
      tokenSymbol: 'USDC',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    const targets = extractV3EModeTargets(
      [makeEntry(), makeEntry({ reserveId: usdc.reserveId, tokenSymbol: 'USDC' })],
      [makeReserve(), usdc],
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].poolKey).toBe('1:AaveV3Ethereum');
  });

  it('P7: derives marketKey from reserveId with a lowercased pool address', () => {
    const targets = extractV3EModeTargets([makeEntry()], [makeReserve()]);
    expect(targets).toEqual([
      {
        chainId: 1,
        poolKey: '1:AaveV3Ethereum',
        marketKey: `1:${POOL.toLowerCase()}`,
        poolAddress: POOL.toLowerCase(),
      },
    ]);
  });

  it('P5b: mismatched reserveId chainId is treated as malformed', () => {
    const reserve = makeReserve({ chainId: 1, reserveId: `10:${POOL.toLowerCase()}:${WETH.toLowerCase()}` });
    const targets = extractV3EModeTargets([makeEntry({ chainId: 1, reserveId: reserve.reserveId })], [reserve]);
    expect(targets).toHaveLength(0);
  });
});

describe('buildEModeOverrides + effective LTV/LT (AAV-1399)', () => {
  const POOL_KEY = '1:AaveV3Ethereum';
  const MARKET_KEY = `1:${POOL.toLowerCase()}`;
  const TARGET = {
    chainId: 1,
    poolKey: POOL_KEY,
    marketKey: MARKET_KEY,
    poolAddress: POOL.toLowerCase() as `0x${string}`,
  };
  const ETH_CORRELATED = {
    id: 1,
    label: 'ETH correlated',
    maxLtv: 93,
    liquidationThreshold: 95,
    collateralReserves: [WETH.toLowerCase()],
  };

  function build(
    overrides: {
      categoryIds?: Map<string, number>;
      categories?: Map<string, (typeof ETH_CORRELATED)[]>;
      failed?: Set<string>;
    } = {},
  ) {
    return buildEModeOverrides({
      targets: [TARGET],
      categoryIdsByPool: overrides.categoryIds ?? new Map([[POOL_KEY, 1]]),
      categoriesByMarketKey: overrides.categories ?? new Map([[MARKET_KEY, [ETH_CORRELATED]]]),
      failedMarketKeys: overrides.failed,
    });
  }

  it('P8: category 0 → no params, no fallback, no API-shaped entry', () => {
    const { params, fallbackPools } = build({ categoryIds: new Map([[POOL_KEY, 0]]) });
    expect(params.size).toBe(0);
    expect(fallbackPools.size).toBe(0);
  });

  it('P9: category 1 with the matching payload builds 93/95 and lowercased members', () => {
    const { params } = build();
    const entry = params.get(POOL_KEY);
    expect(entry).toEqual({
      categoryId: 1,
      label: 'ETH correlated',
      maxLtv: 93,
      liquidationThreshold: 95,
      collateralReserves: new Set([WETH.toLowerCase()]),
    });
  });

  it('P10: payload missing the category id → fallback, no params', () => {
    const { params, fallbackPools } = build({
      categoryIds: new Map([[POOL_KEY, 2]]),
      categories: new Map([[MARKET_KEY, [ETH_CORRELATED]]]),
    });
    expect(params.size).toBe(0);
    expect(fallbackPools.has(POOL_KEY)).toBe(true);
  });

  it('P11: failed market key → fallback even when other data exists', () => {
    const { params, fallbackPools } = build({ failed: new Set([MARKET_KEY]) });
    expect(params.size).toBe(0);
    expect(fallbackPools.has(POOL_KEY)).toBe(true);
  });

  it('P12: unknown pool (no category read) → base, neither params nor fallback', () => {
    const { params, fallbackPools } = build({ categoryIds: new Map() });
    expect(params.size).toBe(0);
    expect(fallbackPools.size).toBe(0);
  });

  it('P13: effectiveLtv: member → category maxLtv, non-member → 0, no override → base', () => {
    const { params } = build();
    const weth = { chainId: 1, marketName: 'AaveV3Ethereum', tokenAddress: WETH, ltv: 81, liquidationThreshold: 84 };
    const usdc = {
      chainId: 1,
      marketName: 'AaveV3Ethereum',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ltv: 75,
      liquidationThreshold: 78,
    };
    expect(effectiveLtv(weth, params)).toBe(93);
    expect(effectiveLtv(usdc, params)).toBe(0);
    expect(effectiveLtv(weth, undefined)).toBe(81);
  });

  it('P14: effectiveLiquidationThreshold mirrors the membership rule', () => {
    const { params } = build();
    const weth = { chainId: 1, marketName: 'AaveV3Ethereum', tokenAddress: WETH, ltv: 81, liquidationThreshold: 84 };
    const usdc = {
      chainId: 1,
      marketName: 'AaveV3Ethereum',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ltv: 75,
      liquidationThreshold: 78,
    };
    expect(effectiveLiquidationThreshold(weth, params)).toBe(95);
    expect(effectiveLiquidationThreshold(usdc, params)).toBe(0);
    expect(effectiveLiquidationThreshold(weth, undefined)).toBe(84);
  });

  it('P15: membership is case-insensitive and a missing token address is conservative', () => {
    const { params } = build();
    const checksummed = { chainId: 1, marketName: 'AaveV3Ethereum', tokenAddress: WETH, ltv: 81 };
    const missing = { chainId: 1, marketName: 'AaveV3Ethereum', tokenAddress: undefined, ltv: 81 };
    expect(effectiveLtv(checksummed, params)).toBe(93);
    expect(effectiveLtv(missing, params)).toBe(0);
  });

  it('P16: a pool without an override keeps base values even when other pools have overrides', () => {
    const { params } = build();
    const otherPool = {
      chainId: 1,
      marketName: 'AaveV3EthereumLido',
      tokenAddress: WETH,
      ltv: 81,
      liquidationThreshold: 84,
    };
    expect(effectiveLtv(otherPool, params)).toBe(81);
    expect(effectiveLiquidationThreshold(otherPool, params)).toBe(84);
  });
});
