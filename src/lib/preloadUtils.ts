 /**
  * Performance Optimization - Phase 3
  * Preload strategies for images and resources
  */
 
 // Track preloaded images to avoid duplicates
 const preloadedImages = new Set<string>();
 
 /**
  * Preload an image in the background
  * Uses requestIdleCallback for non-blocking loading
  */
 export function preloadImage(src: string): Promise<void> {
   if (preloadedImages.has(src)) {
     return Promise.resolve();
   }
 
   return new Promise((resolve, reject) => {
     const img = new Image();
     img.onload = () => {
       preloadedImages.add(src);
       resolve();
     };
     img.onerror = () => {
       reject(new Error(`Failed to preload: ${src}`));
     };
     img.src = src;
   });
 }
 
 /**
  * Preload multiple images during idle time
  * Non-blocking, uses requestIdleCallback when available
  */
 export function preloadImagesIdle(srcs: string[]): void {
   const uniqueSrcs = srcs.filter(src => !preloadedImages.has(src));
   if (uniqueSrcs.length === 0) return;
 
   const loadNext = (index: number) => {
     if (index >= uniqueSrcs.length) return;
 
     const scheduleNext = () => {
       if ('requestIdleCallback' in window) {
         window.requestIdleCallback(() => loadNext(index + 1), { timeout: 2000 });
       } else {
         setTimeout(() => loadNext(index + 1), 50);
       }
     };
 
     preloadImage(uniqueSrcs[index])
       .then(scheduleNext)
       .catch(scheduleNext); // Continue even if one fails
   };
 
   // Start preloading after a short delay to not interfere with initial render
   if ('requestIdleCallback' in window) {
     window.requestIdleCallback(() => loadNext(0), { timeout: 3000 });
   } else {
     setTimeout(() => loadNext(0), 100);
   }
 }
 
 /**
  * Preload token icons for a list of symbols
  * Used to warm up icon cache before they're visible
  */
 export function preloadTokenIcons(symbols: string[]): void {
   const iconSrcs = symbols.flatMap(symbol => {
     const parts = symbol.split('_').map(p => p.trim().toLowerCase()).filter(Boolean);
     return parts.map(s => `/icons/tokens/${s}.svg`);
   });
   preloadImagesIdle(iconSrcs);
 }
 
 /**
  * Preload chain/network icons
  */
 export function preloadChainIcons(chains: string[]): void {
   const chainIconMap: Record<string, string> = {
     ethereum: 'ethereum',
     arbitrum: 'arbitrum',
     arbitrumone: 'arbitrum',
     optimism: 'optimism',
     polygon: 'polygon',
     avalanche: 'avalanche',
     base: 'base',
     bnbchain: 'binance',
     bsc: 'binance',
     binance: 'binance',
     binancesmartchain: 'binance',
     gnosis: 'gnosis',
     scroll: 'scroll',
     metis: 'metis',
     metisandromeda: 'metis',
     zksync: 'zksync',
     zksyncera: 'zksync',
     linea: 'linea',
     celo: 'celo',
     sonic: 'sonic',
     soneium: 'soneium',
     plasma: 'plasma',
     ink: 'ink',
     mantle: 'mantle',
     megaeth: 'megaeth',
   };
 
   const iconSrcs = chains
     .map(chain => chain.toLowerCase().replace(/[^a-z0-9]/g, ''))
     .map(normalized => chainIconMap[normalized])
     .filter((iconName): iconName is string => !!iconName)
     .map(iconName => `/icons/networks/${iconName}.svg`);
 
   preloadImagesIdle([...new Set(iconSrcs)]);
 }
 
 /**
  * Preload critical above-the-fold images immediately
  * For hero/header images that should load ASAP
  */
 export function preloadCriticalImages(srcs: string[]): void {
   srcs.forEach(src => {
     if (preloadedImages.has(src)) return;
     
     // Use link preload for critical images
     const link = document.createElement('link');
     link.rel = 'preload';
     link.as = 'image';
     link.href = src;
     document.head.appendChild(link);
     
     preloadedImages.add(src);
   });
 }
 
 /**
  * Check if an image is already preloaded/cached
  */
 export function isImagePreloaded(src: string): boolean {
   return preloadedImages.has(src);
 }

/**
 * Preload incentive-related icons (partner logos, source icons)
 * Called after initial page load to ensure they're ready when tooltip opens
 */
export function preloadIncentiveIcons(): void {
  const incentiveIcons = [
    // Partner logos (light theme)
    '/icons/partners/aci-black.svg',
    '/icons/partners/brevis-black.svg',
    '/icons/partners/merkl-black.svg',
    // Partner logos (dark theme)
    '/icons/partners/aci-white.svg',
    '/icons/partners/brevis-white.svg',
    '/icons/partners/merkl-white.svg',
    // Protocol icon
    '/icons/tokens/aave.svg',
  ];

  preloadImagesIdle(incentiveIcons);
}
