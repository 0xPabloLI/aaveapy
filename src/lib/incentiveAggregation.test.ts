import { describe, expect, it } from 'vitest';
import { formatForecastUnavailableLabel } from './incentiveAggregation';

describe('formatForecastUnavailableLabel', () => {
  it('shows single campaign ID', () => {
    expect(formatForecastUnavailableLabel(['123'], 1))
      .toBe('Campaign #123 without forecast – using current APR.');
  });

  it('shows multiple campaign IDs', () => {
    expect(formatForecastUnavailableLabel(['123', '456'], 2))
      .toBe('Campaigns #123, #456 without forecast – using current APR.');
  });

  it('truncates after 3 with +N more', () => {
    expect(formatForecastUnavailableLabel(['1', '2', '3', '4', '5'], 5))
      .toBe('Campaigns #1, #2, #3 +2 more without forecast – using current APR.');
  });

  it('falls back to count when ids is undefined', () => {
    expect(formatForecastUnavailableLabel(undefined, 3))
      .toBe('3 campaigns without forecast – using current APR.');
  });

  it('falls back to count when ids is empty but count > 0', () => {
    expect(formatForecastUnavailableLabel([], 2))
      .toBe('2 campaigns without forecast – using current APR.');
  });

  it('uses singular "campaign" for count=1', () => {
    expect(formatForecastUnavailableLabel(undefined, 1))
      .toBe('1 campaign without forecast – using current APR.');
  });
});
