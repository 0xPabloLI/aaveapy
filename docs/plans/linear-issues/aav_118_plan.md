# 开发方案 - AAV-118 [Enhancement] 添加环境配置校验

## 1. Issue 概述
当前前端代码 `src/lib/apiBase.ts` 中硬编码了 staging API URL，导致生产环境构建时如果未正确设置 `VITE_API_BASE_URL`，会错误调用 staging API。需要在应用启动或构建时添加环境变量校验，确保生产环境必须配置该变量，否则给出警告或阻止启动，同时不影响开发环境正常使用。

## 2. 当前状态
未开始。代码中存在硬编码，且无环境变量校验逻辑。

## 3. 影响范围
- 前端仓库：aaveapy/lovable 分支
- 主要涉及配置管理和启动流程

## 4. 实现方案

### 4.1 设计思路
- 在前端应用启动时（例如 `src/main.tsx` 或 `src/lib/apiBase.ts` 初始化时）检测环境变量 `VITE_API_BASE_URL`。
- 判断当前环境（通过 `import.meta.env.MODE` 或 `process.env.NODE_ENV`，Vite 推荐使用 `import.meta.env.MODE`）。
- 如果是生产环境（`production`），且 `VITE_API_BASE_URL` 未设置或为空，则：
  - 在控制台打印明显警告信息
  - 或者抛出错误阻止应用启动（可选，视团队容忍度）
- 开发环境（`development`）不做限制，允许使用默认硬编码 staging URL。

### 4.2 具体步骤

#### 4.2.1 修改 `src/lib/apiBase.ts`
- 添加环境变量读取逻辑：
  ```ts
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com';
  ```
- 添加校验函数：
  ```ts
  function validateEnv() {
    if (import.meta.env.MODE === 'production' && !import.meta.env.VITE_API_BASE_URL) {
      console.warn('[ENV WARNING] VITE_API_BASE_URL is not set in production environment. Please configure it to avoid using staging API.');
      // 可选：throw new Error('Missing VITE_API_BASE_URL in production environment');
    }
  }
  validateEnv();
  ```
- 确保后续请求均使用 `apiBaseUrl`。

#### 4.2.2 修改应用入口（如 `src/main.tsx`）
- 可选：将校验逻辑放到入口，保证应用启动前校验。

#### 4.2.3 CI/CD 配置建议
- 在 Vercel 或其他部署平台环境变量配置中，确保 `VITE_API_BASE_URL` 在生产环境必填。
- 可在构建脚本中添加简单校验脚本，提前失败。

### 4.3 测试方案
- 本地开发环境启动，确保不报警且使用默认 staging URL。
- 生产环境构建时，故意不设置 `VITE_API_BASE_URL`，观察控制台警告或构建失败。
- 生产环境正确设置变量时，正常启动且请求正确 API。

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议配合 AAV-118 环境变量管理规范完善。

## 6. 验收标准
- 生产环境缺失 `VITE_API_BASE_URL` 时，控制台出现明显警告信息。
- 开发环境启动不受影响，正常使用默认 staging URL。
- 生产环境正确配置时，应用正常启动且请求正确 API。
- 代码提交包含单元测试或手动测试记录。

## 7. 复杂度评估
- Medium
- 理由：涉及环境变量管理和应用启动流程改动，需兼顾开发和生产环境差异，避免影响开发体验，同时保证生产安全。实现难度不大，但需谨慎测试。