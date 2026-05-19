# M3 — SEO Analytics 后端规格（Railway + Postgres）

> 交付物：在现有 Railway 后端新增 **2 张表 + 1 个每日 cron + 5 个 REST 接口**，为前端 `/admin/seo` Dashboard 提供数据。
> 前端在 Vercel，后端在 Railway，**全部数据落到现有 Postgres**，不引入 Lovable Cloud / Supabase。

---

## 1. 数据模型（Postgres migration）

文件：`backend/migrations/008_gsc_daily_semrush_snapshots.sql`

```sql
BEGIN;

-- 1.1 GSC 每日聚合（按 日期 × 国家 × 页面 × 关键词 维度）
CREATE TABLE IF NOT EXISTS gsc_daily (
  id            BIGSERIAL PRIMARY KEY,
  date          DATE         NOT NULL,
  country       TEXT         NOT NULL,        -- ISO-3166-1 alpha-3, e.g. 'bra','fra','tur','usa','deu','ind'
  page          TEXT         NOT NULL,        -- 完整 URL,如 https://aaveapy.com/pt-br
  query         TEXT         NOT NULL DEFAULT '',
  clicks        INTEGER      NOT NULL DEFAULT 0,
  impressions   INTEGER      NOT NULL DEFAULT 0,
  ctr           NUMERIC(8,5) NOT NULL DEFAULT 0,
  position      NUMERIC(7,2) NOT NULL DEFAULT 0,
  fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (date, country, page, query)
);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_date    ON gsc_daily (date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_country ON gsc_daily (country);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_page    ON gsc_daily (page);

-- 1.2 Semrush 种子数据（Lovable 工具一次性拉取 + 批量 POST 灌库）
CREATE TABLE IF NOT EXISTS semrush_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  snapshot_date DATE        NOT NULL,
  country      TEXT         NOT NULL,         -- 'br','fr','tr','us','de','in'
  keyword      TEXT         NOT NULL,
  volume       INTEGER      NULL,
  position     NUMERIC(6,2) NULL,
  cpc_usd      NUMERIC(8,2) NULL,
  difficulty   NUMERIC(5,2) NULL,
  notes        TEXT         NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, country, keyword)
);
CREATE INDEX IF NOT EXISTS idx_semrush_country ON semrush_snapshots (country);
CREATE INDEX IF NOT EXISTS idx_semrush_date    ON semrush_snapshots (snapshot_date DESC);

COMMIT;
```

---

## 2. Google Search Console 接入

### 2.1 凭据准备（一次性）
1. Google Cloud Console → 新建 **Service Account**，下载 JSON key。
2. GSC 属性 → 设置 → 用户与权限 → 把 service account 邮箱加为 **"完整"** 权限用户。
3. 启用 `Google Search Console API`。
4. Railway 环境变量（建议用 Railway Secret，非明文 env）：
   - `GSC_SA_EMAIL`
   - `GSC_SA_PRIVATE_KEY`（保留 `\n`）
   - `GSC_SITE_URL` = `https://aaveapy.com/`（或 `sc-domain:aaveapy.com`）

### 2.2 每日 Cron（06:00 UTC）

每日拉 `today-3` 的数据（GSC 数据有 ~2 天延迟，拉前 3 天覆盖率更高）。

**默认拉关键词维度** `['country', 'page', 'query']`（无关键词的 SEO 数据价值极低）。

伪代码（Node / TS,使用 `googleapis`）：
```ts
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GSC_SA_EMAIL,
  key: process.env.GSC_SA_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});
const webmasters = google.webmasters({ version: 'v3', auth });

const targetDate = dayjs().subtract(3, 'day').format('YYYY-MM-DD');

const res = await webmasters.searchanalytics.query({
  siteUrl: process.env.GSC_SITE_URL!,
  requestBody: {
    startDate: targetDate,
    endDate: targetDate,
    dimensions: ['country', 'page', 'query'],
    rowLimit: 25000,
    dataState: 'final',
  },
});

// rows[i] = { keys: [country, page, query], clicks, impressions, ctr, position }
// UPSERT 到 gsc_daily,冲突时按 fetched_at 覆盖
```

UPSERT：
```sql
INSERT INTO gsc_daily (date, country, page, query, clicks, impressions, ctr, position)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
ON CONFLICT (date, country, page, query)
DO UPDATE SET clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions,
              ctr=EXCLUDED.ctr, position=EXCLUDED.position, fetched_at=now();
```

### 2.3 Cron 触发方式
- **node-cron** 跑在主 API 进程内（与现有架构一致，`updateScheduler.ts` 注册）。
- 失败重试 3 次（指数 backoff），失败写入日志。

---

## 3. REST 接口

挂在现有 API base 下，路径前缀 `/api/seo/*`。**仅供 admin 使用**——加 token 网关。

### 3.1 鉴权
- 新增环境变量 `SEO_ADMIN_TOKEN`（随机 32 字节 hex），**仅存 Railway Secret，不使用 `VITE_` 前缀暴露前端**。
- 中间件：要求请求头 `X-Admin-Token: <token>`，不匹配返回 401；未配置 `SEO_ADMIN_TOKEN` 返回 503。
- **前端 BFF（已实现，M4）**：Lovable Cloud Edge Function `seo-proxy`（`supabase/functions/seo-proxy/index.ts`）作为浏览器与 Railway 之间的代理。Edge Function 从 Lovable Cloud secret 读取 `SEO_ADMIN_TOKEN` 并注入 `X-Admin-Token` 头转发到 `${SEO_API_BASE}/seo/*`（默认 staging-api.aaveapy.com/api，可通过 Edge Function env `SEO_API_BASE` 覆盖到 prod）。Token 永不进入浏览器 bundle。
- 不在 sitemap，已在 `public/robots.txt` 加 `Disallow: /admin/`。

### 3.2 `GET /api/seo/gsc`
查询 GSC 每日聚合数据。

Query 参数：
| 参数      | 类型     | 必填 | 说明 |
|----------|---------|-----|------|
| `from`   | date    | ✅  | YYYY-MM-DD |
| `to`     | date    | ✅  | YYYY-MM-DD |
| `country`| string  | ❌  | 多值用逗号: `bra,fra,tur`（上限 20） |
| `page`   | string  | ❌  | 精确匹配 |
| `groupBy`| string  | ❌  | `date` \| `country` \| `page` \| `query` 或逗号组合，默认按原始行返回 |

**参数校验：**
- `from` / `to` 必须为 `YYYY-MM-DD` 格式，`from <= to`，否则 400。
- `groupBy` 值仅允许白名单 `['date','country','page','query']`，非法值被忽略（防 SQL 注入）。

响应：
```json
{
  "rows": [
    {
      "date": "2026-05-14",
      "country": "bra",
      "page": "https://aaveapy.com/pt-br",
      "query": "aave hoje",
      "clicks": 12, "impressions": 340, "ctr": 0.0353, "position": 18.4
    }
  ],
  "total": 1
}
```

错误响应格式：
```json
{ "error": "描述信息", "details": "可选详情" }
```

### 3.3 `GET /api/seo/semrush`
查询 Semrush 种子数据。

Query：`country` (可选, 逗号分隔), `from`, `to` (可选), `keyword` (可选, ILIKE)。

响应：
```json
{
  "rows": [
    {
      "id": 12, "snapshot_date": "2026-05-10", "country": "br",
      "keyword": "aave hoje", "volume": 8100, "position": 14.2,
      "cpc_usd": 0.42, "difficulty": 38.0, "notes": null
    }
  ]
}
```

### 3.4 `POST /api/seo/semrush`
单条新增/修正。Body 同行结构（不带 `id`、`created_at`）。UPSERT on `(snapshot_date, country, keyword)`。

### 3.5 `POST /api/seo/semrush/batch`
**批量灌库（Lovable 种子用）。**

Body：
```json
{
  "snapshots": [
    { "snapshot_date": "2026-05-10", "country": "br", "keyword": "aave hoje", "volume": 8100, "position": 14.2, "cpc_usd": 0.42, "difficulty": 38.0 },
    { "snapshot_date": "2026-05-10", "country": "fr", "keyword": "aave rendement", "volume": 5200, "position": 22.1, "cpc_usd": 0.35, "difficulty": 45.0 }
  ]
}
```

- 上限 5000 条/次。
- 逐条 UPSERT，返回 `{ upserted, total, errors? }`。
- 幂等：重复 POST 同样数据不增加行数。

### 3.6 `DELETE /api/seo/semrush/:id`
硬删。返回 `{ deleted: true, id }` 或 404。

---

## 4. Semrush 数据流（Lovable 种子模式）

```
Lovable semrush--keyword_research 工具
  → 拉 BR/FR/TR/US/DE/IN 核心词（$0，走 Lovable quota）
  → 生成 JSON
  → POST /api/seo/semrush/batch 一次性灌库
  → 前端 Dashboard 读取展示
```

种子数据是一次性基准。如需刷新（季度更新），重新跑工具 + 重新 batch POST（UPSERT 幂等）。

---

## 5. CORS

复用现有 `FRONTEND_URL` + `ALLOWED_DEV_ORIGINS` 机制，新增 `SEO_ALLOWED_ORIGINS` 环境变量扩展精确域名白名单。

**禁止子域名通配**（`*.lovable.app` 不可接受——攻击者可创建 `evil.lovable.app` 绕过）。

`SEO_ALLOWED_ORIGINS` 示例值：
```
https://aaveapy.lovable.app,https://staging.aaveapy.com
```

| 环境 | 域名 | 来源 |
|---|---|---|
| production | `https://aaveapy.com` | 已在 `FRONTEND_URL`，自动覆盖 |
| staging | `https://staging.aaveapy.com` | `SEO_ALLOWED_ORIGINS` |
| lovable preview | `https://aaveapy.lovable.app` | `SEO_ALLOWED_ORIGINS`（精确匹配） |
| local dev | `http://localhost:5173`, `http://localhost:8080` | `ALLOWED_DEV_ORIGINS` |

允许方法 `GET,POST,DELETE,OPTIONS`，允许头 `X-Admin-Token, Content-Type, Authorization`。

---

## 6. 测试与验收

| 项 | 检查 |
|---|---|
| Migration | `gsc_daily`、`semrush_snapshots` 创建成功,索引齐全 |
| GSC cron | 手动触发一次,前三天数据落库,行数 > 0 |
| GSC cron 幂等 | 重复跑同一天,行数不增加(UPSERT 生效) |
| GSC cron 错误 | API 返回 429/503 时重试 3 次后 warn，不崩溃 |
| `GET /api/seo/gsc` | 401 (无 token); 400 (缺 from/to / 非法日期 / from>to); 200 (有 token) |
| `GET /api/seo/gsc` | groupBy 非法值被忽略; 多 country 过滤生效 |
| `POST /api/seo/semrush` | UPSERT 正常 |
| `POST /api/seo/semrush/batch` | 批量灌库; 空/超限返回 400; 部分失败仍返回 upserted 数 |
| `DELETE /api/seo/semrush/:id` | 删除正常; 非法 id 返回 400; 不存在返回 404 |
| CORS | 从 `aaveapy.com` `/admin/seo` 能访问; `*.lovable.app` 子域被拒绝 |
| 监控 | cron 失败发告警(Sentry / 邮件 / 任意现有渠道) |

---

## 6. Semrush 数据来源与种子数据

**不需要付费 Semrush 订阅。** `semrush_snapshots` 表通过以下方式喂数据：

1. **Lovable 内置 Semrush 工具**（`keyword_compare`）由 Lovable agent 跑,产出 seed JSON。
2. **刷新节奏**：季度一次,或在某地区流量明显变化时按需重跑。
3. **手动补录**：如需临时补一个关键词,可直接调 `POST /seo/semrush`。

### 6.1 种子文件
首批种子已生成: [`docs/seo/semrush-seed-2026-05-18.json`](./semrush-seed-2026-05-18.json)
覆盖 6 个国家(br/fr/tr/us/de/in)、~33 个关键词,字段对齐 `semrush_snapshots` schema。
`position` 字段统一留空——首次种子只关心市场需求(volume/difficulty/cpc),实际排名由 GSC cron 跑够 ≥7 天后再回填,或前端 Dashboard 直接展示「尚未排名」。

### 6.2 灌库命令
后端 migration 上线 + `SEO_ADMIN_TOKEN` 配好后,一条命令灌完整批:

```bash
# 假设 API base 是 https://api.aaveapy.com/api
TOKEN="<SEO_ADMIN_TOKEN>"
BASE="https://api.aaveapy.com/api"

jq -c '.rows[]' docs/seo/semrush-seed-2026-05-18.json | while read -r row; do
  curl -sS -X POST "$BASE/seo/semrush" \
    -H "X-Admin-Token: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$row" | jq -r '.id // .error'
done
```

`POST /seo/semrush` 的 `ON CONFLICT (snapshot_date, country, keyword) DO UPDATE` 保证幂等,重复跑无副作用。

---

## 7. 交付清单

请后端同学完成后告知：
1. ✅ 数据库 migration 已上线
2. ✅ cron 已运行 ≥ 1 天,`SELECT count(*), max(date) FROM gsc_daily` 有数据
3. ✅ 5 个接口可访问（curl 示例验过）
4. ✅ Semrush seed 已灌库(`SELECT count(*) FROM semrush_snapshots` 应 ≈ 33)
5. ✅ 告知我：
   - API base URL（如已有则沿用 `https://api.aaveapy.com/api`，新路径就是 `/api/seo/*`）
   - `SEO_ADMIN_TOKEN` 的值（通过安全渠道传递，**不使用 VITE_ 前缀**）

我收到这两项后启动 **M4** 前端 Dashboard。

---

## 8. 环境变量清单

| 变量 | 位置 | 说明 |
|---|---|---|
| `SEO_ADMIN_TOKEN` | Railway (secret) | Admin 鉴权 token，**不暴露前端** |
| `SEO_ALLOWED_ORIGINS` | Railway | SEO Dashboard 额外 CORS 白名单，逗号分隔精确域名 |
| `GSC_SA_EMAIL` | Railway | Google Service Account email |
| `GSC_SA_PRIVATE_KEY` | Railway (secret) | Google SA RSA 私钥 |
| `GSC_SITE_URL` | Railway | GSC 属性 URL，如 `https://aaveapy.com/` |

---

## 9. 回滚方案

| 步骤 | 操作 |
|---|---|
| 1 | 移除 `server.ts` 中 `/api/seo` 路由挂载 |
| 2 | 移除 `updateScheduler.ts` 中 GSC cron 注册 |
| 3 | `DROP TABLE IF EXISTS gsc_daily, semrush_snapshots;` |
| 4 | 移除 `SEO_ADMIN_TOKEN`, `SEO_ALLOWED_ORIGINS`, `GSC_*` 环境变量 |
| 5 | `npm uninstall googleapis dayjs` |

---

## 10. 架构决策记录

| 决策 | 原因 |
|---|---|
| SEO 接口直查 DB（突破 0-SELECT 原则） | SEO 数据量小（< 25k rows/day）、QPS 极低（admin only）、实时性要求低，连接池 max=5 足够 |
| GSC 默认拉 query 维度 | 无关键词的 SEO 数据对运营无价值 |
| Semrush 用种子模式而非手动录入 | 无人力持续维护；Lovable 工具一次性拉取 + batch POST，$0 |
| 不用 `VITE_SEO_ADMIN_TOKEN` | Vite 环境变量打包进前端 bundle，token 对浏览器可见 |
| 禁止 `*.lovable.app` CORS 通配 | 子域名绕过攻击风险 |

---

## 11. 时间预估
- DB migration + GSC cron：0.5 天
- 5 个接口 + 鉴权 + CORS：0.5 天
- Semrush seed 灌库 + 联调：0.5 天
- **合计 ~1.5 人日**
