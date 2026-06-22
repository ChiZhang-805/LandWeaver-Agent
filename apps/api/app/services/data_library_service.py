from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Literal

from app.schemas.domain import DataLibraryItem, DataLibrarySource

DataLibraryType = Literal["parcel", "zoning", "market", "cost", "prototype", "mobility", "context"]
PreviewKind = Literal["map", "chart", "prototype", "document"]


QUERY_SYNONYMS: dict[str, tuple[str, ...]] = {
    "地块": ("parcel", "lot", "gis", "boundary"),
    "红线": ("parcel", "boundary", "setback"),
    "控规": ("zoning", "planning", "far", "height"),
    "容积率": ("zoning", "far", "capacity"),
    "限高": ("zoning", "height", "massing"),
    "竞品": ("market", "comps", "sales"),
    "去化": ("market", "absorption", "sales"),
    "价格": ("market", "price", "asp"),
    "成本": ("cost", "hard_cost", "soft_cost"),
    "塔楼": ("prototype", "tower"),
    "板楼": ("prototype", "slab"),
    "洋房": ("prototype", "villa"),
    "配套": ("mobility", "poi", "amenity"),
    "交通": ("mobility", "transportation", "walkshed"),
    "上海": ("shanghai", "浦东", "杨浦", "闵行"),
    "纽约": ("new york", "nyc", "pluto"),
}


DATA_LIBRARY_SOURCES = [
    DataLibrarySource(
        id="overture_maps",
        name="Overture Maps",
        url="https://docs.overturemaps.org/getting-data/",
        dataset_type="context",
        license="Buildings/Base/Transportation themes use ODbL; Places includes permissive/open components with attribution requirements.",
        commercial_use="allowed",
        recommended_use="建筑足迹、POI、道路和城市上下文检索；按 bbox 下载小范围 GeoJSON 后入库。",
        notes=[
            "适合 LandWeaver 的地块周边环境、竞品位置和交通可达性底图。",
            "ODbL 数据用于商业产品时要保留归属，并注意派生数据库分享义务。",
        ],
    ),
    DataLibrarySource(
        id="nyc_mappluto",
        name="NYC MapPLUTO / PLUTO",
        url="https://www.nyc.gov/content/planning/pages/resources/datasets/mappluto-pluto-change",
        dataset_type="parcel",
        license="NYC Open Data Terms of Use; agency-specific terms and no-warranty notice apply.",
        commercial_use="unknown",
        recommended_use="公开地块、土地用途、楼面、税 lot 和纽约控规字段样本。",
        notes=[
            "字段非常接近 LandWeaver 的 parcel/zoning schema，可作为地块库标准化样板。",
            "用于正式客户场景前应保留数据版本和 NYC Open Data 条款说明。",
        ],
    ),
    DataLibrarySource(
        id="landweaver_seed",
        name="LandWeaver Seed Data",
        url="local://landweaver/seed-library",
        dataset_type="prototype",
        license="Internal synthetic seed records",
        commercial_use="allowed",
        recommended_use="产品演示、接口测试、成本库和产品原型库占位。",
        notes=[
            "不复制外部数据，用于真实数据下载和清洗前的检索 UI 验证。",
            "后续可替换为公司成本库、产品原型库和真实市场库。",
        ],
    ),
]


@dataclass(frozen=True)
class LibraryRecord:
    id: str
    title: str
    dataset_type: DataLibraryType
    city: str
    district: str | None
    source_dataset_id: str
    summary: str
    tags: tuple[str, ...]
    metrics: dict[str, float | int | str | None] = field(default_factory=dict)
    preview_kind: PreviewKind = "map"
    preview_image_url: str | None = None


APP_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = APP_DIR / "data" / "data_library" / "manifest.json"


def _known_source_ids() -> set[str]:
    return {source.id for source in DATA_LIBRARY_SOURCES}


def _valid_type(value: object) -> DataLibraryType | None:
    if value in {"parcel", "zoning", "market", "cost", "prototype", "mobility", "context"}:
        return value  # type: ignore[return-value]
    return None


def _valid_preview(value: object) -> PreviewKind:
    if value in {"map", "chart", "prototype", "document"}:
        return value  # type: ignore[return-value]
    return "map"


def _manifest_records() -> list[LibraryRecord]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    records = payload.get("items", payload if isinstance(payload, list) else [])
    if not isinstance(records, list):
        return []

    output: list[LibraryRecord] = []
    source_ids = _known_source_ids()
    for record in records:
        if not isinstance(record, dict):
            continue
        dataset_type = _valid_type(record.get("dataset_type"))
        source_id = str(record.get("source_dataset_id") or "").strip()
        if dataset_type is None or source_id not in source_ids:
            continue
        try:
            metrics = record.get("metrics", {})
            output.append(
                LibraryRecord(
                    id=str(record["id"]),
                    title=str(record["title"]),
                    dataset_type=dataset_type,
                    city=str(record.get("city") or "全国"),
                    district=str(record["district"]) if record.get("district") else None,
                    source_dataset_id=source_id,
                    summary=str(record.get("summary") or ""),
                    tags=tuple(str(tag) for tag in record.get("tags", []) if str(tag).strip()),
                    metrics=metrics if isinstance(metrics, dict) else {},
                    preview_kind=_valid_preview(record.get("preview_kind")),
                    preview_image_url=record.get("preview_image_url"),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return output


def _records() -> list[LibraryRecord]:
    seed_records = [
        LibraryRecord(
            id="seed_shanghai_pudong_context",
            title="上海浦东 1km 建筑足迹与配套上下文",
            dataset_type="context",
            city="上海",
            district="浦东",
            source_dataset_id="overture_maps",
            summary="用于快速估算周边建筑密度、POI 丰富度和交通界面，适合拿地初筛。",
            tags=("上海", "浦东", "building footprints", "poi", "context", "overture"),
            metrics={"bbox_km2": 1.0, "building_count": 184, "poi_count": 62, "roads_km": 8.4},
            preview_kind="map",
        ),
        LibraryRecord(
            id="seed_shanghai_yangpu_mobility",
            title="上海杨浦 15 分钟生活圈配套检索",
            dataset_type="mobility",
            city="上海",
            district="杨浦",
            source_dataset_id="overture_maps",
            summary="按学校、商业、地铁、办公 POI 组织周边卖点，服务产品定位和视觉简报。",
            tags=("上海", "杨浦", "配套", "交通", "poi", "walkshed"),
            metrics={"school_count": 7, "metro_count": 3, "retail_count": 45, "walk_minutes": 15},
            preview_kind="map",
        ),
        LibraryRecord(
            id="seed_nyc_pluto_lot",
            title="NYC MapPLUTO 税 lot 与建筑属性样本",
            dataset_type="parcel",
            city="纽约",
            district="Brooklyn",
            source_dataset_id="nyc_mappluto",
            summary="包含地块面积、土地用途、建筑面积、建成年份等字段，可映射到 LandWeaver 地块库。",
            tags=("纽约", "nyc", "pluto", "parcel", "lot", "land use"),
            metrics={"lot_area_ft2": 25000, "built_far": 3.2, "year_built": 2014, "units": 86},
            preview_kind="map",
        ),
        LibraryRecord(
            id="seed_nyc_zoning_capacity",
            title="NYC 住宅地块控规容量样本",
            dataset_type="zoning",
            city="纽约",
            district="Queens",
            source_dataset_id="nyc_mappluto",
            summary="把 lot、land use、FAR 和地块属性整理为可比容量包，适合校验控规字段设计。",
            tags=("纽约", "nyc", "zoning", "far", "height", "capacity"),
            metrics={"zoned_far": 4.0, "built_far": 2.7, "unused_far_ratio": 0.33, "lot_area_ft2": 42000},
            preview_kind="document",
        ),
        LibraryRecord(
            id="seed_cost_tower_cn",
            title="高层塔楼成本参数样本",
            dataset_type="cost",
            city="全国",
            district=None,
            source_dataset_id="landweaver_seed",
            summary="按塔楼、地下室、幕墙、景观和软成本拆分，后续替换为公司成本库。",
            tags=("成本", "塔楼", "hard_cost", "basement", "facade"),
            metrics={"hard_cost_cny_m2": 5200, "basement_cost_cny_m2": 7600, "soft_cost_ratio": 0.12},
            preview_kind="chart",
        ),
        LibraryRecord(
            id="seed_cost_slab_cn",
            title="板楼产品成本参数样本",
            dataset_type="cost",
            city="全国",
            district=None,
            source_dataset_id="landweaver_seed",
            summary="服务强排前期测算，可按城市等级、结构形式和地下车库比例扩展。",
            tags=("成本", "板楼", "hard_cost", "parking", "soft_cost"),
            metrics={"hard_cost_cny_m2": 4650, "parking_cost_cny_space": 98000, "soft_cost_ratio": 0.11},
            preview_kind="chart",
        ),
        LibraryRecord(
            id="seed_market_improvement_shanghai",
            title="上海改善型竞品去化样本",
            dataset_type="market",
            city="上海",
            district="闵行",
            source_dataset_id="landweaver_seed",
            summary="展示均价、月均去化、主力户型和竞品半径，后续可接第三方市场库。",
            tags=("上海", "竞品", "去化", "价格", "改善"),
            metrics={"asp_cny_m2": 78000, "monthly_absorption_units": 34, "comp_radius_km": 3.0, "sample_projects": 8},
            preview_kind="chart",
        ),
        LibraryRecord(
            id="seed_prototype_tower_95",
            title="95 m2 改善塔楼产品原型",
            dataset_type="prototype",
            city="全国",
            district=None,
            source_dataset_id="landweaver_seed",
            summary="标准层、户均面积、层数区间和塔楼足迹，可一键转为项目原型。",
            tags=("塔楼", "prototype", "95m2", "改善", "standard floor"),
            metrics={"typical_floor_gfa_m2": 720, "units_per_floor": 4, "avg_unit_area_m2": 95, "floors_max": 32},
            preview_kind="prototype",
        ),
        LibraryRecord(
            id="seed_prototype_slab_120",
            title="120 m2 横厅板楼产品原型",
            dataset_type="prototype",
            city="全国",
            district=None,
            source_dataset_id="landweaver_seed",
            summary="适合中低密改善社区，强调面宽、日照和高得房率。",
            tags=("板楼", "prototype", "120m2", "低密", "日照"),
            metrics={"typical_floor_gfa_m2": 960, "units_per_floor": 4, "avg_unit_area_m2": 120, "floors_max": 18},
            preview_kind="prototype",
        ),
    ]
    return [*seed_records, *_manifest_records()]


def _source_for(source_id: str) -> DataLibrarySource:
    return next(source for source in DATA_LIBRARY_SOURCES if source.id == source_id)


def _expand_query_tokens(value: str | None) -> list[str]:
    normalized = (value or "").lower().replace(",", " ").replace("，", " ")
    raw_tokens = [token.strip() for token in normalized.split() if token.strip()]
    compact = normalized.replace(" ", "")
    expanded: set[str] = set(raw_tokens)
    for keyword, synonyms in QUERY_SYNONYMS.items():
        if keyword.lower() in normalized or keyword.lower() in compact:
            expanded.add(keyword.lower())
            expanded.update(token.lower() for token in synonyms)
    return sorted(expanded)


def _score_record(record: LibraryRecord, query_tokens: Iterable[str], dataset_type: str | None, city: str | None) -> float:
    score = 44.0
    searchable = " ".join(
        [
            record.title,
            record.dataset_type,
            record.city,
            record.district or "",
            record.summary,
            " ".join(record.tags),
        ]
    ).lower()
    for token in query_tokens:
        if token and token.lower() in searchable:
            score += 10
    if dataset_type and record.dataset_type == dataset_type:
        score += 18
    if city and city.lower() in searchable:
        score += 18
    return round(min(score, 100.0), 1)


def list_data_library_sources() -> list[DataLibrarySource]:
    return DATA_LIBRARY_SOURCES


def search_data_library(
    query: str | None = None,
    dataset_type: str | None = None,
    city: str | None = None,
    limit: int = 24,
) -> list[DataLibraryItem]:
    query_tokens = _expand_query_tokens(query)
    normalized_type = (dataset_type or "").strip() or None
    normalized_city = (city or "").strip() or None
    results: list[DataLibraryItem] = []

    for record in _records():
        if normalized_type and record.dataset_type != normalized_type:
            continue
        searchable_city = f"{record.city} {record.district or ''}".lower()
        if normalized_city and normalized_city.lower() not in searchable_city and record.city != "全国":
            continue
        source = _source_for(record.source_dataset_id)
        results.append(
            DataLibraryItem(
                id=record.id,
                title=record.title,
                dataset_type=record.dataset_type,
                city=record.city,
                district=record.district,
                source_dataset_id=source.id,
                source_dataset_name=source.name,
                source_url=source.url,
                license=source.license,
                commercial_use=source.commercial_use,
                summary=record.summary,
                tags=list(record.tags),
                metrics=record.metrics,
                preview_image_url=record.preview_image_url,
                preview_kind=record.preview_kind,
                match_score=_score_record(record, query_tokens, normalized_type, normalized_city),
            )
        )

    return sorted(results, key=lambda item: item.match_score, reverse=True)[: max(1, min(limit, 120))]
