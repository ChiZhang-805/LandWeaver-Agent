from __future__ import annotations

from collections.abc import Iterable

from shapely.geometry import Polygon


def _footprint(candidate_or_polygon) -> Polygon:
    if isinstance(candidate_or_polygon, Polygon):
        return candidate_or_polygon
    return candidate_or_polygon["polygon"]


def is_valid_placement(footprint: Polygon, envelope: Polygon) -> bool:
    return bool(footprint.is_valid and not footprint.is_empty and envelope.covers(footprint))


def compute_conflicts(candidates: list[dict], min_spacing_m: float) -> list[tuple[int, int]]:
    conflicts: list[tuple[int, int]] = []
    spacing = max(0.0, float(min_spacing_m))
    for left_index, left in enumerate(candidates):
        left_polygon = _footprint(left)
        for right_index in range(left_index + 1, len(candidates)):
            right_polygon = _footprint(candidates[right_index])
            if left_polygon.intersects(right_polygon) or left_polygon.distance(right_polygon) < spacing:
                conflicts.append((left_index, right_index))
    return conflicts


def density_area(footprints: Iterable[Polygon | dict]) -> float:
    return round(sum(float(_footprint(item).area) for item in footprints), 4)

