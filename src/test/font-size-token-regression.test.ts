// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Font-size token regression guard.
 *
 * After Phase 1 migration, NO component source file should contain
 * hardcoded text-[9px], text-[10px], text-[11px], text-[12px], or text-[13px].
 * All font sizes must use ds-text-N design tokens.
 *
 * Special attention for InkAprCalculator:
 * - $/B prefix/suffix spans must use ds-text-11 !leading-none
 * - FDV Input elements must use ![font-size:var(--ds-text-11)] (arbitrary property)
 * - The dangerous !ds-text-11 pattern (which introduces line-height !important) must NOT appear
 */

const SRC_DIR = resolve(__dirname, '..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

// ─── Phase 1 migrated files ──────────────────────────────────────

const PHASE_1_FILES = [
  'components/ui/segmented-toggle.tsx',
  'components/dashboard/FaqSection.tsx',
  'components/dashboard/PopularTokenChip.tsx',
  'components/dashboard/FilterBar.tsx',
  'lib/marketLabels.ts',
  'components/dashboard/InkAprCalculator.tsx',
];

describe('Phase 1: no hardcoded font-size values in component source', () => {
  for (const file of PHASE_1_FILES) {
    const src = readFile(file);

    it(`${file}: no text-[9px]`, () => {
      expect(src).not.toMatch(/text-\[9px\]/);
    });

    it(`${file}: no text-[10px]`, () => {
      expect(src).not.toMatch(/text-\[10px\]/);
    });

    it(`${file}: no text-[11px]`, () => {
      expect(src).not.toMatch(/text-\[11px\]/);
    });

    it(`${file}: no text-[12px]`, () => {
      expect(src).not.toMatch(/text-\[12px\]/);
    });

    it(`${file}: no text-[13px]`, () => {
      expect(src).not.toMatch(/text-\[13px\]/);
    });
  }
});

// ─── InkAprCalculator-specific guards ────────────────────────────

describe('InkAprCalculator: correct !font-size arbitrary property pattern', () => {
  const src = readFile('components/dashboard/InkAprCalculator.tsx');

  it('uses ![font-size:var(--ds-text-11)] on FDV Input elements (not !text-[11px])', () => {
    // The arbitrary property syntax is the only safe way to override <Input> font-size
    expect(src).toMatch(/\[font-size:var\(--ds-text-11\)\]/);
  });

  it('does NOT use !ds-text-11 on Input (would introduce line-height !important conflict)', () => {
    // !ds-text-11 generates line-height: calc(11px * 1.25) !important
    // which conflicts with leading-4 / leading-7 on Input elements
    expect(src).not.toMatch(/!ds-text-11/);
  });
});

// ─── Anti-pattern: !ds-text-N must not appear (line-height conflict) ──

describe('No !ds-text-N anti-pattern anywhere', () => {
  for (const file of PHASE_1_FILES) {
    it(`${file}: no !ds-text-9 (line-height !important conflict)`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/!ds-text-9/);
    });

    it(`${file}: no !ds-text-11 (line-height !important conflict)`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/!ds-text-11/);
    });
  }
});

// ─── .ds-chip: line-height must NOT use !important ──────────────────

describe('.ds-chip: no line-height !important regression', () => {
  const cssSrc = readFile('index.css');

  it('.ds-chip must not use line-height: 1 !important (use line-height: 1 instead)', () => {
    // !important forces line-height on all descendants, breaking ds-text-N token line-height
    expect(cssSrc).not.toMatch(/\.ds-chip\s*\{[^}]*line-height:\s*1\s*!important/);
  });
});

// ─── filter-chip.tsx: must include ds-text-11 for correct line-height ──

describe('filter-chip: ds-text-11 present for line-height', () => {
  const src = readFile('components/ui/filter-chip.tsx');

  it('filter-chip must include ds-text-11 (provides line-height via token)', () => {
    expect(src).toMatch(/ds-text-11/);
  });
});

// ─── index.css: allowed to contain text-[Npx] in design token definitions ──

describe('index.css: design token definitions are exempt', () => {
  const cssSrc = readFile('index.css');

  it('may contain text-[Npx] in .ds-text-* utility class definitions', () => {
    // These are the token definitions themselves, not component usage
    expect(cssSrc).toMatch(/\.ds-text-9\s*\{/);
    expect(cssSrc).toMatch(/\.ds-text-10\s*\{/);
    expect(cssSrc).toMatch(/\.ds-text-11\s*\{/);
    expect(cssSrc).toMatch(/\.ds-text-12\s*\{/);
    expect(cssSrc).toMatch(/\.ds-text-13\s*\{/);
  });
});