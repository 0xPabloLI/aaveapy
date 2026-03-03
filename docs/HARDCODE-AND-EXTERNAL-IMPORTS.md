# 硬编码与外部依赖清单（精简版）

**主要信息源**：官方 SDK（`@bgd-labs/aave-address-book`）+ 官方前端 [aave/interface](https://github.com/aave/interface)。

---

## 一、需自动更新 / 可同步自信息源的内容

### 1. chainId 与 chainName

- **当前代码**：没有静态的 chainId↔chainName map；池子数据来自 API，每条带 `chainId` 和 `chainName`，前端只用 `chainName` 展示和取图标。
- **若需要 map**：来源是 [aave/interface `networksConfig.ts`](https://github.com/aave/interface/blob/main/src/ui-config/networksConfig.ts)，仅用于 chainId → 链名（`name`）。

### 2. chainIconMap（链名 → 图标路径）

- **当前代码**：`src/lib/chainIconMap.ts` 作为单一来源，`chainIcons.ts` 与 `preloadUtils.ts` 共用这份映射。
- **更新源**：**aave/interface** 的 `networksConfig.ts`。他们没有字面量 "chainIconMap"，但有 `prodNetworkConfig` / `testnetConfig`：每链为 `ChainId → { name, networkLogoPath }`。可从 `name` 归一化得到我们用的 key，从 `networkLogoPath` 得到图标路径（如 `/icons/networks/arbitrum.svg`），新链会随官方一起更新。
- **建议**：定时 CI + drift check 兜底；新链图标从 interface `public/icons/networks/` 同步或从 `networkLogoPath` 拉取。

### 3. MARKET_NAME_MAP（API 市场名 → Aave 前端 marketName）

- **当前代码**：`src/lib/aaveLinks.ts` 中硬编码 API 返回的 market 名到 Aave 官网 URL 的 `marketName` 参数（如 `AaveV3Ethereum` → `proto_mainnet_v3`）。
- **更新源**：**aave/interface** 的 `marketsConfig.tsx`。内含 `CustomMarket` 枚举及 `marketsData`（market 标识 → chainId、addresses 等），与 address-book 的命名一致，可据此生成我们需要的 market 名 → `CustomMarket` 的映射。
- **建议**：随 aave/interface 或 address-book 更新时，重新生成 `MARKET_NAME_MAP`。

### 4. underlyingAssetMap（资产地址 → iconSymbol / name / symbol）

- **当前代码**：`src/ui-config/reservePatches.ts` 中大量 `underlyingAsset` 地址 → 展示用 `iconSymbol`、name、symbol；部分地址来自 `@bgd-labs/aave-address-book` 常量，其余为硬编码。
- **更新源**：**aave/interface** 的 [reservePatches.ts](https://github.com/aave/interface/blob/main/src/ui-config/reservePatches.ts)。他们也有同名文件与 **underlyingAssetMap**，结构一致（address → iconSymbol/name/symbol）。我们额外用了 `@bgd-labs/aave-address-book/tokenlist` 的 logoURI，需保留。
- **建议**：以 aave/interface 的 `reservePatches.ts` 的 underlyingAssetMap 为主源做同步（或定期拉取该文件），再保留本仓库的 tokenlist logoURI 与少量自有 patch。

### 5. Token 分类（STABLECOINS / ETH_RELATED / BTC_RELATED）、PENDLE_TOKENS

- **当前代码**：`src/types/aave.ts` 中 `STABLECOINS`、`ETH_RELATED`、`BTC_RELATED`、`PENDLE_TOKENS = ['PT-', 'YT-', 'SY-']`（三个前缀）。
- **来源**：本地约定；无通用 token 分类 API 被使用。CoinGecko 相关 endpoint 已在用：`useCoingeckoTokenImage` 用 CoinGecko 搜索；FDV 通过自有后端 `API_BASE/coingecko-fdv` 拉取。
- **建议**：保持本地列表；若未来 aave/interface 或 address-book 有公开的 token 分类再考虑同步。PENDLE 三前缀不变即可。

### 6. 其他硬编码（不纳入自动更新）

- **ETHEREUM_MARKET_NAMES**（`aave.ts`）：Ethereum 下各子市场展示名（Core / Prime / Horizon RWA / EtherFi）。可随 aave/interface 的 market 配置核对，但不强制自动更新。
- **TYDRO_POINT_TO_USD_RATE**：固定为 1，不变。
- **InkAprCalculator**：`TOTAL_SUPPLY`、`MIN_FDV`(0)、`MAX_FDV`(BNB) 固定；**REFERENCE_POINTS** 的列表（交易所/链/token/CoinGecko 链接）为硬编码，**FDV 值**由 `useCoingeckoFdv` 从后端 `/coingecko-fdv` 动态拉取，无需对参考点列表做自动更新。
- **SYMBOL_MAP / SYMBOL_NAME_MAP**：与 aave/interface reservePatches 基本一致，可随其 reservePatches 一起同步时顺带更新。

---

## 二、外部依赖与静态资源（处理策略）

### 1. NPM 包

- **@bgd-labs/aave-address-book**：合约/资产地址、tokenlist。建议**定期更新**（或监听其 release，用 N8N 触发更新依赖或同步数据）。
- 其他业务依赖按常规版本策略即可。

### 2. 固定静态资源（不依赖外部变更，不纳入自动更新）

- `aave_apy_logo`、`/icons/tokens/default.svg`
- `lightSourceIconMap` / `darkSourceIconMap`（IncentiveTooltip）、`/icons/partners/*`、`/icons/networks/ink.svg`、`preloadIncentiveIcons` 中列出的路径  
以上为自有或合作方固定资源，无需从信息源同步。

### 3. 需定期触发的脚本

- **仅** `scripts/sync-token-icons.mjs`：从 tokenlist + CoinGecko 拉取缺失 token 图标到 `public/icons/tokens/`。建议用 N8N 或 CI **定期触发**，保证新资产有图标。
- 已加 GitHub Actions 自动化：`.github/workflows/token-icon-sync.yml`（定时触发，变更自动开 PR）。
- 已加 GitHub Actions 检查：`.github/workflows/hardcode-drift-check.yml`，执行 `npm run check:hardcode-icons`，定时检查 `reservePatches` 中 `iconSymbol` 是否有对应本地图标。

### 4. 其他 URL / API

- `VITE_API_BASE_URL`、CoinGecko 相关 API、Aave 官网链接等：按现有方式配置即可，无需列入自动更新清单。

---

## 三、CI 自动化覆盖（前端）

| 项目 | CI 状态 | 原因 | 怎么办 |
|------|--------|------|------|
| Token icon 同步 | 已自动化 | 新资产图标需持续补齐 | `.github/workflows/token-icon-sync.yml`（定时） |
| `reservePatches` 的 `iconSymbol` 本地图标存在性 | 已自动化 | 防止 iconSymbol 落到 default icon | `.github/workflows/hardcode-drift-check.yml` -> `check:hardcode-icons` |
| `reservePatches` 与上游 interface 地址键漂移 | 已自动化 | 防止漏同步上游新增资产映射 | `.github/workflows/hardcode-drift-check.yml` -> `check:reserve-patches-upstream` |
| `MARKET_NAME_MAP` 与上游 `marketsConfig.tsx` 对齐 | 已自动化 | 防止市场路由映射漂移 | `.github/workflows/hardcode-drift-check.yml` -> `check:market-name-map-upstream` |
| `chainIconMap` 与上游 `networksConfig.ts` 对齐 | 已自动化 | 防止链名/图标映射漂移 | `.github/workflows/hardcode-drift-check.yml` -> `check:chain-icons-upstream` |
| 本地业务常量（如 `ETHEREUM_MARKET_NAMES`、`TYDRO` 常量） | 不建议自动化 | 本质是业务决策，不是外部源同步问题 | 保持人工评审 |

不做自动更新的项：chainId/chainName 若仅用 API 返回值则无需 map；ETHEREUM_MARKET_NAMES、TYDRO 汇率、Ink 常量、REFERENCE_POINTS 列表、固定 logo/partner 图标。

## 四、N8N 还是否需要

- 对本仓库当前 hardcode 场景，GitHub Actions 已覆盖核心自动化，N8N 不是必需。
- N8N 仍有价值的场景：
  - `token-icon-sync` 产出 PR 后，自动在 Slack 通知 design/ops 并等待人工审批后再自动 merge。
  - `hardcode-drift-check` 失败时自动创建 Linear/Jira 工单，附带失败脚本输出和责任人路由。
  - 前后端两仓同时触发“接口+图标+文档”联动更新（GitHub Actions 跨仓编排较弱时用 N8N 做总控）。
