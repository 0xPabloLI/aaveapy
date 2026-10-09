/**
 * Resolve and verify the git `core.hooksPath` used by husky in this repository.
 *
 * Why this exists: husky sets `core.hooksPath` to the RELATIVE path `.husky/_`
 * and creates that directory inside its `prepare` step, i.e. during
 * `npm install`. A linked `git worktree` has no node_modules and therefore no
 * `.husky/_`, so git resolves the relative value against that worktree, finds
 * no hook at all, and runs NOTHING — while `git push` still exits 0. That is a
 * silent, total skip of the local gates, and four of them
 * (osv-scanner, semgrep, knip, jscpd `dup:check`) exist *only* in
 * `.husky/pre-push`: GitHub CI has no job for them, and CI's `security-audit`
 * even runs `npm audit --omit=dev`, so dev-dependency advisories are invisible
 * there. Observed 2026-10-06 while landing PR #747, which reached the remote
 * with none of the four ever having run.
 *
 * The fix is to point the *shared* `core.hooksPath` (`.git/config` is common to
 * every worktree) at the ABSOLUTE `.husky/_` of the main checkout: git then
 * finds the shims no matter which worktree a command runs in, and the shims
 * execute with the worktree as cwd, so `npm run ci:remote` validates the tree
 * being pushed. A worktree without node_modules now fails loudly instead of
 * passing silently — which is the point.
 *
 * Test rows below map to this contract; `scripts/husky-hooks-path.test.mjs`.
 */
import path from 'node:path';

/** Relative value husky writes, and the directory it generates shims into. */
export const HUSKY_HOOKS_DIR = '.husky/_';

/** Hook whose absence would silently skip the push-time gates. */
export const PUSH_SHIM = 'pre-push';

/**
 * Absolute path to set as `core.hooksPath`, from the main checkout's top level.
 *
 * @param {string} mainTop absolute path of the main work tree (no trailing slash added twice)
 * @returns {string}
 */
export function absoluteHooksPath(mainTop) {
  const trimmed = String(mainTop ?? '').replace(/\/+$/, '');
  return `${trimmed}/${HUSKY_HOOKS_DIR}`;
}

/**
 * Main checkout top level, derived from `git rev-parse --git-common-dir`.
 *
 * Linked worktrees print a path that points back into the main checkout's
 * `.git` (absolute, or relative to the worktree), so taking its parent is what
 * yields the main top level rather than the worktree's own directory.
 *
 * @param {string} commonDirRaw output of `git rev-parse --git-common-dir`
 * @param {string} [worktreeTop] current work tree top level, used to resolve a relative value
 * @returns {string}
 */
export function mainWorktreeTopFromCommonDir(commonDirRaw, worktreeTop = '') {
  const commonDir = String(commonDirRaw ?? '').replace(/\/+$/, '');
  if (!commonDir) return '';
  const absolute = commonDir.startsWith('/') ? commonDir : `${worktreeTop.replace(/\/+$/, '')}/${commonDir}`;
  const normalized = path.posix.normalize(absolute);
  return normalized.endsWith('/.git') ? normalized.slice(0, -'/.git'.length) : normalized;
}

/**
 * Name what an existing `core.hooksPath` value is, so the writer can decide
 * whether it may touch it.
 *
 * @param {string|undefined} value config value as reported by git ('' when unset)
 * @param {string} target absolute path this repo wants
 * @returns {'unset'|'husky-relative'|'target-absolute'|'foreign'}
 */
export function classifyHooksPath(value, target) {
  const v = String(value ?? '').trim();
  if (v === '') return 'unset';
  // Order matters: the absolute path this repo writes also ends in `/.husky/_`,
  // so testing the suffix first would classify our own value as husky's default
  // and make every subsequent run rewrite the config again.
  if (v === target) return 'target-absolute';
  if (v === HUSKY_HOOKS_DIR || v === '.husky' || v.endsWith(`/${HUSKY_HOOKS_DIR}`)) return 'husky-relative';
  return 'foreign';
}

/**
 * Decide the action for one run. Never overwrites a path this repo does not own.
 *
 * @param {{current: string|undefined, target: string, env?: Record<string,string|undefined>}} input
 * @returns {{action: 'set'|'noop'|'skip-opt-out'|'skip-foreign', reason: string}}
 */
export function decideHooksPathAction({ current, target, env = {} }) {
  if (env.HUSKY_HOOKS_PATH_ABSOLUTE === '0') {
    return { action: 'skip-opt-out', reason: 'HUSKY_HOOKS_PATH_ABSOLUTE=0 — leaving core.hooksPath to husky' };
  }
  const kind = classifyHooksPath(current, target);
  if (kind === 'foreign') {
    return { action: 'skip-foreign', reason: `core.hooksPath is "${current}", not a husky value — not touching it` };
  }
  if (kind === 'target-absolute') {
    return { action: 'noop', reason: 'already absolute; every worktree inherits it from the shared .git/config' };
  }
  return { action: 'set', reason: `core.hooksPath was "${current || '(unset)'}"; linking it to ${target}` };
}

/**
 * Interpret the gate's state well enough to print an actionable verdict.
 *
 * @param {{configValue: string|undefined, target: string, shimAtTarget: boolean, nodeModulesHere: boolean}} state
 * @returns {{ok: boolean, verdict: string, hint: string}}
 */
function verdict(state) {
  const { configValue, target, shimAtTarget, nodeModulesHere } = state;
  if (!shimAtTarget) {
    return {
      ok: false,
      verdict: 'broken',
      hint: `${target}/${PUSH_SHIM} is missing — run \`npx husky\` in the main checkout to generate the shims`,
    };
  }
  if (classifyHooksPath(configValue, target) !== 'target-absolute') {
    return {
      ok: false,
      verdict: 'relative-hooks-path',
      hint: `core.hooksPath is "${configValue || '(unset)'}" — linked worktrees silently run no hooks; run \`npm run check:hooks-path -- --apply\` or reinstall`,
    };
  }
  if (!nodeModulesHere) {
    return {
      ok: true,
      verdict: 'hooks-run-but-no-node-modules',
      hint: 'hooks now fire in this worktree, so install dependencies here (`npm install`) or the gate fails on a missing toolchain',
    };
  }
  return { ok: true, verdict: 'gated', hint: 'hooks resolve from the main checkout for every worktree' };
}

/**
 * Full status object for `--check`, split out so the CLI stays thin.
 *
 * @param {Record<string, boolean|string|undefined>} state
 * @returns {{ok: boolean, verdict: string, hint: string, target: string, configValue: string}}
 */
export function hooksStatus(state) {
  const target = String(state.target ?? '');
  return { ...verdict({ ...state, target }), target, configValue: String(state.configValue ?? '') };
}
