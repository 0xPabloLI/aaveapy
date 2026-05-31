# SEO Post-Deploy Indexing Checklist

每次新增 SEO 落地页、合并到 main 并被 Vercel 部署上线后，照此清单执行。

## 本轮新增（2026-05-31）

7 个新页面，全部在 `public/sitemap.xml` 中：

**🔥 高优先（目标高流量关键词）**
- [ ] https://aaveapy.com/usa-stablecoin-apy — `usa stable coin apy` (2,400/mo)
- [ ] https://aaveapy.com/asset/usdc — `aave usdc apy`
- [ ] https://aaveapy.com/asset/usdt — `aave usdt apy`
- [ ] https://aaveapy.com/asset/eth — `aave eth apy`

**🟡 中优先**
- [ ] https://aaveapy.com/asset/wbtc
- [ ] https://aaveapy.com/asset/dai
- [ ] https://aaveapy.com/asset/gho

---

## 部署后执行步骤

### Step 0 — 前置校验（部署完成后立即做）

- [ ] Vercel 部署成功，上面 7 个 URL 全部返回 **HTTP 200**
- [ ] 每个 URL 的 `<head>` 含独立 `<title>` 和 `<meta name="description">`（用 curl 或浏览器查看源代码确认）
- [ ] sitemap 可访问：https://aaveapy.com/sitemap.xml

### Step 1 — 重交 sitemap（1 分钟）

1. 打开 [Google Search Console](https://search.google.com/search-console) → 选择 `aaveapy.com`
2. 左侧菜单 **Sitemaps**
3. 输入 `sitemap.xml` → **Submit**（即使之前已交也要重交，触发重抓）

### Step 2 — 逐个 URL Request Indexing（每个约 1-2 分钟）

GSC 左侧 **URL Inspection** → 粘贴 URL → 等检查完成 → 点 **Request Indexing**

按上面优先级顺序做，GSC 每天大约有 10-20 次配额，7 个 URL 一天能做完。

### Step 3 — 7-14 天后验收

- [ ] GSC → **Pages** 报告，确认 7 个 URL 从 *Discovered – currently not indexed* 进入 *Indexed*
- [ ] GSC → **Performance → Search results** 按 Page 维度过滤，看 impressions/clicks

---

## 为什么 sitemap 不够，还要手动 Request Indexing？

| | Sitemap | Request Indexing |
|---|---|---|
| 作用 | 告诉 Google "我有这些页" | 把单个 URL 插入爬虫**优先队列** |
| 时效 | 几天~几周 | 几小时~几天 |
| 数量 | 无限 | 每天约 10-20 次配额 |
| 适用 | 已收录站点的增量发现 | 新站、低权重域名、关键新页 |

aaveapy.com 当前外链 ~17 个，域名权重低，Google 默认爬 sitemap 的优先级很低。Request Indexing = "插队"。等外链涨到 100+ 后，新页通常几小时自动收录，可省略此步。

## 为什么不用 Google Indexing API 自动化？

- 官方明确 [Indexing API 只支持 `JobPosting` 和 `BroadcastEvent`](https://developers.google.com/search/apis/indexing-api/v3/quickstart) 两类内容
- 普通页面用了 Google 不保证响应，且有风控滥用判定的风险
- Search Console URL Inspection **API 只能查状态，无法触发收录**
- 业界标准做法：sitemap（自动）+ 关键页手动 inspect

**可自动化的部分**：写脚本调 GSC API 每日监控这 7 个 URL 的 indexed 状态，但触发收录仍需手动。

---

## 复用：未来新增 SEO 页的流程

1. 在 `src/lib/seoAssets.ts` 或 `src/lib/seoChains.ts` 添加配置
2. 更新 `public/sitemap.xml` 和 `public/llms.txt`
3. 部署后回到本文档，把新 URL 加到顶部清单
4. 重复 Step 1 ~ Step 3
