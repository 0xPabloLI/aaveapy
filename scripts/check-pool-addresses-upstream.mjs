import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/aave-dao/aave-address-book/main/src';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const poolExplorerLinksPath = path.join(repoRoot, 'src/lib/poolExplorerLinks.ts');
const addressBookSrcDir = path.join(repoRoot, 'node_modules/@aave-dao/aave-address-book/src');

const MARKET_SOURCE_FILES = {
  AaveV3Ethereum: 'AaveV3Ethereum.sol',
  AaveV3EthereumLido: 'AaveV3EthereumLido.sol',
  AaveV3EthereumEtherFi: 'AaveV3EthereumEtherFi.sol',
  AaveV3EthereumHorizon: 'AaveV3EthereumHorizon.sol',
  AaveV3Arbitrum: 'AaveV3Arbitrum.sol',
  AaveV3Optimism: 'AaveV3Optimism.sol',
  AaveV3Polygon: 'AaveV3Polygon.sol',
  AaveV3Base: 'AaveV3Base.sol',
  AaveV3Gnosis: 'AaveV3Gnosis.sol',
  AaveV3BNB: 'AaveV3BNB.sol',
  AaveV3Linea: 'AaveV3Linea.sol',
  AaveV3Sonic: 'AaveV3Sonic.sol',
  AaveV3Celo: 'AaveV3Celo.sol',
  AaveV3MegaEth: 'AaveV3MegaEth.sol',
  AaveV3Plasma: 'AaveV3Plasma.sol',
  AaveV3Mantle: 'AaveV3Mantle.sol',
  AaveV3Avalanche: 'AaveV3Avalanche.sol',
  AaveV3Metis: 'AaveV3Metis.sol',
  AaveV3Scroll: 'AaveV3Scroll.sol',
  AaveV3ZkSync: 'AaveV3ZkSync.sol',
  AaveV3Soneium: 'AaveV3Soneium.sol',
  AaveV3Ink: 'AaveV3InkWhitelabel.sol',
  AaveV3InkWhitelabel: 'AaveV3InkWhitelabel.sol',
  AaveV3XLayer: 'AaveV3XLayer.sol',
};

async function readAddressBookPool(sourceFile) {
  let content;
  try {
    content = await readFile(path.join(addressBookSrcDir, sourceFile), 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      const response = await fetch(`${RAW_GITHUB_BASE}/${sourceFile}`);
      if (!response.ok) {
        throw new Error(`Could not load ${sourceFile} from npm package or GitHub raw (${response.status})`);
      }
      content = await response.text();
    } else {
      throw error;
    }
  }

  const match = content.match(/IPool internal constant POOL = IPool\((0x[a-fA-F0-9]{40})\);/);
  if (!match) {
    throw new Error(`Could not parse POOL from ${sourceFile}`);
  }
  return match[1];
}

async function main() {
  const content = await readFile(poolExplorerLinksPath, 'utf8');
  const mismatches = [];

  for (const [market, sourceFile] of Object.entries(MARKET_SOURCE_FILES)) {
    const expectedPool = await readAddressBookPool(sourceFile);
    const marketRegex = new RegExp(`${market}:\\s*\\{\\s*pool:\\s*'(0x[a-fA-F0-9]{40})'`);
    const match = content.match(marketRegex);
    if (!match) {
      mismatches.push(`${market}: missing from poolExplorerLinks.ts`);
      continue;
    }

    const currentPool = match[1];
    if (currentPool !== expectedPool) {
      mismatches.push(`${market}: expected ${expectedPool}, got ${currentPool}`);
    }
  }

  if (mismatches.length > 0) {
    console.error('Pool address drift detected against @aave-dao/aave-address-book:');
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }

  console.log('All pool addresses match @aave-dao/aave-address-book');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
