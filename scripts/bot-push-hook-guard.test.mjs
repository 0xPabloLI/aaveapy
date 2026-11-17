#!/usr/bin/env node
/**
 * Guard: every bot PR step must not run the developer-local git hooks (AAV-1391).
 *
 * The bug this pins is the one AAV-1362 fixed for hardcode-sync and AAV-1391 found
 * again in openapi-sync: `peter-evans/create-pull-request` commits and pushes from
 * the runner, `npm ci` installs husky via `prepare`, and git then runs
 * `.husky/pre-push` there. That hook is a dev-machine gate — `ci:remote` plus the
 * e2e browser gate — and the runner has no Playwright browsers, so since AAV-1349
 * (which turned a browserless run into a hard failure) every run that had something
 * to sync died at the push:
 *
 *   ❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
 *   husky - pre-push script failed (code 1)
 *
 * Run 44039789059 (2026-11-17, head a76b6ad) is the openapi-sync reproduction; the
 * same latent gap existed in token-icon-sync and ci-auto-remediation.
 *
 * The fix is the step-scoped `HUSKY: '0'` env (husky 9's `_/h` shim exits 0 before
 * running the hook script). This test pins it for *all* bot PR steps, so a new
 * workflow cannot silently grow the same failure — and so nobody "fixes" it by
 * disabling hooks for an entire job or workflow.
 *
 * Scenario rows refer to docs/specs/aav-1391-openapi-sync-hook-bypass.md.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOWS_DIR = join(ROOT, '.github/workflows');
const ACTION = 'peter-evans/create-pull-request@';

const workflowFiles = readdirSync(WORKFLOWS_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();

const readWorkflow = (name) => readFileSync(join(WORKFLOWS_DIR, name), 'utf8');

/** The workflow step blocks, keeping only enough text to test the contract. */
function extractSteps(source) {
  const steps = [];
  let current = null;
  for (const line of source.split('\n')) {
    const start = line.match(/^ {6}- name: (.+)$/);
    if (start) {
      if (current) steps.push(current);
      current = { name: start[1].trim(), lines: [] };
      continue;
    }
    if (!current) continue;
    // A non-blank line indented 0-5 spaces belongs to the job/workflow level:
    // the step block has ended.
    if (/^ {0,5}\S/.test(line) && line.trim() !== '') {
      steps.push(current);
      current = null;
      continue;
    }
    current.lines.push(line);
  }
  if (current) steps.push(current);
  return steps.map((step) => ({ name: step.name, block: step.lines.join('\n') }));
}

const stepHasAction = (step) => step.block.includes(ACTION);

/** The rule under test, kept as a predicate so the mutation controls use the same code. */
const bypassesLocalHooks = (block) => /^\s*HUSKY:\s*'0'\s*$/m.test(block);

const botSteps = workflowFiles.flatMap((file) => {
  const steps = extractSteps(readWorkflow(file));
  return steps.filter(stepHasAction).map((step) => ({ file, ...step }));
});

describe('bot PR steps bypass the developer-local git hooks (AAV-1391)', () => {
  it('T1: every create-pull-request step sets step-scoped HUSKY=0', () => {
    assert.notEqual(botSteps.length, 0, 'guard found no bot PR steps — enumeration is broken');
    const offenders = botSteps
      .filter((step) => !bypassesLocalHooks(step.block))
      .map((step) => `${step.file} :: ${step.name}`);
    assert.deepEqual(
      offenders,
      [],
      `these bot PR steps must set HUSKY: '0' — without it the runner's git push runs .husky/pre-push and blocks on the missing Playwright browsers`,
    );
  });

  it('T2: the known bot PR steps still are the actions that commit and push', () => {
    const expected = [
      ['ci.yml', 'Create spec sync PR'],
      ['token-icon-sync.yml', 'Create PR when icons changed'],
      ['ci-auto-remediation.yml', 'Create remediation PR'],
      ['hardcode-sync.yml', 'Create PR when hardcode changed'],
    ];
    for (const [file, name] of expected) {
      const step = botSteps.find((entry) => entry.file === file && entry.name === name);
      assert.ok(step, `${file} must still have the "${name}" step`);
      assert.equal(step.block.includes(ACTION), true, `${name} must still use ${ACTION}`);
      assert.match(step.block, /commit-message:/);
    }
  });

  it('T3: mutation controls — removing the env line, or drifting its spelling, turns the rule red', () => {
    const sample = botSteps[0];
    assert.ok(sample, 'need at least one bot step for the mutation control');
    const mutated = sample.block.replace(/^\s*HUSKY:\s*'0'\s*\n/m, '');
    assert.doesNotMatch(mutated, /HUSKY:/);
    assert.equal(bypassesLocalHooks(mutated), false);
    assert.equal(bypassesLocalHooks("        env:\n          HUSKY: '1'\n"), false);
    assert.equal(
      bypassesLocalHooks('        env:\n          HUSKY: 0\n'),
      false,
      'must be quoted exactly as the workflows write it — an unquoted 0 is a YAML number',
    );
  });

  it('T4: the developer gate itself is unchanged', () => {
    const hook = readFileSync(join(ROOT, '.husky/pre-push'), 'utf8');
    assert.match(hook, /npm run ci:remote/);
    assert.match(hook, /npm run test:e2e:pre-push/);
  });

  it('T5: HUSKY is never widened to a whole job or workflow', () => {
    for (const file of workflowFiles) {
      const source = readWorkflow(file);
      const occurrences = (source.match(/HUSKY:/g) ?? []).length;
      const insideBotSteps = botSteps
        .filter((step) => step.file === file)
        .reduce((count, step) => count + (step.block.match(/HUSKY:/g) ?? []).length, 0);
      assert.equal(
        occurrences,
        insideBotSteps,
        `${file} has a HUSKY switch outside a create-pull-request step — scope it to the bot step instead of the job/workflow`,
      );
    }
  });

  it('T6: enumeration is complete — every action occurrence lands in a parsed step', () => {
    const occurrences = workflowFiles
      .map((file) => (readWorkflow(file).match(new RegExp(ACTION, 'g')) ?? []).length)
      .reduce((total, count) => total + count, 0);
    assert.equal(
      botSteps.length,
      occurrences,
      'each create-pull-request occurrence must be parsed as a step — otherwise the guard silently skips one',
    );
  });
});
