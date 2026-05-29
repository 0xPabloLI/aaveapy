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

  it('returns only manifest-known formats for symbols that have icons', async () => {
    const { getTokenIconSources } = await import('./preloadUtils');
    expect(getTokenIconSources('aammdai')).toEqual(['/icons/tokens/aammdai.png']);
    expect(getTokenIconSources('acred')).toEqual(['/icons/tokens/acred.png']);
  });

  it('falls back to all formats for symbols not in manifest', async () => {
    const { getTokenIconSources, TOKEN_ICON_FORMATS } = await import('./preloadUtils');
    const unknown = 'nonexistent-symbol-xyz';
    const sources = getTokenIconSources(unknown);
    expect(sources.length).toBe(TOKEN_ICON_FORMATS.length);
    expect(sources).toEqual(
      TOKEN_ICON_FORMATS.map((fmt) => `/icons/tokens/${unknown}.${fmt}`)
    );
  });
});

describe('getTokenIconSymbolKeys', () => {
  it('returns plain key for standard symbol', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('USDC')).toEqual(['usdc']);
  });

  it('adds SYMBOL_MAP fallback for variant symbols (Celo USDT)', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('USD₮')).toEqual(['usd₮', 'usdt']);
  });

  it('adds SYMBOL_MAP fallback for bridge-prefixed symbols (Avalanche)', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('USDT.e')).toEqual(['usdt.e', 'usdt']);
    expect(getTokenIconSymbolKeys('USDC.e')).toEqual(['usdc.e', 'usdc']);
  });

  it('adds SYMBOL_MAP fallback for Metis prefixed symbols', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('m.USDT')).toEqual(['m.usdt', 'usdt']);
  });

  it('does not duplicate when mapped key equals original', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('USDT')).toEqual(['usdt']);
  });

  it('still resolves PT tokens with upstream mapping', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    const keys = getTokenIconSymbolKeys('pt-susde-28may2026');
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys[0]).toBe('ptsusde');
    expect(keys[1]).toBe('susde');
  });

  it('resolves PT tokens without upstream mapping', async () => {
    const { getTokenIconSymbolKeys } = await import('./preloadUtils');
    expect(getTokenIconSymbolKeys('pt-usdg-28may2026')).toEqual(['ptusdg', 'usdg']);
  });
});
