import { describe, expect, it } from 'vitest';

import { classifyIncentiveReading, type IncentiveCellReading } from '../../e2e/incentiveReading';

/**
 * AAV-1395 — the offset ladder must distinguish "the cell says zero" from
 * "the cell is gone". Before this module the Playwright reader returned 0 for
 * a missing `span[data-after]`, so a broken row produced `measured = 1` and
 * every rung passed.
 */

const reading = (overrides: Partial<IncentiveCellReading>): IncentiveCellReading => ({
  present: true,
  numeric: true,
  value: 0,
  ...overrides,
});

describe('classifyIncentiveReading (AAV-1395)', () => {
  it('R1: a numeric cell passes on both a mid and a zero rung', () => {
    expect(classifyIncentiveReading(reading({ value: 1.25 }), false)).toEqual({ ok: true });
    expect(classifyIncentiveReading(reading({ value: 0 }), true)).toEqual({ ok: true });
  });

  it('R2: a present but non-numeric cell fails even when the rung expects zero', () => {
    const verdict = classifyIncentiveReading(reading({ numeric: false }), true);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/not a finite number/);
  });

  it('R3: a missing cell is accepted only on the rung that expects zero', () => {
    expect(classifyIncentiveReading(reading({ present: false, numeric: false }), true)).toEqual({ ok: true });

    const verdict = classifyIncentiveReading(reading({ present: false, numeric: false }), false);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/disappeared/);
  });

  it('R4: a missing cell never passes just because its parsed value is 0', () => {
    const verdict = classifyIncentiveReading(reading({ present: false, numeric: false, value: 0 }), false);
    expect(verdict.ok).toBe(false);
  });
});
