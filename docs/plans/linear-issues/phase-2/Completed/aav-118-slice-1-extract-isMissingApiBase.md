# 开发方案 - AAV-118 Slice 1: Extract `isMissingApiBase` helper (TDD, 7 cases)

> **Linear**: [AAV-620](https://linear.app/aaveapy/issue/AAV-620/slice-13-extract-ismissingapibase-helper-tdd)

## Parent

AAV-118 — 添加环境配置校验(master plan: `docs/plans/linear-issues/phase-2/aav_118_plan.md`)

## 1. Issue 概述

抽出"什么是 API base URL 缺失"的单一判定函数 `isMissingApiBase(value)`,作为该项目深模块,后续 3 个检查点(运行时兜底 / 运行时 warn / 构建时 throw)和 ADR-0011 锁定行为的中心。

按 TDD skill 的 tracer bullet 流程,7 个 it case 一个一个 red→green,不在 RED 阶段 batch 写测试。

## 2. 当前状态

`src/lib/apiBase.ts` 中,"缺失"语义被表达为 `||`(line 1)和 `== null`(line 6)两种不同写法,空字符串 `''` 在两处表现不一致。本 slice 抽 helper,但不替换调用点(由 slice 2 负责);仅确保 helper 自身可独立测,行为锁定。

## 3. 影响范围

- **新增** `src/lib/apiBase.ts` 中的 `export function isMissingApiBase(v: string | null | undefined): boolean`
- **新增** `src/lib/apiBase.test.ts` 中的 `describe('isMissingApiBase', ...)` 块,7 个 it
- **不动**其他文件,不改任何调用点

## 4. 实现方案(严格 RED → GREEN 循环,7 cycle)

每 cycle 一个 test → 一个 minimal impl → pass,**不** batch 写测试, **不** 提前写 "未来" 的 case。

| Cycle | Test (RED) | 最小 Impl (GREEN) |
|---|---|---|
| 1 | `isMissingApiBase(null)` → `true` | `return v == null;` |
| 2 | `isMissingApiBase(undefined)` → `true` | 已 pass(被 `== null` 覆盖) |
| 3 | `isMissingApiBase('')` → `true` | 加 `\|\| v === ''` |
| 4 | `isMissingApiBase('   ')` → `true` | 改 `\|\| v.trim() === ''` |
| 5 | `isMissingApiBase('https://api.aaveapy.com/api')` → `false` | 已有兜底,pass |
| 6 | `isMissingApiBase('0')` → `false`(edge) | 已有兜底,pass(防止后续误改 `v === '0'` 判断) |
| 7 | `isMissingApiBase('/')` → `false`(edge) | 已有兜底,pass(防止后续误改 `v.length === 0` 判断) |

最终函数:
```ts
export function isMissingApiBase(v: string | null | undefined): boolean {
  return v == null || v.trim() === '';
}
```

## 5. 依赖关系

- **无 Blocked by**(本 slice 是该 work stream 的入口)
- 阻断:Slice 2(替换调用点)必须等本 slice 落地,因为 Slice 2 的调用点要 import 这个 helper

## 6. 验收标准

- [ ] `src/lib/apiBase.ts` 导出 `isMissingApiBase(v: string | null | undefined): boolean`
- [ ] `src/lib/apiBase.test.ts` 包含 `describe('isMissingApiBase', ...)` 块,**恰好** 7 个 it,覆盖 §4 表中 7 个 case
- [ ] 7 个 test 顺序按 §4 cycle 顺序(commit 历史能看出 red→green 节奏)
- [ ] **不** 修改 `apiBase.ts` 中 line 1 / line 6 / line 15 任何已有代码
- [ ] **不** 修改 `vite.config.ts`
- [ ] **不** 修改 `.env.production`
- [ ] **不** 新建 ADR(那是 slice 3 的事)
- [ ] **不** 新建 `docs/plans/linear-issues/phase-2/` 下的新文件
- [ ] **4-gate 全过**:`npm run lint && npm test && npm run build && npx tsc --noEmit`
- [ ] `git log` 上是**一个** commit(commit message: `refactor(api-base): extract isMissingApiBase helper (TDD, 7 cases)`)

## 7. 复杂度评估

**Low** — 1 个 3 行函数 + 7 个单测 + 1 个 commit

---

## 附录

### 关联文件路径

- `src/lib/apiBase.ts`(加 export)
- `src/lib/apiBase.test.ts`(加 describe 块)

### 实施记录

(待 TDD 完成后回填:cycle #, commit hash, 4-gate 结果)
