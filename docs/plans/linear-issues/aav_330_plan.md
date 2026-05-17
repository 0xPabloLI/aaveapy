# AAV-330 开发方案

## 1. Issue 概述
Staging 环境的 smoke test 失败，导致此次部署回滚。需要排查失败根因，修复问题，确保后续部署的稳定性和自动化流程的正常运行。

## 2. 当前状态
- 状态：未开始
- 目前仅有 GitHub Actions workflow 失败日志，未定位具体问题。

## 3. 影响范围
- 前端仓库：aaveapy（lovable 分支）
- 可能涉及 CI/CD 配置及部署流程

## 4. 实现方案

### 4.1 根因排查
- 查看失败的 workflow 运行日志（[链接](https://github.com/0xPabloLI/aaveapy/actions/runs/25831263281)）
- 重点关注：
  - 哪个具体的 smoke test 失败（API 响应、页面加载、关键接口等）
  - 是否是代码错误、依赖问题、环境变量缺失或外部服务不可用
  - 部署脚本或 Vercel 配置是否有异常
- 本地复现失败场景，确认问题是否可复现

### 4.2 修复问题
- 针对发现的具体错误，修改代码或配置
- 如果是环境变量或 token 缺失，补充完善 CI/CD 配置
- 优化 smoke test 脚本，增强容错和日志输出

### 4.3 防止复发
- 在 GitHub Actions workflow 中增加更详细的日志和错误捕获
- 配置失败自动告警（Slack/邮件/Issue 自动创建）
- 检查并确保 Vercel 的自动分配生产域名功能正常开启
- 编写文档说明部署及回滚流程，包含手动恢复步骤

### 4.4 部署及验证
- 修复后推送代码触发新的 staging 部署
- 观察 smoke test 是否通过
- 手动执行 `vercel promote` 验证生产环境域名分配
- 监控后续部署的稳定性

## 5. 依赖关系
- 无直接依赖其他 Issue，但需配合 DevOps 团队确认 CI/CD 和 Vercel 配置

## 6. 验收标准
- staging 环境 smoke test 成功通过，无失败回滚
- GitHub Actions workflow 日志清晰，失败时自动告警
- Vercel 自动分配生产域名功能正常，部署后无需手动干预
- 部署回滚流程文档完善，团队成员知晓操作步骤

## 7. 复杂度评估
- Medium  
  需要排查多方面原因（代码、环境、配置），涉及 CI/CD 和部署流程，需协调多方资源，但修复后能显著提升部署稳定性。