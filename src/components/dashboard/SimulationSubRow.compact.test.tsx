/**
 * Regression test for mobile (compact) Simulation table overflow.
 * See: docs/design/frontend-interaction-guardrails.md
 *      "Simulation breakdown table — no horizontal scroll on mobile"
 *
 * Background: an earlier `table-fixed` attempt with hard % widths clipped large
 * Δ values; the follow-up switched to `table-auto + overflow-x-auto`, which
 * silently introduced horizontal scrolling on narrow viewports when supply
 * inputs grew (e.g. supply=10000 on Mantle USDC). The current fix forbids
 * horizontal scrolling and instead constrains the layout via `table-fixed`
 * fractional widths plus compact (`ds-text-11`) numeric typography so the
 * K/M/B-formatted values always fit.
 *
 * This test is source-level (regex) on purpose: rendering the real component
 * requires a heavy fixture, and the invariants we want to lock in are
 * structural class strings.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  resolve(__dirname, 'SimulationSubRow.tsx'),
  'utf8',
);

const getCompactBlock = (): string => {
  const start = SOURCE.indexOf('const renderCompactLayout');
  expect(start).toBeGreaterThan(-1);
  const rest = SOURCE.slice(start + 1);
  const nextIdx = rest.search(/\n\s{2}const render[A-Z]/);
  const end = nextIdx > 0 ? start + 1 + nextIdx : -1;
  return end > 0 ? SOURCE.slice(start, end) : SOURCE.slice(start);
};

describe('SimulationSubRow compact (mobile) layout', () => {
  it('never enables horizontal scrolling on the compact wrapper', () => {
    const block = getCompactBlock();
    expect(block).not.toMatch(/overflow-x-auto/);
    expect(block).not.toMatch(/overflow-x-scroll/);
  });

  it('uses table-fixed with explicit fractional column widths so the layout cannot exceed the container', () => {
    const block = getCompactBlock();
    expect(block).toMatch(/table-fixed/);
    expect(block).not.toMatch(/table-auto/);
    // Four <col> entries with explicit % widths (label + 3 numeric).
    const colWidthMatches = block.match(/style=\{\{\s*width:\s*['"]\d+%/g) ?? [];
    expect(colWidthMatches.length).toBe(4);
  });

  it('headers for Current / After / Δ carry whitespace-nowrap', () => {
    const numHeaderClass = /\$\{compactCellPy\} \$\{compactNumCell\} text-right whitespace-nowrap/;
    const deltaHeaderClass = /\$\{compactCellPy\} \$\{compactDeltaCell\} text-right whitespace-nowrap/;
    expect(SOURCE).toMatch(numHeaderClass);
    expect(SOURCE).toMatch(deltaHeaderClass);
  });

  it('renderRow numeric <td>s and inner <span>s use whitespace-nowrap', () => {
    const tdNowrap = SOURCE.match(/text-right align-top whitespace-nowrap/g) ?? [];
    expect(tdNowrap.length).toBeGreaterThanOrEqual(3);

    const spanNowrap = SOURCE.match(/tabular-nums whitespace-nowrap/g) ?? [];
    expect(spanNowrap.length).toBeGreaterThanOrEqual(3);
  });

  it('compact-mode numeric values use ds-text-11 so they fit fixed columns', () => {
    const block = getCompactBlock();
    // Spread + Liquidity inline rows must use ds-text-11 for numeric spans.
    expect(block).toMatch(/ds-text-11 tabular-nums/);
    // The shared renderRow path uses a tight-mode flag that resolves to ds-text-11.
    expect(SOURCE).toMatch(/numericFontClass = tight \? 'ds-text-11' : 'ds-text-12'/);
  });
});
