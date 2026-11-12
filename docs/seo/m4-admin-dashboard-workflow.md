# M4 — SEO Admin Dashboard 使用说明

> 适用环境：staging 与 production。页面由 Vercel 上的前端提供，BFF 是 Supabase Edge Function。
> 入口：`/admin/seo`（未挂导航，未进 sitemap，`robots.txt` 已 Disallow `/admin/**`）

---

## 1. 访问链接

| 环境 | URL | 说明 |
|---|---|---|
| dev（本地） | http://localhost:8080/admin/seo | `npm run dev` 或 `npm run dev:staging` |
| staging | https://staging.aaveapy.com/admin/seo | Vercel 上 `dev` 分支的部署 |
| production | https://aaveapy.com/admin/seo | Vercel 上 `main` 分支的部署 |

### 1.1 Aave News Backlinks（Semrush 外链分析）

| 环境 | URL | 说明 |
|---|---|---|
| dev（本地） | http://localhost:8080/admin/aave-news-backlinks | `npm run dev` 或 `npm run dev:staging` |
| staging | https://staging.aaveapy.com/admin/aave-news-backlinks | Vercel 上 `dev` 分支的部署 |
| production | https://aaveapy.com/admin/aave-news-backlinks | Vercel 上 `main` 分支的部署 |

> **登录方式**：两个页面都包在 `SeoDashboardGate` 里，密码由 `seo-proxy` 在服务端比对 Supabase secret `SEO_DASHBOARD_PASSWORD`，输对后才落 sessionStorage 并随每个请求发 `X-Dashboard-Password`。没有密码只能看到登录框。路径同时不挂导航、不进 sitemap，`robots.txt` 对 `/admin/**` Disallow。

---

## 2. 端到端 Workflow

```
浏览器 (/admin/seo)
   │  fetch ${VITE_SUPABASE_URL}/functions/v1/seo-proxy/<path>
   │  headers: apikey + Authorization (Supabase anon key，公开 key)
   ▼
Supabase Edge Function: seo-proxy
   │  注入 X-Admin-Token: ${SEO_ADMIN_TOKEN}  ← 仅服务端可读
   │  转发到 ${SEO_API_BASE}/seo/<path>
   ▼
Railway 后端 (staging-api.aaveapy.com/api/seo/*)
   │  校验 X-Admin-Token
   │  读/写 Postgres: gsc_daily, semrush_snapshots
   ▼
返回 JSON（裸数组或 {rows,total}，前端 unwrapRows 兼容两种）
```

**关键点：**
- Admin token 只在 Edge Function 侧存在，进不了浏览器 bundle。前端用公开的 anon key 调 Edge Function，Edge Function 才注入真正的 admin token。
- 数据源是 Railway 的 Postgres，不是 Supabase 的数据库。Supabase 在这里只承担 Edge Function 运行时。

---

## 3. 当前 staging 配置

| 项 | 值 |
|---|---|
| Edge Function | `supabase/functions/seo-proxy/index.ts` |
| `SEO_API_BASE`（Edge Function env，可选） | 未设 → 默认 `https://staging-api.aaveapy.com/api` |
| `SEO_ADMIN_TOKEN`（Supabase secret） | 值只在 Supabase 项目里维护，本文不复述；与 Railway 同名变量必须一致 |
| `SEO_DASHBOARD_PASSWORD`（Supabase secret） | 页面登录框校验的密码；`seo-proxy` 每次请求比对 |
| Railway 后端 | staging，路由 `/api/seo/*`，校验同一个 token |
| 数据 | Semrush 种子 ~33 条已灌库；GSC cron 跑满 ≥ 3 天后有数 |

---

## 4. 切到 production 的方法

1. 在 Supabase Edge Function 环境变量里设 `SEO_API_BASE=https://api.aaveapy.com/api`
2. 把 production Railway 的 `SEO_ADMIN_TOKEN` 写进 Supabase secret（覆盖 staging 值）
3. 后端 `SEO_ALLOWED_ORIGINS` 加上 `https://aaveapy.com`
4. 前端不需要重新部署，页面读的就是同一套 Supabase 变量

---

## 5. 排错速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 401 from Edge Function gateway | 没带 anon key | 前端代码已自动带，检查 `VITE_SUPABASE_PUBLISHABLE_KEY` 是否注入 |
| 登录框报 `Incorrect password` | 密码与 Supabase secret `SEO_DASHBOARD_PASSWORD` 不一致 | 清掉 sessionStorage 里的旧值，用正确密码重输 |
| 401 from Railway | token 不匹配 | 比对 Supabase secret `SEO_ADMIN_TOKEN` 与 Railway 同名变量 |
| 503 `SEO_ADMIN_TOKEN not configured` | Edge Function secret 未设 | 在 Supabase 项目里加 secret |
| GSC tab 空 | cron 未跑满 / 站点无展示 | 等 cron 跑 ≥ 3 天，或手动触发后端 cron |
| Semrush 数值显示 NaN | 后端 numeric 序列化成 string | 已在 `seoApi.ts` 用 `toNum()` 兜底 |
| CORS 报错 | 后端 `SEO_ALLOWED_ORIGINS` 未含当前域名 | 加上 `https://staging.aaveapy.com`、`https://aaveapy.com` 这类精确域名 |
| `Unexpected token '<'` JSON 解析报错 | 本地/Vercel 缺 `VITE_SUPABASE_URL`，请求打到 Vite dev server 返回 HTML | 在 `.env.local`（本地）或 Vercel 环境变量（部署）补上 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY` |

---

## 6. 相关代码

- 前端页面：`src/pages/AdminSeo.tsx`（在 `src/App.tsx` 注册路由 `/admin/seo`）
- API 客户端：`src/lib/seoApi.ts`
- React Query hooks：`src/hooks/useSeoData.ts`
- 国家映射：`src/lib/seoCountries.ts`
- BFF：`supabase/functions/seo-proxy/index.ts`
- 后端规格：`docs/seo/m3-railway-backend-spec.md`
- Semrush 种子：`docs/seo/semrush-seed-2026-05-18.json`

## 7. Aave News Backlinks 相关代码

- 前端页面：`src/pages/AdminAaveNewsBacklinks.tsx`（在 `src/App.tsx` 注册路由 `/admin/aave-news-backlinks`）
- BFF Edge Function：`supabase/functions/aave-news-backlinks/index.ts`
- 数据源：Semrush API（`backlinks_pages` endpoint），经 Lovable connector gateway（`connector-gateway.lovable.dev`）调用，凭据是 Edge Function 的 `LOVABLE_API_KEY` secret

> 这是仓库里最后一处运行期依赖 Lovable 的地方：Lovable 项目仍在（`aaveapy.lovable.app` 仍返回 200），网关也还在用它。删掉这个页面 + Edge Function 之前先确认不再需要 Semrush 外链数据，否则整条外链分析链路一起消失。
