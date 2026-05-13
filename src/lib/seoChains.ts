// SEO chain configuration for dedicated landing pages.
// Each entry produces a /chain/:slug page with unique meta tags and copy.

export type SeoChainConfig = {
  slug: string;
  // Display label used in headings and copy.
  displayName: string;
  // Names matched against reserve.chainName (case-insensitive substring),
  // used to deep-link into the dashboard prefiltered to this chain.
  chainNameMatchers: string[];
  title: string; // <60 chars
  description: string; // <160 chars
  intro: string; // longer paragraph for the page body
  highlights: string[]; // short bullets shown on the page
};

export const SEO_CHAINS: SeoChainConfig[] = [
  {
    slug: 'ethereum',
    displayName: 'Ethereum',
    chainNameMatchers: ['ethereum'],
    title: 'Aave APY on Ethereum — Lending & Borrowing Rates',
    description:
      'Compare Aave V3 supply and borrow APYs on Ethereum mainnet, including Merit incentives, in real time.',
    intro:
      'Track live Aave V3 lending and borrowing rates on Ethereum mainnet. AAVE APY surfaces every reserve on the Core, Prime, and EtherFi markets, and layers Merit incentives so you can see the true effective APY before depositing or borrowing.',
    highlights: [
      'Live supply and borrow APY for every Ethereum reserve',
      'Merit program incentives factored into effective APY',
      'Compare Core, Prime, and EtherFi markets side-by-side',
    ],
  },
  {
    slug: 'arbitrum',
    displayName: 'Arbitrum',
    chainNameMatchers: ['arbitrum'],
    title: 'Aave APY on Arbitrum — Live V3 Rates',
    description:
      'See live Aave V3 supply, borrow, and incentive APYs on Arbitrum One. Sort, filter, and simulate positions instantly.',
    intro:
      'Find the best Aave V3 lending and borrowing opportunities on Arbitrum One. AAVE APY shows real-time supply and borrow rates with Merit and Merkl incentives, so you always see the net APY for every reserve on Arbitrum.',
    highlights: [
      'Real-time Arbitrum supply and borrow APYs',
      'Merit and Merkl incentives included in effective APY',
      'Simulate deposits and borrows to estimate daily yield',
    ],
  },
  {
    slug: 'base',
    displayName: 'Base',
    chainNameMatchers: ['base'],
    title: 'Aave APY on Base — Lending & Borrowing Rates',
    description:
      'Compare live Aave V3 APYs on Base. Track Merit and Merkl incentives, simulate positions, and find the highest yields.',
    intro:
      'Discover the best Aave V3 lending and borrowing rates on Base. AAVE APY tracks every reserve in real time and folds in Merit and Merkl rewards to give you the effective APY before you supply or borrow.',
    highlights: [
      'Live Base supply and borrow APY for every reserve',
      'Merit and Merkl incentives layered into net yield',
      'Position simulator for projected daily and annual earn',
    ],
  },
  {
    slug: 'optimism',
    displayName: 'Optimism',
    chainNameMatchers: ['optimism'],
    title: 'Aave APY on Optimism — Live V3 Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Optimism, with Merit incentives factored into effective yield.',
    intro:
      'Monitor Aave V3 lending and borrowing rates on Optimism. AAVE APY combines base APY with Merit incentives so you can pick the highest-yielding reserves on OP Mainnet.',
    highlights: [
      'Live Optimism supply and borrow APYs',
      'Merit incentives included in effective APY',
      'Filter by stables, ETH-correlated, BTC-correlated, and more',
    ],
  },
  {
    slug: 'polygon',
    displayName: 'Polygon',
    chainNameMatchers: ['polygon'],
    title: 'Aave APY on Polygon — Live Lending Rates',
    description:
      'Compare Aave V3 supply and borrow APYs on Polygon PoS, including Merit incentives, updated in real time.',
    intro:
      'Track live Aave V3 rates on Polygon PoS. AAVE APY surfaces every supply and borrow APY and adds Merit incentives so you can see the real effective yield for each reserve.',
    highlights: [
      'Live Polygon supply and borrow APYs',
      'Merit incentives factored into net APY',
      'Sort by yield, utilization, or liquidity',
    ],
  },
  {
    slug: 'avalanche',
    displayName: 'Avalanche',
    chainNameMatchers: ['avalanche'],
    title: 'Aave APY on Avalanche — Live V3 Rates',
    description:
      'Live Aave V3 supply and borrow APYs on Avalanche C-Chain, with incentives factored into effective yield.',
    intro:
      'Compare Aave V3 lending and borrowing rates on Avalanche C-Chain in real time. AAVE APY includes incentive programs so you always see the true effective APY for every reserve.',
    highlights: [
      'Live Avalanche supply and borrow APYs',
      'Effective APY with incentives included',
      'Filter by token category and market',
    ],
  },
  {
    slug: 'gnosis',
    displayName: 'Gnosis',
    chainNameMatchers: ['gnosis'],
    title: 'Aave APY on Gnosis Chain — Live Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Gnosis Chain, with all incentives included.',
    intro:
      'Track Aave V3 rates on Gnosis Chain. AAVE APY shows every reserve, supply and borrow side, with incentives folded into the effective APY.',
    highlights: [
      'Live Gnosis Chain supply and borrow APYs',
      'Incentives included in effective APY',
      'Compare against other Aave deployments',
    ],
  },
  {
    slug: 'scroll',
    displayName: 'Scroll',
    chainNameMatchers: ['scroll'],
    title: 'Aave APY on Scroll — Live V3 Rates',
    description:
      'Live Aave V3 supply and borrow APYs on Scroll, with Merit incentives factored in.',
    intro:
      'Compare Aave V3 lending and borrowing rates on Scroll in real time. AAVE APY adds Merit incentives to base APY so you see the real effective yield for every reserve.',
    highlights: [
      'Live Scroll supply and borrow APYs',
      'Merit incentives included',
      'Position simulator and incentive forecasts',
    ],
  },
  {
    slug: 'metis',
    displayName: 'Metis',
    chainNameMatchers: ['metis'],
    title: 'Aave APY on Metis — Live Lending Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Metis Andromeda in real time.',
    intro:
      'Track Aave V3 rates on Metis Andromeda. AAVE APY surfaces every reserve with live supply and borrow APYs and any active incentives.',
    highlights: [
      'Live Metis supply and borrow APYs',
      'Incentives included in effective APY',
      'Filter and sort by yield, market, or category',
    ],
  },
  {
    slug: 'bnb-chain',
    displayName: 'BNB Chain',
    chainNameMatchers: ['bnb', 'binance'],
    title: 'Aave APY on BNB Chain — Live V3 Rates',
    description:
      'Live Aave V3 supply and borrow APYs on BNB Chain, with all incentives factored into effective yield.',
    intro:
      'Compare Aave V3 lending and borrowing rates on BNB Chain. AAVE APY includes every reserve and folds in any active incentives so you always see the real effective APY.',
    highlights: [
      'Live BNB Chain supply and borrow APYs',
      'Effective APY with incentives included',
      'Compare against other Aave deployments',
    ],
  },
  {
    slug: 'linea',
    displayName: 'Linea',
    chainNameMatchers: ['linea'],
    title: 'Aave APY on Linea — Live Lending Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Linea, with incentives included.',
    intro:
      'Track Aave V3 rates on Linea in real time. AAVE APY shows every reserve and layers in incentives so the effective APY is always visible at a glance.',
    highlights: [
      'Live Linea supply and borrow APYs',
      'Incentives factored into effective APY',
      'Sort by yield, utilization, or liquidity',
    ],
  },
  {
    slug: 'zksync',
    displayName: 'zkSync Era',
    chainNameMatchers: ['zksync'],
    title: 'Aave APY on zkSync Era — Live V3 Rates',
    description:
      'Live Aave V3 supply and borrow APYs on zkSync Era, with incentives factored into effective yield.',
    intro:
      'Compare Aave V3 lending and borrowing rates on zkSync Era. AAVE APY surfaces every reserve and includes incentives in the effective APY.',
    highlights: [
      'Live zkSync Era supply and borrow APYs',
      'Effective APY with incentives included',
      'Position simulator and incentive forecasts',
    ],
  },
  {
    slug: 'celo',
    displayName: 'Celo',
    chainNameMatchers: ['celo'],
    title: 'Aave APY on Celo — Live Lending Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Celo, with incentives included.',
    intro:
      'Track Aave V3 rates on Celo in real time. AAVE APY shows every reserve with live supply and borrow APYs and any active incentives.',
    highlights: [
      'Live Celo supply and borrow APYs',
      'Effective APY with incentives included',
      'Filter and sort by yield, market, or category',
    ],
  },
  {
    slug: 'sonic',
    displayName: 'Sonic',
    chainNameMatchers: ['sonic'],
    title: 'Aave APY on Sonic — Live V3 Rates',
    description:
      'Live Aave V3 supply and borrow APYs on Sonic, with incentives factored into effective yield.',
    intro:
      'Compare Aave V3 lending and borrowing rates on Sonic. AAVE APY includes every reserve and folds in incentives so you always see the real effective APY.',
    highlights: [
      'Live Sonic supply and borrow APYs',
      'Effective APY with incentives included',
      'Position simulator and incentive forecasts',
    ],
  },
  {
    slug: 'soneium',
    displayName: 'Soneium',
    chainNameMatchers: ['soneium'],
    title: 'Aave APY on Soneium — Live Lending Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Soneium in real time.',
    intro:
      'Track Aave V3 rates on Soneium. AAVE APY surfaces every reserve with live supply and borrow APYs and any active incentives.',
    highlights: [
      'Live Soneium supply and borrow APYs',
      'Effective APY with incentives included',
      'Filter and sort by yield, market, or category',
    ],
  },
  {
    slug: 'ink',
    displayName: 'Ink',
    chainNameMatchers: ['ink'],
    title: 'Aave APY on Ink — Live V3 Rates with Tydro',
    description:
      'Live Aave V3 supply and borrow APYs on Ink, with Tydro point incentives and Merkl rewards included.',
    intro:
      'Compare Aave V3 lending and borrowing rates on Ink. AAVE APY combines base APY with Tydro point rewards (configurable FDV) and Merkl incentives so you can model your real effective APY on Ink.',
    highlights: [
      'Live Ink supply and borrow APYs',
      'Tydro point rewards with adjustable FDV',
      'Merkl campaign incentives included',
    ],
  },
  {
    slug: 'mantle',
    displayName: 'Mantle',
    chainNameMatchers: ['mantle'],
    title: 'Aave APY on Mantle — Live Lending Rates',
    description:
      'Compare live Aave V3 supply and borrow APYs on Mantle in real time.',
    intro:
      'Track Aave V3 rates on Mantle. AAVE APY shows every reserve with live supply and borrow APYs and any active incentives.',
    highlights: [
      'Live Mantle supply and borrow APYs',
      'Effective APY with incentives included',
      'Filter and sort by yield, market, or category',
    ],
  },
];

export const getSeoChainBySlug = (slug: string | undefined) =>
  SEO_CHAINS.find((c) => c.slug === slug?.toLowerCase());
