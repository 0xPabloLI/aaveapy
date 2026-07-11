// SEO chain configuration for dedicated landing pages.
// Each entry produces a /chain/:slug page with unique meta tags and copy.

export type SeoChainConfig = {
  slug: string;
  displayName: string;
  chainId: number;
  chainNameMatchers: string[];
  title: string;
  description: string;
  intro: string;
  highlights: string[];
};

export const SEO_CHAINS: SeoChainConfig[] = [
  {
    slug: 'ethereum',
    displayName: 'Ethereum',
    chainId: 1,
    chainNameMatchers: ['ethereum'],
    title: 'Ethereum AaveAPY — Live Rates for ETH, USDC & WBTC',
    description:
      'Real-time Aave lending and borrowing APYs for ETH, USDC, and all Ethereum V3 & V4 markets. All incentive programs included.',
    intro:
      'Ethereum mainnet runs Aave\'s deepest liquidity pools: four V3 markets (Core, Prime, EtherFi, Horizon RWA) plus Aave V4 Hub & Spoke. Covers ETH, liquid staking derivatives (wstETH, weETH), stablecoins (USDC, USDT, DAI, GHO), BTC proxies (WBTC, cbBTC), and more. This page shows live supply and borrow APYs for every reserve, with all incentive programs factored into the effective yield.',
    highlights: [
      'Live rates across V3 markets (Core, Prime, EtherFi, Horizon RWA) and V4 Hub & Spoke',
      'All active incentive programs included in effective APY',
      'Covers ETH, wstETH, weETH, USDC, USDT, DAI, GHO, WBTC, and more',
    ],
  },
  {
    slug: 'arbitrum',
    displayName: 'Arbitrum',
    chainId: 42161,
    chainNameMatchers: ['arbitrum'],
    title: 'Arbitrum AaveAPY — Live Rates for ETH, USDC & ARB',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, ARB, WBTC and all Arbitrum One reserves. All active incentives factored into effective yield.',
    intro:
      'Arbitrum One hosts one of Aave\'s most active deployments, with deep liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and ARB across a broad range of reserves. This page shows real-time supply and borrow APYs with all active rewards baked into the effective yield—no manual math needed to compare the real cost or return of any position.',
    highlights: [
      'Real-time supply and borrow APYs for every Arbitrum reserve',
      'All active incentives combined into effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, ARB, and more',
    ],
  },
  {
    slug: 'base',
    displayName: 'Base',
    chainId: 8453,
    chainNameMatchers: ['base'],
    title: 'Base AaveAPY — Live Rates for ETH, USDC & cbETH',
    description:
      'Track live Aave lending and borrowing APYs for ETH, USDC, cbETH and all Base reserves. All active incentives included in effective yield.',
    intro:
      'Base has become one of Aave\'s busiest deployments, fueled by native USDC liquidity and Coinbase\'s growing onchain user base. Key reserves include ETH, cbETH, USDC, USDT, DAI, and WBTC. See live supply and borrow APYs with all active incentives layered into the effective yield for every position.',
    highlights: [
      'Live supply and borrow APYs for every Base reserve',
      'All active rewards baked into effective yield',
      'Covers ETH, cbETH, USDC, USDT, DAI, WBTC, and more',
    ],
  },
  {
    slug: 'optimism',
    displayName: 'Optimism',
    chainId: 10,
    chainNameMatchers: ['optimism'],
    title: 'Optimism AaveAPY — Live Rates for ETH, USDC & OP',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, OP, WBTC and all Optimism reserves. All active incentives factored into effective yield.',
    intro:
      'Optimism, the OP Stack pioneer, runs a mature Aave deployment with solid liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and OP. Real-time supply and borrow APYs for every reserve, plus all active incentives folded in so you can spot the highest-yielding opportunities on OP Mainnet.',
    highlights: [
      'Live supply and borrow APYs for every Optimism reserve',
      'All active incentives included in effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, OP, and more',
    ],
  },
  {
    slug: 'polygon',
    displayName: 'Polygon',
    chainId: 137,
    chainNameMatchers: ['polygon'],
    title: 'Polygon AaveAPY — Live Rates for POL, USDC & WBTC',
    description:
      'Compare live Aave lending and borrowing APYs for POL, USDC, WBTC and all Polygon PoS reserves. All active incentives included.',
    intro:
      'Polygon PoS is one of the longest-running Aave deployments outside Ethereum, with deep liquidity for POL, stablecoins (USDC, USDT, DAI), WBTC, and more. Live supply and borrow rates for every reserve, plus active incentive programs to show the full effective APY.',
    highlights: [
      'Live supply and borrow APYs for every Polygon reserve',
      'All markets covered with active incentives included',
      'Covers POL, USDC, USDT, DAI, WBTC, ETH, and more',
    ],
  },
  {
    slug: 'avalanche',
    displayName: 'Avalanche',
    chainId: 43114,
    chainNameMatchers: ['avalanche'],
    title: 'Avalanche AaveAPY — Live Rates for AVAX, USDC & WBTC',
    description:
      'Live Aave lending and borrowing APYs for AVAX, USDC, WBTC and all C-Chain reserves. Incentive programs included.',
    intro:
      'Avalanche C-Chain delivers a fast, low-cost Aave experience backed by a mature DeFi ecosystem, covering AVAX, stablecoins (USDC, USDT, DAI), WBTC, BTC.b, and more. Live supply and borrow APYs with incentive programs folded into the effective yield.',
    highlights: [
      'Live C-Chain supply and borrow APYs for every reserve',
      'All markets with active incentive programs included',
      'Covers AVAX, USDC, USDT, DAI, WBTC, BTC.b, and more',
    ],
  },
  {
    slug: 'gnosis',
    displayName: 'Gnosis Chain',
    chainId: 100,
    chainNameMatchers: ['gnosis'],
    title: 'Gnosis Chain AaveAPY — Live Rates for sDAI, GNO & USDC',
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
    chainId: 534352,
    chainNameMatchers: ['scroll'],
    title: 'Scroll AaveAPY — Live zkEVM Rates for ETH & USDC',
    description:
      'Live Aave lending and borrowing APYs on Scroll zkEVM. Covers ETH, USDC, WBTC and all reserves. All active incentives factored into effective yield.',
    intro:
      'Scroll, a zkEVM Layer 2 with a growing DeFi footprint, runs a dedicated Aave deployment covering ETH, stablecoins (USDC, USDT), WBTC, and more. Live supply and borrow APYs for every reserve, with all active incentives factored into the effective yield.',
    highlights: [
      'Live supply and borrow APYs for every Scroll reserve',
      'All active incentives factored into effective yield',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'metis',
    displayName: 'Metis',
    chainId: 1088,
    chainNameMatchers: ['metis'],
    title: 'Metis AaveAPY — Live Rates for ETH, USDC & METIS',
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
    chainId: 56,
    chainNameMatchers: ['bnb', 'binance'],
    title: 'BNB Chain AaveAPY — Live Rates for BNB, USDC & WBTC',
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
    chainId: 59144,
    chainNameMatchers: ['linea'],
    title: 'Linea AaveAPY — Consensys zkEVM Rates for ETH & USDC',
    description:
      'Compare live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Linea zkEVM reserves. All active incentives factored into effective yield.',
    intro:
      'Linea, Consensys\' zkEVM L2, hosts an active Aave deployment with growing liquidity for ETH, stablecoins (USDC, USDT, DAI), WBTC, and more. Live supply and borrow APYs with all active incentives folded into the effective yield for every position.',
    highlights: [
      'Live supply and borrow APYs for every Linea reserve',
      'All active incentives factored into effective yield',
      'Covers ETH, USDC, USDT, DAI, WBTC, and more',
    ],
  },
  {
    slug: 'zksync',
    displayName: 'zkSync Era',
    chainId: 324,
    chainNameMatchers: ['zksync'],
    title: 'zkSync Era AaveAPY — ZK Rollup Rates for ETH & USDC',
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
    chainId: 42220,
    chainNameMatchers: ['celo'],
    title: 'Celo AaveAPY — Live Rates for CELO, USDC & cUSD',
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
    chainId: 146,
    chainNameMatchers: ['sonic'],
    title: 'Sonic AaveAPY — High-Speed Rates for ETH & USDC',
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
    chainId: 1868,
    chainNameMatchers: ['soneium'],
    title: 'Soneium AaveAPY — Sony L2 Rates for ETH & USDC',
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
    chainId: 57073,
    chainNameMatchers: ['ink'],
    title: 'Ink AaveAPY — Live Rates with Ink Airdrop Rewards',
    description:
      'Live Aave lending and borrowing APYs for ETH, USDC, WBTC and all Ink reserves. Ink airdrop rewards and active incentives factored into effective yield.',
    intro:
      'Ink has a one-of-a-kind Aave incentive setup: Ink airdrop rewards (Tydro points with a configurable FDV slider) plus active campaign incentives, covering ETH, stablecoins (USDC, USDT), WBTC, and more. Tune the FDV assumption and watch your effective APY update in real time—the only tool that models this combo end-to-end.',
    highlights: [
      'Live supply and borrow APYs for every Ink reserve',
      'Ink airdrop rewards with adjustable FDV slider',
      'Covers ETH, USDC, USDT, WBTC, and more',
    ],
  },
  {
    slug: 'mantle',
    displayName: 'Mantle',
    chainId: 5000,
    chainNameMatchers: ['mantle'],
    title: 'Mantle AaveAPY — Live Rates for mETH, USDC & ETH',
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