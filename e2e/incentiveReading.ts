/**
 * AAV-1395 — reading an incentive cell must distinguish "the cell says zero"
 * from "the cell is gone".
 *
 * The AAV-1333 offset ladder used to read a missing `span[data-after]` as 0,
 * so a broken row produced `measured = 1` and every rung passed. The decision
 * lives here (dependency-free) so the semantics are unit-tested; the Playwright
 * reader (`readIncentiveCellState`) only reports what the DOM said.
 */

export interface IncentiveCellReading {
  /** `span[data-after]` exists. */
  present: boolean;
  /** That span carries a finite `data-after` attribute. */
  numeric: boolean;
  /** Parsed value; 0 when the cell is absent or unparsable. */
  value: number;
}

export type IncentiveReadingVerdict = { ok: true } | { ok: false; reason: string };

/**
 * A numeric cell always passes. A missing cell is the legitimate "—" shape
 * only on the rung the plan says floors the eligible position at zero; on any
 * other rung it must fail, because reading it as 0 would turn a broken row
 * into a perfect decrease.
 */
export function classifyIncentiveReading(
  reading: IncentiveCellReading,
  expectedAfterZero: boolean,
): IncentiveReadingVerdict {
  if (reading.present && reading.numeric) return { ok: true };
  if (!reading.present && expectedAfterZero) return { ok: true };
  if (!reading.present) {
    return {
      ok: false,
      reason: 'incentive cell disappeared (no data-after span) — reading it as 0 would hide a broken row',
    };
  }
  return { ok: false, reason: 'incentive cell data-after is not a finite number' };
}
