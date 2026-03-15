# 优化 Token Icon 处理和预加载机制

## 主要改动

### Token Icon 处理优化
- **缓存机制**：添加了全局缓存（resolvedSrcCache），避免重复的网络请求和fallback探测
- **智能Fallback**：改进了fallback逻辑，按优先级尝试：本地manifest → logoURI → CoinGecko → 默认图标
- **预加载优化**：已预加载的图标自动使用eager loading，提升首屏性能
- **日志优化**：每个symbol只记录一次缺失图标的警告，避免控制台噪音

### Token Icon Manifest 生成
- **新增脚本**：`scripts/generate-token-icon-manifest.mjs` 在构建时扫描token图标目录
- **减少404**：只请求实际存在的图标格式，避免不必要的网络请求
- **格式优先级**：按 svg → webp → png → jpg → jpeg 的顺序尝试

### 预加载机制改进
- **基于Manifest**：使用生成的manifest优化预加载策略
- **连接感知**：根据网络连接类型（2g/3g/4g/wifi）动态调整预加载数量
- **性能优化**：使用requestIdleCallback进行非阻塞预加载

### 其他改进
- 更新依赖包（sonner, tailwind-merge, eslint-plugin-react-hooks等）
- 添加新的token图标（pt-srusde-2apr2026, pt-susde-5feb2026, pt-susde-7may2026）
- 更新reservePatches配置
- 改进TopOpportunities组件的预加载逻辑

## 技术细节

### 核心文件变更
- `src/components/primitives/TokenIcon.tsx`: 重构图标加载逻辑，添加缓存和智能fallback
- `src/lib/preloadUtils.ts`: 集成manifest，优化预加载策略
- `scripts/generate-token-icon-manifest.mjs`: 新增构建时manifest生成脚本
- `src/pages/Index.tsx`: 改进预加载调用时机

### 性能提升
- 减少不必要的404请求（通过manifest预检查）
- 避免重复的fallback探测（通过缓存）
- 优化首屏加载（eager loading已预加载资源）
- 网络感知的预加载策略（根据连接类型调整）

## 测试建议
- [ ] 验证token图标正常显示
- [ ] 检查控制台无多余警告
- [ ] 验证预加载机制正常工作
- [ ] 测试不同网络条件下的表现

## 统计信息
- 21个文件变更
- 786行新增
- 201行删除
