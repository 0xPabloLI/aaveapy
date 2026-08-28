# Handoff: FCP 优化任务（已归档，已被 spec 取代）

> **Superseded**：本交接文档的调查结论已实施并落盘到 `docs/specs/fcp-optimization.md`（Round 1+2,AAV-1279）。保留作历史参考,其中的 manualChunks 引用已过时——现行 chunk 策略为 rolldown 原生 `advancedChunks`。

# Handoff: FCP 优化任务

## 背景

aaveapy.com 的 First Contentful Paint (FCP) 当前为 **3,336ms**，Google 标准为 < 1.8s (好) / 1.8-3.0s (需改进) / > 3.0s (差)。目标是优化到 2.5s 以内。

## 当前性能基线

### 页面加载（无痕模式，无 cookies，HK→HKG CDN 节点）

| 指标 | 时间 |
|------|------|
| TCP + TLS | 735ms |
| TTFB | 935ms (Cloudflare CDN HIT, Vercel HKG) |
| First Paint | 1,904ms |
| **FCP** | **3,336ms** |
| DOM Content Loaded | 1,899ms |
| Load Complete | 3,001ms |
| 所有资源加载完 | 11,421ms |

### API 响应

| API | TTFB | 大小 |
|-----|------|------|
| `/api/markets` (冷) | 538ms | 385 KB |
| `/api/markets` (热) | 287ms | — |
| `/api/meta/side-data` | 1ms (已缓存) | — |

### JS Bundle 大小分布

HTML 直接引用的 JS chunks（23 个，总计 510.7 KB compressed）：

| Chunk | Compressed Size | 说明 |
|-------|----------------|------|
| `dist-BvVkiiYn.js` | 156 KB | **最大** — 需要分析内容 |
| `vendor-react-DZRV5P9T.js` | 107 KB | React + ReactDOM |
| `vendor-animation-C_Qx4wUO.js` | 53 KB | framer-motion + embla-carousel |
| `vendor-forms-B5_ys5zY.js` | 38 KB | zod + @hookform |
| `vendor-radix-DW7L8AHu.js` | 30 KB | @radix-ui |
| `call-CvRUywXo.js` | 29 KB | 需要分析 |
| `i18n-BClmzYhr.js` | 20 KB | i18n |
| `vendor-react-libs-DVlB_Dc4.js` | 16 KB | react-router + react-hook-form |

运行时动态加载的 chunks（未计入上面 510KB）：

| Chunk | Compressed Size | 说明 |
|-------|----------------|------|
| `vendor-aave-Bo_zqFd6.js` | 194 KB | @aave-dao — **最大 chunk** |
| `Index-jSE71YeI.js` | 125 KB | 主页面组件 |
| `table-BVqwLHKo.js` | 0.6 KB | 表格（可能是 lazy import 的入口） |

### 资源统计
- 总请求：141 个
- 总传输：1,709 KB (1.7 MB)
- 总解码：4,394 KB (4.3 MB)

## 已完成的优化

1. ✅ Cloudflare Early Hints 已开启 (`early_hints: on`)
2. ✅ Cloudflare Brotli 压缩已开启
3. ✅ Cloudflare HTTP/3 已开启
4. ✅ Cloudflare Cache Level: aggressive
5. ✅ Vercel toolbar 已在 production 关闭（通过 `VERCEL_TOOLBAR=disabled` 环境变量）

## 当前 Early Hints 行为

Cloudflare Early Hints 已开启，但当前页面 **没有返回 `Link` 头**。Early Hints 的工作原理是：
1. Cloudflare 从 HTML 响应中提取 `<link rel="preload">` 和 `<link rel="modulepreload">` 标签
2. 在下一次请求时，Cloudflare 会先发 HTTP 103 响应，包含这些 Link 头
3. 浏览器收到 103 后提前开始下载资源，不用等 HTML 解析

当前 HTML 中已有的 preload 标签：
- `<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro...">` — Google Fonts CSS
- `<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Source+Code+Pro...">` — Google Fonts CSS
- `<link rel="preconnect" href="https://api.aaveapy.com" crossorigin>` — API 预连接
- `<link rel="modulepreload" href="/assets/rolldown-runtime-*.js">` — Vite runtime
- `<link rel="modulepreload" href="/assets/vendor-animation-*.js">` — framer-motion
- `<link rel="modulepreload" href="/assets/vendor-radix-*.js">` — Radix UI
- `<link rel="modulepreload" href="/assets/vendor-react-*.js">` — React
- `<link rel="modulepreload" href="/assets/index.esm-*.js">` — ESM 入口
- 还有约 10 个 modulepreload 标签

注意：Cloudflare 需要"学习"一次响应后才能在后续请求中发 103。首次访问不会触发 Early Hints。

## 待优化项

### P0: 高收益

#### 1. 分析并拆分 `dist-BvVkiiYn.js`（156 KB compressed）
- 这是 HTML 直接引用的最大 chunk，会阻塞首次渲染
- 需要分析其内容（可能是 ethers/viem 相关的区块链工具库）
- 如果包含首屏不需要的代码，考虑 lazy import

#### 2. 分析 `call-CvRUywXo.js`（29 KB）
- 名字不像标准 vendor chunk，可能是某个特定功能模块
- 检查是否可以延迟加载

#### 3. `vendor-aave-Bo_zqFd6.js`（194 KB compressed）— 最大 chunk
- 这是 `@aave-dao` 相关代码，当前是运行时动态加载
- 确认是否在首屏就需要，如果不需要可以确保是 lazy import
- 如果首屏需要，考虑拆分 Aave SDK 的子模块

### P1: 中等收益

#### 4. 检查 `vendor-animation`（53 KB）是否首屏需要
- framer-motion 用于动画，如果首屏没有动画可以延迟加载
- 但如果用了 `AnimatePresence` 做页面过渡，可能需要在首屏加载

#### 5. 字体优化
- 当前用 Google Fonts CDN（通过 Cloudflare cf-fonts 加速）
- 考虑自托管字体（放到 `/fonts/` 目录），减少一个外部请求
- 或者用 `font-display: swap` + preload 关键字体 weight（已用了 swap）

#### 6. 检查是否有未使用的 modulepreload
- Vite 会自动为入口 chunk 的依赖添加 modulepreload
- 但有些 chunk 可能不需要在首屏预加载（如 `vendor-icons` 4KB 可能不首屏需要）
- 检查 `vite.config.ts` 的 `build.modulePreload` 配置

### P2: 低收益但简单

#### 7. 开启 Cloudflare Minify
- 当前 `minify: {css: off, html: off, js: off}`
- Vite 已经做了 minify，但 Cloudflare 可以做额外优化（如 HTML minification）
- 在 Cloudflare Dashboard → Speed → Optimization → Auto Minify

#### 8. 开启 Cloudflare `prefetch_preload`
- 当前 `off`
- 会预解析 DNS，对跨域资源（如 Google Fonts）有帮助

#### 9. 检查 `vercel.json` 是否可以添加 `Link` 头
- 可以在 vercel.json 的 headers 里加 `Link` 头来手动指定 Early Hints 资源
- 但 Vite 已经自动注入了 modulepreload，所以可能不需要

#### 10. 考虑 `build.modulePreload.polyfill: false`
- 如果不需要支持旧浏览器（无 modulepreload 支持），可以关掉 polyfill
- 减少少量代码

## 相关文件

- `vite.config.ts` — chunk 策略在第 108-168 行的 `manualChunks` 函数
- `vercel.json` — HTTP headers 配置
- `package.json` — 依赖列表
- Cloudflare Zone ID: `af050e45364ed71fcb2f986f497dd67c`
- Vercel Project ID: `prj_vs0UPjeN0vNdKSZHYWBR1RJgJLzY`

## 验证方法

```bash
# 用 CDP + Playwright 测量 FCP（需要先启动 headless Chrome）
# 详见之前的 scripts/test-speed.mjs（已删除，可重建）

# 或用 Lighthouse
npx lighthouse https://aaveapy.com --view --preset=desktop

# 或用 PageSpeed Insights API
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://aaveapy.com&strategy=mobile&category=performance" | python3 -m json.tool
```

## 注意事项

- 不要开启 `rocket_loader` — 会破坏 SPA
- 不要修改 `manualChunks` 中 React 的分组（React + ReactDOM 必须在一起，否则会 crash）
- 改完后需要重新部署验证（Vercel redeploy + Playwright 测速）
- Cloudflare Early Hints 需要至少一次"热"请求后才会生效（首次访问不发 103）

## 实施记录 (AAV-1279)

### 已完成 (commit `9c4fc66b`)

1. ✅ **AaveProviders lazy 加载** — `App.tsx` 中 `AaveProviders` 改为 `lazy(() => import(...))` + `<Suspense fallback={null}>`。@aave/react + @aave-dao (~218 KB gzip) 不再首屏同步加载。
2. ✅ **vendor-blockchain manualChunk** — viem/wagmi/@rainbow-me/rainbowkit 拆分为独立 `vendor-blockchain` chunk (~420 KB gzip)，与首屏 chunk 分离。
3. ✅ **Selective modulePreload** — `build.modulePreload: false` + `selectiveModulePreloadPlugin` 手动注入白名单 chunk 的 modulepreload。`vendor-blockchain`、`vendor-aave`、`secp256k1` 不再被 preload。
4. ✅ **Architecture-guard 测试** — 7 个新测试覆盖 lazy import 约束和 modulePreload 白名单验证。

### 构建产物对比

| 指标 | 之前 | 之后 |
|------|------|------|
| modulepreload 数量 | 22 | 11 |
| 被 preload 的 gzip 总量 | ~650 KB | ~270 KB |
| vendor-blockchain preload | ✅ 被 preload | ❌ 不 preload |
| vendor-aave preload | ✅ 被 preload | ❌ 不 preload |
| secp256k1 preload | ✅ 被 preload | ❌ 不 preload |

### 待验证

- [ ] 部署到 Vercel 后用 PageSpeed Insights / Lighthouse 测速
- [ ] Cloudflare Dashboard 开启 `prefetch_preload: on` + `minify: { html: on }`
