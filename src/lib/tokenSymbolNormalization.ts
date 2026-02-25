export const normalizeTokenSymbolBaseUpper = (value: string): string =>
  value.toUpperCase().trim().replace(/\.E$/, '').replace(/^M\./, '');

export const normalizeTokenSymbolAliasesUpper = (value: string): string =>
  value
    .replace(/USD₮0/g, 'USDT0')
    .replace(/USD₮/g, 'USDT')
    .replace(/USDT0/g, 'USDT');

export const normalizeTokenSymbolForSearch = (value: string): string =>
  normalizeTokenSymbolAliasesUpper(normalizeTokenSymbolBaseUpper(value)).replace(/[^A-Z0-9]/g, '');

export const normalizeTokenSymbolForAsciiLower = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = normalizeTokenSymbolAliasesUpper(normalizeTokenSymbolBaseUpper(value))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return normalized || undefined;
};
