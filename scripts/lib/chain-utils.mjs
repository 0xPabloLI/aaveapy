const TESTNET_KEYWORDS = ['Sepolia', 'Fuji', 'Testnet'];
const BASE_MODULES = ['AaveV3', 'AaveV4'];
const SKIPPED_CHAINS = ['AaveV3Fantom', 'AaveV3Harmony'];
const ETHEREUM_SUB_POOLS = ['AaveV3EthereumEtherFi', 'AaveV3EthereumHorizon', 'AaveV3EthereumLido'];

export function shouldIncludeModule(name) {
  if (BASE_MODULES.includes(name)) return false;
  if (TESTNET_KEYWORDS.some((kw) => name.includes(kw))) return false;
  if (SKIPPED_CHAINS.includes(name)) return false;
  if (ETHEREUM_SUB_POOLS.includes(name)) return false;
  return true;
}

export async function discoverMainnetChainModules() {
  const ab = await import('@aave-dao/aave-address-book');
  const byChainId = new Map();
  for (const [name, mod] of Object.entries(ab)) {
    if (!shouldIncludeModule(name)) continue;
    const m = mod;
    if (!m || typeof m.CHAIN_ID !== 'number') continue;
    const qualifies =
      (typeof m.POOL === 'string' && m.POOL.startsWith('0x')) || (m.SPOKES && typeof m.SPOKES === 'object');
    if (!qualifies) continue;
    // Same chainId from multiple modules (e.g. AaveV1 + AaveV3Ethereum for
    // chainId 1): prefer modern AaveV3/V4 modules for slug derivation, then
    // lexicographic order for determinism.
    const prev = byChainId.get(m.CHAIN_ID);
    if (prev == null || moduleRank(name) < moduleRank(prev) || (moduleRank(name) === moduleRank(prev) && name < prev)) {
      byChainId.set(m.CHAIN_ID, name);
    }
  }
  return byChainId;
}

function moduleRank(name) {
  return /^AaveV[34]/.test(name) ? 0 : 1;
}

export async function discoverMainnetChainIds() {
  const modules = await discoverMainnetChainModules();
  return new Set(modules.keys());
}
