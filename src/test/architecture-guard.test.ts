import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { generateOpenApiDocument } from '../../scripts/generate-openapi.ts';

const SRC_DIR = resolve(__dirname, '..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

function globTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(resolve(SRC_DIR, dir))) {
    const full = resolve(SRC_DIR, dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...globTsFiles(`${dir}/${entry}`));
    } else if (extname(entry) === '.tsx' || extname(entry) === '.ts') {
      results.push(`${dir}/${entry}`);
    }
  }
  return results;
}

const COMPONENT_FILES = globTsFiles('components');

const KNOWN_DISABLE_TOOLTIP = new Set([
  'components/dashboard/CapProgressRing.tsx',
  'components/dashboard/BorrowCapProgressRing.tsx',
  'components/dashboard/DeficitLiquidityRing.tsx',
]);

describe('Architecture guard: no disableTooltip prop', () => {
  for (const file of COMPONENT_FILES) {
    if (KNOWN_DISABLE_TOOLTIP.has(file)) continue;
    it(`${file}`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/disableTooltip\??\s*:\s*boolean/);
    });
  }
  it.todo('CapProgressRing: remove disableTooltip (extract tooltip to caller)');
  it.todo('BorrowCapProgressRing: remove disableTooltip (extract tooltip to caller)');
  it.todo('DeficitLiquidityRing: remove disableTooltip (extract tooltip to caller)');
});

describe('Architecture guard: no repeated className strings (≥3 occurrences)', () => {
  it('no decorative container className appears 3+ times across component sources', () => {
    const counts = new Map<string, string[]>();
    const containerRegex = /className="([^"]*border[^"]*bg-[^"]{5,})"/g;
    for (const file of COMPONENT_FILES) {
      const src = readFile(file);
      let match: RegExpExecArray | null;
      while ((match = containerRegex.exec(src)) !== null) {
        const val = match[1];
        const existing = counts.get(val) ?? [];
        existing.push(file);
        counts.set(val, existing);
      }
    }
    const violations = [...counts.entries()].filter(([, files]) => files.length >= 3);
    expect(violations).toEqual([]);
  });
});

describe('Architecture guard: ring/indicator components must not import Tooltip', () => {
  const ringFiles = [
    'components/dashboard/UtilizationIndicator.tsx',
  ];
  for (const file of ringFiles) {
    it(`${file}`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/from.*['"]@\/components\/ui\/tooltip['"]/);
    });
  }
  it.todo('CapProgressRing: extract tooltip to caller');
  it.todo('BorrowCapProgressRing: extract tooltip to caller');
  it.todo('DeficitLiquidityRing: extract tooltip to caller');
});

describe('Architecture guard: formatters must not re-import extracted module symbols', () => {
  const EXTRACTED_MODULES = [
    { module: 'rateCalculations', symbols: ['calculateTotalSupplyApy', 'calculateTotalBorrowApy', 'calculateSpreadApy', 'calculateTotalSupplyApr', 'calculateTotalBorrowApr', 'calculateSpreadApr', 'annualPercentToDailyFraction'] },
    { module: 'rateSimulationCalculator', symbols: ['simulateRate'] },
    { module: 'merklWhitelist', symbols: ['MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL', 'MERKL_WHITELIST_CHAIN_IDS', 'isMerklWhitelisted'] },
    { module: 'incentiveAggregation', symbols: ['getReserveIncentiveValues', 'resolveVisibleIncentiveBadgeValue', 'formatForecastUnavailableLabel', 'IncentiveCalculationOptions'] },
    { module: 'marketLabels', symbols: ['getReserveMarketDisplayName', 'getHubChipLabel', 'getHubChipClass'] },
  ];

  it('formatters.ts does not import or re-export any symbol from extracted modules', () => {
    const src = readFile('lib/formatters.ts');
    for (const { module, symbols } of EXTRACTED_MODULES) {
      for (const symbol of symbols) {
        expect(
          src,
          `formatters.ts must not reference ${symbol} from ${module}`,
        ).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      }
    }
  });

  for (const { module, symbols } of EXTRACTED_MODULES) {
    it(`no consumer imports ${module} symbols via formatters (star import)`, () => {
      const libFiles = globTsFiles('lib').filter(f => !f.includes('formatters'));
      const componentFiles = globTsFiles('components');
      const hookFiles = globTsFiles('hooks');
      const allFiles = [...libFiles, ...componentFiles, ...hookFiles];
      const violations: string[] = [];
      for (const file of allFiles) {
        const src = readFile(file);
        if (!src.includes("'@/lib/formatters'") && !src.includes("'./formatters'")) continue;
        const hasStarImport = /import\s+\*\s+as\s+\w+\s+from.*formatters/.test(src);
        if (hasStarImport) {
          for (const symbol of symbols) {
            if (new RegExp(`\\b${symbol}\\b`).test(src)) {
              violations.push(`${file} uses ${symbol} via star import from formatters (should import from ${module})`);
            }
          }
        }
      }
      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});

describe('Architecture guard: all GET endpoints must define 429 and 503 responses', () => {
  it('every GET endpoint has 429 with Retry-After header', () => {
    const doc = generateOpenApiDocument();
    const paths = doc.paths as Record<string, unknown>;
    const violations: string[] = [];

    for (const [pathKey, pathObj] of Object.entries(paths ?? {})) {
      const get = (pathObj as Record<string, unknown>)?.get as Record<string, unknown>;
      if (!get) continue;
      const responses = get.responses as Record<string, unknown>;
      const r429 = responses?.['429'] as Record<string, unknown>;
      if (!r429) {
        violations.push(`${pathKey} missing 429`);
        continue;
      }
      const retryAfter = (r429.headers as Record<string, unknown>)?.['Retry-After'];
      if (!retryAfter) violations.push(`${pathKey} 429 missing Retry-After header`);
    }

    expect(violations, `Endpoints missing 429/Retry-After: ${violations.join(', ')}`).toEqual([]);
  });

  it('every GET endpoint has 503 with Retry-After header and error body $ref', () => {
    const doc = generateOpenApiDocument();
    const paths = doc.paths as Record<string, unknown>;
    const violations: string[] = [];

    for (const [pathKey, pathObj] of Object.entries(paths ?? {})) {
      const get = (pathObj as Record<string, unknown>)?.get as Record<string, unknown>;
      if (!get) continue;
      const responses = get.responses as Record<string, unknown>;
      const r503 = responses?.['503'] as Record<string, unknown>;
      if (!r503) {
        violations.push(`${pathKey} missing 503`);
        continue;
      }
      const retryAfter = (r503.headers as Record<string, unknown>)?.['Retry-After'];
      if (!retryAfter) violations.push(`${pathKey} 503 missing Retry-After header`);
      const schema = (r503?.content?.['application/json'] as Record<string, unknown>)?.schema as Record<string, unknown>;
      if (!schema?.$ref) violations.push(`${pathKey} 503 missing error body $ref`);
    }

    expect(violations, `Endpoints missing 503/error body: ${violations.join(', ')}`).toEqual([]);
  });
});
