import { describe, expect, it } from 'vitest';

import { parseLocaleNumber } from './parseLocaleNumber';

describe('parseLocaleNumber', () => {
  it('reads dot as thousands separator in dot-grouping locales', () => {
    expect(parseLocaleNumber('10.000', 'pt-BR')).toBe(10000);
    expect(parseLocaleNumber('10.000', 'de-DE')).toBe(10000);
    expect(parseLocaleNumber('1.234.567', 'id-ID')).toBe(1234567);
  });

  it('reads mixed grouping and decimals', () => {
    expect(parseLocaleNumber('10.000,50', 'pt-BR')).toBeCloseTo(10000.5, 6);
    expect(parseLocaleNumber('10,000.50', 'en-US')).toBeCloseTo(10000.5, 6);
  });

  it('keeps decimal comma and decimal dot', () => {
    expect(parseLocaleNumber('1500,25', 'de-DE')).toBeCloseTo(1500.25, 6);
    expect(parseLocaleNumber('1500.25', 'en-US')).toBeCloseTo(1500.25, 6);
  });

  it('handles plain and invalid input', () => {
    expect(parseLocaleNumber('20000', 'pt-BR')).toBe(20000);
    expect(Number.isNaN(parseLocaleNumber('abc', 'pt-BR'))).toBe(true);
  });

  it('treats dot as decimal in en-US even with three digits', () => {
    expect(parseLocaleNumber('10.000', 'en-US')).toBeCloseTo(10, 6);
  });
});
