import { describe, it, expect } from 'vitest';
import {
  buildAaveV4MarketUrl,
  buildAaveV4HubUrl,
  buildAaveV4Url,
  buildAaveV4AssetUrl,
  buildAaveUrl,
} from './aaveLinks';

describe('buildAaveV4MarketUrl', () => {
  it('returns correct spoke URL when spokeId is present', () => {
    const url = buildAaveV4MarketUrl({ spokeId: 'MTo6MHhDY2E4NTJCYzQ' });
    expect(url).toBe('https://pro.aave.com/explore/market/MTo6MHhDY2E4NTJCYzQ');
  });

  it('returns null when spokeId is undefined', () => {
    expect(buildAaveV4MarketUrl({})).toBeNull();
  });

  it('returns null when spokeId is empty string', () => {
    expect(buildAaveV4MarketUrl({ spokeId: '' })).toBeNull();
  });
});

describe('buildAaveV4HubUrl', () => {
  it('returns correct hub URL when hubId is present', () => {
    const url = buildAaveV4HubUrl({ hubId: 'hub-core' });
    expect(url).toBe('https://pro.aave.com/explore/hub/hub-core');
  });

  it('returns null when hubId is undefined', () => {
    expect(buildAaveV4HubUrl({})).toBeNull();
  });

  it('returns null when hubId is empty string', () => {
    expect(buildAaveV4HubUrl({ hubId: '' })).toBeNull();
  });
});

describe('buildAaveV4Url', () => {
  it('returns correct reserve URL when aaveProReserveId is present', () => {
    const url = buildAaveV4Url({ aaveProReserveId: 'reserve-abc' });
    expect(url).toBe('https://pro.aave.com/explore/reserve/reserve-abc');
  });

  it('returns null when aaveProReserveId is undefined', () => {
    expect(buildAaveV4Url({})).toBeNull();
  });
});

describe('buildAaveV4AssetUrl', () => {
  it('returns correct asset URL for known chain', () => {
    const url = buildAaveV4AssetUrl({
      tokenAddress: '0xABC',
      chainName: 'Ethereum',
    });
    expect(url).toBe('https://pro.aave.com/explore/asset/1/0xabc');
  });

  it('returns null when chainName is missing', () => {
    expect(buildAaveV4AssetUrl({ tokenAddress: '0xABC' })).toBeNull();
  });

  it('returns null when tokenAddress is empty', () => {
    expect(buildAaveV4AssetUrl({ tokenAddress: '', chainName: 'Ethereum' })).toBeNull();
  });

  it('returns null for unknown chain', () => {
    expect(buildAaveV4AssetUrl({ tokenAddress: '0xABC', chainName: 'Unknown' })).toBeNull();
  });
});

describe('buildAaveUrl', () => {
  it('returns V3 URL when no V4 reserve ID', () => {
    const url = buildAaveUrl({
      marketName: 'AaveV3Ethereum',
      tokenAddress: '0x123',
    });
    expect(url).toContain('app.aave.com');
  });

  it('returns V4 URL when aaveProReserveId is present and V3 is also available', () => {
    const url = buildAaveUrl({
      marketName: 'AaveV3Ethereum',
      tokenAddress: '0x123',
      aaveProReserveId: 'v4-reserve',
    });
    expect(url).toContain('pro.aave.com');
    expect(url).toBe('https://pro.aave.com/explore/reserve/v4-reserve');
  });
});
