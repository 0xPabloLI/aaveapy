# AAV-81 开发方案：加入 Reward Token 显示（主要是图标）

## 1. Issue 概述
在前端界面中为奖励（reward）Token 增加图标显示，提升用户体验和界面美观度。图标资源主要来源于 Merkl 数据接口。

## 2. 当前状态
未开始。当前代码中尚无 reward token 图标显示相关实现，只有部分 reward token 数据字段，图标资源需要整合。

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支
- 可能涉及后端仓库：aave-protocol-analysis / railway 分支（确认 reward token 图标 URL 是否已由后端提供）

## 4. 实现方案

### 4.1 后端确认（如需）
- **文件**：`backend/src/services/marketsApiSerialize.ts`、`backend/src/services/merklForecastService.ts`
- **内容**：
  - 确认后端接口 `/api/markets` 或相关接口中是否包含 reward token 的图标 URL 字段（例如 `rewardTokenIcon`）。
  - 若无，需在后端整合 Merkl API 返回的 reward token 图标 URL，序列化到 API 响应中。

### 4.2 前端实现

#### 4.2.1 数据接口调整
- **文件**：`src/types/aave.ts`
- **内容**：
  - 在 Reward Token 相关类型中新增 `iconUrl` 字段（或类似字段），与后端接口字段保持一致。

#### 4.2.2 UI 组件修改
- **文件**：
  - `src/components/dashboard/ReservesTable/`（如奖励 Token 在此展示）
  - 可能涉及 `TopOpportunities` 或其他显示奖励 Token 的组件
- **内容**：
  - 在奖励 Token 显示区域，增加 `<img>` 标签用于展示图标，图标地址使用 `iconUrl`。
  - 设计图标大小、圆角、占位图（fallback）等样式，保证界面美观且无图标时不影响布局。

#### 4.2.3 图标资源管理
- **文件**：`src/lib/tokenIcons.ts` 或新建 `rewardTokenIcons.ts`
- **内容**：
  - 维护一个 reward token 图标的本地映射（备选方案），用于图标缺失时的兜底。
  - 优先使用后端传来的图标 URL，若无则使用本地映射。

#### 4.2.4 代码测试
- 编写单元测试覆盖图标显示逻辑（可选）
- 手动测试不同 reward token 的图标显示效果

## 5. 依赖关系
- 依赖后端是否已支持 reward token 图标 URL 字段（若无需后端支持则无依赖）
- 依赖 Merkl API 提供的图标资源稳定性

## 6. 验收标准
- 前端界面中所有奖励 Token 均显示对应图标
- 图标显示尺寸和样式符合设计规范
- 图标加载失败时显示占位图或不影响布局
- 相关接口返回包含 reward token 图标 URL 字段（如后端参与）
- 代码通过现有单元测试，且无明显性能影响

## 7. 复杂度评估
**Medium**  
理由：涉及前后端接口确认与调整，前端多组件修改及样式设计，需保证图标加载稳定和界面兼容性。若后端未支持则需额外开发工作。