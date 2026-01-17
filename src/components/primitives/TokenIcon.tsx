import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
  loading?: 'lazy' | 'eager';
}

const TokenImage = ({
  symbol,
  className,
  size,
  loading = 'lazy',
}: {
  symbol: string;
  className?: string;
  size: number;
  loading?: 'lazy' | 'eager';
}) => {
  const [tokenSymbol, setTokenSymbol] = useState(symbol.toLowerCase());

  useEffect(() => {
    setTokenSymbol(symbol.toLowerCase());
  }, [symbol]);

  return (
    <img
      src={`/icons/tokens/${tokenSymbol}.svg`}
      alt={`${symbol} icon`}
      width={size}
      height={size}
      loading={loading}
      onError={() => setTokenSymbol('default')}
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
        className="border border-white"
      />
    ))}
  </div>
);

export const TokenIcon = ({
  symbol,
  className,
  size = 32,
  loading = 'lazy',
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
    />
  );
};
