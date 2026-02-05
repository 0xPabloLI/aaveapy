 import { useEffect, useRef } from 'react';
 import { PoolWithSpread } from '@/types/aave';
 import { preloadTokenIcons, preloadChainIcons } from '@/lib/preloadUtils';
 import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
 
 /**
  * Hook to preload token and chain icons for pools
  * Runs during idle time to warm up image cache
  */
 export function usePreloadPoolAssets(
   pools: PoolWithSpread[] | undefined,
   options: {
     /** Only preload first N pools' icons */
     limit?: number;
     /** Delay before starting preload (ms) */
     delay?: number;
     /** Enable/disable preloading */
     enabled?: boolean;
   } = {}
 ): void {
   const { limit = 30, delay = 500, enabled = true } = options;
   const hasPreloaded = useRef(false);
 
   useEffect(() => {
     if (!enabled || !pools || pools.length === 0 || hasPreloaded.current) {
       return;
     }
 
     const timeoutId = setTimeout(() => {
       const poolsToPreload = pools.slice(0, limit);
 
       // Extract unique token symbols
       const tokenSymbols = poolsToPreload.map(pool => {
         const { iconSymbol } = fetchIconSymbolAndName({
           underlyingAsset: pool.tokenAddress,
           symbol: pool.tokenSymbol,
           name: pool.tokenSymbol,
         });
         return iconSymbol;
       });
 
       // Extract unique chain names
       const chainNames = [...new Set(poolsToPreload.map(pool => pool.chainName))];
 
       // Preload in background
       preloadTokenIcons(tokenSymbols);
       preloadChainIcons(chainNames);
 
       hasPreloaded.current = true;
     }, delay);
 
     return () => clearTimeout(timeoutId);
   }, [pools, limit, delay, enabled]);
 }
 
 /**
  * Hook to preload icons for pools that will be visible after user interaction
  * e.g., when user is about to scroll or expand a section
  */
 export function usePreloadOnHover(
   pools: PoolWithSpread[] | undefined,
   isHovering: boolean
 ): void {
   const hasPreloaded = useRef(false);
 
   useEffect(() => {
     if (!isHovering || !pools || pools.length === 0 || hasPreloaded.current) {
       return;
     }
 
     const tokenSymbols = pools.map(pool => {
       const { iconSymbol } = fetchIconSymbolAndName({
         underlyingAsset: pool.tokenAddress,
         symbol: pool.tokenSymbol,
         name: pool.tokenSymbol,
       });
       return iconSymbol;
     });
 
     const chainNames = [...new Set(pools.map(pool => pool.chainName))];
 
     preloadTokenIcons(tokenSymbols);
     preloadChainIcons(chainNames);
 
     hasPreloaded.current = true;
   }, [pools, isHovering]);
 }