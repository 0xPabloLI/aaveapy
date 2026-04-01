/**
 * Shared helpers to parse and merge `export const SYMBOL_MAP` in reservePatches.ts
 * against aave/interface upstream. Upstream values win on key collision; local-only keys stay.
 */

function findMatchingBrace(content, openIndex) {
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
        return i;
      }
    }
  }

  throw new Error('Failed to locate closing brace');
}

export function findSymbolMapBounds(content) {
  const marker = 'export const SYMBOL_MAP';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Failed to locate SYMBOL_MAP in reservePatches.ts');
  }
  const eqOpen = content.indexOf('= {', markerIndex);
  if (eqOpen < 0) {
    throw new Error('Failed to locate SYMBOL_MAP object (= {)');
  }
  const openIndex = content.indexOf('{', eqOpen);
  if (openIndex < 0) {
    throw new Error('Failed to locate opening brace for SYMBOL_MAP');
  }
  const closeIndex = findMatchingBrace(content, openIndex);
  return { openIndex, closeIndex };
}

function splitTopLevelEntries(objectBody) {
  const entries = [];
  let start = 0;
  let depthCurly = 0;
  let depthSquare = 0;
  let depthParen = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaping = false;

  for (let i = 0; i < objectBody.length; i++) {
    const ch = objectBody[i];

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

    if (ch === '{') depthCurly += 1;
    if (ch === '}') depthCurly -= 1;
    if (ch === '[') depthSquare += 1;
    if (ch === ']') depthSquare -= 1;
    if (ch === '(') depthParen += 1;
    if (ch === ')') depthParen -= 1;

    if (ch === ',' && depthCurly === 0 && depthSquare === 0 && depthParen === 0) {
      const chunk = objectBody.slice(start, i).trim();
      if (chunk) entries.push(chunk);
      start = i + 1;
    }
  }

  const tail = objectBody.slice(start).trim();
  if (tail) entries.push(tail);
  return entries;
}

function parseSymbolMapChunk(chunk) {
  const lines = chunk
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
  if (lines.length === 0) return null;
  const one = lines.join(' ');
  const ident = one.match(/^([A-Za-z0-9_]+)\s*:\s*'([^']*)'\s*$/);
  if (ident) return { key: ident[1], value: ident[2] };
  const quoted = one.match(/^'([^']*)'\s*:\s*'([^']*)'\s*$/);
  if (quoted) return { key: quoted[1], value: quoted[2] };
  throw new Error(`Unparsed SYMBOL_MAP entry: ${chunk.slice(0, 120)}`);
}

export function parseSymbolMapBody(body) {
  const chunks = splitTopLevelEntries(body);
  const map = new Map();
  const order = [];
  for (const chunk of chunks) {
    const parsed = parseSymbolMapChunk(chunk);
    if (!parsed) continue;
    if (!map.has(parsed.key)) order.push(parsed.key);
    map.set(parsed.key, parsed.value);
  }
  return { map, order };
}

function formatSymbolMapKey(key) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return key;
  return `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escapeSymbolMapValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function symbolMapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/**
 * Merge upstream SYMBOL_MAP onto local: upstream keys overwrite; local-only keys preserved.
 * Key order: upstream file order, then local-only keys sorted.
 */
export function buildMergedSymbolMap(mapLocal, orderUpstream, mapUpstream) {
  const merged = new Map(mapLocal);
  for (const [k, v] of mapUpstream) merged.set(k, v);
  const localOnly = [...mapLocal.keys()]
    .filter((k) => !mapUpstream.has(k))
    .sort((x, y) => x.localeCompare(y));
  const keyOrder = [...orderUpstream];
  for (const k of localOnly) {
    if (!keyOrder.includes(k)) keyOrder.push(k);
  }
  return { merged, keyOrder };
}

export function formatSymbolMapInnerBody(merged, keyOrder) {
  const lines = [];
  for (const k of keyOrder) {
    if (!merged.has(k)) continue;
    const v = merged.get(k);
    lines.push(`  ${formatSymbolMapKey(k)}: '${escapeSymbolMapValue(v)}',`);
  }
  return lines.join('\n');
}

/**
 * Replace SYMBOL_MAP object body in localContent when merge differs from current map.
 */
export function mergeSymbolMapInContent(localContent, upstreamContent) {
  const lb = findSymbolMapBounds(localContent);
  const ub = findSymbolMapBounds(upstreamContent);
  const localBody = localContent.slice(lb.openIndex + 1, lb.closeIndex);
  const upstreamBody = upstreamContent.slice(ub.openIndex + 1, ub.closeIndex);
  const localParsed = parseSymbolMapBody(localBody);
  const upstreamParsed = parseSymbolMapBody(upstreamBody);
  const { merged, keyOrder } = buildMergedSymbolMap(
    localParsed.map,
    upstreamParsed.order,
    upstreamParsed.map
  );
  if (symbolMapsEqual(merged, localParsed.map)) {
    return { content: localContent, changed: false };
  }
  const inner = formatSymbolMapInnerBody(merged, keyOrder);
  const next = `${localContent.slice(0, lb.openIndex + 1)}\n${inner}\n${localContent.slice(lb.closeIndex)}`;
  return { content: next, changed: true };
}

/**
 * Check: every upstream SYMBOL_MAP entry must match local; local-only keys are warnings.
 */
export function checkSymbolMapAgainstUpstream(localContent, upstreamContent) {
  const lb = findSymbolMapBounds(localContent);
  const ub = findSymbolMapBounds(upstreamContent);
  const localParsed = parseSymbolMapBody(localContent.slice(lb.openIndex + 1, lb.closeIndex));
  const upstreamParsed = parseSymbolMapBody(upstreamContent.slice(ub.openIndex + 1, ub.closeIndex));
  const errors = [];
  for (const [k, v] of upstreamParsed.map) {
    if (!localParsed.map.has(k)) {
      errors.push({ type: 'missing', key: k, upstreamValue: v });
      continue;
    }
    if (localParsed.map.get(k) !== v) {
      errors.push({
        type: 'mismatch',
        key: k,
        localValue: localParsed.map.get(k),
        upstreamValue: v,
      });
    }
  }
  const localOnly = [...localParsed.map.keys()]
    .filter((k) => !upstreamParsed.map.has(k))
    .sort((a, b) => a.localeCompare(b));
  return { errors, localOnlyKeys: localOnly };
}
