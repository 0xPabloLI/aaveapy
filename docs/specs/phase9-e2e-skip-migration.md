# Spec: Phase 9 — E2E Platform skip→describe Migration

> Linear: AAV-1154
> Parent: AAV-1143

## Problem Statement

25 处 E2E 测试使用 `test.skip(testInfo.project.name.includes('mobile'))` 模式做平台互斥跳过，违反 AGENTS.md 规范。该模式的问题：
1. 测试在"错误"的 project 中仍被执行，只是被 skip — 浪费 CI 时间
2. `test.skip(condition)` 是条件跳过，而非路由分发 — 语义不精确
3. 缺少对应平台测试用例时应补充，而非 skip

## Solution

用 Playwright project config `testIgnore` 替代 `test.skip`：
- **单平台文件**（6 个）：在对应 project 的 `testIgnore` 中列举，不拆文件
- **混合文件**（4 个）：拆分为 `.desktop.spec.ts` + `.mobile.spec.ts`，共享 setup 提取到 `e2e/helpers/`
- 截图基线：`segmented-toggle-visual` 的 6 个 PNG `git mv` 迁移到新目录

## User Stories

1. 作为开发者，我希望 E2E 测试在正确的 project 中执行，这样 CI 不会浪费时间跑注定 skip 的测试
2. 作为开发者，我希望 desktop-only 测试只在 `chromium` project 中出现，这样测试列表干净
3. 作为开发者，我希望 mobile-only 测试只在 `mobile-chromium` project 中出现，这样测试列表干净
4. 作为开发者，我希望 `grep "test.skip.*project.name"` 返回 0 条 platform-conditional 匹配，这样 AGENTS.md 规范被满足
5. 作为开发者，我希望共享 setup 逻辑被提取到 helpers 中，这样拆分后的文件不重复代码
6. 作为开发者，我希望截图基线不丢失，这样视觉回归保护不中断

## Implementation Decisions

### Playwright config 路由
- `chromium` project 新增 `testIgnore`：`/.*\.mobile\.spec\.ts/` + 3 个 mobile-only 原始文件
- `mobile-chromium` project 扩展 `testIgnore`：`/.*\.desktop\.spec\.ts/` + 3 个 desktop-only 原始文件 + 现有 2 个

### 文件拆分清单

| 原文件 | 拆分后 | 共享 helper |
|--------|--------|-------------|
| `portfolio-incentive-calculation.spec.ts` | `.desktop.spec.ts` + `.mobile.spec.ts` | `helpers/portfolio-setup.ts` |
| `segmented-toggle-visual.spec.ts` | `.desktop.spec.ts` + `.mobile.spec.ts` | 无（各自独立） |
| `portfolio-cross-reserve-offset.spec.ts` | `.desktop.spec.ts` + `.mobile.spec.ts` | `helpers/cross-offset-setup.ts` |
| `portfolio-results-inline-delta.spec.ts` | 不拆，加 `testIgnore` 到 mobile-chromium | — |

### 单平台文件处理

| 文件 | 平台 | 路由方式 |
|------|------|---------|
| `top-opportunities-mobile-layout.spec.ts` | mobile | chromium `testIgnore` |
| `portfolio-mobile-spacing.spec.ts` | mobile | chromium `testIgnore` |
| `reserves-table-mobile-interactions.spec.ts` | mobile | chromium `testIgnore` |
| `reserves-table-market-filter-pin.spec.ts` | desktop | mobile-chromium `testIgnore` |
| `reserves-table-interactions.spec.ts` | desktop | mobile-chromium `testIgnore` |
| `reserves-table-stick.spec.ts` | desktop | mobile-chromium `testIgnore` |

### 截图基线迁移
- `e2e/segmented-toggle-visual.spec.ts-snapshots/` → 拆为 `.desktop.spec.ts-snapshots/` + `.mobile.spec.ts-snapshots/`
- 保持 PNG 文件名不变（test title path 不变）

## Testing Decisions

- **验证方式**：`npx playwright test --list` 按项目确认测试路由正确
- **回归保护**：截图基线 `git mv` 保留，不重新生成
- **grep 验证**：`grep -r "test.skip.*project.name" e2e/` 返回 0 条 platform-conditional 匹配
- **合理 skip 保留**：`!WATCH_ADDRESS`、数据依赖 skip 不在迁移范围

## Out of Scope

- AAV-1146~1149（testid + snapshot 补全）— 独立 ticket
- AAV-1150（SummaryCard delta test 修复）— Backlog
- 添加新测试用例（缺少对应平台时补测试）— 独立 ticket
- 修改 ESLint/tsconfig 配置（`e2e/` 已被两者忽略）

## Scenario & Risk Verification

| # | 场景 | 风险 | 验证方法 | 预期结果 |
|---|------|------|---------|---------|
| S1 | 拆分后 desktop test 在 mobile-chromium 运行 | 测试找不到 desktop-only DOM 元素 | `--list --project=mobile-chromium` | desktop 文件不出现在列表中 |
| S2 | 拆分后 mobile test 在 chromium 运行 | 测试找不到 mobile-only DOM 元素 | `--list --project=chromium` | mobile 文件不出现在列表中 |
| S3 | 截图基线路径变化 | `toHaveScreenshot` 找不到基线 → 测试失败 | 检查 snapshot 目录存在 | PNG 在正确目录中 |
| S4 | 共享 helper import 路径错误 | TypeScript 编译错误（Playwright 内部 ts-check） | `--list` 成功列出测试 | 无 import 错误 |
| S5 | `testIgnore` glob 过于宽泛 | 误排除不应排除的文件 | 检查 `--list` 测试总数 | 与迁移前 dispatched 测试数一致 |
| S6 | `portfolio-results-inline-delta` 加到 mobile testIgnore | 原本在 mobile 也 skip（Pattern A），现在被 testIgnore | `--list --project=mobile-chromium` | 文件不在列表中 |
| S7 | `reserves-table-stick` 的 `strict stick` test 环境变量 skip 保留 | 环境变量 skip 被 testIgnore 覆盖 | grep 确认 `STRICT_STICK_ASSERT` skip 仍在 | 合理 skip 保留 |
| S8 | `portfolio-cross-reserve-offset` 的数据依赖 skip 保留 | `hasScenarios` skip 被 testIgnore 覆盖 | grep 确认 `No cross-offset` skip 仍在 | 合理 skip 保留 |
