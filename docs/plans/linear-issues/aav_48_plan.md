# AAV-48 定期删除已经过时的token icon 开发方案

## 1. Issue 概述
实现一个机制，定期清理项目中已经过时、不再使用的token icon资源文件，避免无用文件占用存储空间，保持代码库整洁。

## 2. 当前状态
未开始。代码库中存在部分token icon资源，尚无自动清理或定期维护机制。

## 3. 影响范围
- 前端仓库：aaveapy/lovable  
  主要涉及 `src/assets/icons/tokens/` 或类似存放token icon的目录。

## 4. 实现方案

### 4.1 需求分析
- 识别哪些token icon是“过时”的：
  - 不再被任何前端代码引用（组件、样式、配置等）
  - 可能对应已下线或废弃的token
- 定期执行清理任务（如每周或每月）
- 清理动作需安全，避免误删：
  - 先生成报告供人工确认
  - 或在CI流程中加入警告提示
- 可选：提供脚本手动执行清理

### 4.2 具体步骤

#### 4.2.1 编写扫描脚本
- 新建脚本文件：`scripts/clean-token-icons.ts`
- 功能：
  - 扫描 `src/assets/icons/tokens/` 目录下所有icon文件
  - 解析前端源码（`src/components/`, `src/lib/`, `src/hooks/`等）查找icon文件引用（文件名匹配）
  - 生成未被引用的icon列表
  - 输出清理建议报告（如 `clean-token-icons-report.json` 或 `.md`）

#### 4.2.2 集成清理流程
- 在本地开发流程中，开发者可运行该脚本查看报告
- 在CI流程（GitHub Actions）中可增加一个检查步骤：
  - 运行扫描脚本
  - 如果发现未引用icon，输出警告日志
  - 可选：阻断合并请求，强制清理或确认

#### 4.2.3 定期自动清理（可选）
- 配置定时任务（GitHub Actions Scheduled Workflow）
- 自动运行扫描脚本，生成报告
- 由维护人员定期审核并手动删除未使用icon文件

#### 4.2.4 删除过时icon文件
- 根据报告，手动或脚本自动删除未使用icon文件
- 删除操作需提交PR，经过代码审核

### 4.3 代码变更文件列表
- `scripts/clean-token-icons.ts` - 新增扫描清理脚本
- `.github/workflows/clean-token-icons.yml` - （可选）新增定时扫描CI Workflow
- 可能修改README或贡献文档，增加清理说明

### 4.4 数据流变更
无后端或API数据变更，纯前端资源管理。

## 5. 依赖关系
- 无直接依赖其他Issue
- 依赖当前前端代码结构稳定，icon引用路径规范

## 6. 验收标准
- 能正确识别未被引用的token icon文件
- 生成清晰的未使用icon报告
- CI流程能检测并警告未清理的过时icon
- 维护人员能根据报告安全删除无用icon文件
- 删除后前端无icon缺失或报错

## 7. 复杂度评估
Medium  
理由：需要实现静态代码分析匹配icon引用，保证准确性；集成CI流程及定期任务需协调；删除操作需谨慎避免误删。