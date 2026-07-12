import { describe, it, expect } from 'vitest';
import { freshnessColor } from './freshnessColor';

describe('freshnessColor', () => {
  it('returns emerald for age 0 (fresh)', () => {
    expect(freshnessColor(0)).toBe('bg-emerald-400');
  });

  it('returns emerald for age 29 (just under 30s threshold)', () => {
    expect(freshnessColor(29)).toBe('bg-emerald-400');
  });

  it('returns amber for age 30 (at 30s threshold)', () => {
    expect(freshnessColor(30)).toBe('bg-amber-400');
  });

  it('returns amber for age 59 (just under 60s threshold)', () => {
    expect(freshnessColor(59)).toBe('bg-amber-400');
  });

  it('returns red for age 60 (at 60s threshold)', () => {
    expect(freshnessColor(60)).toBe('bg-red-400');
  });

  it('returns red for age 3600 (1 hour stale)', () => {
    expect(freshnessColor(3600)).toBe('bg-red-400');
  });

  it('clamps negative age to 0 (emerald)', () => {
    expect(freshnessColor(-1)).toBe('bg-emerald-400');
    expect(freshnessColor(-100)).toBe('bg-emerald-400');
  });
});
