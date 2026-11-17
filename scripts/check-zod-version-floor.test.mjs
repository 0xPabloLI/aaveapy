import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ZOD_FLOOR,
  KNOWN_ZOD3_DECLARERS,
  compareVersions,
  rangeAllowsAtOrAbove,
  evaluateLockfile,
  formatReport,
} from './check-zod-version-floor.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal package-lock shape: only the `packages` map matters to the guard. */
function lockfile(packages) {
  return { lockfileVersion: 3, packages };
}

function fixture() {
  return {
    '': { name: 'aaveapy', dependencies: { zod: '^4.6.6' } },
    'node_modules/zod': { version: '4.6.7' },
    'node_modules/@reown/appkit-wallet': {
      version: '1.8.19',
      dependencies: { zod: '3.22.4' },
    },
    'node_modules/@coinbase/cdp-sdk': {
      version: '1.56.0',
      dependencies: { zod: '^3.25.76' },
    },
    'node_modules/openapi-zod-client': {
      version: '1.18.3',
      dependencies: { zod: '^3.19.1' },
    },
    'node_modules/@zodios/core': {
      version: '10.9.6',
      peerDependencies: { zod: '^3.x' },
    },
  };
}

// --- version comparison -----------------------------------------------------

test('compareVersions orders numeric segments and ignores a leading v', () => {
  assert.equal(compareVersions('4.6.6', '4.6.6'), 0);
  assert.equal(compareVersions('v4.6.6', '4.6.6'), 0);
  assert.equal(compareVersions('4.6.5', '4.6.6'), -1);
  assert.equal(compareVersions('4.6.7', '4.6.6'), 1);
  assert.equal(compareVersions('4.10.0', '4.6.6'), 1);
  assert.equal(compareVersions('5.0.0', '4.6.6'), 1);
  assert.equal(compareVersions('3.99.99', '4.6.6'), -1);
});

// --- range satisfaction at the floor ---------------------------------------

test('rangeAllowsAtOrAbove answers "can this range install a version >= 4.6.6"', () => {
  const cases = [
    ['4.6.6', true],
    ['4.6.7', true],
    ['4.6.5', false],
    ['3.22.4', false],
    ['^3.22.4', false],
    ['~3.25.76', false],
    ['^3.19.1', false],
    ['^4.6.6', true],
    ['^4.2.0', true],
    ['>=3', true],
    ['>=4.6.6', true],
    ['>=4.7', true],
    ['>4.7', true],
    ['<4.6.6', false],
    ['<5', true],
    ['>=3 <4', false],
    ['>=3.22.0 <4.7', true],
    ['*', true],
    ['x', true],
    ['latest', true],
    ['3.22.0 - 3.25.0', false],
    ['3.22.0 - 4.7.0', true],
    // real-world shape: abitype 1.2.3's nested peer range under cdp-sdk
    ['^3 >=3.22.0', false],
  ];
  for (const [range, expected] of cases) {
    assert.equal(
      rangeAllowsAtOrAbove(range, ZOD_FLOOR),
      expected,
      `range ${range} should ${expected ? 'allow' : 'reject'} a version >= ${ZOD_FLOOR}`,
    );
  }
});

test('rangeAllowsAtOrAbove fails closed on an unrecognised range', () => {
  assert.equal(rangeAllowsAtOrAbove('workspace:*', ZOD_FLOOR), false);
  assert.equal(rangeAllowsAtOrAbove('npm:zod@^3.22.0', ZOD_FLOOR), false);
});

// --- installed copies -------------------------------------------------------

test('Z1: a nested zod below the floor is reported with its path', () => {
  const packages = fixture();
  packages['node_modules/@coinbase/cdp-sdk/node_modules/zod'] = { version: '3.25.76' };
  packages['node_modules/@reown/appkit-wallet/node_modules/zod'] = { version: '3.22.4' };

  const result = evaluateLockfile(lockfile(packages));

  assert.deepEqual(result.belowFloor.map((entry) => entry.path).sort(), [
    'node_modules/@coinbase/cdp-sdk/node_modules/zod',
    'node_modules/@reown/appkit-wallet/node_modules/zod',
  ]);
  assert.equal(result.belowFloor.length, 2);
  for (const entry of result.belowFloor) assert.match(entry.version, /^3\./);
});

test('Z2: a single hoisted zod above the floor passes', () => {
  const result = evaluateLockfile(lockfile(fixture()));
  assert.deepEqual(result.belowFloor, []);
  assert.deepEqual(result.undeclared, []);
  assert.deepEqual(result.staleAllowlist, []);
});

// --- declarers --------------------------------------------------------------

test('Z3: a new package that declares a zod-3 range must be registered', () => {
  const packages = fixture();
  packages['node_modules/@new/wallet'] = {
    version: '0.1.0',
    dependencies: { zod: '^3.22.0' },
  };

  const result = evaluateLockfile(lockfile(packages));

  assert.equal(result.undeclared.length, 1);
  assert.equal(result.undeclared[0].name, '@new/wallet');
  assert.equal(result.undeclared[0].range, '^3.22.0');
});

test('Z4: declarers whose range can satisfy the floor are not reported', () => {
  const packages = fixture();
  packages['node_modules/some-lib'] = { version: '1.0.0', dependencies: { zod: '>=3' } };
  packages['node_modules/other-lib'] = { version: '1.0.0', peerDependencies: { zod: '^4.6.6' } };

  const result = evaluateLockfile(lockfile(packages));
  assert.deepEqual(result.undeclared, []);
});

test('Z4b: peer-only zod-3 declaration is still a declaration', () => {
  const packages = fixture();
  packages['node_modules/peer-lib'] = { version: '1.0.0', peerDependencies: { zod: '^3.25.0' } };

  const result = evaluateLockfile(lockfile(packages));
  assert.equal(result.undeclared.length, 1);
  assert.equal(result.undeclared[0].name, 'peer-lib');
});

test('optional peer zod declarations are skipped (abitype-style)', () => {
  const packages = fixture();
  packages['node_modules/abitype'] = {
    version: '1.2.3',
    peerDependencies: { zod: '^3.22.0 || ^4.0.0' },
    peerDependenciesMeta: { zod: { optional: true } },
  };
  packages['node_modules/optional-peer-lib'] = {
    version: '0.1.0',
    peerDependencies: { zod: '^3.25.0' },
    peerDependenciesMeta: { zod: { optional: true } },
  };

  const result = evaluateLockfile(lockfile(packages));
  assert.deepEqual(result.undeclared, []);
});

test('Z6: an allowlist entry with no declarer left in the tree is stale', () => {
  const packages = fixture();
  delete packages['node_modules/openapi-zod-client'];

  const result = evaluateLockfile(lockfile(packages));
  assert.deepEqual(result.staleAllowlist, ['openapi-zod-client']);
});

test('allowlist is an exact set, not a prefix match', () => {
  const packages = fixture();
  const entries = KNOWN_ZOD3_DECLARERS.map((entry) => entry.name);
  assert.deepEqual(entries.sort(), ['@coinbase/cdp-sdk', '@reown/appkit-wallet', '@zodios/core', 'openapi-zod-client']);

  const result = evaluateLockfile(lockfile(packages));
  assert.deepEqual(result.undeclared, []);
  assert.deepEqual(result.staleAllowlist, []);
});

// --- report text ------------------------------------------------------------

test('formatReport names every violation and stays silent when clean', () => {
  const clean = evaluateLockfile(lockfile(fixture()));
  assert.equal(formatReport(clean), '');

  const dirty = evaluateLockfile(
    lockfile({
      '': { name: 'aaveapy', dependencies: { zod: '^4.6.6' } },
      'node_modules/zod': { version: '4.6.7' },
      'node_modules/bad/node_modules/zod': { version: '3.22.4' },
      'node_modules/bad': { version: '1.0.0', dependencies: { zod: '3.22.4' } },
    }),
  );
  const text = formatReport(dirty);
  assert.match(text, /3\.22\.4/);
  assert.match(text, /node_modules\/bad\/node_modules\/zod/);
  assert.match(text, /bad/);
});

test('a lockfile without a packages map fails closed instead of looking clean', () => {
  const result = evaluateLockfile({ lockfileVersion: 1, dependencies: {} });
  assert.equal(result.unreadable, true);
  assert.match(formatReport(result), /cannot verify the zod floor/);
});

// --- the repository itself --------------------------------------------------

test('Z1 (integration): the committed lockfile has no zod below the floor', () => {
  const lockfile = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf8'));
  const result = evaluateLockfile(lockfile);

  assert.deepEqual(result.belowFloor, [], 'installed zod copies must be >= 4.6.6');
  assert.deepEqual(result.undeclared, [], 'every zod-3 declarer must be on the allowlist');
  assert.deepEqual(result.staleAllowlist, [], 'every allowlist entry must still have a declarer');
});
