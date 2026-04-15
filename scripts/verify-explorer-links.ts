/**
 * Explorer Links Verification Script
 * 
 * This script verifies the generated explorer URLs and produces a manual-check
 * report. Real browser DOM/screenshot verification lives in
 * `e2e/explorer-links-live-dom.spec.ts`.
 * 
 * Usage: 
 *   npx tsx scripts/verify-explorer-links.ts
 * 
 * Output:
 *   - logs/verification-results.json - Detailed results for each market
 *   - logs/verification-summary.md - Human-readable summary
 */

import { writeFile, mkdir } from 'fs/promises';
import { buildPoolExplorerUrl, getExplorerFamily } from '../src/lib/poolExplorerLinks';

const MARKETS = [
  'AaveV3Ethereum', 'AaveV3EthereumLido', 'AaveV3EthereumEtherFi', 'AaveV3EthereumHorizon',
  'AaveV3Arbitrum', 'AaveV3Optimism', 'AaveV3Polygon', 'AaveV3Base', 'AaveV3Gnosis', 'AaveV3BNB',
  'AaveV3Linea', 'AaveV3Sonic', 'AaveV3Celo', 'AaveV3MegaEth', 'AaveV3Plasma', 'AaveV3Mantle',
  'AaveV3Avalanche', 'AaveV3Metis',
  'AaveV3Scroll', 'AaveV3ZkSync', 'AaveV3Soneium', 'AaveV3Ink', 'AaveV3InkWhitelabel',
  'AaveV3XLayer',
];

interface VerificationResult {
  market: string;
  url: string;
  family: string;
  status: 'passed' | 'failed' | 'skipped' | 'manual-check-needed';
  checks: {
    pageLoaded: boolean;
    contractVisible: boolean;
    readProxyTabAccessible: boolean;
    getReserveDataVisible: boolean;
    deepLinkWorked: boolean;
  };
  errors: string[];
  notes: string;
}

const RESULTS_DIR = './logs';

async function verifyLink(market: string): Promise<VerificationResult> {
  const url = buildPoolExplorerUrl(market);
  const family = getExplorerFamily(market);
  
  if (!url) {
    return {
      market,
      url: '',
      family: family || 'unknown',
      status: 'skipped',
      checks: {
        pageLoaded: false,
        contractVisible: false,
        readProxyTabAccessible: false,
        getReserveDataVisible: false,
        deepLinkWorked: false,
      },
      errors: ['No URL configured'],
      notes: '',
    };
  }

  // Note: Full verification requires browser automation (CDP/Playwright)
  // This script provides the structure for automated verification
  
  return {
    market,
    url,
    family: family || 'unknown',
    status: 'manual-check-needed',
    checks: {
      pageLoaded: false, // Requires browser check
      contractVisible: false, // Requires browser check
      readProxyTabAccessible: false, // Requires browser check
      getReserveDataVisible: false, // Requires browser check
      deepLinkWorked: false, // Requires browser check
    },
    errors: [],
    notes: 'Run browser-based verification for complete check',
  };
}

async function main() {
  const markets = MARKETS;
  const results: VerificationResult[] = [];
  
  console.log(`Verifying ${markets.length} explorer links...\n`);
  
  for (const market of markets) {
    process.stdout.write(`Checking ${market}... `);
    const result = await verifyLink(market);
    results.push(result);
    console.log(result.status);
  }
  
  // Generate summary
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    manualCheckNeeded: results.filter(r => r.status === 'manual-check-needed').length,
    byFamily: {} as Record<string, number>,
  };
  
  results.forEach(r => {
    summary.byFamily[r.family] = (summary.byFamily[r.family] || 0) + 1;
  });
  
  // Output results
  console.log('\n=== Verification Summary ===');
  console.log(`Total markets: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Manual check needed: ${summary.manualCheckNeeded}`);
  console.log('\nBy Explorer Family:');
  Object.entries(summary.byFamily).forEach(([family, count]) => {
    console.log(`  ${family}: ${count}`);
  });
  
  // Save detailed results
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(
    `${RESULTS_DIR}/verification-results.json`,
    JSON.stringify(results, null, 2)
  );
  
  // Generate markdown report
  const markdown = generateMarkdownReport(results, summary);
  await writeFile(`${RESULTS_DIR}/verification-summary.md`, markdown);
  
  console.log(`\nResults saved to ${RESULTS_DIR}/`);
}

function generateMarkdownReport(
  results: VerificationResult[],
  summary: { total: number; passed: number; failed: number; skipped: number; manualCheckNeeded: number; byFamily: Record<string, number> }
): string {
  return `# Explorer Links Verification Report

Generated: ${new Date().toISOString()}

## Summary

| Metric | Count |
|--------|-------|
| Total Markets | ${summary.total} |
| Passed | ${summary.passed} |
| Failed | ${summary.failed} |
| Skipped | ${summary.skipped} |
| Manual Check Needed | ${summary.manualCheckNeeded} |

## By Explorer Family

${Object.entries(summary.byFamily)
  .map(([family, count]) => `| ${family} | ${count} |`)
  .join('\n')}

## Detailed Results

| Market | Family | Status | URL | Notes |
|--------|--------|--------|-----|-------|
${results
  .map(
    r =>
      `| ${r.market} | ${r.family} | ${r.status} | [Link](${r.url}) | ${r.notes} |`
  )
  .join('\n')}

## Verification Checklist

For each explorer family, verify the following:

### Etherscan Family
- [ ] Page loads without Cloudflare blocking
- [ ] Contract address is visible on page
- [ ] "Read as Proxy" tab is accessible
- [ ] URL contains \`#readProxyContract#F23\` anchor
- [ ] getReserveData function is listed in Read Proxy tab

### Routescan Family  
- [ ] Page loads without Cloudflare blocking
- [ ] Contract address is visible on page
- [ ] "Read Contract" tab is accessible
- [ ] URL path format is correct (may include chain ID)

### Blockscout Family
- [ ] Page loads without Cloudflare blocking
- [ ] Contract address is visible on page
- [ ] "Read/Write Proxy" tab is accessible
- [ ] URL contains \`?tab=read_proxy#0xc952485d\` format
- [ ] getReserveData function is visible when tab opens

### OKLink Family
- [ ] Page loads without Cloudflare blocking
- [ ] Contract address is visible on page
- [ ] "Contract" section is accessible
- [ ] URL contains proxy-read parameter

## Known Issues

${results
  .filter(r => r.errors.length > 0)
  .map(r => `- **${r.market}**: ${r.errors.join(', ')}`)
  .join('\n') || 'None documented'}
`;
}

main().catch(console.error);
