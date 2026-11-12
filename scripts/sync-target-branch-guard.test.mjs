#!/usr/bin/env node
/**
 * token-icon-sync must refuse to sync a branch that is not an active release branch.
 *
 * The job picks its target from a free-form `target_branch` dispatch input (and from
 * `client_payload.target_branch` on `repository_dispatch`). `lovable` was retired on
 * 2026-11-12 but the branch still exists, so a dispatch naming it used to check out
 * cleanly, run the sync, and open a PR against the archived branch with the
 * `automerge` label attached. Removing `lovable` from the schedule matrix does not
 * close that path, because the dispatch path never consulted the matrix.
 *
 * These tests run the *real guard extracted from the workflow file* rather than
 * restating its shape, so editing the workflow cannot silently drop the check. The
 * extraction asserts the script is non-empty and contains a `case`, because a guard
 * that fails to extract would otherwise make every behavioural assertion below pass
 * vacuously.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = path.join(repoRoot, '.github/workflows/token-icon-sync.yml');
const workflow = readFileSync(workflowPath, 'utf8');

/** Lines of a step, from its `- name:` line up to the next sibling step. */
function stepBlock(stepName) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  assert.ok(start !== -1, `step "${stepName}" must exist in token-icon-sync.yml`);
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
function runScript(stepName) {
  const block = stepBlock(stepName);
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

const GUARD_STEP = 'Validate target branch';
const guardScript = runScript(GUARD_STEP);

/**
 * Run the extracted guard the way GitHub runs a `run:` block on ubuntu-latest:
 * `bash -e {0}`, with the branch arriving through the environment.
 */
function runGuard(targetBranch) {
  const res = spawnSync('bash', ['-e', '-c', guardScript], {
    env: { ...process.env, TARGET_BRANCH: targetBranch },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('token-icon-sync target branch guard', () => {
  it('extracts a real guard (non-empty, contains a case statement)', () => {
    assert.ok(guardScript.trim().length > 0, 'extracted guard must not be empty');
    assert.match(guardScript, /\bcase\b/, 'guard must branch on the target branch');
  });

  it('runs the guard before anything is fetched, installed or pushed', () => {
    const steps = workflow
      .split('\n')
      .filter((l) => /^ {6}- name: /.test(l))
      .map((l) => l.trim().replace('- name: ', ''));
    assert.equal(steps[0], GUARD_STEP, 'the guard must be the first step of the job');
    for (const later of ['Checkout', 'Install dependencies', 'Sync token icons']) {
      assert.ok(steps.indexOf(later) > 0, `${later} must come after the guard`);
    }
  });

  it('accepts the two active branches', () => {
    for (const branch of ['dev', 'main']) {
      const { status } = runGuard(branch);
      assert.equal(status, 0, `TARGET_BRANCH=${branch} must be accepted`);
    }
  });

  it('rejects the retired lovable branch and says why', () => {
    const { status, stdout, stderr } = runGuard('lovable');
    assert.notEqual(status, 0, 'TARGET_BRANCH=lovable must be rejected');
    assert.match(
      `${stdout}${stderr}`,
      /lovable was retired/,
      'the failure must explain that lovable is retired, not just that the branch is unknown',
    );
  });

  it('rejects any other branch, including near-misses', () => {
    for (const branch of ['staging', 'production', 'develop', 'DEV', 'dev ', '../main', '']) {
      const { status } = runGuard(branch);
      assert.notEqual(status, 0, `TARGET_BRANCH=${JSON.stringify(branch)} must be rejected`);
    }
  });

  it('does not evaluate the branch value as shell code', () => {
    const canary = path.join(mkdtempSync(path.join(tmpdir(), 'syncguard-')), 'pwned');
    const { status } = runGuard(`$(touch ${canary})`);
    assert.notEqual(status, 0, 'a command-substitution payload must not be accepted');
    assert.throws(
      () => readFileSync(canary),
      'the payload must not have been executed — the guard must never eval the input',
    );
  });

  it('takes the branch from the environment, never interpolated into the script', () => {
    const block = stepBlock(GUARD_STEP);
    assert.ok(
      block.some((l) => /^\s+TARGET_BRANCH:\s*\$\{\{\s*matrix\.target_branch\s*\}\}/.test(l)),
      'the step must pass the branch through env:',
    );
    assert.ok(
      !block.some((l) => /\$\{\{/.test(l) && !/^\s+TARGET_BRANCH:/.test(l)),
      'the branch must not be interpolated into the shell script (script injection)',
    );
  });

  it('restricts the manual dispatch input to the active branches', () => {
    const inputs = workflow.slice(workflow.indexOf('workflow_dispatch:'));
    const targetInput = inputs.slice(inputs.indexOf('target_branch:'));
    assert.match(targetInput, /type: choice/, 'target_branch must be a choice input');
    const options = [];
    let seenKey = false;
    for (const line of targetInput.split('\n').slice(1)) {
      if (/^\s+options:\s*$/.test(line)) {
        seenKey = true;
        continue;
      }
      if (!seenKey) continue;
      const item = line.match(/^\s+- (.+)$/);
      if (!item) break; // the options list ends at the next key
      options.push(item[1].trim());
    }
    assert.deepEqual(options, ['dev', 'main'], 'options must be exactly dev and main');
  });
});
