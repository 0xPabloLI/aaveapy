import { chainIconMap, normalizeChainName } from './chainIconMap';
import { TOKEN_ICON_MANIFEST } from './tokenIconManifest.generated';

/**
 * Performance Optimization - Phase 3
 * Preload strategies for images and resources
 */

// Track preloaded images to avoid duplicates.
const preloadedImages = new Set<string>();
let preloadPaused = false;

export const TOKEN_ICON_FORMATS = ['svg', 'webp', 'png', 'jpg', 'jpeg'] as const;

type ConnectionInfo = {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
};

function getConnectionInfo(): ConnectionInfo | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection;
}

function shouldDeferPreload(): boolean {
  if (preloadPaused) return true;
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
}

export function setPreloadPaused(paused: boolean): void {
  preloadPaused = paused;
}

export function isPreloadPaused(): boolean {
  return preloadPaused;
}

export function getRecommendedPreloadLimit(totalCandidates: number): number {
  if (totalCandidates <= 0) return 0;

  const connection = getConnectionInfo();
  const saveData = connection?.saveData === true;
  const effectiveType = connection?.effectiveType;

  if (saveData) return Math.min(totalCandidates, 20);
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return Math.min(totalCandidates, 20);
  if (effectiveType === '3g') return Math.min(totalCandidates, 60);
  if (effectiveType === '4g') return Math.min(totalCandidates, 140);

  return Math.min(totalCandidates, 180);
}

export function shouldUseFullPreloadMode(): boolean {
  const connection = getConnectionInfo();
  if (!connection) return false;
  if (connection.saveData) return false;
  return connection.type === 'wifi';
}

export function getTokenIconSources(symbol: string): string[] {
  const symbolKey = symbol.trim().toLowerCase();
  const known = TOKEN_ICON_MANIFEST[symbolKey];
  if (known?.length) {
    return known.map((fmt) => `/icons/tokens/${symbolKey}.${fmt}`);
  }
  return TOKEN_ICON_FORMATS.map((fmt) => `/icons/tokens/${symbolKey}.${fmt}`);
}

export function getPreloadedImageSource(srcs: string[]): string | undefined {
  return srcs.find((src) => preloadedImages.has(src));
}

/**
 * Preload an image in the background
 * Uses requestIdleCallback for non-blocking loading
 */
export function preloadImage(src: string): Promise<void> {
  if (preloadedImages.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      preloadedImages.add(src);
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`Failed to preload: ${src}`));
    };
    img.src = src;
  });
}

export async function preloadFirstAvailableImage(srcs: string[]): Promise<void> {
  let lastError: Error | undefined;

  for (const src of srcs) {
    try {
      await preloadImage(src);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`Failed to preload: ${src}`);
    }
  }

  throw lastError ?? new Error('Failed to preload image sources.');
}

/**
 * Preload multiple images during idle time
 * Non-blocking, uses requestIdleCallback when available
 */
export function preloadImagesIdle(srcs: string[]): void {
  const uniqueSrcs = srcs.filter((src) => !preloadedImages.has(src));
  if (uniqueSrcs.length === 0) return;

  const loadNext = (index: number) => {
    if (index >= uniqueSrcs.length) return;
    if (shouldDeferPreload()) {
      setTimeout(() => loadNext(index), 300);
      return;
    }

    const scheduleNext = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => loadNext(index + 1), { timeout: 2000 });
      } else {
        setTimeout(() => loadNext(index + 1), 50);
      }
    };

    preloadImage(uniqueSrcs[index])
      .then(scheduleNext)
      .catch(scheduleNext); // Continue even if one fails
  };

  // Start preloading after a short delay to not interfere with initial render
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => loadNext(0), { timeout: 3000 });
  } else {
    setTimeout(() => loadNext(0), 100);
  }
}

export function preloadFallbackImagesIdle(srcGroups: string[][]): void {
  const uniqueGroups = srcGroups
    .map((srcs) => srcs.filter((src) => !preloadedImages.has(src)))
    .filter((srcs) => srcs.length > 0);

  if (uniqueGroups.length === 0) return;

  const loadNext = (index: number) => {
    if (index >= uniqueGroups.length) return;
    if (shouldDeferPreload()) {
      setTimeout(() => loadNext(index), 300);
      return;
    }

    const scheduleNext = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => loadNext(index + 1), { timeout: 2000 });
      } else {
        setTimeout(() => loadNext(index + 1), 50);
      }
    };

    preloadFirstAvailableImage(uniqueGroups[index])
      .then(scheduleNext)
      .catch(scheduleNext);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => loadNext(0), { timeout: 3000 });
  } else {
    setTimeout(() => loadNext(0), 100);
  }
}

/**
 * Preload token icons for a list of symbols
 * Used to warm up icon cache before they're visible
 */
export function preloadTokenIcons(symbols: string[]): void {
  const iconSourceGroups = symbols.flatMap((symbol) => {
    const parts = symbol.split('_').map((part) => part.trim()).filter(Boolean);
    return parts.map((part) => getTokenIconSources(part));
  });

  preloadFallbackImagesIdle(iconSourceGroups);
}

/**
 * Preload chain/network icons
 */
export function preloadChainIcons(chains: string[]): void {
  const iconSrcs = chains
    .map(normalizeChainName)
    .map((normalized) => chainIconMap[normalized])
    .filter((iconName): iconName is string => !!iconName)
    .map((iconName) => `/icons/networks/${iconName}.svg`);

  preloadImagesIdle([...new Set(iconSrcs)]);
}

/**
 * Preload critical above-the-fold images immediately
 * For hero/header images that should load ASAP
 */
export function preloadCriticalImages(srcs: string[]): void {
  srcs.forEach((src) => {
    if (preloadedImages.has(src)) return;

    // Use link preload for critical images
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);

    preloadedImages.add(src);
  });
}

/**
 * Check if an image is already preloaded/cached
 */
export function isImagePreloaded(src: string): boolean {
  return preloadedImages.has(src);
}

/**
 * Preload incentive-related icons (partner logos, source icons)
 * Called after initial page load to ensure they're ready when tooltip opens
 */
export function preloadIncentiveIcons(): void {
  const incentiveIcons = [
    // Partner logos (light theme)
    '/icons/partners/aci-black.svg',
    '/icons/partners/brevis-black.svg',
    '/icons/partners/merkl-black.svg',
    // Partner logos (dark theme)
    '/icons/partners/aci-white.svg',
    '/icons/partners/brevis-white.svg',
    '/icons/partners/merkl-white.svg',
    // Protocol icon
    '/icons/tokens/aave.svg',
  ];

  preloadImagesIdle(incentiveIcons);
}
