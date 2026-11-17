#!/usr/bin/env node
/**
 * Guard: the Hardcode Sync bot must not run the developer-local git hooks (AAV-1362).
 *
 * The bug this pins: `peter-evans/create-pull-request` commits and pushes from the
 * runner, and git runs `.husky/pre-push` there. That hook is a dev-machine gate —
 * `ci:remote` plus the e2e browser gate — and the runner has no Playwright browsers,
 * so since AAV-1349 (which turned a browserless run into a hard failure) every
 * schedule run that had something to sync died at "Create PR when hardcode changed":
 *
 *   ❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
 *   husky - pre-push script failed (code 1)
 *
 * Run 43870754983 (2026-11-16) is the reproduction: `hardcode-sync (dev)` red at that
 * step, `hardcode-sync (main)` green only because it had nothing to sync.
 *
 * The fix is the step-scoped `HUSKY: '0'` env (husky 9's `_/h` shim exits 0 before
 * running the hook script). This test pins it so a future cleanup of the workflow
 * cannot silently restore the daily red.
 *
 * Scenario rows refer to docs/specs/aav-1362-hardcode-sync-hook-bypass.md.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOW_PATH = '.github/workflows/hardcode-sync.yml';
const WORKFLOW = readFileSync(join(ROOT, WORKFLOW_PATH), 'utf8');
const STEP_NAME = 'Create PR when hardcode changed';

/** The YAML block of one step, up to the next step in the same job. */
function stepBlock(source, name) {
  const start = source.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `step "${name}" must exist in ${WORKFLOW_PATH}`);
  const next = source.indexOf('\n      - name:', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

/** The rule under test, kept as a predicate so the mutation control uses the same code. */
const bypassesLocalHooks = (block) => /^\s*HUSKY:\s*'0'\s*$/m.test(block);

const createPrStep = stepBlock(WORKFLOW, STEP_NAME);

describe('hardcode-sync bot push bypasses local git hooks (AAV-1362)', () => {
  it('S1: the Create PR step sets HUSKY=0', () => {
    assert.equal(
      bypassesLocalHooks(createPrStep),
      true,
      `${STEP_NAME} must set HUSKY: '0' — without it the runner's git push runs .husky/pre-push and blocks on the missing Playwright browsers`,
    );
  });

  it('S2: the step still is the action that commits and pushes', () => {
    assert.match(createPrStep, /peter-evans\/create-pull-request@/);
    assert.match(createPrStep, /commit-message: 'chore\(hardcode\): sync hardcoded assets and mappings'/);
  });

  it('S3: mutation control — removing the env line turns the rule red', () => {
    const mutated = createPrStep.replace(/^\s*HUSKY:\s*'0'\s*\n/m, '');
    assert.doesNotMatch(mutated, /HUSKY:/);
    assert.equal(bypassesLocalHooks(mutated), false);
  });

  it('S4: HUSKY=0 is not confused with a truthy string (husky only skips on "0")', () => {
    assert.equal(bypassesLocalHooks("        env:\n          HUSKY: '1'\n"), false);
    assert.equal(
      bypassesLocalHooks('        env:\n          HUSKY: 0\n'),
      false,
      'must be quoted exactly as the workflow writes it',
    );
  });

  it('S5: the workflow keeps its own verification before the PR step', () => {
    // If both verify rounds are skipped/red the PR step must not run at all.
    const guard = WORKFLOW.indexOf("steps.verify_round1.outputs.passed == 'true'");
    assert.notEqual(guard, -1, 'PR step must stay gated on a passing verify round');
  });
});
