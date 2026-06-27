import { describe, expect, it } from 'vitest';

describe('address-book package migration (@bgd-labs → @aave-dao)', () => {
  it('package.json uses @aave-dao/aave-address-book (not old bgd-labs)', async () => {
    const pkg = await import('../../package.json');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['@bgd-labs/aave-address-book']).toBeUndefined();
    expect(deps['@aave-dao/aave-address-book']).toBeDefined();
  });

  it('can import named exports from @aave-dao/aave-address-book', async () => {
    const {
      AaveV3Ethereum,
      AaveV3Arbitrum,
      AaveV3Polygon,
      AaveV3Base,
    } = await import('@aave-dao/aave-address-book');

    expect(AaveV3Ethereum).toBeDefined();
    expect(AaveV3Ethereum.POOL).toBeTypeOf('string');
    expect(AaveV3Ethereum.POOL).toMatch(/^0x[a-fA-F0-9]{40}$/);

    expect(AaveV3Arbitrum).toBeDefined();
    expect(AaveV3Arbitrum.POOL).toBeTypeOf('string');
    expect(AaveV3Arbitrum.POOL).toMatch(/^0x[a-fA-F0-9]{40}$/);

    expect(AaveV3Polygon).toBeDefined();
    expect(AaveV3Polygon.POOL).toMatch(/^0x[a-fA-F0-9]{40}$/);

    expect(AaveV3Base).toBeDefined();
    expect(AaveV3Base.POOL).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('known Ethereum pool address is unchanged after migration', async () => {
    const { AaveV3Ethereum } = await import('@aave-dao/aave-address-book');
    expect(AaveV3Ethereum.POOL).toBe('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2');
  });
});