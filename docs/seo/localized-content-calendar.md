# 本地化页面内容更新日历

覆盖页面（共 5 个本地化费率/APY 落地页）：

| 市场 | 路由 | 文件 |
| --- | --- | --- |
| pt-BR | `/pt-br/taxas-aave-apy` | `src/pages/AaveTaxasApyPT.tsx` |
| fr | `/fr/taux-aave-apy` | `src/pages/AaveTauxApyFR.tsx` |
| de | `/de/aave-zinsen-apy` | `src/pages/AaveZinsenApyDE.tsx` |
| es | `/es/tasas-aave-apy` | `src/pages/AaveTasasApyES.tsx` |
| id | `/id/apy-aave` | `src/pages/AaveApyID.tsx` |

## 1. 更新节奏

| 周期 | 内容对象 | 说明 |
| --- | --- | --- |
| 每月（每月第 1 个工作日） | 数值示例（APY、激励 APR、gas 费用量级）、货币换算 | 用 dashboard 当月实际区间校准，不写“当前”这类会过期的措辞 |
| 每季度（1/4/7/10 月首周） | FAQ 全量复核、内链、关键词覆盖 | 对照 `docs/seo/keyword-plan.md` 的长尾词补/删 FAQ 项 |
| 每半年（1 月、7 月） | 页面结构（H2 章节、drivers、howTo） | 检查是否需要新增章节（如新链、V4 相关内容） |
| 事件驱动（发生后 2 周内） | 监管与税务段落 | 见下方触发器 |

## 2. 事件驱动触发器（按市场）

| 市场 | 监控对象 | 触发更新的段落 |
| --- | --- | --- |
| pt-BR | Receita Federal 加密申报规则、Banco Central 稳定币规定 | 税务 FAQ、BRL 稳定币 FAQ |
| fr | MiCA 实施细则、AMF PSAN/CASP 名录、PFU 30% 税制变化 | 税务 FAQ、MiCA FAQ、EURC FAQ |
| de | MiCA/BaFin 公告、加密持有期（Haltefrist）税务口径 | 税务 FAQ、MiCA/BaFin FAQ |
| es | IRPF 税率档、Modelo 721 申报要求、CNMV 公告 | 税务 FAQ、Modelo 721 FAQ |
| id | Bappebti/OJK 监管移交、加密交易税率（PPh/PPN） | 税务 FAQ、Bappebti FAQ、入金 FAQ |
| 全部 | Aave 治理：新链上线、新激励项目（Merit/Merkl/Brevis 变更）、V4 推进 | drivers 章节、激励 FAQ、示例数值 |

## 3. 每次更新的执行清单

1. 拉取当月 dashboard 数据，校准示例中的 APY / 激励 APR / 名义收益金额。
2. 对照该市场监管触发器，确认税务与合规措辞仍属谨慎、非确定性表述（不得给出确定性税务建议）。
3. 用 Semrush 复核目标长尾词，必要时新增 1–2 条 FAQ；FAQ 总数保持 8–12 条。
4. 检查内链（`related.links`）目标页仍存在且相关。
5. 运行验证门槛：`npm run lint && npm test && npm run build && npx tsc --noEmit`。
6. 在下方变更日志追加一行。

## 4. 年度排期表（模板，每年沿用）

| 月份 | 动作 |
| --- | --- |
| 1 月 | 季度 FAQ 复核 + 半年结构复核 + 上一年度税务口径更新 |
| 2 月 | 月度数值校准 |
| 3 月 | 月度数值校准 |
| 4 月 | 季度 FAQ 复核（欧洲报税季，重点 fr/de/es 税务段落） |
| 5 月 | 月度数值校准 |
| 6 月 | 月度数值校准 |
| 7 月 | 季度 FAQ 复核 + 半年结构复核 |
| 8 月 | 月度数值校准 |
| 9 月 | 月度数值校准 |
| 10 月 | 季度 FAQ 复核 + 关键词矩阵重跑 |
| 11 月 | 月度数值校准 |
| 12 月 | 月度数值校准 + 次年排期确认 |

## 5. 变更日志

| 日期 | 市场 | 变更内容 | 触发原因 |
| --- | --- | --- | --- |
| 2026-09-03 | fr / de / es / id | 新增本地化数值示例与地区性税务、监管 FAQ | 本地化内容深化 |
| 2026-09-03 | 全部 | 建立本更新日历 | 流程化维护 |
