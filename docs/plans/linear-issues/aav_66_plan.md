# 开发方案 - AAV-66 连接钱包读取自己是不是在merkl 白名单/黑名单

## 1. Issue 概述
实现前端连接用户钱包，读取用户地址后调用后端接口判断该地址是否在 Merkl 的白名单或黑名单中，并在前端界面展示相应状态。

## 2. 当前状态
未开始。  
目前后端已有 `whitelistOnly` 标志，但未实现钱包连接及白名单/黑名单校验逻辑，前端无钱包连接功能。

## 3. 影响范围
- 前端仓库：aaveapy/lovable 分支  
- 后端仓库：aave-protocol-analysis/railway 分支（可能需要新增接口支持）

## 4. 实现方案

### 4.1 后端改动
- **新增接口**：  
  - 路由：`GET /api/user/merkl-status?address=0x...`  
  - 功能：根据请求地址查询 Merkl 白名单和黑名单状态，返回 `{ isWhitelisted: boolean, isBlacklisted: boolean }`  
- **数据来源**：  
  - 使用已有 Merkl 白名单/黑名单数据源（如果无，需从 Merkl API 或数据库同步）  
- **文件修改**：  
  - `backend/src/routes/userRoutes.ts`（新建或扩展）  
  - `backend/src/controllers/userController.ts`（新增查询逻辑）  
  - `backend/src/services/merklService.ts`（封装白名单/黑名单查询逻辑）  

### 4.2 前端改动
- **钱包连接功能**：  
  - 使用 `ethers.js` 或 `web3-react` 实现钱包连接（MetaMask 等）  
  - 在 `src/components/Header/` 或独立组件中添加“连接钱包”按钮和状态显示  
- **调用后端接口**：  
  - 连接钱包后，获取用户地址，调用后端 `/api/user/merkl-status` 接口  
  - 根据返回结果显示用户是否在白名单或黑名单  
- **状态展示**：  
  - 在 Dashboard 或 Header 显示用户 Merkl 状态（例如绿色“白名单用户”，红色“黑名单用户”，灰色“未认证”）  
- **文件修改**：  
  - `src/components/Header/WalletConnect.tsx`（新增或扩展）  
  - `src/hooks/useWallet.ts`（新增钱包连接钩子）  
  - `src/hooks/useMerklStatus.ts`（新增调用接口钩子）  
  - 可能修改 `src/pages/Index.tsx` 或 Dashboard 相关组件，显示状态  

### 4.3 数据流变更
- 用户通过前端钱包连接获得地址  
- 前端调用后端接口查询该地址 Merkl 状态  
- 后端返回白名单/黑名单状态  
- 前端根据状态更新 UI 显示  

## 5. 依赖关系
- 依赖后端 Merkl 白名单/黑名单数据的准确性和同步机制  
- 依赖钱包连接库（ethers.js 或 web3-react）  
- 可能依赖后端已有 Merkl API 集成  

## 6. 验收标准
- 用户能成功连接钱包，前端显示钱包地址  
- 前端能正确调用后端接口，显示当前钱包地址的 Merkl 白名单/黑名单状态  
- 状态显示符合预期（白名单绿色，黑名单红色，未认证灰色）  
- 接口返回正确，支持多地址查询  
- 代码覆盖相关单元测试和集成测试  
- UI 交互流畅，无明显卡顿或错误  

## 7. 复杂度评估
Medium  
- 钱包连接是标准功能，但需兼容多钱包和网络  
- 需要设计后端接口并保证数据准确  
- 前后端联动涉及多处改动，需保证安全性和性能  

---

以上方案覆盖了从钱包连接到 Merkl 白名单/黑名单状态展示的完整流程，建议先从后端接口设计和数据准备开始，再实现前端钱包连接及状态展示。