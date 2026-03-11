import { useEffect, useRef } from 'react';
import { ReserveWithSpread } from '@/types/aave';
import { getRecommendedPreloadLimit, preloadTokenIcons, preloadChainIcons } from '@/lib/preloadUtils';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';

type PreloadMode = 'adaptive' | 'full';

/**
 * Hook to preload token and chain icons for reserves.
 * Triggers when `isSuccess` flips to true (data ready), not on a fixed timeout.
 */
export function usePreloadReserveAssets(
  reserves: ReserveWithSpread[] | undefined,
  options: {
    /** Only preload first N reserves' icons */
    limit?: number;
    /** Enable/disable preloading */
    enabled?: boolean;
    /** React Query isSuccess flag — preload fires once this becomes true */
    isSuccess?: boolean;
    /** adaptive: network-aware cap, full: eventually preload all reserves */
    preloadMode?: PreloadMode;
  } = {}
): void {
  const { limit, enabled = true, isSuccess = true, preloadMode = 'adaptive' } = options;
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!enabled || !isSuccess || !reserves || reserves.length === 0 || hasPreloaded.current) {
      return;
    }

    const resolvedLimit = limit
      ?? (preloadMode === 'full' ? reserves.length : getRecommendedPreloadLimit(reserves.length));
    const reservesToPreload = reserves.slice(0, resolvedLimit);

    const tokenSymbols = reservesToPreload.map(reserve => {
      const { iconSymbol } = fetchIconSymbolAndName({
        underlyingAsset: reserve.tokenAddress,
        symbol: reserve.tokenSymbol,
        name: reserve.tokenSymbol,
      });
      return iconSymbol;
    });

    const chainNames = [...new Set(reservesToPreload.map(reserve => reserve.chainName))];

    preloadTokenIcons(tokenSymbols);
    preloadChainIcons(chainNames);

    hasPreloaded.current = true;
  }, [reserves, limit, enabled, isSuccess, preloadMode]);
}

/**
 * Hook to preload icons for reserves that will be visible after user interaction
 * e.g., when user is about to scroll or expand a section
 */
export function usePreloadOnHover(
  reserves: ReserveWithSpread[] | undefined,
  isHovering: boolean
): void {
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!isHovering || !reserves || reserves.length === 0 || hasPreloaded.current) {
      return;
    }

    const tokenSymbols = reserves.map(reserve => {
      const { iconSymbol } = fetchIconSymbolAndName({
        underlyingAsset: reserve.tokenAddress,
        symbol: reserve.tokenSymbol,
        name: reserve.tokenSymbol,
      });
      return iconSymbol;
    });

    const chainNames = [...new Set(reserves.map(reserve => reserve.chainName))];

    preloadTokenIcons(tokenSymbols);
    preloadChainIcons(chainNames);

    hasPreloaded.current = true;
  }, [reserves, isHovering]);
}
