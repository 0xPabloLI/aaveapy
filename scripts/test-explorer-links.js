#!/usr/bin/env node
/**
 * Test all Pool Explorer links to verify they can deep-link to getReserveData
 * Usage: node scripts/test-explorer-links.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the poolExplorerLinks.ts file and extract all markets
function extractMarkets(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const markets = [];
  
  // Match market entries
  const regex = /(\w+):\s*\{[\s\S]*?pool:\s*'([^']+)'[\s\S]*?explorerBase:\s*'([^']+)'[\s\S]*?family:\s*'(\w+)'/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const [_, name, pool, explorerBase, family] = match;
    
    // Check for custom pathFormat
    const entryMatch = content.match(new RegExp(`${name}:\\s*\\{[\\s\\S]*?\\}`));
    const hasPathFormat = entryMatch && entryMatch[0].includes('pathFormat');
    const pathFormatMatch = entryMatch && entryMatch[0].match(/pathFormat:\s*'([^']+)'/);
    const pathFormat = pathFormatMatch ? pathFormatMatch[1] : null;
    
    markets.push({
      name,
      pool,
      explorerBase,
      family,
      pathFormat
    });
  }
  
  return markets;
}

function buildUrl(market) {
  if (market.pathFormat) {
    return `${market.explorerBase}${market.pathFormat.replace('{pool}', market.pool)}`;
  }
  
  if (market.family === 'etherscan') {
    return `${market.explorerBase}/address/${market.pool}#readProxyContract#F23`;
  }
  
  if (market.family === 'blockscout') {
    return `${market.explorerBase}/address/${market.pool}?tab=read_proxy#0xc952485d`;
  }
  
  return `${market.explorerBase}/address/${market.pool}`;
}

async function testWithCDP(url, targetId) {
  return new Promise((resolve) => {
    const curl = spawn('curl', [
      '-s',
      `http://localhost:3456/eval?target=${targetId}`,
      '--data',
      `({
        title: document.title,
        url: window.location.href,
        hasAddress: document.body.innerText.includes('${url.match(/0x[a-fA-F0-9]{40}/)[0].slice(0, 10)}'),
        hasGetReserveData: document.body.innerText.includes('getReserveData'),
        hasReadProxy: document.body.innerText.toLowerCase().includes('read proxy'),
        bodyHead: document.body.innerText.slice(0, 300)
      })`
    ]);
    
    let output = '';
    curl.stdout.on('data', (data) => output += data);
    curl.on('close', () => {
      try {
        resolve(JSON.parse(output));
      } catch (e) {
        resolve({ error: output });
      }
    });
  });
}

async function openNewTab(url) {
  return new Promise((resolve) => {
    const encodedUrl = encodeURIComponent(url);
    const curl = spawn('curl', ['-s', `http://localhost:3456/new?url=${encodedUrl}`]);
    
    let output = '';
    curl.stdout.on('data', (data) => output += data);
    curl.on('close', () => {
      try {
        const result = JSON.parse(output);
        resolve(result.targetId);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'poolExplorerLinks.ts');
  const markets = extractMarkets(filePath);
  
  console.log(`Testing ${markets.length} markets...\n`);
  
  const results = {
    passed: [],
    cloudflare: [],
    needsFix: [],
    failed: []
  };
  
  for (const market of markets) {
    const url = buildUrl(market);
    console.log(`Testing ${market.name}...`);
    
    const targetId = await openNewTab(url);
    if (!targetId) {
      results.failed.push({ market: market.name, reason: 'Failed to open tab' });
      continue;
    }
    
    await sleep(4000);
    
    const result = await testWithCDP(url, targetId);
    
    // Check for Cloudflare
    const isCloudflare = result.bodyHead && (
      result.bodyHead.includes('Just a moment') ||
      result.bodyHead.includes('security verification') ||
      result.bodyHead.includes('Ray ID')
    );
    
    if (isCloudflare) {
      results.cloudflare.push({
        market: market.name,
        family: market.family,
        url
      });
      console.log(`  ⚠️  Cloudflare blocked`);
      continue;
    }
    
    // Check success criteria
    const hasDeepLink = result.hasGetReserveData || 
                       result.hasReadProxy || 
                       result.url?.includes('#readProxyContract') ||
                       result.url?.includes('?tab=read_proxy');
    
    if (hasDeepLink) {
      results.passed.push({
        market: market.name,
        family: market.family,
        url: result.url || url,
        hasGetReserveData: result.hasGetReserveData
      });
      console.log(`  ✅ Working${result.hasGetReserveData ? ' (getReserveData visible)' : ''}`);
    } else {
      results.needsFix.push({
        market: market.name,
        family: market.family,
        url: result.url || url,
        reason: 'No deep-link elements found'
      });
      console.log(`  🔍 Needs investigation`);
    }
  }
  
  // Print summary
  console.log('\n\n=== TEST SUMMARY ===\n');
  
  console.log(`✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(m => console.log(`  - ${m.market} (${m.family})`));
  
  console.log(`\n⚠️  CLOUDFLARE BLOCKED (${results.cloudflare.length}) - Need manual check:`);
  results.cloudflare.forEach(m => console.log(`  - ${m.market} (${m.family})`));
  
  console.log(`\n🔍 NEEDS FIX (${results.needsFix.length}):`);
  results.needsFix.forEach(m => console.log(`  - ${m.market}: ${m.reason}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(m => console.log(`  - ${m.market}: ${m.reason}`));
  }
  
  // Generate manual verification commands for Cloudflare-blocked sites
  if (results.cloudflare.length > 0) {
    console.log('\n\n=== MANUAL VERIFICATION COMMANDS ===');
    console.log('Run these in your terminal to verify Cloudflare-blocked sites:\n');
    results.cloudflare.forEach(m => {
      console.log(`open "${m.url}"`);
    });
  }
}

main().catch(console.error);
