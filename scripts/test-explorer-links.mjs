/**
 * @fileoverview 测试所有 Pool Explorer 链接的有效性
 * 
 * 使用方法:
 *   node scripts/test-explorer-links.mjs [options]
 * 
 * 选项:
 *   --market <name>    仅测试指定市场 (如: AaveV3Ethereum)
 *   --family <family>  仅测试指定 family (etherscan|blockscout|oklink|routescan)
 *   --batch            批量测试所有市场
 *   --output <file>    输出结果到文件
 *   --timeout <ms>     页面加载超时 (默认 5000ms)
 * 
 * 依赖:
 *   - Chrome Remote Debugging 端口 9222
 *   - CDP Proxy 运行在 http://localhost:3456
 * 
 * 示例:
 *   node scripts/test-explorer-links.mjs --market AaveV3Ethereum
 *   node scripts/test-explorer-links.mjs --batch --output test-results.json
 */

import { spawnSync } from 'child_process';

const CDP_URL = 'http://localhost:3456';
const TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '5000', 10);

// Market 配置 (从 poolExplorerLinks.ts 同步)
const MARKETS = {
  // Etherscan family
  'AaveV3Ethereum': { pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', family: 'etherscan', base: 'https://etherscan.io' },
  'AaveV3EthereumLido': { pool: '0x4e033931ad43597d96D6bcc25c280717730B58B1', family: 'etherscan', base: 'https://etherscan.io' },
  'AaveV3EthereumEtherFi': { pool: '0x0AA97c284e98396202b6A04024F5E2c65026F3c0', family: 'etherscan', base: 'https://etherscan.io' },
  'AaveV3EthereumHorizon': { pool: '0xAe05Cd22df81871bc7cC2a04BeCfb516bFe332C8', family: 'etherscan', base: 'https://etherscan.io' },
  'AaveV3Arbitrum': { pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', family: 'etherscan', base: 'https://arbiscan.io' },
  'AaveV3Optimism': { pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', family: 'etherscan', base: 'https://optimistic.etherscan.io' },
  'AaveV3Polygon': { pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', family: 'etherscan', base: 'https://polygonscan.com' },
  'AaveV3Base': { pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', family: 'etherscan', base: 'https://basescan.org' },
  'AaveV3Gnosis': { pool: '0xb50201558B00496A145fE76f7424749556E326D8', family: 'etherscan', base: 'https://gnosisscan.io' },
  'AaveV3BNB': { pool: '0x6807dc923806fE8Fd134338EABCA509979a7e0cB', family: 'etherscan', base: 'https://bscscan.com' },
  'AaveV3Linea': { pool: '0xc6a4d1E563094CDF7F6e1359cE806B29617D2938', family: 'etherscan', base: 'https://lineascan.build' },
  'AaveV3Sonic': { pool: '0x5362dBb1e601abF3a4c14c22ffEdA64042E5Eaa3', family: 'etherscan', base: 'https://sonicscan.org' },
  'AaveV3Celo': { pool: '0x3E59A31363E2ad014dcbc521c4a0d5757d9F3402', family: 'etherscan', base: 'https://celoscan.io' },
  'AaveV3MegaEth': { pool: '0x7e324AbC5De01d112AfC03a584966ff199741C28', family: 'etherscan', base: 'https://mega.etherscan.io' },
  'AaveV3Plasma': { pool: '0x925a2A7214Ed92428B5b1B090F80b25700095e12', family: 'etherscan', base: 'https://plasmascan.to' },
  
  // Routescan family
  'AaveV3Avalanche': { pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', family: 'routescan', base: 'https://snowtrace.io' },
  'AaveV3Metis': { pool: '0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57', family: 'routescan', base: 'https://metisscan.info', customPath: '/contract/1088' },
  
  // Blockscout family
  'AaveV3Scroll': { pool: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe', family: 'blockscout', base: 'https://scrollscan.com' },
  'AaveV3ZkSync': { pool: '0x78e30497a3c7527d953C6B1E3541b021A98Bddf7', family: 'blockscout', base: 'https://zksync.blockscout.com' },
  'AaveV3Soneium': { pool: '0xDd3d7A7d03D9fD9ef45f3E587287922eF65CA38B', family: 'blockscout', base: 'https://soneium.blockscout.com' },
  'AaveV3Ink': { pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA', family: 'blockscout', base: 'https://explorer.inkonchain.com' },
  'AaveV3InkWhitelabel': { pool: '0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA', family: 'blockscout', base: 'https://explorer.inkonchain.com' },
  
  // OKLink family
  'AaveV3XLayer': { pool: '0xE3F3Caefdd7180F884c01E57f65Df979Af84f116', family: 'oklink', base: 'https://www.oklink.com', customPath: '/x-layer' },
};

function buildUrl(market, config) {
  const { pool, family, base, customPath = '' } = config;
  
  switch (family) {
    case 'etherscan':
      return `${base}/address/${pool}#readProxyContract#F23`;
    case 'routescan':
      // Metis 和 Avalanche 使用特殊路径格式
      if (base.includes('metisscan')) {
        return `${base}/address/${pool}/contract/1088/readProxyContract#F23`;
      }
      return `${base}/address/${pool}#readProxyContract#F23`;
    case 'blockscout':
      return `${base}/address/${pool}?tab=read_proxy#0xc952485d`;
    case 'oklink':
      return `${base}${customPath}/address/${pool}/contract#category=proxy-read&id=22`;
    default:
      return `${base}/address/${pool}`;
  }
}

function cdpCommand(endpoint, body = null) {
  const args = ['-s', `${CDP_URL}${endpoint}`];
  if (body) {
    args.push('-X', 'POST', '-d', body);
  }
  const result = spawnSync('curl', args, { encoding: 'utf8' });
  return result.stdout.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMarket(marketName, config) {
  const url = buildUrl(marketName, config);
  
  console.log(`\n[${marketName}] Testing...`);
  console.log(`  URL: ${url}`);
  
  // 创建新 tab
  const newRes = cdpCommand(`/new?url=${encodeURIComponent(url)}`);
  let targetId;
  try {
    targetId = JSON.parse(newRes).targetId;
  } catch {
    return { market: marketName, status: 'OPEN_FAILED', error: newRes };
  }
  
  console.log(`  Target ID: ${targetId}`);
  
  // 等待页面加载
  await sleep(TIMEOUT);
  
  // 执行 JS 检查页面状态
  const js = `(() => {
    const t = document.title || '';
    const href = window.location.href || '';
    const hash = window.location.hash || '';
    const txt = document.body ? document.body.innerText || '' : '';
    const lc = txt.toLowerCase();
    
    // 检查是否被 Cloudflare 阻挡
    const blocked = t.includes('Just a moment') || 
                    lc.includes('performing security verification') ||
                    lc.includes('ray id');
    
    // 检查关键元素
    const hasReadProxy = !!document.querySelector('#readProxyContract') ||
                         !!document.querySelector('[id*="readProxy" i]');
    const hasGetReserveData = lc.includes('getreservedata');
    const hasContractTab = lc.includes('contract') || lc.includes('read proxy');
    
    return {
      title: t,
      href,
      hash,
      blocked,
      hasReadProxy,
      hasGetReserveData,
      hasContractTab,
      bodyPreview: txt.slice(0, 300),
    };
  })()`;
  
  const evalRes = cdpCommand(`/eval?target=${targetId}`, js);
  let data;
  try {
    data = JSON.parse(evalRes).value || JSON.parse(evalRes);
  } catch {
    data = { parseError: evalRes };
  }
  
  // 关闭 tab
  cdpCommand(`/close?target=${targetId}`);
  
  // 判断结果
  let status;
  if (data.blocked) {
    status = 'CLOUDFLARE_BLOCKED';
  } else if (data.hasGetReserveData) {
    status = 'DEEP_LINK_OK';
  } else if (data.hasReadProxy) {
    status = 'READ_PROXY_TAB_OK';
  } else if (data.hasContractTab) {
    status = 'CONTRACT_PAGE_OK';
  } else if (data.title && !data.title.includes('Error')) {
    status = 'PAGE_LOADED';
  } else {
    status = 'UNKNOWN';
  }
  
  const result = {
    market: marketName,
    family: config.family,
    url,
    status,
    title: data.title,
    hasReadProxy: data.hasReadProxy,
    hasGetReserveData: data.hasGetReserveData,
    blocked: data.blocked,
    bodyPreview: data.bodyPreview,
  };
  
  console.log(`  Status: ${status}`);
  if (data.hasGetReserveData) console.log(`  ✅ getReserveData visible!`);
  if (data.hasReadProxy) console.log(`  ✅ Read Proxy tab found!`);
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const singleMarket = args.includes('--market') ? args[args.indexOf('--market') + 1] : null;
  const familyFilter = args.includes('--family') ? args[args.indexOf('--family') + 1] : null;
  const isBatch = args.includes('--batch');
  const outputFile = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  
  console.log('🔍 Pool Explorer Links Test\n');
  console.log(`CDP URL: ${CDP_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms\n`);
  
  // 选择要测试的市场
  let marketsToTest = Object.entries(MARKETS);
  
  if (singleMarket) {
    if (!MARKETS[singleMarket]) {
      console.error(`Unknown market: ${singleMarket}`);
      process.exit(1);
    }
    marketsToTest = [[singleMarket, MARKETS[singleMarket]]];
  }
  
  if (familyFilter) {
    marketsToTest = marketsToTest.filter(([_, config]) => config.family === familyFilter);
  }
  
  console.log(`Testing ${marketsToTest.length} markets...\n`);
  
  const results = [];
  
  for (const [marketName, config] of marketsToTest) {
    const result = await testMarket(marketName, config);
    results.push(result);
    
    // 批量模式下稍作延迟，避免触发 rate limit
    if (isBatch) {
      await sleep(1000);
    }
  }
  
  // 汇总报告
  console.log('\n📊 Summary\n');
  
  const byStatus = {};
  for (const r of results) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }
  
  // 按 family 分组
  console.log('\n📁 By Family\n');
  const byFamily = {};
  for (const r of results) {
    if (!byFamily[r.family]) byFamily[r.family] = [];
    byFamily[r.family].push(r);
  }
  
  for (const [family, familyResults] of Object.entries(byFamily)) {
    const ok = familyResults.filter(r => 
      r.status === 'DEEP_LINK_OK' || r.status === 'READ_PROXY_TAB_OK'
    ).length;
    console.log(`  ${family}: ${ok}/${familyResults.length} OK`);
  }
  
  // 输出详细结果
  console.log('\n🔎 Detailed Results\n');
  for (const r of results) {
    const icon = r.status === 'DEEP_LINK_OK' ? '✅' : 
                 r.status === 'READ_PROXY_TAB_OK' ? '✅' :
                 r.status === 'CLOUDFLARE_BLOCKED' ? '⛔' : '⚠️';
    console.log(`${icon} ${r.market} (${r.family}): ${r.status}`);
  }
  
  // 保存到文件
  if (outputFile) {
    const fs = await import('fs');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${outputFile}`);
  }
  
  // 退出码
  const failed = results.filter(r => 
    r.status !== 'DEEP_LINK_OK' && 
    r.status !== 'READ_PROXY_TAB_OK' &&
    r.status !== 'CONTRACT_PAGE_OK'
  ).length;
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
