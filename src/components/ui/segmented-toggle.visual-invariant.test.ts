import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual regression guard for SegmentedToggle styling invariants.
 *
 * Validates that the source code preserves critical design-system patterns
 * that cannot be caught by unit tests alone. If any invariant breaks,
 * the corresponding visual trait (border-radius, spacing, active style)
 * will regress in production.
 *
 * Invariants derived from segmented-toggle.tsx and index.css:
 *  1. Vertical track uses rounded-2xl, horizontal uses rounded-full
 *  2. Vertical indicator uses rounded-xl, horizontal uses rounded-full
 *  3. Vertical button uses rounded-xl, horizontal uses rounded-full
 *  4. Track gap uses --ds-seg-gap CSS variable
 *  5. Track padding uses --ds-seg-track-pad / --ds-seg-chip-track-pad
 *  6. Segment min-width uses --ds-seg-seg-min-w / --ds-seg-chip-seg-min-w
 *  7. Active segment uses font-semibold
 *  8. Indicator has shadow and motion-safe transition
 *  9. CSS custom properties for ds-seg-* are defined in index.css
 * 10. Vertical uses gridTemplateRows, horizontal uses gridTemplateColumns
 */

describe('SegmentedToggle visual invariant regression guard', () => {
  const src = readFileSync(
    resolve(__dirname, 'segmented-toggle.tsx'),
    'utf8',
  );

  const cssSrc = readFileSync(
    resolve(__dirname, '../../index.css'),
    'utf8',
  );

  // ─── Invariant 1: track border-radius ──────────────────────────

  it('vertical track uses rounded-2xl (card aesthetic)', () => {
    const match = src.match(/isVertical\s*\?\s*['"]rounded-2xl['"]/);
    expect(match, 'vertical track must use rounded-2xl').not.toBeNull();
  });

  it('horizontal track uses rounded-full (pill aesthetic)', () => {
    const match = src.match(/isVertical\s*\?\s*['"]rounded-2xl['"]\s*:\s*['"]rounded-full['"]/);
    expect(match, 'horizontal track must use rounded-full').not.toBeNull();
  });

  // ─── Invariant 2: indicator border-radius ──────────────────────

  it('vertical indicator uses rounded-xl', () => {
    expect(src).toMatch(/isVertical\s*\?\s*['"]rounded-xl['"]\s*:\s*['"]rounded-full['"]/);
  });

  // ─── Invariant 3: button border-radius ─────────────────────────

  it('vertical button uses rounded-xl, horizontal uses rounded-full', () => {
    const buttonRadiusPattern = /isVertical\s*\?\s*['"]rounded-xl['"]\s*:\s*['"]rounded-full['"]/g;
    const matches = src.match(buttonRadiusPattern);
    expect(
      matches,
      'button element should have isVertical ? rounded-xl : rounded-full',
    ).not.toBeNull();
    expect(matches!.length, 'rounded-xl/rounded-full should appear at least twice (indicator + button)').toBeGreaterThanOrEqual(2);
  });

  // ─── Invariant 4: gap uses CSS variable ────────────────────────

  it('track gap references --ds-seg-gap', () => {
    expect(src).toMatch(/gap-\[var\(--ds-seg-gap\)\]/);
  });

  // ─── Invariant 5: track padding uses CSS variables ─────────────

  it('track padding references --ds-seg-track-pad for default size', () => {
    expect(src).toMatch(/p-\[var\(--ds-seg-track-pad\)\]/);
  });

  it('track padding references --ds-seg-chip-track-pad for chip size', () => {
    expect(src).toMatch(/p-\[var\(--ds-seg-chip-track-pad\)\]/);
  });

  // ─── Invariant 6: segment min-width uses CSS variables ─────────

  it('segment min-width references --ds-seg-seg-min-w for default', () => {
    expect(src).toMatch(/min-w-\[var\(--ds-seg-seg-min-w\)\]/);
  });

  it('segment min-width references --ds-seg-chip-seg-min-w for chip', () => {
    expect(src).toMatch(/min-w-\[var\(--ds-seg-chip-seg-min-w\)\]/);
  });

  // ─── Invariant 7: active segment font-semibold ─────────────────

  it('active segment applies font-semibold', () => {
    expect(src).toMatch(/font-semibold/);
  });

  // ─── Invariant 8: indicator shadow and transition ──────────────

  it('indicator has shadow for elevation', () => {
    expect(src).toMatch(/shadow-\[/);
  });

  it('indicator has motion-safe transition', () => {
    expect(src).toMatch(/motion-safe:transition-all/);
    expect(src).toMatch(/motion-safe:duration-200/);
  });

  // ─── Invariant 9: CSS custom properties defined ────────────────

  it('index.css defines all ds-seg-* custom properties', () => {
    const requiredVars = [
      '--ds-seg-track-h',
      '--ds-seg-track-pad',
      '--ds-seg-chip-track-pad',
      '--ds-seg-seg-min-h',
      '--ds-seg-seg-min-w',
      '--ds-seg-chip-seg-min-w',
      '--ds-seg-seg-pad-x',
      '--ds-seg-seg-pad-y-pad-x',
      '--ds-seg-chip-seg-pad-x',
      '--ds-seg-gap',
    ];
    for (const varName of requiredVars) {
      expect(
        cssSrc,
        `${varName} must be defined in index.css`,
      ).toMatch(new RegExp(varName.replace(/([$.\\])/g, '\\$1') + '\\s*:'));
    }
  });

  // ─── Invariant 10: grid direction ──────────────────────────────

  it('vertical orientation uses gridTemplateRows', () => {
    expect(src).toMatch(/gridTemplateRows/);
  });

  it('horizontal orientation uses gridTemplateColumns', () => {
    expect(src).toMatch(/gridTemplateColumns/);
  });

  it('grid uses repeat with options.length', () => {
    expect(src).toMatch(/repeat\(\$\{options\.length\}/);
  });
});
