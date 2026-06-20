# LandWeaver Agent（地织）

LandWeaver Agent 是面向房地产投拓、设计管理和概念方案团队的 B 端 AI 强排与测算引擎。用户输入地块红线、规划约束、楼栋原型和经济假设后，系统用本地确定性几何与 OR-Tools 约束优化生成多套 site options，并计算容积率、建筑密度、总建面、户数、货值、成本、毛利、风险提示，支持 GeoJSON、DXF、CSV 导出。

核心原则：LLM 不直接生成最终楼栋坐标。最终几何、指标、收益和导出都由本地算法计算。

## 已实现功能

- FastAPI API：项目列表/复制/归档/删除、地块 points/GeoJSON/DXF、PlanningBrief、约束、楼栋原型 CRUD、异步方案生成、任务状态、项目指挥中心、方案详情、方案质量评审、投决备忘录、尽调证据包、派生方案、敏感性、AI 解释、报告、导出下载。
- Geometry Engine：polygon normalize、面积、退界可建范围、候选 footprint、楼间距冲突、密度面积。
- Optimizer：OR-Tools CP-SAT 布尔候选选择，包含 FAR、密度、冲突和至少一栋楼约束，提供 revenue_first / balanced / low_risk 三策略；未安装 OR-Tools 时自动使用贪心 fallback。
- Profit Engine：可售面积、户数、车位、货值、建安、总成本、毛利、毛利率、分产品指标和敏感性。
- Design Diagnostics：生成前诊断红线、约束、原型适配、候选丰富度、容量粗判、绿地/密度张力、经济安全垫和简报连接，给出阻断原因与下一步建议。
- Project Command Center：`GET /api/projects/{project_id}/command-center` 将红线、简报、约束、原型、诊断、强排、投决尽调拆成项目级工作流，并输出 LLM 模块、便携服务、阻断项和自动化计划；前端页面为 `/projects/[id]/command`。
- Option Review：生成后按合规稳定性、FAR 利用、密度/绿地、经济表现、产品组合、高度余量和户型尺度进行本地评审，输出等级、优势、短板和可执行调整动作。
- Investment Memo：基于真实强排指标、方案评审和售价/成本敏感性生成 `go / conditional_go / no_go` 投决建议、关键指标、风险登记、数据室清单、投委会问题和下一步动作，接口为 `POST /api/options/{option_id}/investment-memo`。
- Due Diligence Pack：`POST /api/options/{option_id}/due-diligence` 生成证据缺口、责任团队、数据集检索规格、LLM 助手、便携式服务和下一步动作；方案详情页新增“尽调”面板，HTML 报告同步加入尽调证据包。
- AI Visual Design Studio：基于项目简报、真实强排方案、指标和方案评审生成视觉设计 brief、建筑/景观策略、材质色板、渲染提示词和汇报版式建议；只做视觉表达，不改动可验证强排结果。
- Export Engine：GeoJSON、DXF 图层、CSV 汇总、楼栋明细和带投决备忘录的 HTML 报告。
- Next.js 前端：创建项目、项目 Dashboard、项目指挥中心、地块 SVG 画布和 GeoJSON/DXF 导入、简报解析、完整约束表单、模板/自定义原型管理、生成任务轮询、无解建议、方案对比、方案质量评审、投决备忘录、尽调证据包、AI 视觉设计工作室、方案编辑派生、3D 体块、报告页、详情解释、敏感性和真实导出下载。
- pytest happy path 和核心引擎单测。

## 启动环境

目标环境：WSL2 Ubuntu 22.04、Python 3.10+、Node.js 20+。

```bash
cd LandWeaver-Agent
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
```

## 后端

```bash
cd LandWeaver-Agent
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=apps/api:. alembic -c apps/api/alembic.ini upgrade head
PYTHONPATH=apps/api:. uvicorn app.main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8001
```

当前 MVP 的 API 默认使用 JSON 落盘仓储和 FastAPI background task，便于无 Redis/PostGIS 时跑通闭环；SQLAlchemy、Alembic、PostGIS、Redis/RQ 的工程骨架已保留。

## 前端

```bash
cd LandWeaver-Agent/apps/web
npm install
npm run dev
```

默认前端通过 Next.js 同源 `/api` 代理访问后端，代理目标为：

```env
LANDWEAVER_API_BASE_URL=http://127.0.0.1:8001
```

如果后端运行在其他端口，可用：

```bash
LANDWEAVER_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --hostname 0.0.0.0 --port 3001
```

`NEXT_PUBLIC_API_BASE_URL` 只在需要浏览器直连后端时设置；默认留空可避免跨端口 CORS 和本机 8000 端口冲突。

## Render Blueprint 部署

本仓库根目录包含 `render.yaml`，可用 Render Blueprint 一键创建两个 public web services：

- `landweaver-api`：FastAPI 后端，健康检查 `/health`。
- `landweaver-web`：Next.js 前端，面向用户公开访问；前端通过 Render 内网代理 `/api/*` 和 `/exports/*` 到后端。

一键部署链接：

```text
https://render.com/deploy?repo=https://github.com/ChiZhang-805/LandWeaver-Agent
```

部署完成后，把 `landweaver-web` 的 `https://...onrender.com` 地址分享给用户即可。默认无 `OPENAI_API_KEY` 时会走 deterministic mock；如果要使用真实模型，在 Render Dashboard 里给 `landweaver-api` 添加 `OPENAI_API_KEY` 等环境变量后重新部署。

注意：当前 Blueprint 使用 Render free plan 和 JSON/文件落盘仓储，适合公开 demo。免费服务可能休眠，且重启/重新部署后项目数据和导出文件不保证长期保留；生产版应改接 Render Postgres/PostGIS、对象存储和正式异步队列。

## 测试

```bash
cd LandWeaver-Agent
source .venv/bin/activate
pytest
```

测试覆盖：

- polygon normalize/area
- buildable envelope
- candidate footprint generation
- conflict detection
- CP-SAT feasible / infeasible
- profit calculation / sensitivity
- GeoJSON/DXF/CSV export
- API happy path、项目指挥中心、生成前设计诊断、生成后方案质量评审、投决备忘录、尽调证据包、AI 视觉设计包、GeoJSON/DXF 地块、原型删除、项目复制、派生方案、HTML 报告、静态导出下载、敏感性接口

当前验证结果：

- `.venv/bin/python -m pytest -q`：14 passed。
- `cd apps/web && npx tsc --noEmit`：通过；当前 `package.json` 未配置 `typecheck` 脚本。
- `cd apps/web && npm run lint`：无警告或错误。
- `cd apps/web && npm run build`：通过。

详细升级设计见 [docs/WORKFLOW_LLM_UPGRADE.md](docs/WORKFLOW_LLM_UPGRADE.md)，包含后端工作流拆分、Project Command Center、Due Diligence Pack、LLM/视觉/文本模块、便携服务和未来 PostGIS/市场/成本/竞品数据库接入路线。

## .env.example

- `DATABASE_URL`：PostgreSQL/PostGIS 连接串。
- `REDIS_URL`：Redis/RQ 连接串。
- `OPENAI_API_KEY`：为空时使用 deterministic mock。
- `OPENAI_MODEL_TEXT`：方案解释模型，默认 `gpt-5.5`。
- `OPENAI_MODEL_FAST`：PlanningBrief 抽取模型，默认 `gpt-5.4-mini`。
- `LANDWEAVER_STORAGE_DIR`：导出文件目录。
- `LANDWEAVER_API_BASE_URL`：Next.js `/api` 代理目标，默认 `http://127.0.0.1:8001`。
- `NEXT_PUBLIC_API_BASE_URL`：可选浏览器直连 API 地址，默认留空。

## OpenAI API 使用位置

所有 OpenAI 调用集中在：

```text
apps/api/app/services/openai_service.py
```

实现函数：

- `parse_planning_brief(user_text) -> PlanningBrief`
- `explain_site_option(option_metrics, violations, risk_flags) -> str`
- `generate_visual_design_package(context, payload) -> VisualDesignPackage`

无 `OPENAI_API_KEY` 时返回 deterministic mock。方案解释必须包含“仅基于用户输入约束和系统计算指标”，不得编造法规条文。视觉设计包只能用于概念表达和渲染提示词，不得改变红线、楼栋数量、坐标、指标或输出报批承诺。

## 强排算法说明

1. Shapely 将用户输入 points 归一化为有效闭合 polygon。
2. MVP 用最大退界值执行 inward buffer，得到可建 envelope。
3. 对 tower/slab 原型按米制网格和旋转角生成候选 footprint。
4. 预计算候选之间的重叠和最小楼间距冲突。
5. OR-Tools CP-SAT 为每个候选创建 BoolVar。
6. 添加冲突、FAR、建筑密度、至少一栋楼等硬约束。
7. 按 `revenue_first`、`balanced`、`low_risk` 设置不同目标函数和 seed，生成多套方案。
8. Profit Engine 只基于本地公式计算收益和风险指标。

## 数据库接入策略

LandWeaver 的检索不应只做“地块名搜索”，而应围绕投拓和强排决策建立多层数据仓：

- 空间底图与建筑物：Overture Maps 的 buildings / places / divisions / transportation、OpenStreetMap/Geofabrik 分区切片、Microsoft Global ML Building Footprints，可用于周边建成环境、道路、POI、建筑密度和地块上下文检索。
- 行政区与人口经济：美国场景可接 Census TIGER/Line、ACS、HUD-USPS ZIP Crosswalk；其他国家/城市应优先使用官方统计局、规划局、开放数据门户或授权商业数据。
- 地块与规划条件：优先下载地方政府 parcel/zoning/land-use 数据，例如 NYC PLUTO/MapPLUTO 这类 tax lot + zoning 字段；中国城市若无开放接口，应通过授权 CAD/GIS、控规文件或人工结构化录入。
- 市场与价格：Zillow Research、FHFA HPI、FRED/Case-Shiller 等适合美国 demo 的区域价格趋势；正式项目应接公司成交库、竞品库和渠道去化数据。
- 成本与产品原型：公司内部成本库、标准产品原型库、停车/地下室/景观/外立面成本参数，才是 B 端投决备忘录真正需要的私有数据库。

推荐处理流水线：下载或接入原始数据 -> 统一投影/坐标系 -> 生成 `parcel_id / geometry / zoning / market_area / source_license / effective_date` 索引 -> PostGIS 入库 -> 给项目创建页、投决备忘录和敏感性分析提供可追溯检索。

## 限制与后续替换点

- 退界按最保守 inward buffer，未实现道路侧、异形边界逐边规则。
- 日照和地方规范仅做间距/高度近似风险，不构成报批审查。
- 当前 API 默认 JSON 落盘仓储；生产可替换为 SQLAlchemy/PostGIS 持久化和 RQ 异步任务。
- DXF 导入支持常见 ASCII LWPOLYLINE/POLYLINE 红线，复杂 CAD 图层清洗仍建议在 CAD/GIS 中预处理。
- 前端 SVG 使用本地米制坐标，MVP 不接在线地图。
- DXF 输出为概念强排底图，不包含施工图级信息。
- 投决备忘录只基于用户输入和本地测算，不构成投资建议、法定审查或报批结论；上线前应接入正式规划条件、市场成交、成本库和审批风险数据。
