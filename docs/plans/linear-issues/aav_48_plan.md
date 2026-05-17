# AAV-48 定期删除已经过时的token icon 开发方案

## 1. Issue 概述
实现一个机制，定期清理项目中已经过时、不再使用的token icon资源文件，避免无用文件占用存储空间，保持代码库整洁。

## 2. 当前状态
已完成。在现有 `sync-token-icons.mjs` 脚本中增加了 orphaned icon 检测，运行 sync 时自动报告本地存在但 API 活跃 token 中不存在的 icon。

## 3. 影响范围
- 前端仓库：aaveapy/lovable
  - 主要涉及 `public/icons/tokens/` 目录
  - 脚本 `scripts/sync-token-icons.mjs`
  - 测试 `scripts/lib/token-icon-orphaned.test.ts`

## 4. 实现方案

### 4.1 需求分析
- 识别"过时" icon 的可靠方式：
  - 本地 `public/icons/tokens/` 中存在但 API `/markets` 返回的活跃 token symbol 中不存在的 icon
  - 静态源码扫描不可行（icon 通过 URL 路径动态加载，非静态 import）
- 清理动作需安全，避免误删：
  - 仅输出警告报告，不自动删除
  - 保护 `default.svg` 等兜底图标不被标记
- 复用现有基础设施，不新建脚本或 workflow

### 4.2 具体步骤

#### 4.2.1 扩展现有 sync-token-icons 脚本
- 在 `scripts/sync-token-icons.mjs` 的 `getMissingSymbols()` 中：
  - 新增 `orphaned` 返回字段：本地 icon 集合 - API 活跃 symbol 集合 - 受保护 symbol（`default`）
- 在 `main()` 中：
  - 同步完成后输出 orphaned icon 警告日志
  - 格式：`Orphaned token icons (local but not in API): symbol1, symbol2 (N)`

#### 4.2.2 利用现有 CI workflow
- 现有 `.github/workflows/token-icon-sync.yml` 已每日定时运行 `npm run sync-token-icons`
- orphaned 警告自动出现在 workflow 日志中，无需新建 workflow
- 维护人员可定期查看日志，手动清理

### 4.3 代码变更文件列表
- `scripts/sync-token-icons.mjs` — 在 `getMissingSymbols()` 新增 `orphaned` 差集计算，在 `main()` 输出警告
- `scripts/lib/token-icon-orphaned.test.ts` — 新增 orphaned 差集计算逻辑的单元测试

### 4.4 数据流变更
无后端或API数据变更。脚本运行时从 `/markets` API 获取活跃 token symbol，与本地 icon 做差集。

## 5. 依赖关系
- 依赖现有 `sync-token-icons.mjs` 脚本及其依赖（`token-icon-symbols.mjs`, `/markets` API）
- 依赖现有 `token-icon-sync.yml` workflow 的定时调度

## 6. 验收标准
- ✅ 能正确识别本地存在但 API 活跃 token 中不存在的 icon
- ✅ 输出清晰的 orphaned icon 警告日志
- ✅ CI workflow 日志中可见 orphaned 报告
- ✅ `default` 等受保护 symbol 不被标记为 orphaned
- ✅ 不自动删除，仅报告

## 7. 复杂度评估
Low
理由：在现有脚本中增加约 10 行差集计算和日志输出，复用现有 CI workflow，无新依赖。

## 8. 经验总结
- token icon 通过 URL 路径动态加载（非静态 import），静态源码扫描无法正确识别引用关系
- 应优先利用现有基础设施（manifest、sync 脚本、CI workflow）而非新建
- `tokenIconManifest` 是从目录自动生成的，不能用于差集检测（目录中不可能有不在 manifest 的文件）
- 可靠的"过时"判断依据是 API 运行时数据（活跃 token symbol），而非静态代码分析
