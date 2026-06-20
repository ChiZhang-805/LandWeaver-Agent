from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from shapely.geometry import Polygon

from engines.geometry import polygon_to_points


def _ring(points: list[list[float]] | list[tuple[float, float]]) -> list[list[float]]:
    coords = [[float(x), float(y)] for x, y in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


def _polygon_feature(name: str, points: list, properties: dict[str, Any]) -> dict:
    return {
        "type": "Feature",
        "properties": {"name": name, **properties},
        "geometry": {"type": "Polygon", "coordinates": [_ring(points)]},
    }


def export_geojson(parcel_polygon: Polygon, option: dict, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    features = [
        _polygon_feature(
            "parcel",
            polygon_to_points(parcel_polygon),
            {"layer": "parcel", "area_m2": round(parcel_polygon.area, 4)},
        )
    ]
    if option.get("buildable_envelope"):
        features.append(
            _polygon_feature(
                "buildable_envelope",
                option["buildable_envelope"],
                {"layer": "buildable_envelope"},
            )
        )
    for index, building in enumerate(option.get("buildings", []), start=1):
        features.append(
            _polygon_feature(
                f"building_{index}",
                building["footprint"],
                {
                    "layer": "building_footprints",
                    "prototype_id": building["prototype_id"],
                    "floors": building["floors"],
                    "gfa_m2": building["gfa_m2"],
                    "units": building["units"],
                    "score": option.get("score", 0),
                },
            )
        )
    collection = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    return path

