import { describe, it, expect } from 'vitest';
import { getSubMarketLabel, getMarketChipLabel, getEthSubMarketLabel } from './marketLabels';

describe('getSubMarketLabel', () => {
  it('returns canonical name for V3 Ethereum markets', () => {
    expect(getSubMarketLabel('AaveV3Ethereum')).toBe('Core');
    expect(getSubMarketLabel('AaveV3EthereumLido')).toBe('Prime');
    expect(getSubMarketLabel('AaveV3EthereumEtherFi')).toBe('EtherFi');
    expect(getSubMarketLabel('AaveV3EthereumHorizon')).toBe('Horizon RWA');
  });

  it('strips AaveV4 prefix and splits camelCase for V4 markets', () => {
    expect(getSubMarketLabel('AaveV4EthereumMain')).toBe('Ethereum Main');
    expect(getSubMarketLabel('AaveV4EthereumLido')).toBe('Ethereum Lido');
    expect(getSubMarketLabel('AaveV4AvalancheMain')).toBe('Avalanche Main');
    expect(getSubMarketLabel('AaveV4AvalancheForex')).toBe('Avalanche Forex');
  });

  it('strips AaveV3 prefix and splits camelCase for V3 non-Ethereum markets', () => {
    expect(getSubMarketLabel('AaveV3Base')).toBe('Base');
    expect(getSubMarketLabel('AaveV3Arbitrum')).toBe('Arbitrum');
    expect(getSubMarketLabel('AaveV3Avalanche')).toBe('Avalanche');
  });

  it('returns marketName as fallback for unknown formats', () => {
    expect(getSubMarketLabel('UnknownMarket')).toBe('UnknownMarket');
  });
});

describe('getEthSubMarketLabel', () => {
  it('is deprecated and delegates to getSubMarketLabel', () => {
    expect(getEthSubMarketLabel('AaveV4AvalancheMain')).toBe('Avalanche Main');
    expect(getEthSubMarketLabel('AaveV3Ethereum')).toBe('Core');
  });
});

describe('getMarketChipLabel', () => {
  it('returns sub-market label for any market', () => {
    expect(getMarketChipLabel('AaveV4AvalancheMain', 'Avalanche')).toBe('Avalanche Main');
    expect(getMarketChipLabel('AaveV3Avalanche', 'Avalanche')).toBe('Avalanche');
    expect(getMarketChipLabel('AaveV4EthereumLido', 'Ethereum')).toBe('Ethereum Lido');
    expect(getMarketChipLabel('AaveV3Base', 'Base')).toBe('Base');
  });
});