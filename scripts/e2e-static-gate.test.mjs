#!/usr/bin/env node
/**
 * Guard: the static gates actually cover `e2e/` (AAV-1319).
 *
 * Three separate holes, one ticket (docs/specs/aav-1319-e2e-static-gates.md):
 *
 *   1. `eslint.config.js` listed `e2e` in `ignores`, so `npm run lint` never
 *      read a single spec file;
 *   2. `npm run typecheck` only compiled `src` and `vite.config.ts`, so
 *      `e2e/*.spec.ts` / `playwright.config.ts` were never compiled — a
 *      `test.skip('string')` (no matching Playwright overload) survived months
 *      because nothing checked it;
 *   3. neither `ci:remote` nor PR CI ran `npm run typecheck` at all, so the type
 *      gate only existed in the local pre-commit hook.
 *
 * The configuration assertions alone would pass on a tsconfig whose `include`
 * covers nothing, and `eslint <ignored-dir>` exits 0, so both behavioural halves
 * are load-bearing: a probe with a type error (and one with a lint error) must
 * turn the gate red, and the clean tree must stay green.
 *
 * Row numbers refer to the Scenario & Risk Verification Matrix in that spec.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');
const ESLINT = join(ROOT, 'node_modules', '.bin', 'eslint');
const typeProbe = join(ROOT, 'e2e', '__static_gate_probe__.spec.ts');
const lintProbe = join(ROOT, 'e2e', '__static_gate_lint_probe__.spec.ts');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));

function run(bin, args) {
  try {
    return { code: 0, output: execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** The `lint` job only — a typecheck in another job would not run on every PR. */
function lintJobSection() {
  const ci = read('.github/workflows/ci.yml');
  const start = ci.indexOf('\n  lint:');
  assert.notEqual(start, -1, 'ci.yml has no `lint:` job');
  const rest = ci.slice(start + 1);
  // Cut at the next top-level job key, not at a blank line: a blank line *inside*
  // the job must not truncate the section and turn this assertion into a no-op.
  const nextJob = rest.search(/\n {2}[a-z][a-z-]*:\n/);
  return nextJob === -1 ? rest : rest.slice(0, nextJob);
}

describe('AAV-1319 configuration contract', () => {
  it('tsconfig.e2e.json compiles the whole e2e directory and playwright.config.ts', () => {
    assert.ok(existsSync(join(ROOT, 'tsconfig.e2e.json')), 'tsconfig.e2e.json is missing');
    const { include = [] } = JSON.parse(read('tsconfig.e2e.json'));
    assert.ok(
      include.includes('e2e/**/*.ts'),
      `tsconfig.e2e.json include must cover e2e/**/*.ts, got ${JSON.stringify(include)}`,
    );
    assert.ok(
      include.includes('playwright.config.ts'),
      `tsconfig.e2e.json include must cover playwright.config.ts, got ${JSON.stringify(include)}`,
    );
  });

  it('typecheck runs both the src tsconfigs and the e2e tsconfig', () => {
    const { scripts } = pkg;
    assert.match(scripts['typecheck:e2e'] ?? '', /tsconfig\.e2e\.json/, 'typecheck:e2e must use tsconfig.e2e.json');
    assert.match(scripts['typecheck:src'] ?? '', /tsconfig\.app\.json/, 'typecheck:src must use tsconfig.app.json');
    assert.match(scripts.typecheck ?? '', /typecheck:e2e/, 'typecheck must chain typecheck:e2e');
    assert.match(scripts.typecheck ?? '', /typecheck:src/, 'typecheck must chain typecheck:src');
  });

  it('typecheck generates the gitignored icon manifests itself', () => {
    // tsconfig.app.json imports `chainIconManifest.generated` / `tokenIconManifest.generated`,
    // which are gitignored. npm runs `pretypecheck` first, so every entry point
    // (pre-commit, ci:remote, CI, a human) gets them without copying the step —
    // and a clean worktree does not fail with a TS2307 that reads like a regression.
    assert.match(
      pkg.scripts.pretypecheck ?? '',
      /generate-icon-manifests/,
      'pretypecheck must generate the icon manifests before tsc reads them',
    );
  });

  it('ci:remote runs the type gate, so pre-push does too', () => {
    assert.match(pkg.scripts['ci:remote'] ?? '', /npm run typecheck/, 'ci:remote must run npm run typecheck');
  });

  it('PR CI runs the type gate', () => {
    const ci = read('.github/workflows/ci.yml');
    assert.match(lintJobSection(), /run: npm run typecheck/, 'the lint job must run `npm run typecheck` on every PR');
    assert.ok(
      !/run: npx tsc --noEmit/.test(ci),
      'ci.yml must call the npm script, not a bare `tsc --noEmit` (solution-style root config checks 0 files)',
    );
  });

  it('eslint lints e2e instead of ignoring it', async () => {
    const { default: config } = await import(join(ROOT, 'eslint.config.js'));
    const flat = Array.isArray(config) ? config : [config];
    const ignored = flat.flatMap((entry) => entry?.ignores ?? []);
    // Prefix matches too: `'e2e/**'` or `'e2e/*.spec.ts'` would ignore just as effectively.
    const e2eIgnore = ignored.find((pattern) => pattern === 'e2e' || String(pattern).startsWith('e2e/'));
    assert.equal(e2eIgnore, undefined, `eslint still ignores e2e via ${JSON.stringify(e2eIgnore)}`);
    // `tseslint.config({ extends, files, rules })` expands into one entry per extended
    // config plus one for the block's own rules, all carrying the same `files`, so the
    // effective value is the last definition among the matching entries (flat-config
    // semantics), not the first entry `find()` happens to return.
    const e2eBlocks = flat.filter((entry) => (entry?.files ?? []).some((glob) => String(glob).startsWith('e2e/')));
    assert.ok(e2eBlocks.length > 0, 'eslint.config.js has no block whose `files` covers e2e/**');
    const effective = (rule) =>
      e2eBlocks.reduce((acc, entry) => (entry?.rules && rule in entry.rules ? entry.rules[rule] : acc), undefined);
    assert.equal(
      effective('no-empty-pattern'),
      'off',
      'no-empty-pattern must be off for e2e: Playwright fixtures use `async ({}) => …`',
    );
    assert.equal(effective('import/no-duplicates'), 'error', 'e2e must keep the src rule against duplicate imports');
    assert.match(
      String(effective('@typescript-eslint/no-unused-vars')?.[1]?.argsIgnorePattern ?? ''),
      /^\^_/,
      'unused-vars must ignore the `_`-prefixed throwaway params the specs use',
    );
  });

  it('AGENTS.md points agents at the real command and stops claiming e2e is uncovered', () => {
    const agents = read('AGENTS.md');
    assert.ok(
      !/e2e\/` 也不在 lint 与 typecheck 的覆盖范围内/.test(agents),
      'AGENTS.md still says e2e is outside the gates',
    );
    assert.ok(
      !/npx tsc --noEmit/.test(agents),
      'AGENTS.md still tells agents to run bare `npx tsc --noEmit` (checks 0 files)',
    );
    assert.match(agents, /npm run typecheck/, 'AGENTS.md must name the real type gate');
  });
});

describe('AAV-1319 behavioural gates (E1/E2/E5/E6)', () => {
  it('the clean tree type-checks green', { timeout: 180_000 }, () => {
    const { code, output } = run(TSC, ['-p', 'tsconfig.e2e.json', '--noEmit']);
    assert.equal(code, 0, `npm run typecheck:e2e must be green on a clean tree:\n${output}`);
  });

  it('a type error in a spec file turns the gate red', { timeout: 180_000 }, () => {
    writeFileSync(typeProbe, 'export const probe: number = "not a number";\n', 'utf8');
    try {
      const { code, output } = run(TSC, ['-p', 'tsconfig.e2e.json', '--noEmit']);
      assert.notEqual(code, 0, 'a type error under e2e/ must fail the gate — the include is not reaching these files');
      assert.match(output, /__static_gate_probe__/, 'the failure must name the probe file, not some unrelated module');
    } finally {
      rmSync(typeProbe, { force: true });
    }
  });

  it('eslint reads the e2e files (not just exits 0 on an ignored directory)', { timeout: 180_000 }, () => {
    const { code, output } = run(ESLINT, ['e2e', '--format', 'json']);
    assert.equal(code, 0, `eslint e2e must be green:\n${output}`);
    const results = JSON.parse(output);
    const files = results.map((entry) => entry.filePath);
    // Exit 0 is not proof of coverage: `eslint <ignored-dir>` also exits 0 (verified).
    assert.ok(
      files.length >= 20,
      `eslint only read ${files.length} e2e files — the ignore or files glob is too narrow`,
    );
    assert.ok(
      files.some((file) => file.endsWith('reserves-table-interactions.spec.ts')),
      'eslint must read spec files, not just helpers',
    );
  });

  it('a lint error in a spec file turns the gate red', { timeout: 180_000 }, () => {
    writeFileSync(lintProbe, 'export const usedProbeVariable = 1;\nconst unusedProbeVariable = 2;\n', 'utf8');
    try {
      const { code, output } = run(ESLINT, ['e2e/__static_gate_lint_probe__.spec.ts']);
      assert.notEqual(code, 0, 'an unused variable under e2e/ must fail the lint gate');
      assert.match(output, /__static_gate_lint_probe__/, 'the failure must name the probe file');
      assert.match(output, /no-unused-vars/, 'the rule that fired must be the one this ticket re-enabled for e2e');
    } finally {
      rmSync(lintProbe, { force: true });
    }
  });
});
