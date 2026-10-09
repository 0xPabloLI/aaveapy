#!/usr/bin/env node
/**
 * Contract tests for the e2e failure-artifact archiver.
 *
 * The behaviour being pinned is "evidence survives the next run": Playwright
 * wipes test-results/ on every run, so anything not archived is gone. Rows R2/R3
 * are the positive controls (each marker type alone must be detected); R4 is the
 * negative control that keeps a passing run from archiving junk.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveFailingResults, findFailingResultDirs } from './lib/e2e-artifacts.mjs';

const exists = existsSync;

/** Fresh scratch dir containing a fake `test-results` populated by `layout`. */
function scratch(layout) {
  const root = mkdtempSync(join(tmpdir(), 'e2e-art-'));
  const resultsDir = join(root, 'test-results');
  mkdirSync(resultsDir, { recursive: true });
  for (const [dir, files] of Object.entries(layout)) {
    const full = join(resultsDir, dir);
    mkdirSync(full, { recursive: true });
    for (const f of files) writeFileSync(join(full, f), `${dir}/${f}`);
  }
  return { root, resultsDir, archiveRoot: join(root, 'test-results-archive') };
}

describe('findFailingResultDirs', () => {
  it('R1: a missing results dir yields nothing instead of throwing', () => {
    assert.deepEqual(findFailingResultDirs('/nonexistent/test-results-xyz'), []);
  });

  it('R2: error-context.md alone marks a failing test', () => {
    const { resultsDir } = scratch({ 'wallet-fail': ['error-context.md'] });
    assert.deepEqual(findFailingResultDirs(resultsDir), ['wallet-fail']);
  });

  it('R3: a test-failed-*.png alone also marks it (screenshot without snapshot)', () => {
    const { resultsDir } = scratch({ 'pin-flake': ['test-failed-1.png', 'video.webm'] });
    assert.deepEqual(findFailingResultDirs(resultsDir), ['pin-flake']);
  });

  it('R4: a dir with only trace/video is not treated as failing (negative control)', () => {
    const { resultsDir } = scratch({ 'passed-test': ['trace.zip', 'video.webm'] });
    assert.deepEqual(findFailingResultDirs(resultsDir), []);
  });

  it('R5: results are sorted, so archive output is deterministic', () => {
    const { resultsDir } = scratch({ zz: ['error-context.md'], aa: ['error-context.md'] });
    assert.deepEqual(findFailingResultDirs(resultsDir), ['aa', 'zz']);
  });
});

describe('archiveFailingResults', () => {
  it('R6: nothing failing ⇒ count 0 and no archive directory written', () => {
    const { root, resultsDir, archiveRoot } = scratch({ ok: ['video.webm'] });
    assert.deepEqual(archiveFailingResults({ resultsDir, archiveRoot }), { count: 0, dest: null });
    assert.equal(exists(archiveRoot), false);
    rmSync(root, { recursive: true, force: true });
  });

  it('R7: failing dirs are copied with their contents into the stamped path', () => {
    const { root, resultsDir, archiveRoot } = scratch({
      'wallet-fail': ['error-context.md', 'test-failed-1.png'],
      ok: ['video.webm'],
    });
    const now = new Date('2026-10-09T12:00:00.000Z');
    const res = archiveFailingResults({ resultsDir, archiveRoot, now });
    assert.equal(res.count, 1);
    assert.equal(res.dest, join(archiveRoot, '2026-10-09T12-00-00-000Z'));
    const snapshot = readFileSync(join(res.dest, 'wallet-fail', 'error-context.md'), 'utf8');
    assert.equal(snapshot, 'wallet-fail/error-context.md', 'archived content must be the original evidence');
    assert.equal(exists(join(res.dest, 'wallet-fail', 'test-failed-1.png')), true);
    assert.equal(exists(join(res.dest, 'ok')), false, 'passing dirs must not be archived');
    rmSync(root, { recursive: true, force: true });
  });

  it('R8: two runs at different times do not overwrite each other', () => {
    const { root, resultsDir, archiveRoot } = scratch({ flake: ['error-context.md'] });
    const a = archiveFailingResults({ resultsDir, archiveRoot, now: new Date('2026-10-09T12:00:00.000Z') });
    writeFileSync(join(resultsDir, 'flake', 'extra.txt'), 'second run');
    const b = archiveFailingResults({ resultsDir, archiveRoot, now: new Date('2026-10-09T12:05:00.000Z') });
    assert.notEqual(a.dest, b.dest);
    assert.equal(exists(join(b.dest, 'flake', 'extra.txt')), true);
    assert.equal(exists(join(a.dest, 'flake', 'extra.txt')), false, 'the earlier archive stays as it was captured');
    rmSync(root, { recursive: true, force: true });
  });
});
