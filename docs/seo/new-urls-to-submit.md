# 本次 SEO 改动新增的 URL 清单

合并到 main 并经 Vercel 部署上线后，按下方清单到 Google Search Console 提交并验证收录。

## 域名

主域：`https://aaveapy.com`

## 1. 本地化落地页（本次新增）

| 路径 | 语言 | hreflang | 用途 |
|---|---|---|---|
| `/pt-br` | 葡萄牙语（巴西） | `pt-BR` | Brazil 落地页 |
| `/fr` | 法语 | `fr` | France 落地页 |
| `/tr` | 土耳其语 | `tr` | Turkey 落地页 |

完整 URL：
- https://aaveapy.com/pt-br
- https://aaveapy.com/fr
- https://aaveapy.com/tr

## 2. Sitemap

- https://aaveapy.com/sitemap.xml（已更新，包含 3 个新落地页 + xhtml:link hreflang 映射）

## 3. GSC 提交步骤

1. 等 Vercel 部署完成，确认上面 3 个 URL 返回 200 且 `<head>` 里有对应的 `lang` / `hreflang` / 本地化 `<title>`。
2. 打开 Search Console → 左侧 **Sitemaps**，重新提交 `sitemap.xml`（即使路径没变也建议重交以触发重抓）。
3. 左侧 **URL Inspection** 逐个粘贴 3 个本地化 URL → **Request Indexing**。
4. 1–3 天后回到 **Pages** 报告，确认这 3 个 URL 从 "Discovered – currently not indexed" 进入 "Indexed"。
5. 2–4 周后 **Performance → Search results** 按 **Country** + **Page** 维度过滤 `/pt-br` `/fr` `/tr`，观察 BR/FR/TR 三国的 impressions/clicks。

## 4. 不要提交的 URL

- 预览/沙箱域名（`*.lovable.app`、`id-preview--*`）：不要加入 sitemap，不要在 GSC 验证。
- `/admin/*`（如果后续加）：用 `robots.txt` Disallow，并且不进 sitemap。

## 5. 已有但本次未改动的 URL（供参考）

主面板及链路页（已在 sitemap 中）：
- https://aaveapy.com/
- https://aaveapy.com/chain/{ethereum,arbitrum,base,optimism,polygon,avalanche,gnosis,scroll,metis,bnb-chain,linea,zksync,celo,sonic,soneium,ink,mantle}
