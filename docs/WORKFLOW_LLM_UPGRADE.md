# LandWeaver Workflow and LLM Upgrade Plan

本文档记录本轮已经落地的 LandWeaver 后端工作流升级，以及后续接入大模型、视觉能力、PostGIS 和公司数据仓时的具体实现路线。产品定位保持为 ToB：服务房地产投拓、设计管理、概念方案和投委会材料准备，不面向普通家庭装修决策。

## 1. 产品边界

LandWeaver 的核心用户是企业团队，而不是 C 端业主。它要回答的问题是：

- 这块地在当前规划和经济假设下是否值得继续推进？
- 哪套强排方案更接近投资、设计和合规目标？
- 投委会需要哪些证据、缺口和通过条件？
- 公司内部数据仓、PostGIS、竞品库和成本库如何支撑方案判断？

核心交付物：

- `ProjectCommandCenter`：项目指挥中心，展示强排前后流程、阻断项、自动化计划、LLM 模块和便携服务。
- `SiteOption`：本地优化器生成的可验证楼栋坐标和指标。
- `OptionReview`：本地规则评审方案质量。
- `InvestmentMemo`：投决建议、关键指标、风险登记和数据室清单。
- `DueDiligencePack`：本轮新增的尽调证据包，组织证据缺口、数据检索规格、LLM 助手和便携服务。

大模型边界：

- LLM 不生成最终楼栋坐标。
- LLM 不编造法规、规划条件、审批结论或投资建议。
- LLM 可做文本抽取、图纸视觉读取、资料摘要、风险推理摘要和投委会材料改写。
- 几何、指标、收益、敏感性、导出全部由本地算法和可追溯数据计算。

## 2. 已落地的后端工作流拆分

新增 service：

- `apps/api/app/services/project_workflow.py`
  - 输入：`Project`、`Parcel`、`PlanningBrief`、`ConstraintSet`、原型数量、`SiteOption[]`、`ProjectDiagnostics`
  - 输出：`ProjectCommandCenter`
  - 职责：把红线、简报、规划/经济约束、原型、诊断、强排、投决尽调拆成项目级工作流。
- `apps/api/app/services/due_diligence_pack.py`
  - 输入：`Project`、`Parcel`、`ConstraintSet`、`SiteOption`、`OptionReview`、`InvestmentMemo`、可选 `PlanningBrief`
  - 输出：`DueDiligencePack`
  - 职责：生成 evidence gaps、dataset query specs、LLM assistants、portable services、handoff prompts 和 next actions。

新增 schema：

- `WorkflowStep`
- `PortableServiceSpec`
- `ProjectCommandCenter`
- `DueDiligenceGap`
- `DatasetQuerySpec`
- `DueDiligencePack`

新增 API：

- `GET /api/projects/{project_id}/command-center`
- `POST /api/options/{option_id}/due-diligence`

报告升级：

- `POST /api/options/{option_id}/report` 现在会把 `DueDiligencePack` 作为 HTML 报告附录，和 `InvestmentMemo` 一起交付。

## 3. 前端功能落地

新增页面：

- `apps/web/app/projects/[id]/command/page.tsx`

页面能力：

- 展示项目 readiness、诊断分、当前 focus。
- 展示 workflow steps、blockers、automation plan。
- 展示 LLM 模块和便携式服务。
- 作为项目 dashboard 和方案详情之间的 ToB 管理视角。

新增组件：

- `apps/web/components/DueDiligencePanel.tsx`

组件能力：

- 展示 executive focus。
- 展示证据缺口、责任团队和严重级别。
- 展示数据集检索规格，包括 dataset_type、query_hint、字段和更新频率。
- 展示 LLM / 便携服务状态。

方案详情页升级：

- `/projects/[id]/options/[optionId]` 新增“尽调”按钮。
- 调用 `createDueDiligence(optionId)` 后展示 `DueDiligencePanel`。
- “投决”“尽调”“报告”共同构成 ToB 决策闭环。

## 4. LLM / Vision / Text 模块设计

### 4.1 planning_brief_reasoner

定位：投拓简报推理。

输入：

- 投拓团队自然语言描述
- 城市、客群、产品定位、风险偏好、目标利润率

输出：

- `PlanningBrief`
- 风险偏好
- 策略倾向
- 产品定位和户型段假设

当前实现：

- 已有 `openai_service.parse_planning_brief()`。
- 无 Key 时走 deterministic mock。

后续增强：

- 增加“缺字段提示”，让用户知道哪些假设会显著影响强排和投资判断。
- 增加公司标准产品线映射，例如刚需、高改、低密、TOD、改善型。

### 4.2 vision_cad_redline_reader

定位：CAD/图纸视觉读取。

输入：

- 红线 CAD 截图
- 控规截图
- 扫描 PDF 页面
- 地块指标表图片

输出：

- 地块编号候选
- 红线/控规字段候选
- 图例和不确定区域
- 需要人工确认的问题

实现原则：

- 视觉模型只能生成候选，不直接写 `Parcel` 或 `ConstraintSet`。
- 最终几何仍由 GeoJSON/DXF parser 或人工确认后进入系统。
- 所有候选必须保留 source page、confidence、uncertain_regions。

### 4.3 option_explain_reasoner

定位：方案解释推理。

输入：

- `SiteOption.metrics`
- `violations`
- `risk_flags`
- `OptionReview`

输出：

- 可放进投委会材料的方案解释。
- 为什么当前方案是 revenue_first / balanced / low_risk。
- 当前风险如何被本地指标支撑。

当前实现：

- `openai_service.explain_site_option()` 已有 deterministic fallback，并强制说明“仅基于用户输入约束和系统计算指标”。

### 4.4 investment_committee_writer

定位：投委会材料写作。

输入：

- `InvestmentMemo`
- `DueDiligencePack`
- `SensitivityScenario[]`
- 导出的图层/指标

输出：

- 投委会摘要
- speaker notes
- 条件通过/暂缓/退回的理由
- 附录目录

落地方式：

- 本轮先通过 `ProjectCommandCenter.llm_modules` 暴露。
- 下一步可在 `openai_service.py` 增加 `write_committee_memo()`，只改写文本，不改变 recommendation、metrics 和 risk severity。

### 4.5 data_room_summarizer

定位：数据室摘要助手。

输入：

- PDF、DOCX、XLSX、CSV、HTML 报告
- 公司内部资料和正式规划文件

输出：

- 证据表
- 来源冲突
- 有效日期
- 投委会问题

实现原则：

- 每一条摘要必须带 source、page/sheet、effective_date。
- 没有来源的结论只能进入“待确认”，不能进入正式 `ConstraintSet`。

### 4.6 risk_reasoning_copilot

定位：投决风险推理助手。

输入：

- `InvestmentMemo`
- `DueDiligencePack`
- 敏感性分析
- 公司风险偏好

输出：

- 条件通过建议
- 暂缓/退回触发条件
- 需要哪个责任团队关闭哪个缺口

当前实现：

- 本轮加入 `DueDiligencePack.llm_assistants`。
- 当前由 deterministic service 生成 evidence gaps 和 prompts，后续可接模型生成更自然的推理摘要。

## 5. 便携式服务设计

已落地为 `PortableServiceSpec`：

- `postgis_context_loader`
  - 将 parcel/zoning/buildings/POI/market_area 统一投影后入库。
  - 未来用于项目创建页和尽调检索。
- `option_batch_export_cli`
  - 无网页环境下批量导出 GeoJSON/DXF/CSV/HTML。
  - 适合投拓团队批量测算多个地块。
- `constraint_snapshot_api`
  - 冻结规划约束和经济假设。
  - 确保报告可追溯到有效日期和数据来源。
- `evidence_pack_export`
  - 导出 Due Diligence Pack 的 Markdown/JSON。
- `market_comp_loader_cli`
  - 将授权竞品成交/去化表转成标准索引。
- `committee_packet_worker`
  - 批量生成投委会 HTML/PDF、图层导出、敏感性页和尽调附录。

下一步建议新增 endpoint/CLI：

- `POST /api/options/{option_id}/due-diligence/export?format=markdown`
- `python -m apps.api.cli.batch_export --project-id ...`
- `python -m apps.api.cli.load_market_comps --file market_comps.xlsx --project-id ...`

## 6. 数据库接入路线

### 6.1 PostGIS 地块与规划条件库

核心表：

- `parcels`
- `zoning`
- `land_use`
- `planning_conditions`
- `constraint_snapshots`
- `source_documents`

字段：

- `geometry`
- `crs`
- `parcel_id`
- `land_use`
- `far_max`
- `density_max`
- `height_limit_m`
- `green_ratio_min`
- `setbacks`
- `parking_rule`
- `effective_date`
- `source_license`
- `source_document_id`

接入顺序：

1. 先支持 GeoJSON/DXF 入库。
2. 再接地方政府 parcel/zoning 数据。
3. 最后接公司授权 CAD/GIS 和控规资料。

### 6.2 市场价格与竞品去化库

核心表：

- `market_areas`
- `comparable_projects`
- `transaction_prices`
- `sell_through`
- `launch_batches`

字段：

- `project_name`
- `geometry`
- `distance_to_site`
- `unit_area`
- `price`
- `discount`
- `sell_through`
- `launch_date`
- `source`
- `confidence`

使用位置：

- 投决备忘录的售价证据。
- Due Diligence Pack 的 `market_comps` query spec。
- 敏感性分析的价格扰动范围。

公开 demo 数据：

- 美国可用 Zillow Research、FHFA HPI、FRED/Case-Shiller 等区域趋势。
- 正式项目必须优先使用公司成交库、渠道库和授权竞品库。

### 6.3 公司成本库

核心表：

- `cost_benchmarks`
- `prototype_costs`
- `basement_costs`
- `facade_costs`
- `landscape_costs`
- `soft_cost_rules`

字段：

- `prototype_type`
- `hard_cost_cny_per_m2`
- `basement_cost_cny_per_m2`
- `facade_level`
- `landscape_level`
- `city`
- `effective_date`
- `source_owner`

使用位置：

- `ConstraintSet.assumptions`
- `Profit Engine`
- `InvestmentMemo`
- `DueDiligencePack.cost_library`

### 6.4 产品原型库

核心表：

- `building_prototypes`
- `unit_mix_templates`
- `parking_templates`
- `podium_templates`

字段：

- `type`
- `footprint_width_m`
- `footprint_depth_m`
- `floors_min/max`
- `units_per_floor`
- `avg_unit_area_m2`
- `height_per_floor_m`
- `product_line`
- `city_applicability`

使用位置：

- 强排候选生成。
- FAR 利用不足时推荐更合适的产品原型。
- 投委会材料中解释产品组合。

### 6.5 法务与审批风险库

核心表：

- `title_risks`
- `approval_paths`
- `easements`
- `environmental_risks`
- `heritage_constraints`
- `relocation_status`

实现原则：

- LLM 只能摘要正式资料和提出问题。
- 法务/报批团队确认后才能进入正式风险字段。

## 7. 验收标准

后端：

- `GET /api/projects/{project_id}/command-center` 在空项目、半完成项目、完整项目都能返回合理工作流状态。
- `POST /api/options/{option_id}/due-diligence` 能基于 option、constraints、review、memo 生成证据缺口和数据查询规格。
- `POST /api/options/{option_id}/report` HTML 包含投决备忘录和尽调证据包。

前端：

- `/projects/[id]/command` 能展示指挥中心，不依赖已经生成方案。
- `/projects/[id]/options/[optionId]` 的“尽调”按钮能生成并展示 Due Diligence Panel。

测试：

- `apps/api/tests/test_api_happy_path.py` 覆盖 command-center、due-diligence 和 HTML report。
- `apps/web` typecheck 覆盖新增 API/type/page/component。

## 8. 下一轮最值得做的代码任务

1. 增加 `due-diligence/export` endpoint，输出 Markdown/JSON。
2. 增加 `constraint_snapshot` 数据结构和 API，给每份报告固化来源、有效日期和假设版本。
3. 将 JSON store 替换为 SQLAlchemy/PostGIS repository，但保留当前 service 层接口。
4. 实现 `market_comp_loader_cli`，读取授权 Excel/CSV 并生成标准 market comps 索引。
5. 给 `ProjectCommandCenter` 增加“缺口关闭状态”，让投拓、设计、成本、法务、市场团队可以逐项更新。
