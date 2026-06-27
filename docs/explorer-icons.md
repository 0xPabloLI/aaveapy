# Block Explorer Icons - Asset Pipeline & Runbook

> **Audience**: developers touching the explorer brand icon pipeline (`src/lib/explorerIcons.ts`, `src/lib/explorerIconMap.ts`, `scripts/generate-explorer-icon-manifest.mjs`, `public/icons/explorers/`, `src/components/ui/ExplorerIconStack.tsx`).
>
> **Scope**: how a chain's block-explorer's brand logo gets from "we have a 1:many base → brand mapping" to "rendered as a stacked icon next to the chain logo in `AssetActionMenu`", and how to add a new explorer base without breaking the pipeline.

## 1. 范围 (Scope)

视觉层面：4 个 explorer family × 4 个 brand icon → 20 个 base URL。

| Family | Brand | Bases | Base 数 |
|--------|-------|-------|--------|
| Etherscan | `etherscan` | etherscan.io / arbiscan.io / optimistic.etherscan.io / polygonscan.com / basescan.org / gnosisscan.io / bscscan.com / lineascan.build / sonicscan.org / celoscan.io / mega.etherscan.io / plasmascan.to / mantlescan.xyz / snowscan.xyz | 14 |
| Routescan | `routescan` | metisscan.info | 1 |
| Blockscout | `blockscout` | scrollscan.com / zksync.blockscout.com / soneium.blockscout.com / explorer.inkonchain.com | 4 |
| OKLink | `oklink` | oklink.com | 1 |

> 14 个 Etherscan-family 站点共用同一 brand logo（`etherscan.svg`）。Etherscan 集团统一下发 brand assets，所有子站保持一致。

## 2. 资产清单 (Audit)

`public/icons/explorers/` 目录：

| File | Size | Source / Status | 备注 |
|------|------|-----------------|------|
| `etherscan.svg` | 32×32 viewBox | https://etherscan.io/brandassets（AAV-660 Slice 1 交付） | 官方 brand kit（蓝底白字抽象图形）|
| `routescan.svg` | 48×48 viewBox | https://routescan.io brand assets（已替换为官方 SVG）| 彩色立方体风格 logo |
| `blockscout.svg` | 32×32 viewBox | Hand-fetched from official brand kit（已替换为官方 SVG）| Embedded PNG base64 |
| `oklink.svg` | 32×32 viewBox | Hand-fetched from official brand kit（已替换为官方 SVG）| Embedded PNG base64（296×296 OG Logo 缩放） |

> ~~**Placeholder 策略说明**：因官方 brand kit 在生产环境需手动 fetch + 版权审查，当前 3 个新 SVG 是**简化抽象图**（letterform + brand 配色）。视觉效果与 Etherscan.svg 一致（32×32 viewBox、圆形底色、白色字形）。替换时直接覆盖同名文件即可，无需改代码。~~ → 所有 4 个 family SVG 均为官方品牌资产，placeholder 策略已不再适用。

## 3. 资产管道 (Pipeline)

```
                        ┌──────────────────────────────┐
  Hand-maintained       │  src/lib/explorerIconMap.ts  │  20 base → 4 brand
  ────────────────────► │  Record<base, brand>         │  (1:N 去重)
                        └────────────┬─────────────────┘
                                     │
                                     │ getExplorerIconSrc(base)
                                     ▼
                        ┌──────────────────────────────┐
  Auto-generated        │  src/lib/explorerIcon-       │  4 brand → [svg]
  (regen on SVG add)    │  Manifest.generated.ts       │  (品牌键索引)
                        └────────────┬─────────────────┘
                                     │
                                     │ /icons/explorers/{brand}.svg
                                     ▼
                        ┌──────────────────────────────┐
  Static asset          │  public/icons/explorers/     │  4 SVG files
                        │  (brand-themed)               │
                        └────────────┬─────────────────┘
                                     │
                                     │ <img src=...>
                                     ▼
                        ┌──────────────────────────────┐
  React component       │  ExplorerIconStack.tsx       │  chain icon + explorer
                        │                              │  icon 14×14, 22px wide container, 6px overlap
                        └────────────┬─────────────────┘
                                     │
                                     │ trailing slot
                                     ▼
                        ┌──────────────────────────────┐
  Consumer              │  AssetActionMenu.tsx         │  4 explorer items
                        │  (token/pool/hub/spoke-      │  (token/pool/hub/spoke-
                        │   explorer)                  │   explorer)
                        └──────────────────────────────┘
```

### 双层防御 (Two-layer resolution)

`getExplorerIconSrc(base)` 在 `src/lib/explorerIcons.ts:12` 实现：

1. `normalizeExplorerBase(base)` 归一化（去协议、www.、路径、小写）
2. `explorerIconMap[normalized]` 查 brand key
3. `EXPLORER_ICON_MANIFEST[brand]` 查 on-disk 资产存在性
4. 任意一层 miss → `undefined`（**不抛错、不 console.warn**）

**为什么双层**：base → brand 是 1:N 映射，brand → file 是 1:1 映射。两层任一缺失都安全 fallback，避免新加 base 但忘记放 SVG 时报错。

### 静默 Fallback 行为 (Silent fallback)

`ExplorerIconStack.tsx` 对 4 种状态做条件渲染：

| chainIconSrc | explorerIconSrc | 渲染 |
|--------------|------------------|------|
| ✓ | ✓ | 两者并排叠放（14×14，22px 容器 6px 重叠）|
| ✓ | ✗ | 只显示 chain icon |
| ✗ | ✓ | 只显示 explorer icon |
| ✗ | ✗ | 隐藏整个 trailing slot（无空白） |

不 `console.warn`——这会污染 production console。icon 缺失是已建模的稳定状态，不是异常。

## 4. 命名约定 (Naming)

### 4.1 Base key

`explorerIconMap` 的 key 是**归一化后的 host**（无协议、无 www.、无路径、小写）。示例：

```
"https://etherscan.io"          → "etherscan.io"
"https://www.oklink.com"        → "oklink.com"   ←  strip www.
"https://arbiscan.io/address/x" → "arbiscan.io"  ←  strip path
```

实现：`src/lib/explorerIconMap.ts:40` 的 `normalizeExplorerBase()`。

### 4.2 Brand key

brand key 跟 `chainIconMap` 对齐：小写、单词、无后缀。例：

```
"etherscan" / "routescan" / "blockscout" / "oklink"
```

> 多数情况下 brand key = Etherscan 集团名 / Routescan 公司名 / Blockscout 项目名 / OKLink 产品名。**不要**用 `etherscan-v2` 这类带版本后缀——同一 family 的所有子站共享 brand。

### 4.3 SVG filename

`public/icons/explorers/{brand}.svg`。**单 brand 一文件**（不是 1 base 1 file）。`EXPLORER_ICON_MANIFEST` 是 brand → exts 索引，多 base 共享同一 brand 时自动去重。

## 5. 添加新 Explorer Base 的 Runbook

场景：Aave 新增一条链 `AaveV3NewChain`，其 block explorer 是 `newscan.io`。

### Step 1: 决定 brand key

- 如果新 explorer 是已有 family（Etherscan 集团多站点 / Blockscout 多个实例 / Routescan 多链）→ 复用现有 brand
- 如果是全新 family → 选新 brand key（小写、单词，例如 `newscan`）

### Step 2: 决定是否需要新 SVG

- 复用现有 brand：跳过此步
- 新 brand：放 `public/icons/explorers/{brand}.svg`（32×32 viewBox、品牌色、简化的 letterform 或抽象图；后续再替换为官方 kit）

### Step 3: 注册到 explorerIconMap

`src/lib/explorerIconMap.ts:9`：

```typescript
'newscan.io': 'newscan',  // 或 'etherscan' / 'blockscout' / 'routescan' / 'oklink'（复用）
```

**重要**：用 `normalizeExplorerBase` 的归一化形式（**没有** `www.`、没有协议）。可通过现有 `normalizeExplorerBase` 工具函数测试：

```typescript
import { normalizeExplorerBase } from './explorerIconMap';
normalizeExplorerBase('https://www.newscan.io/foo'); // → 'newscan.io'
```

### Step 4: 刷新 manifest

```bash
node scripts/generate-explorer-icon-manifest.mjs
```

这会重新扫描 `public/icons/explorers/` 并覆写 `src/lib/explorerIconManifest.generated.ts`。新加的 brand key 自动出现在 manifest 中。

### Step 5: 在 poolExplorerLinks 注册 chain + explorer

`src/lib/poolExplorerLinks.ts` 添加新 chain 配置（如果新链新增）。base URL 必须是 `getExplorerMarketNames()` / `CHAIN_EXPLORER_MAP` 里**实际使用的 URL**——`getExplorerIconSrc` 接收的是这个 URL，归一化后查 map。

### Step 6: 验证

```bash
npm test -- --run src/lib/explorerIcons.test.ts src/components/dashboard/AssetActionMenu.test.tsx
```

新增测试用例覆盖：新 base 在 AssetActionMenu 中显示新 brand icon。可参考 Slice 2 加的 3 个 brand test（Metis → routescan / Scroll → blockscout / XLayer → oklink）的模式。

最后跑完整 validation gate：

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

### Step 7: 更新文档

- `docs/pool-explorer-links.md` 的"各链 Explorer 类型确认"表 + "完整市场链接列表"对应 family 表加新行，Icon 列填 ✅
- `CONTEXT.md`（如新增 family）追加术语条目；多数情况 brand key 已存在则无需改

## 6. 替换 Placeholder 为官方 Brand Kit 的 Runbook ~~（已完成）~~

~~针对 `routescan.svg` / `blockscout.svg` / `oklink.svg` 三个 placeholder 状态。~~

> 所有 4 个 family SVG 均已替换为官方品牌资产，此 runbook 保留作为未来参考。

### Step 1: 拿到官方 SVG

- Routescan: https://routescan.io brand assets
- Blockscout: https://github.com/blockscout/blockscout 仓库 `apps/block_scout_web/assets/static/images/blockscout_logo.svg`
- OKLink: https://www.oklink.com/about brand assets

### Step 2: 调整 viewBox + 尺寸

确保 SVG 保持原始 viewBox，CSS 端通过 `h-3.5 w-3.5`（14×14）统一缩放。如官方 kit 尺寸差异巨大：

```bash
# 用 Inkscape / svgo 调整
npx svgo --multipass public/icons/explorers/routescan.svg
```

或手动改 `viewBox` 属性 + 重新居中 path。

### Step 3: 覆盖文件 + 重新生成 manifest

直接覆盖 `public/icons/explorers/{brand}.svg`，然后跑：

```bash
node scripts/generate-explorer-icon-manifest.mjs
```

manifest 不会变化（已注册），但保险起见跑一次。

### Step 4: 视觉对比

打开任意该 explorer 的 AssetActionMenu，对比替换前后：

- 旧 placeholder：letterform（"R" / "B" / "OK"）在 brand 配色圆底
- 新官方：品牌实际 logo

如视觉差异巨大（颜色、圆角、边框），可能需要微调 `ExplorerIconStack.tsx` 的 overlap 比例。当前 14×14 + 22px 容器 6px 重叠是按实际 logo 视觉重量调的。

### Step 5: 更新本文档

替换完成后修改本文档 `## 2` 资产清单表格的 "Source / Status" 列为官方源。

## 7. 故障排查 (Troubleshooting)

| 症状 | 原因 | 排查 |
|------|------|------|
| AssetActionMenu 上 explorer item 只显示 chain icon，无 explorer icon | `explorerIconMap` 漏注册 / brand key 拼错 / SVG 未生成 manifest | 1. 确认 base URL 归一化后存在于 `explorerIconMap`<br>2. 跑 `node scripts/generate-explorer-icon-manifest.mjs`<br>3. 检查 `EXPLORER_ICON_MANIFEST` 含该 brand |
| `getExplorerIconSrc('https://www.oklink.com')` 返回 `undefined` | `www.` 未被 strip → key 不匹配 | 确认 map key 是 `oklink.com` 不是 `www.oklink.com`（见 Slice 2 修复历史）|
| 浏览器 console 报 404 on `/icons/explorers/X.svg` | SVG 文件缺失 / manifest 未更新 | 1. 确认 `public/icons/explorers/{brand}.svg` 存在<br>2. 跑 manifest 生成器<br>3. 重启 Vite dev server（清缓存）|
| 视觉叠放错位 | `ExplorerIconStack` 的尺寸参数改坏了 | 检查 `src/components/ui/ExplorerIconStack.tsx` 的 `h-3.5 w-[22px]` + 定位 class |

## 8. 相关文件索引

- `src/lib/explorerIconMap.ts` — base → brand 映射 + `normalizeExplorerBase`
- `src/lib/explorerIconManifest.generated.ts` — brand → 资产扩展名（自动生成）
- `src/lib/explorerIcons.ts` — `getExplorerIconSrc` / `getExplorerBrand`
- `src/components/ui/ExplorerIconStack.tsx` — 叠放渲染组件
- `src/components/dashboard/AssetActionMenu.tsx` — 4 个 explorer item 的 trailing slot
- `scripts/generate-explorer-icon-manifest.mjs` — manifest 生成器
- `scripts/lib/run-icon-manifest-generators.mjs` — 4 个 manifest 生成器（chain / explorer / partners / tokens）的总入口
- `public/icons/explorers/` — 4 个 SVG 文件
- `src/lib/explorerIcons.test.ts` — 单元测试
- `src/components/ui/ExplorerIconStack.test.tsx` — 组件测试
- `src/components/dashboard/AssetActionMenu.test.tsx` — 集成测试（4 brand 全覆盖）
- `docs/pool-explorer-links.md` — 每个市场链 explorer URL + icon status 表
- `CONTEXT.md` — 术语定义（"Block Explorer" / "Block Explorer Icon"）
