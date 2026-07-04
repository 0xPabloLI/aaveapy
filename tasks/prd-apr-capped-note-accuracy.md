# PRD: APR Capped Note 仅在 Cap 实际压低 After APR 时显示

## 需求背景

当前 Merkl/Brevis incentive campaign 的 "APR capped for low TVL" note 判定逻辑基于 `forecastWithTVL` 返回的 `regime === 'APR_CAPPED'`。只要池子 TVL 低导致 `aprBasedDaily < requiredDaily`，regime 就是 `APR_CAPPED`，即使用户的 simulation 输入并未被 cap 实际影响，note 也会显示。

在 Monad GHO 等低 TVL 池子上，用户一输入 simulation 值就会看到 "APR capped for low TVL" amber 警告，但 after APR 可能与 uncapped 值无差异或差异极小，造成误导。

## 目标与价值

**目标：**
- "APR capped for low TVL" note 仅在 cap 实际压低了 after APR 时才显示
- 无实质 cap 效果时不显示误导性警告

**价值：**
- 减少用户困惑：不显示无实际影响的警告
- 提高 note 信号/噪声比

## 适用范围

- 适用：`MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 和 `TARGET_TOTAL_APR` + `MAX_APR` 两种 campaign 类型
- 适用：Reserve Table SimulationSubRow、Portfolio Panel 中的 cap note
- 不适用：`FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 的 pool_budget note（逻辑不同，不受影响）
- 不适用：position_cap note（逻辑不同，不受影响）

## 非目标

- 不改变 note 文案（保持 "APR capped for low TVL"）
- 不区分 MAX_REWARD 和 TARGET_TOTAL_APR 的 note 文案
- 不改变 `forecastWithTVL` 的 regime 判定逻辑

## 功能需求

- FR-1: `rateSimulationCalculator.ts` 中 MAX_REWARD / TARGET_TOTAL_APR + MAX_APR 的 note 生成逻辑，增加 `cappedAfter < uncappedAfter` 判定条件。仅当 cap 实际压低了 after APR 值时，才生成 `apr_cap` note
- FR-2: uncappedAfter 的计算方式：对 `forecastWithTVL` 传入相同 hypotheticalTvl，但将 `aprCap` 设为 `Infinity`（或等效方式），使得 `aprBasedDaily` 不被 cap 限制，计算出的 APR 即为 uncapped after
- FR-3: 当 `cappedAfter >= uncappedAfter` 时（cap 未压低值），不生成 note
- FR-4: 当 `cappedAfter < uncappedAfter` 时（cap 实际压低了值），生成 "APR capped for low TVL" note
- FR-5: `merklForecast.ts` 新增导出函数 `forecastWithTVLUncapped`，或为 `forecastWithTVL` 增加 `ignoreCap?: boolean` 参数，用于计算 uncapped APR

## 关键流程/交互说明

**当前流程：**
1. 用户输入 simulation 值 → `inputUsd > 0`
2. 计算 `hypotheticalTvl = latestTvl + inputUsd`
3. 调用 `forecastWithTVL(merged, hypotheticalTvl)`
4. 若 `regime === 'APR_CAPPED'` → 显示 note

**新流程：**
1. 用户输入 simulation 值 → `inputUsd > 0`
2. 计算 `hypotheticalTvl = latestTvl + inputUsd`
3. 调用 `forecastWithTVL(merged, hypotheticalTvl)` → 得到 `cappedResult`
4. 调用 `forecastWithTVL(merged, hypotheticalTvl, { ignoreCap: true })` → 得到 `uncappedResult`
5. 若 `cappedResult.regime === 'APR_CAPPED'` **且** `cappedResult.apr < uncappedResult.apr` → 显示 note
6. 否则 → 不显示 note

## 风险与依赖

**风险：**
- `forecastWithTVL` 增加 `ignoreCap` 参数需确保不影响现有调用方（新参数默认 `false`，向后兼容）
- uncapped 计算增加一次 `forecastWithTVL` 调用，但仅在 `regime === 'APR_CAPPED'` 路径触发，性能影响可忽略

**依赖：**
- `merklForecast.ts` 中 `forecastWithTVL` 函数需支持 uncapped 模式

## 验收标准

- [ ] 低 TVL 池子 + MAX_REWARD campaign：simulation 输入后，若 cap 未实际压低 after APR，不显示 "APR capped for low TVL" note
- [ ] 低 TVL 池子 + MAX_REWARD campaign：simulation 输入后，若 cap 实际压低了 after APR，显示 note
- [ ] TARGET_TOTAL_APR + MAX_APR campaign 同上两条
- [ ] `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` 的 pool_budget note 不受影响
- [ ] position_cap note 不受影响
- [ ] 现有 `forecastWithTVL` 测试全部通过
- [ ] 新增 uncapped 模式的单元测试
- [ ] `npm run lint && npm test && npm run build && npx tsc --noEmit` 全部通过

## 待确认问题

- 无
