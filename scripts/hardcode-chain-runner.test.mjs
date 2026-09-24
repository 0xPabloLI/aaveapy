#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, extractNpmScriptNames, formatGithubOutput, runChain } from './hardcode-chain-runner.mjs';

describe('aggregate', () => {
  it('all clean → exit 0, no gaps, no criticals', () => {
    const r = aggregate([
      { command: 'a', code: 0 },
      { command: 'b', code: 0 },
    ]);
    assert.equal(r.exitCode, 0);
    assert.deepEqual(r.gaps, []);
    assert.deepEqual(r.criticals, []);
  });

  it('gap-only (code 2) → exit 0 with gaps listed', () => {
    const r = aggregate([
      { command: 'a', code: 0 },
      { command: 'b', code: 2 },
    ]);
    assert.equal(r.exitCode, 0);
    assert.deepEqual(r.gaps, [{ command: 'b', code: 2 }]);
    assert.deepEqual(r.criticals, []);
  });

  it('critical (code 1) → exit 1', () => {
    const r = aggregate([
      { command: 'a', code: 0 },
      { command: 'b', code: 1 },
    ]);
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.criticals, [{ command: 'b', code: 1 }]);
  });

  it('critical wins over gap but gaps are still reported', () => {
    const r = aggregate([
      { command: 'a', code: 2 },
      { command: 'b', code: 1 },
    ]);
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.gaps, [{ command: 'a', code: 2 }]);
    assert.deepEqual(r.criticals, [{ command: 'b', code: 1 }]);
  });

  it('unknown exit code (e.g. 137) is critical (fail-closed)', () => {
    const r = aggregate([{ command: 'a', code: 137 }]);
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.criticals, [{ command: 'a', code: 137 }]);
  });

  it('null code (signal kill) is critical (fail-closed)', () => {
    const r = aggregate([{ command: 'a', code: null }]);
    assert.equal(r.exitCode, 1);
  });
});

describe('extractNpmScriptNames', () => {
  it('extracts names from npm run commands including -- passthrough', () => {
    assert.deepEqual(
      extractNpmScriptNames([
        'npm run check:hardcode-icons',
        'npm run sync-token-icons -- --check',
        'node scripts/generate-icon-manifests.mjs',
      ]),
      ['check:hardcode-icons', 'sync-token-icons'],
    );
  });
});

describe('runChain', () => {
  const chains = {
    alpha: ['npm run exists-a', 'npm run exists-b', 'node scripts/direct.mjs'],
  };
  const scripts = { 'exists-a': 'x', 'exists-b': 'y' };

  function fakeSpawn(codes) {
    let i = 0;
    const calls = [];
    return {
      calls,
      impl: async (command) => {
        calls.push(command);
        return { code: codes[i++] ?? 0 };
      },
    };
  }

  it('runs all commands to completion (no short-circuit) and returns exit 0 when clean', async () => {
    const { calls, impl } = fakeSpawn([0, 0, 0]);
    const r = await runChain({ chainName: 'alpha', chains, scripts, spawnImpl: impl, log: () => {} });
    assert.deepEqual(calls, chains.alpha);
    assert.equal(r.exitCode, 0);
  });

  it('does not short-circuit on mid-chain failure; later steps still run', async () => {
    const { calls, impl } = fakeSpawn([0, 1, 2]);
    const r = await runChain({ chainName: 'alpha', chains, scripts, spawnImpl: impl, log: () => {} });
    assert.deepEqual(calls, chains.alpha);
    assert.equal(r.exitCode, 1);
    assert.equal(r.gaps.length, 1);
    assert.equal(r.criticals.length, 1);
  });

  it('gap-only chain exits 0', async () => {
    const { impl } = fakeSpawn([0, 2, 0]);
    const r = await runChain({ chainName: 'alpha', chains, scripts, spawnImpl: impl, log: () => {} });
    assert.equal(r.exitCode, 0);
    assert.equal(r.gaps.length, 1);
  });

  it('fails fast with exit 1 when a listed npm script does not exist in package.json', async () => {
    const { calls, impl } = fakeSpawn([]);
    const r = await runChain({
      chainName: 'alpha',
      chains,
      scripts: { 'exists-a': 'x' }, // exists-b missing
      spawnImpl: impl,
      log: () => {},
    });
    assert.equal(r.exitCode, 1);
    assert.deepEqual(calls, []); // guard fires before any spawn
    assert.match(r.errors.join('\n'), /exists-b/);
  });

  it('rejects unknown chain name', async () => {
    await assert.rejects(
      runChain({ chainName: 'nope', chains, scripts, spawnImpl: async () => ({ code: 0 }), log: () => {} }),
      /unknown/i,
    );
  });

  it('writes has_gaps=true and heredoc gap_summary to github output file on gaps', async () => {
    const { impl } = fakeSpawn([2]);
    const writes = [];
    const r = await runChain({
      chainName: 'alpha',
      chains: { alpha: ['npm run exists-a'] },
      scripts,
      spawnImpl: impl,
      log: () => {},
      githubOutputPath: '/tmp/fake-output',
      appendFileImpl: async (path, content) => {
        writes.push({ path, content });
      },
    });
    assert.equal(r.exitCode, 0);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].path, '/tmp/fake-output');
    assert.match(writes[0].content, /^has_gaps=true\n/);
    assert.match(writes[0].content, /gap_summary<<EOF\n/);
    assert.match(writes[0].content, /npm run exists-a \(exit 2\)\n/);
    assert.match(writes[0].content, /\nEOF\n/);
  });

  it('writes has_gaps=false when clean', async () => {
    const { impl } = fakeSpawn([0]);
    const writes = [];
    await runChain({
      chainName: 'alpha',
      chains: { alpha: ['npm run exists-a'] },
      scripts,
      spawnImpl: impl,
      log: () => {},
      githubOutputPath: '/tmp/fake-output',
      appendFileImpl: async (path, content) => {
        writes.push({ path, content });
      },
    });
    assert.match(writes[0].content, /^has_gaps=false\n/);
    assert.doesNotMatch(writes[0].content, /gap_summary/);
  });

  it('skips github output write when path not provided (local run)', async () => {
    const { impl } = fakeSpawn([2]);
    const r = await runChain({
      chainName: 'alpha',
      chains: { alpha: ['npm run exists-a'] },
      scripts,
      spawnImpl: impl,
      log: () => {},
      appendFileImpl: async () => {
        throw new Error('should not write');
      },
    });
    assert.equal(r.exitCode, 0);
  });
});

describe('formatGithubOutput', () => {
  it('multi-line gap summary uses heredoc EOF format', () => {
    const out = formatGithubOutput({
      hasGaps: true,
      gaps: [
        { command: 'npm run check:a', code: 2 },
        { command: 'npm run check:b', code: 2 },
      ],
    });
    assert.equal(out, 'has_gaps=true\ngap_summary<<EOF\nnpm run check:a (exit 2)\nnpm run check:b (exit 2)\nEOF\n');
  });

  it('clean run emits only has_gaps=false', () => {
    const out = formatGithubOutput({ hasGaps: false, gaps: [] });
    assert.equal(out, 'has_gaps=false\n');
  });
});
