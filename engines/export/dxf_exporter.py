from __future__ import annotations

from pathlib import Path

import ezdxf
from shapely.geometry import Polygon

from engines.geometry import polygon_to_points


LAYERS = ["PARCEL_REDLINE", "BUILDABLE_ENVELOPE", "BUILDING_FOOTPRINT", "BUILDING_LABEL", "RISK"]


def _add_polygon(msp, points: list, layer: str) -> None:
    coords = [(float(x), float(y)) for x, y in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    msp.add_lwpolyline(coords, close=True, dxfattribs={"layer": layer})


def export_dxf(parcel_polygon: Polygon, option: dict, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = ezdxf.new("R2010")
    for layer in LAYERS:
        if layer not in doc.layers:
            doc.layers.add(layer)
    msp = doc.modelspace()
    _add_polygon(msp, polygon_to_points(parcel_polygon), "PARCEL_REDLINE")
    if option.get("buildable_envelope"):
        _add_polygon(msp, option["buildable_envelope"], "BUILDABLE_ENVELOPE")
    for index, building in enumerate(option.get("buildings", []), start=1):
        _add_polygon(msp, building["footprint"], "BUILDING_FOOTPRINT")
        x, y = building["centroid"]
        label = f"B{index} {building['floors']}F {round(building['gfa_m2'])}m2"
        msp.add_text(label, dxfattribs={"layer": "BUILDING_LABEL", "height": 2.5}).set_placement((x, y))
    for index, risk in enumerate(option.get("risk_flags", []), start=1):
        msp.add_text(risk[:120], dxfattribs={"layer": "RISK", "height": 2.2}).set_placement((0, -index * 5))
    doc.saveas(path)
    return path

