/**
 * Comprehensive Explorer Links Test - Run this in browser console on test page
 * 
 * This script tests all explorer deep-links to verify:
 * 1. URLs are correctly formatted
 * 2. Anchors work for etherscan family (#readProxyContract#F23)
 * 3. Query params work for blockscout (?tab=read_proxy#0xc952485d)
 * 4. Custom formats work for routescan and oklink variants
 * 
 * Usage: Open browser console on any page and paste this script
 * Or run via Playwright: npx playwright test scripts/test-explorer-links.ts
 */

import { buildPoolExplorerUrl, getPoolAddress } from '../src/lib/poolExplorerLinks';

// All markets from poolExplorerLinks.ts
const TEST_CASES = [
  // Etherscan family (17 markets)
  { market: 'AaveV3Ethereum', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3EthereumLido', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3EthereumEtherFi', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3EthereumHorizon', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Arbitrum', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Optimism', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Polygon', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Base', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Gnosis', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3BNB', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Linea', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Sonic', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Celo', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3MegaEth', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Plasma', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  { market: 'AaveV3Mantle', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  
  { market: 'AaveV3Avalanche', family: 'etherscan', expectedAnchor: '#readProxyContract#F23' },
  
  // Routescan family (1 market - custom path format)
  { market: 'AaveV3Metis', family: 'routescan', expectedPattern: '/contract/1088#readProxyContract#F23' },
  
  // Blockscout family (5 markets - selector-based)
  { market: 'AaveV3Scroll', family: 'blockscout', expectedSelector: '#0xc952485d', expectedTab: 'read_proxy' },
  { market: 'AaveV3ZkSync', family: 'blockscout', expectedSelector: '#0xc952485d', expectedTab: 'read_proxy' },
  { market: 'AaveV3Soneium', family: 'blockscout', expectedSelector: '#0xc952485d', expectedTab: 'read_proxy' },
  { market: 'AaveV3Ink', family: 'blockscout', expectedSelector: '#0xc952485d', expectedTab: 'read_proxy' },
  { market: 'AaveV3InkWhitelabel', family: 'blockscout', expectedSelector: '#0xc952485d', expectedTab: 'read_proxy' },
  
  // OKLink family (1 market - custom query params)
  { market: 'AaveV3XLayer', family: 'oklink', expectedPattern: '/contract#category=proxy-read&id=22' },
];

interface TestResult {
  market: string;
  family: string;
  url: string | null;
  poolAddress: string | null;
  checks: {
    urlGenerated: boolean;
    hasAddress: boolean;
    familyMatch: boolean;
    anchorOk?: boolean;
    selectorOk?: boolean;
    tabOk?: boolean;
    customPatternOk?: boolean;
  };
  issues: string[];
}

export function runLinkTests(): TestResult[] {
  const results: TestResult[] = [];
  
  for (const testCase of TEST_CASES) {
    const url = buildPoolExplorerUrl(testCase.market);
    const poolAddress = getPoolAddress(testCase.market);
    const issues: string[] = [];
    
    const checks: TestResult['checks'] = {
      urlGenerated: !!url,
      hasAddress: !!poolAddress && /^0x[a-fA-F0-9]{40}$/.test(poolAddress),
      familyMatch: false, // Will be verified via URL pattern
    };
    
    if (!url) {
      issues.push('URL not generated - market not in POOL_EXPLORER_MAP');
    } else if (!poolAddress) {
      issues.push('Pool address not found');
    } else {
      // Verify family-specific URL patterns
      if (testCase.family === 'etherscan') {
        checks.familyMatch = url.includes('/address/') && url.includes('#readProxyContract');
        checks.anchorOk = url.includes(testCase.expectedAnchor!);
        if (!checks.anchorOk) issues.push(`Missing anchor ${testCase.expectedAnchor}`);
      }
      
      else if (testCase.family === 'routescan') {
        checks.familyMatch = url.includes('/address/');
        if (testCase.expectedPattern) {
          checks.customPatternOk = url.includes(testCase.expectedPattern);
          if (!checks.customPatternOk) issues.push(`Missing pattern ${testCase.expectedPattern}`);
        } else if (testCase.expectedAnchor) {
          checks.anchorOk = url.includes(testCase.expectedAnchor);
          if (!checks.anchorOk) issues.push(`Missing anchor ${testCase.expectedAnchor}`);
        }
      }
      
      else if (testCase.family === 'blockscout') {
        checks.familyMatch = url.includes('/address/') && url.includes('?tab=read_proxy');
        checks.selectorOk = url.includes(testCase.expectedSelector!);
        checks.tabOk = url.includes(`tab=${testCase.expectedTab}`);
        if (!checks.selectorOk) issues.push(`Missing selector ${testCase.expectedSelector}`);
        if (!checks.tabOk) issues.push(`Missing tab ${testCase.expectedTab}`);
      }
      
      else if (testCase.family === 'oklink') {
        checks.familyMatch = url.includes('/address/');
        if (testCase.expectedPattern) {
          checks.customPatternOk = url.includes(testCase.expectedPattern);
          if (!checks.customPatternOk) issues.push(`Missing pattern ${testCase.expectedPattern}`);
        }
      }
      
      if (!checks.familyMatch) issues.push('URL pattern does not match family type');
    }
    
    results.push({
      market: testCase.market,
      family: testCase.family,
      url,
      poolAddress,
      checks,
      issues,
    });
  }
  
  return results;
}

export function printTestReport(results: TestResult[]): void {
  const passed = results.filter(r => r.issues.length === 0);
  const failed = results.filter(r => r.issues.length > 0);
  
  console.log('\n=== Explorer Links Test Report ===\n');
  
  // Print all generated URLs
  console.log('=== Generated URLs ===\n');
  for (const r of results) {
    const status = r.issues.length === 0 ? '✅' : '❌';
    console.log(`${status} ${r.market} (${r.family})`);
    console.log(`   Pool: ${r.poolAddress || 'N/A'}`);
    console.log(`   URL:  ${r.url || 'N/A'}`);
    if (r.issues.length > 0) {
      console.log(`   Issues: ${r.issues.join(', ')}`);
    }
    console.log('');
  }
  
  // Summary by family
  console.log('\n=== Summary by Explorer Family ===\n');
  const byFamily = results.reduce((acc, r) => {
    acc[r.family] = acc[r.family] || { total: 0, passed: 0 };
    acc[r.family].total++;
    if (r.issues.length === 0) acc[r.family].passed++;
    return acc;
  }, {} as Record<string, { total: number; passed: number }>);
  
  for (const [family, stats] of Object.entries(byFamily)) {
    const icon = stats.passed === stats.total ? '✅' : '⚠️';
    console.log(`${icon} ${family}: ${stats.passed}/${stats.total} passed`);
  }
  
  console.log('\n=== Overall Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed.length} ✅`);
  console.log(`Failed: ${failed.length} ❌`);
  
  if (failed.length > 0) {
    console.log('\n=== Failed Tests ===');
    for (const r of failed) {
      console.log(`\n❌ ${r.market} (${r.family})`);
      console.log(`   URL: ${r.url || 'N/A'}`);
      console.log(`   Issues:`);
      for (const issue of r.issues) {
        console.log(`     - ${issue}`);
      }
    }
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  const results = runLinkTests();
  printTestReport(results);
  (window as unknown as Record<string, unknown>).__explorerLinkTestResults = results;
}

export { TEST_CASES };
export default runLinkTests;
