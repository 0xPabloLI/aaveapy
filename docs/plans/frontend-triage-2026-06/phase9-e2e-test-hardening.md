# Phase 9: 前端 E2E 测试加固

> Issues: AAV-1144 (spec) → AAV-1145~1149; AAV-1151 (spec) → AAV-1152~1158; AAV-1150
> 估计: 1-2 sessions
> Branch: `test/aav-1144-e2e-hardening`

## 代码审查状态（2026-07-21）

### 已完成

- **AAV-1142** (Fix 22 Playwright failures) — **Done** ✅
- **AAV-1145** (Switch to staging API) — **代码已实现** ✅
  - `playwright.config.ts:21` — `command: 'npm run dev:staging -- --host 127.0.0.1 --port 4173'`
- **AAV-1152** (data-cell on Portfolio metric cells) — **代码已实现** ✅
  - `PortfolioUnifiedTable.tsx` — 12 列全部有 `data-cell` 属性：reserve, supply-input, borrow-input, supply-native, borrow-native, supply-incentive, borrow-incentive, supply-total, borrow-total, supply-usd-per-day, borrow-usd-per-day, net-usd-per-day
- **AAV-1153** (data-testid on Mobile DeltaRow) — **代码已实现** ✅
  - `MobilePortfolioCard.tsx:84-87` — `data-testid="delta-current"`, `data-testid="delta-after"`, `data-testid="delta-value"`
- **AAV-1151** (Spec) — **已写 spec** ✅
- **E2E 测试文件已存在**：
  - `e2e/portfolio-incentive-calculation.spec.ts` — 10 个测试场景，使用 data-cell/data-testid
  - `e2e/portfolio-cross-reserve-offset.spec.ts` — 使用 data-cell/data-after

### 未完成

#### 组 A：AAV-1146~1149（testid + snapshot + skip 迁移）

| Issue | 状态 | 代码证据 |
|-------|------|----------|
| AAV-1146 | 未知 | 需确认 `PortfolioModeToggle` 是否有 testid |
| AAV-1147 | 未知 | 需确认 E2E selector 是否已迁移到 testid |
| AAV-1148 | 未完成 | 视觉快照基线未更新 |
| AAV-1149 | 未完成 | 需验证 mobile-spacing 测试通过 |

#### 组 B：AAV-1154~1158（skip→describe 迁移）

| Issue | 状态 | 代码证据 |
|-------|------|----------|
| AAV-1154 | **未完成** | E2E 中仍有大量 `test.skip(condition)` 模式（见下方统计） |
| AAV-1155~1158 | 部分完成 | `portfolio-incentive-calculation.spec.ts` 已有测试，但仍用 `test.skip` |

**`test.skip(condition)` 统计**（违反 AGENTS.md E2E 规范）：

```
portfolio-incentive-calculation.spec.ts — 11 处 test.skip
segmented-toggle-visual.spec.ts — 7 处 test.skip
portfolio-cross-reserve-offset.spec.ts — 4 处 test.skip
reserves-table-scenario-pin.spec.ts — 1 处
reserves-table-market-filter-pin.spec.ts — 1 处
reserves-table-mobile-interactions.spec.ts — 1 处
reserves-table-interactions.spec.ts — 1 处
reserves-table-stick.spec.ts — 2 处
portfolio-mobile-spacing.spec.ts — 1 处
portfolio-results-inline-delta.spec.ts — 2 处
watch-resubmit-refresh.spec.ts — 2 处
top-opportunities-mobile-layout.spec.ts — 3 处
defi-yield-tracker-faq-anchor.spec.ts — 1 处
wallet-reconnect-after-refresh.spec.ts — 2 处
explorer-links-smoke.spec.ts — 1 处
```

> **注意**：部分 `test.skip` 是合理的（如 `!WATCH_ADDRESS` 环境变量检查、`No cross-offset Merkl campaigns found` 数据依赖检查）。AAV-1154 的 scope 是 platform 互斥的 `test.skip(mobile/desktop)` 模式。

#### 独立

| Issue | 状态 | 代码证据 |
|-------|------|----------|
| AAV-1150 | Backlog | `portfolio-results-inline-delta.spec.ts:48` — SummaryCard delta test 仍 skipped |

## 关键设计决策

- staging API 切换：已用 `dev:staging` 命令 ✅
- testid 命名规范：`data-cell="side-metric"` + `data-testid="delta-*"` ✅
- test.skip → test.describe 迁移：**大量未完成**，需按 AGENTS.md 规范逐文件迁移 platform 互斥 skip

## 优先级

1. **AAV-1154** — 最高优先级：`test.skip(mobile/desktop)` → `test.describe` 迁移（11+7+4+1+1+1+1+1+2+3 = ~32 处需迁移）
2. **AAV-1150** — SummaryCard delta test 修复
3. **AAV-1146~1149** — testid + snapshot 补全
