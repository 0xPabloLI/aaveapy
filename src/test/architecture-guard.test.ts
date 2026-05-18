import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

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
