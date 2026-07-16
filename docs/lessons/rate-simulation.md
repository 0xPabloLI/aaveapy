# Learned Lessons: Rate Simulation Calculator

Historical lessons from working on `rateSimulationCalculator.ts` and related incentive calculation logic. Extracted from AGENTS.md to keep it concise. These are reference material — read when modifying the calculator or incentive aggregation.

## CJK 全角小数点归一化 (AAV-739)
- 中文/日文输入法在非数字上下文按 `.` 出 `。`(U+3002)/`．`(U+FF0E)/`｡`(U+FF61) 而非 ASCII `.`(U+002E)。`sanitizeNumberInput` 必须先归一化全角小数点，否则被 `[^\d.]` 正则当非法字符删掉。归一化放在 sanitizer 最前面，先于逗号去除和数字过滤。

## handleFocus cursor 修复走 pendingCursorRef (AAV-739)
- `handleFocus` 中 `setDisplayValue` 触发 React re-render 会覆盖同步 `setSelectionRange`。必须用 `pendingCursorRef` + `useLayoutEffect`（与 `handleChange` 一致），在 re-render 后恢复 cursor。

## 实时千分位格式化 (AAV-745)
- `useDebouncedInput` 的 `handleChange` 必须 sanitize→formatNumberInput→setDisplayValue，输入过程中实时显示千分位。`computeCursorAfterFormat` 基于 cursor 前有效数字字符数推算格式化后位置。handleFocus 不剥离逗号（只设 cursor 到末尾），handleBlur 保留 formatNumberInput（幂等防御）。CJK 全角小数点归一化（AAV-739）必须在 format 之前完成。

## Simulation `after` 语义（AAV-761）
- **`after=0` 与 `after=null` 语义不同，`??` 运算符下行为迥异**: `0 ?? fallback` → `0`（不 fallback），`null ?? fallback` → `fallback`。当 `hasInput=false` 时，after 必须为 `null`（表示"未参与模拟，使用 current 值"），不能为 `0`（表示"模拟后为 0%"）。这条规则适用于所有 `SimulationLane` 的 after/delta 字段及 per-campaign detail row。
- **多层计算链路需逐层统一语义**: campaign row 层（`buildMeritCampaignDetails`/`buildMerklCampaignDetails`）、`buildMetricsFromLane` 层、aggregate 层（`supplyAfterSources`/`borrowAfterSources`）需一致使用 `hasInput` 分支，否则会出现某层 `after=null` 而另一层 `after=0` 的矛盾。修改某一层时必须检查上下游所有层级。
- **Portfolio 模式传 delta 而非 total position，导致 hasInput 判断需特别小心**: `buildPerReserveInputsFromEntries` 传入 delta，当 borrow 有 delta 但 supply delta=0 时 `rawSupply=0, hasSupplyInput=false, hasBorrowInput=true`。`hasAnyInput` 为 true 不代表每个 side 都有 input——必须用 per-side `hasInput` 而非全局 `hasAnyInput` 来决定 per-side after 语义。
- **Per-campaign detail row 的 `else if (hasAnyInput)` 分支必须显式设 `after=null`**: Merit base/self、Merkl 三处原先设 `after=0`，导致 `pickScenarioValue` 不 fallback。修复：`after=0` → `after=null`，让 `??` 正确回退到 current。

## AAV-761 回归修复 — per-side 守卫 vs 跨側影响
- **`hasSupplyInput`/`hasBorrowInput` 守卫切断跨侧影响（中间尝试，已回退）**: aggregate 层（`supplyAfterSources`/`borrowAfterSources`、4 个 `afterIncentiveRaw`/`afterIncentiveAprRaw`）曾从 `hasAnyInput` 改为 per-side 守卫，导致 Shared Scenario 下无输入侧的 after 变为 null，UI 显示错误。修复：6 处守卫改回 `hasAnyInput`。
- **`SimulationLane.hasInput` 保持 per-side 不改**: Portfolio 消费端（`buildMetricsFromLane`）用 `lane.hasInput` 做二次守卫实现 em dash，per-side 语义正确。aggregate 层用 `hasAnyInput` 保留跨侧影响，消费端用 `hasInput` 做显示控制——两层守卫各司其职。
- **cross-side 测试断言不是 `after === current`**: 跨側影响保留后，无输入侧的 after 值可以因对侧输入而变化（如 Brevis 共享 cap），正确断言是 `after !== null`（有值可显示），而非 `after === current`（值不变）。
- **`SimulationLane` 没有 `after`/`delta` 字段**: 只有 `afterTotal`/`deltaTotal`、`afterNative`/`deltaNative`、`afterIncentive`/`deltaIncentive`。测试中不要用 `lane.after`/`lane.delta`。

## 单一变量承载多语义导致 double-count (AAV-761 merit-deposit-ceiling-dilution)
- **变量命名直接决定代码能否自文档化**: 旧名 `principalSupplyUsd` 暗示"已有本金（不含 delta）"，实际值 = wallet + delta（含 delta 的总仓位）。这导致 `totalPositionUsd = principal + netInput` 公式在设计时引入了 double-count。改名 `totalSupplyUsd` 后（见下方 § 重命名），语义自明：`totalPositionUsd = totalSupplyUsd`（无需加任何东西）。**教训：变量名必须精确反映值的构成（wallet + delta），不能只取其中一部分（principal）暗示另一种语义。**
- **数据源语义必须显式文档化**: `reservePositions` 在 single simulation 下存的是 shared simulation input（`parseNumberInput(debouncedSharedSupplyInput)`），不是钱包仓位。代码中用 `reservePositions` 这个名字暗示"仓位"，构建处的注释只说"用于 cross-reserve eligibility"——没有说明在 single simulation 下这些值就是 simulation input 本身。**教训：数据容器名称应与数据源语义一致；如果同一容器在不同模式下承载不同语义，必须在类型或注释中显式标注。**
- **`X + Y` 计算必须覆盖 `X === Y` 的边界用例**: 当两个加项可能来自同一数据源时（如 single simulation 中二者都来自 shared input），`A + A = 2A` 就是 double-count。**教训：做 `X + Y` 计算时，TDD 必须覆盖"X 和 Y 相等时结果是否符合预期"的边界用例。** 恰好漏掉这类测试会导致回归测试通过但逻辑错误。
- **Calculator 层无法保护调用层传错误值**: `buildRateSimulationResult` 的参数合约需要调用侧保证 `totalSupplyUsd ≥ supplyNetInputUsd`，但调用侧可能 `totalSupplyUsd = supplyNetInputUsd = simulationInput`（single simulation）。**教训：关键合约约束应在 calculator 层加断言，而非依赖注释和调用侧的"自觉"遵守。**

## 重命名 `principalSupplyUsd` → `totalSupplyUsd` (AAV-761 refactor)
- **`totalSupplyUsd` = 总仓位 (wallet + delta)**：用于 USD accrual 收益计算和 Merit position cap 稀释公式。名字"total"即自说明：它就是总数，不要再加。
- **`supplyNetInputUsd` = 净 delta (max(supplyInput - borrowInput, 0))**：推动利率曲线的量，不包含已有仓位。新旧都叫delta，不变。
- **公式 `totalPositionUsd = totalSupplyUsd`**（直接取用，不做加法）：因为 total 本身已含 delta，加 netInput 即 double-count。
- **入口统一**：Single simulation 和 Portfolio simulation 通过同一个 `perReserveInputs` Map 分发，只在 single 模式下为 undefined（不含 total），portfolio 模式下有值。两者统一调 `useSharedRateSimulations`，只有数据不同，没有代码路径分支。

## Fallback 上移到调用层 + 命名统一 (AAV-761 refactor v3)
- **隐式 fallback 分散在 calculator 层导致语义不可见**：旧方案 `buildRateSimulationResult` 内部 `effectiveTotalSupplyUsd = totalSupplyUsd ?? (hasSupplyInput ? supplyInputUsd : undefined)` 让单模拟模式下 `totalSupplyUsd` 的语义（"输入即总仓位"）隐藏在 calculator 内部，不读源码无法知道。
- **上移方案**：fallback 逻辑移到 `useSharedRateSimulations`（唯一调用入口），`buildRateSimulationResult` 直接使用传入的 `totalSupplyUsd`/`totalBorrowUsd`，不做任何 `??` 回退。calculator 的合约变简单：调用方负责提供正确的 total position，不提供 = 无 total。
- **`reservePositions` → `crossReservePositions`（8 个文件）**：旧名 `reservePositions` 暗示"仓位"，但在 single simulation 下存的是 simulation inputs。新名 `crossReservePositions` 准确描述用途（跨 reserve 的 net eligibility 计算），不暗示具体存的是什么。
- **contract 从隐式变显式**：`buildRateSimulationResult` 的 JSDoc 明确列出三种调用方合约——Portfolio 传 wallet+delta、Single 传 inputUsd、无输入传 undefined。未来新增调用方不会因"不知道 calculator 内部有 fallback"而传错值。

## Wallet-only incentive delta 不显示 (AAV-771)
- **`buildIncentiveCurrent` 需区分"稀释计算"和"headline 展示"两种用途**：旧版只有一个 `depositUsd` 参数，`hasInput=false` 时传 0 导致 position cap 稀释被跳过。修复：新增 `walletSupplyUsd`/`walletBorrowUsd` 参数，与 `depositUsd`（input 用）语义分离。wallet-only 场景下 wallet 有值、depositUsd=0，仍然正确计算稀释。
- **`totalSupplyUsd = wallet + delta` 公式可直接推导 wallet**：portfolio 模式下 `wallet = totalSupplyUsd - supplyInputUsd`，single simulation 下 `totalSupplyUsd` 未定义所以 wallet 为 undefined。这个推导避免了调用方额外传 wallet 参数。
- **`portfolioSimulator.ts` 跳过 wallet-only positions 导致 totalSupplyUsd 丢失**：`buildGroupMapFromSlots` 和 `buildPerReserveInputsFromEntries` 原来用 `if (amountUsd <= 0) continue` 跳过 delta=0 的 side，导致 wallet value 没被累加。修复：先判断 `hasWalletPosition` 和 `hasUserInput`，两者都不满足才跳过。
- **`formatDeltaPercent` 阈值过滤可能掩盖逻辑 bug**：delta=0 被过滤掉后 UI 不显示，用户看不到 delta 但也不知道是"无稀释"还是"计算错误"。threshold 过滤不能替代正确的空语义——null 表示"无 delta 概念"，0 表示"有 delta 但值为零"。

## AAV-761 方向回撤 — walletSupplyUsd 推导不应被 hasInput 守卫阻断
- **Deposit Ceiling 稀释是钱包仓位本身的属性，不是用户输入的属性**：即使用户没有输入任何 delta，只要钱包仓位超过了 Deposit Ceiling，current incentive 就应该显示稀释后的值。`walletSupplyUsd` 推导必须始终执行（`totalSupplyUsd != null` 即可），不能加 `hasSupplyInput` 守卫。
- **AAV-761 修复曾错误地引入 `hasSupplyInput` 守卫**：`walletSupplyUsd = explicitWalletSupplyUsd ?? (hasSupplyInput && totalSupplyUsd != null ? totalSupplyUsd - supplyInputUsd : undefined)` 导致 `hasInput=false` 时 `walletSupplyUsd=undefined`，`buildIncentiveCurrent` 走 headline 分支不稀释，用户看到的是"所有仓位都能拿 incentive"的错误值。修复：去掉 `hasSupplyInput` 守卫，改为 `totalSupplyUsd != null ? totalSupplyUsd - supplyInputUsd : undefined`。
- **`deltaIncentive` 分两路计算，必须匹配 `deltaNative`/`deltaTotal` 模式**：旧公式 `walletSupplyUsd != null ? currentIncentive - headlineIncentive : null` 永远只算 wallet dilution gap，不管 `hasInput`。修复后分两路——`hasInput=true` → `afterIncentive - currentIncentive`（simulation 效果）；`hasInput=false` + wallet → `currentIncentive - headlineIncentive`（wallet 稀释缺口）；`hasInput=false` + 无 wallet → `null`。三态统一：`hasInput` 决定 simulation delta，wallet 决定 dilution gap，两者互斥。

## deltaIncentive 公式修复 — 三态分路
- **`deltaIncentive` 永远只用 `current - headline` 是 bug**：旧公式使纯 manual（无 wallet）时 delta 为 null（不显示），wallet + manual 时 delta 永远等于 dilution gap 不随输入变化。原因：`deltaIncentive` 从不使用 `afterIncentive`。
- **修复后三态分路**：`hasInput=true` → `afterIncentive - currentIncentive`（simulation 效果）；`hasInput=false` + wallet → `currentIncentive - headlineIncentive`（dilution gap）；`hasInput=false` + 无 wallet → `null`（无数据可显示）。
- **`deltaIncentive` 与 `deltaNative`/`deltaTotal` 模式一致**：三者都遵循 `hasInput ? after - current : null` 核心模式，`deltaIncentive` 额外在 `hasInput=false` 时加 wallet dilution gap 分支。

## 同名 per-source sum 函数口径不一致 (AAV-978)
- **per-source sum 的 canonical 实现必须在 `incentiveAggregation.ts`**：`rateSimulationCalculator.ts` 曾维护独立的 `sumBrevisIncentiveApr`（纯 headline，无 forecastStates），与 `incentiveAggregation.ts` 的同名函数（支持 forecastStates）口径不同。dispatch map 的 per-source current 用 calculator 版本，`buildIncentiveCurrent` 的 total current 用 aggregation 版本，导致分项之和 ≠ 总值。**教训：per-source sum 函数只有一个 canonical 位置（`incentiveAggregation.ts`），calculator 层只 import 不重建。**
- **per-campaign current 也必须与 per-source sum 口径一致**：`buildBrevisCampaignDetails` 中 per-campaign `current` 用 `sanitizePercent(resolved.campaignApr)`（headline），但 per-source sum 用 `resolveBrevisCurrentApr(resolved, forecastStates)`（可能含 forecast），导致 campaign detail 行的 current 之和 ≠ per-source current。**教训：修改 per-source sum 时必须同步修改 per-campaign current 计算。**
- **抽取辅助函数消除重复**：`resolveBrevisCurrentApr(resolved, forecastStates)` 被三处共享（`sumBrevisIncentiveApr` 的 mapValue、`sumBrevisIncentiveApy` 的 mapValue、`buildBrevisCampaignDetails` 的 current），避免改一处忘改另一处。
- **APY 转换策略统一为 APR-only + 独立 APY 函数**：Merit/Merkl/Brevis 统一使用 `sumXxxIncentiveApr`（纯 APR）+ `sumXxxIncentiveApy`（APY 转换），不再用内联 `isApy` 参数。dispatch map 按需选调。

## per-source sum 统一后 dispatch map 参数映射 (AAV-980)
- **统一 per-source sum 后必须逐参数校验映射**：旧 calculator `sumMerklIncentiveApr(opportunities, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates?, groupMultiplier?, campaignAccessStatuses?)` → 新 aggregation `sumMerklIncentiveApr(opportunities?, pointToUsdRate?, options?)`。review 发现 `sumAfter` 遗漏了 `campaignAccessStatuses`（旧代码第 7 个参数，新代码在 `options` 中），导致黑名单 campaign 在 after 计算中未被过滤。**教训：签名迁移时必须逐参数对照，options 对象比位置参数更容易漏传。**
- **`getPointToUsdRate` 的 fallback 语义必须与 symbol 归属一致**：`tydroPointToUsdRate` 是 TydroInk 专属换算率，`getPointToUsdRate` 在 symbol 不在 map 中返回 0 是正确的——不同 symbol 不应 fallback 到另一个 symbol 的 rate。"查不到" = "不知道" = 0，而非"用另一个 rate 凑数"。
- **`groupMultiplier` 需要加到 aggregation 版才能统一**：aggregation 版 `sumMerklIncentiveApr` 原先缺少 `groupMultiplier` 支持，但 `sumActiveCampaignBreakdownValues` 已支持。统一前需确认 aggregation 版具备 calculator 版的所有能力，否则统一后会丢功能。

## APR capped note 显示条件 (AAV-1059)
- **`regime === 'APR_CAPPED'` 不等于"cap 对用户产生了新影响"**：`forecastWithTVL` 返回 `APR_CAPPED` 只表示 `aprBasedDaily < requiredDaily`（cap 在数学上是 binding 的），但低 TVL 池子 current 就已经是 cap 后的值（`campaignApr ≈ aprCap`），after 也等于 aprCap，`after === current`。此时 note 只是重复已知信息，无新增价值。**教训：note 显示条件必须是"cap 使 after 低于了 current"，而非"cap 在数学上是 binding 的"。**
- **`after < uncappedAfter` 是 no-op 判定**：低 TVL 时 uncapped after 极大（`requiredDaily * 365 / tvl`），`after < uncappedAfter` 永远成立，等价于原来的 `regime === 'APR_CAPPED'`。正确判定是 `after < current`：只有当 headline APR（current）高于 cap 后的实际 APR（after）时，note 才有意义。
- **`after < current` 的语义**：current 来自 `campaignApr`（headline，API 返回的展示值），after 来自 `forecastWithTVL`（cap 后实际值）。当 `campaignApr > aprCap` 时 current > after，说明 headline 夸大了实际收益，note 告知用户"你看到的 APR 被 cap 压低了"。当 `campaignApr ≈ aprCap` 时 after ≈ current，headline 已经反映了 cap，note 无新信息。
- **`ignoreCap` 不应影响 FIX_REWARD 路径**：FIX 的 `aprCap` 是固定发放率（不是上限），`ignoreCap` 只应在 MAX_REWARD 和 TARGET_TOTAL_APR+MAX_APR 路径生效。实现方式：FIX 路径用 `rawAprCap`，MAX 路径才用 `ignoreCap ? Infinity : rawAprCap`。
- **MAX_REWARD 和 TARGET_TOTAL_APR 的 cap 不需要区分文案**：两者对用户来说都是"池子 TVL 低导致 APR 被压低"，行动指引一样，不需要不同的 note 文案。

## Merkl eligibility 缩放与 headline 一致性 (AAV-1060)
- **`grossUsd` 必须用 total position 而非 delta-only `supplyInputUsd`**：`merklGroupMultiplier` 和 `merklCrossReserveNote` 的 `grossUsd` 原来用 `side === 'supply' ? supplyInputUsd : borrowInputUsd`（delta-only），当 `supplyInputUsd=0` 但 `totalSupplyUsd=1042` 时 `computeCrossReserveEligibilityRatio` 因 `sourceGrossUsd<=0` 返回 1，跳过 cross-reserve offset 缩放。修复：改为 `supplyGrossForEligibility`（`totalSupplyUsd ?? supplyInputUsd`，total-based）。**教训：eligibility 计算的"总仓位"语义必须与 `buildIncentiveCurrent` 中的 wallet 推导一致——都是 total-based，不是 delta-based。**
- **aggregate current 必须与 per-source current 使用同一 `merklGroupMultiplier`**：`buildIncentiveCurrent` 原来缺少 `merklGroupMultiplier` 参数，导致 aggregate current 无 eligibility 缩放而 per-source current 有，分项之和 ≠ 总值。修复：把 eligibility ratio + multiplier 计算提前到 `buildIncentiveCurrent` 调用之前，传入参数。**教训：aggregate 和 per-source 必须共享同一个缩放函数实例，不能一个有一个没有。**
- **headline incentive 必须与 current incentive 使用同一 `merklGroupMultiplier`**：`supplyHeadlineIncentive`/`borrowHeadlineIncentive` 原来不传 `merklGroupMultiplier`，而 `buildIncentiveCurrent` 已传。`deltaIncentive = currentIncentive - headlineIncentive` 在 wallet dilution gap 路径下缩放口径不一致。**教训：`deltaIncentive` 三态分路的每一路（simulation delta / wallet dilution gap / null）都要求 `current` 和 `headline` 使用同一缩放——否则差值的语义会混入缩放差异。**
- **`merklCrossReserveNote` 的 `grossUsd` 也需 total-based**：note 中显示的 `$1,042`（总仓位）而非 `$0`（delta），让用户看到正确的 net eligible 比例。Bug 1 修复的 `supplyGrossForEligibility` 自动覆盖了 note 逻辑。**教训：修复一个变量名时，检查同一变量的所有消费点——函数签名参数可能只传一次，但内部多路分支可能依赖不同的语义。**
- **被删除的 caller contract 注释必须恢复**：`totalSupplyUsd` 三种调用方合约说明（Portfolio: wallet+delta / Single: input=total / No input: undefined）在代码搬迁时被删除。**教训：有合约语义的注释必须跟着变量走，搬迁代码时先复制注释再删除原位。**
- **Brevis position cap 的 positionUsd fallback 应为 total-based（AAV-1060 #10）**：`sumForecastBrevisIncentiveApr` 和 `buildBrevisCampaignDetails` 的 `positionUsd` 原来用 `combined ?? inputUsd`（delta-only fallback），当 `combined` 不存在但 `totalPositionUsd` 有值时（如 single simulation），Brevis cap 基于 delta 而非 total position，与 Merit position cap 语义不一致。修复：`positionUsd = combined ?? totalPositionUsd ?? inputUsd`。**教训：同质的 position cap 语义（Merit cap 和 Brevis cap 都约束 per-user APR）必须使用同质的 position 度量——都是 total-based，不是 delta-based。**
- **headline 含 forecast 不影响 deltaIncentive 语义（AAV-1060 #6/#11-13 验证）**：headline incentive 调 `calculateTotalIncentiveApr` 传了 `forecastStates`，看似会让 `deltaIncentive = current - headline` 混入 forecast 变化。但验证后发现：(1) Merkl/Brevis 两边都含 forecast，差值抵消为 0；(2) Merit current 中 `sumForecastMeritIncentiveApr(depositUsd=0)` 跳过 forecast 路径只做 position cap，headline 用纯 `campaignApr` 无 forecast 无 cap，差值 = 纯 position cap dilution。**教训：差值语义需要逐 source 验证抵消关系，不能仅凭"两边参数不同"就断言有 bug——可能恰好抵消。**

## 测试参数错位与流程缺失（Merkl Position Cap 实现）
- **多可选参数函数的测试调用必须逐参数对照签名**：`buildMerklCampaignDetails` 有 16 个参数，测试中 `eligibilityRatio`（第 8 位，默认=1）被传了 `1000`，`grossInputUsd`（第 9 位）被传了 `undefined`——错位一个位置。结果 `after = campaignApr * 1000 * 1 = 10000` 而非预期的 10。**教训：超过 5 个参数的函数调用，写测试时必须逐参数对签名注释，或改用 options 对象模式。参数错位的症状是"值异常大/小"且恰好等于 `expected * wrongParam`。**
- **跨前后端功能必须走 PRD → Issues → Implement 流程**：Merkl position cap 涉及后端类型/提取/OpenAPI schema + 前端类型/Zod schema/计算逻辑/测试，是跨前后端的复杂功能。跳过 PRD 直接写代码导致：(1) 没有 scope 边界，改动蔓延；(2) 没有 issue 追踪，进度不透明；(3) 没有 code review checkpoint；(4) 没有 dev server 验证。**教训：涉及 3+ 文件/跨层级的改动，必须先写 PRD 确认 scope，拆 issue 逐步实现，每步 review + 验证。**
- **Position Cap 统一入口不值得做**：4 个调用点（Merit×2, Merkl×1, Brevis×1）的 `positionUsd` 推导逻辑各不同（Merit: `totalPositionUsd ?? inputUsd`，Merkl: `netForEligibility ?? (grossInputUsd ?? inputUsd)`，Brevis: `effectiveInputUsd`），options 差异也大（Brevis 传 remainingBudget/dailyRewardUsd/remainingDays，Merit 传 campaignName，Merkl 只传 isCombineCap）。`applyPositionCapToForecastResult` 本身已是统一入口。**教训：当调用前参数推导和调用后处理差异大于共享逻辑时，强行统一 wrapper 增加间接层认知成本，不如保持各点独立调用统一底层函数。**

## isCombineCap 语义 vs netPositionConstraint (AAV-1075/1076)
- **`isCombineCap` 和 `netPositionConstraint` 是两个独立概念**：`isCombineCap` = position cap 是否跨 supply+borrow 共享（同一 token 同一侧的 cap 语义）；`netPositionConstraint` = Merkl scoring 是否跨 reserve 做 net 计算（不同 token 之间的 scoring 规则）。两者可共存（如 Celo USDT Merkl supply 同时有 `positionCapNative` 和 `netPositionConstraint`），互不影响。
- **Merkl `isCombineCap = false` 是语义推导，不是硬编码**：Merkl scoring 按 side 独立——supply 和 borrow 各有自己的 scoring balance。`maxDeposit` 限制的是**单侧** scoring balance，不是 net position cap，也不是 combine cap。因此 `isCombineCap = false` 是从 Merkl scoring 语义推导出来的正确值。`computeMethod = "maxDeposit"` 是有 position cap 的充分必要条件。
- **Brevis `isCombineCap` 从描述文案推断**：描述文案含 "combined total of up to $X in collateral and/or debt" → `isCombineCap = true`。如果未来有非 combined 的 Brevis campaign，需要从描述中用正则提取。当前硬编码 `true` 是因为 Brevis 目前只有 MetaMask Card campaign。
- **旧文档中 "Merkl maxDeposit 是 net position cap" 的描述有误**：已修正为 "per-side per-user balance cap"。`netPositionConstraint` 是独立字段，不是 maxDeposit 的语义。

## `decimals ?? 18` 统一入口 (AAV-1075/1076)
- **后端 `/markets` API 对 66% 的 reserve 不返回 `decimals`**：当 `decimals = 18`（默认值）时省略，前端必须 fallback。
- **`DEFAULT_TOKEN_DECIMALS` 必须统一入口**：提取到 `src/lib/tokenDefaults.ts`，所有使用 `decimals ?? 18` 的地方统一 import。避免某天改默认值时遗漏一处导致 native→USD 换算错误。
- **`resolvePositionCapUsd` 之前在 `decimals = undefined` 时不换算——这是 bug**：Merkl 的 `positionCapNative` 需要 decimals 换算，但 reserve 没有 decimals 时直接跳过换算、回退到 `positionCapUsd`（Merkl 不提供），导致 position cap 静默不生效。修复：`resolvePositionCapUsd` 在 `decimals` 缺失时使用 `DEFAULT_TOKEN_DECIMALS`（18）。
- **涉及文件**：`tokenDefaults.ts`（常量定义）、`incentiveCaps.ts`、`scenarioSize.ts`、`deficit.ts`、`rateSimulationCalculator.ts`、`userPositionMapper.ts`。

## Portfolio 模式 crossReservePositions 数据源错配 (AAV-1086)
- **两条路径的数据源必须一致**：`ReservesTable.tsx` 构建 `crossReservePositions` 用的是 shared scenario inputs（Portfolio 模式下为空），而 `portfolioSimulator.ts` 用的是 portfolio entries 的 total position（wallet + delta）。两条路径对同一份数据用了不同数据源，导致一条路径永远为 undefined。**教训：当同一条数据在两个消费者之间共享时，必须确保两者使用相同的数据源和构建逻辑，而非各自从不同输入推导。**
- **死代码暗示设计缺陷**：旧代码 `if (!isPortfolioMode) return undefined;` 后面的 for 循环在两种模式下都不可达（Portfolio 被 shared inputs 为空拦截，Shared 被 early return 拦截）。这段从未执行的代码是"先写通用逻辑再分支"的遗留，但分支条件使得通用逻辑永远不会执行。**教训：当 if/else 两个分支都让后续代码不可达时，应该怀疑分支逻辑是否正确——可能其中一个分支的条件写反了。**
- **useMemo 顺序依赖必须显式**：`perReserveInputs` 在 `crossReservePositions` 之后定义但被其依赖。React hooks 按定义顺序执行，如果 `crossReservePositions` 引用了尚未定义的 `perReserveInputs`，会得到 `undefined`。虽然 `useMemo` 是惰性求值不会立即崩溃，但依赖项缺失会导致 stale closure。**教训：当 useMemo A 依赖 useMemo B 的结果时，B 必须定义在 A 之前。**
- **单一数据源优于各自计算**：初始修复提取了 `buildCrossReservePositionsFromPerReserveInputs` 纯函数从 `perReserveInputs` 推导，但 `portfolioSimulator:169` 有独立的构建逻辑。grill 后发现两条路径"巧合一致"而非"强制一致"——未来维护者可能只改一处忘改另一处。最终方案：让 `buildPerReserveInputsFromEntries` 同时返回 `crossReservePositions` + `reserveSymbolById`（`PortfolioInputsResult`），单一计算源保证一致性，删除了 3 个 useMemo + 1 个函数 + 7 个测试。**教训：当两个消费者需要同一条派生数据时，让数据生产者一次构建、多次消费，而非各自独立推导。**

## afterNative 单位一致性 + Unified Mode 生产默认
- **`afterNative` 必须始终使用 APY，不能随 `isApy` 切换到 APR**：`rateSimulationCalculator.ts` 中 `supplyAfterNative`/`borrowAfterNative` 原先在 `isApy=false` 时使用 `supplyAprPercent`/`borrowAprPercent`，而 `currentNative` 始终来自 `reserve.supplyApy`（APY）。两者做差产生虚假 delta（APY current vs APR after），这个 delta 不是用户输入造成的，而是单位转换差。AprApyToggle 的 tooltip 明确说 "Only incentive annual % follows this switch; native stays APY"，但代码没有遵守。**教训：当 toggle 声称某个字段不受切换影响时，必须验证该字段在所有代码路径中确实不受影响——calculator 层的 `isApy` 分支可能悄悄违反这个合约。**
- **`scenarioUsdAccrual` 正确使用 APR 做日收益计算**：`buildSupplyUsdAccrualSide` 使用 `combinedNativeSimulation?.supplyAprPercent`（APR）做 per-second compounding 日收益，这是正确的——线性日收益需要 APR 而非 APY。修复 `afterNative` 不影响此路径，因为 USD accrual 直接从 `combinedNativeSimulation` 取 APR，不经过 `afterNative`。
- **Unified Table 从 opt-in (`?unified=1`) 改为默认 (`?unified=0` opt-out)**：生产环境用户不再需要手动加 URL 参数。Legacy 布局（PortfolioTokenRow + PortfolioResultsTable + PortfolioSummaryCard）仍可通过 `?unified=0` 访问，用于调试和对比。**教训：feature flag 从 opt-in 转 opt-out 时，所有测试 legacy 布局的测试用例需要显式加 opt-out 参数，否则会在新默认路径下失败。**
- **Native `title` 属性不可作为唯一信息载体**：浏览器原生 `title` tooltip 需要 hover 停留 1-2 秒，移动端完全不工作，且无视觉提示。必须用 Radix Tooltip 组件替代（dotted underline 作为视觉 affordance + hover/tap 触发）。**教训：任何对用户决策有影响的信息都不能仅依赖 native `title`——它对移动端用户完全不可见。**

## Merkl position cap native token 显示 (AAV-1097/1098/1099)
- **显示层改 native、计算层保持 USD 是正确分层**：`resolvePositionCapUsd` 仍将 `positionCapNative` 转为 USD 用于 dilution 公式（`aprPercent × min(positionUsd, capUsd) / positionUsd`），只有 note 文案和 tooltip 渲染改为 native token amount。计算需要统一货币单位，显示需要语义稳定的原始量——两层职责分离。
- **dispatch 调用新增参数时必须同步所有调用点**：`SideSourceContext` 接口已定义 `tokenSymbol`，context 构建也赋了值 `tokenSymbol: reserve.tokenSymbol`，但 dispatch 调用 `buildMerklCampaignDetails(...)` 漏传了 `ctx.tokenSymbol`。这是 AAV-980 的重复——签名迁移时只改了接口和 context 构建，忘了改 dispatch 调用。**教训：新增 context 字段后，必须检查 `sourceDispatch` 中所有 `buildDetails`/`sumCurrent`/`sumAfter` 调用是否都传了新字段。**
- **两条渲染路径数据源不同**：`IncentiveTooltip.tsx` 直接从 `breakdown.positionCapNative` + `reserve.tokenSymbol` 取值（不经过 calculator），而 `SimulationSubRow` 和 `PortfolioUnifiedTable` WarningMarker 通过 `SimulationCampaignDetail.notes` ← `buildMerklCampaignDetails` 取值。修改 calculator 层的 native 参数传递只影响后者，前者需单独修改。**教训：当同一数据在两条路径中消费时，修改一条路径的参数传递不会自动修复另一条——必须逐路径验证。**
- **BigInt 解析逻辑在 `incentiveCaps.ts` 中重复 3 处**：`convertPositionCapNativeToUsd`、`formatNativeTokenAmount`（新增私有函数）、`formatPositionCapNativeDisplay`（新增公开导出）三处都有相同的 `BigInt(positionCapNative) → divisor → wholePart → fracPart → Number` 模式。`formatNativeTokenAmount` 已被后两者共享，但 `convertPositionCapNativeToUsd` 仍有独立实现（因其需乘 tokenPrice）。可进一步抽取 `parseNativeTokenAmount(raw: string, decimals: number): number | null` 作为单一解析入口。
- **`buildMerklCampaignDetails` 参数膨胀至 21 个**：本 session 新增 `tokenSymbol`、`walletEligibilityRatio`、`walletMerklGroupMultiplier` 三个参数。位置参数模式在 21 个参数下极易出错（AAV-980 和 AAV-1075 的参数错位 bug 已证明）。应迁移到 options 对象模式，但属于独立重构任务。

## Portfolio 模式必须统一使用 allReserves（过滤 bug）
- **Portfolio 模式下所有数据计算必须用 `allReserves` 而非 filtered `reserves`**：`ReservesTable.tsx` 接收两个 list——`reserves`（经 token/market 过滤后的列表）和 `allReserves`（全量列表）。Portfolio entries 可以引用任何 reserve，不受当前过滤条件限制。`usePortfolioToggle`（L845）和 `PortfolioPanel`（L910/954）已正确使用 `allReserves`，但 `buildPerReserveInputsFromEntries`、`useSharedRateSimulations`、`portfolioCapWarningsMap` 三处遗漏，仍用 filtered `reserves`，导致过滤后部分 portfolio entries 的 simulation 结果和 cap warnings 消失。**教训：Portfolio 模式下的所有计算路径（inputs 构建、rate simulation、cap warnings）都必须使用 `allReserves`，与已建立的 `usePortfolioToggle` 模式保持一致。**
- **不需要中间变量来表达"portfolio 用 allReserves"**：初始修复引入了 `portfolioReservesSource = isPortfolioMode ? allReserves : reserves` 变量，但 `buildPerReserveInputsFromEntries` 已被 `isPortfolioMode` 守卫，可直接用 `allReserves`；只有 `useSharedRateSimulations`（single 和 portfolio 共用）需要内联三元 `isPortfolioMode ? allReserves : reserves`。**教训：当消费点已被模式守卫时，直接用目标值，不引入中间变量——与同文件中 `usePortfolioToggle` 直接传 `allReserves` 的模式一致。**

## 极端 APR 显示、reward token icon 优先级、opp-level message 位置
- **`smartPercent` 必须有上限 cap**：短期高 APR incident（如 Merkl TVL 极低时）可产生 `321032686389358.88M%` 这样荒谬的显示。`>= 1M` 分支原来只做 `/1_000_000 + M%` 无上限。修复：`PERCENT_M_CAP = 999.99`，超过显示 `>999.99M%`/`<-999.99M%`；`Infinity`/`-Infinity` 返回 `-`。**教训：格式化函数必须有上限截断 + 非有限值守卫，不能假设业务层数据总在合理范围。**
- **reward token icon 应优先用 source 提供的 URL 而非本地 manifest**：Merkl 返回 `rewardTokenIconUrl`（如 `aCelUSDT.jpeg`）是链感知的 icon，与 Merkl 官网一致；本地 manifest 的 `ausdt.png` 是通用 aToken icon，视觉不同。`resolveRewardTokenIconSrc` 改为 `preferredUrl` 优先、本地 manifest 兜底。Merit/Brevis 不提供 `rewardTokenIconUrl`，不受影响。**教训：当 source 提供了"官方" icon URL 时，用它比本地映射更准确；本地 manifest 的角色应从"优先"降为"fallback"。参数名应反映实际语义（`preferredUrl` 而非 `fallbackUrl`）。**
- **多 campaign 时 opp-level message 放在底部会被误认为最后一个 campaign 的附属信息**：视觉上用户无法区分"这是 source 级共享信息"还是"这是最后一个 campaign 的说明"。修复：多 campaign 时将 `sourceMessageLines` 渲染移到 source header 和 campaign rows 之间。单 campaign 不变（message 仍在 campaign content 内，跟在 time 行后面）。**教训：UI 元素的视觉位置必须传达其语义层级——source 级信息应在 source 级区域，不能"寄生"在子级区域的末尾。**

## walletBorrowUsd/walletSupplyUsd 推导必须使用 raw (uncapped) input (AAV-1120)
- **capped input 导致 wallet 仓位推导偏大**：`buildRateSimulationResult` 中 `walletBorrowUsd = totalBorrowUsd - borrowInputUsd`，但 `borrowInputUsd` 在超过 `availableBorrowRoomUsd` 时被 cap 减小。例如 wallet=$8000 + delta=$2000 = total=$10000，borrowCap=$1000 → `borrowInputUsd=$1000`（capped），`walletBorrowUsd=$10000-$1000=$9000` ❌（应为 $8000）。这导致 Portfolio 模式下 eligibility ratio 和 `currentIncentive` 产生 ~0.008% 微误差。supply 侧同样存在此问题。
- **修复：用 `rawBorrowInputUsd`/`rawSupplyInputUsd` 代替 capped 值**：`walletBorrowUsd = totalBorrowUsd - rawBorrowInputUsd`，因为 `totalBorrowUsd = wallet + rawDelta`，所以 `wallet = total - rawDelta`。capped 值仅用于利率模拟（你不能借超过 cap 的量），但 wallet 推导必须用未截断的原始输入。
- **TDD 验证方式**：设置两个 Portfolio 场景（同一 wallet，一个 delta 在 cap 内、一个超出 cap），验证 `currentIncentive` 完全相同。Bug 存在时差异 = 10% × (0.444 - 0.375) ≈ 0.69%，远超浮点误差容限。
- **真实数据验证**：新增 `rateSimulationCalculator.live.test.ts`，对 staging API 所有有 incentive 的 reserve 验证 Golden Rules（currentIncentive = per-source sum、current* 不变性、AAV-1120 cap 不变性）。通过 `npm run test:live:simulation:staging` 运行。

## 移除 wallet 倒推 fallback，改为显式传参 (AAV-1140)
- **倒推计算是结构性风险**：AAV-1120 修复了 capped input 导致的微误差，但倒推逻辑本身（`wallet = total - rawInput`）仍然脆弱——任何 `totalSupplyUsd` 或 `rawInputUsd` 的计算变更都可能引入新的偏差。根本问题是：caller (`buildPerReserveInputsFromEntries`) 已经有 `walletValue` 的显式值，但在构建 `PerReserveInput` 时丢弃了它，只传 `totalSupplyUsd`（wallet + delta），让 calculator 倒推。
- **修复：显式传参消除倒推**：在 `PerReserveInput` 新增 `walletSupplyUsd?`/`walletBorrowUsd?` 字段，`buildPerReserveInputsFromEntries` 和 `buildGroupMapFromSlots` 在遍历 entries 时累加 `s.walletValue`（仅当 `walletValue !== null && walletValue > 0`），初始值 `undefined`（不是 `0`，以区分"无钱包"和"钱包为零"）。Calculator 直接使用 `explicitWalletSupplyUsd`/`explicitWalletBorrowUsd`，删除所有倒推代码。
- **测试影响范围**：~25 个单元测试和 5 个 live API 测试原先依赖 fallback（传 `totalSupplyUsd` 不传 `walletSupplyUsd`），需要逐个添加显式 wallet 值。部分测试"碰巧通过"（wallet=undefined → 无 dilution → current=10，与期望值相同），但语义错误——测试注释说"wallet=$5000"但实际无 wallet。修复时一并更新这些测试。
- **Spec 文档**：`docs/specs/wallet-position-explicit-passing.md`
- **涉及文件**：`portfolioSimulator.ts`（PerReserveInput + EntryGroup + buildPerReserveInputsFromEntries + buildGroupMapFromSlots + computeResultsFromGroups）、`useRateSimulation.ts`、`rateSimulationCalculator.ts`、3 个测试文件。

## APR→APY 转换顺序不可交换 (AAV-1177)
- **`convertAprToApy` 是非线性函数**：月复利公式 `(1 + r/12)^12 - 1` 导致 `convertAprToApy(apr * ratio) ≠ convertAprToApy(apr) * ratio`（ratio ≠ 1 时）。Campaign detail 行原先先转 APY 再缩放，聚合路径先缩放再转 APY，两者不一致。典型影响：100% APR × 50% eligibility → 先缩后转 ≈ 64.9%，先转后缩 ≈ 85.9%。
- **统一入口 `scaleAprThenConvert(apr, { ratio, isApy })`**：在 `rateCalculations.ts` 新增，强制"先缩放 APR，再按需转 APY"顺序。所有 campaign detail 行（Merit current/after、Merkl current/after）统一调用此函数，与聚合路径对齐。
- **`applyPositionCapToForecastResult` 必须接收 APR 输入**：参数名 `nominalAprPercent` 已暗示期望 APR，但 Merit/ Merkl campaign detail 原先传入 APY 值。修复：全程在 APR 空间操作（缩放 + cap），最后一步才转 APY。
- **实际影响**：Aave 常见 5-20% APR 区间误差 <1pp，但数学不一致必须修复。新增 3 个 reconciliation 回归测试确保 campaign detail 与聚合路径一致。
- **Codex Review 来源**：https://github.com/0xPabloLI/aaveapy/pull/431#pullrequestreview-4710563403
