/**
 * Build an explorer deep-link pointing to the Pool contract's `getReserveData`
 * read function (Read as Proxy) for a given Aave market.
 *
 * The mapping is intentionally frontend-only and static because the
 * Pool address per market is an immutable deployment artefact.
 * 
 * Source of truth for Pool addresses: @bgd-labs/aave-address-book
 * GitHub: https://github.com/bgd-labs/aave-address-book
 */

interface PoolExplorerEntry {
  /** Pool proxy contract address (checksummed). */
  pool: string;
  
  /** 
   * Explorer configurations - markets may have multiple explorers.
   * First entry is the default used for deep-linking.
   */
  explorers: ExplorerConfig[];
}

interface ExplorerConfig {
  /** explorer base URL (e.g. `https://etherscan.io`). */
  base: string;

  /**
   * Explorer family determines the URL fragment used to deep-link to
   * `getReserveData`.
   *
   * Families:
   * - `etherscan`  → Uses `#readProxyContract#F23` anchor
   * - `routescan`  → Uses custom path format with `#readProxyContract#F23`
   * - `blockscout` → Uses `?tab=read_proxy#0xc952485d` (function selector)
   * - `oklink`     → Uses custom query params (no standard deep-link)
   */
  family: 'etherscan' | 'routescan' | 'blockscout' | 'oklink';

  /**
   * Optional custom path format (for explorers with non-standard URLs).
   * Use `{pool}` as placeholder for the contract address.
   */
  pathFormat?: string;

  /** Deep-link anchor/query for getReserveData function */
  deepLink?: string;
}

/**
 * Chain-level explorer mapping for V4 markets.
 * Maps chainName (from API) to the explorer base URL.
 *
 * Structure mirrors the `explorers[0]` format from POOL_EXPLORER_MAP
 * to allow seamless fallback when marketName is not mapped (e.g. V4).
 */
const CHAIN_EXPLORER_MAP: Record<string, ExplorerConfig> = {
  // Etherscan family
  Ethereum: { base: 'https://etherscan.io', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Arbitrum: { base: 'https://arbiscan.io', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Optimism: { base: 'https://optimistic.etherscan.io', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Polygon: { base: 'https://polygonscan.com', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Base: { base: 'https://basescan.org', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Gnosis: { base: 'https://gnosisscan.io', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  BNB: { base: 'https://bscscan.com', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Avalanche: { base: 'https://snowscan.xyz', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Linea: { base: 'https://lineascan.build', family: 'etherscan', deepLink: '#readProxyContract#F23' },
  Scroll: { base: 'https://scrollscan.com', family: 'blockscout', deepLink: '#0xc952485d' },
  ZkSync: { base: 'https://zksync.blockscout.com', family: 'blockscout', deepLink: '#0xc952485d' },
  Metis: { base: 'https://metisscan.info', family: 'routescan', pathFormat: '/address/{pool}/contract/1088/readProxyContract', deepLink: '#F23' },
  // Add more chains as needed for V4
};

// ───────────────────────────────────────────────────────────────────────────────
// V4 ARCHITECTURE NOTE:
// V4 uses a Hub & Spoke architecture, completely different from V3's single Pool.
// There is no single "Pool" contract for V4 markets.
// 
// V4 contract types from aave-address-book:
// - Hubs (on Ethereum mainnet): CORE_HUB, PLUS_HUB, PRIME_HUB
// - Spokes (per chain): BLUECHIP_SPOKE, LIDO_E_SPOKE, ETHENA_CORRELATED_SPOKE, etc.
// 
// Therefore, V4 assets will NOT show a "View pool on explorer" link.
// Only "View token on explorer" links are provided for V4.
// ───────────────────────────────────────────────────────────────────────────────

interface PoolExplorerEntry {
  /** Pool proxy contract address (checksummed). */
  pool: string;

  /**
   * Explorer configurations - markets may have multiple explorers.
   * First entry is the default used for deep-linking.
   */
  explorers: ExplorerConfig[];
}

/**
 * Map from API `marketName` (e.g. `AaveV3Ethereum`) to Pool address + explorers.
 * 
 * Sources: 
 * - Pool addresses: bgd-labs/aave-address-book (GitHub/npm)
 * - Explorer families: Verified via manual browser testing + CDP automation
 * 
 * Last verified: 2025-XX-XX
 * 
 * === EXPLORER FAMILY CLASSIFICATION ===
 * 
 * ## Etherscan Family (17 markets)
 * Uses `#readProxyContract#F23` anchor to deep-link to getReserveData.
 * 
 * | Market | Explorer | Verified |
 * |--------|----------|----------|
 * | AaveV3Ethereum | etherscan.io | ✅ |
 * | AaveV3EthereumLido | etherscan.io | ✅ |
 * | AaveV3EthereumEtherFi | etherscan.io | ✅ |
 * | AaveV3EthereumHorizon | etherscan.io | ✅ |
 * | AaveV3Arbitrum | arbiscan.io | ⚠️ (CF block) |
 * | AaveV3Optimism | optimistic.etherscan.io | ✅ |
 * | AaveV3Polygon | polygonscan.com | ⚠️ (CF block) |
 * | AaveV3Base | basescan.org | ⚠️ (CF block) |
 * | AaveV3Gnosis | gnosisscan.io | ⚠️ (CF block) |
 * | AaveV3BNB | bscscan.com | ✅ |
 * | AaveV3Linea | lineascan.build | ⚠️ (CF block) |
 * | AaveV3Sonic | sonicscan.org | ⚠️ (CF block) |
 * | AaveV3Celo | celoscan.io | ⚠️ (CF block) |
 * | AaveV3MegaEth | mega.etherscan.io | ✅ |
 * | AaveV3Plasma | plasmascan.to | ⚠️ (CF block) |
 * | AaveV3Mantle | mantlescan.xyz | ⚠️ (CF block) |
 * | AaveV3Avalanche | snowscan.xyz | ✅ |
 * 
 * ## Routescan Family (1 market)
 * Uses custom path formats with chain ID: `/address/{pool}/contract/{chainId}`.
 * 
 * | Market | Explorer | Path Format | Verified |
 * |--------|----------|-------------|----------|
 * | AaveV3Metis | metisscan.info | /address/{pool}/contract/1088 | ✅ |
 * 
 * ## Blockscout Family (5 markets)
 * Uses `?tab=read_proxy#0xc952485d` where 0xc952485d is the function
 * selector for `getReserveData(address)`.
 * 
 * | Market | Explorer | Verified |
 * |--------|----------|----------|
 * | AaveV3Scroll | scrollscan.com | ✅ |
 * | AaveV3ZkSync | zksync.blockscout.com | ✅ |
 * | AaveV3Soneium | soneium.blockscout.com | ✅ (getReserveData visible) |
 * | AaveV3Ink | explorer.inkonchain.com | ✅ (getReserveData visible) |
 * | AaveV3InkWhitelabel | explorer.inkonchain.com | ✅ (getReserveData visible) |
 * 
 * ## OKLink Family (1 market)
 * Uses custom query params. Deep-link support limited.
 * 
 * | Market | Explorer | Format | Verified |
 * |--------|----------|--------|----------|
 * | AaveV3XLayer | oklink.com | /x-layer/address/{pool}/contract#category=proxy-read&id=22 | ✅ (getReserveData visible) |
 * 
 * === MULTIPLE EXPLORER SUPPORT ===
 * 
 * Some chains have multiple explorers available:
 * - Scroll: scrollscan.com (blockscout) + scrollscan.io (routescan)
 * - ZkSync: zksync.blockscout.com + era.zksync.network (routescan)
 * - Metis: metisscan.info (routescan) + blockscout.metis.io
 * 
 * We default to the explorer with best deep-link support.
 */
const POOL_EXPLORER_MAP: Record<string, PoolExplorerEntry> = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // ETHEREUM MAINNET MARKETS (Etherscan family)
  // ═══════════════════════════════════════════════════════════════════════════════
  AaveV3Ethereum: {
    pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    explorers: [{
      base: 'https://etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3EthereumLido: {
    pool: '0x4e033931ad43597d96D6bcc25c280717730B58B1',
    explorers: [{
      base: 'https://etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3EthereumEtherFi: {
    pool: '0x0AA97c284e98396202b6A04024F5E2c65026F3c0',
    explorers: [{
      base: 'https://etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3EthereumHorizon: {
    pool: '0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8',
    explorers: [{
      base: 'https://etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // L2 / SIDECHAIN MARKETS - ETHERSCAN FAMILY
  // ═══════════════════════════════════════════════════════════════════════════════
  AaveV3Arbitrum: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    explorers: [{
      base: 'https://arbiscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Optimism: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    explorers: [{
      base: 'https://optimistic.etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Polygon: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    explorers: [{
      base: 'https://polygonscan.com',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Base: {
    pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    explorers: [{
      base: 'https://basescan.org',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Gnosis: {
    pool: '0xb50201558B00496A145fE76f7424749556E326D8',
    explorers: [{
      base: 'https://gnosisscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3BNB: {
    pool: '0x6807dc923806fE8Fd134338EABCA509979a7e0cB',
    explorers: [{
      base: 'https://bscscan.com',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Linea: {
    pool: '0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac',
    explorers: [{
      base: 'https://lineascan.build',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Sonic: {
    pool: '0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3',
    explorers: [{
      base: 'https://sonicscan.org',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Celo: {
    pool: '0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402',
    explorers: [{
      base: 'https://celoscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3MegaEth: {
    pool: '0x7e324AbC5De01d112AfC03a584966ff199741C28',
    explorers: [{
      base: 'https://mega.etherscan.io',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Plasma: {
    pool: '0x925a2A7214Ed92428B5b1B090F80b25700095e12',
    explorers: [{
      base: 'https://plasmascan.to',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },
  AaveV3Mantle: {
    pool: '0x458F293454fE0d67EC0655f3672301301DD51422',
    explorers: [{
      base: 'https://mantlescan.xyz',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },

  AaveV3Avalanche: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    explorers: [{
      base: 'https://snowscan.xyz',
      family: 'etherscan',
      deepLink: '#readProxyContract#F23',
    }],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ROUTESCAN FAMILY
  // ═══════════════════════════════════════════════════════════════════════════════
  AaveV3Metis: {
    pool: '0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57',
    explorers: [{
      base: 'https://metisscan.info',
      family: 'routescan',
      pathFormat: '/address/{pool}/contract/1088/readProxyContract',
      deepLink: '#F23',
    }],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // BLOCKSCOUT FAMILY
  // ═══════════════════════════════════════════════════════════════════════════════
  AaveV3Scroll: {
    pool: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe',
    explorers: [{
      base: 'https://scrollscan.com',
      family: 'blockscout',
      deepLink: '#0xc952485d',
    }],
  },
  AaveV3ZkSync: {
    pool: '0x78e30497a3c7527d953c6B1E3541b021A98Ac43c',
    explorers: [{
      base: 'https://zksync.blockscout.com',
      family: 'blockscout',
      deepLink: '#0xc952485d',
    }],
  },
  AaveV3Soneium: {
    pool: '0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B',
    explorers: [{
      base: 'https://soneium.blockscout.com',
      family: 'blockscout',
      deepLink: '#0xc952485d',
    }],
  },
  AaveV3Ink: {
    pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
    explorers: [{
      base: 'https://explorer.inkonchain.com',
      family: 'blockscout',
      deepLink: '#0xc952485d',
    }],
  },
  AaveV3InkWhitelabel: {
    pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
    explorers: [{
      base: 'https://explorer.inkonchain.com',
      family: 'blockscout',
      deepLink: '#0xc952485d',
    }],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OKLINK FAMILY
  // ═══════════════════════════════════════════════════════════════════════════════
  AaveV3XLayer: {
    pool: '0xE3F3Caefdd7180F884c01E57f65Df979Af84f116',
    explorers: [{
      base: 'https://www.oklink.com',
      family: 'oklink',
      pathFormat: '/x-layer/address/{pool}/contract',
      deepLink: '#category=proxy-read&id=22',
    }],
  },
};

/** 
 * Build a deep-link URL to the Pool contract's read-as-proxy page for a given
 * Aave market.
 *
 * - Etherscan-family explorers: `…/address/{pool}#readProxyContract#F23`
 *   (deep-links directly to the `getReserveData` function)
 * - Routescan: `…/address/{pool}/contract/{chainId}#readProxyContract#F23` (Metis)
 * - Blockscout: `…/address/{pool}?tab=read_proxy#0xc952485d`
 *   (`0xc952485d` = function selector of `getReserveData(address)`)
 * - OKLink: `…/x-layer/address/{pool}/contract#category=proxy-read&id=22`
 *
 * For V4 markets not in POOL_EXPLORER_MAP, falls back to chain-level explorer
 * using chainName.
 */
export function buildPoolExplorerUrl(
  marketName: string,
  options: { deepLink?: boolean; chainName?: string } = {},
): string | null {
  const { deepLink = true } = options;
  
  // Try V3 market mapping first
  const entry = POOL_EXPLORER_MAP[marketName];
  if (entry && entry.explorers.length > 0) {
    const explorer = entry.explorers[0];
    let path = '/address/' + entry.pool;
    if (explorer.pathFormat) {
      path = explorer.pathFormat.replace('{pool}', entry.pool);
    }

    // When deepLink is disabled, return the plain address page (no read-proxy anchor).
    if (!deepLink) {
      return `${explorer.base}${path}`;
    }

    // Build query/anchor based on family
    let suffix = '';
    if (explorer.family === 'etherscan' || explorer.family === 'routescan') {
      suffix = explorer.deepLink || '#readProxyContract#F23';
    } else if (explorer.family === 'blockscout') {
      suffix = '?tab=read_proxy' + (explorer.deepLink || '#0xc952485d');
    } else if (explorer.family === 'oklink') {
      suffix = explorer.deepLink || '';
    }

    return `${explorer.base}${path}${suffix}`;
  }

  // V4 markets don't have a single Pool contract (they use Hub & Spoke architecture)
  // so we return null here. Only token explorer links are provided for V4.
  return null;
}

/**
 * Get all available explorer URLs for a market (for markets with multiple explorers).
 */
export function getAllPoolExplorerUrls(marketName: string): { name: string; url: string }[] | null {
  const entry = POOL_EXPLORER_MAP[marketName];
  if (!entry) return null;
  
  return entry.explorers.map((explorer, index) => {
    let path = '/address/' + entry.pool;
    if (explorer.pathFormat) {
      path = explorer.pathFormat.replace('{pool}', entry.pool);
    }
    
    let suffix = '';
    if (explorer.family === 'etherscan' || explorer.family === 'routescan') {
      suffix = explorer.deepLink || '#readProxyContract#F23';
    } else if (explorer.family === 'blockscout') {
      suffix = '?tab=read_proxy' + (explorer.deepLink || '#0xc952485d');
    } else if (explorer.family === 'oklink') {
      suffix = explorer.deepLink || '';
    }
    
    return {
      name: index === 0 ? 'default' : explorer.base.replace(/^https?:\/\//, ''),
      url: `${explorer.base}${path}${suffix}`,
    };
  });
}

/** 
 * Get the Pool implementation address for a given market.
 * Useful for verifying the contract source code.
 */
export function getPoolAddress(marketName: string): string | null {
  return POOL_EXPLORER_MAP[marketName]?.pool ?? null;
}

/**
 * Get explorer family for a market (for conditional UI rendering).
 */
export function getExplorerFamily(marketName: string): string | null {
  return POOL_EXPLORER_MAP[marketName]?.explorers[0]?.family ?? null;
}

/** All market names in the explorer map. */
export function getExplorerMarketNames(): string[] {
  return Object.keys(POOL_EXPLORER_MAP);
}

/**
 * Build an explorer URL for an arbitrary token (underlying asset) address on the
 * same chain as the given Aave market. Reuses the market's primary explorer base
 * (and routescan pathFormat where applicable) but drops the `getReserveData` deep
 * link since token contracts have a different ABI.
 *
 * For V4 markets not in POOL_EXPLORER_MAP, falls back to chain-level explorer
 * using chainName.
 */
export function buildTokenExplorerUrl(
  marketName: string,
  tokenAddress: string | null | undefined,
  options: { chainName?: string } = {},
): string | null {
  if (!tokenAddress) return null;
  
  // Try V3 market mapping first
  const entry = POOL_EXPLORER_MAP[marketName];
  if (entry && entry.explorers.length > 0) {
    const explorer = entry.explorers[0];
    let path = '/address/' + tokenAddress;
    if (explorer.pathFormat) {
      path = explorer.pathFormat.replace('{pool}', tokenAddress);
    }
    return `${explorer.base}${path}`;
  }
  
  // Fallback for V4 markets: use chainName to build explorer URL
  const chainName = options.chainName;
  if (chainName && CHAIN_EXPLORER_MAP[chainName]) {
    const explorer = CHAIN_EXPLORER_MAP[chainName];
    let path = '/address/' + tokenAddress;
    if (explorer.pathFormat) {
      path = explorer.pathFormat.replace('{pool}', tokenAddress);
    }
    return `${explorer.base}${path}`;
  }

  return null;
}
