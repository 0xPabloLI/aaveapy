import { describe, expect, it } from 'vitest';

import { formatNumberInput, parseNumberInput, sanitizeNumberInput } from './numberFormat';

describe('numberFormat', () => {
  it('formats integers with comma separators', () => {
    expect(formatNumberInput('1000000')).toBe('1,000,000');
    expect(formatNumberInput('1234')).toBe('1,234');
  });

  it('formats decimals while preserving the decimal part', () => {
    expect(formatNumberInput('1000000.25')).toBe('1,000,000.25');
    expect(formatNumberInput('1,234.56')).toBe('1,234.56');
  });

  it('preserves trailing decimal point while typing', () => {
    expect(formatNumberInput('1234.')).toBe('1,234.');
  });

  it('sanitizes invalid characters', () => {
    expect(sanitizeNumberInput('abc1,23x.4y')).toBe('123.4');
  });

  it('normalizes fullwidth decimal to ASCII dot', () => {
    expect(sanitizeNumberInput('1000。')).toBe('1000.');
    expect(sanitizeNumberInput('1000．')).toBe('1000.');
    expect(sanitizeNumberInput('1000。5')).toBe('1000.5');
    expect(sanitizeNumberInput('。5')).toBe('0.5');
    expect(sanitizeNumberInput('1000｡')).toBe('1000.');
    expect(sanitizeNumberInput('1。2。3')).toBe('1.23');
  });

  it('parses formatted values into numbers', () => {
    expect(parseNumberInput('1,234.56')).toBeCloseTo(1234.56, 6);
    expect(parseNumberInput('')).toBe(0);
  });
});
