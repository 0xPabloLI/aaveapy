// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Control height token regression guard.
 *
 * After Phase 2 migration, NO component source file should contain
 * hardcoded h-8, h-9, or h-11. All control heights must use
 * h-[var(--ds-control-h)], h-[var(--ds-button-sm-h)], or
 * h-[var(--ds-button-lg-h)].
 *
 * h-7 is partially migrated: chip semantics use h-[var(--ds-chip-h)],
 * skeleton/icon use cases keep h-7.
 */

const SRC_DIR = resolve(__dirname, '..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

// ─── Phase 2 migrated component files ───────────────────────────

const PHASE_2_COMPONENT_FILES = [
  'components/dashboard/PortfolioPanel.tsx',
  'components/dashboard/ScenarioControls.tsx',
  'components/dashboard/InkAprCalculator.tsx',
  'components/dashboard/LoadingState.tsx',
  'components/dashboard/Header.tsx',
  'components/ui/toast.tsx',
  'components/ui/carousel.tsx',
  'components/dashboard/ReservesTableMobileGrid.tsx',
  'components/dashboard/PortfolioPanelSkeleton.tsx',
  'components/dashboard/ReservesTablePagination.tsx',
  'components/ThemeToggle.tsx',
  'components/ui/button.tsx',
  'components/ui/table.tsx',
  'components/dashboard/PullToRefresh.tsx',
];

describe('Phase 2: no hardcoded h-8 in component source', () => {
  for (const file of PHASE_2_COMPONENT_FILES) {
    it(`${file}: no h-8 (use h-[var(--ds-control-h)])`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/\bh-8\b/);
    });
  }
});

describe('Phase 2: no hardcoded h-9 in component source', () => {
  for (const file of PHASE_2_COMPONENT_FILES) {
    it(`${file}: no h-9 (use h-[var(--ds-button-sm-h)])`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/\bh-9\b/);
    });
  }
});

describe('Phase 2: no hardcoded h-11 in component source', () => {
  for (const file of PHASE_2_COMPONENT_FILES) {
    it(`${file}: no h-11 (use h-[var(--ds-button-lg-h)])`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/\bh-11\b/);
    });
  }
});

// ─── Phase 2 chip h-7 migration (chip semantics only) ───────────

const CHIP_H7_FILES = [
  'components/dashboard/PortfolioPanel.tsx',
  'components/dashboard/PortfolioTokenRow.tsx',
  'components/dashboard/FilterBar.tsx',
  'components/dashboard/PopularTokenChip.tsx',
];

describe('Phase 2: chip h-7 uses h-[var(--ds-chip-h)]', () => {
  for (const file of CHIP_H7_FILES) {
    it(`${file}: uses var(--ds-chip-h) for chip height`, () => {
      const src = readFile(file);
      // At least one chip height reference should use the token
      // (chip input elements or chip containers)
      expect(src).toMatch(/var\(--ds-chip-h\)/);
    });
  }
});

// ─── Layout: <main> must own section spacing ────────────────────

describe('Layout: <main> owns content section spacing', () => {
  const indexSrc = readFile('pages/Index.tsx');
  const loadingSrc = readFile('components/dashboard/LoadingState.tsx');

  it('Index.tsx: <main> has space-y-3 md:space-y-5', () => {
    expect(indexSrc).toMatch(/<main[^>]*space-y-3[^>]*md:space-y-5/);
  });

  it('Index.tsx: parent wrapper does NOT use space-y (spacing delegated to <main>)', () => {
    const parentDivMatch = indexSrc.match(
      /relative z-10 w-full[^"]*py-\[var\(--ds-space-5\)\][^"]*"/,
    );
    expect(parentDivMatch).toBeTruthy();
    expect(parentDivMatch![0]).not.toMatch(/space-y-3/);
  });

  it('LoadingState.tsx: <main> has space-y-3 md:space-y-5', () => {
    expect(loadingSrc).toMatch(/<main[^>]*space-y-3[^>]*md:space-y-5/);
  });
});

// ─── Phase 3 ring tooltip max-width ─────────────────────────────

const PHASE_3_TOOLTIP_FILES = [
  'components/dashboard/BorrowCapProgressRing.tsx',
  'components/dashboard/CapProgressRing.tsx',
];

describe('Phase 3: no hardcoded max-w-[220px] in tooltip sources', () => {
  for (const file of PHASE_3_TOOLTIP_FILES) {
    it(`${file}: max-w uses var(--ds-ring-tooltip-max-w)`, () => {
      const src = readFile(file);
      expect(src).toMatch(/max-w-\[var\(--ds-ring-tooltip-max-w\)\]/);
    });

    it(`${file}: no hardcoded max-w-[220px]`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/max-w-\[220px\]/);
    });
  }
});