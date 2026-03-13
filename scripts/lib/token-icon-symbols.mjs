import path from 'path';

export function normalizeSymbolKey(symbol) {
  const key = String(symbol || '').trim().toLowerCase();
  if (!key) return null;
  if (key.includes('/') || key.includes('\\')) return null;
  return key;
}

export function splitIconSymbolParts(symbol) {
  return String(symbol || '')
    .split('_')
    .map((part) => normalizeSymbolKey(part))
    .filter(Boolean);
}

function extractAssignedObjectLiteral(content, marker) {
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Failed to locate marker: ${marker}`);
  }

  const assignmentIndex = content.indexOf('=', markerIndex);
  if (assignmentIndex < 0) {
    throw new Error(`Failed to locate assignment for marker: ${marker}`);
  }

  const openIndex = content.indexOf('{', assignmentIndex);
  if (openIndex < 0) {
    throw new Error(`Failed to locate object literal start for marker: ${marker}`);
  }

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaping = false;

  for (let i = openIndex; i < content.length; i++) {
    const ch = content[i];

    if (escaping) {
      escaping = false;
      continue;
    }

    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaping = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      continue;
    }
    if (inSingle && ch === "'") {
      inSingle = false;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      continue;
    }
    if (inDouble && ch === '"') {
      inDouble = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`' && !inTemplate) {
      inTemplate = true;
      continue;
    }
    if (inTemplate && ch === '`') {
      inTemplate = false;
      continue;
    }

    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openIndex, i + 1);
      }
    }
  }

  throw new Error(`Failed to locate object literal end for marker: ${marker}`);
}

function parseNamedAddressBookImports(reservePatchesContent) {
  const importMatch = reservePatchesContent.match(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]@bgd-labs\/aave-address-book['"]/m
  );
  if (!importMatch) return [];

  return importMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+as\s+[A-Za-z0-9_]+$/, '').trim())
    .filter(Boolean);
}

function evaluateObjectLiteral(objectLiteral, evalContext = {}) {
  const keys = Object.keys(evalContext);
  const values = Object.values(evalContext);
  return Function(...keys, `return (${objectLiteral});`)(...values);
}

function resolveSymbolMap(reservePatchesContent) {
  const symbolMapLiteral = extractAssignedObjectLiteral(reservePatchesContent, 'export const SYMBOL_MAP');
  const symbolMap = evaluateObjectLiteral(symbolMapLiteral, {});
  if (!symbolMap || typeof symbolMap !== 'object') {
    throw new Error('SYMBOL_MAP did not evaluate to an object');
  }
  return symbolMap;
}

function resolveUnderlyingAssetMap(reservePatchesContent, addressBookContext = {}) {
  const underlyingMapLiteral = extractAssignedObjectLiteral(reservePatchesContent, 'const underlyingAssetMap');
  const importedNames = parseNamedAddressBookImports(reservePatchesContent);

  const evalContext = {
    name: '',
    symbol: '',
  };

  for (const name of importedNames) {
    if (!(name in addressBookContext)) {
      throw new Error(`Missing ${name} in addressBookContext while evaluating reservePatches`);
    }
    evalContext[name] = addressBookContext[name];
  }

  const underlyingAssetMap = evaluateObjectLiteral(underlyingMapLiteral, evalContext);
  if (!underlyingAssetMap || typeof underlyingAssetMap !== 'object') {
    throw new Error('underlyingAssetMap did not evaluate to an object');
  }
  return underlyingAssetMap;
}

function unPrefixSymbol(symbol, prefix) {
  return symbol.toUpperCase().replace(RegExp(`^(${prefix[0]}?${prefix.slice(1)})`), '');
}

function addIconSymbol(set, iconSymbol) {
  for (const key of splitIconSymbolParts(iconSymbol)) {
    set.add(key);
  }
}

function resolveRuntimeIconSymbol({ row, underlyingAssetMap, symbolMap }) {
  const rawAddress = normalizeSymbolKey(row?.tokenAddress);
  if (rawAddress && underlyingAssetMap[rawAddress]?.iconSymbol) {
    return String(underlyingAssetMap[rawAddress].iconSymbol);
  }

  const rawSymbol = String(row?.tokenSymbol || '').trim();
  if (!rawSymbol) return null;

  const mapped =
    symbolMap[rawSymbol] ??
    symbolMap[rawSymbol.toUpperCase()] ??
    symbolMap[rawSymbol.toLowerCase()] ??
    rawSymbol;

  return unPrefixSymbol(String(mapped), 'AMM');
}

export function collectRequiredIconSymbols({
  reservePatchesContent,
  marketsRows = [],
  addressBookContext = {},
}) {
  const required = new Set();
  const symbolMap = resolveSymbolMap(reservePatchesContent);
  const underlyingAssetMap = resolveUnderlyingAssetMap(reservePatchesContent, addressBookContext);

  for (const value of Object.values(underlyingAssetMap)) {
    if (!value || typeof value !== 'object') continue;
    addIconSymbol(required, value.iconSymbol);
  }

  for (const value of Object.values(symbolMap)) {
    addIconSymbol(required, value);
  }

  for (const row of marketsRows) {
    const iconSymbol = resolveRuntimeIconSymbol({
      row,
      underlyingAssetMap,
      symbolMap,
    });
    if (!iconSymbol) continue;
    addIconSymbol(required, iconSymbol);
  }

  return required;
}

export function collectIconSymbolLogoHints({
  reservePatchesContent,
  marketsRows = [],
  addressBookContext = {},
  tokenLogoByAddress = new Map(),
}) {
  const hints = new Map();
  const symbolMap = resolveSymbolMap(reservePatchesContent);
  const underlyingAssetMap = resolveUnderlyingAssetMap(reservePatchesContent, addressBookContext);

  const addHint = (iconSymbol, logoURI) => {
    if (!iconSymbol || !logoURI) return;
    const key = normalizeSymbolKey(iconSymbol);
    if (!key) return;
    if (hints.has(key)) return;
    hints.set(key, String(logoURI));
  };

  for (const [address, value] of Object.entries(underlyingAssetMap)) {
    if (!value || typeof value !== 'object' || !value.iconSymbol) continue;
    const normalizedAddress = normalizeSymbolKey(address);
    const logoURI =
      value.logoURI ||
      (normalizedAddress ? tokenLogoByAddress.get(normalizedAddress) : undefined);
    addHint(value.iconSymbol, logoURI);
  }

  for (const row of marketsRows) {
    const iconSymbol = resolveRuntimeIconSymbol({
      row,
      underlyingAssetMap,
      symbolMap,
    });
    if (!iconSymbol) continue;
    const rawAddress = normalizeSymbolKey(row?.tokenAddress);
    const mapped = rawAddress ? underlyingAssetMap[rawAddress] : undefined;
    const logoURI =
      row?.logoURI ||
      mapped?.logoURI ||
      (rawAddress ? tokenLogoByAddress.get(rawAddress) : undefined);
    addHint(iconSymbol, logoURI);
  }

  return hints;
}

export function toSortedArray(setLike) {
  return Array.from(setLike).sort((a, b) => a.localeCompare(b));
}

export function getReservePatchesPath(rootDir) {
  return path.join(rootDir, 'src', 'ui-config', 'reservePatches.ts');
}
