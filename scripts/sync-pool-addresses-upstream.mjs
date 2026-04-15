/**
 * Sync Pool addresses from bgd-labs/aave-address-book
 * 
 * This script fetches the latest Pool addresses from the official
 * bgd-labs/aave-address-book repository and updates the local mapping.
 * 
 * Usage: node scripts/sync-pool-addresses-upstream.mjs
 */

import { writeFile } from 'fs/promises';

const NPM_PACKAGE = '@bgd-labs/aave-address-book';
const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/bgd-labs/aave-address-book/main/src';

// Markets to sync with their configuration
const MARKET_CONFIG = {
  // Ethereum mainnet markets
  AaveV3Ethereum: { explorerBase: 'https://etherscan.io', family: 'etherscan' },
  AaveV3EthereumLido: { explorerBase: 'https://etherscan.io', family: 'etherscan' },
  AaveV3EthereumEtherFi: { explorerBase: 'https://etherscan.io', family: 'etherscan' },
  AaveV3EthereumHorizon: { explorerBase: 'https://etherscan.io', family: 'etherscan' },
  
  // L2 markets - Etherscan family
  AaveV3Arbitrum: { explorerBase: 'https://arbiscan.io', family: 'etherscan' },
  AaveV3Optimism: { explorerBase: 'https://optimistic.etherscan.io', family: 'etherscan' },
  AaveV3Polygon: { explorerBase: 'https://polygonscan.com', family: 'etherscan' },
  AaveV3Base: { explorerBase: 'https://basescan.org', family: 'etherscan' },
  AaveV3Gnosis: { explorerBase: 'https://gnosisscan.io', family: 'etherscan' },
  AaveV3BNB: { explorerBase: 'https://bscscan.com', family: 'etherscan' },
  AaveV3Linea: { explorerBase: 'https://lineascan.build', family: 'etherscan' },
  AaveV3Sonic: { explorerBase: 'https://sonicscan.org', family: 'etherscan' },
  AaveV3Celo: { explorerBase: 'https://celoscan.io', family: 'etherscan' },
  AaveV3MegaEth: { explorerBase: 'https://mega.etherscan.io', family: 'etherscan' },
  AaveV3Plasma: { explorerBase: 'https://plasmascan.to', family: 'etherscan' },
  
  // L2 markets - Etherscan / Routescan family
  AaveV3Avalanche: { explorerBase: 'https://snowscan.xyz', family: 'etherscan' },
  AaveV3Metis: { 
    explorerBase: 'https://metisscan.info', 
    family: 'routescan',
    pathFormat: '/address/{pool}/contract/1088'
  },
  AaveV3Mantle: { explorerBase: 'https://mantlescan.xyz', family: 'etherscan' },
  
  // L2 markets - Blockscout family
  AaveV3Scroll: { explorerBase: 'https://scrollscan.com', family: 'blockscout' },
  AaveV3ZkSync: { explorerBase: 'https://zksync.blockscout.com', family: 'blockscout' },
  AaveV3Soneium: { explorerBase: 'https://soneium.blockscout.com', family: 'blockscout' },
  AaveV3Ink: { explorerBase: 'https://explorer.inkonchain.com', family: 'blockscout' },
  AaveV3InkWhitelabel: { explorerBase: 'https://explorer.inkonchain.com', family: 'blockscout' },
  
  // OKLink family
  AaveV3XLayer: { 
    explorerBase: 'https://www.oklink.com', 
    family: 'oklink',
    pathFormat: '/x-layer/address/{pool}/contract#category=proxy-read&id=22'
  },
};

async function fetchPoolAddress(marketName) {
  try {
    const url = `${RAW_GITHUB_BASE}/${marketName}.sol`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ ${marketName}: Failed to fetch (${response.status})`);
      return null;
    }
    
    const content = await response.text();
    
    // Extract POOL address from Solidity file
    const poolMatch = content.match(/POOL\s*=\s*(?:address\()?0x([a-fA-F0-9]{40})\)?/);
    if (poolMatch) {
      return `0x${poolMatch[1]}`;
    }
    
    console.warn(`⚠️ ${marketName}: Could not find POOL address in source`);
    return null;
  } catch (error) {
    console.error(`❌ ${marketName}: Error fetching - ${error.message}`);
    return null;
  }
}

async function syncPoolAddresses() {
  console.log('🔍 Fetching Pool addresses from bgd-labs/aave-address-book...\n');
  
  const results = {};
  const errors = [];
  
  for (const [marketName, config] of Object.entries(MARKET_CONFIG)) {
    const pool = await fetchPoolAddress(marketName);
    if (pool) {
      results[marketName] = {
        pool,
        ...config
      };
      console.log(`✅ ${marketName}: ${pool}`);
    } else {
      errors.push(marketName);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n📊 Summary: ${Object.keys(results).length}/${Object.keys(MARKET_CONFIG).length} markets synced`);
  
  if (errors.length > 0) {
    console.warn(`\n⚠️ Failed to sync: ${errors.join(', ')}`);
  }
  
  return results;
}

// Run the sync
syncPoolAddresses().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
