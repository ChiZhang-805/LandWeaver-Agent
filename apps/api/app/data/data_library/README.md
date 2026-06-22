# LandWeaver Data Library

这个目录用于放真正进入 LandWeaver 检索库的小样本数据。

当前状态：
- 后端默认提供 9 条 seed 数据，覆盖地块、控规、市场、成本、交通配套、产品原型。
- 如果本目录存在 `manifest.json`，后端会自动把其中的 items 合并进 `/api/data-library`。
- `assets/` 会通过 API 挂载到 `/library-assets/land/`，可用于 manifest 里的 `preview_image_url`。

推荐目录结构：

```text
apps/api/app/data/data_library/
  manifest.json
  assets/
    shanghai_context_0001.png
    nyc_pluto_lot_0001.png
```

`manifest.json` 格式：

```json
{
  "items": [
    {
      "id": "overture_shanghai_0001",
      "title": "上海样本地块周边建筑与 POI",
      "dataset_type": "context",
      "city": "上海",
      "district": "浦东",
      "source_dataset_id": "overture_maps",
      "summary": "用于拿地初筛的建筑足迹、道路和 POI 上下文样本。",
      "tags": ["上海", "浦东", "building footprints", "poi"],
      "metrics": {
        "bbox_km2": 1.0,
        "building_count": 180,
        "poi_count": 60
      },
      "preview_image_url": "/library-assets/land/shanghai_context_0001.png",
      "preview_kind": "map"
    }
  ]
}
```

注意：
- 大型原始下载不要放在这里，放到仓库根目录的 `data/raw/` 或 `data/external/`，这些路径已被 `.gitignore` 忽略。
- 这个目录只放要跟随 GitHub/Render 部署的小体量样本，例如 100 条 GeoJSON/PNG 缩略图和对应 manifest。
