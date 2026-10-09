#!/usr/bin/env node
/**
 * Behaviour tests for the husky hooksPath resolver.
 *
 * Rows map to the contract in scripts/lib/husky-hooks-path.mjs: the bug being
 * guarded against is a *silent* skip of pre-commit/pre-push in linked git
 * worktrees, so every branch that could reintroduce silence is asserted here
 * rather than only the happy path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUSKY_HOOKS_DIR,
  absoluteHooksPath,
  mainWorktreeTopFromCommonDir,
  classifyHooksPath,
  decideHooksPathAction,
  hooksStatus,
} from './lib/husky-hooks-path.mjs';

const TARGET = '/repo/main/.husky/_';

describe('absoluteHooksPath', () => {
  it('R1 joins the husky dir onto the main checkout top level', () => {
    assert.equal(absoluteHooksPath('/repo/main'), `${TARGET}`);
  });

  it('R2 tolerates a trailing slash without doubling the path', () => {
    assert.equal(absoluteHooksPath('/repo/main/'), '/repo/main/.husky/_');
    assert.equal(absoluteHooksPath('/repo/main///'), '/repo/main/.husky/_');
  });

  it('R3 returns a bare husky dir for empty input instead of crashing', () => {
    assert.equal(absoluteHooksPath(''), `/${HUSKY_HOOKS_DIR}`);
    assert.equal(absoluteHooksPath(undefined), `/${HUSKY_HOOKS_DIR}`);
  });
});

describe('mainWorktreeTopFromCommonDir', () => {
  it('R4 strips the .git suffix from an absolute common dir', () => {
    assert.equal(mainWorktreeTopFromCommonDir('/repo/main/.git'), '/repo/main');
  });

  it('R5 resolves the relative form a linked worktree prints against that worktree', () => {
    assert.equal(mainWorktreeTopFromCommonDir('../main/.git', '/tmp/wt'), '/tmp/main');
  });

  it('R6 tolerates a trailing slash and empty input', () => {
    assert.equal(mainWorktreeTopFromCommonDir('/repo/main/.git/'), '/repo/main');
    assert.equal(mainWorktreeTopFromCommonDir(''), '');
  });
});

describe('classifyHooksPath', () => {
  it('R7 recognises the three husky shapes and nothing else', () => {
    assert.equal(classifyHooksPath('', TARGET), 'unset');
    assert.equal(classifyHooksPath(undefined, TARGET), 'unset');
    assert.equal(classifyHooksPath('.husky/_', TARGET), 'husky-relative');
    assert.equal(classifyHooksPath('.husky', TARGET), 'husky-relative');
    assert.equal(classifyHooksPath('/elsewhere/.husky/_', TARGET), 'husky-relative');
    assert.equal(classifyHooksPath(TARGET, TARGET), 'target-absolute');
  });

  it('R8 files an unrelated path as foreign rather than overwriting it', () => {
    assert.equal(classifyHooksPath('/opt/custom/hooks', TARGET), 'foreign');
    assert.equal(classifyHooksPath('.githooks', TARGET), 'foreign');
  });
});

describe('decideHooksPathAction', () => {
  it('R9 sets the path when husky left it relative (the worktree hole)', () => {
    const d = decideHooksPathAction({ current: '.husky/_', target: TARGET });
    assert.equal(d.action, 'set');
    assert.match(d.reason, /linking it to/);
  });

  it('R10 is idempotent: a second run reports noop instead of rewriting config', () => {
    assert.equal(decideHooksPathAction({ current: TARGET, target: TARGET }).action, 'noop');
  });

  it('R11 never clobbers a hooksPath this repo does not own', () => {
    const d = decideHooksPathAction({ current: '/opt/custom/hooks', target: TARGET });
    assert.equal(d.action, 'skip-foreign');
    assert.match(d.reason, /not touching it/);
  });

  it('R12 honours the documented opt-out', () => {
    const d = decideHooksPathAction({ current: '.husky/_', target: TARGET, env: { HUSKY_HOOKS_PATH_ABSOLUTE: '0' } });
    assert.equal(d.action, 'skip-opt-out');
  });

  it('R13 only the exact "0" opts out, so a typo cannot silently disable the fix', () => {
    for (const value of ['false', '', '1', '0 ']) {
      const d = decideHooksPathAction({
        current: '.husky/_',
        target: TARGET,
        env: { HUSKY_HOOKS_PATH_ABSOLUTE: value },
      });
      assert.notEqual(d.action, 'skip-opt-out', `value ${JSON.stringify(value)} must not opt out`);
    }
  });
});

describe('hooksStatus', () => {
  it('R14 reports broken when the shims were never generated', () => {
    const s = hooksStatus({ configValue: TARGET, target: TARGET, shimAtTarget: false, nodeModulesHere: true });
    assert.equal(s.ok, false);
    assert.equal(s.verdict, 'broken');
    assert.match(s.hint, /npx husky/);
  });

  it('R15 reports the silent-skip state explicitly rather than as success', () => {
    const s = hooksStatus({ configValue: '.husky/_', target: TARGET, shimAtTarget: true, nodeModulesHere: true });
    assert.equal(s.ok, false);
    assert.equal(s.verdict, 'relative-hooks-path');
  });

  it('R16 accepts a worktree whose hooks fire but which lacks node_modules, with an install hint', () => {
    const s = hooksStatus({ configValue: TARGET, target: TARGET, shimAtTarget: true, nodeModulesHere: false });
    assert.equal(s.ok, true);
    assert.equal(s.verdict, 'hooks-run-but-no-node-modules');
    assert.match(s.hint, /npm install/);
  });

  it('R17 is the healthy end state', () => {
    const s = hooksStatus({ configValue: TARGET, target: TARGET, shimAtTarget: true, nodeModulesHere: true });
    assert.equal(s.ok, true);
    assert.equal(s.verdict, 'gated');
  });
});
