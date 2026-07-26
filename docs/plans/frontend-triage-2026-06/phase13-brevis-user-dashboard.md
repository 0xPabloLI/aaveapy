# Phase 13: Brevis Per-User API 接入 — Dashboard + Claim

> Issue: AAV-843 (Ready for agent)
> 估计: 2-3 sessions
> Branch: `feat/aav-843-brevis-dashboard`
> Linear 状态: Ready for agent

## 代码审查状态（2026-07-21）

### 已有 Brevis 相关代码

- `src/lib/brevisForecast.ts` — Brevis incentive forecast（aggregate 级别）
- `src/lib/rateSimulationCalculator.ts` — `buildBrevisCampaignDetails` 已实现，支持 wallet 参数
- Brevis campaign 信息已在 `/markets` API 的 `campaigns` 字段中返回

### 未实现

- **Per-user API 调用** — 前端无 Brevis per-user API 调用代码
  - `POST /v1/getMerkleProofsBatch` — 获取 Merkle proof + claimable rewards
  - `POST /v1/getUserRewardsBatch` — 获取奖励余额
- **Brevis Dashboard 组件** — 无已 claim / 未 claim / 总计 UI
- **Per-campaign breakdown** — 无 per-campaign 详情展示
- **Claim 按钮** — 无 claim 交易构建代码
- **与 Portfolio simulation 打通** — forecast 与实际 claimable 未关联

## 可用端点

### 1. `POST /v1/getMerkleProofsBatch`

- **端点**：`POST https://incentra-prd.brevis.network/v1/getMerkleProofsBatch`
- **请求**：`{ user_addr, campaign_id, chain_id, status }`
- **响应**：`claimContractAddr`, `claimChainId`, `cumulativeRewards`, `claimableRewards`, `merkleProof`

### 2. `POST /v1/getUserRewardsBatch`

- **端点**：`POST https://incentra-prd.brevis.network/v1/getUserRewardsBatch`
- **请求**：同上
- **响应**：`cumulative`, `claimable`, `campaignId`, `claimChainId`

### 3. `GET /sdk/v1/userRewards?campaign_id=X`

- 导出全量用户奖励 CSV（Leaderboard 用）

## 改动方向

1. 新建 `src/lib/brevisUserApi.ts` — per-user API 调用封装
2. Brevis Dashboard 组件（已 claim / 未 claim / 总计）
3. Per-campaign breakdown 展示
4. Claim 按钮 — 前端构建 claim 交易（需 wagmi signer）
5. 与 Portfolio simulation 的 Brevis forecast 打通

## Grill 要点

- Brevis per-user API 的序列化问题（protobuf vs JSON）
- Claim 功能：前端直接调合约 vs 后端代理？
  - ClaimAll 合约地址（Linea）：`0x39ae8501186E8F4d7b120981DDaD5db8915A6371`
  - claim 函数：`claim(address earner, uint256[] calldata cumulativeAmounts, uint64 epoch, bytes32[] calldata proof)`
- Dashboard 位置：独立页面 vs 嵌入 PortfolioPanel？
- 依赖 AAV-842（Brevis 后端 `distributedSoFarUsd`）
