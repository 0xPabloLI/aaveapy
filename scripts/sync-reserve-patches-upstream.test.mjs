#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import prettier from 'prettier';
import {
  syncAddressBookImports,
  extractAddressBookReferences,
  parseCurrentAddressBookImports,
  applyUnderlyingAssetMapMerge,
} from './sync-reserve-patches-upstream.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RESERVE_PATCHES_PATH = path.join(ROOT, 'src/ui-config/reservePatches.ts');
// prettier.format() does not read config files on its own — it must be handed the
// resolved options. Passing only `filepath` silently formats with Prettier's
// defaults (double quotes), which would make the format assertions meaningless.
const PRETTIER_OPTIONS = {
  filepath: RESERVE_PATCHES_PATH,
  ...(await prettier.resolveConfig(RESERVE_PATCHES_PATH)),
};

function makeReservePatches(entries, existingImports) {
  const importBlock =
    existingImports ?? `import {\n  AaveV3Ethereum,\n  AaveV3Polygon,\n} from '@aave-dao/aave-address-book';`;
  return `${importBlock}\nimport tokenlist from '@aave-dao/aave-address-book/tokenlist';\n\nconst SYMBOL_NAME_MAP = {};\n\nconst underlyingAssetMap = {\n${entries}\n};\n\nexport { underlyingAssetMap };\n`;
}

describe('extractAddressBookReferences', () => {
  it('extracts AaveV3 references from underlyingAssetMap', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Polygon.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`,
    );
    const refs = extractAddressBookReferences(content);
    assert.ok(refs.has('AaveV3Ethereum'));
    assert.ok(refs.has('AaveV3Polygon'));
  });

  it('extracts AaveV4 references from underlyingAssetMap', () => {
    const content = makeReservePatches(`  [AaveV4Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`);
    const refs = extractAddressBookReferences(content);
    assert.ok(refs.has('AaveV4Ethereum'));
  });

  it('extracts both V3 and V4 references', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`,
    );
    const refs = extractAddressBookReferences(content);
    assert.ok(refs.has('AaveV3Ethereum'));
    assert.ok(refs.has('AaveV4Ethereum'));
  });
});

describe('parseCurrentAddressBookImports', () => {
  it('parses existing imports correctly', () => {
    const content = makeReservePatches('  // empty');
    const result = parseCurrentAddressBookImports(content);
    assert.ok(result.names.has('AaveV3Ethereum'));
    assert.ok(result.names.has('AaveV3Polygon'));
    assert.equal(result.names.size, 2);
  });

  it('returns empty set when no import found', () => {
    const result = parseCurrentAddressBookImports('const x = 1;');
    assert.equal(result.names.size, 0);
    assert.equal(result.fullMatchStart, -1);
  });
});

describe('syncAddressBookImports', () => {
  it('adds missing AaveV3 import', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`,
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV3Arbitrum'));
    assert.ok(result.content.includes('AaveV3Arbitrum'));
  });

  it('adds missing AaveV4 import', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`,
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV4Ethereum'));
    assert.ok(result.content.includes('AaveV4Ethereum'));
  });

  it('returns unchanged when all imports are present', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Polygon.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`,
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, false);
    assert.deepEqual(result.addedImports, []);
  });

  it('sorts all import names alphabetically', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`,
    );
    const result = syncAddressBookImports(content);
    const importMatch = result.content.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]@aave-dao\/aave-address-book['"]/);
    assert.ok(importMatch);
    const names = importMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const sorted = [...names].sort();
    assert.deepEqual(names, sorted);
  });

  it('handles both V3 and V4 missing imports in one pass', () => {
    const content = makeReservePatches(
      `  [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`,
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV3Arbitrum'));
    assert.ok(result.addedImports.includes('AaveV4Ethereum'));
  });
});

// The real file nests the map inside fetchIconSymbolAndName, so its entries sit
// at 4 spaces and the closing brace at 2. A top-level map (closing brace at
// column 0) cannot reproduce the insertion-indent defect, which is why the
// original tests never caught it.
function makeNestedReservePatches(entries) {
  return [
    "import { AaveV3Ethereum } from '@aave-dao/aave-address-book';",
    '',
    'export function fetchIconSymbolAndName() {',
    '  const underlyingAssetMap: Record<string, IconMapInterface> = {',
    entries,
    '  };',
    '',
    '  return underlyingAssetMap;',
    '}',
    '',
  ].join('\n');
}

function makeUpstreamMap(entries) {
  return `const underlyingAssetMap: Record<string, IconMapInterface> = {\n${entries}\n};\n`;
}

const LOCAL_ENTRY = `    '0xaaaa000000000000000000000000000000000001': {\n      name: 'Local',\n      symbol: 'LOC',\n      iconSymbol: 'loc',\n    },`;

function upstreamEntry(address, symbol) {
  return `    '${address}': {\n      symbol: '${symbol}',\n      name: '${symbol}',\n      iconSymbol: '${symbol.toLowerCase()}',\n    },`;
}

describe('applyUnderlyingAssetMapMerge', () => {
  const NEW_ADDRESS = '0xbbbb000000000000000000000000000000000002';
  const SECOND_NEW_ADDRESS = '0xdddd000000000000000000000000000000000004';
  const LOCAL_ONLY_ADDRESS = '0xcccc000000000000000000000000000000000003';

  it('fixture premise: repo Prettier config resolves, and the unmerged fixture is already clean', async () => {
    assert.equal(PRETTIER_OPTIONS.singleQuote, true, 'repo Prettier config must be loaded, not defaults');
    const local = makeNestedReservePatches(LOCAL_ENTRY);
    assert.equal(local, await prettier.format(local, PRETTIER_OPTIONS));
  });

  it('returns unchanged when no upstream entry is missing', () => {
    const local = makeNestedReservePatches(LOCAL_ENTRY);
    const result = applyUnderlyingAssetMapMerge(local, makeUpstreamMap(LOCAL_ENTRY));
    assert.equal(result.changed, false);
    assert.equal(result.addedCount, 0);
    assert.equal(result.content, local);
  });

  it('recognises an upstream entry that differs only by a renamed asset key', () => {
    // Upstream still writes ASSETS.USDC on Arbitrum/Optimism/Polygon while we
    // write ASSETS.USDCe (the address book renamed it in 4.74.0). Appending
    // upstream's copy would put back a key that throws on evaluation, which is
    // how issue #770 kept every Hardcode Sync run red.
    const entry = (asset) =>
      `    [AaveV3Arbitrum.ASSETS.${asset}.UNDERLYING.toLowerCase()]: {\n      name: 'Bridged USDC',\n      symbol: 'USDC.e',\n      iconSymbol: 'USDC',\n    },`;
    const local = makeNestedReservePatches(entry('USDCe'));
    const result = applyUnderlyingAssetMapMerge(local, makeUpstreamMap(entry('USDC')));

    assert.equal(result.changed, false);
    assert.equal(result.addedCount, 0);
    assert.equal(result.content, local);
  });

  it('inserts a missing entry at the map entry indent, not the closing brace indent', () => {
    const local = makeNestedReservePatches(LOCAL_ENTRY);
    const result = applyUnderlyingAssetMapMerge(
      local,
      makeUpstreamMap(`${LOCAL_ENTRY}\n${upstreamEntry(NEW_ADDRESS, 'NEW')}`),
    );

    assert.equal(result.changed, true);
    assert.equal(result.addedCount, 1);
    assert.ok(result.content.includes(`\n    '${NEW_ADDRESS}': {`), 'inserted key line must sit at 4 spaces');
    assert.ok(
      !result.content.includes(`\n      '${NEW_ADDRESS}': {`),
      'inserted key line must not inherit the closing brace indentation',
    );
  });

  it('keeps the closing brace at its original indentation', () => {
    const local = makeNestedReservePatches(LOCAL_ENTRY);
    const result = applyUnderlyingAssetMapMerge(
      local,
      makeUpstreamMap(`${LOCAL_ENTRY}\n${upstreamEntry(NEW_ADDRESS, 'NEW')}`),
    );

    assert.ok(result.content.includes('\n  };'), 'closing brace must stay at 2 spaces');
    assert.ok(!result.content.includes('\n};'), 'closing brace must not fall to column 0');
  });

  it('emits output that already satisfies the repo Prettier config', async () => {
    const local = makeNestedReservePatches(LOCAL_ENTRY);
    const result = applyUnderlyingAssetMapMerge(
      local,
      makeUpstreamMap(`${LOCAL_ENTRY}\n${upstreamEntry(NEW_ADDRESS, 'NEW')}`),
    );

    assert.equal(
      result.content,
      await prettier.format(result.content, PRETTIER_OPTIONS),
      'sync output must be Prettier-clean without a follow-up format pass',
    );
  });

  it('preserves local-only entries and merges several missing entries at once', () => {
    const local = makeNestedReservePatches(`${LOCAL_ENTRY}\n${upstreamEntry(LOCAL_ONLY_ADDRESS, 'KEEP')}`);
    const upstream = makeUpstreamMap(
      `${LOCAL_ENTRY}\n${upstreamEntry(NEW_ADDRESS, 'NEW')}\n${upstreamEntry(SECOND_NEW_ADDRESS, 'NEW2')}`,
    );
    const result = applyUnderlyingAssetMapMerge(local, upstream);

    assert.equal(result.addedCount, 2);
    assert.ok(result.content.includes(LOCAL_ONLY_ADDRESS), 'local-only entry must survive the merge');
    assert.ok(result.content.includes(`\n    '${NEW_ADDRESS}': {`));
    assert.ok(result.content.includes(`\n    '${SECOND_NEW_ADDRESS}': {`));
  });
});
