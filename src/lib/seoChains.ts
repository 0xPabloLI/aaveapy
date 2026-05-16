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
    title: 'Ethereum Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Real-time Aave lending and borrowing APYs for ETH, USDC, WBTC, and all Ethereum reserves across Core, Prime, and EtherFi markets. Merit incentives included.',
    intro:
      'Ethereum mainnet runs Aave\'s deepest liquidity pools, with three active markets—Core, Prime, and EtherFi—covering ETH and liquid staking derivatives (wstETH, weETH), stablecoins (USDC, USDT, DAI, GHO), BTC proxies (WBTC, cbBTC), and more. This page shows live supply and borrow APYs for every reserve, with Merit program incentives factored into the effective yield so you see exactly what you\'ll earn or pay.',
    highlights: [
      'Live rates across Core, Prime, and EtherFi markets',
      'Merit incentives included in effective APY for every reserve',
      'Covers ETH, wstETH, weETH, USDC, USDT, DAI, GHO, WBTC, and more',
    ],
  },
  {
    slug: 'arbitrum',
    displayName: 'Arbitrum',
    chainNameMatchers: ['arbitrum'],
    title: 'Arbitrum Aave APY — Live Rates for ETH, USDC & ARB',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, ARB, WBTC and all Arbitrum One reserves. Merit and Merkl incentives factored into effective yield.',
    intro:
      'Arbitrum One hosts one of Aave\'s most active deployments, with deep liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and ARB across a broad range of reserves. This page shows real-time supply and borrow APYs with both Merit and Merkl rewards baked into the effective yield—no manual math needed to compare the real cost or return of any position.',
    highlights: [
      'Real-time supply and borrow APYs for every Arbitrum reserve',
      'Merit and Merkl incentives combined into effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, ARB, and more',
    ],
  },
  {
    slug: 'base',
    displayName: 'Base',
    chainNameMatchers: ['base'],
    title: 'Base Aave APY — Live Rates for ETH, USDC & cbETH',
    description:
      'Track live Aave lending and borrowing APYs for ETH, USDC, cbETH and all Base reserves. Merit and Merkl incentives included in effective yield.',
    intro:
      'Base has become one of Aave\'s busiest deployments, fueled by native USDC liquidity and Coinbase\'s growing onchain user base. Key reserves include ETH, cbETH, USDC, USDT, DAI, and WBTC. See live supply and borrow APYs with Merit and Merkl incentives layered into the effective yield for every position.',
    highlights: [
      'Live supply and borrow APYs for every Base reserve',
      'Merit and Merkl rewards baked into effective yield',
      'Covers ETH, cbETH, USDC, USDT, DAI, WBTC, and more',
    ],
  },
  {
    slug: 'optimism',
    displayName: 'Optimism',
    chainNameMatchers: ['optimism'],
    title: 'Optimism Aave APY — Live Rates for ETH, USDC & OP',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, OP, WBTC and all Optimism reserves. Merit incentives factored into effective yield.',
    intro:
      'Optimism, the OP Stack pioneer, runs a mature Aave deployment with solid liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and OP. Real-time supply and borrow APYs for every reserve, plus Merit incentives folded in so you can spot the highest-yielding opportunities on OP Mainnet.',
    highlights: [
      'Live supply and borrow APYs for every Optimism reserve',
      'Merit incentives included in effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, OP, and more',
    ],
  },
  {
    slug: 'polygon',
    displayName: 'Polygon',
    chainNameMatchers: ['polygon'],
    title: 'Polygon Aave APY — Live Rates for POL, USDC & WBTC',
    description:
      'Compare live Aave lending and borrowing APYs for POL, USDC, WBTC and all Polygon PoS reserves across V2 and V3 markets. Merit incentives included.',
    intro:
      'Polygon PoS is one of the longest-running Aave deployments outside Ethereum, serving both V2 and V3 users with deep liquidity for POL, stablecoins (USDC, USDT, DAI), WBTC, and more. Live supply and borrow rates for every reserve, plus Merit incentives to show the full effective APY.',
    highlights: [
      'Live supply and borrow APYs for every Polygon reserve',
      'V2 and V3 markets covered with Merit incentives included',
      'Covers POL, USDC, USDT, DAI, WBTC, ETH, and more',
    ],
  },
  {
    slug: 'avalanche',
    displayName: 'Avalanche',
    chainNameMatchers: ['avalanche'],
    title: 'Avalanche Aave APY — Live Rates for AVAX, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs for AVAX, USDC, WBTC and all C-Chain reserves across V2 and V3 markets. Incentive programs included.',
    intro:
      'Avalanche C-Chain delivers a fast, low-cost Aave experience with active V2 and V3 markets backed by a mature DeFi ecosystem, covering AVAX, stablecoins (USDC, USDT, DAI), WBTC, BTC.b, and more. Live supply and borrow APYs with incentive programs folded into the effective yield.',
    highlights: [
      'Live C-Chain supply and borrow APYs for every reserve',
      'V2 and V3 markets with active incentive programs included',
      'Covers AVAX, USDC, USDT, DAI, WBTC, BTC.b, and more',
    ],
  },
  {
    slug: 'gnosis',
    displayName: 'Gnosis',
    chainNameMatchers: ['gnosis'],
    title: 'Gnosis Chain Aave APY — Live Rates for sDAI, GNO & USDC',
    description:
      'Compare live Aave lending and borrowing APYs on Gnosis Chain, covering sDAI, GNO, USDC and all reserves with incentives included.',
    intro:
      'Gnosis Chain\'s Aave deployment focuses on a curated set of reserves, with sDAI and GNO pools offering unique yield opportunities alongside USDC and USDT. Live supply and borrow APYs for every reserve, with all active incentives folded into the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Gnosis reserve',
      'sDAI and GNO pools with incentives included',
      'Covers sDAI, GNO, USDC, USDT, and more',
    ],
  },
  {
    slug: 'scroll',
    displayName: 'Scroll',
    chainNameMatchers: ['scroll'],
    title: 'Scroll Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs on Scroll zkEVM. Covers ETH, USDC, WBTC and all reserves. Merit incentives factored into effective yield.',
    intro:
      'Scroll, a zkEVM Layer 2 with a growing DeFi footprint, runs a dedicated Aave deployment with Merit incentives covering ETH, stablecoins (USDC, USDT), WBTC, and more. Live supply and borrow APYs for every reserve, with Merit factored into the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Scroll reserve',
      'Merit incentives factored into effective yield',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'metis',
    displayName: 'Metis',
    chainNameMatchers: ['metis'],
    title: 'Metis Aave APY — Live Rates for ETH, USDC & METIS',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, METIS and all Metis Andromeda reserves. Incentives factored into effective yield.',
    intro:
      'Metis Andromeda runs a lean but efficient Aave deployment with competitive yields on a focused set of reserves, including ETH, USDC, USDT, and METIS. Live supply and borrow APYs with any active incentives baked into the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Metis reserve',
      'Active incentives baked into effective yield',
      'Covers ETH, USDC, USDT, METIS, and more',
    ],
  },
  {
    slug: 'bnb-chain',
    displayName: 'BNB Chain',
    chainNameMatchers: ['bnb', 'binance'],
    title: 'BNB Chain Aave APY — Live Rates for BNB, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs for BNB, USDC, WBTC and all BNB Chain reserves. All active incentives factored into effective yield.',
    intro:
      'BNB Chain brings a massive user base to Aave, with deep liquidity for BNB, stablecoins (USDC, USDT), WBTC, ETH, and a broad range of other assets. Live supply and borrow APYs for every reserve, with all active incentives included in the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every BNB Chain reserve',
      'All active incentives included in effective yield',
      'Covers BNB, USDC, USDT, WBTC, ETH, and more',
    ],
  },
  {
    slug: 'linea',
    displayName: 'Linea',
    chainNameMatchers: ['linea'],
    title: 'Linea Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Linea zkEVM reserves. Merit incentives factored into effective yield.',
    intro:
      'Linea, Consensys\' zkEVM L2, hosts an active Aave deployment with growing liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and more, plus Merit incentives across all reserves. Live supply and borrow APYs with Merit folded into the effective yield for every position.',
    highlights: [
      'Live supply and borrow APYs for every Linea reserve',
      'Merit incentives factored into effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, and more',
    ],
  },
  {
    slug: 'zksync',
    displayName: 'zkSync Era',
    chainNameMatchers: ['zksync'],
    title: 'zkSync Era Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, WBTC and all zkSync Era reserves. All active incentives factored into effective yield.',
    intro:
      'zkSync Era, the ZK rollup by Matter Labs, runs a growing Aave deployment with competitive rates for ETH, stablecoins (USDC, USDT), WBTC, and more. Live supply and borrow APYs for every reserve, with all active incentives included in the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every zkSync Era reserve',
      'All active incentives rolled into effective yield',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'celo',
    displayName: 'Celo',
    chainNameMatchers: ['celo'],
    title: 'Celo Aave APY — Live Rates for CELO, USDC & cUSD',
    description:
      'Compare live Aave lending and borrowing APYs for CELO, USDC, cUSD and all Celo reserves. All active incentives factored into effective yield.',
    intro:
      'Celo brings mobile-first DeFi to Aave with a curated set of reserves including unique assets like cUSD (Celo Dollar) alongside CELO, USDC, and ETH. Live supply and borrow APYs for every reserve, with any active incentives included in the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Celo reserve',
      'All active incentives included in effective yield',
      'Covers CELO, cUSD, USDC, ETH, and more',
    ],
  },
  {
    slug: 'sonic',
    displayName: 'Sonic',
    chainNameMatchers: ['sonic'],
    title: 'Sonic Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Sonic reserves. All active incentives factored into effective yield.',
    intro:
      'Sonic is a high-performance EVM chain with sub-second finality and a fast-growing Aave deployment covering ETH, stablecoins (USDC, USDT), WBTC, and more. Live supply and borrow APYs for every reserve, with all active incentives folded in so you can spot opportunities and act quickly.',
    highlights: [
      'Live supply and borrow APYs for every Sonic reserve',
      'All active incentives included in effective yield',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'soneium',
    displayName: 'Soneium',
    chainNameMatchers: ['soneium'],
    title: 'Soneium Aave APY — Live Rates for ETH, USDC & WBTC',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Soneium reserves. All active incentives factored into effective yield.',
    intro:
      'Soneium, Sony\'s Ethereum L2 built on the OP Stack, hosts a fresh Aave deployment with an emerging DeFi ecosystem covering ETH, stablecoins (USDC), WBTC, and more. Live supply and borrow APYs for every reserve, with any active incentives included in the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Soneium reserve',
      'All active incentives included in effective yield',
      'Covers ETH, USDC, WBTC, and more',
    ],
  },
  {
    slug: 'ink',
    displayName: 'Ink',
    chainNameMatchers: ['ink'],
    title: 'Ink Aave APY — Live Rates with Ink Airdrop Rewards & Merkl',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Ink reserves. Ink airdrop rewards and Merkl incentives factored into effective yield.',
    intro:
      'Ink has a one-of-a-kind Aave incentive setup: Ink airdrop rewards (Tydro points with a configurable FDV slider) plus Merkl campaign incentives, covering ETH, stablecoins (USDC, USDT), WBTC, and more. Tune the FDV assumption and watch your effective APY update in real time—the only tool that models this combo end-to-end.',
    highlights: [
      'Live supply and borrow APYs for every Ink reserve',
      'Ink airdrop rewards with adjustable FDV slider',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'mantle',
    displayName: 'Mantle',
    chainNameMatchers: ['mantle'],
    title: 'Mantle Aave APY — Live Rates for mETH, USDC & ETH',
    description:
      'Compare live Aave lending and borrowing APYs for mETH, USDC, ETH and all Mantle reserves. mETH staking yields and incentives included in effective yield.',
    intro:
      'Mantle Network powers its Aave deployment with treasury-backed mETH liquid staking alongside ETH, stablecoins (USDC, USDT), and WBTC. Live supply and borrow APYs for every reserve, with mETH staking yields and all active incentives factored into the effective APY.',
    highlights: [
      'Live supply and borrow APYs for every Mantle reserve',
      'mETH liquid staking yields alongside lending rates',
      'Covers mETH, ETH, USDC, USDT, WBTC, and more',
    ],
  },
];

export const getSeoChainBySlug = (slug: string | undefined) =>
  SEO_CHAINS.find((c) => c.slug === slug?.toLowerCase());