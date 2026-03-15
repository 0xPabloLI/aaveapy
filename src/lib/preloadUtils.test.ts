import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRecommendedPreloadLimit, shouldUseFullPreloadMode } from './preloadUtils';

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

describe('shouldUseFullPreloadMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables full mode only on wifi when save-data is off', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, type: 'wifi', effectiveType: '4g' } });
    expect(shouldUseFullPreloadMode()).toBe(true);
  });

  it('disables full mode when save-data is on', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true, type: 'wifi', effectiveType: '4g' } });
    expect(shouldUseFullPreloadMode()).toBe(false);
  });

  it('disables full mode on non-wifi networks', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, type: 'cellular', effectiveType: '4g' } });
    expect(shouldUseFullPreloadMode()).toBe(false);
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

  it('includes jpg and jpeg token icon fallbacks', async () => {
    const { getTokenIconSources } = await import('./preloadUtils');
    const sources = getTokenIconSources('aammdai');

    expect(sources).toEqual([
      '/icons/tokens/aammdai.svg',
      '/icons/tokens/aammdai.webp',
      '/icons/tokens/aammdai.png',
      '/icons/tokens/aammdai.jpg',
      '/icons/tokens/aammdai.jpeg',
    ]);
  });
});
