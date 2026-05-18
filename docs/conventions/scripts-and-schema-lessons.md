# Scripts & Schema — Learned Lessons

> **何时加载**: 当你正在改 `scripts/` 下的 sync/check/clean 脚本、`src/shared/` 下的 zod schema、token icon 工具、或 frontend/Node 共享数据契约时。AGENTS.md 只留一行指针;详细教训在此。

## Token icon 检测

- **Icon 引用是动态的**: token icon 通过 URL 路径 `/icons/tokens/{symbol}.{ext}` 在运行时加载,**不是**静态 import。源码扫描(`rg "import.*icon"`)看不到哪些 icon 在被使用。判断 icon "是否过时" 必须依赖 API 运行时数据(当前活跃的 token symbol 列表)。
- **`tokenIconManifest` 不能用来做差集检测**: manifest 是从 `public/icons/tokens/` 目录自动生成的,所以"manifest 里的"恒等于"目录里的"。用它对比目录找出 orphan icon 永远空集。
- **受保护列表**: `default.svg` 等兜底 icon 不可被标记为可清理(否则 fallback 渲染崩)。在 sync/clean 脚本里必须显式排除。

## Sync / check 脚本扩展原则

- **扩展现有基础设施优于新建**: 遇到 sync / check / clean 类需求,优先在 `scripts/sync-*.mjs` 或 `scripts/check-*.mjs` 中加 sub-command 或 flag,**不要**新建独立脚本或 GitHub workflow。维护成本远低。

## Frontend / Node 共享 schema

- **共享 schema 模块放 `src/shared/<domain>/`**: 当一个 zod contract 既被 frontend 用又被 `scripts/` 下的 Node 脚本用,放这里。
- **用相对 `.ts` 路径引入,不要用 `@/` alias**: Node 的 `--experimental-strip-types` 不解析 Vite 的 `@/` 路径别名。frontend 端用 `@/shared/x` 可以,Node 脚本端必须用相对路径(如 `../src/shared/x.ts`)。
- **Script 桥接文件**: Node `.mjs` 入口脚本不能直接 import `.ts`。约定:在 `scripts/lib/<name>.ts` 中封装 schema 验证 + fetch 逻辑,`.mjs` entrypoint 用动态 `await import('./lib/foo.ts')` 引入。
- **错误语义分离**: frontend 的 cache fallback (接受降级形状,优先维持用户可见) 和 script 的 strict validation (拒绝任何合约偏差,优先报错让 CI 红) **不应合并**到同一个 helper。两者目标相反。

## 反例(不要这么做)

- ❌ 用静态源码扫描判断 icon 在不在用 → 漏判活跃 token
- ❌ `manifest vs dir` 对比找 orphan icon → 恒为空
- ❌ 新建 `scripts/check-foo.mjs` 干已存在脚本能干的事 → 二选一时扩展旧的
- ❌ `import x from '@/shared/y'` 在 `.mjs` 里 → ERR_MODULE_NOT_FOUND
- ❌ 让 frontend 跟 Node script 共用一个 `parseStrict` → 一边崩首屏,一边漏报合约 drift
