/**
 * Regression test for mobile (compact) Simulation table truncation.
 * See: docs/design/frontend-interaction-guardrails.md
 *      "Simulation breakdown table — numeric cell wrapping (mobile)"
 *
 * Background: a previous version used `table-fixed` with hard percentage
 * `<col>` widths, which caused the right-most Δ column to clip values like
 * `+$399.88M` on 375px viewports. The fix is `table-auto` + `whitespace-nowrap`
 * on every numeric cell (header + body) and inner `<span>`.
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

describe('SimulationSubRow compact (mobile) layout', () => {
  it('uses table-auto, never table-fixed, in the compact layout', () => {
    // Locate the renderCompactLayout function block.
    const start = SOURCE.indexOf('renderCompactLayout');
    expect(start).toBeGreaterThan(-1);
    const end = SOURCE.indexOf('const renderDesktopLayout', start);
    const block = end > 0 ? SOURCE.slice(start, end) : SOURCE.slice(start);

    expect(block).toMatch(/table-auto/);
    expect(block).not.toMatch(/table-fixed/);
    // No hard percentage <col> widths that would force truncation.
    expect(block).not.toMatch(/style=\{\{\s*width:\s*['"]\d+%/);
  });

  it('headers for Current / After / Δ carry whitespace-nowrap', () => {
    // Each numeric header cell uses compactNumCell or compactDeltaCell with text-right whitespace-nowrap.
    const numHeaderClass = /\$\{compactCellPy\} \$\{compactNumCell\} text-right whitespace-nowrap/;
    const deltaHeaderClass = /\$\{compactCellPy\} \$\{compactDeltaCell\} text-right whitespace-nowrap/;
    expect(SOURCE).toMatch(numHeaderClass);
    expect(SOURCE).toMatch(deltaHeaderClass);
  });

  it('renderRow numeric <td>s and inner <span>s use whitespace-nowrap', () => {
    // The three numeric cells in renderRow must all be nowrap, and so must
    // their inner spans (so a long value never wraps mid-token).
    const tdNowrap = SOURCE.match(/text-right align-top whitespace-nowrap/g) ?? [];
    expect(tdNowrap.length).toBeGreaterThanOrEqual(3);

    const spanNowrap = SOURCE.match(/tabular-nums whitespace-nowrap/g) ?? [];
    expect(spanNowrap.length).toBeGreaterThanOrEqual(3);
  });
});
