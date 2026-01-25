import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

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
  const localSrc = `/icons/tokens/${symbol.toLowerCase()}.svg`;
  const defaultSrc = '/icons/tokens/default.svg';
  const [src, setSrc] = useState(localSrc);

  useEffect(() => {
    setSrc(`/icons/tokens/${symbol.toLowerCase()}.svg`);
  }, [symbol]);

  const handleError = () => {
    if (logoURI && src !== logoURI) {
      setSrc(logoURI);
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
