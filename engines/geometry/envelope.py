from __future__ import annotations

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import orient

from .parcel import GeometryError, normalize_polygon


def _coerce_polygon(parcel: Polygon | list) -> Polygon:
    if isinstance(parcel, Polygon):
        return parcel
    return normalize_polygon(parcel)


def _largest_polygon(geometry) -> Polygon:
    if isinstance(geometry, Polygon):
        return geometry
    if isinstance(geometry, MultiPolygon):
        polygons = [polygon for polygon in geometry.geoms if polygon.area > 0]
        if polygons:
            return max(polygons, key=lambda polygon: polygon.area)
    raise GeometryError("Setbacks produced no buildable polygon.")


def buildable_envelope(parcel: Polygon | list, setbacks_m: dict[str, float] | float) -> Polygon:
    """Apply the MVP conservative setback rule using the largest inward buffer."""

    parcel_polygon = _coerce_polygon(parcel)
    if isinstance(setbacks_m, dict):
        setback = max(float(value) for value in setbacks_m.values()) if setbacks_m else 0.0
    else:
        setback = float(setbacks_m)
    setback = max(0.0, setback)

    envelope = parcel_polygon.buffer(-setback, join_style=2)
    if envelope.is_empty:
        raise GeometryError("Setback is larger than the parcel can support.")

    envelope = _largest_polygon(envelope)
    if envelope.area <= 0 or not envelope.is_valid:
        raise GeometryError("Buildable envelope is invalid after applying setbacks.")
    return orient(envelope, sign=1.0)

