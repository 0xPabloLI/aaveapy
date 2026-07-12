#!/usr/bin/env node
/**
 * Merges aave/interface reservePatches drift into local `reservePatches.ts`:
 * - SYMBOL_MAP: upstream values win on shared keys; local-only keys preserved (see reserve-patches-symbol-map.mjs).
 * - underlyingAssetMap: append upstream entries missing locally (address / expression keys).
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout } from './lib/fetch-utils.mjs';
import { mergeSymbolMapInContent } from './lib/reserve-patches-symbol-map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_RESERVE_PATCHES_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatches.ts';
const LOCAL_RESERVE_PATCHES_PATH = path.join(ROOT, 'src/ui-config/reservePatches.ts');

function normalizeExpressionKey(value) {
  return value.replace(/\s+/g, '');
}

function findUnderlyingAssetMapBounds(content) {
  const marker = 'const underlyingAssetMap';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Failed to locate underlyingAssetMap in reservePatches.ts');
  }

  const openIndex = content.indexOf('{', markerIndex);
  if (openIndex < 0) {
    throw new Error('Failed to locate opening brace for underlyingAssetMap');
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
        return { openIndex, closeIndex: i };
      }
    }
  }

  throw new Error('Failed to locate closing brace for underlyingAssetMap');
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

function extractEntryKey(entry) {
  const addressMatch = entry.match(/^['"`](0x[a-fA-F0-9]{40})['"`]\s*:/);
  if (addressMatch) {
    return `addr:${addressMatch[1].toLowerCase()}`;
  }

  const exprMatch = entry.match(/^\[([A-Za-z0-9_.\s]+\.toLowerCase\(\))\]\s*:/);
  if (exprMatch) {
    return `expr:${normalizeExpressionKey(exprMatch[1])}`;
  }

  return null;
}

function alignEntryIndent(entry) {
  const lines = entry.split('\n');
  return lines
    .map((line, index) => {
      if (!line.trim()) return line;
      if (index === 0) return line.replace(/^\s*/, '    ');
      return line;
    })
    .join('\n');
}

/**
 * Extract address-book namespace names (e.g. AaveV3EthereumHorizon) used as
 * computed keys `[Namespace.ASSETS.XXX.UNDERLYING.toLowerCase()]` in the file,
 * and inject missing names into the `@aave-dao/aave-address-book` import.
 */
function injectMissingAddressBookImports(content) {
  // All namespace names referenced in computed keys
  const usedNames = new Set();
  const keyRe = /\[([A-Za-z0-9_]+)\.ASSETS\./g;
  let m;
  while ((m = keyRe.exec(content)) !== null) {
    usedNames.add(m[1]);
  }

  if (usedNames.size === 0) {
    return { content, changed: false, addedNames: [] };
  }

  // Parse existing import (support both @aave-dao and @bgd-labs)
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*['"]@(aave-dao|bgd-labs)\/aave-address-book['"]/m;
  const importMatch = content.match(importRe);
  if (!importMatch) return { content, changed: false, addedNames: [] };

  const existingNames = importMatch[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => n.replace(/\s+as\s+[A-Za-z0-9_]+$/, '').trim())
    .filter(Boolean);

  const missing = [...usedNames].filter((n) => !existingNames.includes(n));
  if (missing.length === 0) {
    return { content, changed: false, addedNames: [] };
  }

  // Rebuild import with new names inserted, always normalize to @aave-dao
  const fullImport = [...existingNames, ...missing].sort().join(',\n  ');
  const newImportStmt = `import {\n  ${fullImport},\n} from '@aave-dao/aave-address-book'`;
  const next = content.slice(0, importMatch.index) + newImportStmt + content.slice(importMatch.index + importMatch[0].length);
  return { content: next, changed: true, addedNames: missing };
}

function applyUnderlyingAssetMapMerge(localContent, upstreamContent) {
  const localBounds = findUnderlyingAssetMapBounds(localContent);
  const upstreamBounds = findUnderlyingAssetMapBounds(upstreamContent);

  const localBody = localContent.slice(localBounds.openIndex + 1, localBounds.closeIndex);
  const upstreamBody = upstreamContent.slice(upstreamBounds.openIndex + 1, upstreamBounds.closeIndex);

  const localEntries = splitTopLevelEntries(localBody);
  const upstreamEntries = splitTopLevelEntries(upstreamBody);

  const localKeys = new Set(localEntries.map(extractEntryKey).filter(Boolean));
  const missingEntries = [];

  for (const entry of upstreamEntries) {
    const key = extractEntryKey(entry);
    if (!key) continue;
    if (localKeys.has(key)) continue;
    missingEntries.push(alignEntryIndent(entry));
  }

  if (missingEntries.length === 0) {
    return { content: localContent, changed: false, addedCount: 0 };
  }

  const insertion = `${missingEntries.join(',\n')},\n`;
  const beforeClose = localContent.slice(0, localBounds.closeIndex);
  const afterClose = localContent.slice(localBounds.closeIndex);
  return {
    content: `${beforeClose}${insertion}${afterClose}`,
    changed: true,
    addedCount: missingEntries.length,
  };
}

async function main() {
  const [localContent, upstreamContent] = await Promise.all([
    readFile(LOCAL_RESERVE_PATCHES_PATH, 'utf8'),
    fetchWithTimeout(UPSTREAM_RESERVE_PATCHES_URL),
  ]);

  let next = localContent;
  const notes = [];

  const symbolMerge = mergeSymbolMapInContent(next, upstreamContent);
  if (symbolMerge.changed) {
    next = symbolMerge.content;
    notes.push('SYMBOL_MAP merged from upstream (local-only keys preserved)');
  }

  const underlyingMerge = applyUnderlyingAssetMapMerge(next, upstreamContent);
  if (underlyingMerge.changed) {
    next = underlyingMerge.content;
    notes.push(`underlyingAssetMap: added ${underlyingMerge.addedCount} missing entr(y/ies)`);
  }

  // Auto-inject any new address-book namespace imports referenced in underlyingAssetMap
  const importUpdate = injectMissingAddressBookImports(next);
  if (importUpdate.changed) {
    next = importUpdate.content;
    notes.push(`address-book import: added ${importUpdate.addedNames.join(', ')}`);
  }

  if (!symbolMerge.changed && !underlyingMerge.changed && !importUpdate.changed) {
    console.log('reservePatches is already aligned (SYMBOL_MAP + underlyingAssetMap).');
    return;
  }

  await writeFile(LOCAL_RESERVE_PATCHES_PATH, next, 'utf8');
  for (const line of notes) {
    console.log(line);
  }
  console.log('Updated src/ui-config/reservePatches.ts');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
