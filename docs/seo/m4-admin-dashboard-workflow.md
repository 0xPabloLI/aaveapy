# M4 — SEO Admin Dashboard 使用说明

> 适用环境：**staging**（Railway 后端 + Lovable Cloud Edge Function BFF）
> 前端入口：`/admin/seo`（**未挂在导航，未进 sitemap，`robots.txt` 已 Disallow /admin/**）

---

## 1. 访问链接

| 环境 | URL |
|---|---|
| Lovable 预览 | https://id-preview--52846798-e3d8-4735-9a82-ed028b26625d.lovable.app/admin/seo |
| Lovable 发布（staging） | https://aaveapy.lovable.app/admin/seo |
| 本地 dev | http://localhost:8080/admin/seo（或 5173） |

> **没有登录墙**——靠路径不公开 + `robots.txt` Disallow。链接谁拿到谁能看，**不要外发**。

---

## 2. 端到端 Workflow

```
浏览器 (/admin/seo)
   │  fetch ${VITE_SUPABASE_URL}/functions/v1/seo-proxy/<path>
   │  headers: apikey + Authorization (Lovable Cloud anon key, 公开 key)
   ▼
Lovable Cloud Edge Function: seo-proxy
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
- Admin token **永不进浏览器 bundle**。前端用 Lovable Cloud anon key（公开）调 Edge Function，Edge Function 才注入真正的 admin token。
- 数据源：Railway Postgres，不是 Lovable Cloud DB。

---

## 3. 当前 staging 配置

| 项 | 值 |
|---|---|
| Edge Function | `supabase/functions/seo-proxy/index.ts` |
| `SEO_API_BASE`（Edge Function env，可选） | 未设 → 默认 `https://staging-api.aaveapy.com/api` |
| `SEO_ADMIN_TOKEN`（Lovable Cloud secret） | `3f81f96b0f7e7060ac7f6a06010013703270a36afbb022b2d1fabea5f0cec787` |
| Railway 后端 | staging，路由 `/api/seo/*`，token 同上 |
| 数据 | Semrush 种子 ~33 条已灌库；GSC cron 待跑满后有数 |

---

## 4. 切到 prod 的方法（将来）

1. 在 Lovable Cloud Edge Function 加 secret：`SEO_API_BASE=https://api.aaveapy.com/api`
2. 同步 prod Railway 的 `SEO_ADMIN_TOKEN` 到 Lovable Cloud secret（覆盖 staging 值）
3. 重新发布前端（Publish）

---

## 5. 排错速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 401 from Edge Function gateway | 没带 anon key | 前端代码已自动带，检查 `VITE_SUPABASE_PUBLISHABLE_KEY` 是否注入 |
| 401 from Railway | token 不匹配 | 比对 Lovable Cloud `SEO_ADMIN_TOKEN` 与 Railway 同名变量 |
| 503 `SEO_ADMIN_TOKEN not configured` | Edge Function secret 未设 | 用 `secrets--add_secret` 加上 |
| GSC tab 空 | cron 未跑满 / 站点无展示 | 等 cron 跑 ≥ 3 天，或手动触发后端 cron |
| Semrush 数值显示 NaN | 后端 numeric 序列化成 string | 已在 `seoApi.ts` 用 `toNum()` 兜底 |
| CORS 报错 | Railway `SEO_ALLOWED_ORIGINS` 未含当前域名 | 加上 `https://aaveapy.lovable.app` 等精确域名 |
| `Unexpected token '<'` JSON 解析报错 | 本地/Vercel 缺 `VITE_SUPABASE_URL`，请求打到 Vite dev server 返回 HTML | 在 `.env.local`（本地）或 Vercel 环境变量（部署）补上三个 Supabase 变量 |

---

## 6. 相关代码

- 前端页面：`src/pages/AdminSeo.tsx`（在 `src/App.tsx` 注册路由 `/admin/seo`）
- API 客户端：`src/lib/seoApi.ts`
- React Query hooks：`src/hooks/useSeoData.ts`
- 国家映射：`src/lib/seoCountries.ts`
- BFF：`supabase/functions/seo-proxy/index.ts`
- 后端规格：`docs/seo/m3-railway-backend-spec.md`
- Semrush 种子：`docs/seo/semrush-seed-2026-05-18.json`
