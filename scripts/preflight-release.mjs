#!/usr/bin/env node
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const isFull = args.has('--full');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const checks = [];
const warnings = [];

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function addCheck(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    const detail = `${error.stdout || ''}${error.stderr || ''}`.trim() || error.message;
    checks.push({ name, ok: false, detail });
  }
}

function addCheckWithNetworkFallback(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    const detail = `${error.stdout || ''}${error.stderr || ''}`.trim() || error.message;
    if (/ENOTFOUND|EAI_AGAIN|network|audit endpoint returned an error/i.test(detail)) {
      checks.push({ name, ok: true, detail: 'Skipped due to unavailable network.' });
      warnings.push(`${name}: skipped because network is unavailable.`);
      return;
    }
    checks.push({ name, ok: false, detail });
  }
}

addCheck('Git working tree is clean', () => {
  const status = run('git status --porcelain=v1');
  if (status) {
    throw new Error(`Uncommitted changes:\n${status}`);
  }
  return 'No pending changes';
});

addCheck('Current branch tracks upstream', () => {
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  return `${branch} -> ${upstream}`;
});

addCheck('Branch is synced with upstream', () => {
  const aheadBehind = run('git rev-list --left-right --count HEAD...@{u}');
  const [behind, ahead] = aheadBehind.split(/\s+/).map((value) => Number(value));
  if (ahead !== 0 || behind !== 0) {
    throw new Error(`Ahead by ${ahead}, behind by ${behind}`);
  }
  return 'No ahead/behind commits';
});

addCheck('Secret keyword scan (heuristic)', () => {
  // Prefer patterns that strongly correlate with credential leaks while avoiding common false positives.
  const pattern =
    '(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\\-_]{35}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|SENTRY_DSN\\s*=|VITE_[A-Z0-9_]*KEY\\s*=)';
  const output = run(
    `rg -n -i "${pattern}" src scripts .github README.md package.json .env.example -g'!scripts/preflight-release.mjs' || true`,
    { shell: '/bin/zsh' }
  );

  const filtered = output.split('\n').filter(Boolean);

  if (filtered.length > 0) {
    throw new Error(filtered.join('\n'));
  }

  return 'No suspicious matches outside SECURITY.md';
});

addCheck('Only .env.example is tracked', () => {
  const tracked = run(`git ls-files | rg '^\\.env' || true`, { shell: '/bin/zsh' });
  const list = tracked.split('\n').filter(Boolean);
  const invalid = list.filter((file) => file !== '.env.example');
  if (invalid.length > 0) {
    throw new Error(`Unexpected tracked env files: ${invalid.join(', ')}`);
  }
  return list.length > 0 ? `Tracked env files: ${list.join(', ')}` : 'No tracked env files';
});

addCheck('Sensitive env files are ignored', () => {
  const ignored = run('git check-ignore -v .env .env.local .env.production || true', { shell: '/bin/zsh' });
  const lines = ignored.split('\n').filter(Boolean);
  if (lines.length < 3) {
    throw new Error(`Expected 3 ignore matches, got ${lines.length}.\n${ignored}`);
  }
  return lines.join('\n');
});

if (isFull) {
  addCheck('Lint passes', () => run('npm run lint', { stdio: 'pipe' }) || 'OK');
  addCheck('Build passes', () => run('npm run build', { stdio: 'pipe' }) || 'OK');
  addCheckWithNetworkFallback('Production dependency audit', () =>
    run('npm audit --omit=dev', { stdio: 'pipe' }) || 'OK'
  );
}

console.log(`${colors.cyan}Preflight release checks${colors.reset}${isFull ? ' (full)' : ' (fast)'}`);
console.log('');

for (const check of checks) {
  const icon = check.ok ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
  console.log(`${icon} ${check.name}`);
  if (check.detail) {
    console.log(`  ${check.detail.split('\n').join('\n  ')}`);
  }
}

const failed = checks.filter((item) => !item.ok);
console.log('');
if (failed.length > 0) {
  console.log(`${colors.red}${failed.length} check(s) failed.${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.green}All checks passed.${colors.reset}`);
if (warnings.length > 0) {
  console.log(`${colors.yellow}Warnings:${colors.reset}`);
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
console.log(
  `${colors.yellow}Tip:${colors.reset} use \`npm run preflight:release -- --full\` before merging to \`main\`.`
);
