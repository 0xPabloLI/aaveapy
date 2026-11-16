# AAV-1333 — Offset E2E 阶梯与阈值的量纲自洽

> Status: drafted 2026-11-16 · Issue: AAV-1333 · Type: test-side hardening (e2e) · 上游: `docs/specs/aav-1318-offset-position-feasibility-gating.md`（该票已诚实记录本缺口并显式转出）

## 背景与根因

两个 runner（`runCrossReserveScenario` / `runSelfLoopScenario`）共用同一组断言常量，却没有共同的量纲前提：

| 断言 | 代码事实 | 隐含要求 |
| --- | --- | --- |
| `baselineAfter − after ≥ targetApr × 0.4` | 显示口径默认是 **APY**（`Index.tsx` 的 `isApy` 初始 `true`），`targetApr` 是 APY 数值的近似，量纲已错位 | `B ≥ 0.4 × gross` |
| `|overAfter − fullAfter| ≤ 0.05`（cross） | `$2000` 远小于 `gross`（$100k），从未触发任何钳制；两个梯级都只是"很小的下降" | `gross ≥ apr × 20000` |

代入 app 侧真实数学（`rateSimulationCalculator` 的 unified-eligibility 分支）：

```
afterApr = forecastApr × eligible / gross
eligible = max(gross − B, 0)          B = 钳制后的 offset 借入
gross    = 钳制后的 target 有效供给 = min(输入额, availableSupplyRoomUsd)
```

⇒ 下降量 `Δ = apr × B / gross`，**比例 = B / gross**。

两条断言因此互斥：`gross ≤ $2.5k`（来自 0.4 门槛）与 `gross ≥ apr×$20000`（apr=5% 时即 `$100k`）无法同时成立。今天 cross-reserve 场景为 0 条（staging 2026-11-16 实测 441 reserves：cross **0**、self-loop **1**），所以一直没暴露；一旦真实数据出现 cross 场景，runner 必然假红。

self-loop 侧同样不成立：它的阶梯"看起来对"只是因为借入被 LTV 钳到 `gross×ltv`，`0.4` 实际隐含 `ltv ≥ 40%`；`ltv=20%` 的 target 会在旧断言下假红。且两条 runner 的阶梯都写死为输入常量，与 `gross` 无任何派生关系——**改 supply room / ltv / cap 都不改变阶梯，只改变结果**，这正是"0.4 是手挑常量"的另一面。

## 设计

单一原则：**阶梯与阈值同源**。discovery 计算并返回 `OffsetRunnerPlan`，runner 只把 plan 的金额原样打进去、用 plan 的期望比例断言，**runner 内不再出现任何手挑常量**。

### Plan 形状（纯函数产出，随 `OffsetScenario` 一同返回）

```
OffsetScenario.plan = {
  targetSupplyUsd:   number        // 打在 target supply 输入框的值（整数 USD）
  offsetSupplyUsd:   number | null // cross: 打在 offset supply 的值；self-loop: null
  grossUsd:          number        // = targetSupplyUsd（整数且 ≤ 所有上界 ⇒ app 不会再钳）
  offsetCapacityUsd: number        // = min(borrowRoom, funding × ltv/100)（保守下界，见下）
  steps: [{ borrowUsd, expectedDecreaseRatio, expectedAfterZero }]
}
```

`offsetCapacityUsd` 是**保守下界**：同池场景下 app 的 LTV 额度会包含 target 的供给（更大），跨池场景等于 offset 自身供给 × ltv——两种情形 plan 都取下界，因此 plan 的阶梯永不被 app 钳制。

### 派生规则

```
capacity = min(borrowRoom(offset), min(offsetRoom, 100000) × ltv(offset)/100)   // cross
         = min(borrowRoom(target), gross × ltv(target)/100)                     // self-loop

cross:   gross = floor( min(100000, targetRoom, capacity/2, minCap) )   // < 100 ⇒ 不出场景
         offsetSupply = floor( min(100000, offsetRoom) )
         steps = floor({0.25, 0.5, 1.5} × gross)                        // 末步 > gross ⇒ eligible 归零
         expectedRatio = weight × min(borrowUsd/gross, 1)
         expectedAfterZero = borrowUsd ≥ gross && weight ≥ 1

self:    gross = floor( min(100000, targetRoom, minCap) )               // < 100 ⇒ 不出场景
         steps = {50000, 100000, 200000}                                 // 保持不变
         effective = min(step, capacity)
         expectedRatio = weight × min(effective/gross, 1)
         expectedAfterZero = effective ≥ gross && weight ≥ 1

weight = respondingAprPercent / totalAprPercent
```

`capacity/2` 的由来：`1.5×gross ≤ 0.75×capacity`，末步必然可融资；同时 `0.25/0.5` 两步各自只有 `capacity` 的 1/8、1/4。

`weight` 是**显示口径的加权**：target 上所有可计算 supply 组一起决定 incentive cell 的数值（`incentiveAggregation` 求和），而只有约束里包含"我们将要借入的那个 reserve id"的组会随 offset 变化。所以 `measured` 只是 `B/gross` 的一个子比例——`responding / total` 把它折算回来。

- 单组（live 的全部现存形态）：`weight = 1` ⇒ 比例仍是 `B/gross`（O8/O22 的旧形态不退化）。
- 两组都响应（O22 的 `[SELF]` + `[SELF, OTHER]`）：`weight = 1`，两步同时下降 ⇒ 比例仍 `B/gross`。
- 一组响应、另一组不响应（L12）：`weight = 2/5` ⇒ 期望比例 0.4×0.8=0.32。这是旧门槛「其它组 APR 必须为 0」换成"把稀释算进来"的收益：既不假红，也不丢场景。
- 不可计算组（过期/AMOUNT/whitelist）不计入 `total`，因为它渲染为 `—`（=0），L13。

### 断言规则（两条 runner 共用）

```
measured = (baseline − after) / baseline
ratio step:      measured ≥ expectedDecreaseRatio × 0.9
zero step:       after ≤ SATURATED_EPS（0.01 个百分点；cell 渲染 '—' 时读数为 0，同样成立）
单调：           after ≤ previousAfter + 0.01
```

- **0.9 容差**覆盖：APY 复利凸性（`f(kx)/f(x) ≈ k − Ck(1−k)x`，在同量级下与 `k` 的偏差 < 1%，且方向随 k 而定）、forecast TVL 稀释（baseline 与 after 同 `inputUsd`，比值抵消）、展示四舍五入。
- **不再使用 `targetApr`** 作为阈值；它只保留为场景选择/排序键。这样 APY/APR 切换、多 campaign、apr 随 TVL 变化都不再影响断言的量纲。

### 新增「比例可推导」门槛（否则阈值不可推导）

`measured` 只有在"参与显示的激励全部随这一笔 offset 变动"时才可推导。三道门：

- `brevisSupplys` 非空 ⇒ 出局（Brevis 不受 offset 影响，只稀释比例，且无法用 `weight` 折算——它不是 Merkl 组）；
- `supplyIncentives` 含正数 ⇒ 出局（同上，protocol 源）；
- plan 推导不出（`gross < 100`、`capacity ≤ 0`、APR 集合为空）⇒ 出局。

`minCap` 不再是筛选门而是**收缩项**：`gross` 直接收到 cap 之下，cap 就不会绑定，比例保持精确（L4）。`cap ≤ 0` 按 Aave 语义视为无上限（L5/L16）。

这三条都不是"数学上必然成立"的推导前提，因此**宁可不出场景也不出假红**。

### Synthetic 载荷（cross-reserve 的运行时证据）

staging 当前 0 条 cross 场景，AAV-1316 先例：真实 fixture + 注入约束 + 复用真实 discovery 选场景。

- 新建 `e2e/fixtures/markets-cross-reserve-offset-base.json`：取自 `markets-cross-asset-pairing-base.json` 的 Base 子集（AaveV3Base WETH target + AaveV3Base USDC offset），**丢掉 Celo WETH**（它自带真实的、2026-12-10 过期的 self 约束，留着就是第二颗定时炸弹）；
- 向 Base WETH 的 `merklSupplys[0]`（`netPositionConstraint: null`）注入 `{sourceSide:'supply', offsetReserveIds:[Base USDC]}`，并把该组 campaign 窗口抬到 2026-01-01 → 2035-01-01（写进 fixture，不再运行时改写）；
- `page.route` 双拦 `/markets` 与 `/meta/side-data`（空 forecast ⇒ APR 走 breakdown 常量路径，比例可推导）；
- 注入后跑**真实** `discoverOffsetScenarios`；若 cross 场景 ≠ 1 条、或选中的不是文档化的这对 reserve ⇒ **抛错**（不产出会静默 skip 的 stub）。

预期产物（按 fixture 真实字段）：capacity = min(42.4M, 100000×0.75) = 75000；gross = min(100000, WETH room, 37500, ∞) = 37500；steps = 9375 / 18750 / 56250；期望比例 0.25 / 0.5 / 饱和。

## Modified Files Impact

| 文件 | 修改内容 | 风险 | 评估 |
| --- | --- | --- | --- |
| `e2e/reserveDiscovery.ts` | 新增 `planOffsetRunner` 纯函数；`OffsetScenario.plan` 必填；新增四道「比例可推导」门 | Medium | 唯一消费者是 offset spec 与单测。live 场景数可能下降（今天 1 条 self-loop 全部满足四道门 ⇒ 变化 0）。最坏后果：多激励源 target 不再出场景（安全的失败模式）。 |
| `e2e/portfolio-cross-reserve-offset.spec.ts` | 两条 runner 改为消费 plan + 比例断言；新增 synthetic describe | Medium | 断言口径整体替换；旧常量全部删除。由单测锁 plan、由 live + synthetic 双证据锁运行时。 |
| `e2e/crossReserveOffsetStub.ts` | 新建纯函数 stub builder | Low | 纯新增；不覆盖真实 `netPositionConstraint`；门禁不通过即抛错。 |
| `e2e/stubRoutes.ts` | 从 pairing helper 抽出 `installStubRoutes` | Low | 纯搬移 + 参数类型从 pairing 专用放宽为 `Record<string, unknown>`；pairing helper 保留同名再导出，既有 spec 导入不变。 |
| `e2e/portfolio-cross-asset-pairing.helpers.ts` | 改为从 `stubRoutes` 再导出 | Low | 无行为变化。 |
| `src/test/reserveDiscovery.test.ts` | 新增 L 系列 plan/门禁用例 | Low | 纯追加。 |
| `src/test/crossReserveOffsetStub.test.ts` | 新建 stub 单测（含真实 fixture 读取） | Low | 纯新增，形态对齐 `crossAssetPairingStub.test.ts`。 |
| `docs/specs/aav-1333-offset-ladder-dimensional-coherence.md` | 本文件 | Low | — |
| `docs/DOCS-INDEX.md` / `docs/issue-roadmap.md` | 登记 + 快照 | Low | 收口必改。 |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence |
| --- | --- | --- | --- | --- |
| L1 | cross：capacity 充足、cap 不绑定 | `gross = min(100000, room, capacity/2, minCap)`；三步 = {0.25, 0.5, 1.5}×gross；比例 0.25 / 0.5 / 1（末步归零） | Low | automated test |
| L2 | cross：target room < capacity/2 | `gross = room`，三步仍成比例，末步仍可融资（`1.5×room ≤ 0.75×capacity`） | Medium | automated test |
| L3 | cross：capacity 恰在 $5000 地板 | `gross ≥ 2500`，三步均为正且严格递增 | Low | automated test |
| L4 | cross：campaign `positionCapUsd` = 1200 | `gross = 1200`（cap 不绑定），三步 300/600/1800，比例仍精确 0.25/0.5/1 | Medium | automated test |
| L5 | cross：campaign 无 cap（`undefined`/`null`/`0`） | 视为 `∞`，不参与 min（`0` = 无上限是 Aave 语义） | Low | automated test |
| L6 | self-loop：正常 | `gross = min(100000, room)`；阶梯仍为 50k/100k/200k；`expectedRatio = min(step, capacity)/gross` | Low | automated test |
| L7 | self-loop：`ltv = 20%` | full 期望比例 0.2（旧 `0.4` 门槛在此形态必假红） | Medium | automated test |
| L8 | self-loop：room 缩到 10000 | `gross = 10000`、`capacity = min(borrowRoom, 8000) = 8000`，比例 0.8，不出现 >1 的期望 | Low | automated test |
| L9 | capacity 的两个钳制源 | `min(borrowRoom, funding×ltv)`；borrowRoom 更小时取 borrowRoom | Low | automated test |
| L10 | room/borrowRoom 为 `null`（未知） | 与既有门一致按 `∞` 处理，不产生 NaN | Low | automated test |
| L11 | plan 金额形态 | 全部为非负整数 USD、严格递增、无 `Infinity`/`NaN`/科学记数法，可直接 `input.fill` | Medium | automated test |
| L12 | target 有第二个可计算、但不响应的 supply 组 | 仍出场景；`weight = 2/5` ⇒ 期望比例 0.32（稀释被算进来，而不是丢场景） | Medium | automated test |
| L13 | target 另有不可计算组（过期） | 仍出场景且比例不稀释（该组渲染 `—`，不计入 `total`） | Low | automated test |
| L14 | target 有 `brevisSupplys` | 不出场景 | Medium | automated test |
| L15 | target 有 `supplyIncentives` | 不出场景 | Low | automated test |
| L16 | cap 退化 / cap 为 0 | `positionCapUsd = 1` ⇒ `gross < 100` ⇒ 不出场景；`positionCapUsd = 0` ⇒ 无上限 ⇒ 正常出场景 | Low | automated test |
| L17 | cross：`offsetReserveId` 缺失 | 不产出场景（既有行为 O7），plan 永不半成品 | Low | automated test |
| L18 | 场景携带 plan | `plan.targetSupplyUsd === plan.grossUsd`；cross 的 `offsetSupplyUsd` 非空且 `offsetReserveId` 指向 offset | Low | automated test |
| L19 | 排序 | cross 优先、APR 降序不变 | Low | automated test |
| L20 | runner 消费契约 | runner 打出的每个金额 = `plan` 字段，无 runner 侧二次推导（代码内不出现金额字面量） | Medium | static review（grep 无 500/1000/2000/50000）+ automated test（L18 plan/targetSupply 一致） |
| L21 | live self-loop 运行时 | `measured ≥ 0.9 × expectedRatio`；单调；baseline > 0 | Medium | runtime-real-data |
| L22 | synthetic cross 运行时 | 三步单调；step1/2 `measured ≥ 0.9×expected`；step3 归零 | Medium | runtime-real-data |
| L23 | 饱和步渲染 | `after ≤ 0.01`；cell 渲染 `—` 时读取为 0 同样通过 | Medium | runtime-real-data |
| L24 | stub 选场景 | 注入后真实 discovery 必须选中该 target 且 `type = cross-reserve`，否则抛错 | High | automated test |
| L25 | stub 不覆盖真实数据 | 目标组已有 `netPositionConstraint` ⇒ 抛错 | Medium | automated test |
| L26 | stub 形态漂移 | fixture 缺 target/组/breakdown ⇒ 抛错（不产出空场景 stub） | Medium | automated test |
| L27 | staging 不可达 | live 变体 fail（AAV-1352 契约），stub 变体照常执行 | Medium | runtime-real-data |
| L28 | 静态门 | 新文件纳入 `typecheck:e2e` + eslint 覆盖 | Low | static-type-lint |

## 验证证据（收口时补）

- 单测：`npm test -- reserveDiscovery crossReserveOffsetStub`（L1–L20、L24–L26）。
- 运行时：`E2E_PROXY=… npx playwright test e2e/portfolio-cross-reserve-offset.spec.ts`（L21–L23、L27）——必须给出 cross 与 self-loop 各自的 passed 数与实测比例值。
- 门禁：`npm run typecheck:e2e`、`npm run lint`。

## Out of scope

- 不改 app 侧任何计算（`rateSimulationCalculator` / `incentiveAggregation` / `netLendingCrossReserve`）：本票只修测试口径。
- 不拆分桌面/移动 spec 文件、不消除既有的 `test.skip(project.name)` 反模式（既有 20+ 文件同形，另有票）。
- 不为 self-loop 造 synthetic 载荷：它有真实 live 覆盖。
- 不新增/**降低** `PAIRING_SIM_MIN_ROOM_USD` 地板。
