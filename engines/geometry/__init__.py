from .parcel import GeometryError, compute_area_m2, normalize_polygon, polygon_to_points
from .envelope import buildable_envelope
from .candidates import candidate_footprints
from .collision import compute_conflicts, density_area, is_valid_placement

__all__ = [
    "GeometryError",
    "normalize_polygon",
    "compute_area_m2",
    "polygon_to_points",
    "buildable_envelope",
    "candidate_footprints",
    "compute_conflicts",
    "density_area",
    "is_valid_placement",
]

