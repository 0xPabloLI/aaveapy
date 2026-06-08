import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('portfolioPrefetch with snapshot disabled', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('prefetchPortfolioCompareView returns undefined when snapshot flag is false', async () => {
    const { features } = await import('@/config/features');
    expect(features.snapshot).toBe(false);

    const { prefetchPortfolioCompareView } = await import('./portfolioPrefetch');
    const result = prefetchPortfolioCompareView();
    expect(result).toBeUndefined();
  });

  it('prefetchPortfolioPanel does not throw when snapshot flag is false', async () => {
    const { prefetchPortfolioPanel } = await import('./portfolioPrefetch');
    expect(() => prefetchPortfolioPanel()).not.toThrow();
  });
});
