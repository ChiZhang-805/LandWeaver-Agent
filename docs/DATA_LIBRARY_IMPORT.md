# LandWeaver 检索库导入方案

## 当前数据

当前 `/api/data-library` 有 9 条内部 seed 数据，覆盖：

- 地块与城市上下文
- 控规容量
- 竞品去化
- 成本参数
- 产品原型
- 交通与配套

本轮已新增项目页 `项目 / 数据`，页面上方筛选、下方图库式卡片展示。后端支持从 `apps/api/app/data/data_library/manifest.json` 自动合并外部小样本。

## 建议先接的数据

1. Overture Maps

- 用于建筑足迹、POI、道路、交通和城市上下文。
- 推荐按 bbox 下载，不下载全球全量。
- 适合作为 LandWeaver 的“周边环境”和“地块竞品半径”底图。

2. NYC MapPLUTO / PLUTO

- 字段接近真实地块库：lot、land use、built FAR、lot area、building class 等。
- 适合训练 LandWeaver 的地块字段标准化和控规容量检索。

3. 公司内部成本库

- 字段建议：城市、产品类型、结构体系、地下室比例、建安单方、软成本比例、版本日期。
- 可直接进入成本测算和投决敏感性分析。

4. 产品原型库

- 字段建议：类型、足迹宽深、标准层面积、层数范围、户均面积、得房率、适用地块条件。
- 可直接生成强排原型并用于方案对比。

## 导入流程

1. 原始下载放在根目录忽略路径：

```bash
mkdir -p data/raw/overture data/raw/nyc_pluto
```

2. 标准化为小样本：

- 每条记录写入类型、城市、摘要、标签、指标。
- 生成一张 PNG/SVG 缩略图，或者保留 `preview_kind` 让前端生成地图/图表/原型占位图。
- 抽 100 条先放入产品目录验证检索体验。

3. 写入产品目录：

```text
apps/api/app/data/data_library/
  manifest.json
  assets/
    land_0001.png
```

4. 验证：

- 打开项目内“数据检索库”。
- 按城市、类型、关键词筛选。
- 检查下方卡片是否显示缩略图、指标、来源和标签。

## 后续可加的大模型能力

- Zoning reader：读取控规文本、规划条件 PDF，抽取 FAR、密度、限高、退线。
- Market brief reasoner：把竞品去化和价格整理为投委会式结论。
- Site context vision：根据卫星图/街景/总平图解释界面、噪声、可达性和风险。
- Data librarian：自动检查外部数据字段缺失、单位不统一、城市名称混杂和重复样本。
