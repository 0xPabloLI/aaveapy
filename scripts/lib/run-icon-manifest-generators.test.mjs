import assert from 'node:assert/strict';
import path from 'path';

import { describe, it } from 'node:test';

import { runIconManifestGenerators } from './run-icon-manifest-generators.mjs';

describe('runIconManifestGenerators', () => {
  it('runs token then chain manifest generators with the current node executable', () => {
    const calls = [];
    const run = (...args) => {
      calls.push(args);
    };

    runIconManifestGenerators({
      nodeExecutable: '/custom/node',
      rootDir: '/repo',
      run,
    });

    assert.deepEqual(calls[0], [
      '/custom/node',
      [path.join('/repo', 'scripts', 'generate-token-icon-manifest.mjs')],
      { stdio: 'inherit' },
    ]);
    assert.deepEqual(calls[1], [
      '/custom/node',
      [path.join('/repo', 'scripts', 'generate-chain-icon-manifest.mjs')],
      { stdio: 'inherit' },
    ]);
    const calledPaths = calls.map(([, args]) => args[0]).filter((p) => typeof p === 'string');
    for (const expectedPath of [
      path.join('/repo', 'scripts', 'generate-token-icon-manifest.mjs'),
      path.join('/repo', 'scripts', 'generate-chain-icon-manifest.mjs'),
      path.join('/repo', 'scripts', 'generate-explorer-icon-manifest.mjs'),
      path.join('/repo', 'scripts', 'generate-pt-icon-fallback.mjs'),
    ]) {
      assert.ok(calledPaths.includes(expectedPath), `expected the generators to run ${expectedPath}`);
    }
    assert.equal(calls.length, 4);
  });
});
