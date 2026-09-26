# AAV-1280 — Offset E2E Discovery 与 UI 渲染门控对齐

> Status: implemented 2026-09-26 · Issue: AAV-1280 · Type: test-side hardening (e2e)

## 背景与根因

`e2e/portfolio-cross-reserve-offset.spec.ts` 的 self-loop 用例曾在 pre-push e2e 中失败：staging Merkl 数据标记 Celo spoke 有活动（raw `campaignApr > 0`），但 UI incentive cell 渲染 `—`，`Baseline after incentive should be positive` 断言得到 0。

triage（2026-09-26）确认的根因：**测试侧 scenario discovery 与 UI 渲染门控不一致**。UI 侧一条 Merkl breakdown 要计入 incentive 总量，必须通过三道门（`src/lib/incentiveAggregation.ts` `sumMerklIncentiveApr`）：

1. **时间窗**：`isCampaignActive(start, end, now, allowOpenEnd=false)` — 缺 start 或缺 end 即排除（Merkl 不允许 open-end），not-started/expired 排除，date-only 边界规范化。
2. **白名单/access**：`whitelistOnly` breakdown 未 opt-in 即排除（AAV-66）。
3. **APR 可算性**：`campaignApr > 0` 或 points-based。

而测试侧 discovery 有三处偏差：

| 偏差 | 位置 | 后果 |
| --- | --- | --- |
| offset spec 的 `discoverScenarios` 只累加 raw `campaignApr`，不校时间窗/白名单/AMOUNT 变体 | `e2e/portfolio-cross-reserve-offset.spec.ts`（AAV-1299 只迁移了 `pickIncentiveReserve`，漏了这条链路） | 选中 UI 渲染 `—` 的 reserve → baseline 断言失败（即 AAV-1280） |
| `isComputableMerklCampaign` 对缺失 start/end 边界放行（"missing/invalid boundaries are ignored"） | `e2e/reserveDiscovery.ts` | UI 会排除的 campaign 被发现选中 → 同类 flake 残留 |
| `whitelistOnly` 未被任何测试侧谓词检查 | `e2e/reserveDiscovery.ts` | 白名单-only campaign 对测试恒渲染 `—` |

triage 时点（2026-09-26）staging 实测：Celo 已无 `netPositionConstraint` 活动（触发数据消失）；全量 411 reserves 中满足现有过滤的场景为 0（self-loop 候选全部 ltv=0）；27 个 merkl supply breakdown 中 whitelistOnly=0、缺失边界=0。**问题当前不复现，但偏差是结构性的**，staging 数据再次出现窗口失效/白名单-only/AMOUNT 变体 campaign 时会以同一方式复发。

## 设计

沿用 AAV-1299 确立的模式：纯选择逻辑住 `e2e/reserveDiscovery.ts`（零依赖、可被 vitest 单测），spec 只保留 fetch + 消费。

1. **`isComputableMerklCampaign` 对齐 UI 门控**：
   - 缺失/非法 start 或 end → 不可算（镜像 `isCampaignActive` allowOpenEnd=false）；
   - date-only 边界规范化（start `T00:00:00.000Z` / end `T23:59:59.999Z`）；
   - `whitelistOnly: true` → 不可算（e2e 从不 opt-in 白名单 campaign）；
   - 保留 AMOUNT 变体排除（测试侧保守过滤：其 APR 语义是代币数量而非百分比）。
2. **新增 `discoverOffsetScenarios(reserves, nowIso)` 纯函数**：承接 offset spec 的内联 discovery，per-group 先按可算性过滤 breakdowns 再累加 APR；保留既有过滤（frozen/paused/inactive、supplyDisabled、ltv>0、supply room、offset 侧可借性）、dedup 与排序（cross-reserve 优先、APR 降序）。points-only 组仍被 `apr <= 0` 保守跳过（比例断言需要百分比 APR）。dedup 语义收紧：同一 (reserveId, type) 由**首个完整通过全部校验**（含 offset 侧可借性）的组胜出——旧实现先占 dedup 坑再校验 offset，会因首个组 offset 不合格而放弃整条 reserve；新实现允许后续组合法时胜出。
3. **spec 消费**：`portfolio-cross-reserve-offset.spec.ts` 删除内联逻辑，改用共享纯函数；fetch 留在 spec（不改 API base 解析，见 Out of scope）。

镜像而非 import app 代码（`campaignGroups.ts`/`merklForecast.ts`）是有意的：discovery 独立于 app 实现，app 侧门控回归时不会被发现逻辑静默跟随。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `e2e/reserveDiscovery.ts` | 收紧 `isComputableMerklCampaign`（缺失边界/whitelistOnly → false）；新增 `discoverOffsetScenarios` 与 `OffsetScenario` 类型 | Medium | 影响两个既有消费者：`hasComputableSupplyIncentive`/`pickIncentiveReserve`（`portfolio-incentive-calculation` spec）只会**更保守**——原先选中会导致运行时 `—` 失败的场景改为 skip，不会引入新失败；单测全量回归验证 |
| `e2e/portfolio-cross-reserve-offset.spec.ts` | 内联 `discoverScenarios` 替换为共享纯函数；类型改 import | Low | 行为等价（除可算性收紧外）；fetch 与 slice 限制不变 |
| `src/test/reserveDiscovery.test.ts` | 新增/调整单测覆盖场景矩阵 | Low | 纯追加 |

最坏后果：discovery 过紧导致 staging 有真实可渲染活动时 spec 误 skip。缓解：可算性谓词逐条镜像 UI 门控，且有单测锚定每条门控语义；skip 是安全失败模式（不阻塞 push）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | breakdown 缺 `campaignStartedAt` | `isComputableMerklCampaign` = false（镜像 UI：无 start 不计数） | Medium | automated test | — |
| 2 | breakdown 缺 `campaignEndedAt` | false（镜像 UI：Merkl 不允许 open-end） | Medium | automated test | — |
| 3 | 边界为非法日期字符串 | false | Low | automated test | — |
| 4 | date-only 边界（`YYYY-MM-DD`） | 按 UI 规范化语义判定（end 当天 23:59:59.999 前有效） | Low | automated test | — |
| 5 | `whitelistOnly: true` breakdown | false（e2e 无白名单 opt-in） | Medium | automated test | — |
| 6 | expired / not-started / AMOUNT 变体 / apr=0 无 points | false（AAV-1299 既有行为回归） | Low | automated test（既有 S3-S6） | — |
| 7 | offset discovery：组内含不可算 breakdown（expired 大 APR）+ 可算 breakdown（小 APR） | 选中场景，`targetApr` 只累计可算部分（AAV-1280 反演回归） | High | automated test | — |
| 8 | offset discovery：组内 breakdown 全部不可算 | 不产生场景（AAV-1280 原始失败形态 → skip） | High | automated test | — |
| 9 | self-loop（offsets 仅含自身）+ 可算组 | 产生 `self-loop` 场景 | Low | automated test | — |
| 10 | cross-reserve（offsets 含他人）+ 双方过滤通过 | 产生 `cross-reserve` 场景，offset = `nonSelf[0]` | Low | automated test | — |
| 11 | target 或 offset：frozen/paused/inactive/supplyDisabled/ltv=0/supply room 0；offset borrowDisabled | 跳过对应场景 | Low | automated test | — |
| 12 | 同一 reserve 多组重复（dedup key = reserveId+type） | 只产生一个场景 | Low | automated test | — |
| 13 | 排序：cross-reserve 优先、APR 降序 | 稳定排序输出 | Low | automated test | — |
| 14 | 空数据 / fetch 失败 | 返回 `[]`，spec 整体 skip | Low | automated test + runtime-real-data | — |
| 15 | 当前真实 staging 数据（0 场景） | `npx playwright test portfolio-cross-reserve-offset` 全量 skip，无失败 | Low | runtime-real-data | — |

## Out of scope

- ~~offset spec 的 API base 解析~~ → **已于同日跟进解决**：`test-reserves.ts` 的 env 解析 fetch（`VITE_API_BASE_URL` 优先，绕 CI 的 Cloudflare/WAF 403）以 `fetchStagingReserves` 导出，offset 与 cross-asset-pairing 两个 spec 的硬编码 staging URL 收敛到该入口；`staging-smoke.spec.ts` 的硬编码是故意的本地 operator smoke（头部注释声明 CI 全 skip），保持不变。
- AMOUNT 变体在 UI 侧的实际展示策略（AAV-1275 产品决策，仍 open）。
- UI 侧 campaign 挂点/spoke 匹配排查（修复方向 1）：触发数据已消失无法运行时验证；静态审查未见 UI 缺口——三道门均为设计行为。若未来再现"数据有活动 UI 为空"，按新证据重开排查。
- `portfolio-cross-asset-pairing.spec.ts` discovery 的可算性缺口（同 AAV-1280 病因：raw APR 直加，不校时间窗/白名单/AMOUNT）——独立开票进入 triage，不在本 spec 范围内顺手修。
