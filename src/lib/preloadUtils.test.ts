import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRecommendedPreloadLimit } from './preloadUtils';

const loadOutcomes = new Map<string, boolean>();

class FakeImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(value: string) {
    queueMicrotask(() => {
      if (loadOutcomes.get(value)) {
        this.onload?.();
        return;
      }

      this.onerror?.();
    });
  }
}

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

describe('preload image fallback tracking', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    loadOutcomes.clear();
    vi.stubGlobal('Image', FakeImage);
  });

  it('remembers the first available fallback source for png-only token icons', async () => {
    const sources = [
      '/icons/tokens/aammdai.svg',
      '/icons/tokens/aammdai.webp',
      '/icons/tokens/aammdai.png',
    ];

    loadOutcomes.set(sources[0], false);
    loadOutcomes.set(sources[1], false);
    loadOutcomes.set(sources[2], true);

    const { getPreloadedImageSource, preloadFirstAvailableImage } = await import('./preloadUtils');

    await preloadFirstAvailableImage(sources);

    expect(getPreloadedImageSource(sources)).toBe(sources[2]);
  });
});
