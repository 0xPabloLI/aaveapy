/**
 * Regression test for mobile (compact) Simulation breakdown layout.
 * See: docs/design/frontend-interaction-guardrails.md
 *      "Simulation breakdown table — no horizontal scroll on mobile"
 *      docs/specs/2026-05-10-mobile-simulation-grid-layout-plan.md
 *
 * Background: previous implementations used `table-fixed` + percentage
 * `<colgroup>` widths. That hard-clipped overflow but could not gracefully
 * wrap a long `Supplied / Cap $19.50M` label onto a second line. The current
 * implementation uses CSS Grid with `grid-cols-[1fr_auto_auto_auto]`:
 * - The label cell (`1fr`) wraps via `flex flex-wrap` between unbreakable
 *   `whitespace-nowrap` spans, so label + cap stay on one line when there is
 *   room and break to two lines otherwise.
 * - Numeric cells (`auto`) size to content, so K/M/B-formatted values always
 *   fit without horizontal overflow.
 *
 * The desktop layout remains `<table className="w-full min-w-0 table-fixed">`
 * inside `renderTable` and is asserted to be untouched (TC-10).
 *
 * These assertions are source-level (regex). Rendering the real component
 * requires a heavy fixture; the invariants we want to lock in are structural
 * class strings and role attributes.
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

const getCompactGridRowBlock = (): string => {
  const start = SOURCE.indexOf('const renderCompactGridRow');
  expect(start).toBeGreaterThan(-1);
  const rest = SOURCE.slice(start + 1);
  const nextIdx = rest.search(/\n\s{2}const render[A-Z]/);
  const end = nextIdx > 0 ? start + 1 + nextIdx : -1;
  return end > 0 ? SOURCE.slice(start, end) : SOURCE.slice(start);
};

describe('SimulationSubRow compact (mobile) Grid layout', () => {
  it('TC-01: renderCompactLayout no longer uses <table>, table-fixed, or <colgroup>', () => {
    const block = getCompactBlock();
    expect(block).not.toMatch(/<table/);
    expect(block).not.toMatch(/table-fixed/);
    expect(block).not.toMatch(/<colgroup/);
    expect(block).not.toMatch(/<thead/);
    expect(block).not.toMatch(/<tbody/);
  });

  it('TC-02: renderCompactLayout top-level container uses grid-cols-[1fr_auto_auto_auto]', () => {
    const block = getCompactBlock();
    const matches = block.match(/grid-cols-\[1fr_auto_auto_auto\]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('TC-03: never enables horizontal scrolling on the compact wrapper', () => {
    const block = getCompactBlock();
    expect(block).not.toMatch(/overflow-x-auto/);
    expect(block).not.toMatch(/overflow-x-scroll/);
  });

  it('TC-04: numeric cells preserve whitespace-nowrap + tabular-nums + ds-text-11', () => {
    const block = getCompactBlock();
    const rowBlock = getCompactGridRowBlock();
    const combined = `${block}\n${rowBlock}`;
    const numericSpans = combined.match(/ds-text-11 tabular-nums whitespace-nowrap/g) ?? [];
    expect(numericSpans.length).toBeGreaterThanOrEqual(3);
  });

  it('TC-05: cap progress / cap note rows use col-span-4', () => {
    const rowBlock = getCompactGridRowBlock();
    const colSpanMatches = rowBlock.match(/col-span-4/g) ?? [];
    // At least cap progress + cap note (2 occurrences)
    expect(colSpanMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('TC-06: label cell uses flex flex-wrap items-baseline so cap can wrap to a new line', () => {
    const rowBlock = getCompactGridRowBlock();
    expect(rowBlock).toMatch(/flex flex-wrap items-baseline/);
  });

  it('TC-07: Grid layout exposes a11y roles (table / row / cell / columnheader)', () => {
    const block = getCompactBlock();
    expect(block).toMatch(/role="table"/);
    expect(block).toMatch(/role="row"/);
    expect(block).toMatch(/role="cell"/);
    expect(block).toMatch(/role="columnheader"/);
    expect(block).toMatch(/aria-label="Simulation breakdown"/);
  });

  it('TC-08: Spread row is rewritten as Grid (no <tr>/<td> for Spread)', () => {
    const block = getCompactBlock();
    // Spread label is now inside a div role="cell", not <td>
    expect(block).not.toMatch(/<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?Spread/);
    expect(block).toMatch(/role="cell"[^>]*>[\s\S]*?Spread/);
  });

  it('TC-09: Liquidity row is rewritten as Grid (no <tr>/<td> for Liquidity)', () => {
    const block = getCompactBlock();
    expect(block).not.toMatch(/<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?Liquidity/);
    expect(block).toMatch(/role="cell"[^>]*>[\s\S]*?Liquidity/);
  });

  it('TC-10: desktop renderTable is untouched (still uses w-full min-w-0 table-fixed)', () => {
    const matches = SOURCE.match(/<table className="w-full min-w-0 table-fixed">/g) ?? [];
    // renderTable + the EarnCost desktop fallback table
    expect(matches.length).toBe(2);
  });

  it('TC-11: renderCompactGridRow places data-disabled on the group cell (not the contents wrapper)', () => {
    const rowBlock = getCompactGridRowBlock();
    // The label cell div must carry both group AND data-disabled on the same element
    // so that group-data-[disabled]:text-muted-foreground works correctly.
    // Pattern: <div role="cell" data-disabled=... className={`group ...`}>
    // Anti-pattern: <div role="row" className="contents" data-disabled=...>
    //              <div role="cell" className={`group ...`}>  (group without data-disabled)
    const labelCellMatch = rowBlock.match(
      /<div\s+role="cell"\s+data-disabled=\{[^}]*\}\s+className=\{`group\s/,
    );
    expect(labelCellMatch).toBeTruthy();
    // The contents wrapper must NOT carry data-disabled
    const contentsWithDataDisabled = rowBlock.match(
      /<div\s+role="row"\s+className="contents"\s+data-disabled/,
    );
    expect(contentsWithDataDisabled).toBeNull();
  });

  it('TC-12: supplySectionClass and borrowSectionClass are empty (no opacity reduction for frozen/paused)', () => {
    const block = getCompactBlock();
    const supplyMatch = block.match(/supplySectionClass\s*=\s*''/);
    const borrowMatch = block.match(/borrowSectionClass\s*=\s*''/);
    expect(supplyMatch).toBeTruthy();
    expect(borrowMatch).toBeTruthy();
  });
});
