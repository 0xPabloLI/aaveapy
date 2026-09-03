# 本地化落地页标准内容流程（Playbook）

以葡萄牙语页 `src/pages/AaveTaxasApyPT.tsx` 为参照基线，任何新增或重做本地化费率/APY 页面都按本流程执行。日常维护节奏见 `docs/seo/localized-content-calendar.md`。

## 0. 现有页面基线

| 市场 | 路由 | 文件 | 形态 |
| --- | --- | --- | --- |
| pt-BR | `/pt-br/taxas-aave-apy` | `src/pages/AaveTaxasApyPT.tsx` | 手写 JSX（参照基线） |
| fr | `/fr/taux-aave-apy` | `src/pages/AaveTauxApyFR.tsx` | `LocalizedRatesPage` content 对象 |
| de | `/de/aave-zinsen-apy` | `src/pages/AaveZinsenApyDE.tsx` | 同上 |
| es | `/es/tasas-aave-apy` | `src/pages/AaveTasasApyES.tsx` | 同上 |
| id | `/id/apy-aave` | `src/pages/AaveApyID.tsx` | 同上 |

新页面一律走 `src/components/seo/LocalizedRatesPage.tsx`，不再手写 JSX——该组件已内置 canonical、og:locale、`WebPage` + `BreadcrumbList` + `FAQPage` JSON-LD、内链/FAQ/停留时长埋点。

## 1. 关键词矩阵 → 页面选题

1. 从 `docs/seo/keyword-plan.md` 取该市场的长尾词，必要时用 Semrush 校准 volume / KD。
2. 选 1 个主词（页面 title + H1 承载）+ 3–5 个支撑词（H2 承载）+ 6–10 个问题式长尾词（FAQ 承载）。
3. 硬门槛：主词 KD ≤ 45，且必须是本地语言实际搜索形态（不是英文词的直译）。
4. 产出一行矩阵记录并回填到 `keyword-plan.md`：`市场 | 路由 | 主词 | 支撑词 | FAQ 词 | 预计字数`。

## 2. 初稿结构（固定骨架）

对应 `RatesPageContent` 字段，顺序不可调整：

| 区块 | 字段 | 要求 |
| --- | --- | --- |
| Title | `title` | < 60 字符，含主词 |
| Meta description | `description` | < 160 字符，含主词 + 一个支撑词 |
| H1 | `h1` | 与 title 不重复措辞，含主词 |
| Intro | `intro` | 2–3 句，说明页面能解决什么 |
| CTA | `cta` | 指向 `/` 实时看板 |
| 正文章节 | `sections` | 3 个 H2：协议机制 / V3 差异 / 利率构成 |
| 利率驱动因素 | `drivers` | 4 条：池利用率、储备参数、网络与本地流动性、外部激励 |
| 操作步骤 | `howTo` | 4 步，含站内链接 |
| FAQ | `faq` | 8–10 条，全部来自第 1 步的问题式长尾词 |
| 相关链接 | `related` | 3 条站内链接 |

目标长度 1,100–1,600 词（印尼语可下探到 900）。

## 3. 本地化润色（非翻译）

- 用目标语言直接撰写；禁止英文直译腔与机器翻译残留。
- 数值示例本地化：货币（€ / R$ / Rp）、金额量级、当地常用网络与入金路径。
- 至少 2 条市场专属 FAQ：本地税务口径 + 本地监管机构（MiCA/AMF、BaFin、CNMV、Receita Federal、Bappebti/OJK）。
- 税务与监管一律使用非确定性措辞（“通常”“建议咨询专业人士”），不给出确定性法律结论。
- 不编造收益率、评级、担保或统计数据；数值只写区间与量级，不写“当前 X%”。
- 校验：`npm test` 内的 `src/test/no-chinese-visible.test.ts` 会拦截混入的中文。

## 4. 结构化数据与 head

由 `LocalizedRatesPage` 自动生成，只需在 content 对象里填对：

- `path`（不含 origin）、`lang`（html lang）、`ogLocale`（如 `fr_FR`）。
- canonical 固定为 `https://aaveapy.com{path}`。
- `breadcrumb.home` 指向该市场的本地首页或 `/`，`breadcrumb.current` 为页面短标题。
- FAQ 的 `q`/`a` 会同时渲染为可见 `<details>` 与 `FAQPage` JSON-LD —— 两者必须一致，不允许只存在于 JSON-LD。

## 5. 埋点

同样由组件自动完成，无需页面级代码：

- 内链点击 → `trackInternalLink(page, label, to)`（`src/lib/pageAnalytics.ts`）
- FAQ 展开/收起 → `trackFaqToggle(page, question, open)`
- 停留时长 → `useTimeOnPage(page)`（`src/hooks/useTimeOnPage.ts`）
- `page` 参数统一为去掉前导斜杠的路由，例如 `fr/taux-aave-apy`。
- 事件最终经 `src/lib/gtag.ts` 进入 GA4，`AnalyticsRouteTracker` 负责 SPA page view。

## 6. 接线清单

1. 新增 `src/pages/<Name>.tsx`，导出 content 对象并渲染 `LocalizedRatesPage`。
2. 在 `src/App.tsx` 注册路由。
3. 在 `public/sitemap.xml` 增加 URL。
4. 在正文/相关链接里至少建立 2 条站内互链（首页 + 另一本地化页或主题页）。
5. 在 `docs/seo/localized-content-calendar.md` 的覆盖表里登记新页面。

## 7. 上线前验证门槛

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

外加：

- 浏览器打开新路由，确认 title / H1 / FAQ 渲染为目标语言。
- 用 Rich Results 语法检查 JSON-LD（`WebPage`、`BreadcrumbList`、`FAQPage` 三块均存在）。
- 部署后在 GSC 提交 sitemap，并对新 URL 做一次 URL Inspection。

## 8. 交付定义（Definition of Done）

- [ ] 关键词矩阵一行已回填 `keyword-plan.md`
- [ ] 骨架 8 个区块齐全，FAQ ≥ 8 条且含 ≥ 2 条市场专属项
- [ ] 数值示例本地化、监管税务措辞非确定性
- [ ] 路由 + sitemap + 站内互链完成
- [ ] 四项验证门槛全绿，浏览器渲染确认
- [ ] 已登记到内容更新日历
