 import { useEffect, useRef } from 'react';
 import { ReserveWithSpread } from '@/types/aave';
 import { preloadTokenIcons, preloadChainIcons } from '@/lib/preloadUtils';
 import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
 
 /**
  * Hook to preload token and chain icons for reserves
  * Runs during idle time to warm up image cache
  */
 export function usePreloadReserveAssets(
   reserves: ReserveWithSpread[] | undefined,
   options: {
     /** Only preload first N reserves' icons */
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
     if (!enabled || !reserves || reserves.length === 0 || hasPreloaded.current) {
       return;
     }
 
     const timeoutId = setTimeout(() => {
       const reservesToPreload = reserves.slice(0, limit);
 
       // Extract unique token symbols
       const tokenSymbols = reservesToPreload.map(reserve => {
         const { iconSymbol } = fetchIconSymbolAndName({
           underlyingAsset: reserve.tokenAddress,
           symbol: reserve.tokenSymbol,
           name: reserve.tokenSymbol,
         });
         return iconSymbol;
       });
 
       // Extract unique chain names
       const chainNames = [...new Set(reservesToPreload.map(reserve => reserve.chainName))];
 
       // Preload in background
       preloadTokenIcons(tokenSymbols);
       preloadChainIcons(chainNames);
 
       hasPreloaded.current = true;
     }, delay);
 
     return () => clearTimeout(timeoutId);
   }, [reserves, limit, delay, enabled]);
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