# AAV-334 开发方案

## 1. Issue 概述
Staging 环境部署后，自动触发的 Smoke Test 失败，导致部署回滚被跳过（因预览分支或 token 缺失），需要排查失败原因，修复问题，确保后续部署通过 Smoke Test 并能正常自动回滚和域名分配。

## 2. 当前状态
- 状态：Backlog，尚未开始处理
- 已有 GitHub Actions workflow 运行日志，需分析失败详情

## 3. 影响范围
- 仓库：aaveapy（lovable 分支）
- 主要涉及 CI/CD 流程（.github/workflows/deployment-smoke-test.yml）
- 可能涉及前端代码或部署配置

## 4. 实现方案

### 4.1 根因排查步骤
- 查看失败的 workflow 运行日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25858065161)）
- 确认具体失败的 Smoke Test 用例（如接口返回异常、页面加载失败、环境变量缺失等）
- 检查最近提交 `387ee13` 的代码变更，定位可能引入的错误
- 检查 Vercel 部署设置，确认是否存在预览分支或 token 配置缺失导致自动回滚跳过
- 复现失败场景（本地或测试环境）

### 4.2 修复方案
- 针对具体失败用例修复代码缺陷（前端或后端）
- 补充或修正 CI/CD 配置文件，确保：
  - 自动回滚功能正常触发
  - Vercel token 和预览分支配置正确
  - Smoke Test 脚本健壮，能准确捕获错误并报告
- 增加 Smoke Test 的日志和错误提示，方便未来排查
- 验证修复后，推送代码触发新的 workflow 运行

### 4.3 防止复发措施
- 在 CI/CD 流程中增加关键步骤的状态检查和告警
- 编写 SOP 文档，明确 Smoke Test 失败时的处理流程
- 配置 GitHub Actions 失败自动通知相关负责人
- 定期审查和更新 Smoke Test 用例，覆盖关键功能点

### 4.4 告警处理 SOP
- 发现 Smoke Test 失败，立即查看 workflow 日志定位问题
- 若自动回滚未执行，手动执行回滚或恢复操作
- 通知相关开发人员跟进修复
- 修复后重新触发部署验证

## 5. 依赖关系
- 无直接依赖其他 Issue，但需关注 AAV-320、AAV-330~348 等其他 Smoke Test 相关问题，统一管理和优化

## 6. 验收标准
- Staging 环境部署后，Smoke Test 全部通过
- 自动回滚功能正常触发，且不会跳过
- Vercel 域名自动分配功能正常
- CI/CD 日志清晰，能快速定位问题
- 相关 SOP 文档完成并审核

## 7. 复杂度评估
- Medium  
  理由：需要结合 CI/CD 流程和前端代码排查问题，涉及多系统联动，且需保证自动化流程稳定性，需一定调试和验证时间。