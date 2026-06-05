#!/usr/bin/env node
/**
 * Merges aave/interface reservePatches drift into local files:
 * - SYMBOL_MAP (in src/lib/tokenSymbolMap.ts): upstream values win on shared keys; local-only keys preserved (see reserve-patches-symbol-map.mjs).
 * - underlyingAssetMap (in src/ui-config/reservePatches.ts): append upstream entries missing locally (address / expression keys).
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
const LOCAL_TOKEN_SYMBOL_MAP_PATH = path.join(ROOT, 'src/lib/tokenSymbolMap.ts');

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
  const [localReserveContent, upstreamContent, localSymbolMapContent] = await Promise.all([
    readFile(LOCAL_RESERVE_PATCHES_PATH, 'utf8'),
    fetchWithTimeout(UPSTREAM_RESERVE_PATCHES_URL),
    readFile(LOCAL_TOKEN_SYMBOL_MAP_PATH, 'utf8'),
  ]);

  let nextReserveContent = localReserveContent;
  let nextSymbolMapContent = localSymbolMapContent;
  const notes = [];

  const symbolMerge = mergeSymbolMapInContent(nextSymbolMapContent, upstreamContent);
  if (symbolMerge.changed) {
    nextSymbolMapContent = symbolMerge.content;
    notes.push('SYMBOL_MAP merged from upstream (local-only keys preserved)');
  }

  const underlyingMerge = applyUnderlyingAssetMapMerge(nextReserveContent, upstreamContent);
  if (underlyingMerge.changed) {
    nextReserveContent = underlyingMerge.content;
    notes.push(`underlyingAssetMap: added ${underlyingMerge.addedCount} missing entr(y/ies)`);
  }

  if (!symbolMerge.changed && !underlyingMerge.changed) {
    console.log('reservePatches is already aligned (SYMBOL_MAP + underlyingAssetMap).');
    return;
  }

  if (symbolMerge.changed) {
    await writeFile(LOCAL_TOKEN_SYMBOL_MAP_PATH, nextSymbolMapContent, 'utf8');
    console.log('Updated src/lib/tokenSymbolMap.ts');
  }
  if (underlyingMerge.changed) {
    await writeFile(LOCAL_RESERVE_PATCHES_PATH, nextReserveContent, 'utf8');
    console.log('Updated src/ui-config/reservePatches.ts');
  }
  for (const line of notes) {
    console.log(line);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
