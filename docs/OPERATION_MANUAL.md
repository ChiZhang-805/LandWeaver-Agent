# LandWeaver Agent 操作手册

本文面向投拓、设计管理、概念方案、产品和运营维护人员，说明如何启动、使用、演示和维护 LandWeaver Agent（地织）。

## 1. 产品定位

LandWeaver 是面向 B 端的 AI 强排与测算引擎。

核心流程是：

1. 创建项目并录入城市。
2. 输入地块红线。
3. 填写项目简报。
4. 填写规划约束。
5. 配置楼栋产品原型。
6. 生成多套强排方案。
7. 查看指标、风险、收益和方案质量评审。
8. 生成投决备忘录、尽调证据包、视觉设计包和导出文件。

重要边界：

- LLM 不直接生成最终楼栋坐标。
- 楼栋坐标、容积率、密度、建面、户数、货值、成本、毛利和导出文件都由本地算法计算。
- 投决备忘录只基于用户输入和系统测算，不构成投资建议、法定审查或报批结论。

## 2. 快速启动

本地启动后端：

```bash
cd /home/chi/Project/LandWeaver-Agent
cp .env.example .env
pip install -r requirements.txt
PYTHONPATH=apps/api:. uvicorn app.main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8001
```

本地启动前端：

```bash
cd /home/chi/Project/LandWeaver-Agent/apps/web
npm install
LANDWEAVER_API_BASE_URL=http://127.0.0.1:8001 npm run dev
```

打开：

```text
http://localhost:3000
```

如果 3000 被占用：

```bash
npm run dev -- --hostname 0.0.0.0 --port 3001
```

生产构建检查：

```bash
cd /home/chi/Project/LandWeaver-Agent/apps/web
npm run typecheck
npm run lint
npm run build
```

后端测试：

```bash
cd /home/chi/Project/LandWeaver-Agent
python -m pytest apps/api/tests -q
```

## 3. Render 使用

Render Blueprint 文件位于仓库根目录：

```text
render.yaml
```

Blueprint 会创建：

- `landweaver-api`：FastAPI 后端。
- `landweaver-web`：Next.js 前端。

前端通过服务端代理访问 API：

```env
LANDWEAVER_API_BASE_URL=https://landweaver-api.onrender.com
```

Render Free plan 可能休眠。首次打开慢或长时间无人访问后再次打开慢，通常是实例冷启动。若出现 API 错误，优先检查：

1. `landweaver-api` 服务是否成功启动。
2. API 健康检查 `/health` 是否正常。
3. `landweaver-web` 的 `LANDWEAVER_API_BASE_URL` 是否指向正确 API 地址。
4. Render 日志中是否有 Python 依赖、存储目录或启动命令错误。

当前 Blueprint 使用 JSON/文件落盘，适合公开 demo。生产环境应迁移到 Postgres/PostGIS、对象存储和正式任务队列。

## 4. OpenAI Key 和模型设置

网页端设置入口：

```text
/settings
```

可配置项：

- OpenAI API Key
- 解释模型
- 简报模型

当前页面下拉候选以代码为准，包含：

- 解释模型：`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.4-nano`、`gpt-4.1`
- 简报模型：`gpt-5.4-mini`、`gpt-5.4-nano`、`gpt-5.4`、`gpt-5.5`
- 自定义模型 ID

保存规则：

- Key 和模型选择只保存在当前浏览器 `localStorage`。
- 后端不会把网页输入的 Key 写入 Render、文件或数据库。
- 调用 API 时，前端通过请求头临时发送：
  - `X-OpenAI-API-Key`
  - `X-OpenAI-Model-Text`
  - `X-OpenAI-Model-Fast`

无 Key 时系统进入 deterministic mock 模式，仍可完成强排、测算、报告和导出。

## 5. 推荐演示路径

### 5.1 快速演示

1. 打开首页。
2. 输入项目名称和城市。
3. 点击 `创建强排项目`。
4. 在地块页点击 `120m x 80m` 示例地块并保存。
5. 进入简报页，填写项目偏好。
6. 进入约束页，填写容积率、密度、退界、限高、售价、成本等参数。
7. 进入原型页，点击默认 tower/slab 原型。
8. 进入生成页，运行强排。
9. 进入方案页查看指标和候选方案卡片。
10. 打开方案详情，查看 3D、评审、投决备忘录、尽调、敏感性和导出。
11. 进入视觉页，生成视觉设计包。

适合 8 到 12 分钟演示。

### 5.2 投拓工作流

1. 新建项目。
2. 导入红线 points、GeoJSON 或 DXF。
3. 写项目简报：定位、风险偏好、产品方向、现金流要求。
4. 填规划约束：FAR、密度、绿地率、限高、退界、停车、楼间距。
5. 配置楼栋原型：tower、slab、villa、podium 或公司标准产品。
6. 运行生成前诊断，确认阻断项。
7. 生成强排候选。
8. 对比 revenue_first、balanced、low_risk 等策略结果。
9. 打开最优或备选方案详情。
10. 生成投资备忘录和尽调证据包。
11. 导出 GeoJSON、DXF、CSV 或 HTML 报告。

## 6. 页面说明

### 首页

用途：创建项目，切换产品叙事章节。

检查点：

- 3D 场景是否正常显示。
- 项目名称和城市是否填写正确。
- 城市字段用于报告、尽调检索、视觉包和投决上下文；当前不会自动套用地方控规或价格库。
- `几何` 会创建项目并进入红线编辑。
- `强排` 会创建示例项目、写入示例红线/约束/原型并生成方案。
- `导出` 会创建示例项目、生成方案并进入报告页。
- 创建失败时查看 API 是否启动。

### 项目页

用途：查看项目列表、创建、复制、归档和删除项目。

建议：

- 演示前清理明显无用的测试项目。
- 生产版应加入权限、团队空间和项目归属。

### 指挥中心

用途：查看项目完整工作流、阻断项、自动化计划、LLM 模块和便携服务。

重点看：

- 红线、简报、约束、原型是否齐全。
- 生成前诊断是否 `ready` 或 `needs_attention`。
- 当前缺哪些数据。

### 地块

用途：录入和编辑红线。

支持：

- 手动编辑坐标点。
- 示例矩形地块。
- GeoJSON 导入。
- DXF 导入。

操作建议：

- 红线点应按顺序围合。
- 面积明显异常时先检查坐标单位。
- DXF 复杂图层建议先在 CAD/GIS 中清理，只保留红线 polyline。

### 简报

用途：把自然语言项目目标转成结构化 PlanningBrief。

建议填写：

- 项目定位。
- 客群。
- 产品偏好。
- 风险偏好。
- 收益优先或稳健优先。
- 特殊约束或管理层要求。

### 约束

用途：录入规划和经济假设。

关键字段：

- 最大容积率。
- 最大建筑密度。
- 最小绿地率。
- 退界。
- 限高。
- 楼间距。
- 售价。
- 建安成本。
- 软硬成本、停车和地下室假设。

注意：

- 约束过紧会导致无解。
- 修改约束后，旧方案会被清空，需要重新生成。

### 原型

用途：维护产品楼栋模板。

当前支持：

- `tower`
- `slab`
- `villa`
- `podium`

关键字段：

- footprint 宽深。
- 最小/最大层数。
- 标准层面积。
- 每层户数。
- 平均户型面积。
- 层高。

建议：

- B 端生产环境应把这里接入公司标准产品库。
- 每个城市或区域可维护不同产品原型。

### 生成

用途：运行强排优化。

生成前先看诊断：

- 红线是否存在。
- 约束是否合理。
- 原型是否能放入红线。
- 候选数量是否足够。

无解时处理：

1. 放宽退界或楼间距。
2. 降低原型 footprint。
3. 调整层数或产品组合。
4. 检查 FAR、密度、限高是否互相冲突。

### 方案

用途：比较强排候选。

重点指标：

- FAR。
- 建筑密度。
- 总建面。
- 户数。
- 货值。
- 毛利率。
- 风险标签。

页面采用卡片列表，桌面和移动端都避免横向滚动。

### 方案详情

用途：深度审查单个 site option。

包含：

- 平面图。
- 3D 体块。
- 楼栋明细。
- 产品分解。
- 方案质量评审。
- 投决备忘录。
- 尽调证据包。
- 敏感性分析。
- 派生方案。
- 导出。

### 报告页

用途：生成和下载 HTML 报告。

报告包含：

- 指标摘要。
- 方案说明。
- 投决备忘录。
- 尽调证据包。

### 视觉页

用途：基于真实强排方案生成视觉设计包。

输出：

- 视觉概念。
- 建筑风格。
- 景观策略。
- 材质色板。
- 渲染提示词。
- 汇报版式建议。

注意：

- 视觉包不改变楼栋坐标和测算指标。
- 渲染提示词用于概念表达，不构成报批或设计承诺。

## 7. 强排算法摘要

系统主要步骤：

1. Shapely 归一化红线 polygon。
2. 按退界生成可建 envelope。
3. 根据楼栋原型生成候选 footprint。
4. 预计算重叠和楼间距冲突。
5. 用 OR-Tools CP-SAT 选择候选楼栋。
6. 加入 FAR、密度、至少一栋楼等硬约束。
7. 按 revenue_first、balanced、low_risk 生成不同策略。
8. Profit Engine 计算售价、成本、货值、毛利和敏感性。
9. 本地评审模块输出风险、短板和下一步动作。

如果 OR-Tools 不可用，系统会使用贪心 fallback，以保证 demo 可运行。

## 8. 数据仓和检索库维护

LandWeaver 后续应建设多层 B 端数据仓。

### 8.1 地块与规划条件库

字段建议：

```text
parcel_id
geometry
city
district
land_use
zoning_code
far_max
density_max
green_ratio_min
height_limit_m
setback_rules
parking_rule
source_name
source_license
effective_date
```

技术建议：

- 使用 PostGIS 存储 geometry。
- 所有空间数据统一坐标系。
- 每条规划条件必须保留来源和生效日期。

### 8.2 市场价格库

字段建议：

```text
market_area
product_type
avg_price_cny_m2
price_low
price_high
transaction_date
source
confidence
```

用途：

- 自动填售价假设。
- 生成敏感性场景。
- 支撑投决备忘录中的价格依据。

### 8.3 竞品和去化库

字段建议：

```text
project_name
location
product_type
unit_area_band
listed_price
transaction_price
monthly_sales_units
inventory_units
open_date
source
```

用途：

- 判断产品定位。
- 判断去化风险。
- 支持投委会问题准备。

### 8.4 公司成本库

字段建议：

```text
city
product_type
structure_type
above_ground_cost_cny_m2
basement_cost_cny_m2
facade_cost_cny_m2
landscape_cost_cny_m2
parking_cost
updated_at
owner_team
```

用途：

- 替代 demo 中的经验成本参数。
- 输出更可信的毛利和敏感性。

### 8.5 产品原型库

字段建议：

```text
prototype_id
type
footprint_width_m
footprint_depth_m
floors_min
floors_max
typical_floor_gfa_m2
units_per_floor
avg_unit_area_m2
height_per_floor_m
tags
region
version
```

用途：

- 快速导入公司标准产品。
- 按城市、客群和产品线生成不同候选空间。

## 9. 常见故障处理

### 页面打开慢

可能原因：

- Render Free plan 冷启动。
- 3D 首页首次加载资源。
- API 服务刚被唤醒。

处理：

1. 等待 30 到 90 秒。
2. 刷新页面。
3. 检查 API `/health`。
4. 查看 Render 服务日志。

### Internal Server Error

处理顺序：

1. 查看 `landweaver-api` 日志。
2. 检查 `LANDWEAVER_STORAGE_DIR` 是否可写。
3. 检查 `LANDWEAVER_API_BASE_URL` 是否正确。
4. 本地运行 `python -m pytest apps/api/tests -q`。
5. 本地运行 `npm run build`。

### 无法生成方案

常见原因：

- 没有红线。
- 没有约束。
- 没有楼栋原型。
- 原型太大，放不进可建范围。
- FAR、密度、限高、楼间距互相冲突。

处理：

1. 看生成页诊断。
2. 降低产品 footprint。
3. 放宽退界或楼间距。
4. 检查限高和层数。
5. 重新保存约束后再生成。

### OpenAI 不生效

检查：

1. `/settings` 是否保存 Key。
2. 状态来源是否显示 `本浏览器` 或 `环境变量`。
3. 模型 ID 是否为空。
4. 浏览器是否禁用了 localStorage。
5. 后端日志是否有 OpenAI 调用错误。

无 Key 或调用失败时会 fallback 到 mock。

### 页面出现横向滚动

本项目设计要求：

- 页面根节点不出现横向滚动。
- 长内容放在模块内部纵向滚动。
- 表格尽量改为卡片或网格。
- 移动端不依赖横向滚动条。

检查方式：

1. 用 390px 宽移动端视口打开首页、项目页、地块页、方案页、设置页。
2. 检查浏览器底部是否出现横向滚动。
3. 检查长项目名、方案 ID、指标值和按钮是否换行或截断合理。

## 10. 上线前检查清单

每次改完功能后至少运行：

```bash
cd /home/chi/Project/LandWeaver-Agent
python -m pytest apps/api/tests -q

cd /home/chi/Project/LandWeaver-Agent/apps/web
npm run typecheck
npm run lint
npm run build
```

浏览器检查：

- 首页 3D canvas 非空并正常动画。
- 桌面和移动端无根级纵向滚动条。
- 无横向滚动。
- 地块页坐标编辑可用。
- 方案页卡片切换可用。
- 设置页保存和清除浏览器 Key 可用。
- 方案详情、报告、视觉页可打开。

## 11. 运营建议

- 公开 demo 默认不配置站主 Key，让客户自己在浏览器填写。
- 演示时先用简单矩形地块跑通，再展示 GeoJSON/DXF 导入。
- 对外表达为“强排初筛、投决材料草稿、尽调清单生成”，不要表达为报批审查。
- 商用前优先接入正式 PostGIS 地块库、规划条件库、竞品去化库、成本库和公司产品原型库。
- 所有外部数据必须保留来源、授权、有效日期和更新责任人。
