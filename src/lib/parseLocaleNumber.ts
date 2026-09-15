/**
 * Parse a number typed in a given locale's conventions.
 *
 * Handles "10.000" (pt-BR/de-DE/es-ES/it-IT/id-ID thousands) as 10000 and
 * "10.000,50" as 10000.5, while still accepting plain "10000" / "10000.5".
 */
export function parseLocaleNumber(input: string, locale: string): number {
  const raw = input.replace(/[^0-9.,\s\u00a0\u202f]/g, '').trim();
  if (!raw) return NaN;

  let decimalSep = '.';
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
    decimalSep = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  } catch {
    decimalSep = '.';
  }

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  let normalized: string;
  if (hasDot && hasComma) {
    // The last-occurring separator is the decimal one.
    const sep = raw.lastIndexOf('.') > raw.lastIndexOf(',') ? '.' : ',';
    const group = sep === '.' ? ',' : '.';
    normalized = raw.split(group).join('').replace(sep, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const segments = raw.split(sep);
    const isGrouping =
      segments.length > 2 ||
      (segments.length === 2 &&
        segments[1].length === 3 &&
        segments[0].length > 0 &&
        sep !== decimalSep);
    normalized = isGrouping ? segments.join('') : segments.join('.');
  } else {
    normalized = raw;
  }

  normalized = normalized.replace(/[\s\u00a0\u202f]/g, '');
  return Number(normalized);
}
