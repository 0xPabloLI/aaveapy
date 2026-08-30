import { describe, it, expect } from 'vitest';
import {
  buildPoolExplorerUrl,
  buildTokenExplorerUrl,
  buildHubExplorerUrl,
  buildSpokeExplorerUrl,
  getAllPoolExplorerUrls,
  getPoolAddress,
  getExplorerFamily,
  getExplorerMarketNames,
} from './poolExplorerLinks';

// ═══════════════════════════════════════════════════════════════════════════════
// getReserveData deep-link validation
//
// Every generated URL MUST deep-link to the Pool contract's `getReserveData`
// read-as-proxy function. The mechanism differs per explorer family:
//
//   etherscan  → #readProxyContract#F23  (F23 = getReserveData position)
//   routescan  → /contract/{chainId}/readProxyContract#F23
//   blockscout → ?tab=read_proxy#0xc952485d  (function selector)
//   oklink     → #category=proxy-read&id=22
// ═══════════════════════════════════════════════════════════════════════════════

/** getReserveData(address) function selector = keccak256("getReserveData(address)")[0:4] */
const GET_RESERVE_DATA_SELECTOR = '0xc952485d';

/** Etherscan position index for getReserveData in the Pool proxy ABI */
const ETHERSCAN_FUNCTION_INDEX = 'F23';

describe('Every market deep-links to getReserveData', () => {
  const allMarkets = getExplorerMarketNames();

  it.each(allMarkets)('%s generates a non-null URL', (market) => {
    expect(buildPoolExplorerUrl(market)).not.toBeNull();
  });

  it.each(allMarkets)('%s URL contains the pool address', (market) => {
    const url = buildPoolExplorerUrl(market)!;
    const pool = getPoolAddress(market)!;
    expect(url).toContain(pool);
  });

  it.each(allMarkets)('%s URL has a getReserveData deep-link anchor', (market) => {
    const url = buildPoolExplorerUrl(market)!;
    const family = getExplorerFamily(market);

    switch (family) {
      case 'etherscan':
        // Must contain #readProxyContract#F23 to jump to getReserveData
        expect(url).toContain('#readProxyContract#' + ETHERSCAN_FUNCTION_INDEX);
        break;
      case 'routescan':
        // Must contain /contract/{chainId}/readProxyContract path AND #F23
        expect(url).toMatch(/\/contract\/\d+/);
        expect(url).toMatch(new RegExp('/readProxyContract#' + ETHERSCAN_FUNCTION_INDEX));
        break;
      case 'blockscout':
        // Must contain ?tab=read_proxy to open the proxy tab
        // and #0xc952485d to scroll to getReserveData
        expect(url).toContain('?tab=read_proxy');
        expect(url).toContain('#' + GET_RESERVE_DATA_SELECTOR);
        break;
      case 'oklink':
        // Must contain proxy-read category
        expect(url).toContain('#category=proxy-read');
        break;
      default:
        throw new Error(`Unknown explorer family: ${family}`);
    }
  });
});

describe('Etherscan family URL format', () => {
  const etherscanMarkets = getExplorerMarketNames().filter(
    (m) => getExplorerFamily(m) === 'etherscan'
  );

  it.each(etherscanMarkets)(
    '%s follows https://{explorer}/address/{pool}#readProxyContract#F23',
    (market) => {
      const url = buildPoolExplorerUrl(market)!;
      expect(url).toMatch(
        /^https:\/\/[^/]+\/address\/0x[a-fA-F0-9]{40}#readProxyContract#F23$/
      );
    }
  );
});

describe('Routescan family URL format', () => {
  const routescanMarkets = getExplorerMarketNames().filter(
    (m) => getExplorerFamily(m) === 'routescan'
  );

  it.each(routescanMarkets)(
    '%s follows https://{explorer}/address/{pool}/contract/{chainId}/readProxyContract#F23',
    (market) => {
      const url = buildPoolExplorerUrl(market)!;
      expect(url).toMatch(
        /^https:\/\/[^/]+\/address\/0x[a-fA-F0-9]{40}\/contract\/\d+\/readProxyContract#F23$/
      );
    }
  );
});

describe('Blockscout family URL format', () => {
  const blockscoutMarkets = getExplorerMarketNames().filter(
    (m) => getExplorerFamily(m) === 'blockscout'
  );

  it.each(blockscoutMarkets)(
    '%s follows https://{explorer}/address/{pool}?tab=read_proxy#0xc952485d',
    (market) => {
      const url = buildPoolExplorerUrl(market)!;
      expect(url).toMatch(
        /^https:\/\/[^/]+\/address\/0x[a-fA-F0-9]{40}\?tab=read_proxy#0xc952485d$/
      );
    }
  );
});

describe('OKLink family URL format', () => {
  it('AaveV3XLayer deep-links to proxy-read category', () => {
    const url = buildPoolExplorerUrl('AaveV3XLayer')!;
    expect(url).toContain('/contract#category=proxy-read&id=22');
  });
});

describe('Pool addresses match aave-address-book', () => {
  // Verified against @aave-dao/aave-address-book src/{Market}.sol POOL constants.
  const expectedAddresses: Record<string, string> = {
    AaveV3Ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    AaveV3EthereumLido: '0x4e033931ad43597d96D6bcc25c280717730B58B1',
    AaveV3EthereumEtherFi: '0x0AA97c284e98396202b6A04024F5E2c65026F3c0',
    AaveV3EthereumHorizon: '0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8',
    AaveV3Arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    AaveV3Optimism: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    AaveV3Polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    AaveV3Avalanche: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    AaveV3Base: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    AaveV3Gnosis: '0xb50201558B00496A145fE76f7424749556E326D8',
    AaveV3BNB: '0x6807dc923806fE8Fd134338EABCA509979a7e0cB',
    AaveV3Linea: '0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac',
    AaveV3Sonic: '0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3',
    AaveV3Celo: '0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402',
    AaveV3MegaEth: '0x7e324AbC5De01d112AfC03a584966ff199741C28',
    AaveV3Plasma: '0x925a2A7214Ed92428B5b1B090F80b25700095e12',
    AaveV3Mantle: '0x458F293454fE0d67EC0655f3672301301DD51422',
    AaveV3Metis: '0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57',
    AaveV3Scroll: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe',
    AaveV3ZkSync: '0x78e30497a3c7527d953c6B1E3541b021A98Ac43c',
    AaveV3Soneium: '0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B',
    AaveV3Ink: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
    AaveV3InkWhitelabel: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA',
    AaveV3XLayer: '0xE3F3Caefdd7180F884c01E57f65Df979Af84f116',
  };

  it.each(Object.entries(expectedAddresses))(
    '%s pool address matches address-book',
    (market, expected) => {
      expect(getPoolAddress(market)).toBe(expected);
    }
  );
});

describe('Pool addresses are checksummed', () => {
  const allMarkets = getExplorerMarketNames();

  it.each(allMarkets)('%s has a valid checksummed pool address', (market) => {
    const address = getPoolAddress(market);
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(address).not.toEqual(address?.toLowerCase());
  });
});

describe('Specific URL snapshots', () => {
  it('Ethereum', () => {
    expect(buildPoolExplorerUrl('AaveV3Ethereum')).toBe(
      'https://etherscan.io/address/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2#readProxyContract#F23'
    );
  });

  it('Avalanche uses snowscan.xyz (etherscan family)', () => {
    expect(buildPoolExplorerUrl('AaveV3Avalanche')).toBe(
      'https://snowscan.xyz/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#readProxyContract#F23'
    );
  });

  it('Metis uses /contract/1088/readProxyContract#F23', () => {
    expect(buildPoolExplorerUrl('AaveV3Metis')).toBe(
      'https://metisscan.info/address/0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57/contract/1088/readProxyContract#F23'
    );
  });

  it('Mantle is etherscan family', () => {
    expect(buildPoolExplorerUrl('AaveV3Mantle')).toBe(
      'https://mantlescan.xyz/address/0x458F293454fE0d67EC0655f3672301301DD51422#readProxyContract#F23'
    );
  });

  it('Linea uses correct address-book address', () => {
    expect(buildPoolExplorerUrl('AaveV3Linea')).toBe(
      'https://lineascan.build/address/0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac#readProxyContract#F23'
    );
  });

  it('ZkSync blockscout with correct address', () => {
    expect(buildPoolExplorerUrl('AaveV3ZkSync')).toBe(
      'https://zksync.blockscout.com/address/0x78e30497a3c7527d953c6B1E3541b021A98Ac43c?tab=read_proxy#0xc952485d'
    );
  });

  it('Plasma with correct address-book address', () => {
    expect(buildPoolExplorerUrl('AaveV3Plasma')).toBe(
      'https://plasmascan.to/address/0x925a2A7214Ed92428B5b1B090F80b25700095e12#readProxyContract#F23'
    );
  });

  it('Soneium blockscout with function selector', () => {
    expect(buildPoolExplorerUrl('AaveV3Soneium')).toBe(
      'https://soneium.blockscout.com/address/0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B?tab=read_proxy#0xc952485d'
    );
  });

  it('XLayer OKLink with proxy-read', () => {
    expect(buildPoolExplorerUrl('AaveV3XLayer')).toBe(
      'https://www.oklink.com/x-layer/address/0xE3F3Caefdd7180F884c01E57f65Df979Af84f116/contract#category=proxy-read&id=22'
    );
  });
});

describe('buildHubExplorerUrl', () => {
  it('returns null for null/undefined hubAddress', () => {
    expect(buildHubExplorerUrl(null)).toBeNull();
    expect(buildHubExplorerUrl(undefined)).toBeNull();
  });

  it('returns null when chainName is not in CHAIN_EXPLORER_MAP', () => {
    expect(
      buildHubExplorerUrl('0xCca8260D641e5c1D5b0a4f4a6E2e6b1E1f0cA3b9', {
        chainName: 'UnknownChain',
      }),
    ).toBeNull();
  });

  it('builds etherscan family URL for Ethereum Hub', () => {
    const hubAddr = '0xCca8260D641e5c1D5b0a4f4a6E2e6b1E1f0cA3b9';
    expect(buildHubExplorerUrl(hubAddr, { chainName: 'Ethereum' })).toBe(
      `https://etherscan.io/address/${hubAddr}`,
    );
  });
});

describe('buildSpokeExplorerUrl', () => {
  it('returns null for null/undefined spokeAddress', () => {
    expect(buildSpokeExplorerUrl(null)).toBeNull();
    expect(buildSpokeExplorerUrl(undefined)).toBeNull();
  });

  it('returns null when chainName is not in CHAIN_EXPLORER_MAP', () => {
    expect(
      buildSpokeExplorerUrl('0xCca8260D641e5c1D5b0a4f4a6E2e6b1E1f0cA3b9', {
        chainName: 'UnknownChain',
      }),
    ).toBeNull();
  });

  it('builds etherscan family URL for Ethereum Spoke', () => {
    const spokeAddr = '0xAa11Bb22Cc33Dd44Ee55Ff66Aa77Bb88Cc99Dd00';
    expect(buildSpokeExplorerUrl(spokeAddr, { chainName: 'Ethereum' })).toBe(
      `https://etherscan.io/address/${spokeAddr}`,
    );
  });

  it('builds arbiscan URL for Arbitrum Spoke', () => {
    const spokeAddr = '0xAa11Bb22Cc33Dd44Ee55Ff66Aa77Bb88Cc99Dd00';
    expect(buildSpokeExplorerUrl(spokeAddr, { chainName: 'Arbitrum' })).toBe(
      `https://arbiscan.io/address/${spokeAddr}`,
    );
  });

  it('returns null when no chainName provided', () => {
    expect(
      buildSpokeExplorerUrl('0xCca8260D641e5c1D5b0a4f4a6E2e6b1E1f0cA3b9'),
    ).toBeNull();
  });
});

describe('getAllPoolExplorerUrls', () => {
  it('returns null for an unknown market', () => {
    expect(getAllPoolExplorerUrls('AaveV3Nowhere')).toBeNull();
  });

  it('returns a non-empty list for every known market, first entry named "default"', () => {
    for (const market of getExplorerMarketNames()) {
      const urls = getAllPoolExplorerUrls(market);
      expect(urls, `${market} should have explorer URLs`).not.toBeNull();
      expect(urls!.length).toBeGreaterThanOrEqual(1);
      expect(urls![0].name).toBe('default');

      const pool = getPoolAddress(market)!;
      for (const { url } of urls!) {
        expect(url).toContain(pool);
        expect(url.startsWith('https://')).toBe(true);
      }
    }
  });

  it('carries the family deep-link suffix on every entry', () => {
    for (const market of getExplorerMarketNames()) {
      const family = getExplorerFamily(market)!;
      for (const { url } of getAllPoolExplorerUrls(market)!) {
        switch (family) {
          case 'etherscan':
          case 'routescan':
            expect(url).toContain('#F23');
            break;
          case 'blockscout':
            expect(url).toContain('?tab=read_proxy');
            expect(url).toContain('#0xc952485d');
            break;
          case 'oklink':
            expect(url).toContain('#category=proxy-read');
            break;
          default:
            throw new Error(`Unknown explorer family: ${family}`);
        }
      }
    }
  });
});

describe('buildTokenExplorerUrl', () => {
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  it('returns null for null/undefined token address', () => {
    expect(buildTokenExplorerUrl('AaveV3Ethereum', null)).toBeNull();
    expect(buildTokenExplorerUrl('AaveV3Ethereum', undefined)).toBeNull();
    expect(buildTokenExplorerUrl('AaveV3Ethereum', '')).toBeNull();
  });

  it('uses the market primary explorer base with a plain address page (no deep link)', () => {
    const url = buildTokenExplorerUrl('AaveV3Ethereum', USDC)!;
    expect(url).toBe(`https://etherscan.io/address/${USDC}`);
    expect(url).not.toContain('#');
  });

  it('applies routescan pathFormat for Metis token links', () => {
    const url = buildTokenExplorerUrl('AaveV3Metis', USDC)!;
    expect(url).toBe(
      `https://metisscan.info/address/${USDC}/contract/1088/readProxyContract`,
    );
    expect(url).not.toContain('#F23');
  });

  it('falls back to CHAIN_EXPLORER_MAP via chainName for unmapped (V4) markets', () => {
    const url = buildTokenExplorerUrl('AaveV4Nowhere', USDC, {
      chainName: 'Ethereum',
    })!;
    expect(url).toBe(`https://etherscan.io/address/${USDC}`);
  });

  it('returns null for unmapped market without chainName', () => {
    expect(buildTokenExplorerUrl('AaveV4Nowhere', USDC)).toBeNull();
    expect(buildTokenExplorerUrl('AaveV4Nowhere', USDC, { chainName: 'UnknownChain' })).toBeNull();
  });
});
