import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRecommendedPreloadLimit } from './preloadUtils';

describe('getRecommendedPreloadLimit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caps preload aggressively when save-data is enabled', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true, effectiveType: '4g' } });

    expect(getRecommendedPreloadLimit(300)).toBe(20);
  });

  it('uses medium cap for 3g connection', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '3g' } });

    expect(getRecommendedPreloadLimit(300)).toBe(60);
  });

  it('uses high cap when connection is fast and no save-data preference', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '4g' } });

    expect(getRecommendedPreloadLimit(300)).toBe(140);
  });
});
