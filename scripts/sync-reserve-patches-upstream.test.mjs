#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncAddressBookImports,
  extractAddressBookReferences,
  parseCurrentAddressBookImports,
} from './sync-reserve-patches-upstream.mjs';

function makeReservePatches(entries, existingImports) {
  const importBlock =
    existingImports ??
    `import {\n  AaveV3Ethereum,\n  AaveV3Polygon,\n} from '@aave-dao/aave-address-book';`;
  return `${importBlock}\nimport tokenlist from '@aave-dao/aave-address-book/tokenlist';\n\nconst SYMBOL_NAME_MAP = {};\n\nconst underlyingAssetMap = {\n${entries}\n};\n\nexport { underlyingAssetMap };\n`;
}

describe('extractAddressBookReferences', () => {
  it('extracts AaveV3 references from underlyingAssetMap', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Polygon.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`
    );
    const refs = extractAddressBookReferences(content);
    assert.ok(refs.has('AaveV3Ethereum'));
    assert.ok(refs.has('AaveV3Polygon'));
  });

  it('extracts AaveV4 references from underlyingAssetMap', () => {
    const content = makeReservePatches(
      `  [AaveV4Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`
    );
    const refs = extractAddressBookReferences(content);
    assert.ok(refs.has('AaveV4Ethereum'));
  });

  it('extracts both V3 and V4 references', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`
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
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV3Arbitrum'));
    assert.ok(result.content.includes('AaveV3Arbitrum'));
  });

  it('adds missing AaveV4 import', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV4Ethereum'));
    assert.ok(result.content.includes('AaveV4Ethereum'));
  });

  it('returns unchanged when all imports are present', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV3Polygon.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},`
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, false);
    assert.deepEqual(result.addedImports, []);
  });

  it('sorts all import names alphabetically', () => {
    const content = makeReservePatches(
      `  [AaveV3Ethereum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`
    );
    const result = syncAddressBookImports(content);
    const importMatch = result.content.match(
      /import\s*\{([\s\S]*?)\}\s*from\s*['"]@aave-dao\/aave-address-book['"]/
    );
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
      `  [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]: {},\n  [AaveV4Ethereum.ASSETS.GHO.UNDERLYING.toLowerCase()]: {},`
    );
    const result = syncAddressBookImports(content);
    assert.equal(result.changed, true);
    assert.ok(result.addedImports.includes('AaveV3Arbitrum'));
    assert.ok(result.addedImports.includes('AaveV4Ethereum'));
  });
});
