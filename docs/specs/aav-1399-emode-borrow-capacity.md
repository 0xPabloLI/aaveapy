# AAV-1399 — Borrow capacity 按用户 eMode 类别取 LTV/LT

> Status: implementing 2026-11-17 · Issue: [AAV-1399](https://linear.app/aaveapy/issue/AAV-1399) · 前置: AAV-1394（后端 `/api/meta/e-mode`，已 Done）· Type: 计算正确性（非新增功能）

## 背景与根因

Portfolio 模拟的借力链只有一处 LTV 来源：`/api/markets` 的 reserve `ltv`。它是 **base LTV**（Aave 协议对普通模式的参数），不含用户 eMode 类别。

对 ETH correlated eMode 用户，Aave V3 Ethereum 的 WETH：

- base：`ltv 81` / `liquidationThreshold 84`
- eMode category 1（ETH correlated）：`maxLtv 93` / `liquidationThreshold 95`

于是前端把 100k WETH 抵押的借力钳到 81k，而链上真实能力是 93k；`PortfolioSummaryBar` 的 `Borrow capacity`、`computeLtvClamping` 的 `ltv_cap` 警告、以及 `computeHealthFactors` 的抵押贡献全部偏低。AAV-1394 已把 eMode 类别数据做成独立端点，本票只做前端接入。

## 设计

### 数据来源（两条）

1. **用户 eMode 类别**：链上 `Pool.getUserEMode(address) → uint256`。按 portfolio entries 命中的 V3 pool 分链批量 multicall（`allowFailure: true`），失败/轮换耗尽 → 该池视为「未知」，回退 base LTV，不 throw。
2. **类别参数**：`GET /api/meta/e-mode/{marketKey}`（AAV-1394），`marketKey = ${chainId}:${poolAddress.toLowerCase()}`；`marketKey` 由 `/markets` 的 `reserveId` 前两段推导（V4 reserveId 有四段，直接跳过）。按 `getUserEMode` 返回的 category id 在 `categories[]` 中匹配；取 `maxLtv` / `liquidationThreshold` / `collateralReserves`。

只对 `categoryId > 0` 的池发 API 请求；category 0（无 eMode）零新增请求、零行为变化。

### 生效规则

对每个 pool（`${chainId}:${marketName}`，协议隔离边界）：

- 无 override（category 0 / 未知 / 数据不可用）→ 沿用 `reserve.ltv` / `reserve.liquidationThreshold`。
- 有 override 且 reserve token 在 `collateralReserves` 中（地址大小写不敏感）→ 用类别 `maxLtv` / `liquidationThreshold`。
- 有 override 但不在成员数组 → **LTV / LT 都为 0**（该类别下不可抵押）。这是票面语义，也防止算出链上不存在的更高额度。

生效点只有两处：

- `computeLtvClamping`：`collateralContribution = group.supplyUsd × effectiveLtv / 100`。
- `computeHealthFactors`：`totalCollateralUsd += result.amountUsd × effectiveLT / 100`；`totalBorrowCapacityUsd += result.amountUsd × effectiveLtv / 100`。

`buildPerReserveInputsFromEntries` / `crossReservePositions` **不动**（AAV-1396 的口径分裂是独立票，本票不顺手改）。

### 降级与提示

- 任何类别数据失败（400 / 404 / 503 / 网络 / payload 缺该 category id）→ 该 pool 回退 base LTV/LT，并标记 `eModeFallback`。
- `PortfolioHealthFactor` 增可选 `eModeFallback?: boolean`；`PortfolioSummaryBar` 的 Borrow capacity 区渲染一行 muted 提示 `eMode data refreshing — using base LTV`（`data-testid="emode-fallback-notice"`、`role="status"`）。
- `getUserEMode` 读失败意味着「不知道用户是否 eMode」，保守回退 base，不发提示（无法区分 category 0，提示会变成噪音）。
- 降级永不抬高额度：未知一律走 base；base 本身也可能为 0（AAV-1380 协议真值）。

### owner 决策（暂定）

2026-11-17 发起确认，owner 未在等待窗口内回复；按推荐暂定，交付记录会写明可在 Linear 评论否决：

1. **eMode LT 同时用于模拟 HF**（不只借力）——避免「借力按 93%、HF 按 base 84%」的混合口径。
2. **类别外供应资产 LTV/LT = 0**——票面已写「不在数组里 = 该类别下不可抵押」。
3. **503 回退 base + 区块内提示**（不阻塞模拟）。

## User Stories

1. 作为 ETH correlated eMode 用户，我希望 100k WETH 抵押显示 93k 借力，而不是 81k，这样我能按真实能力规划借款。
2. 作为 eMode 用户，我希望 `Borrow capacity` 的剩余额度 = 类别 LTV 算出的额度 − 当前债务，而不是 base LTV 的额度。
3. 作为 eMode 用户，我希望 `ltv_cap` 警告只在超过 93k 时出现，而不是超过 81k 就误报。
4. 作为 eMode 用户，我希望 Health Factor 的抵押贡献用类别 `liquidationThreshold`（95），与链上真实清算线一致。
5. 作为 eMode 用户，我希望不在 `collateralReserves` 里的供应资产不被当作抵押品，避免看到链上不会发生的借力。
6. 作为普通（category 0）用户，我希望所有数字与今天完全一致，不因为 eMode 支持而漂移。
7. 作为 V4 用户，我希望 V4 仓位（没有 eMode 类别）不受影响。
8. 作为 watch-only 用户，我希望监视地址的 eMode 也生效，不需要连接钱包。
9. 作为用户，我希望 eMode 类别数据 503 时应用回退到 base 并明确提示「数据刷新中」，而不是悄悄少给额度。
10. 作为用户，我希望某个链的 eMode 读取失败不会影响其他链，也不会阻塞整个组合模拟。
11. 作为用户，我希望 404 / 400 / 未知 category id 都走同一套安全回退，绝不算出比真实更高的额度。
12. 作为用户在移动端，我希望这条降级提示不破版、不加独占行、不依赖 hover。
13. 作为刷新按钮用户，我希望点刷新后 eMode 类别数据与 HF 基线一起重取，而不是缓存 5 分钟不动。
14. 作为开发者，我希望 eMode 解析是纯函数，能被单测直接锚定，不需要渲染整棵组件树。
15. 作为 reviewer，我希望 eMode 数据不可用时 UI 有唯一可断言的信号（`eModeFallback` + `data-testid`），而不是靠日志猜。

## 接口契约

```ts
// src/lib/userData/eMode.ts
interface EModeCategoryParams {
  categoryId: number;
  label: string;
  maxLtv: number;                 // percent, e.g. 93
  liquidationThreshold: number;   // percent, e.g. 95
  collateralReserves: ReadonlySet<string>; // lowercase token addresses
}
type EModeParamsByPool = ReadonlyMap<string, EModeCategoryParams>; // `${chainId}:${marketName}`

interface EModeOverrides {
  params: EModeParamsByPool;
  fallbackPools: ReadonlySet<string>; // poolKey with known eMode但类别数据不可用
}

interface V3EModeTarget {
  chainId: number;
  poolKey: string;    // `${chainId}:${marketName}`
  marketKey: string;  // `${chainId}:${poolAddress.toLowerCase()}`
  poolAddress: `0x${string}`;
}

function extractV3EModeTargets(entries, reserves): V3EModeTarget[];
function buildEModeOverrides(targets, categoryIds, categoriesByMarketKey, failedMarketKeys): {
  overrides: EModeOverrides;
};
function effectiveLtv(reserve, params?): number;
function effectiveLiquidationThreshold(reserve, params?): number;
```

```ts
// src/lib/userData/onchainEMode.ts
function fetchOnchainEModeCategoryIds(
  address: `0x${string}`,
  targets: readonly V3EModeTarget[],
): Promise<Map<string, number>>; // poolKey → categoryId；失败池缺省
```

```ts
// src/hooks/useEModeOverrides.ts
useEModeOverrides({ address, entries, reserves }): {
  eModeOverrides?: EModeOverrides; // category 0 / 无 wallet / 无 targets → undefined
  isLoading: boolean;
};
```

```ts
// src/lib/portfolioSimulator.ts
simulatePortfolioFromEntries(args & { eModeOverrides?: EModeOverrides })
```

```ts
// src/types/portfolio.ts
interface PortfolioHealthFactor {
  // ...既有字段
  eModeFallback?: boolean; // 该 pool 的 eMode 类别已知但数据不可用，额度按 base 计算
}
```

**不变量**：

- category 0 / 无 override 时，`effectiveLtv === reserve.ltv ?? 0`、`effectiveLT === reserve.liquidationThreshold ?? 0`。
- `eModeOverrides` 缺省时，`simulatePortfolioFromEntries` 的所有输出与今天逐字段相等。
- 降级路径的额度 ≤ base 路径（无 override 时）或 = base；绝不更高。
- 不新增 `WalletLoadState` 取值；不改 `DegradedResult`；不改 rate calculator。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/lib/userData/aaveV3UserClient.ts` | `POOL_ABI` 增加 `getUserEMode` | Low | 纯追加 ABI 条目；现有 `getUserAccountData` 调用按位置取结果不受影响 |
| `src/lib/userData/eMode.ts`（新） | 目标提取、类别匹配、effective LTV/LT 纯函数 | Low | 纯新建；无既有消费者 |
| `src/lib/userData/onchainEMode.ts`（新） | 分链 multicall `getUserEMode` | Low | 纯新建；复用 `createClientWithRpcRotation` / `MULTICALL3_ADDRESS` |
| `src/hooks/useEModeOverrides.ts`（新） | onchain 类别 + API 类别合成，React Query + refetch 订阅 | Low | 纯新建；disabled 条件与 HF hook 同形 |
| `src/lib/apiSchemas.ts` | 导出 `EModeMarketPayloadSchema`（generated strip） | Low | 纯追加导出 |
| `src/lib/portfolioSimulator.ts` | 可选 `eModeOverrides` 进入 `computeLtvClamping` / `computeHealthFactors` | High | 核心模拟路径；缺省路径必须逐字段不变，矩阵 E5/E22 锚定 |
| `src/types/portfolio.ts` | `PortfolioHealthFactor` 增 `eModeFallback?` | Low | 可选字段；现有构造方无需改 |
| `src/types/portfolio.ts`（simulator args 若在同文件） | `SimulatePortfolioEntriesArgs` 增可选字段 | Low | 可选参数 |
| `src/hooks/reserves-table/usePortfolioToggle.ts` | 透传 `eModeOverrides` 到 simulator | Low | 纯转发；加入 useMemo deps |
| `src/components/dashboard/ReservesTable.tsx` | 新增可选 prop 并透传 | Low | 纯转发 |
| `src/pages/Index.tsx` | 调 hook、透传 | Low | 与 `onchainHfMap` 同链路 |
| `src/components/dashboard/PortfolioSummaryBar.tsx` | 降级提示一行 | Low | 条件渲染；复用既有 token |
| `docs/specs/aav-1399-emode-borrow-capacity.md`, `docs/DOCS-INDEX.md`, `docs/issue-roadmap.md` | spec 与状态 | Low | 文档 |

**风险判定依据**：

1. 是否影响现有功能？— 所有新参数可选；缺省路径不进入任何新分支。
2. 下游消费者？— `simulatePortfolioFromEntries` 的调用点只有 `usePortfolioToggle`（测试另有直调）；HF 结果消费方 `PortfolioSummaryBar` / 移动卡片只多读一个可选字段。
3. 最坏后果？— eMode 参数匹配错误会把额度算高（违反「不产生错误更高额度」）。缓解：成员地址大小写归一、类别 id 严格匹配、任何不确定走 base、矩阵 E3/E9/E10/E11 覆盖。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| E1 | category 0（无 eMode） | LTV/LT 与今天逐字段一致；不发 API 请求；无提示 | High | `eMode.test.ts` P1；`useEModeOverrides.test.tsx` H1 | `categoryId > 0` 才构造 override |
| E2 | category 1（ETH correlated）+ WETH 在 `collateralReserves` | 100k WETH 供应 → 借力 93k；`totalBorrowCapacityUsd = 93_000`；LT 95 | High | `portfolioSimulator.test.ts` S1/S2；live staging 类别数据 | 成员命中取类别值 |
| E3 | category 1 + USDC 不在 `collateralReserves` | USDC 供应贡献 0 抵押；不产生借力 | High | `eMode.test.ts` P2；`portfolioSimulator.test.ts` S3 | 非成员 → 0 |
| E4 | 有 override 且 base `ltv = 0`（AAV-1380 冻结/非抵押） | 仍按类别值（成员时 93；非成员 0） | Medium | `portfolioSimulator.test.ts` S4 | override 优先于 base |
| E5 | `eModeOverrides` = undefined | 输出与改动前逐字段相等 | High | 既有 `portfolioSimulator.test.ts` 全量（不改断言） | 参数可选、分支短路 |
| E6 | `/meta/e-mode/{key}` 503 | base LTV/LT + `eModeFallback = true`；SummaryBar 提示 | High | `useEModeOverrides.test.tsx` H2；`PortfolioSummaryBar.test.tsx` B1 | 所有错误走同一 fallback |
| E7 | 404（market not found） | 同 E6 | Medium | H3 | 同上 |
| E8 | 400（malformed marketKey） | 同 E6 | Medium | H3b | 同上 |
| E9 | 网络错误 / 非 JSON | 同 E6 | Medium | H4 | 同上 |
| E10 | payload 成功但缺该 category id | 同 E6 | High | H5 | 匹配不到即 fallback |
| E11 | 单池 `getUserEMode` 失败（其他池成功） | 失败池 base、无提示；成功池正常生效 | High | `onchainEMode.test.ts` O2；hook H6 | 按池隔离；失败不 throw |
| E12 | RPC 轮换耗尽（整链） | 返回空 map；console error；不 throw | Medium | `onchainEMode.test.ts` O3 | 与 HF hook 同策略 |
| E13 | 未连接 / 无 address | hook disabled；`eModeOverrides = undefined` | Medium | H7 | `enabled: !!address` |
| E14 | 无 portfolio entries | 无 targets、无请求 | Medium | `eMode.test.ts` P3 | entries 过滤 hidden/orphan |
| E15 | V4 reserve（四段 reserveId） | 跳过，不进 targets | High | P4 | `getProtocolVersion` + 段数 |
| E16 | 畸形 reserveId / 缺 tokenAddress | 跳过或保守 0；不崩溃 | Medium | P5 | parse 失败即跳过；tokenAddress 缺失 → 非成员 |
| E17 | 同池多个 reserve | 只读一次 `getUserEMode`、只请求一次类别 | Medium | P6 + O4 | 按 poolKey/marketKey 去重 |
| E18 | 多池且其中一个降级 | 降级只影响该池；其他池 eMode 生效 | High | H8 | `fallbackPools` 按 poolKey |
| E19 | 点击刷新 / Watch 重进 | eMode 查询失效重取 | Medium | H9（invalidate spy） | `subscribeRefetch` |
| E20 | 地址大小写（checksummed vs lowercase） | 成员匹配成功 | High | P7 | 统一 lowercase |
| E21 | eMode 下借入输入 > 类别额度 | 钳到 93k；HF 用 debt=93k | High | S2 | 复用既有 clamp 链 |
| E22 | 无 override 的 pool 与有 override 的 pool 同屏 | 前者数字不变 | High | S6 | 按 poolKey 查 override |
| E23 | 降级提示渲染 | 恰 1 条、`role="status"`、`data-testid`；无提示时 0 条 | Medium | B1/B2 | 条件 `some(eModeFallback)` |
| E24 | `ReservesTable` 透传 | prop 不被中间层丢弃 | High | `ReservesTable.test.tsx` 透传用例（删 prop 即红） | 与 `onchainHfMap` 同链路 |
| E25 | 移动端 390 / 平板 834 / 桌面 1440 | 提示不破版、无横向溢出、console 0 error | Medium | 运行时浏览器三视口 | 复用既有行与 token |
| E26 | 类别数据变化（eMode 切换）后重取 | 新 category id → 新 params；旧 override 不残留 | Medium | H9 + queryKey 含 targets hash | queryFn 每次重建 Map |

## Testing Decisions

**最高 seam**：`simulatePortfolioFromEntries`（纯函数）。eMode 的最终正确性（借力 93k、HF 95、非成员 0）全部在这里断言，不在组件层重复。

**模块级纯函数 seam**：`extractV3EModeTargets` / `buildEModeOverrides` / `effectiveLtv` / `effectiveLiquidationThreshold`。这是「reserveId → marketKey」和「category id → 参数」的唯一作者，测试直接锚定，避免 e2e 才发现 key 拼错。

**数据获取 seam**：`fetchOnchainEModeCategoryIds` 通过 `vi.mock('@/lib/userData/rpcResilience')` 注入 client（沿用 `useOnchainHealthFactor.test.ts` 先例）；`useEModeOverrides` 通过 mock `fetchWithTracing` + mock onchain 模块断言请求次数与降级路径。

**UI seam**：`PortfolioSummaryBar.test.tsx` 用 `data-testid` / `role` / 可见文案断言；`ReservesTable.test.tsx` 用子组件打桩断言 prop 透传（沿用 AAV-1315 的 M12 先例）。

**好测试的判据**：只断言外部行为（输出值、请求次数、DOM 信号），不断言内部 Map 结构或调用顺序；mutation 应能只打红对应行。

**既有先例**：`src/lib/portfolioSimulator.test.ts`（AAV-1250/1251 的 LTV/HF 矩阵）、`src/hooks/useOnchainHealthFactor.test.ts`（RPC rotation 降级）、`src/hooks/reserves-table/usePortfolioToggle.test.ts`、`src/components/dashboard/PortfolioSummaryBar.test.tsx`。

## Out of Scope

- **AAV-1396**：`buildPerReserveInputsFromEntries` / `crossReservePositions` 仍按原始 `borrowUsd`，incentive 与跨池抵消不与钳制结果统一。本票不修。
- eMode 的写入（`setUserEMode`）——应用只读。
- V4 eMode（协议无类别；端点 404）。
- 单行（Single simulation）的借力展示；本票只覆盖 Portfolio 模拟。
- `usageAsCollateralEnabled` 的逐资产真实状态：模拟沿用「supplied 即可抵押」的既有假设。
- 基于 eMode 类别的借款上限 `borrowableReserves` 过滤：类别数组只用于抵押侧。借款侧仍由现有 pool 逻辑决定。
- AAV-1380 的 base `ltv = 0` 语义不做改动。

## Further Notes

- `marketKey` 用 reserveId 前两段推导，与 AAV-1394 端点契约一致；注册表 `V3_POOL_ADDRESSES` 仅作为后备校验（不参与 key 生成）。
- 端点 16KB / 48 类别，只在用户 eMode category > 0 时按池请求；category 0 用户零开销。
- 失败标签不面向用户；UI 固定一句提示，具体 poolKey 只进 `console.info`（沿用 AAV-1393 的「内部标签不外露」原则）。
- 若 owner 对三条暂定决策有异议，改动集中在 `effectiveLtv` / `effectiveLiquidationThreshold`（LT 是否生效）、`collateralReserves` 非成员回退值与 `PortfolioSummaryBar` 提示；spec 矩阵对应行同步调整。
- viem `client.multicall` 对单返回值函数返回已解码的 `bigint`（不是 tuple）；`onchainEMode.ts` 同时接受标量与数组，O1 按真实标量形状回归。
- 运行时验证（2026-11-17，Anvil mainnet fork + staging `/meta/e-mode`）：eMode cat 1 下 100k WETH 供应 + 80k USDC 借款 → 剩余 13K（额度 93k）、HF 1.19；改为 100k 借款 → HF 1.02（债务钳到 93k）；category 0 → 81k 额度、HF 1.05；meta 503 → base 额度 + 提示；390/834/1440 三视口横向溢出 0、正常路径 console error 0。
