import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  { ignores: ["dist", ".worktrees", "e2e", "scripts", "test-results", "src/integrations/supabase/client.ts", "src/integrations/supabase/previewAuthStorage.ts", "src/integrations/supabase/types.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json"],
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // react-hooks 7.x 新增规则较严格，暂关闭以免阻塞升级；后续可逐步修代码再开启
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // 禁止重复导入
      "import/no-duplicates": "error",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      // shadcn/ui primitives intentionally export helpers alongside components
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Portfolio spacing guardrail — see docs/design/portfolio-panel-spacing.md.
    // Block pl/pr/px/ml/mr/mx-[Npx|Nrem] magic values; always use
    // var(--ds-space-*) tokens so the Portfolio toggle stays aligned with
    // the Single-mode toggle.
    files: ["src/components/dashboard/Portfolio*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b[pm][lrx]-\\[[0-9][^\\]]*(px|rem)\\]/]",
          message:
            "Portfolio*.tsx: do not use arbitrary pl/pr/px/ml/mr/mx-[Npx|Nrem] values. Use var(--ds-space-N) tokens. See docs/design/portfolio-panel-spacing.md.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b[pm][lrx]-\\[[0-9][^\\]]*(px|rem)\\]/]",
          message:
            "Portfolio*.tsx: do not use arbitrary pl/pr/px/ml/mr/mx-[Npx|Nrem] values. Use var(--ds-space-N) tokens. See docs/design/portfolio-panel-spacing.md.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.test.tsx"],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
);
