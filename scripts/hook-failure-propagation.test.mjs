#!/usr/bin/env node
/**
 * pre-push must not let a failed gate report success.
 *
 * husky runs the hook as `sh -e .husky/pre-push` (see `.husky/_/h`), so errexit is
 * on — but with a documented exception: a command that fails inside an `&&`/`||` list
 * does *not* trigger errexit unless it is the command after the final `&&`/`||`.
 * That is precisely the shape of the hook's first gate line:
 *
 *     npm run ci:remote && npm run test:e2e:pre-push
 *
 * If `ci:remote` fails, the e2e step is skipped, errexit stays silent, and the hook's
 * exit code comes from the gates that follow — so lint/typecheck/unit/build/audit can
 * all be red and the push still succeeds. Recorded as AAV-1330.
 *
 * These tests run the *real line extracted from the hook file* against a stubbed `npm`
 * instead of restating its shape, so editing the hook cannot silently drop the guard.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookSource = readFileSync(path.join(repoRoot, '.husky/pre-push'), 'utf8');

/**
 * Run a shell snippet under `sh -e` (the same way husky runs hooks) with a stubbed
 * `npm` on PATH. `plan` maps npm's first argument (the run script name) to an exit code.
 */
function runUnderShE(snippet, plan) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hookgate-'));
  const npmPath = path.join(dir, 'npm');
  const arms = Object.entries(plan)
    .map(([script, code]) => `  ${JSON.stringify(script)}) exit ${code} ;;`)
    .join('\n');
  writeFileSync(npmPath, `#!/bin/sh\ncase "$2" in\n${arms}\nesac\nexit 0\n`);
  chmodSync(npmPath, 0o755);
  const res = spawnSync('sh', ['-e', '-c', snippet], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: 'utf8',
  });
  return res.status;
}

/**
 * The real gate line from the hook, ignoring prose that merely mentions it.
 * The hook's header comment contains the string `npm run ci:remote`, so matching on
 * text alone extracts a comment — which runs as a no-op and makes every behavioural
 * assertion below pass vacuously.
 */
function gateLine() {
  const line = hookSource
    .split('\n')
    .map((l) => l.trim())
    .find((l) => !l.startsWith('#') && l.includes('npm run ci:remote'));
  assert.ok(line, 'the ci:remote gate line must exist as an executable statement');
  return line;
}

describe('pre-push failure propagation', () => {
  it('the stubbed npm actually fails ci:remote (harness is not vacuous)', () => {
    const status = runUnderShE('npm run ci:remote\n', { 'ci:remote': 1, 'test:e2e:pre-push': 0 });
    assert.notEqual(status, 0, 'if this is 0 the stub never failed and the assertions below prove nothing');
  });

  it('the hook exists with the gate line this test is written against', () => {
    assert.match(gateLine(), /npm run ci:remote/);
    assert.match(hookSource, /test:e2e:pre-push/, 'the e2e gate must still be chained to it');
  });

  it('no unguarded `&&` chain of npm gates survives in the hook', () => {
    const offenders = hookSource
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => {
        const t = line.trim();
        if (t.startsWith('#') || !t.includes('&&')) return false;
        if (!/npm run /.test(t)) return false;
        // guarded forms are acceptable: `|| { ... exit 1; }` on the same line
        return !/\|\|\s*\{/.test(t) && !/\|\|\s*(exit|echo)/.test(t);
      });
    assert.deepEqual(
      offenders.map(({ n, line }) => `${n}: ${line.trim()}`),
      [],
      'an `A && B` gate line swallows A failure under sh -e; append an explicit `|| { ...; exit 1; }`',
    );
  });

  it('behavior: a failing ci:remote makes the hook exit non-zero (real line, stubbed npm)', () => {
    const status = runUnderShE(`${gateLine()}\necho SURVIVED\n`, {
      'ci:remote': 1,
      'test:e2e:pre-push': 0,
    });
    assert.notEqual(status, 0, `ci:remote failed but the gate returned ${status}`);
  });

  it('behavior control: the OLD unguarded shape really did swallow the failure', () => {
    // Kept as a positive control: if this ever returns non-zero, the shell semantics
    // this guard depends on have changed and the guard above needs rethinking.
    const status = runUnderShE('npm run ci:remote && npm run test:e2e:pre-push\necho SURVIVED\n', {
      'ci:remote': 1,
      'test:e2e:pre-push': 0,
    });
    assert.equal(status, 0, 'unguarded A && B under sh -e must still exit 0 — that is the bug being pinned');
  });

  it('behavior: when both gates pass, the hook gate stays silent (exit 0)', () => {
    const status = runUnderShE(`${gateLine()}\n`, {
      'ci:remote': 0,
      'test:e2e:pre-push': 0,
    });
    assert.equal(status, 0);
  });
});
