# Session Coordination Board

本文件是多 agent session 的**并行协调看板**。每个 session 启动时**必须**读取本文件、注册自己、检查冲突；结束时**必须**注销。

---

## 协议（每个 session 必须遵守）

### 1. 启动时：注册 + 冲突检测

1. **读取**本文件，查看 `## Active Sessions` 中所有 `status: active` 的条目。
2. **新增一行**到 Active Sessions 表，填写自己的信息（见下方表格格式）。
3. **冲突检测**：将自己的 `touch-files`（计划修改的文件/目录）与所有 `status: active` 条目的 `touch-files` 做交集。
   - **无交集** → `status: active`，正常执行。
   - **有交集** → `status: blocked`，**只做 plan / 分析 / 只读操作，不要写入任何冲突文件**。在 `notes` 列注明被谁阻塞。
4. 如果判断不准（比如不确定自己会改哪些文件），先用 `status: planning`，弄清楚范围后再更新。

### 2. 执行中：保持更新

- 如果 scope 变了（新增或减少要改的文件），**立即更新** `touch-files`。
- 如果发现新的冲突，将自己降级为 `blocked`。
- 定期检查：被阻塞时，可以重新读取本文件，如果阻塞方已注销，将自己升级为 `active`。

### 3. 结束时：注销

- 任务完成（commit 或放弃）后，**删除自己的行**或将 `status` 改为 `done`。
- 这样其他被你阻塞的 session 就知道可以继续了。

### 4. 异常处理

- 如果看到一个 `active` 条目的 `registered` 时间超过 **48 小时**且无更新，可以视为僵尸 session，在 `notes` 标注 `stale?` 并继续工作（但谨慎操作对应文件）。
- 如果你是人类用户，可以随时清理僵尸条目。

---

## Active Sessions

<!-- 格式说明：每个 session 一行，用 | 分隔 -->
<!-- session-id: 简短唯一标识（如 droid-0408a, cursor-0408b） -->
<!-- agent: 使用的工具（Droid / Cursor / Codex / Claude Code 等） -->
<!-- task: 简述要做什么 -->
<!-- touch-files: 计划修改的文件或目录，逗号分隔；越精确越好 -->
<!-- status: active / planning / blocked / done -->
<!-- registered: ISO 时间戳 -->
<!-- notes: 冲突说明、阻塞原因等 -->

| session-id | agent | task | touch-files | status | registered | notes |
|------------|-------|------|-------------|--------|------------|-------|
| droid-0926a | Droid | AAV-1280 offset spec discovery 可算性对齐 UI 渲染门控 | e2e/reserveDiscovery.ts, e2e/portfolio-cross-reserve-offset.spec.ts, src/test/reserveDiscovery.test.ts, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-26T00:00:00+08:00 | 已交付：谓词收紧 + 纯函数抽取 + 34 单测；e2e 实测干净 skip；gate 全绿 |
| droid-0927a | Droid | AAV-1305 P2 迁移 + AAV-1309 测试修复 + harness 改造（Session Start/登记/清理/evidence 回仓） | src/lib/chainRegistry.ts, src/lib/userData/aaveV3UserClient.ts, src/lib/userData/aaveV3UserClient.test.ts, src/hooks/useUserPositionsSdk.ts, src/hooks/useUserPositionsSdk.test.tsx, src/test/userPositionConsistency.test.ts, AGENTS.md, docs/agents/harness.md, docs/conventions/scenario-matrix.md, docs/specs/aav-1305-v3-dataprovider-migration.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T04:10:00+08:00 | 补登记：session 启动时漏读本看板（只走了 roadmap + issue-tracker 指针），结束补注。教训：期间并行 session 提交 e2e 改动（8e59187c/fd3f5fcf）在板上不可见，靠 git 状态漂移事后发现——注册本可让该协调显式化。AAV-1309（deec631e）：测试去假 HITL 标注 + onchain-only 真断言 + API base 收敛；核查中开票 AAV-1310/1311（既有生产缺陷）。harness 批次：AGENTS.md Session Start 节、harness.md 登记看板（core 回仓缓做，重评条件见登记行）、看板僵尸行清理、evidence 卫生回仓 agent-harness core（PROVENANCE 同 commit） |
| droid-0927b | Droid | 新开 issue triage 与 review，更新 issue 与 roadmap | docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T04:45:00+08:00 | 已完成：全面审查新开 issue（AAV-1311、AAV-1310、AAV-1308、AAV-1307、AAV-1306/GitHub #678）；在 Linear 沉淀根因核查与裁决建议并更新规范标签；同步更新 docs/issue-roadmap.md。 |
| droid-0927c | Droid | AAV-1311 onchain fallback 非 18-dec USD 缩水修复（mapper decimals 缩放 + 测试矩阵） | src/lib/userData/userPositionMapper.ts, src/lib/userData/userPositionMapper.test.ts, src/lib/userData/onchainPositionConverter.test.ts, src/test/userPositionConsistency.test.ts, docs/specs/aav-1311-onchain-fallback-decimals.md, docs/DOCS-INDEX.md, docs/issue-roadmap.md, SESSION-BOARD.md | done | 2026-09-27T13:20:00+08:00 | 已交付：`084131f5`（rawToHuman 按 meta.decimals 换算 + fixture 形态修正 + 一致性量级 invariant）；live 实测 Celo USD₮ $1044.57；gate 全绿；Linear Done + 交付记录。期间并行 session `5e57d7e1`（branch-protection docs）与本票无文件交集。 |

> **2026-09-27 清理**：删除 2026-04/05 的 done 行与僵尸 active 行（lovable-0423a，>48h 无更新，按协议 §4 处理）；git 历史可查。保留近两日条目。

---

## 冲突判断参考

以下是常见的高冲突区域，两个 session 同时改这些区域**几乎必然冲突**：

| 区域 | 典型文件 |
|------|----------|
| 利率模拟 | `src/lib/rateSimulation.ts`, `src/hooks/useRateSimulation.ts` |
| 储备表 | `src/components/reserves/ReservesTable.tsx`, `DesktopReserveRow.tsx` |
| 移动端储备 | `src/components/reserves/MobileReserveCard.tsx`, `MobileExpandedReserveShell.tsx` |
| 激励预测 | `src/lib/meritForecast.ts`, `src/lib/brevisForecast.ts`, `src/lib/merklForecast.ts` |
| 格式化 / 工具 | `src/lib/formatters.ts`, `src/lib/sorters.ts` |
| 全局样式 | `src/index.css`, `src/App.css`, `tailwind.config.ts` |
| 路由 / 页面 | `src/pages/Index.tsx` |
| 类型定义 | `src/types/` 下任意文件 |

如果两个 session 的 `touch-files` 落在**同一区域**，即使不是完全相同的文件，也建议视为冲突（因为经常有隐式依赖）。

---

## 示例

```
| session-id   | agent  | task                           | touch-files                                          | status  | registered          | notes              |
|--------------|--------|--------------------------------|------------------------------------------------------|---------|---------------------|--------------------|
| droid-0408a  | Droid  | 修复 mobile 展开动画           | MobileReserveCard.tsx, MobileExpandedReserveShell.tsx | active  | 2026-04-08T10:30:00 |                    |
| cursor-0408b | Cursor | 重构利率模拟添加 Brevis 支持   | rateSimulation.ts, brevisForecast.ts, useRateSimulation.ts | active | 2026-04-08T10:45:00 |                    |
| droid-0408c  | Droid  | 调整 ReservesTable 排序逻辑    | sorters.ts, ReservesTable.tsx                        | blocked | 2026-04-08T11:00:00 | 被 cursor-0408b 阻塞（ReservesTable 间接依赖 rateSimulation） |
```

当 `cursor-0408b` 完成并注销后，`droid-0408c` 重新读取本文件，发现无冲突，即可将自己改为 `active` 并开始执行。
