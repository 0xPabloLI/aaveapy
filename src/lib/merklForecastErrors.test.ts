import { describe, expect, it } from 'vitest';

import { MerklForecastApiError, shouldSurfaceForecastError } from './merklForecastErrors';

describe('shouldSurfaceForecastError', () => {
  it('does not surface unsupported campaign errors (422)', () => {
    const error = new MerklForecastApiError('unsupported', 422);
    expect(shouldSurfaceForecastError(error)).toBe(false);
  });

  it('surfaces transport/server errors', () => {
    const error = new MerklForecastApiError('server', 500);
    expect(shouldSurfaceForecastError(error)).toBe(true);
  });

  it('surfaces unknown errors', () => {
    expect(shouldSurfaceForecastError(new Error('oops'))).toBe(true);
  });

  it('does not surface plain objects with 422 status', () => {
    expect(shouldSurfaceForecastError({ status: 422, message: 'unsupported' })).toBe(false);
  });
});
