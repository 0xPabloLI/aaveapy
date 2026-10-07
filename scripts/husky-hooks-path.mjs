#!/usr/bin/env node
/**
 * Link `core.hooksPath` at husky's shim directory *absolutely*, so linked git
 * worktrees cannot silently run no hooks at all.
 *
 * Run from the `prepare` script (after `npx husky`) and via `npm run
 * check:hooks-path`. See scripts/lib/husky-hooks-path.mjs for why the relative
 * value husky writes is a hole, and scripts/husky-hooks-path.test.mjs for the
 * decision table this CLI is expected to follow.
 *
 * Usage:
 *   node scripts/husky-hooks-path.mjs            # apply (default, used by prepare)
 *   node scripts/husky-hooks-path.mjs --check     # report only; exit 1 when not gated
 *   node scripts/husky-hooks-path.mjs --apply     # explicit apply
 * Opt out: HUSKY_HOOKS_PATH_ABSOLUTE=0
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import {
  PUSH_SHIM,
  absoluteHooksPath,
  decideHooksPathAction,
  hooksStatus,
  mainWorktreeTopFromCommonDir,
} from './lib/husky-hooks-path.mjs';

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');

const top = git(['rev-parse', '--show-toplevel']);
const commonDir = git(['rev-parse', '--git-common-dir']);
if (!top || !commonDir) {
  console.log('[husky-hooks-path] not inside a git work tree — nothing to do');
  process.exit(0);
}

const mainTop = mainWorktreeTopFromCommonDir(commonDir, top) || top;
const target = absoluteHooksPath(mainTop);
const current = git(['config', '--get', 'core.hooksPath']);
const decision = decideHooksPathAction({ current, target, env: process.env });

if (!checkOnly && decision.action === 'set') {
  try {
    execFileSync('git', ['config', 'core.hooksPath', target], { stdio: 'inherit' });
  } catch {
    console.log(`[husky-hooks-path] could not write core.hooksPath — leaving "${current}" as is`);
  }
}

const after = checkOnly || decision.action !== 'set' ? current : git(['config', '--get', 'core.hooksPath']);
const status = hooksStatus({
  configValue: after,
  target,
  shimAtTarget: fs.existsSync(`${target}/${PUSH_SHIM}`),
  nodeModulesHere: fs.existsSync(`${top}/node_modules`),
});

const prefix = checkOnly ? 'check' : decision.action;
console.log(`[husky-hooks-path] ${prefix}: ${status.verdict} (${status.hint})`);
process.exit(status.ok ? 0 : checkOnly ? 1 : 0);
