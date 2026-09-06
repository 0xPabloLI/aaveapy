import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const SRC_DIR = resolve(__dirname, '..');
const ROOT_DIR = resolve(SRC_DIR, '..');

/**
 * Load the OpenAPI spec from public/openapi.json.
 * Replaces the old generateOpenApiDocument() call (AAV-1214).
 * The spec is now backend-generated via ts-json-schema-generator.
 */
function loadOpenApiSpec(): Record<string, unknown> {
  const raw = readFileSync(resolve(ROOT_DIR, 'public/openapi.json'), 'utf-8');
  return JSON.parse(raw);
}

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
    { module: 'incentiveAggregation', symbols: ['getReserveIncentiveValues', 'resolveVisibleIncentiveBadgeValue', 'IncentiveCalculationOptions'] },
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
    const doc = loadOpenApiSpec();
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

  it('every GET endpoint has 503 with Retry-After header and error body schema', () => {
    const doc = loadOpenApiSpec();
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
      // Accept either $ref or inline schema with properties (backend-generated spec uses inline)
      if (!schema || (!schema.$ref && !schema.properties)) violations.push(`${pathKey} 503 missing error body schema`);
    }

    expect(violations, `Endpoints missing 503/error body: ${violations.join(', ')}`).toEqual([]);
  });
});

describe('Architecture guard: no lib→hook import direction violations', () => {
  it('lib files must not import from hooks', () => {
    const libFiles = globTsFiles('lib');
    const violations: string[] = [];
    for (const file of libFiles) {
      const src = readFile(file);
      const hookImports = src.match(/from\s+['"][^'"]*\/hooks\/[^'"]*['"]/g);
      if (hookImports) {
        violations.push(`${file} imports from hooks: ${hookImports.join(', ')}`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('Architecture guard: WalletPositionSource and PositionSource must stay in sync', () => {
  it('both type unions contain the same set of non-manual values', () => {
    const mapperSrc = readFile('lib/userData/userPositionMapper.ts');
    const portfolioSrc = readFile('types/portfolio.ts');

    const mapperMatch = mapperSrc.match(/type WalletPositionSource\s*=\s*([^;\n]+)/);
    const portfolioMatch = portfolioSrc.match(/type PositionSource\s*=\s*([^;\n]+)/);

    expect(mapperMatch, 'WalletPositionSource type definition not found').toBeTruthy();
    expect(portfolioMatch, 'PositionSource type definition not found').toBeTruthy();

    const parseUnion = (raw: string): Set<string> => {
      const values = raw.match(/'[^']+'/g) ?? [];
      return new Set(values.map(v => v.slice(1, -1)));
    };

    const walletSources = parseUnion(mapperMatch![1]);
    const positionSources = parseUnion(portfolioMatch![1]);

    const walletOnly = [...walletSources].filter(v => !positionSources.has(v));
    const positionOnly = [...positionSources].filter(v => !walletSources.has(v) && v !== 'manual');

    expect(
      { walletOnly, positionOnly },
      'WalletPositionSource and PositionSource (excluding manual) must match. ' +
      `Only in WalletPositionSource: ${walletOnly}. Only in PositionSource: ${positionOnly}.`,
    ).toEqual({ walletOnly: [], positionOnly: [] });
  });
});

describe('Architecture guard: walletPositionToPortfolio must preserve source field', () => {
  it('converter output includes source: walletSourceToPositionSource(wp.source)', () => {
    const src = readFile('lib/walletPositionToPortfolio.ts');
    expect(
      src,
      'convertWalletPositionsToEntries must derive source from walletSourceToPositionSource',
    ).toMatch(/walletSourceToPositionSource\(wp\.source\)/);
  });

  it('walletSourceToPositionSource function exists and is not a no-op placeholder', () => {
    const src = readFile('lib/walletPositionToPortfolio.ts');
    expect(src).toMatch(/function walletSourceToPositionSource/);
    expect(src).not.toMatch(/walletSourceToPositionSource.*\/\/\s*TODO/);
  });
});

describe('Architecture guard: PortfolioReserveEntry is primary data model', () => {
  it('PortfolioPanel uses entries prop (not positions)', () => {
    const src = readFile('components/dashboard/PortfolioPanel.tsx');
    expect(src).toMatch(/entries:\s*PortfolioReserveEntry\[\]/);
    expect(src).not.toMatch(/positions:\s*PortfolioPosition\[\]/);
  });

  it('PortfolioUnifiedTable uses entries prop (not positions)', () => {
    const src = readFile('components/dashboard/PortfolioUnifiedTable.tsx');
    expect(src).toMatch(/entries:\s*PortfolioReserveEntry\[\]/);
    expect(src).not.toMatch(/positions:\s*PortfolioPosition\[\]/);
  });

  it('PortfolioSnapshot.entries is required (positions field removed)', () => {
    const src = readFile('types/portfolio.ts');
    expect(src).toMatch(/entries:\s*PortfolioReserveEntry\[\]/);
    expect(src).not.toMatch(/positions\?.*PortfolioPosition\[\]/);
  });

  it('PortfolioPosition type does not exist in non-test source', () => {
    const src = readFile('types/portfolio.ts');
    expect(src).not.toMatch(/export interface PortfolioPosition\b/);
  });

  it('portfolioMerger.ts does not exist', () => {
    const filePath = resolve(__dirname, '..', 'lib', 'portfolioMerger.ts');
    expect(() => readFileSync(filePath, 'utf8')).toThrow();
  });

  it('portfolioWalletSync.ts does not exist', () => {
    const filePath = resolve(__dirname, '..', 'lib', 'portfolioWalletSync.ts');
    expect(() => readFileSync(filePath, 'utf8')).toThrow();
  });

  it('convertWalletPositionsToPortfolio does not exist', () => {
    const src = readFile('lib/walletPositionToPortfolio.ts');
    expect(src).not.toMatch(/export function convertWalletPositionsToPortfolio/);
  });

  it('simulatePortfolioPositions does not exist', () => {
    const src = readFile('lib/portfolioSimulator.ts');
    expect(src).not.toMatch(/export function simulatePortfolioPositions/);
  });

  it('entriesToPositions does not exist in usePortfolioSimulation', () => {
    const src = readFile('hooks/usePortfolioSimulation.ts');
    expect(src).not.toMatch(/entriesToPositions/);
  });
});

describe('Architecture guard: docs/plans directory structure', () => {
  const DOCS_PLANS = resolve(__dirname, '../../docs/plans');

  it('no "Completed" (capital C) directory exists anywhere under docs/plans', () => {
    const forbiddenPatterns = ['Completed', 'completed'];
    const subdirs: string[] = [];
    try {
      const entries = readdirSync(DOCS_PLANS, { recursive: true });
      for (const entry of entries) {
        const full = resolve(DOCS_PLANS, entry.toString());
        if (statSync(full).isDirectory()) {
          subdirs.push(entry.toString());
        }
      }
    } catch {
      return;
    }
    const violations = subdirs.filter(d => {
      const base = d.split('/').pop()!;
      return forbiddenPatterns.includes(base) && d !== 'completed';
    });
    expect(violations, `Found forbidden completed directories: ${violations.join(', ')}. Only docs/plans/completed/ (lowercase) is allowed.`).toEqual([]);
  });

  it('no nested "linear-issues" or "phase-2" directory exists under docs/plans', () => {
    const forbiddenDirs = ['linear-issues', 'phase-2'];
    const subdirs: string[] = [];
    try {
      const entries = readdirSync(DOCS_PLANS, { recursive: true });
      for (const entry of entries) {
        const full = resolve(DOCS_PLANS, entry.toString());
        if (statSync(full).isDirectory()) {
          subdirs.push(entry.toString());
        }
      }
    } catch {
      return;
    }
    const violations = subdirs.filter(d => {
      const base = d.split('/').pop()!;
      return forbiddenDirs.includes(base);
    });
    expect(violations, `Found forbidden directory names: ${violations.join(', ')}. All plans go flat in docs/plans/completed/.`).toEqual([]);
  });

  it('no "handoff" directory exists under docs/', () => {
    const DOCS_DIR = resolve(__dirname, '../../docs');
    let entries: string[] = [];
    try {
      entries = readdirSync(DOCS_DIR);
    } catch {
      return;
    }
    expect(entries).not.toContain('handoff');
  });
});

describe('Architecture guard: test files must mock viem for value imports', () => {
  /**
   * Prevents flaky CI failures from tests that accidentally make real RPC
   * network calls via viem's createPublicClient / http transport.
   *
   * Rule: if a test file has a *value* import from 'viem' (not `import type`),
   * it must also call vi.mock('viem') or vi.doMock('viem').
   *
   * Type-only imports (`import type { PublicClient } from 'viem'`) are safe —
   * they are erased at compile time and create no runtime dependency.
   *
   * See: AAV-1235 (CI failure from unmocked viem in aaveV4UserClient.test.ts)
   */
  const SRC_ROOT = resolve(__dirname, '..');

  function globTestFiles(dir: string): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(resolve(SRC_ROOT, dir));
    } catch {
      return results;
    }
    for (const entry of entries) {
      const full = resolve(SRC_ROOT, dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...globTestFiles(`${dir}/${entry}`));
      } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
        results.push(`${dir}/${entry}`);
      }
    }
    return results;
  }

  const TEST_DIRS = ['lib', 'hooks', 'components', 'test', 'providers', 'types', 'config'];
  const ALL_TEST_FILES = TEST_DIRS.flatMap(globTestFiles);

  for (const file of ALL_TEST_FILES) {
    it(`${file} mocks viem if it value-imports it`, () => {
      const src = readFile(file);

      // Find all lines that import from 'viem'
      const viemImportLines = src.match(/^\s*import\s+.*\bfrom\s*['"]viem['"]/gm) ?? [];
      if (viemImportLines.length === 0) return;

      // Check if ANY import is a value import (not `import type`)
      const hasValueImport = viemImportLines.some(
        (line) => !/^\s*import\s+type\s/.test(line),
      );
      if (!hasValueImport) return; // All imports are type-only — safe

      // Value import present — must have a corresponding mock
      const hasMock = /vi\.(mock|doMock)\s*\(\s*['"]viem['"]/.test(src);
      expect(
        hasMock,
        `${file} has a value import from 'viem' but does not mock it.\n` +
        'This can cause flaky CI failures from real network calls.\n' +
        "Fix: add vi.mock('viem', () => ({ createPublicClient: vi.fn(), http: vi.fn() }))\n" +
        'Or: convert to "import type { ... } from \'viem\'" if only types are needed.',
      ).toBe(true);
    });
  }
});

/**
 * FCP optimization guards — ensure heavy SDK chunks are lazy-loaded and not
 * synchronously imported from the app entry point.
 *
 * AaveProviders wraps @aave/react + @aave/react-v3 (~218 KB gzip).  When
 * synchronously imported in App.tsx, Vite includes it in the initial chunk
 * and modulepreloads it, blocking FCP.  These tests guard against regression.
 */
describe('FCP optimization: lazy-loaded AaveProviders', () => {
  it('App.tsx uses lazy() for AaveProviders, not a static import', () => {
    const appSrc = readFile('App.tsx');

    // Must NOT contain a static import of AaveProviders
    const hasStaticImport = /import\s+\{[^}]*AaveProviders[^}]*\}\s+from\s+['"]@\/providers\/AaveProviders['"]/.test(appSrc);
    expect(
      hasStaticImport,
      'App.tsx must not statically import AaveProviders — use lazy(() => import(...)) instead.\n' +
      'A static import pulls @aave/react + @aave-dao (~218 KB gzip) into the initial chunk, blocking FCP.',
    ).toBe(false);

    // Must contain a lazy import
    const hasLazyImport = /lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]@\/providers\/AaveProviders['"]/.test(appSrc);
    expect(
      hasLazyImport,
      'App.tsx must use lazy(() => import("@/providers/AaveProviders")) for AaveProviders.',
    ).toBe(true);
  });

  it('App.tsx does not statically import wagmi, rainbowkit, or wagmi config', () => {
    const appSrc = readFile('App.tsx');

    // viem/wagmi/ox live in vendor-blockchain (~420 KB gzip); rainbowkit adds
    // ConnectButton + styles on top. Any static import in App.tsx puts them on
    // the entry chunk's synchronous import graph, blocking FCP.
    const forbidden = [
      { pattern: /import\s+[^;]*\bfrom\s+['"]wagmi['"]/, label: 'wagmi' },
      { pattern: /import\s+[^;]*\bfrom\s+['"]@rainbow-me\/rainbowkit['"]/, label: '@rainbow-me/rainbowkit' },
      { pattern: /import\s+['"]@rainbow-me\/rainbowkit\/styles\.css['"]/, label: '@rainbow-me/rainbowkit/styles.css' },
      // Named and side-effect forms: `import { wagmiConfig } from ...` and `import "@/lib/wagmi/config"`
      { pattern: /import\s+[^;]*\bfrom\s+['"]@\/lib\/wagmi\/config['"]|import\s*['"]@\/lib\/wagmi\/config['"]/, label: '@/lib/wagmi/config' },
    ];

    for (const { pattern, label } of forbidden) {
      expect(
        pattern.test(appSrc),
        `App.tsx must not statically import ${label} — move it behind the lazy WalletProviders wrapper.\n` +
        'A static import pulls vendor-blockchain (~420 KB gzip) into the entry chunk, blocking FCP.',
      ).toBe(false);
    }
  });

  it('App.tsx uses lazy() for WalletProviders', () => {
    const appSrc = readFile('App.tsx');

    const hasStaticImport = /import\s+\{[^}]*WalletProviders[^}]*\}\s+from\s+['"]@\/providers\/WalletProviders['"]/.test(appSrc);
    expect(
      hasStaticImport,
      'App.tsx must not statically import WalletProviders — use lazy(() => import(...)) instead.',
    ).toBe(false);

    const hasLazyImport = /lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]@\/providers\/WalletProviders['"]/.test(appSrc);
    expect(
      hasLazyImport,
      'App.tsx must use lazy(() => import("@/providers/WalletProviders")) for WalletProviders.',
    ).toBe(true);
  });

  it('App.tsx does not statically import @aave/react or @aave/react-v3', () => {
    const appSrc = readFile('App.tsx');

    const hasAaveReactImport = /import\s+.*\bfrom\s+['"]@aave\/react['"]/.test(appSrc);
    expect(
      hasAaveReactImport,
      'App.tsx must not import @aave/react directly — it should be behind the lazy AaveProviders wrapper.',
    ).toBe(false);

    const hasAaveReactV3Import = /import\s+.*\bfrom\s+['"]@aave\/react-v3['"]/.test(appSrc);
    expect(
      hasAaveReactV3Import,
      'App.tsx must not import @aave/react-v3 directly — it should be behind the lazy AaveProviders wrapper.',
    ).toBe(false);
  });
});

/**
 * FCP optimization: vite.config.ts must use selective modulePreload (not Vite's
 * automatic injection) so that non-first-paint chunks (vendor-blockchain,
 * vendor-aave, secp256k1) are not modulepreloaded.
 */
describe('FCP optimization: selective modulePreload in vite.config.ts', () => {
  it('build.modulePreload is set to false', () => {
    const viteConfig = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf-8');

    // Must contain modulePreload: false
    expect(
      /modulePreload\s*:\s*false/.test(viteConfig),
      'vite.config.ts must set build.modulePreload to false to disable automatic modulepreload injection.',
    ).toBe(true);
  });

  it('selectiveModulePreloadPlugin is registered', () => {
    const viteConfig = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf-8');

    expect(
      /selectiveModulePreloadPlugin/.test(viteConfig),
      'vite.config.ts must register selectiveModulePreloadPlugin to inject only first-paint chunk preloads.',
    ).toBe(true);
  });

  it('vendor-blockchain is a dedicated chunk (separate from first-paint chunks)', () => {
    const viteConfig = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf-8');

    expect(
      /vendor-blockchain/.test(viteConfig),
      'vite.config.ts must have an advancedChunks group that puts viem/wagmi/rainbowkit into vendor-blockchain.',
    ).toBe(true);
  });

  it('MODULEPRELOAD_WHITELIST includes wallet chunks (download-early, execute-late)', () => {
    const viteConfig = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf-8');

    // Extract the whitelist array content
    const whitelistMatch = viteConfig.match(/MODULEPRELOAD_WHITELIST\s*=\s*\[([\s\S]*?)\]/);
    expect(whitelistMatch, 'MODULEPRELOAD_WHITELIST array not found in vite.config.ts').toBeTruthy();

    const whitelistContent = whitelistMatch![1];
    // The wallet/SDK chunks are dynamic-imported on every page load, so
    // preloading them starts the download at t0 without executing them —
    // FCP is unaffected, content arrives sooner.
    for (const prefix of ['vendor-blockchain', 'vendor-aave', 'WalletProviders', 'AaveProviders']) {
      expect(
        whitelistContent.includes(prefix),
        `${prefix} must be in MODULEPRELOAD_WHITELIST — it is dynamically imported on every page load, so preloading it (download-only, no execute) is strictly better.`,
      ).toBe(true);
    }
  });

  it('assertFirstPaintChunksPlugin is registered', () => {
    const viteConfig = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf-8');

    expect(
      /assertFirstPaintChunksPlugin/.test(viteConfig),
      'vite.config.ts must register assertFirstPaintChunksPlugin — it fails the build when the entry chunk can statically reach vendor-blockchain/vendor-aave.',
    ).toBe(true);
  });
});

