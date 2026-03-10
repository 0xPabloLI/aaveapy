import { useEffect, useMemo, useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { useCoingeckoTokenImage } from '@/hooks/useCoingeckoTokenImage';
import { getPreloadedImageSource, getTokenIconSources } from '@/lib/preloadUtils';

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
  loading?: 'lazy' | 'eager';
  logoURI?: string;
}

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
  const defaultSrc = '/icons/tokens/default.svg';
  
  // Build list of local sources to try
  const localSources = useMemo(() => getTokenIconSources(symbol), [symbol]);
  const preloadedSrc = getPreloadedImageSource(localSources);
  
  // Start with the already warmed source when available.
  const initialSrc = preloadedSrc ?? localSources[0];
  const [src, setSrc] = useState(initialSrc);
  const [formatIndex, setFormatIndex] = useState(Math.max(localSources.indexOf(initialSrc), 0));
  const [needCoingeckoFallback, setNeedCoingeckoFallback] = useState(false);
  
  const { data: coingeckoImageUrl, isFetched: coingeckoFetched } = useCoingeckoTokenImage(
    needCoingeckoFallback ? symbol : null
  );

  useEffect(() => {
    const nextInitialSrc = getPreloadedImageSource(localSources) ?? localSources[0];
    setSrc(nextInitialSrc);
    setFormatIndex(Math.max(localSources.indexOf(nextInitialSrc), 0));
    setNeedCoingeckoFallback(false);
  }, [localSources]);

  useEffect(() => {
    if (!needCoingeckoFallback) return;
    if (coingeckoImageUrl) {
      setSrc(coingeckoImageUrl);
    } else if (coingeckoFetched) {
      setSrc(defaultSrc);
    }
  }, [needCoingeckoFallback, coingeckoImageUrl, coingeckoFetched]);

  const handleError = () => {
    // 1. Try logoURI from API if available
    if (logoURI && src !== logoURI) {
      setSrc(logoURI);
      return;
    }
    
    // 2. Try next local format (svg -> webp -> png)
    const nextIndex = formatIndex + 1;
    if (nextIndex < localSources.length && src !== defaultSrc) {
      setFormatIndex(nextIndex);
      setSrc(localSources[nextIndex]);
      return;
    }
    
    // 3. Try CoinGecko as last resort
    if (src !== defaultSrc && !needCoingeckoFallback) {
      setNeedCoingeckoFallback(true);
      return;
    }
    
    // 4. Fall back to default icon
    if (src !== defaultSrc) {
      setSrc(defaultSrc);
    }
  };

  return (
    <img
      src={src}
      alt={`${symbol} icon`}
      width={size}
      height={size}
      loading={loading}
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
