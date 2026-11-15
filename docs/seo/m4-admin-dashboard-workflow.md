# M4 — SEO Admin Dashboard 使用说明

> **⛔ 2026-11-15 现状：这套后台当前不可用。** 它的 BFF 所在的 Supabase 项目 `jgxkqnxmcjvowkcckuuo` 已不存在——`jgxkqnxmcjvowkcckuuo.supabase.co` 在公共 DNS 上返回 NXDOMAIN，浏览器访问得到 `ERR_CONNECTION_CLOSED`。结果是 `/admin/seo` 与 `/admin/aave-news-backlinks` 页面还能打开（Vercel 照常服务），但拿到密码后所有请求都会失败。
>
> 两个出路二选一：**重建一个 Supabase 项目**（部署两个函数 + 三个 secret，本文其余部分就是要做的事），或者**整个下线**（页面、路由、`supabase/` 函数目录、Vercel 的 `VITE_SUPABASE_*`、Railway 的 `SEO_*` 一起删）。在拍板之前，本文描述的是它应有的样子。

> 页面由 Vercel 上的前端提供（staging 与 production 同一份代码），BFF 是 Supabase Edge Function，数据源是 Railway 后端。
> 入口不挂导航、不进 sitemap，`robots.txt` 对 `/admin/**` Disallow。

---

## 1. 访问入口

三个环境只差基址，两个页面路径相同：

| 环境 | 基址 |
|---|---|
| dev（本地） | http://localhost:8080（`npm run dev` 或 `npm run dev:staging`） |
| staging | https://staging.aaveapy.com |
| production | https://aaveapy.com |

- `/admin/seo` — GSC / Semrush 数据看板
- `/admin/aave-news-backlinks` — Semrush 外链分析

**登录方式**：两个页面都包在 `SeoDashboardGate` 里，`seo-proxy` 在服务端比对 Supabase secret `SEO_DASHBOARD_PASSWORD`，输对后密码落 sessionStorage 并随每个请求发 `X-Dashboard-Password`。

---

## 2. 端到端链路

```
浏览器 (/admin/seo)
   │  fetch ${VITE_SUPABASE_URL}/functions/v1/seo-proxy/<path>
   │  headers: apikey + Authorization (Supabase anon key，公开) + X-Dashboard-Password
   ▼
Supabase Edge Function: seo-proxy
   │  校验 dashboard 密码
   │  注入 X-Admin-Token: ${SEO_ADMIN_TOKEN}  ← 仅服务端可读
   │  转发到 ${SEO_API_BASE}/seo/<path>
   ▼
Railway 后端 (${SEO_API_BASE}/seo/*)
   │  校验 X-Admin-Token
   │  读/写 Postgres: gsc_daily, semrush_snapshots
   ▼
返回 JSON（裸数组或 {rows,total}，前端 unwrapRows 兼容两种）
```

`/admin/aave-news-backlinks` 走另一条：页面 → Supabase 函数 `aave-news-backlinks` → Semrush `backlinks_pages`（经 Lovable connector gateway，见 §6）。

**关键点：**
- Admin token 只在 Edge Function 侧存在，进不了浏览器 bundle。前端用公开的 anon key 调 Edge Function，Edge Function 才注入真正的 admin token。
- 数据源是 Railway 的 Postgres，Supabase 在这里只承担 Edge Function 运行时。

---

## 3. 当前配置

| 项 | 值 |
|---|---|
| Edge Function | `supabase/functions/seo-proxy/index.ts` |
| `SEO_API_BASE`（Edge Function env） | **未设** → 默认 `https://staging-api.aaveapy.com/api` |
| `SEO_ADMIN_TOKEN`（Supabase secret） | 只在 Supabase 项目里维护，本文不复述；必须与 `SEO_API_BASE` 指向的那个 Railway 环境的同名变量一致 |
| `SEO_DASHBOARD_PASSWORD`（Supabase secret） | 页面登录框校验的密码，`seo-proxy` 每次请求比对 |
| Railway 后端 | 路由 `/api/seo/*`，校验同一个 token |
| 数据 | Semrush 种子 ~33 条已灌库；GSC cron 跑满 ≥ 3 天后有数 |

> `SEO_API_BASE` 未设的后果：**staging 和 production 的前端都读 staging 的数据**。看板上展示的既不是"当前环境"，也不是生产数据，而是 staging 库。

---

## 4. 让 production 看生产数据

1. Supabase Edge Function 环境变量设 `SEO_API_BASE=https://api.aaveapy.com/api`
2. Supabase secret `SEO_ADMIN_TOKEN` 换成 production Railway 的同名值（单一 secret，换完 staging 看板会 401）
3. 后端 `SEO_ALLOWED_ORIGINS` 加 `https://aaveapy.com`
4. 前端不需要重新部署

要同时看两套数据，就得两个函数（或让函数按请求头选 base），单一 secret 做不到。

---

## 5. 排错速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 登录框报 `Incorrect password` | 密码与 Supabase secret `SEO_DASHBOARD_PASSWORD` 不一致 | 清掉 sessionStorage 里的旧值，用正确密码重输 |
| 401 from Railway | `SEO_ADMIN_TOKEN` 与 `SEO_API_BASE` 指向的环境不匹配 | 比对两边同名变量 |
| 503 `SEO_ADMIN_TOKEN not configured` / `SEO_DASHBOARD_PASSWORD not configured` | Edge Function secret 未设 | 在 Supabase 项目里加 secret |
| 看板数据像是旧的 | `SEO_API_BASE` 未设，读的是 staging 库 | 见 §4 |
| GSC tab 空 | cron 未跑满 / 站点无展示 | 等 cron 跑 ≥ 3 天，或手动触发后端 cron |
| Semrush 数值显示 NaN | 后端 numeric 序列化成 string | 已在 `seoApi.ts` 用 `toNum()` 兜底 |
| CORS 报错 | 后端 `SEO_ALLOWED_ORIGINS` 未含当前域名 | 加上 `https://staging.aaveapy.com`、`https://aaveapy.com` 这类精确域名 |
| `Unexpected token '<'` JSON 解析报错 | 本地/Vercel 缺 `VITE_SUPABASE_URL`，请求打到 Vite dev server 返回 HTML | 在 `.env.local`（本地）或 Vercel 环境变量（部署）补上 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY` |

---

## 6. Aave News Backlinks 的取舍

- 前端页面：`src/pages/AdminAaveNewsBacklinks.tsx`（路由 `/admin/aave-news-backlinks`，同样包在 `SeoDashboardGate` 里）
- BFF：`supabase/functions/aave-news-backlinks/index.ts`
- 数据源：Semrush `backlinks_pages`，**经 Lovable connector gateway**（`connector-gateway.lovable.dev`）调用，凭据是该函数的 `LOVABLE_API_KEY` secret

这是仓库里最后一处运行期依赖 Lovable 的地方。站点本身早已不在 Lovable 上跑——`dev`/`main` 的部署都在 Vercel。`aaveapy.lovable.app` 是当年 Publish 出去的旧副本：页面壳还打得开，但它调的 `api.aaveapy.com` 全部被拒，所以那里看不到任何数据（2026-11-15 实测）。

---

## 7. 相关代码

- 前端页面：`src/pages/AdminSeo.tsx`（路由在 `src/App.tsx`）、`src/pages/AdminAaveNewsBacklinks.tsx`
- API 客户端：`src/lib/seoApi.ts`
- React Query hooks：`src/hooks/useSeoData.ts`
- 国家映射：`src/lib/seoCountries.ts`
- BFF：`supabase/functions/seo-proxy/index.ts`、`supabase/functions/aave-news-backlinks/index.ts`
- 后端规格：`docs/seo/m3-railway-backend-spec.md`
- Semrush 种子：`docs/seo/semrush-seed-2026-05-18.json`
