# 开发方案 - AAV-118 [Enhancement] 添加环境配置校验

> **状态**:方案已根据 grill 会话重新 scope(2026-06-07)。原方案写于 `validateEnvPlugin` 之前,已过期;新方案聚焦"3 处 check 不一致"+"顶层副作用"两个新问题。
> **关联 PRD**(working doc):`docs/plans/api-base-url-missing-semantics.md`
> **关联 ADR**(将落地):`docs/adr/0011-api-base-url-missing-semantics.md`

## Slices(本 plan 已拆为 3 个 sub-issue,每条独立可领取)

| # | Linear | Slice | 状态 | 文件 |
|---|---|---|---|---|
| 1 | [AAV-620](https://linear.app/aaveapy/issue/AAV-620/slice-13-extract-ismissingapibase-helper-tdd) | Extract `isMissingApiBase` helper (TDD, 7 cases) | Backlog,无依赖 | `aav-118-slice-1-extract-isMissingApiBase.md` |
| 2 | [AAV-621](https://linear.app/aaveapy/issue/AAV-621/slice-23-align-3-check-sites-flip-empty-string-test) | Align 3 check sites; flip empty-string test | Backlog,Blocked by AAV-620 | `aav-118-slice-2-align-check-sites.md` |
| 3 | [AAV-622](https://linear.app/aaveapy/issue/AAV-622/slice-33-move-side-effect-adr-0011-docs) | Move side effect to main.tsx; ADR-0011; .env comment fix | Backlog,Blocked by AAV-621 | `aav-118-slice-3-side-effect-and-docs.md` |

**3 个 slice 顺序落地,每个 1 commit,3 commit 总数 = master plan §4.2 的拆分**。

## 1. Issue 概述

前端 API base URL(`VITE_API_BASE_URL`)的"缺失"判定在 3 个检查点用了 3 种不同写法,导致空字符串(`''`)这一边界行为同时产生 3 个相互矛盾的副作用:**build 通过** + **运行时静默走 staging** + **不报警**。`apiBase.test.ts:34-40` 把这个不一致行为锁进测试,但代码里没有注释、ADR、文档解释过设计意图,大概率是历史叠加,不是设计。

需要在 `apiBase.ts` / `vite.config.ts` / `apiBase.test.ts` / `main.tsx` / `.env.production` 共 5 处对齐缺失语义,消除"空字符串静默走 staging"这个静默失败链。`validateEnvPlugin` 已在 `vite.config.ts:31-46` 存在并工作正确,**本方案不重新发明 build-time throw**,只解决"3 处 check 不一致"和"模块顶层副作用"两个新增问题。

## 2. 当前状态

| 检查点 | 文件:行 | 写法 | 空字符串 `''` 时 |
|---|---|---|---|
| 运行时兜底 | `src/lib/apiBase.ts:1` | `\|\|` | 静默走 staging |
| 运行时 warn | `src/lib/apiBase.ts:6` | `== null` | 不报警(但走兜底) |
| 构建时 throw | `vite.config.ts:38` | `== null` | build 过(不动) |
| 单元测试 | `src/lib/apiBase.test.ts:34-40` | 测"空字符串不报警" | 锁了不一致行为 |
| 模块顶层副作用 | `src/lib/apiBase.ts:15` | `validateApiBaseEnv(import.meta.env)` | 任何 import 触发 |
| `.env.production` 注释 | `.env.production:4` | "(或留空使用默认值)" | 误导开发者 |

## 3. 影响范围

- **前端仓库**:`aaveapy` / `lovable` 分支
- **主要涉及配置管理和启动流程**
- **不影响**:`useAaveMarkets.ts` / `useSideDataMeta.ts` 的 fetch 调用点(它们消费 `API_BASE`,值不变)
- **不影响**:`scripts/lib/default-api-bases.mjs` 等 Node 脚本(独立的 Node 端默认 URL,本方案明确 out of scope)
- **不影响**:第三方 API base(`MERKL_API_BASE` / `COINGECKO_API_BASE` / `SEO_API_BASE`),本方案只处理 `VITE_API_BASE_URL`

## 4. 实现方案

### 4.1 设计思路

引入一个**深模块** `isMissingApiBase(value)`,集中"什么是缺失"这一概念。三处检查点全部使用它(或其内联等价物),消除 3 种不同写法。任何对"缺失"语义的修改都只能改这一处。

副作用从模块顶层挪到 `main.tsx` 显式 bootstrap,理由:
- 任何 `import { API_BASE }` 触发副作用是隐式的、不可追踪的
- 测试隔离需要每个 `it` 都 spy console.warn(`apiBase.test.ts:5-6` 等 5 处)
- 显式调用副作用面是单一的

**保留** `validateEnvPlugin`(`vite.config.ts`)的 build-time throw,这是 3 处中最强的"哨兵";`console.warn` 仍可作为运行时反馈,这两个不冲突。

### 4.2 具体步骤(建议 3 个 commit,每个原子化)

#### Commit 1: 抽 `isMissingApiBase` helper + 测试先行(TDD)

按 `tdd` skill 的 tracer bullet 流程,一个 test → 一个 impl → pass。**不批量写测试**。

**RED → GREEN 序列(每个 cycle 一个 test 一个 impl)**:

1. `isMissingApiBase(null)` → `true`(RED → GREEN: 1 行)
2. `isMissingApiBase(undefined)` → `true`(RED → GREEN: 改 1 行)
3. `isMissingApiBase('')` → `true`(RED → GREEN: 加 `|| v.trim() === ''`)
4. `isMissingApiBase('   ')` → `true`(RED → GREEN: 已被 `trim()` 覆盖,passes)
5. `isMissingApiBase('https://api.aaveapy.com/api')` → `false`(RED → GREEN: 兜底 false)
6. `isMissingApiBase('0')` → `false`(edge case: 数字 0 字符串不是缺失)
7. `isMissingApiBase('/')` → `false`(edge case: 短 URL 不是缺失)

文件改动:
- 新增 `src/lib/apiBase.test.ts` 中的 `describe('isMissingApiBase', ...)` block(7 个 it)
- `src/lib/apiBase.ts` 新增 `export function isMissingApiBase(v: string | null | undefined): boolean { return v == null || v.trim() === ''; }`

**Commit message**: `refactor(api-base): extract isMissingApiBase helper (TDD, 7 cases)`

#### Commit 2: 替换 3 处 check + 修测试断言

文件改动:
- `src/lib/apiBase.ts:1` 改为 `isMissingApiBase(env)` 三元
- `src/lib/apiBase.ts:6` 改为 `isMissingApiBase(env.VITE_API_BASE_URL)`
- `vite.config.ts:38` 内联 3 行同样的表达式(不 import,跨环境 import 风险大于收益)
- `src/lib/apiBase.test.ts:34-40` 翻转断言:production 下空字符串 → **应该** warn
- `src/lib/apiBase.test.ts:21` 等 case 不变

**Commit message**: `fix(api-base): align 3 check sites on isMissingApiBase; flip empty-string test`

#### Commit 3: 副作用搬家 + 文档 + ADR

文件改动:
- `src/lib/apiBase.ts:15` 删掉模块顶层 `validateApiBaseEnv(import.meta.env)` 调用
- `src/main.tsx` 顶部加 `import { validateApiBaseEnv } from '@/lib/apiBase';` + `validateApiBaseEnv(import.meta.env);`(放 `preloadDefaultTokenIcon()` 之前)
- `.env.production:4` 改注释:删 "或留空使用默认值"
- 新增 `docs/adr/0011-api-base-url-missing-semantics.md`(见 §4.3)
- 更新 `CONTEXT.md` 不需要(无新领域术语,见 docs/agents/domain.md 的 "single-context layout" 约定)
- 更新 `docs/conventions/api-base-urls.md`:在 "Frontend (browser)" 表格加一行说明"missing value semantics: `isMissingApiBase`"

**Commit message**: `refactor(api-base): move validate side effect to main.tsx; add ADR-0011; fix misleading .env.production comment`

### 4.3 ADR 草稿(将落 `docs/adr/0011-api-base-url-missing-semantics.md`)

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

### 4.4 CI/CD 配置建议(沿用原 plan)

- 在 Vercel 项目环境变量配置中,确保 `VITE_API_BASE_URL` 在 production 必须设置
- 不需要新加构建脚本(已由 `validateEnvPlugin` 覆盖)

## 5. 依赖关系

- 无直接依赖其他 Issue
- 建议关注:`docs/conventions/api-base-urls.md` 中 4 处 staging URL 重复的问题,作为单独 P0 后续 ticket(本方案明确 out of scope)

## 6. 验收标准

- [ ] `src/lib/apiBase.ts` 导出 `isMissingApiBase` 函数,签名 `(v: string | null | undefined) => boolean`
- [ ] `src/lib/apiBase.test.ts` 包含 7 个 `isMissingApiBase` 的直接单测(null / undefined / '' / 空白 / 有效 URL / '0' / '/')
- [ ] `src/lib/apiBase.test.ts:34-40` 断言翻转:production + 空字符串 → 报警
- [ ] `src/lib/apiBase.ts:1` 用 `isMissingApiBase` 替换 `||`
- [ ] `src/lib/apiBase.ts:6` 用 `isMissingApiBase` 替换 `== null`
- [ ] `src/lib/apiBase.ts:15` 模块顶层 `validateApiBaseEnv(import.meta.env)` 调用删除
- [ ] `src/main.tsx` 显式调用 `validateApiBaseEnv(import.meta.env)`(bootstrap 顺序第一)
- [ ] `vite.config.ts:38` 用同样的 3 行表达式替换 `== null`
- [ ] `.env.production:4` 注释删去 "或留空使用默认值"
- [ ] `docs/adr/0011-api-base-url-missing-semantics.md` 存在,格式符合 ADR-FORMAT
- [ ] `docs/conventions/api-base-urls.md` "Frontend (browser)" 段加一行 missing semantics 说明
- [ ] **4-gate 全过**:`npm run lint && npm test && npm run build && npx tsc --noEmit`
- [ ] `npm run build` 故意把 `.env.production` 中 `VITE_API_BASE_URL=` 留空 → build throw(回归测试)
- [ ] 不在 scope 内的文件(`useAaveMarkets.ts` / `useSideDataMeta.ts` / `scripts/lib/*`)完全无改动

## 7. 复杂度评估

- **复杂度**:Low
- **理由**:
  - `validateEnvPlugin` 已经存在并工作正确,本方案不重新发明 build-time throw
  - 新增的 `isMissingApiBase` 是 3 行纯函数
  - 行为变化只影响 `VITE_API_BASE_URL=''` 这一边界场景(无已知用户)
  - 主要工作是测试和文档,不是新逻辑
- **风险**:
  - 唯一可观测行为变化:`VITE_API_BASE_URL=''` 在 prod build 时从"静默走 staging"变成"build 失败"。这正是修复目标
  - 没有任何 committed `.env*` 文件 / Vercel env / CI 注入使用 `''`,所以零回归风险

---

# 附录

## 相关文件路径

- `src/lib/apiBase.ts`(修改)
- `src/lib/apiBase.test.ts`(修改 + 新增)
- `vite.config.ts`(修改 `validateEnvPlugin` 一处)
- `src/main.tsx`(修改,加 1 行显式调用)
- `.env.production`(修改注释)
- `docs/adr/0011-api-base-url-missing-semantics.md`(新增)
- `docs/conventions/api-base-urls.md`(修改,加一行说明)

## Grill 修正记录(原 plan → 新 plan)

| 原 plan 声明 | 实际情况 | 修正 |
|---|---|---|
| "代码中无环境变量校验逻辑" | `validateEnvPlugin` 已在 `vite.config.ts:31-46` | 不重写,只对齐其他两处 |
| "throw 是可选,console.warn 即可" | throw 已经是强制 | 保留 throw,移除"可选"表述 |
| 未提空字符串 | 3 处 check 不一致是真 bug | 列为中心议题 |
| 例子 URL 漏 `/api` | 实际是 `.../api` | 改正确值 |
| "内联在 apiBase.ts 即可" | 需要跨 3 处对齐 | 抽 `isMissingApiBase` helper |
| "side effect 可选放 main.tsx" | 当前在 `apiBase.ts:15` 顶层,真问题 | 强制挪到 main.tsx |
| "单元测试或手动记录" | AGENTS.md 强制 4-gate | TDD + 7 单测 + 1 翻转 |
| 无 ADR | 改动符合 ADR 三判据 | 加 ADR-0011 |
| 复杂度"Medium" | 实际"Low"(build 关卡已存在) | 改 Low |
| 未提 4 处 URL 重复 | 真问题但 scope 太大 | 显式 out of scope,后续 ticket |
| 未提 `.env.production` 注释 | 注释误导 | 改注释 |
| 未提模块顶层副作用 | 真问题 | 挪到 main.tsx |
| "CI/CD 确保 Vercel env 必填" | 有用建议 | 吸收,保留 |

## 实施记录

(待 TDD 完成后回填)
