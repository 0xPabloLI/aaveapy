# 开发方案 - AAV-118 Slice 2: Align 3 check sites on `isMissingApiBase`; flip empty-string test

> **Linear**: [AAV-621](https://linear.app/aaveapy/issue/AAV-621/slice-23-align-3-check-sites-flip-empty-string-test)

## Parent

AAV-118 — 添加环境配置校验(master plan: `docs/plans/linear-issues/phase-2/aav_118_plan.md`)

## 1. Issue 概述

将"缺失"语义统一到 `isMissingApiBase`,替换 3 个检查点(`apiBase.ts:1` / `apiBase.ts:6` / `vite.config.ts:38`)的不同写法;同时翻转 `apiBase.test.ts:34-40` 锁定的"空字符串不报警"为"空字符串报警",反映新契约。

**可观测行为变化**:`VITE_API_BASE_URL=''` 在 production build 时,从"静默走 staging"变成"`validateEnvPlugin` 抛错,build 失败"。这是修复目标,不是回归。

## 2. 当前状态

| 检查点 | 文件:行 | 现状写法 | 替换为 |
|---|---|---|---|
| 运行时兜底 | `src/lib/apiBase.ts:1` | `\|\|` | `isMissingApiBase(env)` |
| 运行时 warn | `src/lib/apiBase.ts:6` | `== null` | `isMissingApiBase(env.VITE_API_BASE_URL)` |
| 构建时 throw | `vite.config.ts:38` | `== null` | 内联 3 行同等表达式(不跨环境 import) |
| 单元测试断言 | `src/lib/apiBase.test.ts:34-40` | "空字符串不报警" | 翻为"空字符串报警" |

`vite.config.ts` 不 import `src/lib/apiBase.ts`,内联同样的表达式。理由:跨环境 import 一个读 `import.meta.env` 的模块风险大于收益,内联 3 行可见且可对照。

## 3. 影响范围

- 修改 `src/lib/apiBase.ts` line 1 + line 6
- 修改 `vite.config.ts:38`
- 修改 `src/lib/apiBase.test.ts:34-40` 断言
- **不动** `src/lib/apiBase.ts:15` 顶层副作用(那是 slice 3)
- **不动** `main.tsx`
- **不动** `.env.production`
- **不动** 任何调用点(`useAaveMarkets.ts` / `useSideDataMeta.ts`)

## 4. 实现方案

### 4.1 替换 apiBase.ts line 1
```ts
// 改前
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com/api';
// 改后
export const API_BASE = isMissingApiBase(import.meta.env.VITE_API_BASE_URL)
  ? 'https://staging-api.aaveapy.com/api'
  : import.meta.env.VITE_API_BASE_URL;
```

### 4.2 替换 apiBase.ts line 6
```ts
// 改前
if (env.MODE === 'production' && env.VITE_API_BASE_URL == null) {
// 改后
if (env.MODE === 'production' && isMissingApiBase(env.VITE_API_BASE_URL)) {
```

### 4.3 替换 vite.config.ts validateEnvPlugin
```ts
// 改前
if (env.VITE_API_BASE_URL == null) {
// 改后
if (env.VITE_API_BASE_URL == null || env.VITE_API_BASE_URL.trim() === '') {
```

### 4.4 翻转 apiBase.test.ts:34-40 断言
```ts
// 改前:it('does not warn when VITE_API_BASE_URL is empty string in production', () => { ... expect(warn).not.toHaveBeenCalled(); });
// 改后:it('warns when VITE_API_BASE_URL is empty string in production (treated as missing)', () => { ... expect(warn).toHaveBeenCalledOnce(); });
```

### 4.5 不做
- 不重构 line 15 顶层副作用(slice 3 负责)
- 不动 `main.tsx`(slice 3 负责)
- 不改 `.env.production` 注释(slice 3 负责)
- 不新建 ADR(slice 3 负责)

## 5. 依赖关系

- **Blocked by**:Slice 1(`isMissingApiBase` 必须先存在)
- 阻断:Slice 3(虽然技术上独立,但 review 顺序按 1→2→3 走,2 落地后能跑 4-gate 验)

## 6. 验收标准

- [ ] `src/lib/apiBase.ts:1` 用 `isMissingApiBase` 替换 `||`
- [ ] `src/lib/apiBase.ts:6` 用 `isMissingApiBase` 替换 `== null`
- [ ] `vite.config.ts:38` 用同样的 3 行表达式(不 import `src/lib/apiBase.ts`)
- [ ] `src/lib/apiBase.test.ts:34-40` 测试名改为 "warns when empty string in production",断言改为 `expect(warn).toHaveBeenCalledOnce()`
- [ ] 现有 4 个 validateApiBaseEnv 测试 + 7 个 isMissingApiBase 测试 全过
- [ ] 手动回归:`npm run build` 故意把 `.env.production` 中 `VITE_API_BASE_URL=` 留空 → build 抛错(可临时改、build 完恢复)
- [ ] `src/lib/apiBase.ts:15` 顶层 `validateApiBaseEnv(import.meta.env)` 调用**未**删
- [ ] `main.tsx` **未**改
- [ ] `.env.production` **未**改
- [ ] **4-gate 全过**:`npm run lint && npm test && npm run build && npx tsc --noEmit`
- [ ] **1 个 commit**(commit message: `fix(api-base): align 3 check sites on isMissingApiBase; flip empty-string test`)

## 7. 复杂度评估

**Low** — 3 处 1-1 替换 + 1 个测试翻转 + 1 个 commit

---

## 附录

### 关联文件路径

- `src/lib/apiBase.ts`(line 1, line 6)
- `vite.config.ts`(line 38)
- `src/lib/apiBase.test.ts`(line 34-40)

### 实施记录

(待 TDD 完成后回填)
