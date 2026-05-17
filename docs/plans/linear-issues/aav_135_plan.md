# 开发方案 - AAV-135 [Docs] V4 SDK Embedded Rewards - Intentionally Skipped

## 1. Issue 概述
本 Issue 旨在完善和补充关于 Aave V4 SDK 中 Embedded Rewards（嵌入式奖励）被故意跳过的文档说明。该奖励类型不在后端 API 输出中展示，也未在公共 Merkl API 和 Aave Pro UI 中出现，属于内部激励机制。需要在项目文档中明确说明这一点，避免误导开发者和用户。

## 2. 当前状态
- 状态：Backlog（未开始）
- 代码层面：V4 SDK Embedded Rewards 已被后端故意排除，相关逻辑已实现跳过
- 文档层面：已有简要描述，但缺乏系统完整的官方文档说明

## 3. 影响范围
- 仓库：主要影响后端仓库 `aave-protocol-analysis/railway` 的文档部分
- 也涉及前端仓库 `aaveapy/lovable` 的文档展示和说明（如有相关文档同步）

## 4. 实现方案

### 4.1 创建/修改文件
- 在后端仓库 `aave-protocol-analysis` 的文档目录（如 `docs/` 或 `docs/backend/`）新增或完善文档文件，例如：
  - `docs/backend/v4-embedded-rewards.md`（专门说明 V4 Embedded Rewards 跳过原因）
- 如有公共文档库（如 `aaveapy-doc`），同步更新相关文档章节，确保前后端文档一致

### 4.2 关键文档内容
- 详细描述 V4 SDK Embedded Rewards 的定义和表现形式
- 说明该奖励只包含 `MerklSupplyReward` 和 `MerklBorrowReward` 两种类型
- 说明该奖励的 payout token 为 `aglaMerklUSD`，且该 token 不存在于公共 Merkl API
- 说明该奖励未在 Aave Pro UI 展示，属于内部激励机制
- 说明跳过该奖励的三大理由：
  1. 无法验证真实性（缺少公共数据支持）
  2. 可能误导用户（如在不可供给的 spoke 上显示高额奖励）
  3. 避免与真实 Merkl 奖励重复计入
- 附上示例表格（Issue 中已有）展示观察到的奖励数据快照
- 说明未来若有变更，文档会同步更新

### 4.3 数据流及代码变更说明（文档中）
- 说明后端在数据聚合阶段如何过滤或跳过该奖励
- 说明前端如何基于后端数据不展示该奖励
- 说明与 Merkl API 的区别及独立性

### 4.4 版本和时间节点
- 说明从 2026-04-21 起故意跳过该奖励
- 说明该策略的背景和维护原则

### 4.5 文档格式和规范
- 使用 Markdown 格式，符合项目文档规范
- 适当添加链接指向相关代码实现（如后端过滤逻辑）
- 保持语言简洁明了，方便开发者快速理解

## 5. 依赖关系
- 无直接依赖其他未完成 Issue
- 但建议与 AAV-134（V4 docs/architecture）同步协调，确保文档整体一致性

## 6. 验收标准
- 新增或更新的文档文件已提交至代码仓库并通过 Review
- 文档内容完整覆盖 Issue 描述的所有关键点
- 文档中包含示例数据表和跳过理由说明
- 前后端团队确认文档准确无误
- 文档在项目官网或内部文档系统可访问

## 7. 复杂度评估
- 复杂度：Low
- 理由：仅涉及文档编写和补充，无代码逻辑变更，风险低，工作量较小

---

# 备注
本 Issue 主要为文档完善工作，确保团队和用户理解为何 V4 SDK Embedded Rewards 被跳过，避免误解和错误使用。建议文档完成后，安排一次内部分享或同步，提升团队认知一致性。