// SEO asset configuration for dedicated per-asset landing pages.
// Each entry produces a /asset/:slug page targeting "aave {symbol} apy" keywords.

export type SeoAssetConfig = {
  slug: string;
  symbol: string;
  displayName: string;
  // Substring matched against reserve.symbol (case-insensitive) to deep-link the dashboard.
  symbolMatcher: string;
  title: string; // <60 chars
  description: string; // <160 chars
  intro: string;
  highlights: string[];
  topChains: string[]; // chain slugs that have meaningful liquidity for this asset
};

export const SEO_ASSETS: SeoAssetConfig[] = [
  {
    slug: 'usdc',
    symbol: 'USDC',
    displayName: 'USDC',
    symbolMatcher: 'USDC',
    title: 'Aave USDC APY — Live Supply & Borrow Rates on Every Chain',
    description:
      'Track live Aave USDC supply and borrow APYs across every chain. All Merit, Merkl and Brevis incentives included in the effective yield.',
    intro:
      'USDC is the most-supplied stablecoin on Aave, with deep markets on Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, and every other Aave deployment. This page shows live supply and borrow APYs for every USDC reserve, with all active incentive programs (Merit, Merkl, Brevis) baked into the effective yield.',
    highlights: [
      'Live USDC supply and borrow APYs on 15+ chains side by side',
      'All Merit, Merkl and Brevis incentives folded into effective APY',
      'Rate simulation — see how your deposit size moves the curve before you commit',
    ],
    topChains: ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism', 'avalanche'],
  },
  {
    slug: 'usdt',
    symbol: 'USDT',
    displayName: 'USDT',
    symbolMatcher: 'USDT',
    title: 'Aave USDT APY — Live Tether Lending Rates Across Chains',
    description:
      'Compare live Aave USDT supply and borrow APYs across every chain. Tether yield with all active incentives included.',
    intro:
      'USDT (Tether) is one of the highest-volume stablecoins on Aave, with active markets on Ethereum, Arbitrum, Polygon, Avalanche, BNB Chain, and more. See live supply and borrow APYs for every USDT reserve, with active incentive programs baked into the effective yield.',
    highlights: [
      'Live USDT supply and borrow APYs across every Aave deployment',
      'All active incentives included in the effective yield',
      'Compare Tether yields across chains without manual math',
    ],
    topChains: ['ethereum', 'arbitrum', 'polygon', 'avalanche', 'bnb-chain', 'optimism'],
  },
  {
    slug: 'eth',
    symbol: 'ETH',
    displayName: 'ETH',
    symbolMatcher: 'ETH',
    title: 'Aave ETH APY — Live Supply & Borrow Rates on All Chains',
    description:
      'Track live Aave ETH and WETH supply and borrow APYs across every chain. All active incentives included in the effective yield.',
    intro:
      'ETH is the deepest non-stablecoin reserve on Aave, available as WETH on every chain plus liquid staking derivatives (wstETH, weETH, cbETH) on the major deployments. This page shows live supply and borrow APYs for every ETH and WETH reserve, with all active incentives included.',
    highlights: [
      'Live ETH and WETH supply and borrow APYs on every chain',
      'Compare with wstETH, weETH, and cbETH staking-amplified yields',
      'All active incentives folded into the effective APY',
    ],
    topChains: ['ethereum', 'arbitrum', 'base', 'optimism', 'scroll', 'linea'],
  },
  {
    slug: 'wbtc',
    symbol: 'WBTC',
    displayName: 'WBTC',
    symbolMatcher: 'WBTC',
    title: 'Aave WBTC APY — Live Bitcoin Lending Rates Across Chains',
    description:
      'Compare live Aave WBTC supply and borrow APYs across every chain. Wrapped Bitcoin yield with all active incentives included.',
    intro:
      'WBTC is the primary Bitcoin proxy on Aave, with markets on Ethereum, Arbitrum, Base, Polygon, Optimism, and Avalanche (alongside cbBTC and BTC.b on select chains). Live supply and borrow APYs for every WBTC reserve, with active incentives included.',
    highlights: [
      'Live WBTC supply and borrow APYs on every Aave deployment',
      'Compare alongside cbBTC and BTC.b where available',
      'All active incentives included in the effective yield',
    ],
    topChains: ['ethereum', 'arbitrum', 'base', 'polygon', 'optimism', 'avalanche'],
  },
  {
    slug: 'dai',
    symbol: 'DAI',
    displayName: 'DAI',
    symbolMatcher: 'DAI',
    title: 'Aave DAI APY — Live Supply & Borrow Rates Across Chains',
    description:
      'Compare live Aave DAI supply and borrow APYs across every chain. MakerDAO stablecoin yield with all active incentives included.',
    intro:
      'DAI, the MakerDAO-issued decentralized stablecoin, has Aave markets on Ethereum, Arbitrum, Optimism, Polygon, Gnosis, and more. See live supply and borrow APYs for every DAI reserve, with active incentives baked into the effective yield.',
    highlights: [
      'Live DAI supply and borrow APYs on every supported chain',
      'All active incentives folded into the effective APY',
      'Compare against sDAI yields on Gnosis Chain',
    ],
    topChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'gnosis'],
  },
  {
    slug: 'gho',
    symbol: 'GHO',
    displayName: 'GHO',
    symbolMatcher: 'GHO',
    title: 'Aave GHO APY — Live Rates for Aave\'s Native Stablecoin',
    description:
      'Track live Aave GHO supply and borrow APYs. Aave\'s native overcollateralized stablecoin with all active incentives included.',
    intro:
      'GHO is Aave\'s native overcollateralized stablecoin, minted directly against deposits in Aave V3. Live supply and borrow APYs across every market where GHO is listed, with all active incentives included in the effective yield.',
    highlights: [
      'Live GHO supply and borrow APYs across all Aave markets',
      'See where GHO is mintable and the discount rate for stkAAVE holders',
      'All active incentives included in the effective yield',
    ],
    topChains: ['ethereum', 'arbitrum', 'base'],
  },
];

export const getSeoAssetBySlug = (slug: string | undefined) =>
  SEO_ASSETS.find((a) => a.slug === slug?.toLowerCase());
