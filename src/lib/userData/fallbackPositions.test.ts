import { describe, it, expect, vi, beforeEach } from 'vitest';

const v3Mocks = vi.hoisted(() => ({ getV3UserPositionsMultiChain: vi.fn() }));
const v4Mocks = vi.hoisted(() => ({ getV4UserPositionsAllSpokes: vi.fn() }));

vi.mock('./aaveV3UserClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./aaveV3UserClient')>();
  return { ...actual, getV3UserPositionsMultiChain: v3Mocks.getV3UserPositionsMultiChain };
});

vi.mock('./aaveV4UserClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./aaveV4UserClient')>();
  return { ...actual, getV4UserPositionsAllSpokes: v4Mocks.getV4UserPositionsAllSpokes };
});

import { fetchFallbackPositions } from './fallbackPositions';

const USER = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`;

describe('fetchFallbackPositions RPC session sharing (AAV-1313)', () => {
  beforeEach(() => {
    v3Mocks.getV3UserPositionsMultiChain.mockReset();
    v4Mocks.getV4UserPositionsAllSpokes.mockReset();
    v3Mocks.getV3UserPositionsMultiChain.mockResolvedValue({ results: [], errors: [] });
    v4Mocks.getV4UserPositionsAllSpokes.mockResolvedValue({ results: [], errors: [] });
  });

  it('hands one read session to both the V3 and the V4 leg of a sync', async () => {
    await fetchFallbackPositions(
      {
        userAddress: USER,
        reserves: [],
        v3AssetsByMarket: { AaveV3Ethereum: { chainId: 1, assets: [DAI] } },
        v4ReservesBySpoke: {},
        v4ChainIds: [1],
      },
      {},
      { v3Prefix: 'onchain-v3', v4Prefix: 'onchain-v4' },
    );

    expect(v3Mocks.getV3UserPositionsMultiChain).toHaveBeenCalledTimes(1);
    expect(v4Mocks.getV4UserPositionsAllSpokes).toHaveBeenCalledTimes(1);

    const v3Pool = v3Mocks.getV3UserPositionsMultiChain.mock.calls[0][2];
    const v4Pool = v4Mocks.getV4UserPositionsAllSpokes.mock.calls[0][4];

    expect(v3Pool).toBeDefined();
    expect(v3Pool).toBe(v4Pool);
  });

  it('creates a fresh session per call (no cross-request sharing)', async () => {
    const config = {
      userAddress: USER,
      reserves: [],
      v3AssetsByMarket: { AaveV3Ethereum: { chainId: 1, assets: [DAI] } },
      v4ReservesBySpoke: {},
      v4ChainIds: [1],
    };
    const labels = { v3Prefix: 'onchain-v3', v4Prefix: 'onchain-v4' };

    await fetchFallbackPositions(config, {}, labels);
    const firstPool = v3Mocks.getV3UserPositionsMultiChain.mock.calls[0][2];

    await fetchFallbackPositions(config, {}, labels);
    const secondPool = v3Mocks.getV3UserPositionsMultiChain.mock.calls[1][2];

    expect(firstPool).not.toBe(secondPool);
  });
});
