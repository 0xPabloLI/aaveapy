# Spec: AAV-1322 — 桌面展开行「收起」探针与 M9 断言

> Status: implemented · Created: 2026-11-17 · Source: [AAV-1322](https://linear.app/aaveapy/issue/AAV-1322)
> 正文是规格；交付证据沉淀在 Linear 票评论。

## Problem

票面（2026-09-28）称：桌面储备行点一次展开模拟子行，再点同一行不会收起，dev 与 production 双环境一致，5 个纯文本单元格全部复现。

2026-11-17 重新取证后，**产品行为并不存在该缺陷**：

- 模拟面板在首次展开后由 `hasSimulationMounted` 常驻挂载；收起只把外层 grid 的 `grid-template-rows` 从 `1fr` 改回 `0fr`，面板文本仍留在 DOM 里。
- 票面的「子行数」探针按 `tr` 的 `textContent` 计数，因此收起后仍返回 1 —— 0→1→1 是**探针假象**，不是视觉未收起。
- 真浏览器量到的面板高度：本地 dev 366px → 0 → 366px；生产 `aaveapy.com` 331px → 0 → 331px。toggle 语义正常。

真正剩下的缺口是**测试契约**：`e2e/scenario-input-modes.desktop.spec.ts` 的 M9 因这条假象带着 `known-issue` annotation，收起路径没有任何断言保护。

## Solution

只改 e2e 层，不动产品代码：

1. `subRowText` 从「DOM 文本计数」改为「可见性子行探针」：面板目标样式 `grid-template-rows !== '0fr'` 且高度 > 0 才计入。
2. M9 升级为「展开 → 再点同一行收起」：第二次点击后 `subRowText` 必须为空；移除 `known-issue` annotation。
3. M10（Market 芯片不展开）保持不变，受益于同一探针。

## User Stories

1. As a maintainer, I want the row-collapse path pinned by an e2e assertion, so a real regression fails CI instead of being discovered manually months later.
2. As a reviewer, I want the sub-row probe to measure what the user sees, so "mounted but collapsed" can never read as "expanded".
3. As a future triager, I want the AAV-1322 evidence corrected, so the same false positive is not re-investigated.
4. As a test author, I want the probe to stay valid when the panel is mid-animation, so the assertion is deterministic rather than timing-dependent.
5. As a platform owner, I want the mobile spec untouched, so the desktop-only fix stays desktop-only.

## Implementation Decisions

- **Seam**: existing `e2e/scenario-input-modes.helpers.ts` → `subRowText`; consumers are only desktop M9/M10. No new seam, no product API.
- **Visibility predicate**: locate `[data-reserves-simulation-scrollport]` inside the one-cell sub-row, walk to its closest `.grid`, require `style.gridTemplateRows !== '0fr'` **and** `getBoundingClientRect().height > 0`. The inline style is the React target (set synchronously on toggle), so collapse is excluded even while the 300ms transition is still running; the height guard protects against a future style-model drift.
- **No production change**: do not add `aria-expanded`, do not unmount the panel, do not change `handleToggleExpand`.
- **M9 sequence**: expand on `td[2]` (plain text cell) → assert visible sub-row → click same `td[2]` → assert empty. `td[0]` (AssetActionMenu) and `td[1]` (Market chip) are intentionally non-toggle cells and stay out of the sequence.
- **Out-of-scope cells**: `td[0]` contains the asset action menu (stopPropagation); `td[1]` is the market filter chip. Both were tested in the original evidence and legitimately do not toggle.

## Scenario & Risk Verification Matrix

### Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/scenario-input-modes.helpers.ts` | `subRowText` 改为 visible-only | Medium | 仅 M9/M10 两个消费者，均为桌面；新语义更严格（0fr 不再计入）。最坏后果是探针漏报展开 → M9 在 red 阶段即暴露，不会假绿。 |
| `e2e/scenario-input-modes.desktop.spec.ts` | M9 增加收起断言、删 known-issue annotation | Low | 纯测试改动，无产品代码；M10 语义不变。 |

### Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 初次加载、未展开任何行 | `subRowText` 返回空串 | Low | automated test（M9 首断言） | 面板未挂载时无 scrollport，直接排除 |
| S2 | 点首行 `td[2]` 展开 | 子行文本含 `Simulation is for reference only` 或 `Spread` | Low | automated test（M9） | 面板 `1fr` 且高度 > 0 |
| S3 | 再点同一 `td[2]` | 子行文本为空（收起） | Medium（原缺口） | automated test（M9；改前 red，改后 green） | `0fr` 立即排除，不等动画结束 |
| S4 | 收起后面板仍常驻 DOM | 探针不把残留文本计为展开 | Medium | automated test（S3 的结构前提） | 以目标样式而非 textContent 判定 |
| S5 | 点 Market 芯片 | 不展开子行，`subRowText` 为空 | Low | automated test（M10） | 芯片 `stopPropagation`，行不触发 |
| S6 | 点 token 单元格 `td[0]` | 不触发展开（AssetActionMenu 为独立动作） | Low | runtime probe（2026-11-17 逐列矩阵） | 不在 M9 序列中点击 |
| S7 | 折叠动画进行中（300ms 内） | 探针已判定收起 | Low | automated test（S3 的 `expect.poll`） | 读 React 写入的 inline style，不读 computed 中间值 |
| S8 | 移动端 spec | 不受影响 | Low | static check（仅 desktop 消费者 + typecheck:e2e） | helper 未被 mobile 引用 |
| S9 | 生产构建行为 | 与 dev 一致：331px → 0 → 331px | Medium | runtime-real-data（2026-11-17 `aaveapy.com` 实测） | 产品代码零改动 |

### Evidence Contract

- **automated test**：M9 的展开与收起、M10 的芯片不展开。红/绿各一次实跑（改前 M9 `Received: "Borrow is disabled..."` → 改后 `2 passed`）。
- **static/type/lint check**：`npm run typecheck:e2e`、`npx eslint e2e/scenario-input-modes.helpers.ts e2e/scenario-input-modes.desktop.spec.ts`、Prettier。
- **runtime-real-data**：本地 staging dev（366→0→366）与生产（331→0→331）双环境；逐列矩阵 `td[0]/td[1]` 不 toggle、`td[2..7]` toggle。

## Testing Decisions

- E2E 是唯一稳定 seam：这是浏览器可见性行为，单元层没有同等语义（hook 单测已覆盖 `handleToggleExpand` 的纯状态 toggle）。
- 先 red 再 green：先加 M9 收起断言（旧探针下 fail），再改 `subRowText` 至绿。这样证明断言真的咬住探针，而不是「写了一个永远为真的空断言」。
- 不新增 `data-testid` / `aria-expanded`：现有 `[data-reserves-simulation-scrollport]` + `.grid` 结构已足够；产品可访问性改动另议（AAV-1321 spec 的残留项）。

## Tracer Bullet Ticket

**T1 — visible-only sub-row probe + M9 collapse assertion**（Blocked by: None）

- [x] `subRowText` 只统计实际可见的面板
- [x] M9 展开后再次点击同一行，断言子行文本为空
- [x] 移除 M9 的 `known-issue` annotation
- [x] M10 保持绿
- [x] `typecheck:e2e` + lint + Prettier 干净

## Out of Scope

- 产品代码/交互行为（实测正常，不需要修）。
- 给桌面行补 `aria-expanded` / `role=button`（AAV-1321 spec 已列为残留，另票）。
- `td[0]`（AssetActionMenu）与 `td[1]`（Market chip）的点击语义。
- 移动端卡片展开/收起。

## Further Notes

- 票面「5 个单元格 × dev/生产双环境」的证据全部由同一个 textContent 探针产生，因此不是 5 个独立信号，而是同一个假象的 5 次重复。
- AAV-1322 的结论应记为「非产品缺陷、探针假象」，而不是「代码修复」。Linear 交付记录需写明这一点，避免后续 triage 误以为存在过一次 collapse 修复。
