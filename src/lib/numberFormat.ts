export const sanitizeNumberInput = (value: string): string => {
  const normalized = value.replace(/[。．｡]/g, '.');
  const cleaned = normalized.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return '';

  const parts = cleaned.split('.');
  const intPart = parts[0];
  const decimalPart = parts.slice(1).join('');

  if (cleaned.startsWith('.')) {
    return decimalPart.length > 0 ? `0.${decimalPart}` : '0.';
  }

  if (parts.length > 1) {
    return `${intPart}.${decimalPart}`;
  }

  return intPart;
};

export const formatNumberInput = (value: string): string => {
  const sanitized = sanitizeNumberInput(value);
  if (!sanitized) return '';

  const endsWithDot = sanitized.endsWith('.');
  const [intPartRaw, decimalPart] = sanitized.split('.');
  const intPart = intPartRaw === '' ? '0' : intPartRaw;
  const formattedInt = new Intl.NumberFormat('en-US').format(Number(intPart));

  if (endsWithDot) {
    return `${formattedInt}.`;
  }

  if (decimalPart !== undefined) {
    return `${formattedInt}.${decimalPart}`;
  }

  return formattedInt;
};

export const parseNumberInput = (value: string): number => {
  const sanitized = sanitizeNumberInput(value);
  if (!sanitized || sanitized === '0.') return 0;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};
