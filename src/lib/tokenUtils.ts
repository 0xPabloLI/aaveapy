export const unPrefixSymbol = (symbol: string, prefix: string) => {
  return symbol.toUpperCase().replace(RegExp(`^(${prefix[0]}?${prefix.slice(1)})`), ''); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
};
