/**
 * Multi-explorer support for Aave Pool contracts
 * 
 * Some markets have multiple explorer options:
 * - Primary: The main/recommended explorer (used by default)
 * - Alternatives: Other explorers that also support the chain
 * 
 * Example: ZkSync has both zksync.blockscout.com (Blockscout) and 
 *          explorer.zksync.io (native explorer)
 */

export interface ExplorerConfig {
  baseUrl: string;
  family: 'etherscan' | 'blockscout' | 'routescan' | 'oklink' | 'native';
  /** Deep-link format template. Use {pool} for address, {selector} for function selector */
  deepLinkTemplate: string;
  /** Whether this explorer supports deep-linking to specific functions */
  supportsDeepLink: boolean;
  /** Priority order (lower = higher priority) */
  priority: number;
}

export interface PoolExplorerConfig {
  pool: string;
  /** Primary explorer - used for UI links */
  primary: string;
  /** All supported explorers for this market */
  explorers: Record<string, ExplorerConfig>;
}

/** Blockscout chains - verified on blockscout.com */
export const BLOCKSCOUT_CHAINS: Record<string, string> = {
  zksync: 'https://zksync.blockscout.com',
  soneium: 'https://soneium.blockscout.com',
  ink: 'https://explorer.inkonchain.com',
  scroll: 'https://scrollscan.com', // Blockscout-based but branded
  gnosis: 'https://gnosisscan.io', // Blockscout-based but uses Etherscan format
};

/** Etherscan family explorers */
export const ETHERSCAN_FAMILY = [
  'etherscan.io',
  'arbiscan.io',
  'optimistic.etherscan.io',
  'polygonscan.com',
  'basescan.org',
  'bscscan.com',
  'lineascan.build',
  'sonicscan.org',
  'celoscan.io',
  'mega.etherscan.io',
  'gnosisscan.io', // Actually Blockscout-based but uses Etherscan URL format
  'snowtrace.io', // Routescan - uses similar format
  'metisscan.info', // Routescan
  'plasmascan.to', // Blockscout
];

/** Deep-link templates by family */
export const DEEPLINK_TEMPLATES = {
  etherscan: '/address/{pool}#readProxyContract#F23',
  routescan: '/address/{pool}/contract/{chainId}/readProxyContract#F23',
  blockscout: '/address/{pool}?tab=read_proxy#0xc952485d',
  oklink: '/{network}/address/{pool}/contract#category=proxy-read&id=22',
  native: '/address/{pool}', // No deep-link support
};

/** Markets with multiple explorer options */
export const MULTI_EXPLORER_MARKETS: Record<string, PoolExplorerConfig> = {
  AaveV3ZkSync: {
    pool: '0x78e30497a3c7527d953C6B1E3541b021A98Bddf7',
    primary: 'blockscout',
    explorers: {
      blockscout: {
        baseUrl: 'https://zksync.blockscout.com',
        family: 'blockscout',
        deepLinkTemplate: '/address/{pool}?tab=read_proxy#0xc952485d',
        supportsDeepLink: true,
        priority: 1,
      },
      native: {
        baseUrl: 'https://explorer.zksync.io',
        family: 'native',
        deepLinkTemplate: '/address/{pool}',
        supportsDeepLink: false,
        priority: 2,
      },
    },
  },
  AaveV3Scroll: {
    pool: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe',
    primary: 'blockscout',
    explorers: {
      blockscout: {
        baseUrl: 'https://scrollscan.com',
        family: 'blockscout',
        deepLinkTemplate: '/address/{pool}?tab=read_proxy#0xc952485d',
        supportsDeepLink: true,
        priority: 1,
      },
    },
  },
  AaveV3Soneium: {
    pool: '0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B',
    primary: 'blockscout',
    explorers: {
      blockscout: {
        baseUrl: 'https://soneium.blockscout.com',
        family: 'blockscout',
        deepLinkTemplate: '/address/{pool}?tab=read_proxy#0xc952485d',
        supportsDeepLink: true,
        priority: 1,
      },
    },
  },
  AaveV3Ink: {
    pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
    primary: 'blockscout',
    explorers: {
      blockscout: {
        baseUrl: 'https://explorer.inkonchain.com',
        family: 'blockscout',
        deepLinkTemplate: '/address/{pool}?tab=read_proxy#0xc952485d',
        supportsDeepLink: true,
        priority: 1,
      },
    },
  },
  AaveV3Plasma: {
    pool: '0x95fD8805b48B268deFc756e2738a0788c46Ce90b',
    primary: 'blockscout',
    explorers: {
      blockscout: {
        baseUrl: 'https://plasmascan.to',
        family: 'blockscout',
        deepLinkTemplate: '/address/{pool}?tab=read_proxy#0xc952485d',
        supportsDeepLink: true,
        priority: 1,
      },
    },
  },
};

/** Generate deep-link URL for a specific explorer */
export function buildExplorerUrl(
  pool: string,
  explorer: ExplorerConfig
): string {
  return explorer.baseUrl + explorer.deepLinkTemplate.replace('{pool}', pool);
}

/** Get all explorer URLs for a market (for verification/testing) */
export function getAllExplorerUrls(marketName: string): Array<{name: string; url: string; supportsDeepLink: boolean}> {
  const config = MULTI_EXPLORER_MARKETS[marketName];
  if (!config) return [];
  
  return Object.entries(config.explorers).map(([name, explorer]) => ({
    name,
    url: buildExplorerUrl(config.pool, explorer),
    supportsDeepLink: explorer.supportsDeepLink,
  }));
}
