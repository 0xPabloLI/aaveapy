/**
 * Full test report generator for pool explorer links.
 * 
 * This script tests all explorer URLs in src/lib/poolExplorerLinks.ts by:
 * 1. Generating the URLs using buildPoolExplorerUrl()
 * 2. Opening each URL in a Chrome tab via CDP
 * 3. Checking if the page loads correctly and shows the expected content
 * 4. Reporting which markets work and which need fixes
 * 
 * Usage:
 *   node scripts/test-explorer-links-full.mjs [--markets=AaveV3Ethereum,AaveV3Arbitrum] [--output=json|md]
 * 
 * Environment:
 *   Requires Chrome with remote debugging enabled on port 9222
 *   Requires CDP proxy running on localhost:3456
 */

import { buildPoolExplorerUrl, getPoolAddress, getExplorerFamily } from '../src/lib/poolExplorerLinks.ts';

// All markets from poolExplorerLinks.ts
const ALL_MARKETS = [
  // Ethereum mainnet
  'AaveV3Ethereum',
  'AaveV3EthereumLido', 
  'AaveV3EthereumEtherFi',
  'AaveV3EthereumHorizon',
  // L2 / Sidechains
  'AaveV3Arbitrum',
  'AaveV3Optimism',
  'AaveV3Polygon',
  'AaveV3Avalanche',
  'AaveV3Base',
  'AaveV3Gnosis',
  'AaveV3BNB',
  'AaveV3Scroll',
  'AaveV3Metis',
  'AaveV3ZkSync',
  'AaveV3Linea',
  'AaveV3Sonic',
  'AaveV3Celo',
  'AaveV3Mantle',
  'AaveV3MegaEth',
  'AaveV3Plasma',
  // Blockscout
  'AaveV3Soneium',
  'AaveV3Ink',
  'AaveV3InkWhitelabel',
  // OKLink
  'AaveV3XLayer',
];

const CDP_PROXY = 'http://localhost:3456';
const SLEEP_MS = 6000; // Wait for page load

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function cdpRequest(path, body = null) {
  const url = `${CDP_PROXY}${path}`;
  const opts = body 
    ? { method: 'POST', headers: { 'content-type': 'text/plain' }, body: String(body) }
    : {};
  const res = await fetch(url, opts);
  return res.text();
}

async function testMarket(market) {
  const url = buildPoolExplorerUrl(market);
  if (!url) {
    return { market, status: 'no-url', error: 'No URL configured' };
  }

  const pool = getPoolAddress(market);
  const family = getExplorerFamily(market);

  // Open new tab
  const openRes = await cdpRequest(`/new?url=${encodeURIComponent(url)}`);
  let targetId;
  try {
    targetId = JSON.parse(openRes).targetId;
  } catch (e) {
    return { market, url, status: 'open-failed', error: openRes };
  }

  if (!targetId) {
    return { market, url, status: 'no-target', error: openRes };
  }

  // Wait for page load
  await sleep(SLEEP_MS);

  // Evaluate page state
  const evalExpr = `(() => {
    const t = document.title || '';
    const href = window.location.href || '';
    const hash = window.location.hash || '';
    const txt = document.body ? (document.body.innerText || '') : '';
    const lc = txt.toLowerCase();
    
    // Check for Cloudflare/security verification
    const blocked = lc.includes('just a moment') || 
                    lc.includes('security verification') ||
                    lc.includes('enable javascript and cookies') ||
                    lc.includes('ray id') ||
                    t.toLowerCase().includes('just a moment');
    
    // Check for content indicators
    const hasAddress = '${pool}'.toLowerCase().split('0x')[1] ? 
      lc.includes('${pool}'.toLowerCase().slice(2, 10)) : false;
    const hasGetReserveData = lc.includes('getreservedata');
    const hasReadProxy = lc.includes('read proxy') || lc.includes('read as proxy');
    const hasReadProxyDom = !!document.querySelector('#readProxyContract') ||
                            !!document.querySelector('[id*="readProxy" i]');
    const hasF23 = hash.includes('F23');
    const hasSelector = hash.includes('0xc952485d') || href.includes('0xc952485d');
    
    return {
      title: t,
      href,
      hash,
      bodyLen: txt.length,
      blocked,
      hasAddress,
      hasGetReserveData,
      hasReadProxyText: hasReadProxy,
      hasReadProxyDom,
      hasF23,
      hasSelector,
      bodyHead: txt.slice(0, 400),
    };
  })()`;

  const evalRes = await cdpRequest(`/eval?target=${targetId}`, evalExpr);
  let data;
  try {
    data = JSON.parse(evalRes);
  } catch (e) {
    data = { parseError: String(evalRes).slice(0, 500) };
  }

  // Determine status
  let status = 'unknown';
  if (data.blocked) {
    status = 'cloudflare-blocked';
  } else if (family === 'etherscan' || family === 'routescan') {
    if (data.hasGetReserveData) {
      status = 'deep-link-works';
    } else if (data.hasReadProxyDom || data.hasReadProxyText) {
      status = 'read-proxy-tab-exists';
    } else if (data.title && data.title.includes('Address')) {
      status = 'page-loads-no-anchor';
    } else {
      status = 'page-loads-unclear';
    }
  } else if (family === 'blockscout') {
    if (data.hasGetReserveData && data.hasSelector) {
      status = 'deep-link-works';
    } else if (data.hasGetReserveData) {
      status = 'function-visible';
    } else if (data.hasSelector) {
      status = 'selector-in-url';
    } else if (data.title && data.title.includes('Address')) {
      status = 'page-loads';
    } else {
      status = 'page-loads-unclear';
    }
  } else {
    status = data.title ? 'page-loads' : 'no-title';
  }

  return {
    market,
    url,
    family,
    pool,
    status,
    targetId,
    ...data,
  };
}

function formatReport(results, format = 'md') {
  if (format === 'json') {
    return JSON.stringify(results, null, 2);
  }

  // Markdown format
  const lines = [
    '# Pool Explorer Links Test Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Status | Count |',
    '|--------|-------|',
  ];

  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    lines.push(`| ${status} | ${count} |`);
  });

  lines.push(
    '',
    '## Detailed Results',
    '',
    '| Market | Family | Status | URL |',
    '|--------|--------|--------|-----|'
  );

  results.forEach(r => {
    const shortUrl = r.url ? r.url.replace(/\/address\//, '/.../').slice(0, 70) + '...' : 'N/A';
    lines.push(`| ${r.market} | ${r.family || 'N/A'} | ${r.status} | ${shortUrl} |`);
  });

  lines.push(
    '',
    '## Full URLs',
    ''
  );

  results.forEach(r => {
    lines.push(`### ${r.market} (${r.family || 'N/A'})`);
    lines.push(`- **Status:** ${r.status}`);
    lines.push(`- **URL:** ${r.url || 'N/A'}`);
    if (r.title) lines.push(`- **Title:** ${r.title}`);
    if (r.hasGetReserveData !== undefined) lines.push(`- **Has getReserveData:** ${r.hasGetReserveData}`);
    if (r.hasReadProxyDom !== undefined) lines.push(`- **Has ReadProxy DOM:** ${r.hasReadProxyDom}`);
    lines.push('');
  });

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const marketsArg = args.find(a => a.startsWith('--markets='))?.split('=')[1];
  const format = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'md';
  const outputFile = args.find(a => a.startsWith('--file='))?.split('=')[1];

  const markets = marketsArg ? marketsArg.split(',') : ALL_MARKETS;

  console.log(`Testing ${markets.length} markets...`);
  console.log('Connecting to CDP proxy at', CDP_PROXY);

  const results = [];
  for (const market of markets) {
    console.log(`Testing ${market}...`);
    try {
      const result = await testMarket(market);
      results.push(result);
      console.log(`  → ${result.status}`);
    } catch (e) {
      console.error(`  → ERROR: ${e.message}`);
      results.push({ market, status: 'error', error: e.message });
    }
    // Rate limiting between requests
    await sleep(2000);
  }

  const report = formatReport(results, format);
  
  if (outputFile) {
    const fs = await import('fs');
    fs.writeFileSync(outputFile, report);
    console.log(`\nReport written to ${outputFile}`);
  } else {
    console.log('\n--- REPORT ---\n');
    console.log(report);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
