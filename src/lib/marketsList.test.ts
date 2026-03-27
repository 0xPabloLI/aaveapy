import { describe, expect, it } from 'vitest';

import type { MarketsResponse } from '@/types/aave';

import { buildMarketsList } from './marketsList';

const response: MarketsResponse = {
  snapshot: { lastUpdated: '2026-03-09T00:00:00.000Z', version: '1.0' },
  reserves: [
    {
      marketName: 'AaveV3Base',
      chainName: 'Base',
      chainId: 8453,
      tokenName: 'USD Coin',
      tokenSymbol: 'USDC',
      tokenAddress: '0x1',
    },
    {
      marketName: 'AaveV3Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'Wrapped Ether',
      tokenSymbol: 'WETH',
      tokenAddress: '0x2',
    },
    {
      marketName: 'AaveV3Base',
      chainName: 'Base',
      chainId: 8453,
      tokenName: 'Wrapped Ether',
      tokenSymbol: 'WETH',
      tokenAddress: '0x3',
    },
    {
      marketName: 'AaveV3Arbitrum',
      chainName: 'Arbitrum',
      chainId: 42161,
      tokenName: 'Tether USD',
      tokenSymbol: 'USDT',
      tokenAddress: '0x4',
    },
  ],
};

describe('buildMarketsList', () => {
  it('derives unique market-chain pairs and sorts by market name', () => {
    expect(buildMarketsList(response)).toEqual([
      { marketName: 'AaveV3Arbitrum', chainName: 'Arbitrum' },
      { marketName: 'AaveV3Base', chainName: 'Base' },
      { marketName: 'AaveV3Ethereum', chainName: 'Ethereum' },
    ]);
  });
});
