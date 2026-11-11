# AAV-1318 — Offset E2E Discovery 仓位可行性门（借出空间 + LTV 融资额度）

> Status: drafted 2026-10-12 · Issue: AAV-1318 · Type: test-side hardening (e2e) · 先例: `docs/specs/aav-1308-cross-asset-pairing-discovery.md`

## 背景与根因

`discoverOffsetScenarios`（`e2e/reserveDiscovery.ts`，AAV-1280 抽出）只做了**可算性门**（`isComputableMerklCampaign`：时间窗 / whitelist / AMOUNT 变体），**仓位可行性门**停留在两道弱检查：

```ts
// e2e/reserveDiscovery.ts:362-368（target 与 offset 两侧共用）
function usableForOffsetPosition(r: DiscoveryReserve): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  if (typeof r.ltv !== 'number' || r.ltv <= 0) return false;
  if ((getSupplyRoomUsd(r) ?? Number.POSITIVE_INFINITY) <= 0) return false;  // ← 只查 > 0
  return true;
}

// e2e/reserveDiscovery.ts:420-421（仅 cross-reserve 的 offset 侧追加）
if (offsetReserve.borrowDisabled === true) continue;
if (!usableForOffsetPosition(offsetReserve)) continue;                       // ← 不查借出空间、不查 LTV 额度
```

缺口与 AAV-1308 同族，后果也同形——**假绿灯**（AAV-1308 已命名）：

| 缺口 | UI 侧真实行为 | 用例后果 |
| --- | --- | --- |
| offset 侧不查借出空间 | `availableBorrowRoomUsd` 把输入钳到 0（`rateSimulationCalculator.ts`） | runner 输入的借入额被钳成 0 → offset 从未发生 → `halfOffsetAfter < baselineAfter` 该失败；room 有几十美元时每一梯级被钳到同一个值，相对断言退化为噪音 |
| offset 侧不查 LTV 融资额度 | 借入侧靠 runner 先 supply $100k 撑出额度，低 LTV 时借不满（AAV-1250 clamping） | 实际借入远小于输入额 → 比例断言失真 |
| self-loop 的 target 侧两道门都不查 | self-loop 的借入就发生在 target 自己身上（`runSelfLoopScenario`：$50k/$100k/$200k） | target 借出空间为 0 时借入恒为 0 → 与 cross-reserve 同病，但**完全无门** |
| supply room 只查 `> 0` | room 只有几美元时 runner 的 $100k supply 被钳成同一个值 | 梯级塌缩为单点（AAV-1308 §5 已论证：`> 0` 不够） |

**当前真实数据（2026-10-12 实测 staging `/api/markets`，414 reserves）**：`discoverOffsetScenarios` 产出 **4 条场景，全部 self-loop，0 条 cross-reserve**（USDe@Ethena APR 5.25、USD₮@Celo 4.43、USDe@Avalanche 3.16、WETH@Celo 1.54）。4 条的 borrow room 均在 $2M–$4.8M、ltv 70–93，**在本票任一候选门下全部保留 → 今日收紧的场景数变化 = 0**。票面举证的坏数据形态（sAVAX@Avalanche 借出空间 $0、kHYPE@Ink $90）在当日载荷中真实存在，但当前未与可算 constrained 组搭配出现，属潜伏态。

因此本票与 AAV-1308 同态：**运行时证据上限是「未破坏」而非「修好了」**，门控正确性由单测逐条锚定。

### 一条顺带核出、但本票不修的事实（诚实记录）

runner（`e2e/portfolio-cross-reserve-offset.spec.ts` 的 `run*Scenario` 函数）的 cross-reserve 梯级是 **$500 / $1000 / $2000**（`:71` `:78` `:91`），target 上 supply **$100k**（`:57`）。按 app 侧数学：

- 净仓位：`netEligible = max(gross − Σ offset 借入, 0)`（`src/lib/netLendingCrossReserve.ts:15-30`）
- 渲染：`apr渲染 = apr × eligible / gross`（`src/lib/incentiveAggregation.ts:117-120`）
- 合起来：offset 后的下降量 `decrease = apr × B / gross`

代入 runner 的比例断言 `decrease ≥ 0.4 × targetApr`（`:85-88`）⇒ 要求 `B ≥ 0.4 × gross` ⇒ cross-reserve 侧要求 `gross ≤ $2.5k`，即**只有在 target 的 supply 被 supply room 钳到 ≤ $2.5k 时才可能成立**，与 borrow room 无关。这是 runner 梯级与断言之间的不自洽（`0.4` 是写测试时手挑的常量，只对 self-loop 梯级 $50k/$100k on $100k 成立）。本票不碰 runner，另开 follow-up 票（见 Out of scope）。

## 设计

复用 AAV-1308 已导出的底座，**不新写一套门**（票面要求）：

1. **cross-reserve 的 offset 侧**：用 `usableForSimulatedPosition(offsetReserve, 'borrow')` **替换**现有的 `borrowDisabled === true` + `usableForOffsetPosition(offsetReserve)` 两道检查。该谓词已包含 `borrowDisabled`、frozen/paused/inactive/supplyDisabled、`ltv > 0`，且其严格化增量恰好是票面要的三项：`supplyRoom ≥ PAIRING_SIM_MIN_ROOM_USD`（原 `> 0`）、`borrowRoom ≥ PAIRING_SIM_MIN_ROOM_USD`（新增）、`min(supplyRoom, PAIRING_SIM_FUNDING_USD) × ltv/100 ≥ PAIRING_SIM_MIN_ROOM_USD`（新增 LTV 融资额度）。叠加则完全冗余。
2. **self-loop 的 target 侧**：`type` 判定之后追加 `usableForSimulatedPosition(r, 'borrow')`。self-loop 没有 offset reserve——借入发生在 target 自己身上，故 target 必须能承载一个借入仓位。target 的基础门仍是 `usableForOffsetPosition(r)`（supply 侧可行性，AAV-1280 已验收行为），只在 self-loop 形态下追加借入侧门。
3. **cross-reserve 的 target 侧不动**（保持 `usableForOffsetPosition`）。runner 在 cross-reserve target 上只 supply $100k、不借入；且 supply 被钳小时 `gross` 变小、`B/gross` 反而变大，比例断言更容易过——没有实证失败形态，收紧只会让前后场景数对比的归因变脏。
4. **地板取值 `PAIRING_SIM_MIN_ROOM_USD = 5000`（不新增可按 runner 覆盖的参数）**。已知该地板比 cross-reserve 梯级最大值 $2000 严 2.5 倍：真出现 borrow room $3,000 的 offset reserve 时会被 skip，而它本来能跑。取舍理由是 skip 属安全失败模式、$5,000 对主流 reserve 无门槛、且与 AAV-1308 同族口径一致（若改为 $2,000 需给谓词加参数，即半步新逻辑，违反票面「直接复用」）。该偏严记入「已知限制」。
5. **失败形态仍是 skip 而非产出**：被门排除的组 `continue` 且**不写入 `seen`**，与现有 cross-reserve offset 被拒的行为一致——同一 reserve 的后续组仍有机会入选。
6. **fixture 形态修正（证据卫生）**：既有 O 系列 fixture 用 18-decimals 默认 + `suppliable: '1000000000'`，换算后 supply room 约 $1e-9——在新增的可行性门下会被整片排除，而这与真实数据形态不符（AAV-1308 的 P 系列 fixture 已改用 6-decimals + 真实 room）。故抽一个共享的 `realisticRoom`（`decimals: 6` + `tokenPrice: 1` + `suppliable`/`borrowable = MIN_ROOM × 10`），O 系列 target/offset 与 P 系列 `pairingReserve` 一并消费；`MIN_ROOM` 与 `usd()` 上移到文件顶部（在两个 describe 之前），避免 O 系列跨段反向引用常量而把 TDZ 隐患留给后来人。

### 已知限制（不为本票阻塞）

- **地板偏严**：cross-reserve 梯级最大只借 $2,000，而门要求 borrow room ≥ $5,000。
- **self-loop 中间带**：门的地板是 $5,000，而 self-loop 的比例断言要求 `borrowRoom ≥ 0.4 × gross`（gross 最多 $100k → 需 ≥ $40k）。即 borrow room 落在 $5k–$40k 的 self-loop 场景能过本门但仍会挂比例断言。彻底堵死需要把 runner 的断言常量耦合进 discovery，违反票面「无需新写逻辑」；今日 4/4 真实场景零影响，若未来真实数据踩中再开 follow-up。
- **self-loop target 的 supply room 地板被一并抬到 $5,000**：这是「复用谓词而非新写逻辑」的必然后果——`usableForSimulatedPosition(r, 'borrow')` 内含 supply 侧地板，而不只是借出空间与 LTV 两项。方向仍是「更可能 skip」，且 O18/O19/O20 已把边界钉住。
- **`null` room 只在 room 两维成立，LTV 维无条件生效**：room 缺失按「不设限」参与 `min(supplyRoom, 100k) × ltv/100`，故一条 room 数据全缺但 LTV 极低的 reserve 仍会被 skip。该语义继承自 AAV-1308 的谓词（非本票引入），O20（`ltv=80`）不覆盖该组合。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/reserveDiscovery.ts` | `discoverOffsetScenarios`：offset 侧两道检查替换为 `usableForSimulatedPosition(offset,'borrow')`；self-loop 追加同谓词（target 自身）；docblock 同步 | Medium | 唯一消费者是 `e2e/portfolio-cross-reserve-offset.spec.ts`（第二个消费者 `src/test/reserveDiscovery.test.ts` 是单测）。谓词本身 AAV-1308 已验收、本次不改。方向是「更可能 skip」——skip 是安全失败模式，不阻塞 push。 |
| `src/test/reserveDiscovery.test.ts` | 新增 O12–O22（场景矩阵）+ O 系列 fixture 形态修正 + `MIN_ROOM`/`usd()` 上移 | Low | 纯追加 + fixture 形态修正；P 系列与 M/S 系列不触碰。 |
| `docs/specs/aav-1318-*.md`（本文件）、`docs/DOCS-INDEX.md` | 新增 spec 并登记 | Low | 文档。 |

最坏后果：门控过紧，未来真实 offset 活动被误 skip。缓解：每条门有单测锚定、方向保守（只会把「会失败的场景」变成 skip，不会把「能过的场景」变成失败）；且本票附带 staging 实跑的场景数 before/after 对比作为运行时对照。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| O12 | cross-reserve：offset `borrowRoom < 5000`（票面形态：sAVAX borrowRoom = $0） | 不产出场景 | High | automated test | 票面举证的原始形态 |
| O13 | cross-reserve：offset `borrowRoom` 恰为地板 | 产出（地板是「够」，不是「必须超过」） | Medium | automated test | — |
| O14 | cross-reserve：offset 无借出空间数据（`borrowRoom = null`） | 产出（`null` = 不排除，与 `getSupplyRoomUsd` 同契约） | Medium | automated test | — |
| O15 | cross-reserve：offset `borrowDisabled = true` | 不产出（谓词内含，替换后不回退） | Low | automated test（O7 回归 + O15） | — |
| O16 | cross-reserve：offset room 充裕但低 LTV（`min(supplyRoom,100k) × ltv/100 < 5000`） | 不产出（LTV 融资额度不足） | High | automated test | 票面要求的新增门 |
| O17 | cross-reserve：offset `supplyRoom < 5000`（原门只查 `> 0`） | 不产出（严格化增量） | Medium | automated test | — |
| O18 | self-loop：target 自身 `borrowRoom < 5000` | 不产出（借入被钳零 → 断言假绿） | High | automated test | self-loop 是今日唯一真实产出形态 |
| O19 | self-loop：target room 充裕但低 LTV 撑不出借入 | 不产出 | Medium | automated test | — |
| O20 | self-loop：target 无 room 数据（supply/borrow 均 `null`） | 产出（`null` 不排除） | Medium | automated test | — |
| O21 | cross-reserve：**target** `borrowRoom = 0` / `borrowDisabled = true` | **仍产出**（target 侧门不动；负对照，防止过度收紧） | Medium | automated test | Q3 决策：无实证失败形态，归因保持干净 |
| O22 | 门按场景类型生效：同一 reserve 上 self-loop 组被借入门拒绝，其 cross-reserve 组仍产出 | 只产出 cross-reserve 场景（target 借出空间为 0 不牵连 cross 形态） | Medium | automated test | 与 spec §5 一致：被拒组 `continue` 且不写 `seen` |
| O23 | 回归：O1–O11 在新门下仍绿（含 O9 排序、O2 字段契约、O7 排除形态、O11 label） | 全部保持既有断言 | High | automated test（既有 11 条，fixture 改真实 room 形态后仍全绿） | fixture 形态修正见设计 §6 |
| O24 | 当日 staging 实跑 | offset 场景数 before/after 对比被显式记录；无 collection error、无新增失败 | Medium | runtime-real-data | 与 AAV-1308 同态：「0 变化」证明未破坏，不证明修好 |

### 验证证据（Evidence Hygiene 要求的非空产出）

- 单测（TDD，先红后绿）：改后实现前跑 `src/test/reserveDiscovery.test.ts` → **6 failed / 110 passed**，失败项恰为 O12、O16、O17、O18、O19、O22（其余 O13/O14/O15/O20/O21 为「仍可选」的护栏，改前即绿）；改后 **116 passed / 116**。
- 全量：`npm test` → **1 failed | 4117 passed | 14 skipped | 6 todo（4138）**。唯一失败为 `src/test/crossAssetPairingStub.test.ts > SY5b`（`Test timed out in 5000ms`），与本票无关：该文件只消费 `discoverCrossAssetPairingScenarios`（AAV-1316 桩，本票未触碰），单独重跑该用例 **8 passed，SY5b 耗时 1274ms** —— 属全量并发下的 5s 超时抖动。
- 静态：`npm run lint` **0 error（76 warnings，全为既有 complexity 类）**；`npm run typecheck` **0 error**。
- 运行时（真实 staging 数据，同一份快照 + 同一 `now`，before = `git show HEAD:e2e/reserveDiscovery.ts` 导出的改前副本，after = 工作区实现）：

  ```
  snapshot: reserves=414  now=2026-10-11T19:30:13Z
  BEFORE total=4  cross-reserve=0  self-loop=4
  AFTER  total=4  cross-reserve=0  self-loop=4
  delta   = 0
    KEEP  self-loop  USDe[Ethena Ecosystem] apr=5.248…
    KEEP  self-loop  USD₮[Celo]              apr=4.433
    KEEP  self-loop  USDe[Avalanche]         apr=3.164…
    KEEP  self-loop  WETH[Celo]              apr=1.538
  ```

  与 grill 阶段推演一致：**今日收紧的场景数变化 = 0**，4 条 self-loop 全部保留（borrow room $2M–$4.8M、ltv 70–93）。本票属结构性修复，运行时证据只证明未破坏，门控正确性由 O12–O22 承担。

- e2e 实跑（`E2E_PORT=4173 npx playwright test portfolio-cross-reserve-offset`，dev server 走 `VITE_API_BASE_URL=staging`，真实点击 UI）：**8 passed / 8 skipped / exit 0（50.6s）**。4 条 self-loop 场景在 desktop 与 mobile 两个 project 下各跑一遍全绿，无 collection error。8 条 skip 即 AGENTS.md 点名的 platform 互斥 skip 反模式（每个 project 只跑自己那一半），属既有模式、本票不动。
  - 环境注记：本机 `npm run dev` 的 `clear-vite-cache.mjs` 被沙箱 safe-delete shim 拦截（`node_modules/.vite` 433 文件 > 单轮 50 阈值），Playwright webServer 起不来。绕行方式是手动起 `vite --mode staging --port 4173 --strictPort` 并设 `E2E_PORT=4173` 让 `reuseExistingServer` 复用——**与本票改动无关的环境限制**，记录以免下次误判为回归。

- 数据事实（2026-10-12 staging `/api/markets`，414 reserves）：`crossAssetPairing` 与带 cross-offset 的可算 constrained 组当日均为 0 条；票面举证的坏形态（sAVAX@Avalanche 借出空间 $0、kHYPE@Ink $90）在载荷中真实存在但未与可算组搭配出现，属潜伏态。

## Out of scope

- **runner 梯级与比例断言不自洽**（cross-reserve 只借 $500/$1000/$2000，而 `decrease ≥ 0.4 × targetApr` 要求 `gross ≤ $2.5k`）：本票不动 runner；建议独立 follow-up 票（AAA 待建）。
- **fill helper 按 `reserveId` 定位**（与 AAV-1308 P11 同源）。
- **e2e 平台互斥 skip 反模式**（`test.skip(testInfo.project.name.includes('mobile'), …)`）：仓库级既有模式，本票不动。
- **e2e 目录未被静态门完整覆盖**：本票改动落在 `e2e/reserveDiscovery.ts`，该文件因被 `src/test/reserveDiscovery.test.ts` import 而被 `npm run typecheck` 顺带编译；spec 文件仍无静态门，必要时显式跑 `tsc --noEmit`。
