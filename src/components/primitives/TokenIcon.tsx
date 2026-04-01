import {
  useEffect,
  useMemo,
  useState,
  memo,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react';
import { cn } from '@/lib/utils';
import { useCoingeckoTokenImage } from '@/hooks/useCoingeckoTokenImage';
import {
  getPreloadedImageSource,
  getTokenIconSources,
  TOKEN_ICON_DEFAULT_SRC,
} from '@/lib/preloadUtils';

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
  loading?: 'lazy' | 'eager';
  logoURI?: string;
}

// Global cache: maps symbolKey → verified working src URL.
// Survives across component mount/unmount cycles so re-mounted icons
// skip fallback probing and avoid redundant network requests.
const resolvedSrcCache = new Map<string, string>();

// Only log once per symbol when all formats (and CoinGecko) have been tried and failed.
const missingIconLogged = new Set<string>();

const resolveInitialState = (symbolKey: string, localSources: string[]) => {
  const cached = resolvedSrcCache.get(symbolKey);
  if (cached) {
    const cachedIndex = localSources.indexOf(cached);
    return {
      src: cached,
      formatIndex: cachedIndex >= 0 ? cachedIndex : 0,
      isResolved: true,
    };
  }

  const preloadedSrc = getPreloadedImageSource(localSources);
  if (preloadedSrc) {
    return {
      src: preloadedSrc,
      formatIndex: Math.max(localSources.indexOf(preloadedSrc), 0),
      isResolved: true,
    };
  }

  return {
    src: localSources[0],
    formatIndex: 0,
    isResolved: false,
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
  const localSources = useMemo(() => getTokenIconSources(symbol), [symbol]);
  const initial = useMemo(() => resolveInitialState(symbolKey, localSources), [symbolKey, localSources]);
  const [src, setSrc] = useState(initial.src);
  const [formatIndex, setFormatIndex] = useState(initial.formatIndex);
  const [needCoingeckoFallback, setNeedCoingeckoFallback] = useState(false);

  // If src is already resolved via cache/preload, force eager loading.
  const effectiveLoading = initial.isResolved ? 'eager' : loading;

  const { data: coingeckoImageUrl, isFetched: coingeckoFetched } = useCoingeckoTokenImage(
    needCoingeckoFallback ? symbol : null
  );

  useEffect(() => {
    const next = resolveInitialState(symbolKey, localSources);
    setSrc(next.src);
    setFormatIndex(next.formatIndex);
    setNeedCoingeckoFallback(false);
  }, [symbolKey, localSources]);

  useEffect(() => {
    if (!needCoingeckoFallback) return;
    if (coingeckoImageUrl) {
      setSrc(coingeckoImageUrl);
    } else if (coingeckoFetched) {
      setSrc(TOKEN_ICON_DEFAULT_SRC);
    }
  }, [needCoingeckoFallback, coingeckoImageUrl, coingeckoFetched]);

  const imgRef = useRef<HTMLImageElement>(null);
  const [foregroundLoaded, setForegroundLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = imgRef.current;
    if (!el) {
      setForegroundLoaded(false);
      return;
    }
    if (el.complete && el.naturalWidth > 0) {
      setForegroundLoaded(true);
    } else {
      setForegroundLoaded(false);
    }
  }, [src]);

  const handleLoad = useCallback(() => {
    setForegroundLoaded(true);
    if (src && src !== TOKEN_ICON_DEFAULT_SRC) {
      resolvedSrcCache.set(symbolKey, src);
    }
  }, [symbolKey, src]);

  const handleError = useCallback(() => {
    // 1. Try logoURI from API if available
    if (logoURI && src !== logoURI) {
      setSrc(logoURI);
      return;
    }

    // 2. Try next local format (order from getTokenIconSources / manifest)
    const nextIndex = formatIndex + 1;
    if (nextIndex < localSources.length && src !== TOKEN_ICON_DEFAULT_SRC) {
      setFormatIndex(nextIndex);
      setSrc(localSources[nextIndex]);
      return;
    }

    // 3. Try CoinGecko as last resort
    if (src !== TOKEN_ICON_DEFAULT_SRC && !needCoingeckoFallback) {
      setNeedCoingeckoFallback(true);
      return;
    }

    // 4. Fall back to default icon — log once per symbol after all formats tried
    if (src !== TOKEN_ICON_DEFAULT_SRC) {
      if (!missingIconLogged.has(symbolKey)) {
        missingIconLogged.add(symbolKey);
        const tried = [...localSources];
        if (needCoingeckoFallback) tried.push('CoinGecko');
        console.warn(
          `[TokenIcon] No icon found for "${symbol}" (tried: ${tried.join(', ')}; using default).`
        );
      }
      setSrc(TOKEN_ICON_DEFAULT_SRC);
    }
  }, [symbol, symbolKey, logoURI, src, formatIndex, localSources, needCoingeckoFallback]);

  const showDefaultUnderlay = src !== TOKEN_ICON_DEFAULT_SRC;

  return (
    <div
      className={cn('relative inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size }}
    >
      {showDefaultUnderlay ? (
        <img
          src={TOKEN_ICON_DEFAULT_SRC}
          alt=""
          aria-hidden
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          className="pointer-events-none absolute inset-0 size-full rounded-full object-contain opacity-25 saturate-0"
        />
      ) : null}
      <img
        ref={imgRef}
        src={src}
        alt={`${symbol} icon`}
        width={size}
        height={size}
        loading={effectiveLoading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'relative z-10 size-full rounded-full object-contain',
          showDefaultUnderlay && 'transition-opacity duration-150 ease-out',
          showDefaultUnderlay && !foregroundLoaded ? 'opacity-0' : 'opacity-100',
        )}
      />
    </div>
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
