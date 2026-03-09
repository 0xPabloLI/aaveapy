import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useCoingeckoTokenImage } from '@/hooks/useCoingeckoTokenImage';
import { isImagePreloaded } from '@/lib/preloadUtils';

// Priority order for token icon formats (SVG first, then WebP for better compression)
const IMAGE_FORMATS = ['svg', 'webp', 'png'] as const;

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
  loading?: 'lazy' | 'eager';
  logoURI?: string;
}

const DEFAULT_SRC = '/icons/tokens/default.svg';

// Global cache: maps symbolKey → verified working src URL.
// Survives across component mount/unmount cycles so re-mounted icons
// skip the fallback chain and avoid redundant network requests.
const resolvedSrcCache = new Map<string, string>();

/**
 * Resolve the best initial src for a token symbol.
 * If a previous instance already resolved this symbol, reuse that src.
 * Otherwise fall back to the default SVG path.
 */
const resolveInitialState = (symbolKey: string) => {
  const cached = resolvedSrcCache.get(symbolKey);
  if (cached) {
    return { src: cached, formatIndex: 0, isResolved: true };
  }
  const svgPath = `/icons/tokens/${symbolKey}.svg`;
  return {
    src: svgPath,
    formatIndex: 0,
    isResolved: isImagePreloaded(svgPath),
  };
};

const TokenImage = memo(({
  symbol,
  className,
  size,
  loading = 'lazy',
  logoURI,
}: {
  symbol: string;
  className?: string;
  size: number;
  loading?: 'lazy' | 'eager';
  logoURI?: string;
}) => {
  const symbolKey = symbol.toLowerCase();

  const localSources = useMemo(() =>
    IMAGE_FORMATS.map(fmt => `/icons/tokens/${symbolKey}.${fmt}`),
    [symbolKey]
  );

  const initial = useMemo(() => resolveInitialState(symbolKey), [symbolKey]);
  const [src, setSrc] = useState(initial.src);
  const [formatIndex, setFormatIndex] = useState(initial.formatIndex);
  const [needCoingeckoFallback, setNeedCoingeckoFallback] = useState(false);

  // If already resolved or preloaded, force eager loading
  const effectiveLoading = initial.isResolved ? 'eager' : loading;

  const { data: coingeckoImageUrl, isFetched: coingeckoFetched } = useCoingeckoTokenImage(
    needCoingeckoFallback ? symbol : null
  );

  useEffect(() => {
    const next = resolveInitialState(symbolKey);
    setSrc(next.src);
    setFormatIndex(next.formatIndex);
    setNeedCoingeckoFallback(false);
  }, [symbolKey]);

  useEffect(() => {
    if (!needCoingeckoFallback) return;
    if (coingeckoImageUrl) {
      setSrc(coingeckoImageUrl);
    } else if (coingeckoFetched) {
      setSrc(DEFAULT_SRC);
    }
  }, [needCoingeckoFallback, coingeckoImageUrl, coingeckoFetched]);

  // Persist verified src into global cache on successful load
  const handleLoad = useCallback(() => {
    if (src && src !== DEFAULT_SRC) {
      resolvedSrcCache.set(symbolKey, src);
    }
  }, [symbolKey, src]);

  const handleError = useCallback(() => {
    // 1. Try logoURI from API if available
    if (logoURI && src !== logoURI) {
      setSrc(logoURI);
      return;
    }

    // 2. Try next local format (svg -> webp -> png)
    const nextIndex = formatIndex + 1;
    if (nextIndex < localSources.length && src !== DEFAULT_SRC) {
      setFormatIndex(nextIndex);
      setSrc(localSources[nextIndex]);
      return;
    }

    // 3. Try CoinGecko as last resort
    if (src !== DEFAULT_SRC && !needCoingeckoFallback) {
      setNeedCoingeckoFallback(true);
      return;
    }

    // 4. Fall back to default icon
    if (src !== DEFAULT_SRC) {
      setSrc(DEFAULT_SRC);
    }
  }, [logoURI, src, formatIndex, localSources, needCoingeckoFallback]);

  return (
    <img
      src={src}
      alt={`${symbol} icon`}
      width={size}
      height={size}
      loading={effectiveLoading}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      className={cn('rounded-full object-contain', className)}
    />
  );
});

TokenImage.displayName = 'TokenImage';

const MultiTokenIcon = ({
  symbols,
  size,
  className,
  loading,
}: {
  symbols: string[];
  size: number;
  className?: string;
  loading?: 'lazy' | 'eager';
}) => (
  <div className={cn('flex items-center -space-x-2', className)}>
    {symbols.map((symbol, index) => (
      <TokenImage
        key={`${symbol}-${index}`}
        symbol={symbol}
        size={size}
        loading={loading}
        className="border border-background"
      />
    ))}
  </div>
);

export const TokenIcon = memo(({
  symbol,
  className,
  size = 32,
  loading = 'lazy',
  logoURI,
}: TokenIconProps) => {
  const symbols = useMemo(
    () => symbol.split('_').map((part) => part.trim()).filter(Boolean),
    [symbol]
  );

  if (symbols.length > 1) {
    return <MultiTokenIcon symbols={symbols} size={size} className={className} loading={loading} />;
  }

  return (
    <TokenImage
      symbol={symbols[0] ?? symbol}
      size={size}
      loading={loading}
      className={className}
      logoURI={logoURI}
    />
  );
});

TokenIcon.displayName = 'TokenIcon';
