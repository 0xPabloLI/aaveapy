# 开发方案：AAV-134 [Architecture] V4合约地址传递优化：后端 vs 前端硬编码方案评估

## 1. Issue 概述
针对当前后端 API 返回 V4 reserve 的 Hub/Spoke 合约地址字段，评估是否改为前端硬编码地址并通过 CI 同步的方案。综合考虑数据权威性、维护成本、响应体积、升级灵活性等因素，决定是否调整现有架构。

## 2. 当前状态
- **状态**：Backlog，尚未开始开发
- **现状**：后端 API 已返回完整的 Hub/Spoke 地址字段，前端使用这些字段构建页面和链接。
- **相关脚本**：已有 V3 地址同步脚本 `scripts/sync-pool-addresses-upstream.mjs`，但未覆盖 V4 复杂结构。

## 3. 影响范围
- **后端仓库**：`aave-protocol-analysis`（railway分支）
- **前端仓库**：`aaveapy`（lovable分支）
- **其他**：地址书包 `@bgd-labs/aave-address-book`（第三方依赖）

## 4. 实现方案

### 4.1 维持现状方案（推荐）

#### 4.1.1 目标
保持后端继续返回 Hub/Spoke 地址字段，前端直接使用，保证数据权威性和升级灵活性。

#### 4.1.2 具体步骤
- **后端**
  - 保持 `backend/src/services/marketsApiSerialize.ts` 中序列化逻辑，继续包含 `hubAddress`、`spokeAddress` 字段。
  - 确保从链上 RPC 或合约数据源动态获取最新地址，避免硬编码。
  - 维护现有接口 `/api/markets` 返回完整地址数据。
- **前端**
  - 继续使用后端返回的地址字段，无需依赖 `@bgd-labs/aave-address-book` 中的 V4 地址。
  - `src/lib/poolExplorerLinks.ts` 保持使用 API 中的地址构建链接。
- **同步脚本**
  - 暂不扩展 `scripts/sync-pool-addresses-upstream.mjs`，避免复杂度增加。

#### 4.1.3 变更文件
- 后端：无新增文件，确认和微调 `marketsApiSerialize.ts` 及相关服务。
- 前端：无变更。

### 4.2 未来优化方案（V4稳定后）

#### 4.2.1 目标
减少 API 响应体积，提升前端缓存能力，减少后端负担。

#### 4.2.2 具体步骤
- **后端**
  - 修改 API 返回结构，去除完整地址，只保留 `hubId`、`spokeId` 等短标识符。
- **前端**
  - 维护本地缓存映射表（可存于 IndexedDB 或 localStorage）。
  - 首次访问时调用专门接口获取完整地址映射表，后续使用本地缓存。
  - 扩展或新建同步脚本，定期更新地址书。
- **同步脚本**
  - 扩展 `scripts/sync-pool-addresses-upstream.mjs` 支持 V4 Hub/Spoke/TokenizationSpoke 结构。
  - 集成 CI 流程，确保地址书及时更新。

#### 4.2.3 变更文件（未来）
- 后端：修改 `marketsApiSerialize.ts`、新增地址映射接口。
- 前端：新增缓存逻辑、修改 `poolExplorerLinks.ts`。
- 脚本：扩展同步脚本。

## 5. 依赖关系
- 依赖 V4 合约架构稳定性确认（当前仍在演进阶段）。
- 依赖现有链上数据获取服务稳定。
- 未来方案依赖同步脚本完善及 CI 流程支持。

## 6. 验收标准
- **现状方案**
  - 后端 API `/api/markets` 返回包含 `hubAddress` 和 `spokeAddress` 字段。
  - 前端页面正确显示并使用这些地址构建链接。
  - 地址与链上实际合约地址一致。
- **未来方案（待实施时）**
  - API 返回短标识符，前端能正确从缓存或接口获取完整地址。
  - 地址同步脚本能正确更新地址书，CI 流程验证同步成功。
  - 页面无地址错误，升级流程顺畅。

## 7. 复杂度评估
- **现状方案**：Low  
  仅确认并保持现有实现，无新增复杂逻辑，风险低。
- **未来方案**：Medium  
  需设计缓存机制、同步脚本扩展及 CI 集成，涉及多方协作和版本兼容，复杂度中等。

---

# 总结

鉴于 V4 合约地址仍在频繁变动且后端动态获取地址保证数据权威性，建议当前保持后端提供完整地址字段，避免前端硬编码带来的同步和升级风险。未来待 V4 架构稳定后，再考虑优化方案，减少响应体积并引入前端缓存机制。