import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['dist', '.worktrees', 'scripts', 'test-results'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': 'off',
      // react-hooks 7.x 新增规则较严格，暂关闭以免阻塞升级；后续可逐步修代码再开启
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // 禁止重复导入
      'import/no-duplicates': 'error',
      // ── 圈复杂度棘轮（warn-only）──
      // 基线：>15 的函数约 69 处（2026-09 测得，热点集中在 rate simulation /
      // 前端 dashboard 组件）。不阻塞 CI，新代码超限会出现在 reviewdog 注解里；
      // 机会性修复后逐步下调阈值。Golden-Rules 计算器刻意分支密集，
      // 重构前先读 docs/rate-calculation.md Part 8。
      complexity: ['warn', 15],
    },
  },
  {
    // e2e/ and the Playwright config are not React code and never ship, so they get
    // the plain TS baseline (no react-hooks / react-refresh / complexity ratchet).
    // AAV-1319: these files were ignored outright, so dead variables and broken
    // escapes accumulated with nothing reading them. (The `test.skip('string')` that
    // motivated the ticket is a *type* error — tsc's job, see tsconfig.e2e.json.)
    // Why: docs/specs/aav-1319-e2e-static-gates.md
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      // Specs read `process.env` in helpers and touch `document` inside page.evaluate.
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { import: importPlugin },
    rules: {
      // Same rule as src: two imports of the same module is a smell everywhere.
      'import/no-duplicates': 'error',
      // Playwright's `test('…', async ({}) => …)` is the documented empty-fixture form.
      'no-empty-pattern': 'off',
      // src has this off as a legacy ratchet; e2e is 42 files with no such backlog and
      // already uses the `_`-prefix convention for throwaway fixture params, so it is
      // enforced here with that escape (it found 3 real dead variables on day one).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      // shadcn/ui primitives intentionally export helpers alongside components
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Portfolio spacing guardrail — see docs/design/portfolio-panel-spacing.md.
    // Block pl/pr/px/ml/mr/mx-[Npx|Nrem] magic values; always use
    // var(--ds-space-*) tokens so the Portfolio toggle stays aligned with
    // the Single-mode toggle.
    files: ['src/components/dashboard/Portfolio*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\b[pm][lrx]-\\[[0-9][^\\]]*(px|rem)\\]/]',
          message:
            'Portfolio*.tsx: do not use arbitrary pl/pr/px/ml/mr/mx-[Npx|Nrem] values. Use var(--ds-space-N) tokens. See docs/design/portfolio-panel-spacing.md.',
        },
        {
          selector: 'TemplateElement[value.raw=/\\b[pm][lrx]-\\[[0-9][^\\]]*(px|rem)\\]/]',
          message:
            'Portfolio*.tsx: do not use arbitrary pl/pr/px/ml/mr/mx-[Npx|Nrem] values. Use var(--ds-space-N) tokens. See docs/design/portfolio-panel-spacing.md.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.tsx'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
);
