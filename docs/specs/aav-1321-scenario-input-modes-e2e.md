# Spec: 场景模拟输入模式与展开子行的 e2e 覆盖（AAV-1321）

> Status: ready-for-agent · Created: 2026-09-28 · Source: [AAV-1321](https://linear.app/aaveapy/issue/AAV-1321)
> 正文是规格，实施记录沉淀在 Linear 票评论。

## Problem

计算层测试密集（`rateSimulationCalculator` / `useRateSimulation` / `scenarioSize` / `useSharedScenarioInputs` / `usePortfolioSimulation` / `SimulationSubRow.*`），但「用户点控件 → UI 语义变化 → 表格重算」这条交互链路在 `e2e/` 里是空白：

- USD↔Token 两种输入模式：`grep "Token" e2e/*.spec.ts` 零命中。
- 净借贷开关 `#scenario-merit-merkl-net-lending-borrowing`：全仓仅出现在 `ScenarioControls.tsx` 自身。
- 展开模拟子行的触发契约（整行 `<tr>` 触发 vs Market 芯片是筛选）未固定。

2026-09-28 生产验证时因缺这层测试产生两个假信号：`force` 点视觉隐藏 checkbox 误判「开关不可逆」；点 `td[1]`（Market 芯片）误判「展开失效」。

## Solution

新增 `e2e/scenario-input-modes*.spec.ts`（2026-09-28 收尾时按平台拆成三个文件 + 一个共享 helper 模块，`playwright.config.ts` 用 `testIgnore` 各归其 project —— 取代交付初版的 `test.skip(testInfo.project.name …)`，那是 AGENTS.md 明令禁止的平台互斥 skip 形态），三个用例组：

1. **双平台共用**（`chromium` + `mobile-chromium` 实跑，无平台互斥 skip）：模式切换与清空、场景→重算、Token 单位语义、空/零边界。
2. **桌面专属**：整行 `<tr>` 展开子行 + Market 芯片不触发展开。
3. **移动专属**：`Expand details panel` 按钮展开 + 净借贷开关（移动端该控件在可展开区内）。

### 核心设计决策

1. **只断言相对变化，不断言绝对数值。** staging 数据每次刷新都可能变（AAV-1299/1308 的教训：断言依赖动态数据 → 超时/假失败）。锚定「前 N 行文本集合」做前后 diff，断言「有变化 / 恢复原状」，不写死任何 APY 数字。
2. **交互一律走用户可点单元。** 复选框点关联 `label`（`input` 视觉隐藏，`force` 点它不可靠）；行展开点纯文本单元格（`td` Price 列），不点含芯片的单元格（会触发市场筛选）。
3. **数据条件不满足时干净 skip + annotation**，而不是放宽断言成「变化数 ≥ 0」这种永真式（AAV-1280 口径）。
4. **不引入 `data-testid`。** 现有 `aria-label`（`Supply amount` / `Borrow amount` / `Expand details panel`）与 `role=radio` 已足够稳定；新增可访问性属性属产品改动，另议（见「残留」）。

## Scenario & Risk Verification Matrix

| # | 场景 | 输入/动作 | 期望（断言） | 证据形式 |
| --- | --- | --- | --- | --- |
| M1 | 模式切换反映在控件状态 | 点 `Token` radio | `Token` 的 `aria-checked=true`、`USD=false` | e2e 断言 |
| M2 | 模式切换改变输入语义 | 同上 | Supply/Borrow 的 `placeholder` 从 USD 千分位形态变为代币量级（不等于切换前的值） | e2e 断言 |
| M3 | 模式切换按设计清空输入 | USD 填值后切 Token | 两个输入值均为空串（钉住 `ScenarioControls.tsx:261-269` 的 `handleClear()`） | e2e 断言 |
| M4 | 切回 USD 语义恢复 | Token 再切 USD | `placeholder` 恢复 USD 形态、`aria-checked` 回到 USD | e2e 断言 |
| M5 | USD 场景驱动表格重算 | 填 250,000 / 120,000 + Tab | 锚定行集合至少 1 行文本变化；全页无 `NaN`/`undefined`/`Infinity` | e2e 断言 |
| M6 | Token 场景驱动重算并换单位 | Token 模式填 3 / 1 | 至少 1 行变化；该行 Size 列不再含 `$`+`M/K` 单位后缀 | e2e 断言 |
| M7 | 净借贷开关有可观察效果 | 有活跃场景时点 label | 至少 1 行文本变化（当前数据实测为 USDC/Ink 行 Incentive 与 Spread 变化）；若无受影响行 → 干净 skip + annotation 说明数据条件 | e2e 断言（条件式） |
| M8 | 净借贷开关可逆 | 再点一次 label | `checked` 回到 true，且锚定行文本与首次状态**逐字节相同** | e2e 断言 |
| M9 | 桌面整行可展开模拟子行 | 点首行 Price 单元格 | 紧邻下一行出现子行文本（含 `Simulation is for reference only` 或 `Spread`/`Liquidity`） | e2e 断言 |
| M10 | Market 芯片不触发展开 | 收起后点首行 Market 芯片 | 子行数仍为 0（芯片是筛选动作） | e2e 断言 |
| M11 | 移动端卡片可展开 | 点 `Expand details panel` | 出现 `Collapse details panel`，且展开态在输入场景后保持 | e2e 断言 |
| M12 | 空输入回落到基线 | 场景输入后清空 | 锚定行文本与初始基线一致（空=无场景） | e2e 断言 |
| M13 | `0` 与空串语义区分 | 输入 `0` | 不抛错、无 `NaN`；`0` 场景与空场景的行文本允许不同（0 是显式零仓位），断言为「页面仍健康 + 无非法数值」 | e2e 断言（弱化为不变量） |
| M14 | 全页控制台无新增错误 | 上述所有步骤 | 无未预期 `pageerror`；已知生产 CSP 报错在本地 dev server 下不出现 | e2e 断言 |

### Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/scenario-input-modes.{spec,desktop.spec,mobile.spec,helpers}.ts` | 新增：三个 spec 按平台分文件，共用 helper 模块 | Low | 纯新增测试，不触碰产品代码 |
| `playwright.config.ts` | 加两条 `testIgnore`（2026-09-28 收尾补做，取代交付初版的平台互斥 `test.skip`） | Low | 影响面限于新增文件自身：chromium 实跑 7 条、mobile-chromium 实跑 4 条，0 skipped |

### 残留（不在本票，已识别）

- 桌面 `<tr>` 展开没有 `aria-expanded`，屏幕阅读器与测试都只能靠「整行可点」这一隐式契约；建议另开票给行加 `aria-expanded` + `role=button` 语义。
- `e2e/` 不在 lint 与 `typecheck` 覆盖内（AGENTS.md 已记），本票验收要求对新 spec 显式跑 tsc。
- 净借贷开关 id 仍叫 `scenario-merit-merkl-net-lending-borrowing`，而 Merit 后端已下线（AAV-1303 范围）。

## 验收

见票面四条；核心是两平台均实跑非 skip、矩阵每行有对应断言、门禁与 `ci:remote` 全绿。
