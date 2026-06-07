# 开发方案 - AAV-118 Slice 3: Move validate side effect to main.tsx; add ADR-0011; fix `.env.production` comment

> **Linear**: [AAV-622](https://linear.app/aaveapy/issue/AAV-622/slice-33-move-side-effect-adr-0011-docs)

## Parent

AAV-118 — 添加环境配置校验(master plan: `docs/plans/linear-issues/phase-2/aav_118_plan.md`)

## 1. Issue 概述

把 `validateApiBaseEnv(import.meta.env)` 的副作用从 `apiBase.ts:15` 模块顶层挪到 `src/main.tsx` 显式 bootstrap;新建 ADR-0011 记录"空字符串视为缺失"的设计决策;修正 `.env.production:4` 的误导注释;更新 `docs/conventions/api-base-urls.md` 的浏览器段,补 missing semantics 一行。

## 2. 当前状态

- `src/lib/apiBase.ts:15` 在模块加载时立即调用 `validateApiBaseEnv(import.meta.env)`,副作用面隐式,任何 `import { API_BASE }` 都会触发
- `.env.production:4` 注释写 "(或留空使用默认值)",与 build-time throw 行为冲突
- `docs/conventions/api-base-urls.md` 浏览器段未说明 missing semantics
- 没有 ADR 解释"为什么空字符串视为缺失"

## 3. 影响范围

- 修改 `src/lib/apiBase.ts`(删 line 15 顶层调用)
- 修改 `src/main.tsx`(加 `import` + 显式 `validateApiBaseEnv(import.meta.env)` 调用)
- 修改 `.env.production`(改 line 4 注释)
- 新建 `docs/adr/0011-api-base-url-missing-semantics.md`
- 修改 `docs/conventions/api-base-urls.md`(浏览器段加 missing semantics 一行)
- **不动** `vite.config.ts`(slice 2 已改)
- **不动** 调用点
- **不动** Node 脚本 / 第三方 API base

## 4. 实现方案

### 4.1 删 apiBase.ts:15 顶层副作用
```ts
// 删前
validateApiBaseEnv(import.meta.env);
// 删后:(nothing, 模块纯化为只读 env 计算 API_BASE)
```

### 4.2 main.tsx 显式 bootstrap
在文件顶部、`preloadDefaultTokenIcon()` 之前,加:
```ts
import { validateApiBaseEnv } from '@/lib/apiBase';
validateApiBaseEnv(import.meta.env);
```

### 4.3 .env.production:4 注释修正
```diff
- # 本地开发时设置为: http://localhost:3001/api (根据你的本地API端口调整)
- # 生产环境时设置为: https://api.aaveapy.com/api (或留空使用默认值)
+ # 本地开发时设置为: http://localhost:3001/api (根据你的本地API端口调整)
+ # 生产环境时设置为: https://api.aaveapy.com/api (build 时强制,留空会 throw)
```

### 4.4 新建 ADR-0011

```md
# ADR-0011: API base URL "missing" semantics

## Status

Accepted (proposed by AAV-118 refresh on 2026-06-07)

## Context

The frontend reads `VITE_API_BASE_URL` from Vite env in 3 places:
runtime fallback (`src/lib/apiBase.ts:1`), runtime warn
(`src/lib/apiBase.ts:6`), build-time throw (`vite.config.ts:38`).
Each used a different "missing" predicate (`||`, `== null`, `== null`).
The empty-string (`''`) case silently fell through to staging on
production builds, exposing staging data on prod-looking deployments.

## Decision

Define "missing" as: `null` OR `undefined` OR empty string OR
whitespace-only string. Encapsulate in a single helper
`isMissingApiBase(value: string | null | undefined): boolean`. All
three check sites use it (or its 3-line inline equivalent for the
build-time gate). Empty string is treated as missing, not as an
"explicit empty" escape hatch.

## Consequences

### Positive
- Build-time and runtime checks are semantically identical.
- The "deliberately blank = use staging" escape hatch is removed;
  misconfiguration fails loudly at build time.
- A single test surface (the helper) locks the semantics in CI.

### Negative
- Anyone who relied on the escape hatch (none known) loses it.
  No committed `.env*` file or documented CI config uses `''`.

## Alternatives Considered

### Treat `''` as an explicit escape hatch
Rejected. The escape hatch was undocumented, conflicted with the
`.env.production` comment ("或留空使用默认值"), produced
3-way inconsistent behavior across check sites, and had no test
defending it as designed (the test at `apiBase.test.ts:34-40` locks
the inconsistency, not the design).
```

### 4.5 更新 api-base-urls.md 浏览器段

在 "Frontend (browser)" 表格下加一行:
```
| Missing semantics | `isMissingApiBase(value)` (see ADR-0011): null / undefined / empty / whitespace = missing |
```

## 5. 依赖关系

- **Blocked by**:Slice 2(3 处 check 已统一,顶层副作用删除不会让测试变红;技术上独立,但 review 顺序按 1→2→3)
- 阻断:无(本 slice 是终态)

## 6. 验收标准

- [ ] `src/lib/apiBase.ts:15` 删掉模块顶层 `validateApiBaseEnv(import.meta.env)` 调用
- [ ] `src/main.tsx` 顶部加 `import { validateApiBaseEnv } from '@/lib/apiBase';` + `validateApiBaseEnv(import.meta.env);`
- [ ] `main.tsx` 中 `validateApiBaseEnv(import.meta.env)` 调用位置在 `preloadDefaultTokenIcon()` 之前
- [ ] `.env.production:4` 注释改为 "(build 时强制,留空会 throw)"
- [ ] `docs/adr/0011-api-base-url-missing-semantics.md` 存在,Status: Accepted,Content 符合 ADR-FORMAT
- [ ] `docs/conventions/api-base-urls.md` 浏览器段加 missing semantics 一行
- [ ] 不新建 / 不修改其他 ADR
- [ ] `CONTEXT.md` **不**改(本改动无新领域术语,见 `docs/agents/domain.md` "single-context layout" 约定)
- [ ] **4-gate 全过**:`npm run lint && npm test && npm run build && npx tsc --noEmit`
- [ ] 浏览器侧快速 smoke:`npm run build && npm run preview` 后 curl `/` 确认页面正常加载(无运行时 throw)
- [ ] **1 个 commit**(commit message: `refactor(api-base): move validate side effect to main.tsx; add ADR-0011; fix misleading .env.production comment`)

## 7. 复杂度评估

**Low** — 1 行删 + 2 行加 + 1 个 ADR + 2 行注释;无逻辑改动

---

## 附录

### 关联文件路径

- `src/lib/apiBase.ts`(删 line 15)
- `src/main.tsx`(加 import + 1 行调用)
- `.env.production`(改 line 4 注释)
- `docs/adr/0011-api-base-url-missing-semantics.md`(新建)
- `docs/conventions/api-base-urls.md`(浏览器段加 1 行)

### 实施记录

(待 TDD 完成后回填)
