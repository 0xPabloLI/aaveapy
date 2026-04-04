# 硬编码与外部依赖清单（前端）

更新时间：2026-04-01  
适用仓库：`aaveapy`（前端）

## 1. 本仓库实际消费的 interface 映射资源

| 资源主题 | 上游来源 | 本地文件 | 实际使用入口 |
|---|---|---|---|
| reserve patch（地址级 symbol/name/logo 修正） | `aave/interface/src/ui-config/reservePatches.ts` | `src/ui-config/reservePatches.ts` | `fetchIconSymbolAndName()` |
| 市场名映射 | `aave/interface/src/ui-config/marketsConfig.tsx` | `src/lib/aaveLinks.ts` (`MARKET_NAME_MAP`) | `buildAaveReserveUrl()` |
| 链图标映射 | `aave/interface/src/ui-config/networksConfig.ts` | `src/lib/chainIconMap.ts` + `scripts/generate-chain-icon-manifest.mjs` → `chainIconManifest.generated.ts` | `getChainIconSrc()`（仅当 `public/icons/networks/` 下确有文件时才返回 URL；缺图可走 `scripts/data/pending-chain-icon-bases.json` 允许校验通过） |
| token icon 候选集合 | reservePatches + SYMBOL_MAP + 运行时 `/markets` | `scripts/lib/token-icon-symbols.mjs` | `sync-token-icons.mjs` 计算 required symbols；**落盘顺序**见 §4.2（优先 mirror `aave/interface` 的 `public/icons/tokens`） |

关键点：
- token icons 不再靠手工 `EXTRA_SYMBOLS`。
- required symbols 每次由“当前代码映射 + 当前运行时市场数据”实时推导。

## 2. 自动化链路（GitHub Actions）

当前真实工作流：
- `.github/workflows/hardcode-sync.yml`

触发：
- `schedule` / `workflow_dispatch` / `repository_dispatch`：使用 **matrix** 在 **`dev`** 与 **`main`** 上各跑一遍（两个 job）；PR 头分支为 `bot/hardcode-sync-dev` / `bot/hardcode-sync-main`，base 分别为对应分支。
- `schedule` cron：`20 4 * * *`（每日 04:20 UTC）。

执行步骤（核心）：
1. `npm run hardcode:sync`
2. `npm run hardcode:verify`
3. 失败后再做一轮 sync + verify
4. verify 通过则自动建 PR；持续失败则建 issue 并 fail job

只读校验（默认分支，无自动改文件）：`.github/workflows/hardcode-drift-check.yml`，`schedule` 当前为每日 **05:00 UTC**（晚于 sync，便于先出 bot PR）。**在合并该 PR 之前**，默认分支仍可能对「新链」报错——属于预期；合并后即与 live `/markets` 对齐。

## 3. 同步与校验脚本分工

| 目标 | 同步脚本 | 校验脚本 |
|---|---|---|
| reserve patches（含 `SYMBOL_MAP` 合并 + `underlyingAssetMap` 追加） | `scripts/sync-reserve-patches-upstream.mjs` | `scripts/check-reserve-patches-upstream.mjs` |

### 3.1 `reservePatches.ts` 与 interface 对齐规则

- **`SYMBOL_MAP`**（实现：`scripts/lib/reserve-patches-symbol-map.mjs`）  
  - **自动合并**：上游 `aave/interface` 的每个 key→value **覆盖**本地同名 key；**仅本地存在的 key**（例如 `USD₮0`）**保留**。  
  - **写出条件**：仅当合并后的 Map 与当前文件解析结果**在语义上不一致**时才重写 `SYMBOL_MAP` 块（避免无意义抖动）。重写时会按「上游 key 顺序 + 本地独有 key 排序」排版；**块内注释**（如 `// avalanche`）在发生重写时可能消失，属可接受取舍。  
  - **校验**：`check-reserve-patches-upstream` 要求上游每个 `SYMBOL_MAP` 条目在本地**存在且 value 一致**；本地多出的 key 仅 **warning**。
- **`underlyingAssetMap`**（既有行为）  
  - **同步**：把上游有、本地缺的 **地址键 / 表达式键** 条目**追加**进本地 map。  
  - **校验**：上游有的键本地必须有；仅本地有的键 **warning**。
| market name map | `scripts/sync-market-name-map-upstream.mjs` | `scripts/check-market-name-map-upstream.mjs` |
| chain icon map | `scripts/sync-chain-icon-map-upstream.mjs` | `scripts/check-chain-icon-map-upstream.mjs`（映射须覆盖上游；磁盘缺图时可列入 `scripts/data/pending-chain-icon-bases.json`） |
| CoinGecko `chainId` → platform id（随 `/markets` 出现的新链） | `scripts/sync-coingecko-platform-map.mjs` | `scripts/check-coingecko-platform-map-upstream.mjs` |
| token icons | `scripts/sync-token-icons.mjs` | `scripts/sync-token-icons.mjs --check` + `scripts/check-hardcode-icons.mjs` |

`hardcode:verify` 当前命令链：
- `check:hardcode-icons`
- `check:reserve-patches-upstream`
- `check:market-name-map-upstream`
- `check:chain-icons-upstream`
- `check:coingecko-platform-map-upstream`
- `sync-token-icons -- --check`

## 4. Token Icon Backup 策略（当前实现）

### 4.1 required symbols 怎么来
每次运行 `sync-token-icons` 时，按以下来源合并：
1. `reservePatches` 的 `underlyingAssetMap.iconSymbol`
2. `SYMBOL_MAP` 映射值
3. 运行时 `/markets` 返回 token（按与前端一致规则映射后得到 icon key）

### 4.2 下载策略（interface-first，再公开 API / logo）
对缺失的 required symbol（小写文件名 stem，与现有 `public/icons/tokens/` 一致）：
1. **`aave/interface` 静态目录**：`public/icons/tokens/<symbol>.{svg,png,webp,jpg}`，通过 `raw.githubusercontent.com/aave/interface/main/public/icons/tokens/` 拉取（与官方 App 资产对齐；新链包装资产常已在此出现而 CoinGecko ticker 对不上）。
2. **CoinGecko**：`api/v3/search` 上 **symbol 精确匹配** 后的 `large`/`thumb` 图。
3. **`logoURI` 回退**：地址级图标（address-book tokenlist、`reservePatches`、或 `/markets` 行内若存在 `logoURI`）。

最终落盘到 `public/icons/tokens/`（扩展名按响应 `Content-Type` 与 URL 推断，如 `.png` / `.svg`）。

环境变量 **`INTERFACE_TOKEN_ICONS_BASE`** 可覆盖步骤 1 的 base URL（默认即 interface `main` 分支 raw 路径；去掉末尾 `/`）。

这保证了：
- 与 **Aave Interface** 已提交的 token 图优先一致
- 本地静态 backup 仍覆盖 **interface 尚未收录** 的 symbol
- `wrapped` / RWA 等 ticker 不标准时仍可靠 **logoURI** 补齐

### 4.3 `--check` 语义
- 只要存在“缺失但可同步”的图标（**interface 静态文件**、**CoinGecko** 或 **logoURI** 任一可拿到），`--check` 就会 fail。
- 仅当三类都不可用（且本地仍缺文件）时，该 symbol 记为 **unsyncable**（warning，不单独因 unsyncable 让 `--check` 失败；与此前行为一致）。
- 所有可同步项都补齐后，`--check` 才通过。

## 5. 外部依赖分层

### 5.1 运行时数据 API
`sync-coingecko-platform-map.mjs` / `check-coingecko-platform-map-upstream.mjs` 拉取 `/markets` 时：优先读 **LIVE_TEST_API_BASE_CI**（本机可 export；CI 里对应 GitHub **Repository variable** 同名，常用 **Railway 直连 URL** 绕过对 `api.aaveapy.com` 的边缘拦截），其次 `VITE_API_BASE_URL`，再回退 **`https://staging-api.aaveapy.com/api`**。对脚本/CI 而言，默认打生产 `api.aaveapy.com` 往往无意义（易被 403 等拦下；浏览器里还有 CORS，无头 `fetch` 则是边缘策略问题）。

在 GitHub Actions 里：`vars.LIVE_TEST_API_BASE_CI` → job `env.LIVE_TEST_API_BASE_CI`；未配置变量时 workflow 表达式仍回退 staging（与 `ci.yml` live-schema 一致）。总表见 `docs/conventions/api-base-urls.md`；Cloudflare 排障见 `docs/conventions/ci-live-schema-cloudflare.md`。

`sync-token-icons.mjs` 拉取 `/markets` 时使用与上面相同的基址优先级（`LIVE_TEST_API_BASE_CI` → `VITE_API_BASE_URL` → staging → production），并可用 `SYNC_TOKEN_ICONS_MARKETS_API` 覆盖为首段 URL 列表（仍会追加 staging 作为后备）。`token-icon-sync.yml` 为 job 注入与 hardcode 工作流一致的 `LIVE_TEST_API_BASE_CI`。

`VITE_API_BASE_URL`（前端构建/运行时；未设置时见 `src/lib/apiBase.ts` 默认）：
- `/markets`
- `/markets/stats`
- `/markets/list`
- `/coingecko-categories`
- `/coingecko-fdv`

### 5.2 CoinGecko
- 运行时兜底：`https://api.coingecko.com/api/v3/search`（`useCoingeckoTokenImage`）
- 离线落盘：`sync-token-icons.mjs` 在 **interface 静态目录未命中** 后使用同一搜索接口

### 5.3 上游源码与静态资源抓取（脚本）
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatches.ts`（`SYMBOL_MAP` 合并逻辑见 `scripts/lib/reserve-patches-symbol-map.mjs`）
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/marketsConfig.tsx`
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts`
- `https://raw.githubusercontent.com/aave/interface/main/public/icons/tokens/`（`sync-token-icons.mjs` 按 symbol 试 `svg` → `png` → `webp` → `jpg`；可用 `INTERFACE_TOKEN_ICONS_BASE` 覆盖 base）

### 5.4 外链（非数据依赖）
- `app.aave.com`、`app.merkl.xyz`、`apps.aavechan.com`、`incentra.brevis.network`
- Ink 组件内 CoinGecko/CoinMarketCap/社媒链接

## 6. 有意保留的业务 hardcode（非上游镜像）

| 项目 | 文件 | 说明 |
|---|---|---|
| 以太坊市场分组名 | `src/types/aave.ts` (`ETHEREUM_MARKET_NAMES`) | UI 展示策略 |
| 默认分类词表 | `src/types/aave.ts` (`STABLECOINS`/`ETH_RELATED`/`BTC_RELATED`/`PENDLE_TOKENS`) | 业务默认值（可被 API 覆盖） |
| TYDRO 点值 | `src/lib/tydro.ts` (`TYDRO_POINT_TO_USD_RATE`) | 业务参数 |
| Ink 参考点 | `src/components/dashboard/InkAprCalculator.tsx` (`REFERENCE_POINTS`) | 产品参数 |

## 7. 本地巡检命令

```bash
npm run hardcode:sync
npm run hardcode:verify
npm run sync-token-icons -- --check
```

## 8. 当前状态结论

- 映射同步：reserve patches（含 **`SYMBOL_MAP` 自动合并** + `underlyingAssetMap` 追加）/ market map / chain map 均已对齐校验。
- token icon：已采用 **interface 静态目录优先**，再 **CoinGecko** + **logoURI** 回退。
- workflow：以 `hardcode-sync.yml` 为单一自动化入口。
