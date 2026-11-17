# Spec: e2e offset-ladder oracle hardening + platform split (AAV-1395)

> Linear: AAV-1395
> Origin: AAV-1333 复核（2026-11-17）的 5 条发现
> Scope: test-only + config + docs. 不改任何产品代码。

## Problem Statement

AAV-1333 交付后复核发现 5 个问题，全部落在 e2e 的"证明力"上：测试可以是绿的，但不证明它声称的事。

1. **[Medium] 阶梯 oracle 可假绿** — `readIncentiveAfter` 在 `span[data-after]` 缺失时返回 0（`e2e/test-reserves.ts`）。`assertLadderRungs` 用 `(baseline − after)/baseline` 计算，于是"整行渲染坏掉"= `measured = 1`，每一档都通过。
2. **[Low] points 组被当成 0** — `computableAprPercent` 只累加 `campaignApr`；points breakdown 在 UI 里经 `tydroPointToUsdRate` 折算成 APY，但在 plan 的分母里贡献 0 ⇒ 混合组 target 的 `totalApr` 偏小 ⇒ 期望降幅偏大 ⇒ 假红（或经门控后消失）。
3. **[Low] `weight < 1` 无端到端证据** — 单测 L12 只验证 plan 自己的算术；stub 与 live 场景都是 `weight = 1`。
4. **[Low/文档] AAV-1333 spec 的全量计数 4445 不可复现** — 实测 4440（文件数一致）。
5. **[Low/规范] `test.skip(testInfo.project.name ...)` 出现在 13 个 e2e 文件** — 违反 AGENTS.md「E2E 测试禁止按 platform 互斥 skip」；仓库已有正确先例（`*.desktop.spec.ts` / `*.mobile.spec.ts` + `playwright.config.ts` `testIgnore`）。

复核同时挖出一个**更严重的既有假绿**（发现 1 的实证）：

> live self-loop 第 2 档（borrow $100k）实际渲染 `'—'`，旧 reader 读成 0，于是旧断言 `0.5/0.78/0.78` 一直"通过"。

根因在产品侧：`portfolioSimulator.ts` 的 `crossReservePositions` 用 `group.borrowUsd`（**原始输入**）算 incentive，LTV 钳制只改显示额（`computeLtvClamping` → `effectiveUsd`）并给 `ltv_cap` 警告。所以 AAV-1333 的 self-loop `capacity = min(borrowRoom, gross × ltv)` 从一开始就低估了输入能借的额度。

## Solution

### A. Oracle 加固（发现 1–3）

**A1 — 把"读 0"与"不存在"分开**

- 新增 `e2e/incentiveReading.ts`：`IncentiveCellReading { present, numeric, value }` + `classifyIncentiveReading(reading, expectedAfterZero)`。
  - 数值 cell 永远通过；
  - 缺 cell 仅在 `expectedAfterZero` 档位通过（`'—'` 是合法的零形态）；
  - 缺 cell 的失败理由固定为 `incentive cell disappeared (no data-after span) — reading it as 0 would hide a broken row`；非有限数的理由为 `incentive cell data-after is not a finite number`。
- `e2e/test-reserves.ts`：`readIncentiveAfter` 拆出 `readIncentiveCellState`（DOM 事实）+ 保留 `readIncentiveAfter`（只返回 value，兼容既有调用方）。
- `assertLadderRungs`（拆分后位于 `e2e/portfolio-cross-reserve-offset.helpers.ts`）：先断言目标行仍存在（`[data-reserve-id="${targetReserveId}"]` count > 0），再 `classifyIncentiveReading`，用 `reading.value` 作 `after`。

**A2 — points 混合组排除**

`e2e/reserveDiscovery.ts` 的 discovery 循环新增：

```ts
const hasPointsBreakdown = typedGroups.some((group) =>
  breakdownsOfGroup(group).some(
    (b) => isComputableMerklCampaign(b, nowIso) && parseApr(b.pointsPerThousandUsd) > 0,
  ),
);
if (hasPointsBreakdown) continue;
```

与既有 brevis / `supplyIncentives` 同策略：skipping 是安全失败模式，绝不拿错的期望值去断言。`computableAprPercent` 加注释说明它**不是** UI 显示口径（points 不计入）。

**A3 — stub 覆盖 `weight < 1`**

`e2e/crossReserveOffsetStub.ts` 在 `structuredClone` 后注入第二个、无约束的组（从 fixture 真实组克隆，`opportunityId` 与每个 `breakdowns[].campaignId` 追加 `-nonresponding`），再回读 plan 断言 `steps[1].expectedDecreaseRatio === 0.25 ± 1e-9`；不成立即 `fail`（stub 形态漂移必须响，不是静默降级）。

**A4 — self-loop capacity 订正（发现 1 的实证带出）**

`planSelfLoop` 的 `capacity` 从 `min(borrowRoom, gross × ltv/100)` 改为 `borrowRoom(target) ?? +∞`。live plan 变为 gross $100,000 / capacity $1,541,363 / rungs 50k,100k,200k / 比例 `0.5,1,1` / 第 2–3 档 `expectedAfterZero`——与 app 的真实行为一致。AAV-1333 矩阵的 L6/L7/L8/L9/L10/L12–L14 与 spec 公式同步订正。

### B. Platform 拆分（发现 5）

13 个文件 → 16 个 spec 文件（10 个纯重命名 + 3 个拆分 + 3 个 co-located helper）：

| 原文件 | 结果 |
| --- | --- |
| `api-fields-verification.spec.ts` | `.desktop` |
| `verify-target-total-apr.spec.ts` | `.desktop` |
| `reserves-table-stick.spec.ts` | `.desktop` |
| `reserves-table-interactions.spec.ts` | `.desktop` |
| `reserves-table-scenario-pin.spec.ts` | `.desktop` |
| `reserves-table-market-filter-pin.spec.ts` | `.desktop` |
| `portfolio-results-inline-delta.spec.ts` | `.desktop` |
| `top-opportunities-mobile-layout.spec.ts` | `.mobile` |
| `reserves-table-mobile-interactions.spec.ts` | `.mobile` |
| `portfolio-mobile-spacing.spec.ts` | `.mobile` |
| `segmented-toggle.spec.ts` | `.desktop`（3 条）+ `.mobile`（3 条） |
| `portfolio-incentive-calculation.spec.ts` | `.desktop`（7 条）+ `.mobile`（5 条）+ `.helpers.ts` |
| `portfolio-cross-reserve-offset.spec.ts` | `.desktop`（2 条）+ `.mobile`（2 条）+ `.helpers.ts` |

- `playwright.config.ts`：`chromium.testIgnore = [/\.mobile\.spec\.ts/]`；`mobile-chromium.testIgnore = [/\.desktop\.spec\.ts/, /reserves-table-simulation-full-after-scenario-pin\.spec\.ts/, /reserves-table-simulation-nested-scroll\.spec\.ts/]`（后两个是既有的 mobile 不适配文件）。
- 非平台 skip 全部保留：`portfolio-results-inline-delta.desktop.spec.ts` 的 string-overload 永久 skip、`enforceReserveGate` / `enforceEmptyListGate` 数据门、incentive 的 `expectValueOrSkip` / `readDataCurrentOrSkip`、staging discovery skip。
- 不改写任何被 `scripts/pre-push-e2e.mjs` 的 `GREP_INVERT` 按标题排除的用例名（`does not force pin` / `M9 点整行` / `\(1\) not at anchor`）。
- `scripts/e2e-static-gate.test.mjs`：硬编码 `endsWith('reserves-table-interactions.spec.ts')` 改为 `includes('reserves-table-interactions')`（重命名后仍能匹配 stem）。

### C. 文档（发现 4 + 5）

- AAV-1333 spec：全量计数改 4440 并附测量说明；self-loop 公式/矩阵/证据/Out of scope 同步订正；文件名引用改新名。
- `docs/specs/phase9-e2e-skip-migration.md` 标记 **SUPERSEDED by AAV-1395**（该计划从未实施，且其 `e2e/helpers/` 布局未被采用）。
- `AGENTS.md` 的 platform 段改写：原文「用 `test.describe` 按 project 过滤代替 `test.skip(condition)`」在 Playwright 里**根本不会过滤**（describe 只组织用例，两个 project 照样收集）——这正是 13 个文件的根源；改为 filename + `testIgnore` + co-located helper 的写法。
- `docs/conventions/e2e-testing-boundary.md`：「Never skip by platform」段改写为 filename + `testIgnore` 约定；`frontend-regression-checklist.md` 的 `segmented-toggle.spec.ts` 命令与文件名更新；`frontend-interaction-guardrails.md` 更新引用。
- 历史文档（`docs/handoff-playwright-flaky-fixes.md`、`docs/plans/frontend-triage-2026-06/*`）保留旧名，不改写历史。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence |
| --- | --- | --- | --- | --- |
| R1 | 数值 cell：中途档位 / 零档位 | 都通过（`value` 原样使用） | Low | automated test（`incentiveReading.test.ts` R1） |
| R2 | cell 存在但 `data-after` 非有限数 | 失败，理由含 `not a finite number`（零期望档位也不放行） | Medium | automated test（R2） |
| R3 | cell 缺失：零期望档位 | 通过（`'—'` = 0） | Medium | automated test（R3） |
| R4 | cell 缺失：非零期望档位 | 失败，理由含 `disappeared`；不得因 `value = 0` 通过 | **High** | automated test（R3/R4）+ live 复现 |
| R5 | 阶梯执行中目标行消失 | `assertLadderRungs` 先断言行存在，失败理由指出行丢失 | Medium | 代码断言 + runtime（live 未触发） |
| R6 | 零档位 cell 缺失但 `after` 读 0 | 单调断言 `after ≤ previousAfter + 0.01` 仍成立 | Low | runtime-real-data（live rung 2/3） |
| O23 | target 混合 APR campaign + 不响应 points campaign | 不出场景（`totalApr` 会少算） | Medium | automated test |
| O24 | points campaign 位于响应组内 | 同样不出场景（与组位置无关） | Medium | automated test |
| S2 | stub 注入第二组后 | 比例 `0.125 / 0.25 / 0.5`，无 `expectedAfterZero` | **High** | automated test |
| S2b | stub 形态：恰好 2 组，第二组无 `netPositionConstraint`、campaignId 唯一 | 第 2 档 ≈ 0.25（weight 0.5） | **High** | automated test |
| S3 | stub payload shape | `groups.length === 2`，`groups[1].netPositionConstraint === undefined` | Medium | automated test |
| L6–L14 | self-loop capacity = borrow room（AAV-1333 矩阵订正） | 比例 `min(step, borrowRoom)/gross`，LTV 不再进入 | **High** | automated test（L6/L7/L7b/L8/L9/L10/L12/L13/L14） |
| L7b | 固定 borrow room、把 target `ltv` 从 5% 改到 90% | 两份 plan 完全相等（LTV 只进选景门，不进比例） | **High** | automated test（`toEqual`） |
| B1 | 单平台文件路由 | chromium 不收集 `.mobile`；mobile 不收集 `.desktop` | **High** | `playwright test --list`（89 / 62，零违规） |
| B2 | 混合文件拆分后用例守恒 | `segmented-toggle` 3+3、`incentive-calculation` 7+5、`offset` 2+2 | **High** | `--list` + 双 project 实跑 |
| B3 | 非平台 skip 保留 | string-overload / 数据门 / staging 门仍在 | Medium | diff review + e2e |
| B4 | 静态门在重命名后仍命中 | `scripts/e2e-static-gate.test.mjs` 绿；改回 `endsWith` 则红 | Medium | `node --test` |
| B5 | 文档命令可执行 | checklist / boundary 中的文件名真实存在 | Low | `test -f` 校验 |
| C1 | AAV-1333 计数订正 | 4440 + 测量说明；无 4445 残留 | Low | 文档复查 |
| C2 | 历史计划不误导 | phase9 带 SUPERSEDED 横幅 | Low | 文档复查 |
| C3 | 规范本身不再教错写法 | `AGENTS.md` 的 platform 段改为 filename + `testIgnore`（不再推荐无效的 `test.describe` 过滤） | Medium | 文档复查 |

## Modified Files

| 文件 | 修改内容 | 风险 |
| --- | --- | --- |
| `e2e/incentiveReading.ts`（新） | 读取语义纯函数 | Low |
| `e2e/test-reserves.ts` | `locateIncentiveAfterSpan` 抽取 + `readIncentiveCellState` | Medium |
| `e2e/reserveDiscovery.ts` | points 排除；self-loop capacity 订正 | **High**（plan 口径） |
| `e2e/crossReserveOffsetStub.ts` | 第二组注入 + 稀释自检 | Medium |
| `e2e/portfolio-cross-reserve-offset.{helpers,desktop.spec,mobile.spec}.ts` | 拆分 + 严格读取 | **High** |
| `e2e/portfolio-incentive-calculation.{helpers,desktop.spec,mobile.spec}.ts` | 拆分 | Medium |
| `e2e/segmented-toggle.{desktop.spec,mobile.spec}.ts` | 拆分 | Low |
| 10 个 `*.desktop.spec.ts` / `*.mobile.spec.ts` 重命名 | 去 skip | Medium |
| `playwright.config.ts` | `testIgnore` 路由 | **High** |
| `scripts/e2e-static-gate.test.mjs` | stem 匹配 | Medium |
| `src/test/{incentiveReading,reserveDiscovery,crossReserveOffsetStub}.test.ts` | R1–R4 / O23–O24 / L6–L14 / S2–S3 | Medium |
| `docs/*` | 见 C | Low |

## 验证证据

### 单测

```
npx vitest run src/test/incentiveReading.test.ts src/test/reserveDiscovery.test.ts src/test/crossReserveOffsetStub.test.ts
→ 3 files, 165 passed（4 + 154 + 7）
```

（L7b 为 review 后补：固定 borrow room、只改 `ltv`，断言两份 plan 完全相等。）

### 变异证明（逐个跑红，随后复原并复绿）

| 变异 | 预期红 | 实测 |
| --- | --- | --- |
| `incentiveReading.ts`：缺 cell 直接 `{ok:true}` | R3/R4 | **2 failed / 2 passed**（R3、R4） |
| `reserveDiscovery.ts`：注释掉 `if (hasPointsBreakdown) continue;` | O23/O24 | **2 failed / 151 passed** |
| `reserveDiscovery.ts`：self-loop capacity 回到 `gross × 0.75` | L6/L7b/L8/L10/L12/L13/L14 | **7 failed / 147 passed** |
| `crossReserveOffsetStub.ts`：去掉第二组注入 | S1/S2/S2b/S3 | **4 failed / 3 passed** |

复原后 164 passed（脚本末尾复跑）。

### 运行时（live + stub，拆分后双文件）

```
npx playwright test e2e/portfolio-cross-reserve-offset.desktop.spec.ts e2e/portfolio-cross-reserve-offset.mobile.spec.ts
→ 4 passed / 0 skipped
```

- **A1 的实证红**：加固读取后、修 capacity 前，同一命令为 **2 failed / 4 skipped / 2 passed**——失败均为 live self-loop 第 2 档 `incentive cell disappeared (no data-after span)`（desktop + mobile），stub 两条仍绿。这正是旧 reader 读 0 掩盖掉的那一格。
- 修 capacity 后 live self-loop：gross $100,000、borrowRoom $1,541,363、比例 `0.5/1/1`、第 2–3 档 `'—'` 合规通过。
- stub：比例 `0.125/0.25/0.5`（weight 0.5），双平台都执行。

### 路由

```
npx playwright test --list --project=chromium        → 89 tests / 25 files
npx playwright test --list --project=mobile-chromium → 62 tests / 19 files
```

零违规：chromium 结果不含任何 `.mobile.spec.ts`，mobile 结果不含任何 `.desktop.spec.ts`。

### 门禁

- `npm run typecheck` rc=0（app + node + e2e）
- `npm run lint` 0 error / 74 warning（与改动前一致）
- `npx vitest run` = **4448 passed / 14 skipped / 6 todo**（198 files + 3 skipped）；另 `node --test "scripts/**/*.test.mjs"` 310 passed（由 `npm test` 一并执行）
- 全量 Playwright（两个 project）= **125 passed / 24 skipped / 2 failed**；两条失败均与本次改动无关，见下节。

### 全量 Playwright 的两条失败（非本票引入，已实证）

1. `[chromium] reserves-table-scenario-pin.desktop.spec.ts` 的 `reorder pins and non-reorder scenario change does not force pin`：断言 `non-reorder edit #2 should not force pin scroll`（`scrollByCalls` 1 ≠ 0）。用 `git show 65e68abe:e2e/reserves-table-scenario-pin.spec.ts` 落一份**拆分前原文件**单跑，同一条断言同样失败 ⇒ 与拆分无关，是当日 staging 数据下的既有行为。该标题本就在 `scripts/pre-push-e2e.mjs` 的 `GREP_INVERT` 排除名单里（"does not force pin"），不阻塞推送。
2. `[mobile-chromium] staging-smoke.spec.ts` 的 `/meta/side-data`：单跑仍 `Test timeout of 60000ms exceeded`（同 run 的 `/markets` passed）；该文件不在本 diff 内（`git diff 65e68abe -- e2e/staging-smoke.spec.ts` 为空），属 staging 端点当前不可用。

### 计数对账

AAV-1333 复核记录 4440；本票新增用例 7 条（R1–R4、O23–O24、S2b）+ review 后补 L7b = 8 条 ⇒ 期望 4448，与实测一致（AAV-1333 原文 4445 与复核 4440 本身不一致，差值 5 已在该 spec 里注明不可复现）。

## Review 处置（双轴）

两轴并行（Standards / Spec），共 15 条 finding；逐条处置如下。

### Standards

| # | 发现 | 处置 |
| --- | --- | --- |
| S1 | `AGENTS.md:99` 仍教「用 `test.describe` 按 project 过滤」，与已落地的 filename + `testIgnore` 冲突 | **修**：改写为 filename + `testIgnore` + co-located helper，并说明 `test.describe` 根本不路由。reviewer 的快照早于该编辑 |
| S2 | `frontend-regression-checklist.md:95` 指向不存在的 `e2e/segmented-toggle/` | **修**：改成两个真实文件名（`*.desktop.spec.ts` / `*.mobile.spec.ts`）+ 命令说明 |
| S3 | AAV-1333 证据区两条并列且自相矛盾（"不再有 4 条跳过" / "被 skip 的 4 条…"） | **修**：删除过期那条 |
| S4 | points 判定在 `isComputableMerklCampaign` 与 discovery 门里各写一遍 | **修**：抽 `isPointsBasedCampaign` 单一作者，两处调用 |
| S5 | `segmented-toggle.desktop.spec.ts` 头注释复制了 mobile 的覆盖清单（vertical 半径等） | **修**：改成 desktop 实际覆盖项 |
| S6 | 拆分后文件内仍保留 `describe('desktop')` / `describe('mobile')` 嵌套 | **不改（justified）**：仅影响报告标题上下文，无路由/行为影响；删除会改动 4 个文件的用例全名，属纯 churn |
| S7 | 静态门 `includes('reserves-table-interactions')` 不再证明命中的是 spec 文件 | **修**：追加 `&& file.endsWith('.spec.ts')` |
| S8 | T1–T6 全在一个未提交树里，违反 commit cadence | **修**：按 code+tests / config+scripts / docs 三类原子提交 |
| S9 | 4 个 canonical spec（AAV-1280/1317/1318/1352）仍引用旧文件名 | **不改（justified）**：这些是 write-once 的历史证据；当前文件名由 `DOCS-INDEX` + AAV-1333/AAV-1395 spec 承载 |

### Spec

| # | 发现 | 处置 |
| --- | --- | --- |
| P1 | AAV-1333 的 stub 预期比例仍是 `0.25 / 0.5 / 饱和` | **修**：改为 `0.125 / 0.25 / 0.5`（注入第二组后 weight 0.5） |
| P2 | AAV-1333 证据区重复矛盾（同 S3） | **修** |
| P3 | AAV-1333 问题陈述仍说 self-loop「只是借入被 LTV 钳到 `gross×ltv`」 | **修**：保留原文，追加 AAV-1395 订正注记（假绿来自旧 reader 读 0） |
| P4 | L6–L14 标 High，但没有「固定 borrow room、只改 `ltv`」的测试 | **修**：新增 L7b（两份 plan `toEqual`）；M3 变异下 L7b 同时打红 |
| P5 | 本 spec B 表把 segmented-toggle 写成 3+2 | **修**：实为 3+3（共 6，reviewer 读的是编辑前快照） |
| P6 | 全量 4448 与「4440 + 7」差 1 | **修**：补 L7b 后为 4440 + 8 = 4448；AAV-1333 原文 4445 本身不可复现（已在 AAV-1333 spec 注明） |
| P7 | B5 的文档命令证据未真正校验（同 S2） | **修** |
| P8 | `crossReserveOffsetStub.ts:10`、`reserveDiscovery.ts:670` 注释仍写旧 spec 名 | **修** |

### 未修但记录

- 全量 Playwright 的 2 条失败已实证与本票无关（见「验证证据」），不改测试、不留新 skip。
- 产品侧口径不一致（LTV 警告 vs incentive 用原始输入）不在本票范围，见 Out of scope。

## Tickets

| # | 内容 | 依赖 |
| --- | --- | --- |
| T1 | A1 strict oracle（R1–R4 + helpers） | — |
| T2 | A2 points 排除（O23/O24） | — |
| T3 | A3 stub weight（S2/S2b/S3） | — |
| T4 | A4 self-loop capacity 订正（L6–L14 + AAV-1333 spec） | T1（先红后修） |
| T5 | B platform 拆分 + config + 静态门 + 文档命令 | — |
| T6 | C 文档订正（AAV-1333 计数、phase9 superseded） | — |

## Out of scope

- 任何产品代码（`src/lib/**`、`src/components/**`）。本票只改测试口径。
- 产品侧不一致**不上报为缺陷修复**，但要告知用户：LTV 警告说"借入被钳制"，而 incentive 数学用未钳制的输入（`portfolioSimulator.ts` `crossReservePositions` 用 `group.borrowUsd`，`effectiveUsd` 只影响显示）。是否改产品口径需另开票。
- 历史文档（handoff、2026-06 plans）中的旧文件名保留。
