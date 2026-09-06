const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const unPrefixSymbol = (symbol: string, prefix: string) => {
  // nosemgrep: detect-non-literal-regexp — prefix is fully regex-escaped (no metacharacters, no nested quantifiers → no ReDoS); only caller passes the literal 'AMM'
  return symbol.toUpperCase().replace(RegExp(`^(${escapeRegExp(prefix[0])}?${escapeRegExp(prefix.slice(1))})`), '');
};
