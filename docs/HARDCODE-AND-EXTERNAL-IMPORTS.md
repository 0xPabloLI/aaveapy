# 硬编码与外部依赖清单（精简版）

**主要信息源**：官方 SDK（`@bgd-labs/aave-address-book`）+ 官方前端 [aave/interface](https://github.com/aave/interface)。

---

## 一、需自动更新 / 可同步自信息源的内容

### 1. chainId 与 chainName

- **当前代码**：没有静态的 chainId↔chainName map；池子数据来自 API，每条带 `chainId` 和 `chainName`，前端只用 `chainName` 展示和取图标。
- **若需要 map**：可来自 [aave/interface `networksConfig.ts`](https://github.com/aave/interface/blob/main/src/ui-config/networksConfig.ts)。该文件以 **ChainId 为 key**，每项含 `name`、`networkLogoPath`、`publicJsonRPCUrl` 等，可提供：
  - chainId → 链名（`name`）
  - chainId → 图标路径（`networkLogoPath`，如 `/icons/networks/ethereum.svg`）
  - chainId → RPC 列表（`publicJsonRPCUrl`）

### 2. chainIconMap（链名 → 图标路径）

- **当前代码**：`src/lib/chainIcons.ts` 与 `src/lib/preloadUtils.ts` 内各有一份 `chainIconMap`（链名归一化 → 图标文件名），重复定义。
- **更新源**：**aave/interface** 的 `networksConfig.ts`。他们没有字面量 "chainIconMap"，但有 `prodNetworkConfig` / `testnetConfig`：每链为 `ChainId → { name, networkLogoPath }`。可从 `name` 归一化得到我们用的 key，从 `networkLogoPath` 得到图标路径（如 `/icons/networks/arbitrum.svg`），新链会随官方一起更新。
- **建议**：N8N 或脚本监听 aave/interface 变更，生成或更新本仓库的 chainIconMap 数据（并统一从一处读取，去掉 preloadUtils 内重复）；新链图标可从 interface 的 `public/icons/networks/` 同步或从 networkLogoPath 拉取到本仓库 `public/icons/networks/`。

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
- 已加 GitHub Actions 自动化：`.github/workflows/token-icon-sync.yml`（定时 + 手动触发，变更自动开 PR）。
- 已加 GitHub Actions 检查：`.github/workflows/hardcode-drift-check.yml`，执行 `npm run check:hardcode-icons`，定时检查 `reservePatches` 中 `iconSymbol` 是否有对应本地图标。

### 4. 其他 URL / API

- `VITE_API_BASE_URL`、CoinGecko 相关 API、Aave 官网链接等：按现有方式配置即可，无需列入自动更新清单。

---

## 三、N8N / 自动化建议汇总

| 项目 | 更新源 | 动作 |
|------|--------|------|
| chainIconMap + 新链图标 | aave/interface `networksConfig.ts`、`public/icons/networks/` | 监听 interface 变更，生成 chainIconMap 并同步网络图标；去掉 preloadUtils 内重复 map |
| MARKET_NAME_MAP | aave/interface `marketsConfig.tsx` 或 address-book | 随官方更新生成 aaveLinks 用的 market 名 → marketName |
| underlyingAssetMap / reservePatches | aave/interface `reservePatches.ts` | 同步 underlyingAssetMap 与 SYMBOL_*；保留本仓库 tokenlist logoURI |
| @bgd-labs/aave-address-book | npm / GitHub release | 定期升级或 release 时触发同步 |
| Token 图标 | 本仓库 tokenlist + CoinGecko | 定期运行 `sync-token-icons.mjs` |

不做自动更新的项：chainId/chainName 若仅用 API 返回值则无需 map；ETHEREUM_MARKET_NAMES、TYDRO 汇率、Ink 常量、REFERENCE_POINTS 列表、固定 logo/partner 图标。

---

## 四、hardcode 补充规则（防漏）

本节只记录“下次同步必须检查什么”，不记录某次同步结果。

### A. 数据源对齐规则

1. `reservePatches.ts`：以 `interface/src/ui-config/reservePatches.ts` 为主源，逐条同步新增/修改地址映射（`symbol/name/iconSymbol`）。
2. `MARKET_NAME_MAP`：以 `interface/src/ui-config/marketsConfig.tsx` 的 market 标识为准，确保后端返回 marketName 100% 可映射。
3. `chainIconMap`：以 `interface/src/ui-config/networksConfig.ts` 的 `name/networkLogoPath` 为准，保证所有运行中链都可映射图标。
4. token 图标目录：`public/icons/tokens` 需覆盖运行时会出现的 token symbol/iconSymbol（至少不落到 default icon）。

### B. 每次同步必跑检查

1. `reservePatches` 差异：
```bash
git --no-pager diff --no-index -- \
  /Users/pabloli/Documents/interface/src/ui-config/reservePatches.ts \
  /Users/pabloli/Documents/aaveapy/src/ui-config/reservePatches.ts
```

2. token icon 文件差异（interface 有、aaveapy 没有）：
```bash
comm -23 <(ls -1 /Users/pabloli/Documents/interface/public/icons/tokens | sort) \
         <(ls -1 /Users/pabloli/Documents/aaveapy/public/icons/tokens | sort)
```

3. `MARKET_NAME_MAP` 覆盖率（后端市场名）：
- 从 `data/debug/aave-all-markets-data.json` 提取 `markets[].name`，必须全部命中 `src/lib/aaveLinks.ts` 的 `MARKET_NAME_MAP`。

4. `chainIconMap` 覆盖率（运行时链名）：
- 从 `data/runtime/aave-formatted-data.json` 提取 `chainName`，必须全部命中 `src/lib/chainIcons.ts`。

5. `reservePatches` 的 `iconSymbol` 文件存在性：
- 逐个检查 `iconSymbol` 是否在 `public/icons/tokens` 有对应文件（或存在明确“故意缺失”白名单）。
- 自动化检查脚本：`scripts/check-hardcode-icons.mjs`（白名单在脚本内 `KNOWN_MISSING_ICON_SYMBOLS`）。

### C. 缺失处理规则

1. 如果 `interface` 也缺图标：沿用现状，不单独在 aaveapy 发散补丁；只记录为“上游待补”。
2. 如果仅 aaveapy 缺失：优先从 interface 同步；没有则用 tokenlist 的 `logoURI` 兜底。
3. 新 token（例如新链新资产）加入后，必须同时检查：
- `reservePatches` 映射
- token icon 文件
- `MARKET_NAME_MAP`（如涉及新市场）
- `chainIconMap`（如涉及新链）
