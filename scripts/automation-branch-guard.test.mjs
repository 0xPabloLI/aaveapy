#!/usr/bin/env node
/**
 * Automated-PR workflows must not target a branch that is not an active release branch.
 *
 * `lovable` was retired on 2026-11-12 but the branch still exists, so "removed from the
 * schedule matrix" and "removed from `workflow_run.branches`" were both incomplete:
 * each workflow also has a manual dispatch path that takes a branch as free-form text
 * and never consulted those lists. Dispatched at `lovable`, they would check out the
 * archived branch, open a PR against it, and — for the remediation workflow — approve
 * that PR and enable auto-merge.
 *
 * These tests run the *real guard extracted from each workflow file* rather than
 * restating its shape, so editing a workflow cannot silently drop the check. The
 * extraction asserts the script is non-empty, because a guard that fails to extract
 * would otherwise make every behavioural assertion below pass vacuously.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function workflowSource(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

/** Lines of a step, from its `- name:` line up to the next sibling step. */
function stepBlock(source, stepName) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  assert.ok(start !== -1, `step "${stepName}" must exist`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^ {6}- /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

/** The body of a step's `run: |` block, dedented. */
function runScript(source, stepName) {
  const block = stepBlock(source, stepName);
  const runIdx = block.findIndex((l) => l.trim() === 'run: |');
  assert.ok(runIdx !== -1, `step "${stepName}" must use a \`run: |\` block`);
  const out = [];
  for (let i = runIdx + 1; i < block.length; i += 1) {
    const line = block[i];
    if (line.trim() === '') {
      out.push('');
      continue;
    }
    const indent = line.match(/^ */)[0].length;
    if (indent <= 8) break;
    out.push(line.slice(10));
  }
  return out.join('\n');
}

/** Step names of a workflow's single job, in order. */
function stepNames(source) {
  return source
    .split('\n')
    .filter((l) => /^ {6}- name: /.test(l))
    .map((l) => l.trim().replace('- name: ', ''));
}

/** Run a `run:` block the way GitHub does on ubuntu-latest: `bash -e {0}`. */
function runStep(script, env) {
  const dir = mkdtempSync(path.join(tmpdir(), 'branchguard-'));
  const githubOutput = path.join(dir, 'github_output');
  const res = spawnSync('bash', ['-e', '-c', script], {
    env: { ...process.env, ...env, GITHUB_OUTPUT: githubOutput },
    encoding: 'utf8',
  });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    output: existsSync(githubOutput) ? readFileSync(githubOutput, 'utf8') : '',
  };
}

/**
 * Assert a step's shell script never contains the workflow expression language.
 * Only the `run:` block is inspected — the `env:` lines above it are exactly where
 * `${{ }}` belongs.
 */
function assertNoShellInterpolation(source, stepName) {
  const script = runScript(source, stepName);
  assert.ok(script.trim().length > 0, `step "${stepName}" must have a non-empty script`);
  assert.doesNotMatch(
    script,
    /\$\{\{/,
    `step "${stepName}" must pass values through env:, not interpolate them into the script`,
  );
}

const ACTIVE = ['dev', 'main'];

describe('token-icon-sync refuses a retired target branch', () => {
  const relPath = '.github/workflows/token-icon-sync.yml';
  const source = workflowSource(relPath);
  const GUARD = 'Validate target branch';
  const guardScript = runScript(source, GUARD);

  it('extracts a real guard (non-empty, contains a case statement)', () => {
    assert.ok(guardScript.trim().length > 0, 'extracted guard must not be empty');
    assert.match(guardScript, /\bcase\b/, 'guard must branch on the target branch');
  });

  it('runs before anything is fetched, installed or pushed', () => {
    const steps = stepNames(source);
    assert.equal(steps[0], GUARD, 'the guard must be the first step of the job');
    for (const later of ['Checkout', 'Install dependencies', 'Sync token icons']) {
      assert.ok(steps.indexOf(later) > 0, `${later} must come after the guard`);
    }
  });

  it('accepts the active branches and rejects everything else', () => {
    for (const branch of ACTIVE) {
      assert.equal(
        runStep(guardScript, { TARGET_BRANCH: branch }).status,
        0,
        `TARGET_BRANCH=${branch} must be accepted`,
      );
    }
    for (const branch of ['lovable', 'staging', 'production', 'develop', 'DEV', 'dev ', '../main', '']) {
      assert.notEqual(
        runStep(guardScript, { TARGET_BRANCH: branch }).status,
        0,
        `TARGET_BRANCH=${JSON.stringify(branch)} must be rejected`,
      );
    }
  });

  it('says why lovable is rejected, rather than just that it is unknown', () => {
    const { stdout, stderr } = runStep(guardScript, { TARGET_BRANCH: 'lovable' });
    assert.match(`${stdout}${stderr}`, /lovable was retired/);
  });

  it('does not evaluate the branch value as shell code', () => {
    const canary = path.join(mkdtempSync(path.join(tmpdir(), 'canary-')), 'pwned');
    const { status } = runStep(guardScript, { TARGET_BRANCH: `$(touch ${canary})` });
    assert.notEqual(status, 0, 'a command-substitution payload must not be accepted');
    assert.ok(!existsSync(canary), 'the payload must not have been executed');
  });

  it('restricts the manual dispatch input to the active branches', () => {
    assert.deepEqual(choiceOptions(source, 'target_branch'), ACTIVE);
  });
});

describe('ci-auto-remediation refuses a retired target branch', () => {
  const relPath = '.github/workflows/ci-auto-remediation.yml';
  const source = workflowSource(relPath);
  const RESOLVE = 'Resolve and validate target branch';
  const resolveScript = runScript(source, RESOLVE);

  it('extracts a real guard (non-empty, contains a case statement)', () => {
    assert.ok(resolveScript.trim().length > 0, 'extracted script must not be empty');
    assert.match(resolveScript, /\bcase\b/, 'the step must validate before emitting');
  });

  it('validates before checkout, the PR base, and the auto-approve', () => {
    const steps = stepNames(source);
    const guard = steps.indexOf(RESOLVE);
    assert.ok(guard !== -1, 'the resolve step must exist');
    for (const later of ['Checkout target branch', 'Create remediation PR']) {
      assert.ok(
        steps.indexOf(later) > guard,
        `${later} must come after the guard, otherwise the branch escapes unvalidated`,
      );
    }
  });

  it('accepts the active branches on the manual path', () => {
    for (const branch of ACTIVE) {
      const { status, output } = runStep(resolveScript, {
        EVENT_NAME: 'workflow_dispatch',
        DISPATCH_BRANCH: branch,
      });
      assert.equal(status, 0, `dispatching with ${branch} must be accepted`);
      assert.equal(output, `name=${branch}\n`, 'the validated branch must be emitted');
    }
  });

  it('rejects lovable on the manual path without emitting it', () => {
    const { status, stdout, stderr, output } = runStep(resolveScript, {
      EVENT_NAME: 'workflow_dispatch',
      DISPATCH_BRANCH: 'lovable',
    });
    assert.notEqual(status, 0, 'dispatching with lovable must be rejected');
    assert.equal(output, '', 'a rejected branch must never reach $GITHUB_OUTPUT');
    assert.match(`${stdout}${stderr}`, /lovable was retired/);
  });

  it('rejects any other branch, including near-misses and injected output lines', () => {
    for (const branch of ['staging', 'develop', 'DEV', 'dev ', '../main', '']) {
      assert.notEqual(
        runStep(resolveScript, { EVENT_NAME: 'workflow_dispatch', DISPATCH_BRANCH: branch }).status,
        0,
        `dispatching with ${JSON.stringify(branch)} must be rejected`,
      );
    }
    // A dispatch input may contain a newline; `name=dev\nfoo=bar` must not be able to
    // smuggle a second output line past the guard.
    const injected = runStep(resolveScript, {
      EVENT_NAME: 'workflow_dispatch',
      DISPATCH_BRANCH: 'dev\nfoo=bar',
    });
    assert.notEqual(injected.status, 0, 'a multi-line branch value must be rejected');
    assert.doesNotMatch(injected.output, /foo=bar/, 'no injected output line may survive');
  });

  it('rejects lovable arriving through the automatic path too', () => {
    const { status, output } = runStep(resolveScript, {
      EVENT_NAME: 'workflow_run',
      TRIGGER_BRANCH: 'lovable',
    });
    assert.notEqual(status, 0, 'a workflow_run on lovable must be rejected');
    assert.equal(output, '');
  });

  it('falls back to the default branch when neither source names one', () => {
    const { status, output } = runStep(resolveScript, {
      EVENT_NAME: 'workflow_run',
      DEFAULT_BRANCH: 'main',
    });
    assert.equal(status, 0);
    assert.equal(output, 'name=main\n');
  });

  it('does not evaluate the branch value as shell code', () => {
    const canary = path.join(mkdtempSync(path.join(tmpdir(), 'canary-')), 'pwned');
    const { status } = runStep(resolveScript, {
      EVENT_NAME: 'workflow_dispatch',
      DISPATCH_BRANCH: `$(touch ${canary})`,
    });
    assert.notEqual(status, 0);
    assert.ok(!existsSync(canary), 'the payload must not have been executed');
  });

  it('restricts the manual dispatch input to the active branches', () => {
    assert.deepEqual(choiceOptions(source, 'branch'), ACTIVE);
  });
});

describe('automated-PR workflows keep the branch out of the shell', () => {
  it('token-icon-sync passes the branch through env:', () => {
    const source = workflowSource('.github/workflows/token-icon-sync.yml');
    assertNoShellInterpolation(source, 'Validate target branch');
    assert.ok(
      stepBlock(source, 'Validate target branch').some((l) =>
        /^\s+TARGET_BRANCH:\s*\$\{\{\s*matrix\.target_branch\s*\}\}/.test(l),
      ),
      'the branch must be supplied via env:',
    );
  });

  it('ci-auto-remediation passes the branch through env:', () => {
    assertNoShellInterpolation(
      workflowSource('.github/workflows/ci-auto-remediation.yml'),
      'Resolve and validate target branch',
    );
  });
});

/** The `options:` list of a named choice input under `workflow_dispatch`. */
function choiceOptions(source, inputName) {
  const inputs = source.slice(source.indexOf('workflow_dispatch:'));
  const block = inputs.slice(inputs.indexOf(`${inputName}:`));
  assert.match(block, /type: choice/, `${inputName} must be a choice input`);
  const options = [];
  let seenKey = false;
  for (const line of block.split('\n').slice(1)) {
    if (/^\s+options:\s*$/.test(line)) {
      seenKey = true;
      continue;
    }
    if (!seenKey) continue;
    const item = line.match(/^\s+- (.+)$/);
    if (!item) break; // the options list ends at the next key
    options.push(item[1].trim());
  }
  return options;
}
