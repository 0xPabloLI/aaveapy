# 本地化 SEO + Analytics 方案

基于你的选择：**子路径 `/pt-br` `/fr` `/tr`** · **落地页 + 关键 UI i18n** · **Lovable AI 生成文案** · **GSC API + 手工 Semrush 快照**。

---

## 1. 关键词与 FAQ 文案生成（一次性脚本）

用 Lovable AI（Gemini 2.5 Pro）跑 `scripts/gen-locale-content.ts`，按市场生成结构化 JSON：

| 市场 | 主关键词 | 落地页 | FAQ |
|---|---|---|---|
| 🇧🇷 BR (pt-BR) | aave hoje, aave criptomoeda, defi rendimento | ✅ 路由 | ✅ |
| 🇫🇷 FR | cours aave, analyse technique aave, defi rendement | ✅ 路由 | ✅ |
| 🇹🇷 TR | aave coin fiyat, aave yorum, defi getiri | ✅ 路由 | ✅ |
| 🇺🇸 US / 🇩🇪 DE / 🇮🇳 IN | aave price, aave kurs, aave price india | ❌ 仅文档 `docs/seo/keyword-plan.md` | — |

输出落地到 `src/locales/{pt-BR,fr,tr}/landing.json` 与 `faqs.json`，主 App 关键 UI 字符串落到 `src/locales/*/ui.json`（Header / Filter / Sort / Tooltip 标题，约 60 个 key）。

## 2. i18n 框架

- 安装 `react-i18next` + `i18next-browser-languagedetector`
- `src/i18n/index.ts` 初始化，按路由前缀强制 locale（不靠浏览器语言覆盖明确的 URL）
- 默认 `en`（无前缀），`/pt-br` `/fr` `/tr` 切换语言并在 `<html lang>` 标记
- 表格数据（链名/代币）保持英文，符合你「数据本身就是英文」的约束

## 3. 路由与落地页

```
/                Index (en)
/pt-br           LandingPT  (Brazil 落地页 + CTA → /)
/fr              LandingFR
/tr              LandingTR
/chain/:slug     ChainPage  (已有，保持英文)
```

落地页结构（每个市场一致，复用 `LocalizedLanding` 组件）：

```
[Hero] 本地化 H1 + 副标题 + "Open Dashboard" CTA → /
[Live Snapshot] 复用 TopOpportunitiesCarousel（数据英文，标题本地化）
[Why aaveapy] 4 张 feature 卡（本地化）
[FAQ] 6–8 题，输出 FAQPage JSON-LD
[Footer CTA] 跳转主面板
```

## 4. Hreflang + Helmet

- `npm install react-helmet-async`，在 `main.tsx` 包 `<HelmetProvider>`
- **移除** `index.html` 里的 `<link rel="canonical">`（否则会和 Helmet 重复）
- 新建 `src/components/seo/LocaleHead.tsx`：每个页面渲染
  ```
  <link rel="canonical" href=".../{path}">
  <link rel="alternate" hreflang="en"    href=".../">
  <link rel="alternate" hreflang="pt-BR" href=".../pt-br">
  <link rel="alternate" hreflang="fr"    href=".../fr">
  <link rel="alternate" hreflang="tr"    href=".../tr">
  <link rel="alternate" hreflang="x-default" href=".../">
  ```
- 各落地页注入本地化 `<title>` `<meta description>` `og:locale`
- `sitemap.xml` 追加三个新路径，并为每个 URL 加 `xhtml:link` hreflang 标签（生成器小幅扩展）

## 5. Analytics Dashboard（`/admin/seo`）

仅本地查看用，不做身份系统（你是单人开发）。**用 IP 简单 gating 不靠谱**——建议靠**"不在 sitemap + robots disallow + 不公开链接"** 隐藏路径，足够当前阶段。

数据源：
- **GSC API**（已连）：edge function `gsc-search-analytics` 每天拉一次 `searchanalytics/query`，按 `country` + `page` 维度，缓存到 Lovable Cloud 表 `gsc_daily`
- **Semrush 快照**：表 `semrush_snapshots`，UI 提供手动「新增快照」表单（输入市场 / 关键词 / volume / position / date），由我把上次跑的 10 国数据预填一份种子

Dashboard 视图：
1. **地区点击趋势**：折线，按国家分组，30/90 天
2. **本地路由表现**：表格 `/pt-br | /fr | /tr` 的 impressions / clicks / CTR / avg position（来自 GSC）
3. **关键词热度 vs 流量相关性**：左侧 Semrush 关键词 volume，右侧同市场点击量，散点
4. **手动 Semrush 快照管理**：增删改

## 6. 文件改动总览

```
新增  src/i18n/index.ts
新增  src/locales/{en,pt-BR,fr,tr}/{ui,landing,faqs}.json
新增  src/pages/LandingPT.tsx  LandingFR.tsx  LandingTR.tsx
新增  src/components/landing/LocalizedLanding.tsx
新增  src/components/seo/LocaleHead.tsx
新增  src/pages/admin/SeoDashboard.tsx + 子组件
新增  supabase/functions/gsc-search-analytics/index.ts
新增  scripts/gen-locale-content.ts       (一次性)
迁移  index.html (移除 canonical)
改   src/main.tsx (HelmetProvider)
改   src/App.tsx (新路由 + i18n init)
改   public/sitemap.xml (+hreflang)
改   关键 UI 组件用 t() 包字符串（约 10–15 个文件，最小侵入）
DB   表 gsc_daily, semrush_snapshots
```

## 7. 执行顺序与可交付里程碑

1. **M1 — 内容生成**：跑 AI 脚本产出 3 套 locale JSON（你审一遍文案）
2. **M2 — i18n + 落地页 + hreflang**：可见 `/pt-br` `/fr` `/tr`，sitemap 更新
3. **M3 — Analytics 后端**：Cloud 建表 + GSC edge function + 每日 cron
4. **M4 — Dashboard UI**：`/admin/seo` 三视图 + Semrush 录入表单

每个里程碑跑 `npm run lint && npm test && npm run build && npx tsc --noEmit` 全验证。

## 8. 风险与边界

- **Lovable AI 文案质量**：金融/DeFi 术语在 PT-BR/TR 容易翻译失真，落地后建议你扫一遍标题和 FAQ 前两题
- **GSC 数据延迟**：新路由部署后 GSC 通常 2–7 天才有数据，Dashboard 初期会是空的——这是正常的
- **不动业务逻辑**：表格、模拟器、激励计算全部保留英文且不动，符合项目「数据是英文」的约束
- **Vercel 部署**：你需要手动 merge 到 main 才会上线；我会在每个 M 完成后提醒

## 技术细节

- i18n key 命名：`landing.br.hero.title` / `ui.header.search`
- FAQ JSON-LD：`@type: FAQPage`，每个落地页注入
- `og:locale`：`pt_BR` / `fr_FR` / `tr_TR`
- 默认 lang fallback：缺 key 时 fall back 到 en，避免空白
- GSC edge function 用 cron 触发（pg_cron + http extension），每天 06:00 UTC 拉前一日数据
- Dashboard 表使用 RLS：仅 service role 写，所有人读（你的项目约束允许）

确认这个方案就开工，从 M1 开始。
