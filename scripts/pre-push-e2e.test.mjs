#!/usr/bin/env node
/**
 * A gate that cannot run must not report success.
 *
 * `scripts/pre-push-e2e.mjs` used to print one ⚠️ line and `process.exit(0)` when
 * Playwright's chromium was missing — exit code 0 means "the e2e gate passed", so
 * `.husky/pre-push` carried on through osv/semgrep/knip/dup and could finish all
 * green with zero browser tests run. e2e is not a required check on any branch, so
 * that combination allowed a `lovable → dev` merge with no e2e evidence at all.
 * Recorded as AAV-1349.
 *
 * These tests run the **real script** in a child process (not a reimplementation of
 * its logic) and point `PLAYWRIGHT_BROWSERS_PATH` at throwaway directories, so the
 * "missing browser" path is exercised without touching the developer's cache. The
 * "browser present" case stubs `npx` on PATH to prove Playwright is actually
 * invoked — and to keep the suite from launching a browser.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { isSkipRequested, hasChromiumBrowser, decideBrowserGate } from './lib/e2e-browser-gate.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts/pre-push-e2e.mjs');

const scratchDirs = [];
function scratch(prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

/** A browser cache directory containing exactly `entries` (files or dirs). */
function fakeBrowserCache(entries) {
  const dir = scratch('pw-browsers-');
  for (const entry of entries) mkdirSync(path.join(dir, entry), { recursive: true });
  return dir;
}

function childEnv(overrides = {}) {
  const env = { ...process.env };
  // Never inherit the caller's opt-out or real browser cache: both would make the
  // assertions below depend on whoever runs the suite.
  delete env.E2E_SKIP;
  delete env.PLAYWRIGHT_BROWSERS_PATH;
  return { ...env, ...overrides };
}

/** stdout + stderr: the gate writes failures to stderr and skips/passes to stdout. */
const output = (result) => `${result.stdout}${result.stderr}`;

function runGate(overrides = {}, { cwd = repoRoot } = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: childEnv(overrides),
    encoding: 'utf8',
  });
}

/**
 * Stub `npx` that records its argv and prints what Playwright prints on a clean run.
 * Keeping it a shell script means the real `spawn('npx', …)` path is exercised.
 */
function stubNpx() {
  const dir = scratch('pw-npx-');
  const logPath = path.join(dir, 'argv.log');
  const npxPath = path.join(dir, 'npx');
  writeFileSync(
    npxPath,
    `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(logPath)}\necho ''\necho '  1 passed (2.0s)'\nexit 0\n`,
  );
  chmodSync(npxPath, 0o755);
  return { binDir: dir, logPath };
}

describe('pre-push e2e browser gate — pure decisions', () => {
  it('T-S2: a cache directory without chromium* is not "browsers present"', () => {
    assert.equal(hasChromiumBrowser(['ffmpeg-1011']), false);
    assert.equal(hasChromiumBrowser([]), false);
    assert.equal(
      decideBrowserGate({
        browsersPath: '/some/cache',
        cacheExists: true,
        entries: ['ffmpeg-1011'],
        skipRequested: false,
      }).action,
      'block',
    );
  });

  it('T-S6: a headless-shell-only install still counts (PW >= 1.49 runs headless via the shell)', () => {
    assert.equal(hasChromiumBrowser(['chromium_headless_shell-1234']), true);
    assert.equal(hasChromiumBrowser(['chromium-1234']), true);
  });

  it('T-S7: PLAYWRIGHT_BROWSERS_PATH=0 (browsers inside node_modules) is not "missing"', () => {
    const decision = decideBrowserGate({
      browsersPath: '0',
      cacheExists: false,
      entries: [],
      skipRequested: false,
    });
    assert.equal(decision.action, 'run', 'a legitimate install mode must not become a new false red');
  });

  it('T-S4: opt-out only accepts an explicit 1/true — 0, empty and other values keep the gate on', () => {
    assert.equal(isSkipRequested({ E2E_SKIP: '1' }), true);
    assert.equal(isSkipRequested({ E2E_SKIP: 'true' }), true);
    assert.equal(isSkipRequested({ E2E_SKIP: ' TRUE ' }), true);
    assert.equal(isSkipRequested({ E2E_SKIP: '0' }), false);
    assert.equal(isSkipRequested({ E2E_SKIP: '' }), false);
    assert.equal(isSkipRequested({ E2E_SKIP: 'yes' }), false);
    assert.equal(isSkipRequested({}), false);
  });

  it('explicit opt-out wins even when browsers exist', () => {
    const decision = decideBrowserGate({
      browsersPath: '/some/cache',
      cacheExists: true,
      entries: ['chromium-1234'],
      skipRequested: true,
    });
    assert.equal(decision.action, 'skip');
  });
});

describe('pre-push e2e browser gate — real script', () => {
  let emptyCache;
  let cacheWithChromiumOnly;
  let cacheWithShellOnly;

  before(() => {
    emptyCache = scratch('pw-empty-');
    cacheWithChromiumOnly = fakeBrowserCache(['chromium-1234']);
    cacheWithShellOnly = fakeBrowserCache(['chromium_headless_shell-1234']);
  });

  after(() => {
    for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('T-S1: missing browser cache blocks the push instead of passing it', () => {
    const result = runGate({ PLAYWRIGHT_BROWSERS_PATH: emptyCache });
    assert.notEqual(result.status, 0, 'a gate that ran zero tests must not exit 0');
    assert.match(output(result), /BLOCKED/);
    assert.match(output(result), /npx playwright install chromium/, 'the block must carry an executable fix');
    assert.match(output(result), /E2E_SKIP=1/, 'the deliberate skip must be discoverable from the failure');
    assert.doesNotMatch(output(result), /e2e tests passed/, 'no success banner on the blocked path');
  });

  it('T-S1b: a non-existent cache path blocks too', () => {
    const result = runGate({ PLAYWRIGHT_BROWSERS_PATH: path.join(emptyCache, 'does-not-exist') });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /BLOCKED/);
  });

  it('T-S2b: a cache with only ffmpeg blocks (directory existence is not the test)', () => {
    const result = runGate({ PLAYWRIGHT_BROWSERS_PATH: fakeBrowserCache(['ffmpeg-1011']) });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /BLOCKED/);
  });

  it('T-S3: E2E_SKIP=1 allows the push but says loudly that no e2e evidence exists', () => {
    const result = runGate({ PLAYWRIGHT_BROWSERS_PATH: emptyCache, E2E_SKIP: '1' });
    assert.equal(result.status, 0);
    assert.match(output(result), /SKIPPED by explicit opt-out/);
    assert.match(output(result), /no e2e evidence/i);
    assert.match(output(result), /npx playwright install chromium/);
  });

  it('T-S3b: E2E_SKIP=0 is not an opt-out', () => {
    const result = runGate({ PLAYWRIGHT_BROWSERS_PATH: emptyCache, E2E_SKIP: '0' });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /BLOCKED/);
  });

  it('T-S5: with chromium present the gate really runs Playwright and reports its verdict', () => {
    const { binDir, logPath } = stubNpx();
    const result = runGate({
      PLAYWRIGHT_BROWSERS_PATH: cacheWithChromiumOnly,
      PATH: `${binDir}:${process.env.PATH}`,
    });
    assert.equal(result.status, 0, `expected a clean run, got:\n${result.stdout}\n${result.stderr}`);
    assert.ok(existsSync(logPath), 'Playwright was never invoked — the gate silently skipped a runnable suite');
    const argv = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    assert.ok(argv.includes('test'), `unexpected playwright argv: ${argv.join(' ')}`);
    assert.ok(argv.includes('--project=chromium'), `unexpected playwright argv: ${argv.join(' ')}`);
    assert.match(output(result), /e2e tests passed/);
  });

  it('T-S6b: headless-shell-only installs run instead of blocking', () => {
    const { binDir } = stubNpx();
    const result = runGate({
      PLAYWRIGHT_BROWSERS_PATH: cacheWithShellOnly,
      PATH: `${binDir}:${process.env.PATH}`,
    });
    assert.equal(result.status, 0, `expected a clean run, got:\n${result.stdout}\n${result.stderr}`);
    assert.match(output(result), /e2e tests passed/);
  });

  it('T-S8: a real Playwright failure still fails the gate (existing contract untouched)', () => {
    const { binDir } = stubNpx();
    const failing = path.join(binDir, 'npx');
    writeFileSync(failing, '#!/bin/sh\necho ""\necho "  2 failed"\nexit 1\n');
    chmodSync(failing, 0o755);
    // Run from a scratch cwd: the failure path archives `test-results/`, and a test
    // must not leave (or copy) artifacts inside the repository.
    const result = runGate(
      {
        PLAYWRIGHT_BROWSERS_PATH: cacheWithChromiumOnly,
        PATH: `${binDir}:${process.env.PATH}`,
      },
      { cwd: scratch('pw-cwd-') },
    );
    assert.notEqual(result.status, 0);
    assert.match(output(result), /2 test\(s\) failed after retry/);
  });
});
