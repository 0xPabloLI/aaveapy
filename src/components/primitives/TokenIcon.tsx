import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCoingeckoTokenImage } from '@/hooks/useCoingeckoTokenImage';

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
  loading?: 'lazy' | 'eager';
  logoURI?: string;
}

const TokenImage = ({
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
  const localSvg = `/icons/tokens/${symbolKey}.svg`;
  const localPng = `/icons/tokens/${symbolKey}.png`;
  const defaultSrc = '/icons/tokens/default.svg';
  const [src, setSrc] = useState(localSvg);
  const [triedPng, setTriedPng] = useState(false);
  const [needCoingeckoFallback, setNeedCoingeckoFallback] = useState(false);
  const { data: coingeckoImageUrl, isFetched: coingeckoFetched } = useCoingeckoTokenImage(
    needCoingeckoFallback ? symbol : null
  );

  useEffect(() => {
    setSrc(`/icons/tokens/${symbolKey}.svg`);
    setTriedPng(false);
    setNeedCoingeckoFallback(false);
  }, [symbolKey]);

  useEffect(() => {
    if (!needCoingeckoFallback) return;
    if (coingeckoImageUrl) {
      setSrc(coingeckoImageUrl);
    } else if (coingeckoFetched) {
      setSrc(defaultSrc);
    }
  }, [needCoingeckoFallback, coingeckoImageUrl, coingeckoFetched]);

  const handleError = () => {
    if (logoURI && src !== logoURI) {
      setSrc(logoURI);
      return;
    }
    if (!triedPng && (src === localSvg || src === localPng)) {
      setTriedPng(true);
      setSrc(localPng);
      return;
    }
    if (src !== defaultSrc && !needCoingeckoFallback) {
      setNeedCoingeckoFallback(true);
      return;
    }
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
};

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

export const TokenIcon = ({
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
};
