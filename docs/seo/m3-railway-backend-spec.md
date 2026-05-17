# M3 — SEO Analytics 后端规格（Railway + Postgres）

> 交付物：在现有 Railway 后端新增 **2 张表 + 1 个每日 cron + 2 个 REST 接口**，为前端 `/admin/seo` Dashboard 提供数据。
> 前端在 Vercel，后端在 Railway，**全部数据落到现有 Postgres**，不引入 Lovable Cloud / Supabase。

---

## 1. 数据模型（Postgres migration）

```sql
-- 1.1 GSC 每日聚合（按 日期 × 国家 × 页面 维度）
CREATE TABLE IF NOT EXISTS gsc_daily (
  id            BIGSERIAL PRIMARY KEY,
  date          DATE         NOT NULL,
  country       TEXT         NOT NULL,        -- ISO-3166-1 alpha-3, e.g. 'bra','fra','tur','usa','deu','ind'
  page          TEXT         NOT NULL,        -- 完整 URL,如 https://aaveapy.com/pt-br
  query         TEXT         NULL,            -- 可选: 关键词维度;若不拉关键词维度则保持 NULL
  clicks        INTEGER      NOT NULL DEFAULT 0,
  impressions   INTEGER      NOT NULL DEFAULT 0,
  ctr           NUMERIC(8,5) NOT NULL DEFAULT 0,
  position      NUMERIC(7,2) NOT NULL DEFAULT 0,
  fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (date, country, page, query)
);
CREATE INDEX idx_gsc_daily_date    ON gsc_daily (date DESC);
CREATE INDEX idx_gsc_daily_country ON gsc_daily (country);
CREATE INDEX idx_gsc_daily_page    ON gsc_daily (page);

-- 1.2 Semrush 手动快照（前端表单录入)
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
CREATE INDEX idx_semrush_country ON semrush_snapshots (country);
CREATE INDEX idx_semrush_date    ON semrush_snapshots (snapshot_date DESC);
```

---

## 2. Google Search Console 接入

### 2.1 凭据准备（一次性）
1. Google Cloud Console → 新建 **Service Account**，下载 JSON key。
2. GSC 属性 → 设置 → 用户与权限 → 把 service account 邮箱加为 **"完整"** 权限用户。
3. 启用 `Google Search Console API`。
4. Railway 环境变量：
   - `GSC_SA_EMAIL`
   - `GSC_SA_PRIVATE_KEY`（保留 `\n`）
   - `GSC_SITE_URL` = `https://aaveapy.com/`（或 `sc-domain:aaveapy.com`）

### 2.2 每日 Cron（06:00 UTC）

每日拉 **昨天** 的数据（GSC 数据有 ~2 天延迟，建议拉 `today-3` 那一天，覆盖率更高）。

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
    dimensions: ['country', 'page'],   // 如需关键词,改成 ['country','page','query']
    rowLimit: 25000,
    dataState: 'final',
  },
});

// rows[i] = { keys: [country, page], clicks, impressions, ctr, position }
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
任选其一：
- **Railway Cron Job**（推荐）：新建一个 service，命令 `node dist/jobs/gsc-daily.js`，schedule `0 6 * * *`。
- **node-cron** 跑在主 API 进程内：简单但单点。
- 失败重试 3 次（指数 backoff），失败写入日志 + 可选 webhook。

---

## 3. REST 接口

挂在现有 API base 下，路径前缀 `/seo/*`。**仅供 admin 使用**——加一个简单 token 网关。

### 3.1 鉴权
- 新增环境变量 `SEO_ADMIN_TOKEN`（随机 32 字节 hex）。
- 中间件：要求请求头 `X-Admin-Token: <token>`，不匹配返回 401。
- 前端通过环境变量 `VITE_SEO_ADMIN_TOKEN` 读，仅在 `/admin/seo` 页面携带。
- 不在 sitemap、加 `robots.txt` Disallow `/admin/`。

### 3.2 `GET /seo/gsc`
查询 GSC 每日聚合数据。

Query 参数：
| 参数      | 类型     | 必填 | 说明 |
|----------|---------|-----|------|
| `from`   | date    | ✅  | YYYY-MM-DD |
| `to`     | date    | ✅  | YYYY-MM-DD |
| `country`| string  | ❌  | 多值用逗号: `bra,fra,tur` |
| `page`   | string  | ❌  | 精确匹配或 `prefix:` 前缀 |
| `groupBy`| string  | ❌  | `date` \| `country` \| `page` \| `date,country`,默认按原始行返回 |

响应：
```json
{
  "rows": [
    {
      "date": "2026-05-14",
      "country": "bra",
      "page": "https://aaveapy.com/pt-br",
      "clicks": 12, "impressions": 340, "ctr": 0.0353, "position": 18.4
    }
  ],
  "total": 1
}
```

SQL 模板：
```sql
SELECT date, country, page,
       SUM(clicks)::int AS clicks,
       SUM(impressions)::int AS impressions,
       AVG(ctr)::numeric(8,5) AS ctr,
       AVG(position)::numeric(7,2) AS position
FROM gsc_daily
WHERE date BETWEEN $from AND $to
  AND ($country IS NULL OR country = ANY($country))
  AND ($page    IS NULL OR page    = $page)
GROUP BY date, country, page
ORDER BY date DESC;
```

### 3.3 `GET /seo/semrush`
查询 Semrush 快照。

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

### 3.4 `POST /seo/semrush`
新增快照。Body 同行结构（不带 `id`、`created_at`）。UPSERT on `(snapshot_date, country, keyword)`。

### 3.5 `DELETE /seo/semrush/:id`
软删或硬删都可。

---

## 4. CORS
允许来源：
```
https://aaveapy.com
https://aaveapy.lovable.app
https://*.lovable.app           # 预览域
http://localhost:5173, :8080    # 本地
```
允许方法 `GET,POST,DELETE,OPTIONS`，允许头 `X-Admin-Token, Content-Type`。

---

## 5. 测试与验收

| 项 | 检查 |
|---|---|
| Migration | `gsc_daily`、`semrush_snapshots` 创建成功,索引齐全 |
| GSC cron | 手动触发一次,前一天/前三天数据落库,行数 > 0 |
| GSC cron 幂等 | 重复跑同一天,行数不增加(UPSERT 生效) |
| `GET /seo/gsc` | 401 (无 token); 200 (有 token); 多 country 过滤生效 |
| `POST/DELETE /seo/semrush` | UPSERT + 删除正常 |
| CORS | 从 `aaveapy.com` `/admin/seo` 能访问,带凭据 |
| 监控 | cron 失败发告警(Sentry / 邮件 / 任意现有渠道) |

---

## 6. 交付清单

请后端同学完成后告知：
1. ✅ 数据库 migration 已上线
2. ✅ cron 已运行 ≥ 1 天,`SELECT count(*), max(date) FROM gsc_daily` 有数据
3. ✅ 4 个接口可访问（curl 示例验过）
4. ✅ 告知我：
   - API base URL（如已有则沿用 `https://api.aaveapy.com/api`，新路径就是 `/api/seo/*`）
   - `SEO_ADMIN_TOKEN` 的值（我配到 Vercel 的 `VITE_SEO_ADMIN_TOKEN`）

我收到这两项后启动 **M4** 前端 Dashboard。

---

## 7. 时间预估
- DB migration + GSC cron：0.5 天
- 4 个接口 + 鉴权 + CORS：0.5 天
- 联调 + 文档：0.5 天
- **合计 ~1.5 人日**
