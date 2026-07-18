const TESTNET_KEYWORDS = ['Sepolia', 'Fuji', 'Testnet'];
const BASE_MODULES = ['AaveV3', 'AaveV4'];
const SKIPPED_CHAINS = ['AaveV3Fantom', 'AaveV3Harmony'];
const ETHEREUM_SUB_POOLS = [
  'AaveV3EthereumEtherFi',
  'AaveV3EthereumHorizon',
  'AaveV3EthereumLido',
];

export function shouldIncludeModule(name) {
  if (BASE_MODULES.includes(name)) return false;
  if (TESTNET_KEYWORDS.some((kw) => name.includes(kw))) return false;
  if (SKIPPED_CHAINS.includes(name)) return false;
  if (ETHEREUM_SUB_POOLS.includes(name)) return false;
  return true;
}

export async function discoverMainnetChainIds() {
  const ab = await import('@aave-dao/aave-address-book');
  const ids = new Set();
  for (const [name, mod] of Object.entries(ab)) {
    if (!shouldIncludeModule(name)) continue;
    const m = mod;
    if (!m || typeof m.CHAIN_ID !== 'number') continue;
    if (typeof m.POOL === 'string' && m.POOL.startsWith('0x')) {
      ids.add(m.CHAIN_ID);
      continue;
    }
    if (m.SPOKES && typeof m.SPOKES === 'object') {
      ids.add(m.CHAIN_ID);
      continue;
    }
  }
  return ids;
}
