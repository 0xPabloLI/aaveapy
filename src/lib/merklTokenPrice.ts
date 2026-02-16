import type { TokenPricesIndex } from '@/types/aave';

type ForecastActionType = 'Supply' | 'Borrow' | 'Hold';

interface ResolveForecastTokenPriceInput {
  tokenPrices?: TokenPricesIndex;
  chainId: number;
  actionType: ForecastActionType;
  tokenAddress?: string | null;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
}

const toKey = (chainId: number, address: string): string =>
  `${chainId}:${address.toLowerCase()}`;

const pushIfPresent = (into: string[], value?: string | null) => {
  if (!value) return;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return;
  if (!into.includes(normalized)) into.push(normalized);
};

export const resolveForecastTokenPrice = ({
  tokenPrices,
  chainId,
  actionType,
  tokenAddress,
  aTokenAddress,
  vTokenAddress,
}: ResolveForecastTokenPriceInput): number | undefined => {
  if (!tokenPrices) return undefined;

  const candidates: string[] = [];
  pushIfPresent(candidates, tokenAddress);

  if (actionType === 'Borrow') {
    pushIfPresent(candidates, vTokenAddress);
    pushIfPresent(candidates, aTokenAddress);
  } else {
    pushIfPresent(candidates, aTokenAddress);
    pushIfPresent(candidates, vTokenAddress);
  }

  for (const address of candidates) {
    const entry = tokenPrices[toKey(chainId, address)];
    if (entry && Number.isFinite(entry.price)) {
      return entry.price;
    }
  }

  return undefined;
};
