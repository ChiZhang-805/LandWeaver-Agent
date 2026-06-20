from __future__ import annotations

from shapely.geometry import box

from engines.geometry import (
    buildable_envelope,
    candidate_footprints,
    compute_area_m2,
    compute_conflicts,
    is_valid_placement,
    normalize_polygon,
)


def test_polygon_normalize_and_area(rectangular_parcel):
    polygon = normalize_polygon(rectangular_parcel["points"])
    assert polygon.is_valid
    assert polygon.exterior.coords[0] == polygon.exterior.coords[-1]
    assert compute_area_m2(polygon) == 9600


def test_polygon_normalize_repairs_self_intersection():
    polygon = normalize_polygon([[0, 0], [10, 10], [0, 10], [10, 0]])
    assert polygon.is_valid
    assert compute_area_m2(polygon) > 0


def test_buildable_envelope(rectangular_parcel, planning_constraints):
    polygon = normalize_polygon(rectangular_parcel["points"])
    envelope = buildable_envelope(polygon, planning_constraints["setbacks_m"])
    assert envelope.is_valid
    assert envelope.area < polygon.area
    assert round(envelope.area) == 6000


def test_candidate_generation(rectangular_parcel, planning_constraints, tower_prototype):
    polygon = normalize_polygon(rectangular_parcel["points"])
    envelope = buildable_envelope(polygon, planning_constraints["setbacks_m"])
    candidates = candidate_footprints(envelope, tower_prototype, spacing_grid_m=12, rotations=(0, 90))
    assert candidates
    assert all(is_valid_placement(candidate["polygon"], envelope) for candidate in candidates)
    assert candidates[0]["gfa_m2"] == tower_prototype["typical_floor_gfa_m2"] * tower_prototype["floors_max"]


def test_conflict_detection():
    candidates = [
        {"polygon": box(0, 0, 10, 10)},
        {"polygon": box(15, 0, 25, 10)},
        {"polygon": box(31, 0, 41, 10)},
    ]
    assert compute_conflicts(candidates, min_spacing_m=8) == [(0, 1), (1, 2)]
