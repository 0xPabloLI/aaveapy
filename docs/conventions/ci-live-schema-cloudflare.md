# CI 访问 staging API 被 Cloudflare 拦截

GitHub Actions 请求 `https://staging-api.aaveapy.com/api/...` 时，若出现 **403** 且 body 是 **Just a moment...** 的 HTML，说明请求在 Cloudflare 边缘被挑战/拦截，**与前端代码无关**。

下面按「你在控制台里要点哪里」写；**只针对 staging 子域 + `/api/`，不要套到生产**。

---

## 先确认：你开的是哪种「机器人防护」？

| 产品 | 在控制台的大概位置 | 和本问题的关系 |
|------|-------------------|----------------|
| **Bot Fight Mode（BFM，免费档常见）** | `Security` → `Bots` → *Bot Fight Mode* | **不能**用下面「WAF Custom Rule → Skip」跳过 BFM（[官方说明](https://developers.cloudflare.com/bots/troubleshooting/false-positives/)）。可行办法见 **做法 B（IP 放行）** 或关闭/升级机器人方案。 |
| **Super Bot Fight Mode（SBFM）** | `Security` → `Bots` | 可用 **做法 A（WAF Skip）** 对指定路径跳过 SBFM。 |
| **Managed Challenge / JS 挑战** | 可能来自 WAF、Rate limit、Security Level 等 | 做法 A 里可同时勾选跳过 **Managed Rules**（按需）；或降低 **Security Level**（仅 staging，见做法 C）。 |

---

## 做法 A：WAF Custom Rule — 对 staging 的 `/api/*` 跳过 SBFM（推荐，若你已用 SBFM）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → 选择 **aaveapy.com** 这个 Zone（网站）。
2. 左侧进入 **`Security`** → **`WAF`** → **`Custom rules`**（自定义规则）。
3. 点 **`Create rule`**（创建规则）。
4. **Rule name**（规则名称）：例如 `Skip SBFM for staging API only`。
5. **When incoming requests match…**（当请求匹配时）：
   - 点 **Edit expression**（编辑表达式），粘贴：

     ```txt
     (http.host eq "staging-api.aaveapy.com" and starts_with(http.request.uri.path, "/api/"))
     ```

   - 或用规则构建器：Field 选 `Hostname` **equals** `staging-api.aaveapy.com`，再 **And** → `URI Path` **starts with** `/api/`（若界面支持组合）。
6. **Then…**（则）选择 **`Skip`**（跳过）。
7. 在 **Skip 选项**里勾选（以你控制台显示为准，对应 [官方 Skip 选项](https://developers.cloudflare.com/waf/custom-rules/skip/options/)）：
   - **All Super Bot Fight Mode rules**（跳过所有 Super Bot Fight Mode 规则）  
   - 若仍有 JS 挑战，可再勾选 **All managed rules**（会明显减弱 WAF，**仅建议在仍被拦时临时勾选**，确认无后再收窄）。
8. **`Deploy`** / **保存** 部署规则。

说明：规则只对你填的 **主机名 + 路径** 生效；**不会**自动作用到 `api.aaveapy.com` 等其它主机名。

---

## 做法 B：IP Access — 放行 GitHub Actions 出口 IP（BFM / 通用，适合「免费 BFM 无法 Skip」）

GitHub 会公布 Actions 机器使用的 IP 段；对这些 IP 在 **你的 Zone** 里设为 **Allow**，请求匹配时 **Bot Fight Mode 不会再对该请求生效**（[官方说明](https://developers.cloudflare.com/bots/troubleshooting/false-positives/)）。

1. 在终端拉取当前 CIDR 列表（或浏览器打开）：

   ```bash
   curl -sS https://api.github.com/meta | jq -r '.actions[]'
   ```

2. Cloudflare Dashboard → **aaveapy.com** → **`Security`** → **`WAF`** → **`Tools`** → **`IP Access Rules`**（名称可能随界面微调，属「IP 访问规则 / 工具」一类）。
3. **Add** 一条规则：
   - **IP**：填入 **一个** GitHub `actions` CIDR（例如 `4.148.0.0/14` 这种；需把 `meta` 里**每条**分别加，或按你们是否支持批量导入来操作）。
   - **Action**：**Allow**（允许）。
   - **Zone**：当前网站（该 Zone）。
   - **Note**：可写 `GitHub Actions egress`。

缺点：网段会变更，需偶尔更新；更稳妥可写脚本定时同步或改用 **做法 A**。

若只想让 **staging** 受益、不想全局 Allow：Cloudflare 免费档的 IP Access 往往是 **全 Zone** 生效。若必须「仅 staging」，更稳妥仍是 **做法 A（SBFM）** 或 **Cloudflare Access / 专用出口** 等（成本更高）。实际项目里很多团队对 **staging** 全 Zone Allow GitHub IP 也可接受。

### 仓库内置同步脚本

如果你必须保留 **Bot Fight Mode**，可以直接用仓库脚本把 GitHub Actions CIDR 同步到当前 Zone 的 **IP Access Rules**：

```bash
CLOUDFLARE_API_TOKEN=... \
CLOUDFLARE_ZONE_ID=... \
npm run sync:cloudflare-gh-actions-allowlist
```

先 dry-run 看计划；确认后再实际写入：

```bash
CLOUDFLARE_API_TOKEN=... \
CLOUDFLARE_ZONE_ID=... \
npm run sync:cloudflare-gh-actions-allowlist -- --apply
```

说明：
- 脚本会从 `https://api.github.com/meta` 读取最新 `actions` CIDR。
- 仅管理 note 以 `GitHub Actions egress allowlist` 开头的规则，不会碰手工维护的其它 allowlist。
- Cloudflare API token 需要当前 zone 的 **Firewall Access Rules Write** 权限。

---

## 做法 C：仅降低「安全级别」（挑战变少，较粗）

1. **`Security`** → **`Settings`**（或 **`Security`** 总览里的 *Security Level*）。
2. 若存在 **按子域/路径** 的配置（视套餐而定），仅对 **`staging-api.aaveapy.com`** 把 **Security Level** 从 *High* 调到 *Medium* / *Essentially Off*。  
3. 若没有按主机名细分，**不要**把整个 Zone 调成 *Essentially Off*，优先用做法 A 或 B。

---

## 改完后自测

```bash
curl -sS "https://staging-api.aaveapy.com/api/markets" | head -c 120
```

应看到 **JSON**（以 `{` 开头），而不是 `<!DOCTYPE html>`。

---

## 仓库里相关逻辑（无需在 Cloudflare 再配）

- `scripts/probe-live-api.mjs`：CI 先探测 `/markets`；仍被拦则失败并指向本文。
- 契约总览：`api-contract-checklist.md`。

## 推荐替代方案：CI 直接走 Railway 域名

如果 staging 站点必须继续走 Cloudflare 且保留 **Bot Fight Mode**，不要尝试把 GitHub Actions 的几千个出口网段全部塞进 IP Access Rules。更稳的做法是让 **CI 单独走 Railway 原始域名**，避开 Cloudflare。

本仓库的 CI 已支持通过 GitHub Actions 仓库 Secret 覆盖 live schema 的 base URL：

1. GitHub → `Settings` → `Secrets and variables` → `Actions` → `Secrets`
2. 新建 Secret：`LIVE_TEST_API_BASE_CI`
3. 值填你的 Railway staging API 地址，例如：

   ```txt
   https://your-service.up.railway.app/api
   ```

4. 之后 `main` 分支上的 `live-schema-validation` / `live-simulation-validation` job 会优先使用这个 Secret（`secrets.LIVE_TEST_API_BASE_CI`）；未配置时仍回退到 `https://staging-api.aaveapy.com/api`

> **Note**: 此值原为明文 GitHub Variable，已迁移为加密 Secret 以避免 Railway 内部域名暴露在 repo settings 明文中。CI workflow 引用已从 `vars.LIVE_TEST_API_BASE_CI` 改为 `secrets.LIVE_TEST_API_BASE_CI`。
