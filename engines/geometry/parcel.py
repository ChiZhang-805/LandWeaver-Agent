from __future__ import annotations

from typing import Iterable, Sequence

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import orient
from shapely.validation import make_valid


class GeometryError(ValueError):
    """Raised when a user supplied geometry cannot be repaired safely."""


PointLike = Sequence[float] | dict[str, float]


def _coerce_point(point: PointLike) -> tuple[float, float]:
    if isinstance(point, dict):
        return float(point["x"]), float(point["y"])
    if len(point) < 2:
        raise GeometryError("Each point must contain x and y coordinates.")
    return float(point[0]), float(point[1])


def _largest_polygon(geometry) -> Polygon:
    if isinstance(geometry, Polygon):
        return geometry
    if isinstance(geometry, MultiPolygon):
        polygons = [polygon for polygon in geometry.geoms if polygon.area > 0]
        if not polygons:
            raise GeometryError("Polygon repair produced no positive-area polygon.")
        return max(polygons, key=lambda polygon: polygon.area)
    raise GeometryError(f"Expected polygon geometry, got {geometry.geom_type}.")


def normalize_polygon(points: Iterable[PointLike]) -> Polygon:
    """Return a valid, closed, counter-clockwise polygon in local meter coordinates."""

    coords = [_coerce_point(point) for point in points]
    if len(coords) < 3:
        raise GeometryError("At least three points are required to create a parcel polygon.")

    if coords[0] != coords[-1]:
        coords.append(coords[0])

    distinct_points = set(coords[:-1])
    if len(distinct_points) < 3:
        raise GeometryError("A polygon requires at least three distinct points.")

    polygon = Polygon(coords)

    if not polygon.is_valid:
        repaired = make_valid(polygon)
        polygon = _largest_polygon(repaired)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
            polygon = _largest_polygon(polygon)
    elif polygon.area <= 0:
        raise GeometryError("Polygon area must be greater than zero.")

    if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
        raise GeometryError("Polygon is invalid and could not be repaired.")

    return orient(polygon, sign=1.0)


def compute_area_m2(polygon: Polygon) -> float:
    if polygon.is_empty or not polygon.is_valid:
        raise GeometryError("Cannot compute area for invalid polygon.")
    return round(float(polygon.area), 4)


def polygon_to_points(polygon: Polygon) -> list[list[float]]:
    return [[round(float(x), 4), round(float(y), 4)] for x, y in polygon.exterior.coords]
