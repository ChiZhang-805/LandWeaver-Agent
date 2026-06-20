from __future__ import annotations

import math
from typing import Any

from shapely import affinity
from shapely.geometry import Polygon, box

from .collision import is_valid_placement


def _get_value(prototype: Any, key: str):
    if isinstance(prototype, dict):
        return prototype[key]
    return getattr(prototype, key)


def _prototype_id(prototype: Any) -> str:
    if isinstance(prototype, dict):
        return str(prototype.get("id") or prototype.get("prototype_id") or prototype.get("type", "prototype"))
    return str(getattr(prototype, "id", None) or getattr(prototype, "type", "prototype"))


def _floor_values(prototype: Any) -> list[int]:
    floors_min = int(_get_value(prototype, "floors_min"))
    floors_max = int(_get_value(prototype, "floors_max"))
    mid = max(floors_min, int(round((floors_min + floors_max) / 2)))
    return sorted({floors_min, mid, floors_max}, reverse=True)


def _rectangle(center_x: float, center_y: float, width: float, depth: float, rotation_deg: float) -> Polygon:
    rectangle = box(center_x - width / 2, center_y - depth / 2, center_x + width / 2, center_y + depth / 2)
    if rotation_deg % 360:
        rectangle = affinity.rotate(rectangle, rotation_deg, origin=(center_x, center_y), use_radians=False)
    return rectangle


def candidate_footprints(
    envelope: Polygon,
    prototype: Any,
    spacing_grid_m: float = 12.0,
    rotations: tuple[int, ...] | list[int] = (0, 90),
    max_candidates: int = 220,
) -> list[dict]:
    """Generate deterministic discrete building candidates fully inside the envelope."""

    width = float(_get_value(prototype, "footprint_width_m"))
    depth = float(_get_value(prototype, "footprint_depth_m"))
    floor_values = _floor_values(prototype)
    typical_floor_gfa = float(_get_value(prototype, "typical_floor_gfa_m2"))
    units_per_floor = int(_get_value(prototype, "units_per_floor"))
    height_per_floor = float(_get_value(prototype, "height_per_floor_m"))
    prototype_type = str(_get_value(prototype, "type"))
    prototype_id = _prototype_id(prototype)

    min_x, min_y, max_x, max_y = envelope.bounds
    step = max(2.0, float(spacing_grid_m))
    candidates: list[dict] = []
    index = 0

    x = min_x
    while x <= max_x + 1e-6:
        y = min_y
        while y <= max_y + 1e-6:
            for rotation in rotations:
                footprint = _rectangle(x, y, width, depth, float(rotation))
                if is_valid_placement(footprint, envelope):
                    for floors in floor_values:
                        gfa_m2 = typical_floor_gfa * floors
                        candidates.append(
                            {
                                "id": f"{prototype_id}-{floors}f-{index:04d}",
                                "prototype_id": prototype_id,
                                "prototype_type": prototype_type,
                                "polygon": footprint,
                                "rotation_deg": float(rotation),
                                "floors": floors,
                                "height_m": floors * height_per_floor,
                                "gfa_m2": gfa_m2,
                                "footprint_area_m2": float(footprint.area),
                                "units": units_per_floor * floors,
                                "units_per_floor": units_per_floor,
                                "edge_clearance_m": float(envelope.boundary.distance(footprint)),
                            }
                        )
                        index += 1
                        if len(candidates) >= max_candidates:
                            return candidates
            y += step
        x += step

    candidates.sort(
        key=lambda candidate: (
            -candidate["edge_clearance_m"],
            -candidate["floors"],
            math.hypot(candidate["polygon"].centroid.x, candidate["polygon"].centroid.y),
            candidate["id"],
        )
    )
    return candidates[:max_candidates]
