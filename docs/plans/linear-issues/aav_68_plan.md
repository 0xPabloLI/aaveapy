# 开发方案 - AAV-68 读取是不是违反了net lending/borrow

## 1. Issue 概述
实现对用户或市场层面“net lending/borrow”指标的读取与判断，检测是否存在违反预期或规则的情况。即通过数据分析判断当前的净借贷（net lending/borrow）是否符合业务逻辑或风险控制要求。

## 2. 当前状态
未开始。代码库中已有部分与net lending相关的数据结构和计算（如Merkl Dashboard、net lending相关Issue AAV-69），但“读取是否违反”逻辑尚未实现。

## 3. 影响范围
- 后端：aave-protocol-analysis/railway  
  负责数据采集、计算及API接口提供net lending/borrow相关数据和违规判断结果。
- 前端：aaveapy/lovable  
  负责展示net lending/borrow状态及违规提示。

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据采集与计算
- **修改文件**:  
  - `src/index.ts`（根数据聚合逻辑）  
  - `backend/src/services/marketsService.ts`（市场数据管理）  
  - 新增或扩展 `backend/src/services/netLendingService.ts`（专门负责net lending/borrow计算与违规检测）
- **逻辑**:  
  - 计算每个市场或用户的net lending/borrow值（借入量 - 贷出量）。  
  - 定义违规规则（如net lending超过某阈值，或借贷比例异常等）。  
  - 生成违规标识字段（如`netLendingViolation: boolean`）附加到市场或用户数据结构中。

#### 4.1.2 API接口扩展
- **修改文件**:  
  - `backend/src/routes/markets.ts`  
  - `backend/src/controllers/marketsController.ts`  
  - `backend/src/services/marketsApiSerialize.ts`  
- **逻辑**:  
  - 在`GET /api/markets`接口返回的数据结构中增加net lending相关字段及违规标识。  
  - 保持字段命名与现有API一致，方便前端无缝接入。

### 4.2 前端实现

#### 4.2.1 数据获取与状态管理
- **修改文件**:  
  - `src/hooks/useAaveMarkets.ts`（扩展数据类型，支持net lending违规字段）  
- **逻辑**:  
  - 解析后端新增字段，存入状态管理。

#### 4.2.2 UI展示
- **修改文件**:  
  - `src/components/dashboard/ReservesTable.tsx`（或相关展示net lending的组件）  
  - 新增违规提示UI元素（如红色警告图标、Tooltip说明）  
- **逻辑**:  
  - 在对应的net lending/borrow列显示违规状态。  
  - 提供用户友好的违规说明。

## 5. 依赖关系
- 依赖AAV-69（Merkl dashboard/net lending）相关数据结构完善。  
- 可能依赖后端数据库或缓存结构支持net lending数据存储。

## 6. 验收标准
- 后端接口`GET /api/markets`返回数据包含net lending及违规标识字段。  
- 前端ReservesTable或相关组件正确显示net lending数据及违规状态。  
- 通过单元测试覆盖net lending计算与违规判断逻辑。  
- 通过集成测试验证前后端数据流通及UI展示。  
- 业务人员确认违规提示符合预期。

## 7. 复杂度评估
**Medium**  
理由：涉及后端新增计算逻辑和API扩展，前端数据解析与UI调整，需定义合理违规规则，确保性能和准确性。已有部分net lending数据基础，减少了实现难度。